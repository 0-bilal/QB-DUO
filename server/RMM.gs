// ═══════════════════════════════════════════════════════
//  RMM.gs — سجل التصنيع اليومي | Daily Manufacturing Log
//  QB-Sentinel | بلال الخواجة
// ═══════════════════════════════════════════════════════

// 1. إعدادات ثابتة
const EMAIL_SHEET_NAME = "Emails";

// ═══════════════════════════════════════════════════════
//  جلب الإيميلات (TO / CC) من ورقة Emails
// ═══════════════════════════════════════════════════════
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
      let type  = sheetValues[i][3] ? sheetValues[i][3].toString().trim() : "";
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

// ═══════════════════════════════════════════════════════
//  doPost — استقبال بيانات التصنيع
// ═══════════════════════════════════════════════════════
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

    // البيانات الواصلة من الفورم:
    // data.branch         → اسم الفرع بالعربي
    // data.employeeName   → اسم الموظف (مُحوّل من الرقم في جافا سكريبت)
    // data.dough          → كمية عجين الميني بان كيك (نص جاهز للعرض أو "")
    // data.doughIngredients → مكونات العجين (نص جاهز أو "")
    // data.berry          → كمية الفراولة المحوّلة (نص أو "")
    // data.red            → كمية التوت الأحمر المحوّل (نص أو "")
    // data.black          → كمية التوت الأسود المحوّل (نص أو "")

    const dough        = data.dough        || "—";
    const doughIngs    = data.doughIngredients || "—";
    const berry        = data.berry        || "—";
    const red          = data.red          || "—";
    const black        = data.black        || "—";

    // إرسال الإيميل
    let emailStatus = "ناجح";
    try {
      if (contacts.to) {
        sendManufacturingEmail(
          data, formattedDate, formattedTime, reportId,
          dough, doughIngs, berry, red, black, contacts
        );
      } else {
        emailStatus = "فشل: إيميل ناقص";
      }
    } catch (mailError) {
      emailStatus = "فشل: " + mailError.toString();
    }

    // التخزين في الشيت — سطر واحد لكل تقرير
    sheet.appendRow([
      reportId,        // 1. رقم التقرير
      formattedDate,   // 2. التاريخ
      formattedTime,   // 3. الوقت
      data.branch,     // 4. الفرع
      data.employeeName, // 5. اسم الموظف
      dough,           // 6. تصنيع ميني بان كيك
      doughIngs,       // 7. مكونات الميني بان كيك
      berry,           // 8. تحويل إلى فراولة مجمد
      red,             // 9. تحويل إلى توت أحمر مجمد
      black,           // 10. تحويل إلى توت أسود مجمد
      emailStatus      // 11. حالة الإيميل
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      "result": "success",
      "id": reportId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ═══════════════════════════════════════════════════════
//  إرسال إيميل التصنيع (نفس هوية FIL)
// ═══════════════════════════════════════════════════════
function sendManufacturingEmail(data, date, time, reportId, dough, doughIngs, berry, red, black, contacts) {

  // بناء صفوف العمليات — تظهر فقط العمليات المُدخلة
  let opsRows = "";

  if (dough !== "—") {
    opsRows += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #f57f17;">تصنيع ميني بان كيك:</td>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${dough}</td>
      </tr>`;

    if (doughIngs !== "—") {
      opsRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #e65100;">مكونات العجين:</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000; font-size: 13px;">${doughIngs}</td>
        </tr>`;
    }
  }

  if (berry !== "—") {
    opsRows += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #c62828;">تحويل فراولة → مجمد:</td>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${berry}</td>
      </tr>`;
  }

  if (red !== "—") {
    opsRows += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #9c2063;">تحويل توت أحمر → مجمد:</td>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${red}</td>
      </tr>`;
  }

  if (black !== "—") {
    opsRows += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #424242;">تحويل توت أسود → مجمد:</td>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${black}</td>
      </tr>`;
  }

  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 24px;">تقرير التصنيع اليومي</h2>
      <p style="margin: 5px 0 0; opacity: 0.8;">رقم التقرير: # ${reportId}</p>
    </div>
    <div style="padding: 30px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الفرع:</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.branch}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">المسؤول:</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.employeeName}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">التاريخ والوقت:</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${date} | ${time}</td>
        </tr>
        ${opsRows}
      </table>
    </div>
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB <br>
      إدارة العمليات - عصير تايم
    </div>
  </div>`;

  const subject = `${data.branch} - تقرير التصنيع اليومي - ${date}`;
  GmailApp.sendEmail(contacts.to, subject, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    cc: contacts.cc
  });
}

// ═══════════════════════════════════════════════════════
//  doGet — فحص حالة الـ API
// ═══════════════════════════════════════════════════════
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok', message: 'RMM API is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}