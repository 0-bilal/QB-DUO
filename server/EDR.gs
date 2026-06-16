// ───────── إعدادات ثابتة ─────────
const TIMEZONE          = "GMT+3";          // توقيت السعودية
const EMAIL_SHEET_NAME  = "Emails";         // ورقة الإيميلات
const SETTINGS_SHEET    = "Settings";       // ورقة إعدادات الفروع
const DEFAULT_EMAIL     = "bilal15155@gmail.com"; // إيميل احتياطي

// وقت فتح افتراضي يُستخدم فقط إذا تعذّر إيجاد وقت الفرع/اليوم
const DEFAULT_OPEN_TIME = "09:00";

// أسماء أيام الأسبوع - الترتيب يطابق getDay() في جافاسكريبت
// 0 = الأحد ... 6 = السبت
const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// الكلمات التي تدل على أن الفرع مغلق ذلك اليوم
const CLOSED_KEYWORDS = ['مغلق', 'اجازة', 'إجازة', 'closed', 'off', '-'];

// عناوين أعمدة ورقة الفرع - كل عنصر = عمود مستقل
const HEADERS = [
  'تاريخ الإرسال',           // D - التاريخ الفعلي للإرسال
  'وقت الإرسال',             // E - الوقت الفعلي للإرسال
  'رقم التقرير',             // A
  'تاريخ التقرير',           // B - يخص يوم العمل
  'اسم اليوم',               // C - يوم العمل (السبت، الأحد...)
  'الشفت',                   // F - يُحدَّد تلقائياً حسب وقت الإرسال
  'الفرع',                   // G
  'اسم الموظف',              // H
  'مبيعات الكاش',            // I
  'إجمالي الشبكة',           // J
  'إجمالي تطبيق جاهز',       // K
  'إجمالي تطبيق هنقرستيشن',  // L
  'إجمالي المبيعات لليوم',   // M
  'إجمالي الكاش الكامل',     // N
  'المتبقي من العهدة',       // O
  'مبلغ المشتريات',          // P
  'الإجمالي المحسوب',        // Q
  'فرق المطابقة',            // R
  'حالة الإيميل'             // S
];


/**
 * ════════════════════════════════════════════════
 * نقطة استقبال طلبات POST من صفحة EDR
 * ════════════════════════════════════════════════
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = JSON.parse(e.parameter.payload);

    const branchName = data.branch || 'فرع غير محدد';

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateBranchSheet(ss, branchName);

    // ───── حساب التواريخ ─────
    const now = new Date();

    // تاريخ ووقت الإرسال الفعليين
    const submitDate = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
    const submitTime = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");

    // تاريخ التقرير + اسم يوم العمل
    // يُحسبان بمراجعة وقت فتح الفرع في ورقة Settings
    const workday    = resolveWorkday(now, branchName);
    const reportDate = workday.date;       // yyyy-MM-dd
    const dayName    = workday.dayName;    // اسم اليوم

    // اسم الشفت - يُحدَّد تلقائياً حسب وقت الإرسال
    const shiftName  = resolveShift(now);

    // ───── رقم التقرير (يُولَّد من جوجل) ─────
    const reportId = generateReportId(sheet, data.branchKey);

    // ───── جلب إيميلات الإشعار ─────
    const contacts = getNotificationEmails();

    // ───── إرسال الإيميل ─────
    let emailStatus = "ناجح";
    try {
      if (contacts.to) {
        sendEndOfDayEmail(data, reportId, reportDate, dayName, submitDate, submitTime, shiftName, contacts);
      } else {
        emailStatus = "فشل: إيميل ناقص";
      }
    } catch (mailErr) {
      emailStatus = "فشل: " + mailErr.toString();
    }

    // ───── بناء السطر - الترتيب يطابق HEADERS ─────
    const row = [
      submitDate,                      // تاريخ الإرسال
      submitTime,                      // وقت الإرسال
      reportId,                        // رقم التقرير
      reportDate,                      // تاريخ التقرير
      dayName,                         // اسم اليوم
      shiftName,                       // الشفت
      data.branch          || '',     // الفرع
      data.employeeName    || '',     // اسم الموظف
      numOrZero(data.cashSales),       // مبيعات الكاش
      numOrZero(data.networkTotal),    // إجمالي الشبكة
      numOrZero(data.jahezTotal),      // تطبيق جاهز
      numOrZero(data.hungerTotal),     // تطبيق هنقرستيشن
      numOrZero(data.daySalesTotal),   // إجمالي المبيعات لليوم
      numOrZero(data.fullCashTotal),   // إجمالي الكاش الكامل
      numOrZero(data.custodyRemain),   // المتبقي من العهدة
      numOrZero(data.purchases),       // مبلغ المشتريات
      numOrZero(data.calculatedSales), // الإجمالي المحسوب
      numOrZero(data.difference),      // فرق المطابقة
      emailStatus                      // حالة الإيميل
    ];

    sheet.appendRow(row);

    return jsonResponse({ result: "success", id: reportId });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });

  } finally {
    lock.releaseLock();
  }
}


/**
 * ════════════════════════════════════════════════
 * تحديد يوم العمل (التاريخ + اسم اليوم)
 * ────────────────────────────────────────────────
 * المبدأ:
 *   يوم العمل يبدأ من لحظة فتح الفرع. أي تقرير يُرسل
 *   قبل وقت فتح الفرع في يوم التقويم الحالي ينتمي
 *   ليوم العمل السابق.
 *
 * الخطوات:
 *   1. نقرأ وقت فتح الفرع ليوم التقويم الحالي.
 *   2. إذا كان وقت الإرسال قبل وقت الفتح => ننقص يوماً.
 *   3. إذا كان يوم العمل الناتج مغلقاً للفرع، نرجع
 *      للخلف حتى نجد آخر يوم عمل مفتوح.
 *
 * مثال (الدوادمي: الخميس يفتح 16:00، الجمعة يفتح 14:00):
 *   إرسال الجمعة 03:00 فجراً => 03:00 قبل 14:00
 *      => التقرير يخص يوم الخميس
 *   إرسال الجمعة 17:00 مساءً => 17:00 بعد 14:00
 *      => التقرير يخص يوم الجمعة
 * ════════════════════════════════════════════════
 */
