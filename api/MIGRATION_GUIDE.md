# دليل الانتقال من GitHub Pages إلى الاستضافة

> عند الانتقال للاستضافة، ستُخفى روابط Google Apps Script تماماً عن المتصفح.  
> التغييرات المطلوبة **3 سطور فقط في ملفين فقط** + رفع مجلد `api/` على السيرفر.

---

## ما الذي سيتغير؟

| الوضع الحالي (GitHub Pages) | بعد الانتقال (الاستضافة) |
|---|---|
| المتصفح يتصل بـ Apps Script مباشرة | المتصفح يتصل بـ `proxy.php` فقط |
| روابط Apps Script مرئية في DevTools | روابط Apps Script مخفية على السيرفر |
| الروابط في `js/endpoints.js` | الروابط في `api/proxy.php` فقط |

---

## الخطوة 1 — رفع مجلد `api/` على الاستضافة

ارفع المجلد كاملاً على **جذر موقعك** بحيث يكون:

```
https://yourdomain.com/api/proxy.php      ← يجب أن يكون قابلاً للوصول
https://yourdomain.com/api/.htaccess      ← يُرفع معه تلقائياً
```

> **ملاحظة cPanel:** في مدير الملفات، ارفع داخل مجلد `public_html/api/`

---

## الخطوة 2 — تعديل `api/proxy.php`

**الملف:** `api/proxy.php`  
**السطر:** 13  
**ابحث عن هذا السطر:**

```php
define('ALLOWED_ORIGIN', 'https://0-bilal.github.io');
```

**استبدله بهذا** (ضع رابط موقعك الفعلي):

```php
define('ALLOWED_ORIGIN', 'https://yourdomain.com');
```

> مثال إذا كان موقعك `https://qb-sentinel.com` تكتب:
> ```php
> define('ALLOWED_ORIGIN', 'https://qb-sentinel.com');
> ```

---

## الخطوة 3 — تعديل `js/endpoints.js`

هذا الملف يحتاج **تغيير سطرين فقط**.

**الملف:** `js/endpoints.js`

---

### السطر الأول — تفعيل الـ Proxy

**السطر:** 17  
**ابحث عن:**

```js
const USE_PROXY  = false;
```

**استبدله بـ:**

```js
const USE_PROXY  = true;
```

---

### السطر الثاني — رابط موقعك

**السطر:** 18  
**ابحث عن:**

```js
const PROXY_URL  = 'https://yourdomain.com/api/proxy.php';
```

**استبدله بـ** (ضع رابط موقعك الفعلي):

```js
const PROXY_URL  = 'https://qb-sentinel.com/api/proxy.php';
```

---

## ملخص كل التغييرات

| الملف | السطر | قبل | بعد |
|---|---|---|---|
| `api/proxy.php` | 13 | `'https://0-bilal.github.io'` | رابط موقعك |
| `js/endpoints.js` | 17 | `USE_PROXY = false` | `USE_PROXY = true` |
| `js/endpoints.js` | 18 | `'https://yourdomain.com/...'` | رابط موقعك الفعلي |

**ملفات التقارير (MVR, ATT, RMM...) لا تحتاج أي تعديل.**

---

## التحقق بعد الانتقال

افتح أي تقرير وافتح **DevTools → Network Tab**، يجب أن ترى:

```
✅ الطلبات تذهب إلى:   yourdomain.com/api/proxy.php
❌ لا يظهر أي رابط:    script.google.com
```

---

## إذا ظهرت مشكلة CORS

تأكد أن `ALLOWED_ORIGIN` في `proxy.php` يطابق رابط موقعك **تماماً** بدون `/` في النهاية:

```php
// ✅ صحيح
define('ALLOWED_ORIGIN', 'https://qb-sentinel.com');

// ❌ خطأ — لا تضع / في النهاية
define('ALLOWED_ORIGIN', 'https://qb-sentinel.com/');
```

---

## إذا ظهر خطأ في رفع الفيديو (MVR)

ملف `.htaccess` الموجود في `api/` يرفع الحد تلقائياً إلى 20MB لكل طلب.  
إذا استمرت المشكلة، تحقق أن الاستضافة تسمح بتعديل `php.ini` عبر `.htaccess`.

في cPanel يمكنك التحقق من:  
**cPanel → PHP Configuration → post_max_size**  
تأكد أنها `20M` أو أكبر.
