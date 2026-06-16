// ══════════════════════════════════════════════════════════════════════════
//  PCR.gs - طلب عهدة (Petty Cash Request)
//  QB-Sentinel | برمجيات QB
// ══════════════════════════════════════════════════════════════════════════

const PCR_SHEET_NAME  = "PCR";
const PCR_EMAIL_SHEET = "Emails";

// ⚠️ ضع رابط موقعك هنا (بدون / في النهاية)
const PCR_SITE_URL = "https://0-bilal.github.io/QB-Sentinel/";

// ════════════════════════════════════════════════════════════════
//  أدوات الترميز
// ════════════════════════════════════════════════════════════════

/**
 * يُرمِّز كائن JSON إلى base64 URL-safe
 * يتعامل مع النصوص العربية بشكل صحيح
 */
function pcr_encode(obj) {
  const json  = JSON.stringify(obj);
  const bytes = Utilities.newBlob(json).getBytes();
  const b64   = Utilities.base64Encode(bytes);
  // تحويل إلى URL-safe base64
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ════════════════════════════════════════════════════════════════
//  جلب المستلمين من ورقة الإيميلات
// ════════════════════════════════════════════════════════════════

/**
 * يُرجع قائمة المستلمين من ورقة Emails
 * كل مستلم: { email, name, type }
 * الأنواع: To | CC | Tocoo
 */
function pcr_getRecipients() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PCR_EMAIL_SHEET);
    if (!sheet) return [{ email: "bilal15155@gmail.com", name: "Admin", type: "To" }];

    const data       = sheet.getDataRange().getValues();
    const recipients = [];

    for (let i = 1; i < data.length; i++) {
      const email = data[i][0] ? data[i][0].toString().trim() : "";
      const name  = data[i][1] ? data[i][1].toString().trim() : "";
      const type  = data[i][3] ? data[i][3].toString().trim() : "";
      if (email) recipients.push({ email, name, type });
    }
    return recipients;
  } catch (err) {
    return [{ email: "bilal15155@gmail.com", name: "Admin", type: "To" }];
  }
}

// ════════════════════════════════════════════════════════════════
//  نقاط الاستقبال
// ════════════════════════════════════════════════════════════════

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: "ok", service: "PCR" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.parameter.payload);

    if (data.type === 'PCR_APPROVE' || data.type === 'PCR_REJECT') {
      return pcr_handleApproval(data);
    }

    return pcr_handleSubmission(data);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ════════════════════════════════════════════════════════════════
//  معالجة إرسال الطلب الجديد
// ════════════════════════════════════════════════════════════════