function resolveWorkday(now, branchName) {
  // جدول أوقات فتح الفرع لكل أيام الأسبوع
  const schedule = getBranchSchedule(branchName);

  // يوم التقويم الحالي ووقته بالدقائق
  const dayIdx     = getDayIndex(now);

  const curHour    = parseInt(Utilities.formatDate(now, TIMEZONE, "H"), 10);
  const curMin     = parseInt(Utilities.formatDate(now, TIMEZONE, "m"), 10);
  const nowMinutes = (curHour * 60) + curMin;

  // وقت فتح يوم التقويم الحالي
  const todayOpen  = schedule[dayIdx];

  let target = new Date(now.getTime());

  // إذا كان الإرسال قبل وقت فتح اليوم الحالي => يخص يوم العمل السابق
  // (أو إذا كان اليوم الحالي مغلقاً أصلاً)
  if (todayOpen === null || nowMinutes < todayOpen) {
    target = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  }

  // التراجع للخلف حتى نجد يوم عمل مفتوح (حد أقصى 7 أيام)
  let guard = 0;
  while (guard < 7) {
    const idx = getDayIndex(target);
    if (schedule[idx] !== null) {
      break; // يوم مفتوح
    }
    target = new Date(target.getTime() - (24 * 60 * 60 * 1000));
    guard++;
  }

  return {
    date:    Utilities.formatDate(target, TIMEZONE, "yyyy-MM-dd"),
    dayName: WEEKDAYS[getDayIndex(target)]
  };
}


/**
 * استخراج رقم اليوم (0=الأحد .. 6=السبت) من تاريخ بتوقيت السعودية
 */
function getDayIndex(dateObj) {
  // "EEE" تعطي اسم اليوم، نحوّله لرقم عبر مطابقته
  const dayShort = Utilities.formatDate(dateObj, TIMEZONE, "u"); // 1..7 (الإثنين..الأحد)
  const isoDay   = parseInt(dayShort, 10); // 1=الإثنين ... 7=الأحد
  // تحويل: ISO 7=الأحد => 0 ، ISO 1=الإثنين => 1 ... ISO 6=السبت => 6
  return isoDay % 7;
}


/**
 * ════════════════════════════════════════════════
 * تحديد اسم الشفت تلقائياً حسب وقت الإرسال
 * ────────────────────────────────────────────────
 * تقسيم اليوم لثلاث فترات. عدّل الحدود إذا لزم.
 * ════════════════════════════════════════════════
 */
