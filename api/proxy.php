<?php
/**
 * proxy.php — بروكسي آمن لـ Google Apps Script
 * ═══════════════════════════════════════════════════════════════
 * هذا الملف على الاستضافة فقط — المتصفح لا يرى روابط Apps Script أبداً
 *
 * كيف يعمل:
 *   JS يُرسل: { report: 'MVR', payload: '{"action":"..."}' }
 *   PHP يختار الرابط الصح → يُعيد الطلب لـ Apps Script → يُعيد النتيجة
 *
 * متطلبات:
 *   - PHP 7.4 أو أحدث مع تفعيل cURL
 *   - post_max_size >= 20M (مهم لرفع الفيديو في MVR)
 *   - غيّر ALLOWED_ORIGIN لرابط موقعك الفعلي
 * ═══════════════════════════════════════════════════════════════
 */

// ── الأمان: حدد الأصل المسموح به ─────────────────────────────
define('ALLOWED_ORIGIN', 'https://0-bilal.github.io'); // ← غيّر لرابط موقعك عند الانتقال

// ── روابط Apps Script (مخفية تماماً عن المتصفح) ─────────────
$SCRIPT_URLS = [
    'MVR'       => 'https://script.google.com/macros/s/AKfycbx_POHL57HNVHzNIyprpx1nTeLVplV7teZL4FJCu1bjFVLgo4KXtU8PCJOiYlRmZQHciA/exec',
    'REM'       => 'https://script.google.com/macros/s/AKfycbx-Wtt6Bwjd4thIxzCRa1ijepyfJKYjxLyAsOei9jvXr3xqhQre8MWZo6i-zAfdwi4t2w/exec',
    'CPV'       => 'https://script.google.com/macros/s/AKfycbxxp3azw2izwMptP4mnXiHP60bJW8RqA6vbNRdaF7oROolvdMgjpnx5l-JoC2AgaF_2yA/exec',
    'EDR'       => 'https://script.google.com/macros/s/AKfycbyFPschAXnLhXweuYS_LAQwPQZje3Cj2MbXLWa8q5ZE6JSDdYP0h4ytam8gAJqaT-r4wA/exec',
    'ATT'       => 'https://script.google.com/macros/s/AKfycbwGpMtn5R96F1e9qbGonE_neD8X3k7_9epv2Xiflu7Aq3EKqjUDGnmuh93tDyUTamFc/exec',
    'RMM'       => 'https://script.google.com/macros/s/AKfycbx8Y6u3MyZ647BXc0tyUb76mbcg72a4JuyFVeo548dl8utW1UKm8k0kK6rzIIC81or8/exec',
    'ECL'       => 'https://script.google.com/macros/s/AKfycbxqxwJ5CBwjPSX-8CZSLVOSz5k7eOyd95mPOHGXXWo_Q_Gb7PgJUVizv_vTqIVqJ7CcIA/exec',
    'FIL'       => 'https://script.google.com/macros/s/AKfycbyNsR7s7fmTsyEUarjdpoYSbO52M0cfniWjIh65EwuyUexaI15WM4yezdZ4ZgBaEYVIsg/exec',
    'GENERATOR' => 'https://script.google.com/macros/s/AKfycbwGpMtn5R96F1e9qbGonE_neD8X3k7_9epv2Xiflu7Aq3EKqjUDGnmuh93tDyUTamFc/exec',
];

// ── رؤوس CORS ─────────────────────────────────────────────────
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// التعامل مع Preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── قبول POST و GET فقط ────────────────────────────────────────
if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'GET'])) {
    http_response_code(405);
    echo json_encode(['result' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

// ── تحديد التقرير المطلوب ──────────────────────────────────────
// يُقرأ من POST أو GET
$report = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // إذا أُرسل payload كـ JSON في POST body
    $rawBody = file_get_contents('php://input');
    if ($rawBody && strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
        $bodyData = json_decode($rawBody, true);
        $report   = strtoupper(trim($bodyData['report'] ?? ''));
    } else {
        $report = strtoupper(trim($_POST['report'] ?? ''));
    }
} else {
    $report = strtoupper(trim($_GET['report'] ?? ''));
}

if (!$report || !array_key_exists($report, $SCRIPT_URLS)) {
    http_response_code(400);
    echo json_encode(['result' => 'error', 'message' => 'تقرير غير معروف أو مفقود: "' . htmlspecialchars($report) . '"']);
    exit;
}

$targetUrl = $SCRIPT_URLS[$report];

// ── إعداد الطلب لـ Apps Script ────────────────────────────────
$ch = curl_init();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // إعادة إرسال بيانات POST (بدون report لأنه للـ proxy فقط)
    $postParams = $_POST;
    unset($postParams['report']);
    $postData = http_build_query($postParams);

    curl_setopt_array($ch, [
        CURLOPT_URL            => $targetUrl,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postData,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 120,          // مهلة كافية لرفع الفيديو (MVR)
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/x-www-form-urlencoded',
            'Content-Length: ' . strlen($postData),
        ],
    ]);
} else {
    // GET request — FIL notifications وغيرها
    $getParams = $_GET;
    unset($getParams['report']);
    $queryString = http_build_query($getParams);
    $fullUrl     = $targetUrl . ($queryString ? '?' . $queryString : '');

    curl_setopt_array($ch, [
        CURLOPT_URL            => $fullUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
}

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// ── إعادة النتيجة للمتصفح ─────────────────────────────────────
if ($curlError) {
    http_response_code(502);
    echo json_encode(['result' => 'error', 'message' => 'خطأ في الاتصال بالسيرفر الخارجي.']);
    exit;
}

// نُعيد نفس كود الحالة وجسم الاستجابة من Apps Script
http_response_code($httpCode >= 200 && $httpCode < 600 ? $httpCode : 200);
echo $response;
