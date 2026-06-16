
(function (window) {

  // ── إعداد الوضع ────────────────────────────────────────────
  const USE_PROXY  = false;                          // ← غيّر لـ true عند رفع proxy.php
  const PROXY_URL  = 'https://yourdomain.com/api/proxy.php'; // ← رابط موقعك

  // ── روابط Apps Script المباشرة ─────────────────────────────
  // (لا تُستخدم عند USE_PROXY = true)
  const DIRECT = {
    MVR:       'https://script.google.com/macros/s/AKfycbyQpRVSRcYbH4QZmMVY1yKLB7whMjTc_qJHJnNmwOYQ_hlMOpOV90jyTqqI_NPfNP-cXg/exec', // مراجعة الفروع الشهرية
    REM:       'https://script.google.com/macros/s/AKfycbx-Wtt6Bwjd4thIxzCRa1ijepyfJKYjxLyAsOei9jvXr3xqhQre8MWZo6i-zAfdwi4t2w/exec', // تذكير تجديد الإقامات والعقود
    CPV:       'https://script.google.com/macros/s/AKfycbxxp3azw2izwMptP4mnXiHP60bJW8RqA6vbNRdaF7oROolvdMgjpnx5l-JoC2AgaF_2yA/exec', // سند صرف نقدية
    PCR:       'https://script.google.com/macros/s/AKfycbzqHOrzlIzlY81FMS7dYsmSfXtuYixKXVkbQK1wIXjN9ndrNnmm7-LZDeFGcwnV767LuQ/exec', // طلب عهدة
    EDR:       'https://script.google.com/macros/s/AKfycbyFPschAXnLhXweuYS_LAQwPQZje3Cj2MbXLWa8q5ZE6JSDdYP0h4ytam8gAJqaT-r4wA/exec', // تقرير نهاية اليوم
    ATT:       'https://script.google.com/macros/s/AKfycbzml7Jtqe04rsRp3CfFrpZBl3Sd7WjzyojKGg8sAlQYKK4LOFbAFH3hzWdTISO1nKBkng/exec', // حضور وانصراف الموظفين
    RMM:       'https://script.google.com/macros/s/AKfycbx8Y6u3MyZ647BXc0tyUb76mbcg72a4JuyFVeo548dl8utW1UKm8k0kK6rzIIC81or8/exec', // سجل التصنيع اليومي
    ECL:       'https://script.google.com/macros/s/AKfycbxqxwJ5CBwjPSX-8CZSLVOSz5k7eOyd95mPOHGXXWo_Q_Gb7PgJUVizv_vTqIVqJ7CcIA/exec', // سجل تنظيف المعدات
    FIL:       'https://script.google.com/macros/s/AKfycbyNsR7s7fmTsyEUarjdpoYSbO52M0cfniWjIh65EwuyUexaI15WM4yezdZ4ZgBaEYVIsg/exec', // قائمة فحص جودة الفاكهة
    RSL:       'https://script.google.com/macros/s/AKfycbzacdBP4dX9OjD4Pv5iypqwIqCsm6gmJzaBasB1Xtpy6A7BrsTGCBdx-rIlZIXn3ehJSA/exec', // سجل معايرة المكونات
    RFM:       'https://script.google.com/macros/s/AKfycbzjXFwmL4kbJ-1e2hKOFU_iCBU6DKD0Jz4N5p5ISdHgpmdGWTsaKFy_HUQGnztH9u9MDg/exec',  // طلب توريد مواد
    GENERATOR: 'https://script.google.com/macros/s/AKfycbwGpMtn5R96F1e9qbGonE_neD8X3k7_9epv2Xiflu7Aq3EKqjUDGnmuh93tDyUTamFc/exec', 
  };

  /**
   * @param {string} report 
   * @returns {string}
   */
  function getEndpoint(report) {
    if (USE_PROXY) return PROXY_URL;
    const url = DIRECT[report.toUpperCase()];
    if (!url) console.error('[QB Endpoints] تقرير غير معروف: ' + report);
    return url || '';
  }

  // ── الواجهة العامة ──────────────────────────────────────────
  window.QB_ENDPOINTS = {
    get:      getEndpoint,
    useProxy: USE_PROXY,

    // وصول مباشر بالاسم للراحة
    MVR:       getEndpoint('MVR'), // مراجعة الفروع الشهرية
    REM:       getEndpoint('REM'), // تذكير تجديد الإقامات والعقود
    CPV:       getEndpoint('CPV'), // سند صرف نقدية
    PCR:       getEndpoint('PCR'), // طلب عهدة
    EDR:       getEndpoint('EDR'), // تقرير نهاية اليوم
    ATT:       getEndpoint('ATT'), // حضور وانصراف الموظفين
    RMM:       getEndpoint('RMM'), // سجل التصنيع اليومي
    ECL:       getEndpoint('ECL'), // سجل تنظيف المعدات
    FIL:       getEndpoint('FIL'), // قائمة فحص جودة الفاكهة
    RSL:       getEndpoint('RSL'), // سجل معايرة المكونات
    RFM:       getEndpoint('RFM'), // طلب توريد مواد
    GENERATOR: getEndpoint('GENERATOR'),
    
  };

})(window);