function resolveShift(now) {
  const hour = parseInt(Utilities.formatDate(now, TIMEZONE, "H"), 10);

  if (hour >= 5 && hour < 14) {
    return "الشفت الصباحي";
  } else if (hour >= 14 && hour < 22) {
    return "الشفت المسائي";
  } else {
    return "الشفت الليلي";
  }
}


/**
 * ════════════════════════════════════════════════
 * قراءة جدول أوقات فتح الفرع من ورقة Settings
 * ────────────────────────────────────────────────
 * بنية ورقة Settings (الصف الأول عناوين):
 *   العمود A : اسم الفرع
 *   الأعمدة B..H : أوقات الفتح لأيام الأسبوع
 *                  (الأحد، الإثنين ... السبت)
 *   الخلية تحتوي وقت الفتح "HH:mm" أو "مغلق"
 *
 * تُرجِع مصفوفة بطول 7 (الفهرس 0=الأحد .. 6=السبت):
 *   - رقم = دقائق وقت الفتح منذ منتصف الليل
 *   - null = الفرع مغلق ذلك اليوم
 * ════════════════════════════════════════════════
 */
function getBranchSchedule(branchName) {
  // الجدول الافتراضي: كل الأيام مفتوحة بوقت افتراضي
  const fallback = [];
  const defMin = timeToMinutes(DEFAULT_OPEN_TIME);
  for (let i = 0; i < 7; i++) fallback.push(defMin);

  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SETTINGS_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return fallback;

    const lastRow = sheet.getLastRow();
    const names   = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const times   = sheet.getRange(2, 2, lastRow - 1, 7).getDisplayValues();

    const target = (branchName || "").toString().trim();

    for (let i = 0; i < names.length; i++) {
      const rowName = names[i][0] ? names[i][0].toString().trim() : "";
      if (rowName !== "" && rowName === target) {
        const schedule = [];
        for (let d = 0; d < 7; d++) {
          const cell = times[i][d] ? times[i][d].toString().trim() : "";
          schedule.push(parseCellTime(cell));
        }
        return schedule;
      }
    }
    return fallback;
  } catch (err) {
    return fallback;
  }
}


/**
 * تحويل خلية وقت إلى دقائق، أو null إذا كانت تدل على "مغلق"
 */
function parseCellTime(cell) {
  if (!cell) return null; // خلية فارغة = مغلق

  const lower = cell.toString().trim().toLowerCase();
  for (let i = 0; i < CLOSED_KEYWORDS.length; i++) {
    if (lower === CLOSED_KEYWORDS[i].toLowerCase()) return null;
  }

  const normalized = normalizeTime(cell);
  return timeToMinutes(normalized);
}


/**
 * تحويل "HH:mm" إلى عدد دقائق منذ منتصف الليل
 */
function timeToMinutes(hhmm) {
  const parts = hhmm.split(":");
  return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
}


/**
 * تحويل أي صيغة وقت إلى "HH:mm" بنظام 24 ساعة
 * يقبل: "9:00" / "09:00" / "9:00 AM" / "2:00 م" ...
 */
function normalizeTime(value) {
  if (!value) return DEFAULT_OPEN_TIME;

  let s = value.toString().trim().toUpperCase();
  const isPM = s.indexOf("PM") !== -1 || s.indexOf("م") !== -1;
  const isAM = s.indexOf("AM") !== -1 || s.indexOf("ص") !== -1;

  const m = s.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!m) return DEFAULT_OPEN_TIME;

  let h   = parseInt(m[1], 10);
  let min = parseInt(m[2], 10);

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  if (isNaN(h) || isNaN(min) || h > 23 || min > 59) return DEFAULT_OPEN_TIME;

  return ("0" + h).slice(-2) + ":" + ("0" + min).slice(-2);
}


/**
 * الحصول على ورقة الفرع أو إنشاؤها تلقائياً عند أول تقرير
 */
function getOrCreateBranchSheet(ss, branchName) {
  let sheet = ss.getSheetByName(branchName);

  if (!sheet) {
    sheet = ss.insertSheet(branchName);
    setupSheetHeader(sheet);
  } else if (sheet.getLastRow() === 0) {
    setupSheetHeader(sheet);
  }
  return sheet;
}


/**
 * تجهيز صف العناوين وتنسيقه
 */
function setupSheetHeader(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#c62828')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);

  for (let i = 1; i <= HEADERS.length; i++) {
    sheet.setColumnWidth(i, 130);
  }

  sheet.setRightToLeft(true);
}


