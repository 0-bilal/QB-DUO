// 1. الإعدادات الثابتة
const MVR_FOLDER_ID = '1iknqa3MdwqCZXYoLdIVrQCI6Zue-liEp';
const MVR_SHEET_NAME = "MVR";
const EMAIL_SHEET_NAME = "Emails";

// قائمة الموظفين المعتمدين للتحقق الأمني
const AUTHORIZED_EMPLOYEES = {
  "1000": "بلال الخواجة",
  "8121": "مطور النظام",
  "1101": "رمان",
  "1311": "محمد",
  "1551": "شاهين",
  "1421": "نسيم",
  "1711": "دورجا"
};

function triggerPermissions() {
  DriveApp.getRootFolder();
  const folder = DriveApp.getFolderById(MVR_FOLDER_ID);
  console.log("Access Verified for: " + folder.getName());
}

function checkSystemHealth() {
  const report = {
    driveApi: "Unknown",
    folderAccess: "Unknown",
    folderId: MVR_FOLDER_ID,
    scopes: ScriptApp.getAuthInfo().getMsg()
  };
  try {
    const folder = DriveApp.getFolderById(MVR_FOLDER_ID);
    report.folderAccess = "OK (Name: " + folder.getName() + ")";
  } catch (e) {
    report.folderAccess = "Error: " + e.toString();
  }
  try {
    const files = Drive.Files.list({maxResults: 1});
    report.driveApi = "Enabled & Working";
  } catch (e) {
    report.driveApi = "Disabled or Error: " + e.toString();
  }
  return report;
}

function getNotificationEmails() {
  const FALLBACK_EMAIL = "bilal15155@gmail.com";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(EMAIL_SHEET_NAME);

    // الورقة غير موجودة → استخدم البريد الاحتياطي
    if (!emailSheet) {
      console.warn('ورقة Emails غير موجودة — سيُستخدم البريد الاحتياطي: ' + FALLBACK_EMAIL);
      return { to: FALLBACK_EMAIL, cc: "" };
    }

    const data = emailSheet.getDataRange().getValues();
    let mainRecipient = "";
    let ccRecipients  = [];

    for (let i = 1; i < data.length; i++) {
      const email = data[i][0] ? data[i][0].toString().trim() : "";
      const type  = data[i][3] ? data[i][3].toString().trim() : "";
      if (!email) continue;

      if (type.toLowerCase() === "to") {
        mainRecipient = email;
      } else {
        ccRecipients.push(email);
      }
    }

    // لم يُعثر على مستلم To في الورقة → استخدم البريد الاحتياطي
    if (!mainRecipient) {
      console.warn('لا يوجد مستلم To في ورقة Emails — سيُستخدم البريد الاحتياطي: ' + FALLBACK_EMAIL);
      mainRecipient = FALLBACK_EMAIL;
    }

    return { to: mainRecipient, cc: ccRecipients.join(",") };

  } catch (e) {
    console.error('خطأ في getNotificationEmails: ' + e.toString());
    return { to: FALLBACK_EMAIL, cc: "" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// المدخل الرئيسي
// ─────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.parameter.payload);
    const action  = payload.action;

    if (action === 'test') {
      return createJsonResponse({ result: "health_check", report: checkSystemHealth() });
    }

    // التحقق الأمني من هوية الموظف لكل الطلبات
    const validName = AUTHORIZED_EMPLOYEES[payload.empId];
    if (!validName || validName !== payload.employeeName) {
      console.error(`فشل التحقق — ID: ${payload.empId}, مُرسَل: "${payload.employeeName}", متوقع: "${validName}"`);
      return createJsonResponse({ result: "error", message: "فشل التحقق من هوية الموظف. يرجى التأكد من رقم الموظف والاسم." });
    }

    // المرحلة 1: تهيئة جلسة Resumable Upload داخل Apps Script
    if (action === 'initUpload') {
      return initDriveUploadSession(payload);
    }

    // المرحلة 2: استقبال قطعة base64 من المتصفح ورفعها لـ Drive مباشرة
    if (action === 'uploadChunk') {
      return proxyUploadChunk(payload);
    }

    // المرحلة 3: تسجيل البيانات في الشيت بعد اكتمال الرفع
    if (action === 'finishReport') {
      return saveReportToSheet(payload);
    }

    return createJsonResponse({ result: "error", message: "Invalid Action" });

  } catch (error) {
    return createJsonResponse({ result: "error", message: error.toString() });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// المرحلة 1: إنشاء جلسة Resumable في Drive وحفظ رابطها داخلياً
// لا يخرج أي token أو رابط حساس للمتصفح — آمن تماماً
// ─────────────────────────────────────────────────────────────────────────────
function initDriveUploadSession(payload) {
  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': payload.mimeType,
      'X-Upload-Content-Length': payload.fileSize.toString()
    },
    payload: JSON.stringify({ name: payload.fileName, parents: [MVR_FOLDER_ID] }),
    muteHttpExceptions: true,
    followRedirects: false
  };

  const response     = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const uploadUrl    = response.getHeaders()['Location'];

  if (responseCode >= 400 || !uploadUrl) {
    console.error("Drive API Error: " + response.getContentText());
    throw new Error(`فشل الاتصال بـ Drive (Code: ${responseCode}). تأكد من تفعيل Drive API وصلاحية المجلد.`);
  }

  // نحفظ رابط الجلسة في ScriptProperties فقط — لا يصل للمتصفح أبداً
  const sessionId = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(
    'mvr_' + sessionId,
    JSON.stringify({ uploadUrl: uploadUrl, mimeType: payload.mimeType })
  );

  return createJsonResponse({ result: 'success', sessionId: sessionId });
}

