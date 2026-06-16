// 1. إعدادات ثابتة
const FOLDER_ID = '1iBvNClyH55BUw2NK8dagYS4r0ojPL-yB';
const EMAIL_SHEET_NAME = "Emails"; 

function getNotificationEmails() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(EMAIL_SHEET_NAME);
    
    if (!emailSheet) {
      console.error("ورقة الإيميلات غير موجودة!");
      return { to: "bilal15155@gmail.com", cc: "" }; // إيميل احتياطي في حال الخطأ
    }

    const data = emailSheet.getDataRange().getValues();
    let mainRecipient = "";
    let ccRecipients = [];

    // نبدأ من الصف الثاني لتخطي العناوين
    for (let i = 1; i < data.length; i++) {
      let email = data[i][0] ? data[i][0].toString().trim() : ""; 
      let type = data[i][3] ? data[i][3].toString().trim() : ""; 
      
      if (email !== "") {
        if (type.toLowerCase() === "to") {
          mainRecipient = email;
        } else {
          ccRecipients.push(email);
        }
      }
    }
    return { 
      to: mainRecipient, 
      cc: ccRecipients.join(",") 
    };
  } catch (e) {
    console.error("خطأ في جلب الإيميلات: " + e.toString());
    return { to: "bilal15155@gmail.com", cc: "" };
  }
}

// 1. تصحيح دالة doPost لاستقبال payload والرد بـ JSON
function doPost(e) {
  try {
    // قراءة البيانات المرسلة كـ payload
    const data = JSON.parse(e.parameter.payload); 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; 

    const contacts = getNotificationEmails();
    const lastRow = sheet.getLastRow();
    const reportId = lastRow === 0 ? 1 : lastRow;
    const timestamp = new Date();
    
    const dateString = Utilities.formatDate(timestamp, "GMT+3", "yyyy-MM-dd");
    const timeString = Utilities.formatDate(timestamp, "GMT+3", "HH:mm:ss");

    let fileUrl = "لا توجد صورة";
    let fileBlob = null;
    const fileName = `${reportId} - ${data.branch} - ${data.equipmentAr} - ${dateString}.jpg`;

    if (data.image && data.image.includes(',')) { 
      try {
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const parts = data.image.split(','); 
        const contentType = parts[0].split(':')[1].split(';')[0];
        const bytes = Utilities.base64Decode(parts[1]);
        fileBlob = Utilities.newBlob(bytes, contentType, fileName);
        const file = folder.createFile(fileBlob);
        fileUrl = file.getUrl();
      } catch (imgError) {
        console.error("خطأ في حفظ الصورة: " + imgError.toString());
      }
    }

    const linkText = `${reportId} - ${data.branch} - ${data.equipmentAr} - ${dateString}`;
    const imageHyperlink = (fileUrl !== "لا توجد صورة") ? `=HYPERLINK("${fileUrl}", "${linkText}")` : "لا توجد صورة";

    let emailStatus = "ناجح";
    try {
      if (contacts.to) {
        sendHtmlEmail(data, dateString, timeString, fileUrl, reportId, fileBlob, contacts);
      } else {
        emailStatus = "فشل: لم يتم العثور على مستلم (To)";
      }
    } catch (mailError) {
      emailStatus = "فشل: " + mailError.toString();
    }

    sheet.appendRow([
      reportId, dateString, timeString, data.branch, data.senderName || "غير محدد",
      data.cleanerName, data.equipmentAr, data.equipmentEn, data.equipmentId,
      imageHyperlink, emailStatus
    ]);

    // ✅ الرد بصيغة JSON لضمان قراءته في المتصفح
    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": reportId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendHtmlEmail(data, date, time, fileUrl, reportId, fileBlob, contacts) {
  let inlineImages = {};
  let imageTag = `<p style="color: #999;">لا توجد صورة مرفقة</p>`;

  if (fileBlob) {
    inlineImages['reportImage'] = fileBlob.copyBlob().setName("image.jpg");
    imageTag = `<img src="cid:reportImage" style="width: 300px; border-radius: 10px; border: 2px solid #ddd;" />`;
  }

  const imageButton = fileUrl !== "لا توجد صورة" ?
    `<div style="margin-top: 15px;">
      <a href="${fileUrl}" style="background-color: #c62828; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">فتح الصورة </a>
    </div>` : "";

  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 24px;">تقرير تنظيف المعدات</h2>
      <p style="margin: 5px 0 0; opacity: 0.8;">رقم التقرير: # ${reportId}</p> 
    </div>
    
    <div style="padding: 30px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555; width: 40%;">الفرع:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.branch}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">مرسل التقرير:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.senderName || "غير محدد"}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الموظف القائم بالتنظيف:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.cleanerName}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">المعدة:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.equipmentAr}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">التاريخ والوقت:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${date} | ${time}</td></tr>
      </table>

      <div style="text-align: center; margin-top: 20px;">
        <p style="font-weight: bold; color: #555;">صورة المعدة:</p>
        ${imageTag}
        ${imageButton}
      </div>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
    نظام QB-Sentinel التابع لبرمجيات QB <br>
    إدارة العمليات - عصير تايم 
    </div>
  </div>
  `;

  const subject = `${data.branch} - تقرير تنظيف المعدات - ${date}`;

  // الإرسال الفعلي باستخدام الإيميلات المجلوبة من الشيت
  GmailApp.sendEmail(contacts.to, subject, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    inlineImages: inlineImages,
    cc: contacts.cc
  });
}