// ─── إعدادات ثابتة ────────────────────────────────────────────────────
const RSL_FOLDER_ID = '1JSVG42YG3LnFRKnwztw-kULvSmInflch'; // مجلد درايف لحفظ الصور (نفس مجلد النظام)
const RSL_DEFAULT_EMAIL = 'bilal15155@gmail.com';

const SH_RECORDS     = 'السجلات';
const SH_PRODUCTS    = 'المنتجات';
const SH_INGREDIENTS = 'المكونات';
const SH_SIZES       = 'الأحجام';
const SH_EMAILS      = 'Emails';

const RECORDS_HEADERS = [
  'رقم السجل', 'التاريخ', 'الوقت', 'الفرع', 'الموظف',
  'المنتج', 'الحجم', 'المكونات', 'الصورة', 'حالة الإيميل'
];
const PRODUCTS_HEADERS    = ['معرّف المنتج', 'المنتج (عربي)', 'المنتج (English)', 'الأحجام المتاحة', 'مفعّل'];
const INGREDIENTS_HEADERS = ['معرّف المنتج', 'المكوّن (عربي)', 'المكوّن (English)', 'الوحدة'];
const SIZES_HEADERS       = ['المفتاح', 'الحجم (عربي)', 'الحجم (English)'];

// قيم الأحجام الأساسية (تُكتب مرة واحدة عند إنشاء ورقة الأحجام)
const DEFAULT_SIZES = [
  ['كبيرة', 'كاسة كبيرة',   'Large Cup'],
  ['صغيرة', 'كاسة صغيرة',   'Small Cup'],
  ['جيك',   'جيك لتر ونصف', '1.5L Jug'],
  ['حلا',   'صندوق حلا',     'Dessert Box'],
  ['بوكس',  'بوكس',          'Box']
];

// ════════════════════════════════════════════════════════════════════
//  إنشاء الورقات والأعمدة تلقائياً
// ════════════════════════════════════════════════════════════════════

/**
 * يضمن وجود ورقة بالاسم المحدد مع صف رؤوس الأعمدة.
 * إن لم تكن موجودة يُنشئها ويضيف الرؤوس بتنسيق.
 */
function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (headers && headers.length) {
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmpty = firstRow.every(c => c === '' || c === null);
    if (isEmpty) {
      sheet.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground('#c62828')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * ينشئ جميع الورقات المطلوبة إن لم تكن موجودة + يعبّئ القيم الأساسية.
 * يمكن تشغيله يدوياً من محرر Apps Script لتهيئة الملف لأول مرة.
 */
function ensureSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, SH_RECORDS,     RECORDS_HEADERS);
  ensureSheet_(ss, SH_PRODUCTS,    PRODUCTS_HEADERS);
  ensureSheet_(ss, SH_INGREDIENTS, INGREDIENTS_HEADERS);
  const sizesSheet = ensureSheet_(ss, SH_SIZES, SIZES_HEADERS);
  ensureSheet_(ss, SH_EMAILS, ['الإيميل', 'الاسم', 'الفرع', 'النوع (to/cc)']);

  // تعبئة الأحجام الأساسية إذا كانت الورقة فارغة (لا صفوف بيانات)
  if (sizesSheet.getLastRow() < 2) {
    sizesSheet.getRange(2, 1, DEFAULT_SIZES.length, 3).setValues(DEFAULT_SIZES);
  }

  // مثال توضيحي للمدير إذا كانت ورقة المنتجات فارغة
  const prodSheet = ss.getSheetByName(SH_PRODUCTS);
  const ingSheet  = ss.getSheetByName(SH_INGREDIENTS);
  if (prodSheet.getLastRow() < 2 && ingSheet.getLastRow() < 2) {
    prodSheet.getRange(2, 1, 1, 5).setValues([
      ['P001', 'عصير مانجو', 'Mango Juice', 'كبيرة,صغيرة,جيك', 'نعم']
    ]);
    ingSheet.getRange(2, 1, 3, 4).setValues([
      ['P001', 'مانجو', 'Mango', 'جرام'],
      ['P001', 'حليب',  'Milk',  'مل'],
      ['P001', 'سكر',   'Sugar', 'جرام']
    ]);
  }

  return 'تم إنشاء/التحقق من جميع الورقات بنجاح ✅';
}

