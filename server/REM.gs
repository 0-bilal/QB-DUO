/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   QB-Sentinel — REM Google Sheets Backend                   ║
 * ║   نظام تذكير تجديد الإقامات والعقود                         ║
 * ║   كود Google Apps Script                                    ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  طريقة الاستخدام:                                           ║
 * ║  1. افتح Google Sheets وأنشئ ورقتين:                       ║
 * ║     - "التذكيرات"  (للتذكيرات النشطة)                      ║
 * ║     - "الأرشيف"   (للمحذوف والمتمَّم)                      ║
 * ║  2. Extensions > Apps Script > الصق هذا الكود              ║
 * ║  3. Deploy > New Deployment > Web App                       ║
 * ║     - Execute as: Me                                        ║
 * ║     - Who has access: Anyone                                ║
 * ║  4. انسخ رابط الـ Web App وضعه في SHEET_WEBAPP_URL         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ──────────────────────────────────────────────────
//  ⚙️  إعدادات — أسماء الأوراق
// ──────────────────────────────────────────────────
const SHEET_REMINDERS = 'التذكيرات';
const SHEET_ARCHIVE   = 'الأرشيف';

// ترويسات أعمدة ورقة التذكيرات
// ⚠️ تم فصل "تاريخ الإضافة" إلى عمودين: التاريخ + الوقت
const HEADERS_REMINDERS = [
  'المعرف', 'اسم تذكير', 'نوع التذكير', 'تاريخ الانتهاء',
  'الفرع', 'ملاحظات', 'تاريخ الإضافة', 'وقت الإضافة'
];

// ترويسات أعمدة ورقة الأرشيف
const HEADERS_ARCHIVE = [
  'المعرف', 'اسم تذكير', 'نوع التذكير', 'تاريخ الانتهاء',
  'الفرع', 'ملاحظات', 'تاريخ الإضافة', 'وقت الإضافة',
  'الإجراء', 'تاريخ الإجراء', 'وقت الإجراء'
];

// ──────────────────────────────────────────────────
//  🔤  ترجمة القيم إلى العربية
// ──────────────────────────────────────────────────

/** ترجمة نوع التذكير من الكود الإنجليزي إلى العربي */
function translateType(type) {
  const types = {
    'iqama':    'تجديد إقامة',
    'contract': 'تجديد عقد',
    'health':   'شهادة صحية',
    'passport': 'تجديد جواز',
    'other':    'أخرى'
  };
  return types[type] || type;
}

/** ترجمة اسم الفرع إلى العربي */
function translateBranch(branch) {
  const branches = {
    'Dawadimi':   'الدوادمي',
    'Muzahmiyah': 'المزاحمية'
  };
  return branches[branch] || branch;
}

// ──────────────────────────────────────────────────
//  🕐  مساعدات التاريخ والوقت (أرقام إنجليزية)
// ──────────────────────────────────────────────────

/**
 * يعيد كائناً يحتوي على التاريخ والوقت منفصلَين
 * بالأرقام الإنجليزية، بتوقيت الرياض.
 * مثال: { date: "13/05/2025", time: "10:45:30 ص" }
 */
