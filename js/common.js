/**
 * QB-Sentinel — js/common.js
 * ─────────────────────────────────────────────────────────────
 * الوظائف المشتركة لجميع صفحات النظام.
 * يُحمَّل بعد config.js وقبل أي سكريبت خاص بالصفحة.
 *
 * يُصدِّر:
 *   · window.showModal(type, title, message) — الرسائل المنبثقة
 *   · window.toggleSection(btn)             — طي/فتح الأقسام
 *   · window.restoreSections()              — استعادة حالة الأقسام
 * ─────────────────────────────────────────────────────────────
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── 1. تفعيل أيقونات Lucide ───────────────────────────────────────────
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // ── 2. نظام الرسائل المنبثقة (Modal) الموحَّد ────────────────────────
    const modal = {
        overlay : document.getElementById('customModal'),
        title   : document.getElementById('modalTitle'),
        message : document.getElementById('modalMessage'),
        icon    : document.getElementById('modalIcon'),
        loader  : document.getElementById('modalLoader'),
        close   : document.getElementById('modalClose'),
        progressContainer: document.getElementById('modalProgressContainer'),
        progressBar: document.getElementById('modalProgressBar')
    };

    /**
     * window.showModal — دالة عالمية لعرض الرسائل المنبثقة
     *
     * @param {'loading'|'success'|'error'} type    نوع الرسالة
     * @param {string}                      title   عنوان الرسالة
     * @param {string}                      message نص الرسالة
     */
    window.showModal = (type, title, message, showProgress = false) => {
        if (!modal.overlay) return;

        modal.overlay.classList.remove('hidden');
        modal.title.innerText   = title;
        modal.message.innerText = message;
        modal.loader.classList.add('hidden');
        modal.close.classList.add('hidden');
        if (modal.progressContainer) modal.progressContainer.classList.add('hidden');
        modal.icon.innerHTML = '';

        if (type === 'loading') {
            if (showProgress) {
                modal.progressContainer.classList.remove('hidden');
                modal.progressBar.style.width = '0%';
            } else {
                modal.loader.classList.remove('hidden');
            }
        } else {
            modal.close.classList.remove('hidden');
            const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
            modal.icon.innerHTML = `<i data-lucide="${iconName}" class="${type}-icon"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    };

    /** تحديث نسبة شريط التقدم */
    window.updateModalProgress = (percent) => {
        if (modal.progressBar) {
            modal.progressBar.style.width = percent + '%';
        }
    };

    // إغلاق المودال عند الضغط على زر "موافق" (السلوك الافتراضي)
    // يمكن لأي صفحة تعديل هذا السلوك بعد تحميل common.js
    if (modal.close) {
        modal.close.onclick = () => modal.overlay.classList.add('hidden');
    }

    // ── 3. زر تحديث النظام (Refresh App) ────────────────────────────────
    const refreshBtn = document.getElementById('refreshApp');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            window.showModal('loading', 'تحديث النظام', 'جارٍ التحديث، يرجى الانتظار...');

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(r => r.unregister());
                });
            }

            setTimeout(() => window.location.reload(true), 1200);
        });
    }

});

// ── 4. طي / فتح الأقسام ────────────────────────────────────────────────
/**
 * window.toggleSection — يُستدعى من onclick في عنصر HTML
 * @param {HTMLElement} btn — زر الهيدر الذي ضُغط عليه
 */
window.toggleSection = function (btn) {
    const group  = btn.closest('.section-group');
    const isOpen = group.classList.contains('open');
    group.classList.toggle('open', !isOpen);

    const sectionKey = group.dataset.section;
    if (sectionKey) {
        localStorage.setItem('section_' + sectionKey, !isOpen ? 'open' : 'closed');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── 5. استعادة حالة الأقسام من localStorage ────────────────────────────
window.restoreSections = function () {
    document.querySelectorAll('.section-group[data-section]').forEach(group => {
        const saved = localStorage.getItem('section_' + group.dataset.section);
        if (saved === 'closed') group.classList.remove('open');
    });
};

document.addEventListener('DOMContentLoaded', window.restoreSections);
