// الإعدادات الثابتة لجلب الإيميلات
const EMAIL_SHEET_NAME = "Emails";

function getNotificationEmails(e) { // أضف e هنا إذا كنت تمررها
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(EMAIL_SHEET_NAME);
    
    if (!emailSheet) {
      console.error("ورقة الإيميلات غير موجودة!");
      return { to: "bilal15155@gmail.com", cc: "" }; 
    }

    // هنا كان الخطأ: تم تغيير اسم المتغير من data إلى sheetData
    const sheetData = emailSheet.getDataRange().getValues();
    let mainRecipient = "";
    let ccRecipients = [];

    for (let i = 1; i < sheetData.length; i++) {
      let email = sheetData[i][0] ? sheetData[i][0].toString().trim() : ""; 
      let type = sheetData[i][3] ? sheetData[i][3].toString().trim() : "";
      if (email !== "") {
        if (type.toLowerCase() === "to") {
          mainRecipient = email;
        } else {
          ccRecipients.push(email);
        }
      }
    }
    return { to: mainRecipient, cc: ccRecipients.join(",") };
  } catch (e) {
    return { to: "bilal15155@gmail.com", cc: "" };
  }
}

function doPost(e) {
  try {
    // 1. استقبال البيانات القادمة من المتصفح عبر payload
    const data = JSON.parse(e.parameter.payload); 
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("PV") || ss.getSheets()[0]; 
    
    const lastRow = sheet.getLastRow();
    const reportId = lastRow === 0 ? 1 : lastRow; 
    
    const timestamp = new Date(); 
    const dateString = Utilities.formatDate(timestamp, "GMT+3", "yyyy-MM-dd"); 
    const timeString = Utilities.formatDate(timestamp, "GMT+3", "HH:mm:ss"); 
    
    // 2. جلب الإيميلات من الشيت
    const contacts = getNotificationEmails(); 
    
    // 3. إرسال الإيميل (استخدام الاسم الصحيح للدالة الموجودة بملفك)
    let emailStatus = "ناجح"; 
    try {
      if (contacts.to) {
        // تأكد من أن هذا الاسم يطابق الدالة المعرفة في السطر 60 بملفك
        sendCashVoucherEmail(data, dateString, timeString, reportId, contacts); 
      } else {
        emailStatus = "فشل: لم يتم تحديد إيميل To";
      }
    } catch (mailError) {
      emailStatus = "فشل: " + mailError.toString(); 
    }

    // 4. تسجيل البيانات في الشيت مع حالة الإيميل
    sheet.appendRow([
      reportId,
      dateString,
      timeString,
      data.branch,
      data.employeeName,
      data.reason,
      data.amount,
      data.beneficiary,
      emailStatus
    ]); 

    // 5. إرسال رد النجاح للمتصفح (JSON) ليتوقف وضع "النجاح الوهمي"
    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": reportId }))
      .setMimeType(ContentService.MimeType.JSON); 

  } catch (error) {
    // في حال حدوث أي خطأ برمجي يظهر للمستخدم في المتصفح
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendCashVoucherEmail(data, date, time, reportId, contacts) {
  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 24px;">سند صرف نقدية جديد</h2>
      <p style="margin: 5px 0 0; opacity: 0.8;">رقم السند: # ${reportId}</p> 
    </div>
    
    <div style="padding: 30px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الفرع:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.branch}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">المسؤول:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.employeeName}</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">التاريخ والوقت:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${date} | ${time}</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #1565c0;">المبلغ:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #000;">${data.amount} SAR</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">سبب الصرف:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.reason}</td></tr> 
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">هاتف المستفيد:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.beneficiary}</td></tr> 
      </table>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
    نظام QB-Sentinel التابع لبرمجيات QB <br>
    إدارة العمليات - عصير تايم 
    </div>
  </div>
  `; 

  const subject = `${data.branch} - سند صرف نقدية - ${date}`;

  GmailApp.sendEmail(contacts.to, subject, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    cc: contacts.cc 
  });
}