/**
 * توليد رقم تقرير تسلسلي لكل فرع
 * المثال: EDR-DAW-0001  /  EDR-MUZ-0001
 */
function generateReportId(sheet, branchKey) {
  const code    = (branchKey === 'Muzahmiyah') ? 'MUZ' : 'DAW';
  const lastRow = sheet.getLastRow();
  const count   = (lastRow > 1) ? (lastRow - 1) : 0;
  const next    = count + 1;
  const padded  = ('0000' + next).slice(-4);
  return code + '-' + padded;
}


/**
 * جلب إيميلات الإشعار من ورقة Emails
 * العمود A = الإيميل   |   العمود D = النوع (to / cc)
 */
function getNotificationEmails() {
  try {
    const ss         = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = ss.getSheetByName(EMAIL_SHEET_NAME);
    if (!emailSheet) return { to: DEFAULT_EMAIL, cc: "" };

    const values = emailSheet.getDataRange().getValues();
    let mainRecipient = "";
    let ccRecipients  = [];

    for (let i = 1; i < values.length; i++) {
      const email = values[i][0] ? values[i][0].toString().trim() : "";
      const type  = values[i][3] ? values[i][3].toString().trim() : "";
      if (email !== "") {
        if (type.toLowerCase() === "to") {
          mainRecipient = email;
        } else {
          ccRecipients.push(email);
        }
      }
    }
    return {
      to: mainRecipient || DEFAULT_EMAIL,
      cc: ccRecipients.join(",")
    };
  } catch (err) {
    return { to: DEFAULT_EMAIL, cc: "" };
  }
}


/**
 * تحويل القيمة إلى رقم أو صفر
 */
function numOrZero(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}


/**
 * تنسيق رقم بفواصل الآلاف + خانتين عشريتين
 */
