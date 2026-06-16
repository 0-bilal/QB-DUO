// 1. إعدادات ثابتة
const FOLDER_ID = '1hFR0_x_tBKo7vVuguNC0SYk1qini681c'; 
const EMAIL_SHEET_NAME = "Emails";

function getNotificationEmails() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(EMAIL_SHEET_NAME);
    if (!emailSheet) return { to: "bilal15155@gmail.com", cc: "" };

    const sheetValues = emailSheet.getDataRange().getValues();
    let mainRecipient = "";
    let ccRecipients = [];

    for (let i = 1; i < sheetValues.length; i++) {
      let email = sheetValues[i][0] ? sheetValues[i][0].toString().trim() : ""; 
      let type = sheetValues[i][3] ? sheetValues[i][3].toString().trim() : "";
      if (email !== "") {
        if (type.toLowerCase() === "to") { mainRecipient = email; } 
        else { ccRecipients.push(email); }
      }
    }
    return { to: mainRecipient, cc: ccRecipients.join(",") };
  } catch (e) {
    return { to: "bilal15155@gmail.com", cc: "" };
  }
} 

function doPost(e) {
  try {
    const data = JSON.parse(e.parameter.payload); 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; 
    const contacts = getNotificationEmails();
    
    const lastRow = sheet.getLastRow();
    const reportId = lastRow === 0 ? 1 : lastRow; 
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, "GMT+3", "yyyy-MM-dd"); 
    const formattedTime = Utilities.formatDate(now, "GMT+3", "HH:mm:ss");

    let fileUrl = "لا توجد صورة";
    let fileBlob = null;
    let imageDisplay = "لا توجد صورة";

    if (data.image && data.image.includes("base64,")) { 
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const fileName = `${reportId} - ${data.branch} - ${data.reportType} - ${formattedDate}.png`;
      const bytes = Utilities.base64Decode(data.image.split(',')[1]); 
      fileBlob = Utilities.newBlob(bytes, "image/png", fileName); 
      const file = folder.createFile(fileBlob); 
      fileUrl = file.getUrl();
      imageDisplay = `=HYPERLINK("${fileUrl}", "عرض الصورة")`; 
    }

    let emailStatus = "ناجح";
    try {
      if (contacts.to) {
        sendFruitReportEmail(data, formattedDate, formattedTime, fileUrl, reportId, fileBlob, contacts);
      } else { emailStatus = "فشل: إيميل ناقص"; }
    } catch (mailError) { emailStatus = "فشل: " + mailError.toString(); }

    sheet.appendRow([
      reportId, formattedDate, formattedTime, data.reportType, data.branch,
      data.employeeName, data.inspectedList, data.naList, data.damagedList, imageDisplay, emailStatus
    ]);

    return ContentService.createTextOutput(JSON.stringify({"result":"success", "id": reportId}))
          .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "message": error.toString()}))
          .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendFruitReportEmail(data, date, time, fileUrl, reportId, fileBlob, contacts) {
  let inlineImages = {};
  let imageSection = ""; 

  if (fileBlob) {
    inlineImages['fruitImage'] = fileBlob.copyBlob().setName("inspection.png"); 
    imageSection = `
      <div style="text-align: center; margin-top: 20px;">
        <p style="font-weight: bold; color: #555;">صورة تالفة:</p>
        <img src="cid:fruitImage" style="width: 300px; border-radius: 10px; border: 2px solid #ddd;" /> 
        <div style="margin-top: 15px;">
          <a href="${fileUrl}" style="background-color: #c62828; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">فتح الصورة </a>
        </div>
      </div>`; 
  }

  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 24px;">تقرير فحص الفواكه</h2>
      <p style="margin: 5px 0 0; opacity: 0.8;">رقم التقرير: # ${reportId}</p> 
    </div>
    <div style="padding: 30px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الفرع:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.branch}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">المسؤول:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.employeeName}</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">التاريخ والوقت:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${date} | ${time}</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #2e7d32;">الفواكه السليمة:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.inspectedList} فواكه</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #f57c00;">غير متوفرة:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.naList || "لا يوجد"}</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #d32f2f;">التالف والكميات:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.damagedList || "لا يوجد"}</td></tr> 
      </table>
      ${imageSection}
    </div>
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
    نظام QB-Sentinel التابع لبرمجيات QB <br>
    إدارة العمليات - عصير تايم 
    </div>
  </div>`; 

  const subject = `${data.branch} - تقرير فحص فواكه - ${date}`;
  GmailApp.sendEmail(contacts.to, subject, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    inlineImages: inlineImages,
    cc: contacts.cc 
  });
}

// ═══════════════════════════════════════════════════════
//  doGet — الإشعارات
// ═══════════════════════════════════════════════════════

function doGet(e) {
  try {
    const action = e.parameter.action || '';
    if (action === 'getSchedule') return getInspectionSchedule();

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok', message: 'FIL API is running' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


function getInspectionSchedule() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FIA');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'error', message: 'ورقة FIA غير موجودة' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'success', schedule: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // نستخدم getDisplayValues() لجلب الوقت والتاريخ كمظهر نصي نقي تماماً كما في الشيت
    const range        = sheet.getRange(2, 1, lastRow - 1, 4);
    const displayValues = range.getDisplayValues();

    // ترشيح الصفوف التي تحتوي على اسم الفرع
    const schedule = displayValues.filter(row => row[0] && row[0].toString().trim() !== '');

    const cleaned = schedule.map(row => {
      const branch   = row[0].toString().trim();
      const lastDate = row[1] ? row[1].toString().trim() : '—';
      const lastTime = row[2] ? row[2].toString().trim() : '—';
      const nextTime = row[3] ? row[3].toString().trim() : '—';

      return [branch, lastDate, lastTime, nextTime];
    });

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', schedule: cleaned }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}