// ════════════════════════════════════════════════════════════════════
//  doGet — جلب المنتجات والمكونات والأحجام للتطبيق
// ════════════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    ensureSetup();
    const action = (e && e.parameter && e.parameter.action) || '';

    if (action === 'getProducts') {
      return jsonOut_({ result: 'success', products: getProductsData_() });
    }

    return jsonOut_({ result: 'ok', message: 'RSL API is running' });
  } catch (error) {
    return jsonOut_({ result: 'error', message: error.toString() });
  }
}

/**
 * يقرأ ورقات الإعداد ويبني مصفوفة المنتجات:
 * [{ id, ar, en, sizes:[{key,ar,en}], ingredients:[{ar,en,unit}] }, ...]
 */
function getProductsData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) الأحجام (map: key → {ar,en})
  const sizeSheet = ss.getSheetByName(SH_SIZES);
  const sizeMap = {};
  if (sizeSheet && sizeSheet.getLastRow() > 1) {
    sizeSheet.getRange(2, 1, sizeSheet.getLastRow() - 1, 3).getValues().forEach(r => {
      const key = (r[0] || '').toString().trim();
      if (key) sizeMap[key] = { key: key, ar: (r[1] || key).toString().trim(), en: (r[2] || '').toString().trim() };
    });
  }

  // 2) المكونات (مجمّعة حسب معرّف المنتج)
  const ingSheet = ss.getSheetByName(SH_INGREDIENTS);
  const ingByProduct = {};
  if (ingSheet && ingSheet.getLastRow() > 1) {
    ingSheet.getRange(2, 1, ingSheet.getLastRow() - 1, 4).getValues().forEach(r => {
      const pid = (r[0] || '').toString().trim();
      const ar  = (r[1] || '').toString().trim();
      if (!pid || !ar) return;
      const unit = (r[3] || 'جرام').toString().trim();
      if (!ingByProduct[pid]) ingByProduct[pid] = [];
      ingByProduct[pid].push({ ar: ar, en: (r[2] || '').toString().trim(), unit: unit });
    });
  }

  // 3) المنتجات المفعّلة
  const prodSheet = ss.getSheetByName(SH_PRODUCTS);
  const products = [];
  if (prodSheet && prodSheet.getLastRow() > 1) {
    prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, 5).getValues().forEach(r => {
      const id = (r[0] || '').toString().trim();
      const ar = (r[1] || '').toString().trim();
      if (!id || !ar) return;

      const active = (r[4] || '').toString().trim();
      if (active && ['لا', 'no', 'false', '0', 'معطل', 'معطّل'].indexOf(active.toLowerCase()) !== -1) return;

      const sizeKeys = (r[3] || '').toString().split(',').map(s => s.trim()).filter(Boolean);
      const sizes = sizeKeys.map(k => sizeMap[k] || { key: k, ar: k, en: '' });

      products.push({
        id: id,
        ar: ar,
        en: (r[2] || '').toString().trim(),
        sizes: sizes,
        ingredients: ingByProduct[id] || []
      });
    });
  }

  return products;
}