function fmt(v) {
  const n = numOrZero(v);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


/**
 * إرجاع استجابة JSON
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * ════════════════════════════════════════════════
 * إرسال إيميل تقرير نهاية اليوم
 * بنفس الهوية البصرية المستخدمة في إيميلات FIL
 * ════════════════════════════════════════════════
 */
function sendEndOfDayEmail(data, reportId, reportDate, dayName, submitDate, submitTime, shiftName, contacts) {

  const diff      = numOrZero(data.difference);
  const isMatch   = Math.abs(diff) < 0.01;
  const diffColor = isMatch ? '#2e7d32' : (diff > 0 ? '#f57c00' : '#d32f2f');
  const diffLabel = isMatch ? 'مطابق' : (diff > 0 ? 'زيادة' : 'عجز');

  function rowItem(label, value, color) {
    const c = color || '#000';
    return '' +
      '<tr>' +
        '<td style="padding:12px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">' + label + '</td>' +
        '<td style="padding:12px;border-bottom:1px solid #f0f0f0;color:' + c + ';text-align:left;direction:ltr;">' + value + '</td>' +
      '</tr>';
  }

  const htmlBody = `
  <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

    <div style="background: linear-gradient(135deg, #c62828 0%, #8e0000 100%); padding: 25px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 24px;">تقرير نهاية اليوم</h2>
      <p style="margin: 5px 0 0; opacity: 0.85; font-size: 13px; letter-spacing: 1px;">END OF DAY REPORT</p>
      <p style="margin: 8px 0 0; opacity: 0.8;">رقم التقرير: # ${reportId}</p>
    </div>

    <div style="padding: 30px; background-color: #ffffff;">

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        ${rowItem('الفرع:', data.branch)}
        ${rowItem('الموظف المسؤول:', data.employeeName)}
        ${rowItem('يوم التقرير:', dayName + ' - ' + reportDate)}
        ${rowItem('الشفت:', shiftName)}
        ${rowItem('تاريخ ووقت الإرسال:', submitDate + ' | ' + submitTime)}
      </table>

      <h3 style="color:#c62828;border-right:4px solid #c62828;padding-right:10px;margin:25px 0 10px;font-size:16px;">المبيعات</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
        ${rowItem('مبيعات الكاش:', fmt(data.cashSales) + ' ر.س')}
        ${rowItem('إجمالي الشبكة:', fmt(data.networkTotal) + ' ر.س')}
        ${rowItem('تطبيق جاهز:', fmt(data.jahezTotal) + ' ر.س')}
        ${rowItem('تطبيق هنقرستيشن:', fmt(data.hungerTotal) + ' ر.س')}
        ${rowItem('إجمالي المبيعات لليوم:', fmt(data.daySalesTotal) + ' ر.س', '#c62828')}
      </table>

      <h3 style="color:#c62828;border-right:4px solid #c62828;padding-right:10px;margin:25px 0 10px;font-size:16px;">الكاش والعهدة</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
        ${rowItem('إجمالي الكاش الكامل:', fmt(data.fullCashTotal) + ' ر.س')}
        ${rowItem('المتبقي من العهدة:', fmt(data.custodyRemain) + ' ر.س')}
        ${rowItem('مبلغ المشتريات:', fmt(data.purchases) + ' ر.س')}
      </table>

      <h3 style="color:#c62828;border-right:4px solid #c62828;padding-right:10px;margin:25px 0 10px;font-size:16px;">المطابقة الحسابية</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${rowItem('الإجمالي المحسوب:', fmt(data.calculatedSales) + ' ر.س')}
        ${rowItem('فرق المطابقة:', diffLabel + ' (' + fmt(diff) + ' ر.س)', diffColor)}
      </table>

      <div style="text-align:center;margin-top:25px;">
        <span style="display:inline-block;padding:10px 25px;border-radius:8px;font-weight:bold;color:#ffffff;background-color:${diffColor};">
          حالة الإقفال: ${diffLabel}
        </span>
      </div>

    </div>

    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB <br>
      إدارة العمليات - عصير تايم
    </div>

  </div>`;

  const subject = `${data.branch} - تقرير نهاية اليوم - ${dayName} ${reportDate}`;

  GmailApp.sendEmail(contacts.to, subject, "", {
    htmlBody: htmlBody,
    name: "نظام QB-Sentinel",
    cc: contacts.cc
  });
}


/**
 * ════════════════════════════════════════════════
 * إنشاء ورقة Settings بقالب جاهز
 * ────────────────────────────────────────────────
 * شغّل هذه الدالة مرة واحدة من المحرر.
 * تُنشئ ورقة بأعمدة أيام الأسبوع لكل فرع.
 * اكتب وقت الفتح في كل خلية، أو "مغلق" لليوم المغلق.
 * ════════════════════════════════════════════════
 */
function setupSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET);
  }

  // العناوين: اسم الفرع + أيام الأسبوع
  const headers = ['اسم الفرع'].concat(WEEKDAYS);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#c62828')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // صفوف الفروع الافتراضية (عدّل الأوقات حسب الواقع)
  // الترتيب: الأحد، الإثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت
  const rows = [
    ['الدوادمي',  '09:00', '09:00', '09:00', '09:00', '09:00', '14:00', '09:00'],
    ['المزاحمية', '09:00', '09:00', '09:00', '09:00', '09:00', '14:00', '09:00']
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 150);
  for (let i = 2; i <= headers.length; i++) {
    sheet.setColumnWidth(i, 95);
  }
  sheet.setRightToLeft(true);

  SpreadsheetApp.getUi().alert(
    'تم إنشاء ورقة Settings بنجاح.\n\n' +
    '- اكتب وقت فتح الفرع في خلية كل يوم (مثال 09:00 أو 2:00 م).\n' +
    '- اكتب كلمة "مغلق" في خلية اليوم الذي لا يعمل فيه الفرع.\n' +
    '- حساب تاريخ التقرير يعتمد على وقت الفتح فقط.'
  );
}


/**
 * ════════════════════════════════════════════════
 * doGet — فحص أن الـ API يعمل
 * ════════════════════════════════════════════════
 */
function doGet(e) {
  return jsonResponse({ result: 'ok', message: 'EDR API is running' });
}


/**
 * ════════════════════════════════════════════════
 * (اختياري) اختبار سريع - شغّله من المحرر
 * ════════════════════════════════════════════════
 */
function testReport() {
  const fakeEvent = {
    parameter: {
      payload: JSON.stringify({
        reportType:      'تقرير نهاية اليوم',
        branch:          'الدوادمي',
        branchKey:       'Dawadimi',
        employeeName:    'بلال الخواجة',
        cashSales:       1500,
        networkTotal:    2300,
        jahezTotal:      800,
        hungerTotal:     650,
        daySalesTotal:   5250,
        fullCashTotal:   1500,
        custodyRemain:   300,
        purchases:       120,
        calculatedSales: 5250,
        difference:      0
      })
    }
  };

  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}