function pcr_handleSubmission(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(PCR_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(PCR_SHEET_NAME);
    sheet.appendRow([
      "رقم التتبع", "التاريخ", "الوقت", "اسم الفرع", "اسم الموظف",
      "مبلغ العهدة الحالي (ر.س)", "المبلغ المطلوب (ر.س)",
      "حالة الإيميل", "حالة الاعتماد", "اسم المعتمد"
    ]);
    const hr = sheet.getRange(1, 1, 1, 10);
    hr.setBackground("#c62828").setFontColor("#ffffff")
      .setFontWeight("bold").setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(9, 120);
    sheet.setColumnWidth(10, 130);
  } else {
    pcr_ensureApprovalColumns(sheet);
  }

  // ── رقم التتبع التسلسلي ──────────────────────────────────────
  const totalRows = sheet.getLastRow();
  const dataCount = Math.max(0, totalRows - 1);
  const seqNumber = dataCount + 1;
  const trackId   = "PCR-" + (100 + seqNumber);

  // ── التاريخ والوقت ───────────────────────────────────────────
  const now        = new Date();
  const dateString = Utilities.formatDate(now, "GMT+3", "yyyy-MM-dd");
  const timeString = Utilities.formatDate(now, "GMT+3", "HH:mm:ss");

  // ── إرسال إيميلات الطلب مع زر الاعتماد ──────────────────────
  let emailStatus = "ناجح";
  try {
    pcr_sendRequestEmails(data, dateString, timeString, trackId);
  } catch (mailErr) {
    emailStatus = "فشل: " + mailErr.toString();
  }

  // ── تسجيل البيانات ───────────────────────────────────────────
  sheet.appendRow([
    trackId, dateString, timeString,
    data.branch, data.employeeName,
    Number(data.currentAmount), Number(data.requestedAmount),
    emailStatus, "قيد الانتظار", ""
  ]);

  const newRow = sheet.getLastRow();
  sheet.getRange(newRow, 1).setHorizontalAlignment("center");
  sheet.getRange(newRow, 2, 1, 3).setHorizontalAlignment("center");
  sheet.getRange(newRow, 6, 1, 2).setNumberFormat("#,##0.00");
  sheet.getRange(newRow, 9).setFontColor("#e65100").setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange(newRow, 10).setHorizontalAlignment("center");

  return ContentService
    .createTextOutput(JSON.stringify({ result: "success", id: trackId }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── التأكد من وجود أعمدة الاعتماد في الشيت ──────────────────────────────
function pcr_ensureApprovalColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.includes("حالة الاعتماد")) {
    const nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue("حالة الاعتماد");
    sheet.getRange(1, nextCol + 1).setValue("اسم المعتمد");
    const hr = sheet.getRange(1, nextCol, 1, 2);
    hr.setBackground("#c62828").setFontColor("#ffffff")
      .setFontWeight("bold").setHorizontalAlignment("center");
  }
}

// ════════════════════════════════════════════════════════════════
//  معالجة الاعتماد أو الرفض
// ════════════════════════════════════════════════════════════════

function pcr_handleApproval(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PCR_SHEET_NAME);

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: "ورقة البيانات غير موجودة" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // البحث عن الصف بواسطة رقم التتبع
  const allData  = sheet.getDataRange().getValues();
  let targetRow  = -1;

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(data.trackId)) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: "رقم التتبع غير موجود في النظام" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // التحقق من عدم المعالجة المسبقة
  const colCount     = sheet.getLastColumn();
  const approvalCol  = colCount >= 9 ? 9 : colCount;
  const currentStatus = colCount >= 9 ? allData[targetRow - 1][8] : "";

  if (currentStatus && currentStatus !== "قيد الانتظار") {
    return ContentService
      .createTextOutput(JSON.stringify({
        result: "already",
        message: "تمت معالجة هذا الطلب مسبقاً",
        status: currentStatus
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // تحديد الحالة والألوان
  const isApprove = data.type === 'PCR_APPROVE';
  const status    = isApprove ? "معتمد" : "مرفوض";
  const bgColor   = isApprove ? "#e8f5e9" : "#ffebee";
  const txtColor  = isApprove ? "#2e7d32" : "#c62828";

  // تحديث الشيت
  const statusCell   = sheet.getRange(targetRow, 9);
  const approverCell = sheet.getRange(targetRow, 10);

  statusCell.setValue(status)
    .setBackground(bgColor).setFontColor(txtColor)
    .setFontWeight("bold").setHorizontalAlignment("center");

  approverCell.setValue(data.approverName)
    .setHorizontalAlignment("center");

  // إرسال إيميل التأكيد عند الاعتماد
  if (isApprove) {
    try {
      pcr_sendApprovalConfirmationEmail(data);
    } catch (mailErr) {
      console.error("Approval email error:", mailErr);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: "success", status: status, approved: isApprove }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════
//  إرسال إيميل الطلب مع زر الاعتماد (إيميل شخصي لكل مستلم)
// ════════════════════════════════════════════════════════════════

function pcr_sendRequestEmails(data, date, time, trackId) {
  const recipients = pcr_getRecipients();
  const toCC = recipients.filter(r =>
    r.type.toLowerCase() === 'to' || r.type.toLowerCase() === 'cc'
  );

  if (toCC.length === 0) throw new Error("لم يتم تحديد مستلمين");

  // بيانات الطلب المرمَّزة (مشتركة لجميع الروابط)
  const requestInfo = {
    trackId, branch: data.branch,
    employeeName: data.employeeName,
    currentAmount: data.currentAmount,
    requestedAmount: data.requestedAmount,
    date, time
  };
  const encodedData = pcr_encode(requestInfo);

  // إرسال إيميل شخصي لكل مستلم مع اسمه في الرابط
  toCC.forEach(recipient => {
    const encodedApprover = pcr_encode({ name: recipient.name });
    const approvalUrl = PCR_SITE_URL
      + "/pages/PCR-approval.html"
      + "?d=" + encodedData
      + "&a=" + encodedApprover;

    const htmlBody = pcr_buildRequestEmailBody(data, date, time, trackId, approvalUrl, recipient.name);
    const subject  = data.branch + " - طلب عهدة " + trackId + " - " + date;

    GmailApp.sendEmail(recipient.email, subject, "", {
      htmlBody: htmlBody,
      name: "نظام QB-Sentinel"
    });
  });
}

// ════════════════════════════════════════════════════════════════
//  إرسال إيميل تأكيد الاعتماد (إلى Tocoo + To)
// ════════════════════════════════════════════════════════════════

function pcr_sendApprovalConfirmationEmail(data) {
  const recipients = pcr_getRecipients();

  const toRecipient = recipients.find(r => r.type.toLowerCase() === 'to');
  const ccEmails    = recipients
    .filter(r => r.type.toLowerCase() === 'tocoo')
    .map(r => r.email)
    .join(",");

  if (!toRecipient) return;

  const now        = new Date();
  const dateString = Utilities.formatDate(now, "GMT+3", "yyyy-MM-dd");
  const timeString = Utilities.formatDate(now, "GMT+3", "hh:mm:ss a");

  const htmlBody = pcr_buildConfirmationEmailBody(data, dateString, timeString);
  const subject  = "تم اعتماد طلب العهدة " + data.trackId + " - " + dateString;

  GmailApp.sendEmail(toRecipient.email, subject, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    cc: ccEmails
  });
}

// ════════════════════════════════════════════════════════════════
//  قوالب الإيميلات
// ════════════════════════════════════════════════════════════════

function pcr_buildRequestEmailBody(data, date, time, trackId, approvalUrl, recipientName) {
  return '\
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">\
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">\
      <h2 style="margin: 0; font-size: 22px;">طلب عهدة جديد</h2>\
      <p style="margin: 6px 0 0; opacity: 0.85; font-size: 13px;">PETTY CASH REQUEST</p>\
      <div style="margin-top: 12px; background: rgba(255,255,255,0.15); display: inline-block; padding: 5px 18px; border-radius: 20px; font-size: 13px;">\
        رقم التتبع: <strong>' + trackId + '</strong>\
      </div>\
    </div>\
    <div style="padding: 30px; background-color: #ffffff;">\
      <p style="color:#555; font-size:14px; margin-bottom:20px;">مرحباً <strong>' + recipientName + '</strong>، يوجد طلب عهدة جديد يحتاج مراجعتك واعتمادك:</p>\
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">\
        <tr style="background:#f9fafb;"><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;width:40%;">الفرع</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + data.branch + '</td></tr>\
        <tr><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">الموظف</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + data.employeeName + '</td></tr>\
        <tr style="background:#f9fafb;"><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">التاريخ</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + date + '</td></tr>\
        <tr><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">الوقت</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + time + '</td></tr>\
        <tr style="background:#f9fafb;"><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">مبلغ العهدة الحالي</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;font-weight:bold;">' + Number(data.currentAmount).toLocaleString('en-US') + ' ر.س</td></tr>\
        <tr><td style="padding:12px 15px;font-weight:bold;color:#555;">المبلغ المطلوب</td><td style="padding:12px 15px;"><span style="background:#c62828;color:white;padding:5px 14px;border-radius:20px;font-weight:bold;font-size:15px;">' + Number(data.requestedAmount).toLocaleString('en-US') + ' ر.س</span></td></tr>\
      </table>\
      <div style="text-align:center;margin-top:10px;">\
        <a href="' + approvalUrl + '" style="display:inline-block;background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);color:white;padding:16px 45px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px;box-shadow:0 4px 12px rgba(198,40,40,0.3);">مراجعة الطلب واعتماده</a>\
        <p style="margin-top:10px;font-size:12px;color:#999;">REVIEW &amp; APPROVE REQUEST</p>\
      </div>\
    </div>\
    <div style="background-color:#f8f9fa;padding:15px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">\
      نظام QB-Sentinel التابع لبرمجيات QB<br>إدارة العمليات - عصير تايم\
    </div>\
  </div>';
}

function pcr_buildConfirmationEmailBody(data, date, time) {
  const statusColor = '#2e7d32';
  const statusBg    = '#e8f5e9';

  return '\
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">\
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">\
      <h2 style="margin: 0; font-size: 22px;">تم اعتماد طلب العهدة</h2>\
      <p style="margin: 6px 0 0; opacity: 0.85; font-size: 13px;">REQUEST APPROVED</p>\
      <div style="margin-top: 12px; background: rgba(255,255,255,0.15); display: inline-block; padding: 5px 18px; border-radius: 20px; font-size: 13px;">\
        رقم التتبع: <strong>' + data.trackId + '</strong>\
      </div>\
    </div>\
    <div style="padding: 30px; background-color: #ffffff;">\
      <div style="background:' + statusBg + ';border-right:4px solid ' + statusColor + ';padding:15px 20px;border-radius:8px;margin-bottom:25px;text-align:center;">\
        <span style="color:' + statusColor + ';font-weight:bold;font-size:18px;">معتمد</span><br>\
        <span style="color:#555;font-size:13px;margin-top:4px;display:block;">بواسطة: <strong>' + data.approverName + '</strong></span>\
        <span style="color:#888;font-size:12px;">' + date + ' - ' + time + '</span>\
      </div>\
      <table style="width:100%;border-collapse:collapse;">\
        <tr style="background:#f9fafb;"><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;width:40%;">الفرع</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + data.branch + '</td></tr>\
        <tr><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">الموظف</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + data.employeeName + '</td></tr>\
        <tr style="background:#f9fafb;"><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">مبلغ العهدة الحالي</td><td style="padding:12px 15px;border-bottom:1px solid #f0f0f0;color:#000;">' + Number(data.currentAmount).toLocaleString('en-US') + ' ر.س</td></tr>\
        <tr><td style="padding:12px 15px;font-weight:bold;color:#555;">المبلغ المعتمد</td><td style="padding:12px 15px;"><span style="background:' + statusColor + ';color:white;padding:5px 14px;border-radius:20px;font-weight:bold;">' + Number(data.requestedAmount).toLocaleString('en-US') + ' ر.س</span></td></tr>\
      </table>\
    </div>\
    <div style="background-color:#f8f9fa;padding:15px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">\
      نظام QB-Sentinel التابع لبرمجيات QB<br>إدارة العمليات - عصير تايم\
    </div>\
  </div>';
}