function getSplitTimestamp() {
  const now = new Date();

  // نستخدم 'en-SA' للحصول على أرقام إنجليزية مع تنسيق عربي
  const dateStr = now.toLocaleDateString('en-SA', {
    timeZone: 'Asia/Riyadh',
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric'
  });

  const timeStr = now.toLocaleTimeString('en-SA', {
    timeZone: 'Asia/Riyadh',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return { date: dateStr, time: timeStr };
}

/**
 * تنسيق تاريخ الانتهاء القادم من الواجهة (YYYY-MM-DD)
 * إلى صيغة DD/MM/YYYY بأرقام إنجليزية
 */
function formatExpiryDate(dateStr) {
  if (!dateStr) return '';
  // dateStr مثل: "2025-08-15"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ──────────────────────────────────────────────────
//  🔧  مساعدات الأوراق
// ──────────────────────────────────────────────────

/** احصل على الورقة — أنشئها تلقائياً إذا لم تكن موجودة */
function getSheet(name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = (name === SHEET_ARCHIVE) ? HEADERS_ARCHIVE : HEADERS_REMINDERS;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeaderRow(sheet, headers.length);
  }
  return sheet;
}

/** تنسيق صف الترويسات */
function formatHeaderRow(sheet, colCount) {
  const range = sheet.getRange(1, 1, 1, colCount);
  range.setBackground('#c62828')
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/** حوّل صف بيانات إلى كائن تذكير */
function rowToReminder(row) {
  return {
    id:      row[0],
    name:    row[1],
    type:    row[2],
    date:    row[3],
    branch:  row[4],
    notes:   row[5],
    addedAt: row[6]  // التاريخ فقط (العمود السابع)
    // row[7] = وقت الإضافة — لا نحتاجه في الكائن المُرجَع للواجهة
  };
}

/** اجلب جميع التذكيرات من الورقة */
function getAllReminders() {
  const sheet = getSheet(SHEET_REMINDERS);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(rowToReminder).filter(r => r.id);
}

/** ابحث عن رقم الصف بواسطة ID (1-indexed) — يعيد -1 إذا لم يجد */
function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

/** نسخ تذكير إلى ورقة الأرشيف */
function archiveReminder(reminder, action) {
  const sheet = getSheet(SHEET_ARCHIVE);
  const ts    = getSplitTimestamp();
  sheet.appendRow([
    reminder.id,
    reminder.name,
    reminder.type,    // مُترجَم مسبقاً عند الإضافة
    reminder.date,
    reminder.branch,  // مُترجَم مسبقاً عند الإضافة
    reminder.notes,
    reminder.addedAt || '',
    reminder.addedTime || '',
    action,           // 'حذف' أو 'إتمام'
    ts.date,
    ts.time
  ]);
}

// ──────────────────────────────────────────────────
//  🌐  HTTP Handlers
// ──────────────────────────────────────────────────

/** GET — جلب التذكيرات */
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getReminders';

    if (action === 'getReminders') {
      const reminders = getAllReminders();
      return jsonResponse({ success: true, reminders });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * POST — إضافة / حذف / إتمام
 * البيانات تصل في e.parameter.payload كـ JSON string (FormData).
 */
function doPost(e) {
  try {
    let body;
    if (e.parameter && e.parameter.payload) {
      body = JSON.parse(e.parameter.payload);
    } else {
      body = JSON.parse(e.postData.contents);
    }
    const action = body.action;

    // ─── إضافة تذكير ───
    if (action === 'addReminder') {
      const r      = body.reminder;
      const sheet  = getSheet(SHEET_REMINDERS);
      const ts     = getSplitTimestamp();

      // ترجمة النوع والفرع إلى العربي، وتنسيق تاريخ الانتهاء
      const typeAr   = translateType(r.type);
      const branchAr = translateBranch(r.branch);
      const expiryFmt = formatExpiryDate(r.date);

      sheet.appendRow([
        r.id,
        r.name,
        typeAr,      // نوع التذكير بالعربي
        expiryFmt,   // تاريخ الانتهاء بصيغة DD/MM/YYYY
        branchAr,    // الفرع بالعربي
        r.notes || '',
        ts.date,     // تاريخ الإضافة (بالأرقام الإنجليزية)
        ts.time      // وقت الإضافة (بالأرقام الإنجليزية)
      ]);

      autoResizeColumns(sheet);
      return jsonResponse({ success: true, message: 'تمت الإضافة بنجاح' });
    }

    // ─── حذف تذكير ───
    if (action === 'deleteReminder') {
      const id       = body.id;
      const remSheet = getSheet(SHEET_REMINDERS);
      const rowIndex = findRowById(remSheet, id);

      if (rowIndex === -1) {
        return jsonResponse({ success: false, error: 'التذكير غير موجود' });
      }

      const rowData = remSheet.getRange(rowIndex, 1, 1, HEADERS_REMINDERS.length).getValues()[0];
      const rem     = rowToReminder(rowData);
      rem.addedTime = rowData[7]; // نضيف وقت الإضافة للأرشيف
      archiveReminder(rem, 'حذف');

      remSheet.deleteRow(rowIndex);
      return jsonResponse({ success: true, message: 'تم الحذف وأرشفته بنجاح' });
    }

    // ─── إتمام تذكير ───
    if (action === 'completeReminder') {
      const id       = body.id;
      const remSheet = getSheet(SHEET_REMINDERS);
      const rowIndex = findRowById(remSheet, id);

      if (rowIndex === -1) {
        return jsonResponse({ success: false, error: 'التذكير غير موجود' });
      }

      const rowData = remSheet.getRange(rowIndex, 1, 1, HEADERS_REMINDERS.length).getValues()[0];
      const rem     = rowToReminder(rowData);
      rem.addedTime = rowData[7];
      archiveReminder(rem, 'إتمام');

      remSheet.deleteRow(rowIndex);
      return jsonResponse({ success: true, message: 'تم تسجيل الإتمام بنجاح' });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ──────────────────────────────────────────────────
//  🛠️  مساعدات
// ──────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function autoResizeColumns(sheet) {
  try {
    sheet.autoResizeColumns(1, HEADERS_REMINDERS.length);
  } catch (_) {}
}

// ──────────────────────────────────────────────────
//  🧪  دالة اختبار
// ──────────────────────────────────────────────────
function testSetup() {
  getSheet(SHEET_REMINDERS);
  getSheet(SHEET_ARCHIVE);

  const ts  = getSplitTimestamp();
  const sheet = getSheet(SHEET_REMINDERS);

  sheet.appendRow([
    'test_001',
    'اختبار - أحمد محمد',
    translateType('iqama'),        // تجديد إقامة
    formatExpiryDate('2025-08-15'), // 15/08/2025
    translateBranch('Dawadimi'),    // الدوادمي
    'هذا سجل تجريبي',
    ts.date,
    ts.time
  ]);
  autoResizeColumns(sheet);

  Logger.log('✅ testSetup() انتهى بنجاح — تحقق من الورقتين: "التذكيرات" و "الأرشيف"');
}

// ══════════════════════════════════════════════════════════════
//  📧  QB-Sentinel — نظام إرسال تذكيرات الانتهاء بالإيميل
//  يُضاف هذا الكود إلى ملف REM.gs الموجود
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────
//  ⚙️  إعدادات الإيميل
// ──────────────────────────────────────────────────

/** اسم ورقة الإيميلات — يجب أن يطابق اسم الورقة في الشيت */
const REM_EMAIL_SHEET_NAME = 'Emails';

/** عدد أيام التنبيه المسبق قبل الانتهاء */
const DAYS_BEFORE_EXPIRY = 14;


// ──────────────────────────────────────────────────
//  📬  جلب الإيميلات من ورقة Emails
// ──────────────────────────────────────────────────

/**
 * يقرأ ورقة Emails ويعيد كائناً بـ { to, cc }
 * الأعمدة المتوقعة في الورقة:
 *   A: الإيميل  |  D: النوع (to / cc)
 */
function getReminderNotificationEmails() {
  try {
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(REM_EMAIL_SHEET_NAME);

    if (!emailSheet) {
      console.error('⚠️ ورقة الإيميلات "' + REM_EMAIL_SHEET_NAME + '" غير موجودة!');
      return null;
    }

    const data = emailSheet.getDataRange().getValues();
    let mainRecipient = '';
    const ccRecipients = [];

    // نبدأ من الصف الثاني لتخطي العناوين
    for (let i = 1; i < data.length; i++) {
      const email = data[i][0] ? data[i][0].toString().trim() : '';
      const type  = data[i][3] ? data[i][3].toString().trim().toLowerCase() : '';

      if (email !== '') {
        if (type === 'to') {
          mainRecipient = email;
        } else {
          ccRecipients.push(email);
        }
      }
    }

    if (!mainRecipient) {
      console.error('⚠️ لم يتم العثور على إيميل رئيسي (to) في الورقة!');
      return null;
    }

    return { to: mainRecipient, cc: ccRecipients.join(',') };

  } catch (e) {
    console.error('❌ خطأ في جلب الإيميلات: ' + e.toString());
    return null;
  }
}


// ──────────────────────────────────────────────────
//  📅  تحويل التاريخ من DD/MM/YYYY إلى Date object
// ──────────────────────────────────────────────────

function parseDDMMYYYY(dateVal) {
  if (!dateVal) return null;

  // إذا كان التاريخ قادماً أصلاً ككائن تاريخ من جوجل شيت
  if (dateVal instanceof Date) {
    return dateVal;
  }

  let dateStr = dateVal.toString().trim();

  // صيغة DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // صيغة YYYY-MM-DD (احتياطي)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
}

/** تنسيق التاريخ إلى DD/MM/YYYY */
function formatDate(date) {
  const d = ("0" + date.getDate()).slice(-2);
  const m = ("0" + (date.getMonth() + 1)).slice(-2);
  const y = date.getFullYear();
  return d + "/" + m + "/" + y;
}


// ──────────────────────────────────────────────────
//  🔍  البحث عن التذكيرات المقتربة من الانتهاء
// ──────────────────────────────────────────────────

/**
 * يعيد قائمة التذكيرات التي تنتهي خلال DAYS_BEFORE_EXPIRY يوماً بالضبط
 * (أي اليوم = يوم الانتهاء - 14 يوماً)
 */
function getRemindersExpiringInDays(daysAhead) {
  const sheet = getSheet(SHEET_REMINDERS);
  const data  = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[0];
    if (!id) continue;

    const expiryDate = parseDDMMYYYY(row[3]);
    if (!expiryDate) continue;
    expiryDate.setHours(0, 0, 0, 0);

    // التعديل هنا: التحقق إذا كان التاريخ أقل من أو يساوي التاريخ المستهدف
    // وأيضاً التأكد أنه لم ينتهِ قبل اليوم (أو إزالة شرط اليوم إذا كنت تريد رؤية المنتهية)
    if (expiryDate.getTime() <= target.getTime() && expiryDate.getTime() >= today.getTime()) {
      results.push({
        id:     id,
        name:   row[1],
        type:   row[2],
        date:   formatDate(expiryDate),
        branch: row[4],
        notes:  row[5] || ''
      });
    }
  }

  return results;
}


// ──────────────────────────────────────────────────
//  🎨  بناء قالب HTML للإيميل (بالهوية البصرية QB)
// ──────────────────────────────────────────────────

function buildReminderEmailHtml(reminders, daysAhead) {
  const today     = new Date();
  const todayStr  = formatDate(today);
  const count     = reminders.length;

  // ── صفوف جدول التذكيرات ──
  const rows = reminders.map((r, idx) => {
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#fef2f2';
    return `
      <tr style="background-color: ${rowBg};">
        
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0e0e0; color: #1a1a1a;">${r.name}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0e0e0; text-align: center;">
          <span style="background-color: #fde8e8; color: #c62828; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">${r.type}</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0e0e0; text-align: center; color: #333;">${r.branch}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0e0e0; text-align: center; font-weight: bold; color: #c62828;">${r.date}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0e0e0; text-align: center; color: #666; font-size: 12px;">${r.notes || '—'}</td>
      </tr>`;
  }).join('');

  return `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 700px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

    <!-- ── رأس الإيميل ── -->
    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 30px 25px; text-align: center; color: white;">
      <div style="font-size: 40px; margin-bottom: 10px;"></div>
      <h2 style="margin: 0 0 6px; font-size: 22px; letter-spacing: 0.5px;">تذكير بموعد انتهاء وثائق الموظفين</h2>
      <p style="margin: 0; opacity: 0.85; font-size: 14px;">
        تاريخ اليوم: ${todayStr} &nbsp;|&nbsp; الانتهاء خلال: <strong>${daysAhead} يوماً</strong>
      </p>
    </div>

    <!-- ── شريط الإحصاء ── -->
    <div style="background-color: #fff5f5; border-bottom: 2px solid #f5c6c6; padding: 14px 25px; text-align: center;">
      <span style="font-size: 16px; color: #8e0000; font-weight: bold;">
         يوجد <span style="font-size: 22px; color: #c62828;">${count}</span> ${count === 1 ? 'تذكير يستحق' : 'تذكيرات تستحق'} المتابعة العاجلة
      </span>
    </div>

    <!-- ── جدول التذكيرات ── -->
    <div style="padding: 25px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #c62828; color: #ffffff;">
            <th style="padding: 12px 16px; text-align: right;">اسم تذكير</th>
            <th style="padding: 12px 16px; text-align: center;">نوع الوثيقة</th>
            <th style="padding: 12px 16px; text-align: center;">الفرع</th>
            <th style="padding: 12px 16px; text-align: center;">تاريخ الانتهاء</th>
            <th style="padding: 12px 16px; text-align: center;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <!-- ── تنبيه ── -->
    <div style="margin: 0 25px 20px; background-color: #fff3cd; border-right: 4px solid #f0a500; border-radius: 6px; padding: 14px 18px;">
      <p style="margin: 0; color: #7d5a00; font-size: 13px; line-height: 1.7;">
         <strong>تنبيه:</strong> يُرجى اتخاذ الإجراءات اللازمة لتجديد هذه الوثائق قبل انتهاء صلاحيتها
        تجنباً لأي تبعات نظامية أو إدارية.
      </p>
    </div>

    <!-- ── تذييل ── -->
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB <br>
      إدارة العمليات - عصير تايم
    </div>

  </div>`;
}


// ──────────────────────────────────────────────────
//  🚀  الدالة الرئيسية — ترسَل يومياً عبر المشغّل
// ──────────────────────────────────────────────────

/**
 * sendExpiryReminderEmails()
 *
 * تُشغَّل يومياً تلقائياً.
 * تبحث عن التذكيرات التي تنتهي بعد 14 يوماً بالضبط،
 * وترسل إيميل تجميعياً إلى الإيميلات المحفوظة في ورقة Emails.
 */
function sendExpiryReminderEmails() {
  try {
    // 1. جلب التذكيرات المقتربة
    const expiring = getRemindersExpiringInDays(DAYS_BEFORE_EXPIRY);

    if (expiring.length === 0) {
      console.log(' لا توجد تذكيرات تنتهي خلال ' + DAYS_BEFORE_EXPIRY + ' يوماً اليوم.');
      return;
    }

    console.log(' وُجد ' + expiring.length + ' تذكير/ات تنتهي خلال ' + DAYS_BEFORE_EXPIRY + ' يوماً.');

    // 2. جلب الإيميلات
    const contacts = getReminderNotificationEmails();
    if (!contacts) {
      console.error(' تعذّر إرسال الإيميل: لا توجد إيميلات صالحة.');
      return;
    }

    // 3. بناء محتوى الإيميل
    const today      = new Date();
    const todayStr   = formatDate(today);
    const subject    = ` تذكير انتهاء الوثائق — ${expiring.length} تذكير — ${todayStr}`;
    const htmlBody   = buildReminderEmailHtml(expiring, DAYS_BEFORE_EXPIRY);

    // 4. الإرسال
    const options = {
      htmlBody: htmlBody,
      name:     'نظام QB-Sentinel',
    };
    if (contacts.cc) options.cc = contacts.cc;

    GmailApp.sendEmail(contacts.to, subject, '', options);

    console.log('✅ تم إرسال إيميل التذكير بنجاح إلى: ' + contacts.to);

  } catch (err) {
    console.error('❌ خطأ في sendExpiryReminderEmails: ' + err.toString());
  }
}


// ──────────────────────────────────────────────────
//  ⏱️  إنشاء المشغّل اليومي التلقائي
// ──────────────────────────────────────────────────

/**
 * createDailyReminderTrigger()
 *
 * شغّل هذه الدالة مرة واحدة فقط يدوياً من Apps Script
 * لإنشاء المشغّل التلقائي اليومي.
 *
 * الجدول: كل يوم بين الساعة 8 و9 صباحاً (توقيت الرياض).
 */
function createDailyReminderTrigger() {
  // حذف أي مشغّل سابق لنفس الدالة تجنباً للتكرار
  const existing = ScriptApp.getProjectTriggers();
  for (const trigger of existing) {
    if (trigger.getHandlerFunction() === 'sendExpiryReminderEmails') {
      ScriptApp.deleteTrigger(trigger);
      console.log('🗑️ تم حذف المشغّل القديم.');
    }
  }

  // إنشاء مشغّل جديد يومي
  ScriptApp.newTrigger('sendExpiryReminderEmails')
    .timeBased()
    .everyDays(1)
    .atHour(8)           // الساعة 8 صباحاً
    .inTimezone('Asia/Riyadh')
    .create();

  console.log('✅ تم إنشاء المشغّل اليومي بنجاح — سيعمل كل يوم الساعة 8 صباحاً (الرياض).');
}


// ──────────────────────────────────────────────────
//  🧪  دالة اختبار يدوي
// ──────────────────────────────────────────────────

/**
 * testSendReminderEmail()
 *
 * لاختبار الإيميل يدوياً قبل تفعيل المشغّل.
 * تُرسل إيميلاً بالتذكيرات التي تنتهي خلال 14 يوماً فعلاً.
 * إن لم يكن هناك تذكيرات حقيقية، تُستخدَم بيانات تجريبية.
 */
function testSendReminderEmail() {
  let expiring = getRemindersExpiringInDays(DAYS_BEFORE_EXPIRY);

  // إن لم توجد تذكيرات حقيقية — نُنشئ بيانات تجريبية
  if (expiring.length === 0) {
    console.log('ℹ️ لا توجد تذكيرات حقيقية — سيتم إرسال بيانات تجريبية.');
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + DAYS_BEFORE_EXPIRY);
    const testDateStr = formatDate(testDate);

    expiring = [
      {  name: 'أحمد محمد العنزي',  type: 'تجديد إقامة', branch: 'الدوادمي',   date: testDateStr, notes: 'جواز منتهي أيضاً' },
      {  name: 'خالد سعد القحطاني', type: 'تجديد عقد',   branch: 'المزاحمية', date: testDateStr, notes: '' },
      {  name: 'فهد عبدالله السالم', type: 'شهادة صحية',  branch: 'الدوادمي',   date: testDateStr, notes: 'يحتاج مراجعة' }
    ];
  }

  const contacts = getReminderNotificationEmails();
  if (!contacts) {
    console.error('❌ لا توجد إيميلات — تحقق من ورقة Emails.');
    return;
  }

  const today    = new Date();
  const todayStr = formatDate(today);
  const subject  = `[اختبار] تذكير انتهاء الوثائق — ${expiring.length} تذكير — ${todayStr}`;
  const htmlBody = buildReminderEmailHtml(expiring, DAYS_BEFORE_EXPIRY);

  const options = { htmlBody: htmlBody, name: 'نظام QB-Sentinel' };
  if (contacts.cc) options.cc = contacts.cc;

  GmailApp.sendEmail(contacts.to, subject, '', options);
  console.log('✅ إيميل الاختبار أُرسل بنجاح إلى: ' + contacts.to);
}