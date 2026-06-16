
const CACHE_NAME = 'qb-sentinel-cache-v1.14.2'; // يجب تغييره عند كل تحديث رئيسي

self.addEventListener('install', (e) => {
    self.skipWaiting();
    console.log('SW: Installed');
});

self.addEventListener('fetch', (event) => {
    // التحقق من حالة الاتصال
    if (!navigator.onLine) {
        // إذا كان الطلب لصفحة HTML (تنقل)
        if (event.request.mode === 'navigate') {
            event.respondWith(
                new Response(`
                    <div dir="rtl" style="font-family: sans-serif; text-align: center; padding: 50px; background: #f3f4f6; height: 100vh;">
                        <h1 style="color: #c62828;">عذراً، لا يوجد اتصال بالإنترنت</h1>
                        <p style="color: #666;">يجب أن تكون متصلاً بالإنترنت لتشغيل نظام QB-Sentinel وضمان تحميل أحدث التحديثات.</p>
                        <button onclick="window.location.reload()" style="padding: 12px 25px; background: #c62828; color: #fff; border: none; border-radius: 8px; cursor: pointer;">إعادة المحاولة</button>
                    </div>`, 
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                )
            );
            return;
        }
    }


    // استثناء طلبات Google Apps Script — لا يجوز اعتراضها أو تخزينها
    if (event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});