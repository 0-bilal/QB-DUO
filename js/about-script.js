/**
 * QB-Sentinel — js/about-script.js
 * منطق صفحة "حول النظام"
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ── 1. Lucide Icons ── */
    if (window.lucide) lucide.createIcons();

    /* ── 2. شريط التقدم عند التمرير ── */
    const scrollBar = document.getElementById('scrollProgress');
    if (scrollBar) {
        window.addEventListener('scroll', () => {
            const total = document.documentElement.scrollHeight - window.innerHeight;
            const pct   = total > 0 ? (window.scrollY / total) * 100 : 0;
            scrollBar.style.width = pct + '%';
        }, { passive: true });
    }

    /* ── 3. Intersection Observer — ظهور العناصر عند التمرير ── */
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, i * 60);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08 });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    /* ── 4. عداد الإحصائيات في الـ Hero ── */
    function animateCounter(el, target, duration = 1200) {
        const start = performance.now();
        const update = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutQuart
            const eased = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    // تشغيل العدادات عند رؤية الـ hero stats
    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        const statObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                document.querySelectorAll('[data-count]').forEach(el => {
                    animateCounter(el, parseInt(el.dataset.count));
                });
                statObserver.disconnect();
            }
        }, { threshold: 0.5 });
        statObserver.observe(statsSection);
    }

    /* ── 5. تأثير Ripple على بطاقات التقنيات ── */
    document.querySelectorAll('.tech-card, .platform-row, .report-row').forEach(card => {
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position:absolute;width:60px;height:60px;border-radius:50%;
                background:rgba(198,40,40,0.10);transform:scale(0);
                animation:rippleAnim 0.5s ease-out forwards;
                left:${e.offsetX - 30}px;top:${e.offsetY - 30}px;pointer-events:none;
            `;
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    /* ── 6. إضافة كيفريم الـ ripple ديناميكياً ── */
    if (!document.getElementById('rippleStyle')) {
        const s = document.createElement('style');
        s.id = 'rippleStyle';
        s.textContent = '@keyframes rippleAnim{to{transform:scale(4);opacity:0}}';
        document.head.appendChild(s);
    }

    /* ── 7. تأثير الـ Hero عند التمرير (Parallax خفيف) ── */
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            const offset = window.scrollY;
            if (offset < 400) {
                hero.style.backgroundPositionY = `${offset * 0.3}px`;
            }
        }, { passive: true });
    }

    /* ── 8. تفعيل الأيقونات بعد تحميل Lucide ── */
    setTimeout(() => {
        if (window.lucide) lucide.createIcons();
    }, 300);

});

/* ── نسخ نص الترخيص ── */
function copyLicense(btn) {
    const licenseText = `MIT License\n\nCopyright (c) 2026 Bilal Al-Khawaja\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

    navigator.clipboard.writeText(licenseText).then(() => {
        const span = btn.querySelector('span');
        const icon = btn.querySelector('i');
        span.textContent = 'تم النسخ!';
        icon.setAttribute('data-lucide', 'check');
        btn.classList.add('copied');
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
            span.textContent = 'نسخ الترخيص';
            icon.setAttribute('data-lucide', 'copy');
            btn.classList.remove('copied');
            if (window.lucide) lucide.createIcons();
        }, 2500);
    }).catch(() => {
        /* fallback للمتصفحات القديمة */
        const ta = document.createElement('textarea');
        ta.value = licenseText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    });
}
