const CONFIG = {
  QR_VALIDITY_MS: 2 * 60 * 1000,  // صلاحية QR دقيقتان
  TIMEZONE:       "Asia/Riyadh",
};

const BRANCH_MAP = {
  "Muzahmiyah": "المزاحمية",
  "muzahmiyah": "المزاحمية",
  "المزاحمية":  "المزاحمية",
  "Dawadimi":   "الدوادمي",
  "dawadimi":   "الدوادمي",
  "الدوادمي":   "الدوادمي",
};

// ============================================================
// doGet — JSONP لتجاوز CORS
// ============================================================
function doGet(e) {
  try {
    const action   = e.parameter.action   || "";
    const callback = e.parameter.callback || "callback";

    if (action === "GET_BRANCH_NAME") {
      const branchAr = getBranchAr(e.parameter.deviceId || "");
      return jsonp(callback, { status: "SUCCESS", branchAr });
    }

    if (action === "VERIFY_QR") {
      const decoded = b64Decode(e.parameter.payload || "");
      if (!decoded) return jsonp(callback, { valid: false });
      const [qrDeviceId, mode, ts] = decoded.split("|");
      const valid = (Date.now() - parseInt(ts)) < CONFIG.QR_VALIDITY_MS;
      return jsonp(callback, { valid, mode, deviceId: qrDeviceId });
    }

    return jsonp(callback, { status: "UNKNOWN_ACTION" });

  } catch (err) {
    return jsonp("callback", { status: "ERROR", msg: err.toString() });
  }
}

// ============================================================
// doPost — نقطة الدخول الرئيسية
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === "REGISTER_DEVICE") return handleRegisterDevice(ss, data);
    if (data.action === "ATTENDANCE")      return handleAttendance(ss, data);
    if (data.action === "VERIFY_RESET")    return handleVerifyReset(ss, data);

    return respond("ERROR|UNKNOWN_ACTION");

  } catch (err) {
    return respond("ERROR|" + err.toString());
  }
}

// ============================================================
// تسجيل جهاز المولّد
// ============================================================
function handleRegisterDevice(ss, data) {
  const branchAr = getBranchAr(data.deviceId || "");
  const sheet    = sheet_(ss, "الأجهزة المعتمدة", [
    "التاريخ","الوقت","Device ID","اسم الفرع","IP","الموقع","User Agent","الشاشة"
  ]);
  sheet.appendRow([
    fmtDate(), fmtTime(),
    data.deviceId  || "Unknown", branchAr,
    data.ip        || "Unknown", data.location  || "Unknown",
    data.userAgent || "Unknown", data.screenRes || "Unknown",
  ]);
  return respond("SUCCESS|" + branchAr);
}

// ============================================================
// تسجيل الحضور / الانصراف
// ============================================================
function handleAttendance(ss, data) {
  const qr       = decodeQR(data.qrPayload || "");
  const branchAr = getBranchAr(data.branch || "");
  const fp       = data.fingerprint || "Unknown";
  const empName  = data.employeeName || "Unknown";

  // ─── التحقق من بصمة الجهاز ───
  const fpStatus = checkFingerprint(ss, empName, fp);
  // fpStatus: "NEW" | "OK" | "MISMATCH"

  // ─── تحديد نص الحالة النهائية ───
  let regStatus;
  if (!qr.valid)              regStatus = "QR منتهي";
  else if (fpStatus === "NEW") regStatus = "حضور ✓ (أول تسجيل)";
  else if (fpStatus === "OK")  regStatus = "حضور ✓";
  else                         regStatus = "⚠️ جهاز مختلف";

  // ─── تسجيل في سجلات الحضور ───
  sheet_(ss, "سجلات الحضور", [
    "التاريخ","الوقت","الموظف","الفرع","النوع",
    "IP الموظف","بصمة الجهاز","حالة البصمة","حالة التسجيل"
  ]).appendRow([
    fmtDate(), fmtTime(),
    empName, branchAr,
    qr.mode === "IN" ? "حضور" : "انصراف",
    data.ip || "Unknown", fp, fpStatus, regStatus,
  ]);

  // ─── تسجيل محاولة مشبوهة إن وجدت ───
  if (fpStatus === "MISMATCH") {
    sheet_(ss, "محاولات مشبوهة", [
      "التاريخ","الوقت","الموظف المستهدف","الفرع",
      "النوع","IP المشبوه","البصمة المشبوهة"
    ]).appendRow([
      fmtDate(), fmtTime(),
      empName, branchAr,
      qr.mode === "IN" ? "حضور" : "انصراف",
      data.ip || "Unknown", fp,
    ]);
  }

  SpreadsheetApp.flush();
  return respond(fpStatus === "MISMATCH" ? "WARN|DEVICE_MISMATCH" : "SUCCESS");
}

