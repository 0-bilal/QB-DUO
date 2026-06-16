
'use strict';



const SHEET_WEBAPP_URL = window.QB_ENDPOINTS.REM;


let currentDate = new Date();
let currentYear  = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();
let reminders    = [];

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                   'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const MONTHS_SHORT = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                      'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const TYPE_LABELS = {
    iqama:    { ar: 'تجديد إقامة',  en: 'Iqama',       cls: 'type-iqama' },
    contract: { ar: 'تجديد عقد',    en: 'Contract',    cls: 'type-contract' },
    health:   { ar: 'شهادة صحية',   en: 'Health Cert.',cls: 'type-health' },
    passport: { ar: 'تجديد جواز',   en: 'Passport',    cls: 'type-passport' },
    other:    { ar: 'أخرى',         en: 'Other',       cls: 'type-other' }
};

/** عرض الفرع بالعربي — يدعم القيم العربية والإنجليزية القديمة */
function translateBranchDisplay(branch) {
    if (!branch) return '';
    if (branch === 'Dawadimi')   return 'الدوادمي';
    if (branch === 'Muzahmiyah') return 'المزاحمية';
    return branch; // مسبقاً بالعربي (من الشيت الجديد)
}

function today() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(str) {
    if (!str) return new Date(NaN);
    // صيغة DD/MM/YYYY (من الشيت الجديد)
    if (str.includes('/')) {
        const [d, m, y] = str.split('/').map(Number);
        return new Date(y, m - 1, d);
    }
    // صيغة YYYY-MM-DD (الصيغة القديمة أو من الواجهة)
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function daysUntil(dateStr) {
    const t   = today();
    const exp = parseDate(dateStr);
    if (isNaN(exp)) return 9999; // تاريخ غير صالح — تجاهله
    return Math.round((exp - t) / 86400000);
}

function getStatus(days) {
    if (days < 0)   return 'expired';
    if (days <= 7)  return 'urgent';
    if (days <= 30) return 'soon';
    return 'normal';
}

function statusLabel(days) {
    if (days < 0)   return { ar: 'منتهي',     cls: 'status-expired' };
    if (days <= 7)  return { ar: `${days} أيام`, cls: 'status-urgent' };
    if (days <= 30) return { ar: `${days} يوم`,  cls: 'status-soon' };
    return { ar: `${days} يوم`, cls: 'status-ok' };
}

function formatDateAr(dateStr) {
    const d = parseDate(dateStr);
    return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}

function remindersOnDate(year, month, day) {
    return reminders.filter(r => {
        const d = parseDate(r.date);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ─────────────────────────────
   📦 Local Storage (cache)
───────────────────────────── */
function loadLocalReminders() {
    try { return JSON.parse(localStorage.getItem('qb_rem_reminders') || '[]'); }
    catch { return []; }
}

function saveLocalReminders() {
    localStorage.setItem('qb_rem_reminders', JSON.stringify(reminders));
}

/* ─────────────────────────────
   🌐 Google Sheets API
   
   ⚠️ CORS Fix:
   Google Apps Script لا يدعم preflight (OPTIONS).
   الحل: GET للقراءة، وإرسال POST كـ FormData بدون
   Content-Type header مخصص لتجنب preflight.
───────────────────────────── */
async function fetchRemindersFromSheet() {
    const res  = await fetch(`${SHEET_WEBAPP_URL}?action=getReminders`);
    const data = await res.json();
    return data.reminders || [];
}

/**
 * إرسال POST عبر FormData — يتجنب preflight تلقائياً
 * لأن Content-Type يصبح multipart/form-data وهو "simple request"
 */
async function postToSheet(payload) {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));

    const res  = await fetch(SHEET_WEBAPP_URL, { method: 'POST', body: form });
    const data = await res.json();
    return data;
}

async function addReminderToSheet(reminder) {
    return postToSheet({ action: 'addReminder', reminder });
}

async function deleteReminderFromSheet(id) {
    return postToSheet({ action: 'deleteReminder', id });
}

async function completeReminderInSheet(id) {
    return postToSheet({ action: 'completeReminder', id });
}

/* ─────────────────────────────
   🎨 Custom Modal System
   (يستبدل alert/confirm بالكامل)
───────────────────────────── */

// Loading overlay
function showLoading(message = 'جاري تحميل البيانات...') {
    let overlay = document.getElementById('rem-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rem-loading-overlay';
        overlay.innerHTML = `
            <div class="rem-loading-box">
                <div class="rem-spinner"></div>
                <p id="rem-loading-msg">${message}</p>
            </div>`;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('rem-loading-msg').textContent = message;
    }
    overlay.classList.add('visible');
}

function hideLoading() {
    const overlay = document.getElementById('rem-loading-overlay');
    if (overlay) overlay.classList.remove('visible');
}

// Toast notification
function showToast(message, type = 'success') {
    const existing = document.querySelector('.rem-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `rem-toast rem-toast-${type}`;

    const icon = type === 'success' ? 'check-circle' :
                 type === 'error'   ? 'x-circle' :
                 type === 'complete'? 'check-check' : 'info';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="rem-toast-icon"></i>
        <span>${message}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        lucide.createIcons();
        toast.classList.add('visible');
    });
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// Confirm dialog (بديل عن browser confirm)
function showConfirm({ title, message, confirmText, cancelText, type = 'danger', onConfirm }) {
    let overlay = document.getElementById('rem-confirm-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'rem-confirm-overlay';
    overlay.innerHTML = `
        <div class="rem-confirm-box">
            <div class="rem-confirm-icon rem-confirm-icon-${type}">
                <i data-lucide="${type === 'danger' ? 'trash-2' : 'check-check'}"></i>
            </div>
            <h3 class="rem-confirm-title">${title}</h3>
            <p class="rem-confirm-message">${message}</p>
            <div class="rem-confirm-actions">
                <button class="rem-confirm-btn rem-confirm-cancel">${cancelText || 'إلغاء'}</button>
                <button class="rem-confirm-btn rem-confirm-ok rem-confirm-ok-${type}">${confirmText || 'تأكيد'}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        lucide.createIcons();
        overlay.classList.add('visible');
    });

    overlay.querySelector('.rem-confirm-cancel').addEventListener('click', () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    });

    overlay.querySelector('.rem-confirm-ok').addEventListener('click', () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
        onConfirm();
    });

    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    });
}

/* ─────────────────────────────
   Stats Bar
───────────────────────────── */
function updateStats() {
    let urgent = 0, soon = 0, ok = 0;
    reminders.forEach(r => {
        const days = daysUntil(r.date);
        const s = getStatus(days);
        if (s === 'urgent' || s === 'expired') urgent++;
        else if (s === 'soon') soon++;
        else ok++;
    });
    document.getElementById('statUrgent').textContent = urgent;
    document.getElementById('statSoon').textContent   = soon;
    document.getElementById('statOk').textContent     = ok;
}

/* ─────────────────────────────
   Calendar
───────────────────────────── */
function renderCalendar() {
    const grid  = document.getElementById('calendarGrid');
    const label = document.getElementById('calMonthYear');
    grid.innerHTML = '';
    label.textContent = `${MONTHS_AR[currentMonth]} ${currentYear}`;

    const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevDays    = new Date(currentYear, currentMonth, 0).getDate();
    const todayObj    = today();

    for (let i = firstDay - 1; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'cal-day other-month';
        cell.innerHTML = `<span>${prevDays - i}</span><div class="day-dots"></div>`;
        grid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell    = document.createElement('div');
        const isToday = (todayObj.getFullYear() === currentYear &&
                         todayObj.getMonth()    === currentMonth &&
                         todayObj.getDate()     === d);
        const dayRems = remindersOnDate(currentYear, currentMonth, d);
        let classes = 'cal-day';
        if (isToday) classes += ' today';
        if (dayRems.length) classes += ' has-reminders';
        cell.className = classes;

        const dotsHtml = buildDots(dayRems, isToday);
        cell.innerHTML = `<span>${d}</span><div class="day-dots">${dotsHtml}</div>`;

        if (dayRems.length > 0 || isToday) {
            cell.addEventListener('click', () => openDetailModal(d, currentMonth, currentYear, dayRems));
        }
        grid.appendChild(cell);
    }

    const totalCells = firstDay + daysInMonth;
    const remainder  = totalCells % 7;
    if (remainder !== 0) {
        for (let d = 1; d <= (7 - remainder); d++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day other-month';
            cell.innerHTML = `<span>${d}</span><div class="day-dots"></div>`;
            grid.appendChild(cell);
        }
    }
}

function buildDots(rems, isToday) {
    const sorted = [...rems].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    return sorted.slice(0, 3).map(r => {
        const s   = getStatus(daysUntil(r.date));
        const cls = (s === 'expired' || s === 'urgent') ? 'dot-urgent' :
                     s === 'soon' ? 'dot-soon' : 'dot-normal';
        return `<span class="dot ${cls}"></span>`;
    }).join('');
}

/* ─────────────────────────────
   Detail Modal
───────────────────────────── */
function openDetailModal(day, month, year, rems) {
    const modal = document.getElementById('reminderDetailModal');
    document.getElementById('detailDay').textContent   = day;
    document.getElementById('detailMonth').textContent = MONTHS_SHORT[month];

    const count = rems.length;
    document.getElementById('detailTitle').textContent =
        count ? `${count} تذكير${count > 1 ? 'ات' : ''}` : 'لا توجد تذكيرات';
    document.getElementById('detailSubtitle').textContent = `${day} ${MONTHS_AR[month]} ${year}`;

    const list = document.getElementById('reminderList');

    if (count === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-x"></i>
                <p>لا توجد تذكيرات في هذا اليوم</p>
            </div>`;
    } else {
        list.innerHTML = rems.map(r => {
            const days     = daysUntil(r.date);
            const status   = getStatus(days);
            const typeInfo = TYPE_LABELS[r.type] || TYPE_LABELS.other;
            const sl       = statusLabel(days);
            return `
            <div class="reminder-detail-item ${status}">
                <h4>${r.name}</h4>
                <div class="rem-meta">
                    <span class="rem-tag ${typeInfo.cls}">${typeInfo.ar}</span>
                    <span class="rem-tag">${translateBranchDisplay(r.branch)}</span>
                    <span class="upcoming-status ${sl.cls}">${days < 0 ? 'منتهي' : sl.ar}</span>
                </div>
                ${r.notes ? `<p class="rem-notes">${r.notes}</p>` : ''}
            </div>`;
        }).join('');
    }

    modal.classList.remove('hidden');
    requestAnimationFrame(() => lucide.createIcons());
}

/* ─────────────────────────────
   Upcoming List
───────────────────────────── */
function renderUpcoming() {
    const list = document.getElementById('upcomingList');

    if (reminders.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="bell-off"></i>
                <p>لا توجد تذكيرات. أضف تذكيراً جديداً أدناه.</p>
            </div>`;
        requestAnimationFrame(() => lucide.createIcons());
        return;
    }

    const sorted = [...reminders].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

    list.innerHTML = sorted.map(r => {
        const days     = daysUntil(r.date);
        const status   = getStatus(days);
        const sl       = statusLabel(days);
        const typeInfo = TYPE_LABELS[r.type] || TYPE_LABELS.other;
        const d        = parseDate(r.date);
        const validDate = d && !isNaN(d.getTime());
        const badgeCls = status === 'expired' ? 'badge-expired' :
                         status === 'urgent'  ? 'badge-urgent'  :
                         status === 'soon'    ? 'badge-soon'    : 'badge-normal';

        return `
        <div class="upcoming-item" data-id="${r.id}">
            <div class="upcoming-badge ${badgeCls}">
                <span>${validDate ? d.getDate() : '—'}</span>
                <small>${validDate ? MONTHS_SHORT[d.getMonth()] : '—'}</small>
            </div>
            <div class="upcoming-info">
                <h4>${r.name}</h4>
                <p>${typeInfo.ar} · ${translateBranchDisplay(r.branch)}</p>
                ${r.notes ? `<p style="font-size:11px;color:#9ca3af;">${r.notes}</p>` : ''}
            </div>
            <span class="upcoming-status ${sl.cls}">${days < 0 ? 'منتهي' : sl.ar}</span>

            <!--  زر إتمام -->
            <button class="upcoming-complete" onclick="completeReminder('${r.id}', event)" title="تم الإتمام">
                <i data-lucide="check-check"></i>
            </button>

            <!--  زر حذف -->
            <button class="upcoming-delete" onclick="deleteReminder('${r.id}', event)" title="حذف">
                <i data-lucide="trash-2"></i>
            </button>
        </div>`;
    }).join('');

    requestAnimationFrame(() => lucide.createIcons());
}

/* ─────────────────────────────
   ✅ Complete Reminder
───────────────────────────── */
function completeReminder(id, event) {
    event.stopPropagation();
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    showConfirm({
        title: 'تأكيد الإتمام',
        message: `هل تم إتمام تجديد "${reminder.name}"؟\nسيتم تسجيله كمُتمَّم في السجلات.`,
        confirmText: ' نعم، تم الإتمام',
        cancelText: 'إلغاء',
        type: 'complete',
        onConfirm: async () => {
            showLoading('جاري تسجيل الإتمام...');
            try {
                await completeReminderInSheet(id);
                reminders = reminders.filter(r => r.id !== id);
                saveLocalReminders();
                hideLoading();
                showToast(` تم تسجيل إتمام تجديد "${reminder.name}" بنجاح`, 'complete');
                refresh();
            } catch (err) {
                hideLoading();
                showToast('حدث خطأ في الاتصال بالخادم. تحقق من الإنترنت.', 'error');
                console.error(err);
            }
        }
    });
}

/* ─────────────────────────────
   🗑️ Delete Reminder
───────────────────────────── */
function deleteReminder(id, event) {
    event.stopPropagation();
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    showConfirm({
        title: 'تأكيد الحذف',
        message: `هل تريد حذف تذكير "${reminder.name}"؟\nلا يمكن التراجع عن هذا الإجراء.`,
        confirmText: ' نعم، احذف',
        cancelText: 'إلغاء',
        type: 'danger',
        onConfirm: async () => {
            showLoading('جاري حذف التذكير...');
            try {
                await deleteReminderFromSheet(id);
                reminders = reminders.filter(r => r.id !== id);
                saveLocalReminders();
                hideLoading();
                showToast(`تم حذف تذكير "${reminder.name}"`, 'success');
                refresh();
            } catch (err) {
                hideLoading();
                showToast('حدث خطأ في الاتصال . تحقق من الإنترنت.', 'error');
                console.error(err);
            }
        }
    });
}

/* ─────────────────────────────
   ➕ Add Reminder
───────────────────────────── */
function openAddModal() {
    document.getElementById('addReminderModal').classList.remove('hidden');
    const d   = today();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('remDate').value =
        `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function saveNewReminder() {
    const name   = document.getElementById('remEmployeeName').value.trim();
    const type   = document.getElementById('remType').value;
    const date   = document.getElementById('remDate').value;
    const branch = document.getElementById('remBranch').value;
    const notes  = document.getElementById('remNotes').value.trim();

    if (!name || !type || !date) {
        showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
        return;
    }

    const reminder = { id: generateId(), name, type, date, branch, notes };

    document.getElementById('addReminderModal').classList.add('hidden');
    showLoading('جاري حفظ التذكير...');

    try {
        await addReminderToSheet(reminder);
        reminders.push(reminder);
        saveLocalReminders();

        // Reset form
        document.getElementById('remEmployeeName').value = '';
        document.getElementById('remType').value         = '';
        document.getElementById('remNotes').value        = '';

        hideLoading();
        showToast(` تم إضافة تذكير "${name}" بنجاح`, 'success');
        refresh();
    } catch (err) {
        hideLoading();
        showToast('حدث خطأ في الحفظ. سيتم الحفظ محلياً فقط.', 'error');
        // Fallback: save locally only
        reminders.push(reminder);
        saveLocalReminders();
        refresh();
        console.error(err);
    }
}

/* ─────────────────────────────
   🔄 Full Refresh
───────────────────────────── */
function refresh() {
    updateStats();
    renderCalendar();
    renderUpcoming();
}

/* ─────────────────────────────
   🚀 Init — Load from Google Sheets
───────────────────────────── */
async function initApp() {
    showLoading('جاري تحميل البيانات...');

    // Show cached data instantly while loading
    reminders = loadLocalReminders();
    refresh();

    try {
        const sheetReminders = await fetchRemindersFromSheet();
        reminders = sheetReminders;
        saveLocalReminders();
        hideLoading();
        refresh();
    } catch (err) {
        hideLoading();
        // Already showing local cache, just notify
        if (reminders.length > 0) {
            showToast('تعذّر الاتصال. يتم عرض البيانات المحفوظة محلياً.', 'error');
        } else {
            showToast('تعذّر تحقق من الإنترنت.', 'error');
        }
        console.error('Sheet fetch error:', err);
    }
}

/* ─────────────────────────────
   Event Listeners
───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    });

    document.getElementById('detailClose').addEventListener('click', () => {
        document.getElementById('reminderDetailModal').classList.add('hidden');
    });

    document.getElementById('reminderDetailModal').addEventListener('click', function(e) {
        if (e.target === this) this.classList.add('hidden');
    });

    document.getElementById('openAddModal').addEventListener('click', openAddModal);
    document.getElementById('saveReminder').addEventListener('click', saveNewReminder);

    document.getElementById('addClose').addEventListener('click', () => {
        document.getElementById('addReminderModal').classList.add('hidden');
    });

    document.getElementById('addReminderModal').addEventListener('click', function(e) {
        if (e.target === this) this.classList.add('hidden');
    });

    const refreshBtn = document.getElementById('refreshApp');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            if (icon) icon.style.animation = 'spin 0.8s linear infinite';
            showLoading('جاري تحديث البيانات...');
            try {
                const sheetReminders = await fetchRemindersFromSheet();
                reminders = sheetReminders;
                saveLocalReminders();
                hideLoading();
                showToast('تم تحديث البيانات بنجاح', 'success');
                refresh();
            } catch (err) {
                hideLoading();
                showToast('تعذّر التحديث. تحقق من الإنترنت.', 'error');
            }
            if (icon) icon.style.animation = '';
        });
    }

    initApp();
});