// ─────────────────────────────────────────────────────────────────────────────
// المرحلة 2: استقبال قطعة base64 من المتصفح ورفعها لـ Drive
// Apps Script يتولى كل تواصل مع Drive — المتصفح لا يتصل بـ googleapis مطلقاً
// ─────────────────────────────────────────────────────────────────────────────
function proxyUploadChunk(payload) {
  // payload: { sessionId, base64Chunk, rangeStart, rangeEnd, fileSize, empId, employeeName }
  const props      = PropertiesService.getScriptProperties();
  const key        = 'mvr_' + payload.sessionId;
  const sessionStr = props.getProperty(key);

  if (!sessionStr) {
    throw new Error('جلسة الرفع غير موجودة أو انتهت صلاحيتها. يرجى إعادة المحاولة.');
  }

  const session      = JSON.parse(sessionStr);
  const chunkBytes   = Utilities.base64Decode(payload.base64Chunk);
  const contentRange = 'bytes ' + payload.rangeStart + '-' + payload.rangeEnd + '/' + payload.fileSize;

  const response = UrlFetchApp.fetch(session.uploadUrl, {
    method: 'put',
    headers: {
      'Content-Type': session.mimeType,
      'Content-Range': contentRange
    },
    payload: chunkBytes,
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();

  if (status === 200 || status === 201) {
    // اكتمل الرفع — احذف الجلسة المؤقتة وأرجع fileId للمتصفح فقط
    props.deleteProperty(key);
    const fileData = JSON.parse(response.getContentText());
    return createJsonResponse({ result: 'complete', fileId: fileData.id });

  } else if (status === 308) {
    // القطعة وُصلت بنجاح، Drive ينتظر المزيد
    return createJsonResponse({ result: 'success', uploaded: payload.rangeEnd + 1 });

  } else {
    const errorBody = response.getContentText();
    console.error('Drive Chunk Error (' + status + '): ' + errorBody);
    throw new Error('رفض Drive القطعة (كود: ' + status + ').');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// المرحلة 3: حفظ البيانات في الشيت وإرسال الإيميل
// ─────────────────────────────────────────────────────────────────────────────
function saveReportToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MVR_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MVR_SHEET_NAME);
    sheet.appendRow(["ID", "التاريخ", "الوقت", "اسم الموظف", "الفرع", "رابط الفيديو", "حالة الإيميل"]);
  }

  const lastRow  = sheet.getLastRow();
  const reportId = lastRow === 0 ? 1 : lastRow;
  const now      = new Date();
  const date     = Utilities.formatDate(now, "GMT+3", "yyyy-MM-dd");
  const time     = Utilities.formatDate(now, "GMT+3", "HH:mm:ss");

  const fileUrl       = `https://drive.google.com/file/d/${data.fileId}/view`;
  const videoHyperlink = `=HYPERLINK("${fileUrl}", "فيديو المراجعة")`;

  const contacts = getNotificationEmails();
  let emailStatus = "ناجح";
  try {
    console.log('إرسال إيميل إلى: ' + contacts.to + (contacts.cc ? ' | CC: ' + contacts.cc : ''));
    sendMvrReportEmail(data, date, time, fileUrl, reportId, contacts);
    console.log('تم إرسال الإيميل بنجاح');
  } catch (mailError) {
    emailStatus = "فشل: " + mailError.toString();
    console.error('فشل إرسال الإيميل: ' + mailError.toString());
  }

  sheet.appendRow([reportId, date, time, data.employeeName, data.branch, videoHyperlink, emailStatus]);
  return createJsonResponse({ result: "success", id: reportId });
}

function sendMvrReportEmail(data, date, time, fileUrl, reportId, contacts) {
  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 22px;">تقرير مراجعة الفروع الشهري</h2>
      <div style="margin: 2px 0 0; font-size: 14px; opacity: 0.9; text-transform: uppercase;">Monthly Video Review</div>
      <p style="margin: 10px 0 0; opacity: 0.8; font-size: 13px;">رقم التقرير: # ${reportId}</p>
    </div>
    <div style="padding: 30px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555; width: 40%;">الفرع:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.branch}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الموظف:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.employeeName}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">التاريخ والوقت:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${date} | ${time}</td></tr>
      </table>
      <div style="text-align: center; margin-top: 25px;">
        <a href="${fileUrl}" style="background-color: #c62828; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">مشاهدة فيديو المراجعة</a>
      </div>
    </div>
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB <br>
      إدارة العمليات - عصير تايم
    </div>
  </div>`;

  GmailApp.sendEmail(contacts.to, `${data.branch} - تقرير مراجعة الفرع الشهري - ${date}`, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    cc: contacts.cc
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ملاحظة: يجب تفعيل خدمة "Drive API" من قسم Services في محرر السكربت.