// ============================================================
// فحص بصمة الجهاز وربطها بالموظف
// ============================================================
function checkFingerprint(ss, empName, fp) {
  const sheet = sheet_(ss, "أجهزة الموظفين", [
    "اسم الموظف","بصمة الجهاز","تاريخ أول تسجيل","عدد مرات الاستخدام"
  ]);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === empName) {
      if (rows[i][1].toString() === fp) {
        // نفس الجهاز — زد العداد
        sheet.getRange(i + 1, 4).setValue((parseInt(rows[i][3]) || 0) + 1);
        return "OK";
      }
      // جهاز مختلف
      return "MISMATCH";
    }
  }

  // أول تسجيل للموظف — احفظ بصمته
  sheet.appendRow([empName, fp, fmtDate(), 1]);
  return "NEW";
}

// ============================================================
// التحقق من كود إعادة التعيين وتجديده فوراً
// ============================================================
function handleVerifyReset(ss, data) {
  const sheet = sheet_(ss, "إعدادات النظام", ["Setting Name", "Value"]);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === "RESET_CODE" &&
        rows[i][1].toString() === data.code.toString()) {

      // ✅ جدِّد الكود فوراً
      const newCode = String(Math.floor(1000 + Math.random() * 9000));
      sheet.getRange(i + 1, 2).setValue(newCode);

      // هل نمسح بصمة موظف بعينه؟
      if (data.clearEmployee) {
        clearEmployeeFp(ss, data.clearEmployee);
      }

      SpreadsheetApp.flush();
      return respond("SUCCESS");
    }
  }
  return respond("ERROR|INVALID_CODE");
}

// ============================================================
// مسح بصمة موظف (لإعادة ربطه بجهاز جديد)
// ============================================================
function clearEmployeeFp(ss, empName) {
  const sheet = ss.getSheetByName("أجهزة الموظفين");
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === empName) { sheet.deleteRow(i + 1); return; }
  }
}

// ============================================================
// أدوات مساعدة
// ============================================================
function decodeQR(payload) {
  try {
    const str   = b64Decode(payload);
    if (!str)   return { valid: false, mode: "IN" };
    const parts = str.split("|");
    return {
      valid:    (Date.now() - parseInt(parts[2])) < CONFIG.QR_VALIDITY_MS,
      deviceId: parts[0],
      mode:     parts[1] || "IN",
    };
  } catch (_) { return { valid: false, mode: "IN" }; }
}

function getBranchAr(input) {
  if (!input) return "غير محدد";
  return BRANCH_MAP[input] || input;
}

function b64Decode(str) {
  try { return Utilities.newBlob(Utilities.base64Decode(str)).getDataAsString(); }
  catch (_) { return null; }
}

function fmtDate() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd"); }
function fmtTime() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "HH:mm:ss"); }

function sheet_(ss, name, headers) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const r = s.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    r.setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold");
    s.setFrozenRows(1);
    if (name === "إعدادات النظام") {
      s.appendRow(["RESET_CODE", String(Math.floor(1000 + Math.random() * 9000))]);
    }
    if (name === "تكوين الفروع") {
      s.appendRow(["Muzahmiyah","المزاحمية"]);
      s.appendRow(["Dawadimi","الدوادمي"]);
    }
  }
  return s;
}

function respond(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function jsonp(cb, obj) {
  return ContentService
    .createTextOutput(cb + "(" + JSON.stringify(obj) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ============================================================
// الإعداد الأولي — شغّلها يدوياً مرة واحدة فقط
// ============================================================
function setupInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(ss, "إعدادات النظام",    ["Setting Name","Value"]);
  sheet_(ss, "تكوين الفروع",    ["معرف الفرع","اسم الفرع"]);
  sheet_(ss, "الأجهزة المعتمدة", ["التاريخ","الوقت","معرف الجهاز","اسم الفرع","IP","الموقع","بصمة الجهاز","الشاشة"]);
  sheet_(ss, "أجهزة الموظفين",   ["اسم الموظف","بصمة الجهاز","تاريخ أول تسجيل","عدد مرات الاستخدام"]);
  sheet_(ss, "سجلات الحضور",    ["التاريخ","الوقت","الموظف","الفرع","النوع","IP الموظف","بصمة الجهاز","حالة البصمة","حالة التسجيل"]);
  sheet_(ss, "محاولات مشبوهة",["التاريخ","الوقت","الموظف المستهدف","الفرع","النوع","IP المشبوه","البصمة المشبوهة"]);

  const rows = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("إعدادات النظام").getDataRange().getValues();
  for (let r of rows) {
    if (r[0] === "RESET_CODE") Logger.log("🔑 RESET_CODE: " + r[1]);
  }
  Logger.log("✅ الإعداد اكتمل بنجاح");
}