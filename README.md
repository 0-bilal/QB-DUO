<div align="center">

<img src="ico/QB-Sentinel-Logo.png" alt="QB-Sentinel Logo" width="80"/>

# QB-Sentinel

**نظام رقابة جودة العمليات التشغيلية**  
*Operational Quality Control System*

[![PWA](https://img.shields.io/badge/PWA-enabled-blueviolet?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Google Sheets](https://img.shields.io/badge/Backend-Google%20Sheets-34a853?style=flat-square&logo=google-sheets)](https://workspace.google.com/products/sheets/)
[![License](https://img.shields.io/badge/License-MIT-red?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active%20Development-brightgreen?style=flat-square)]()

</div>

---

## 📖 فكرة المشروع / About

**QB-Sentinel** هو نظام تقارير رقمي مبني كـ PWA (تطبيق ويب تقدمي) هدفه تحويل العمليات الورقية اليومية في الفروع إلى سجلات رقمية منظمة ومباشرة.

البيانات تُرسل لحظياً إلى **Google Sheets** عبر **Google Apps Script**، مما يتيح للإدارة متابعة كل عمليات الفروع في الوقت الفعلي دون الحاجة لأي خادم مخصص أو قاعدة بيانات مدفوعة.

**QB-Sentinel** is a PWA-based digital reporting system designed to replace paper-based daily operations in retail branches with structured, real-time digital records.

Data flows instantly to **Google Sheets** via **Google Apps Script**, giving management live visibility into all branch operations — with zero dedicated server or paid database needed.

---

## 🎯 المشكلة التي يحلها / Problem Solved

| الوضع القديم 📄 | مع QB-Sentinel ✅ |
|---|---|
| تقارير ورقية يدوية قابلة للضياع | سجلات رقمية محفوظة تلقائياً |
| لا يمكن متابعة الفروع عن بُعد | لوحة Google Sheets في الوقت الفعلي |
| لا توثيق بالصور للحوادث | رفع صور مباشر مع كل تقرير |
| تقارير الحضور قابلة للتزوير | نظام QR Code + بصمة الجهاز |
| تذكيرات تجديد الإقامات يدوية | نظام تنبيهات تلقائي بالتواريخ |

---

## ⚙️ المكدس التقني / Tech Stack

```
Frontend     →  HTML5 + CSS3 + Vanilla JavaScript (PWA)
Backend      →  Google Apps Script (Web App)
Database     →  Google Sheets
Icons        →  Lucide Icons
Auth (ATT)   →  FingerprintJS v4 + HTML5 QR Code Scanner
Hosting      →  أي خادم ثابت / GitHub Pages / Netlify
```

---

## 📋 التقارير الحالية / Current Reports

> ✅ مكتمل · 🔶 تجريبي BETA · 🔧 قيد التطوير DEV

### 👥 شؤون الموظفين / Staff Management

| الكود | التقرير | الوصف | الحالة |
|---|---|---|---|
| **ATT** | حضور وانصراف الموظفين | تسجيل الدخول والخروج بمسح QR Code مع التحقق ببصمة الجهاز | ✅ |
| **REM** | تذكير تجديد الإقامات والعقود | تتبع تواريخ انتهاء الإقامات والعقود والشهادات الصحية مع تنبيهات تلقائية | ✅ |

### 🍎 المنتجات والمخزون / Products & Inventory

| الكود | التقرير | الوصف | الحالة |
|---|---|---|---|
| **FIL** | قائمة فحص جودة الفاكهة | فحص يومي لجودة الفواكه مع توثيق التالف بالصورة والوزن | ✅ |
| **PAL** | متابعة توفر المنتجات | رصد توفر المنتجات في الفرع لحظياً | 🔶 BETA |
| **RSL** | سجل معايير المكونات | توثيق معايير ومقاييس المكونات القياسية | 🔧 DEV |
| **PRR** | طلب استرجاع منتجات | إدارة طلبات إرجاع المنتجات التالفة أو الزائدة | 🔧 DEV |

### 🔧 العمليات التشغيلية / Daily Operations

| الكود | التقرير | الوصف | الحالة |
|---|---|---|---|
| **ECL** | سجل تنظيف المعدات | توثيق عمليات تنظيف المعدات بالصورة وتحديد المسؤول | ✅ |
| **RMM** | تصنيع المواد الأولية | تسجيل عمليات التصنيع اليومي (العجين، الفواكه المجمدة...) | ✅ |
| **EDR** | تقرير نهاية اليوم | مطابقة المبيعات (كاش + شبكة + تطبيقات) ورصد الفروقات | 🔶 BETA |

### 💰 الشؤون المالية / Finance

| الكود | التقرير | الوصف | الحالة |
|---|---|---|---|
| **CPV** | سند صرف نقدية | تسجيل عمليات الصرف النقدي مع التحقق من هوية الموظف | ✅ |

---

## 🗂️ بنية المشروع / Project Structure

```
QB-Sentinel/
│
├── 📄 index.html              ← الصفحة الرئيسية (قائمة التقارير)
├── 📄 [REPORT].html           ← صفحة كل تقرير (ATT.html, FIL.html, ...)
│
├── 📁 js/
│   ├── config.js              ← ⭐ الإعدادات المشتركة (موظفون، فروع)
│   ├── common.js              ← ⭐ الوظائف المشتركة (Modal، Section Toggle)
│   ├── versions.js            ← أرقام إصدارات التقارير
│   └── script.js              ← سكريبت الصفحة الرئيسية
│
├── 📁 css/
│   ├── style.css              ← ⭐ التنسيق العام المشترك
│   └── notifications.css      ← ⭐ أنماط لوحة الإشعارات المشتركة
│
├── 📁 [ATT|FIL|ECL|...]/      ← مجلد كل تقرير
│   ├── [XXX]-script.js        ← منطق الصفحة
│   ├── [XXX]-style.css        ← تنسيق خاص بالصفحة
│   └── [XXX]-camera.js        ← وحدة الكاميرا (إن وُجدت)
│
├── 📁 Google/
│   └── [XXX].gs               ← كود Google Apps Script لكل تقرير
│
├── 📁 BETA/                   ← تقارير في مرحلة التجريب
├── 📁 DEV/                    ← تقارير قيد التطوير
├── 📁 ico/                    ← أيقونات التطبيق
│
├── 📄 manifest.json           ← إعدادات PWA
└── 📄 sw.js                   ← Service Worker (للعمل أوفلاين)
```

---

## 🔑 المفاهيم الأساسية / Core Concepts

### البيانات المشتركة (js/config.js)
ملف مركزي واحد يحتوي على جميع البيانات المشتركة — بيانات الموظفين وأسماء الفروع. أي تعديل على موظف أو فرع يُطبّق تلقائياً على جميع التقارير.

```js
window.QB = {
    employees: { "1001": "اسم الموظف", ... },
    branchEmployees: { "Branch1": [...], "Branch2": [...] },
    branchLabel: { "Branch1": "الاسم العربي", ... }
};
```

### الرسائل المنبثقة (js/common.js)
دالة `window.showModal()` موحّدة تعمل على جميع الصفحات بثلاثة أنواع:

```js
showModal('loading', 'عنوان', 'رسالة');  // حالة تحميل
showModal('success', 'عنوان', 'رسالة');  // نجاح
showModal('error',   'عنوان', 'رسالة');  // خطأ
```

### تدفق البيانات / Data Flow
```
المستخدم يملأ النموذج
        ↓
التحقق من البيانات (JS)
        ↓
إرسال POST → Google Apps Script
        ↓
تسجيل في Google Sheets + إرجاع ID
        ↓
عرض رسالة نجاح مع رقم السجل
```

---

## 🚀 كيفية النشر / Deployment

### 1. الـ Frontend
أي استضافة ثابتة تعمل — GitHub Pages، Netlify، Firebase Hosting، أو حتى مجلد على خادم Apache.

```bash
# مثال: GitHub Pages
git clone 0-bilal.github.io/QB-Sentinel
cd QB-Sentinel
# ارفع المشروع وفعّل GitHub Pages من الإعدادات
```

### 2. الـ Backend (Google Apps Script)
لكل تقرير ملف `.gs` مستقل في مجلد `Google/`:

1. افتح [script.google.com](https://script.google.com)
2. أنشئ مشروعاً جديداً وانسخ محتوى ملف `.gs` المناسب
3. انشر كـ **Web App** (تنفيذ بصلاحية: أنت / وصول: الكل)
4. انسخ رابط الـ Web App والصقه في متغير `SCRIPT_URL` بملف JS المقابل

---

## 🛠️ التخصيص / Customization

### إضافة موظف جديد
في `js/config.js` فقط:
```js
employees: {
    "1812": "اسم الموظف الجديد",  // ← أضف هنا فقط
    ...
}
```

### إضافة فرع جديد
```js
branchLabel: {
    "NewBranch": "اسم الفرع",  // ← أضف هنا
},
branchEmployees: {
    "NewBranch": [             // ← وهنا
        { ar: "موظف", en: "Employee" }
    ]
}
```

### إضافة تقرير جديد
1. أنشئ مجلداً جديداً `[CODE]/`
2. أضف `[CODE]-script.js` و `[CODE]-style.css`
3. أنشئ `[CODE].html` في الجذر
4. اكتب كود Google Apps Script في `Google/[CODE].gs`
5. أضف بطاقة التقرير في `index.html`
6. أضف رقم الإصدار في `js/versions.js`

---

## 🗺️ خارطة طريق التطوير / Roadmap

- [ ] 🔧 إكمال **RSL** — سجل معايير المكونات
- [ ] 🔧 إكمال **PRR** — طلب استرجاع منتجات  
- [ ] 🔶 ترقية **PAL** من BETA إلى مستقر
- [ ] 🔶 ترقية **EDR** من BETA إلى مستقر
- [ ] 🆕 لوحة تحكم إدارية (Dashboard)
- [ ] 🆕 نظام إشعارات Push للمدير
- [ ] 🌐 دعم متعدد اللغات (AR / EN)
- [ ] 📊 تقارير إحصائية وتحليلات

---

## 🤝 المساهمة / Contributing

المشروع مفتوح المصدر وقابل للتعديل والتوسعة. إذا أردت إضافة تقرير جديد أو تحسين موجود:

1. افتح **Issue** لمناقشة الفكرة
2. افتح **Pull Request** مع وصف واضح للتغيير
3. تأكد من اتباع نفس نمط بنية الملفات الموجودة

---

## 📄 الترخيص / License

هذا المشروع مرخص تحت رخصة **MIT** — يمكنك استخدامه وتعديله ونشره بحرية مع الإشارة للمصدر الأصلي.

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute with attribution.
---

<div align="center">

**صُنع من قِبَل [بلال الخواجة](https://github.com/0-bilal) — برمجيات QB**

*Crafted by Bilal Al-Khawaja — QB Software*

</div>