// ════════════════════════════════════════════════════════════════════
//  doPost — تسجيل سجل معايرة جديد
// ════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    ensureSetup();
    const data = JSON.parse(e.parameter.payload);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SH_RECORDS);
    const contacts = getRslEmails_();

    const lastRow  = sheet.getLastRow();
    const reportId = lastRow < 1 ? 1 : lastRow; // الصف 1 رؤوس → أول سجل = 1
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, 'GMT+3', 'yyyy-MM-dd');
    const formattedTime = Utilities.formatDate(now, 'GMT+3', 'HH:mm:ss');

    // المكونات: "حليب ( 10 مل ) - مانجو ( 200 جرام )"
    const ingredientsText = data.ingredientsText || '';

    // ── حفظ الصورة في درايف ──────────────────────────────────────────
    let fileUrl = 'لا توجد صورة';
    let fileBlob = null;
    let imageDisplay = 'لا توجد صورة';

    if (data.image && data.image.indexOf('base64,') !== -1) {
      const folder = DriveApp.getFolderById(RSL_FOLDER_ID);
      // اسم الصورة: رقم السجل - المنتج - الفرع - التاريخ
      const safeName = `${reportId} - ${data.product} - ${data.branch} - ${formattedDate}`
        .replace(/[\\\/:\*\?"<>\|]/g, '-');
      const mime = data.image.indexOf('image/png') !== -1 ? 'image/png' : 'image/jpeg';
      const ext  = mime === 'image/png' ? 'png' : 'jpg';
      const bytes = Utilities.base64Decode(data.image.split(',')[1]);
      fileBlob = Utilities.newBlob(bytes, mime, `${safeName}.${ext}`);
      const file = folder.createFile(fileBlob);
      fileUrl = file.getUrl();
      imageDisplay = `=HYPERLINK("${fileUrl}", "عرض الصورة")`;
    }

    // ── الإيميل ───────────────────────────────────────────────────────
    let emailStatus = 'ناجح';
    try {
      if (contacts.to) {
        sendRslEmail_(data, formattedDate, formattedTime, fileUrl, reportId, fileBlob, contacts, ingredientsText);
      } else {
        emailStatus = 'فشل: إيميل ناقص';
      }
    } catch (mailError) {
      emailStatus = 'فشل: ' + mailError.toString();
    }

    // ── كتابة السجل ───────────────────────────────────────────────────
    sheet.appendRow([
      reportId, formattedDate, formattedTime, data.branch, data.employeeName,
      data.product, data.size || '', ingredientsText, imageDisplay, emailStatus
    ]);

    return jsonOut_({ result: 'success', id: reportId });
  } catch (error) {
    return jsonOut_({ result: 'error', message: error.toString() });
  }
}

// ════════════════════════════════════════════════════════════════════
//  الإيميلات
// ════════════════════════════════════════════════════════════════════

function getRslEmails_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(SH_EMAILS);
    if (!emailSheet || emailSheet.getLastRow() < 2) return { to: RSL_DEFAULT_EMAIL, cc: '' };

    const values = emailSheet.getDataRange().getValues();
    let mainRecipient = '';
    const ccRecipients = [];
    for (let i = 1; i < values.length; i++) {
      const email = values[i][0] ? values[i][0].toString().trim() : '';
      const type  = values[i][3] ? values[i][3].toString().trim() : '';
      if (email !== '') {
        if (type.toLowerCase() === 'to') mainRecipient = email;
        else ccRecipients.push(email);
      }
    }
    return { to: mainRecipient || RSL_DEFAULT_EMAIL, cc: ccRecipients.join(',') };
  } catch (err) {
    return { to: RSL_DEFAULT_EMAIL, cc: '' };
  }
}

function sendRslEmail_(data, date, time, fileUrl, reportId, fileBlob, contacts, ingredientsText) {
  let inlineImages = {};
  let imageSection = '';

  if (fileBlob) {
    inlineImages['rslImage'] = fileBlob.copyBlob().setName('recipe.png');
    imageSection = `
      <div style="text-align: center; margin-top: 20px;">
        <p style="font-weight: bold; color: #555;">صورة التحضير:</p>
        <img src="cid:rslImage" style="width: 300px; border-radius: 10px; border: 2px solid #ddd;" />
        <div style="margin-top: 15px;">
          <a href="${fileUrl}" style="background-color: #c62828; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">فتح الصورة</a>
        </div>
      </div>`;
  }

  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 24px;">سجل معايرة المكونات</h2>
      <p style="margin: 5px 0 0; opacity: 0.8;">رقم السجل: # ${reportId}</p>
    </div>
    <div style="padding: 30px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الفرع:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.branch}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">الموظف:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.employeeName}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555;">التاريخ والوقت:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${date} | ${time}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #c62828;">المنتج:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${data.product}${data.size ? ' — ' + data.size : ''}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #555; vertical-align: top;">المكونات:</td><td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #000;">${ingredientsText.replace(/ - /g, '<br>')}</td></tr>
      </table>
      ${imageSection}
    </div>
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB <br>
      إدارة العمليات - عصير تايم
    </div>
  </div>`;

  const subject = `${data.branch} - سجل معايرة (${data.product}) - ${date}`;
  GmailApp.sendEmail(contacts.to, subject, '', {
    htmlBody: htmlBody,
    name: 'نظام QB-Sentinel',
    inlineImages: inlineImages,
    cc: contacts.cc
  });
}

// ─── مساعد: إخراج JSON ────────────────────────────────────────────────
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
