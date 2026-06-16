const FILNotifications = (() => {

    const SCRIPT_URL = window.QB_ENDPOINTS.FIL;

    let notifications = [];
    let panelOpen     = false;
    let isLoading     = false;

    const btn = document.getElementById('notificationsBtn');
    const dot = btn?.querySelector('.notification-dot');

    // ── بناء اللوحة ──────────────────────────────────────────────────────────
    function buildPanel() {
        if (document.getElementById('notifPanel')) return;

        const panel = document.createElement('div');
        panel.id        = 'notifPanel';
        panel.className = 'notif-panel hidden';
        panel.innerHTML = `
            <div class="notif-header">
                <div class="notif-header-title">
                    <i data-lucide="bell" class="notif-header-icon"></i>
                    <span>الإشعارات</span>
                    <small>Notifications</small>
                </div>
                <button class="notif-close-btn" id="notifCloseBtn" title="إغلاق">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="notif-sync-bar" id="notifSyncBar">
                <div class="notif-sync-spinner"></div>
                <span>جاري مزامنة جداول الفحص...</span>
            </div>
            <div class="notif-body" id="notifBody">
                <div class="notif-empty">
                    <i data-lucide="check-circle-2" class="notif-empty-icon"></i>
                    <p>لا توجد إشعارات حالياً</p>
                    <small>No pending inspections</small>
                </div>
            </div>
            <div class="notif-footer">
                <button class="notif-refresh-btn" id="notifRefreshBtn">
                    <i data-lucide="refresh-cw"></i>
                    <span>تحديث</span>
                </button>
                <span class="notif-last-update" id="notifLastUpdate"></span>
            </div>
        `;

        document.body.appendChild(panel);
        document.getElementById('notifCloseBtn').addEventListener('click', closePanel);
        document.getElementById('notifRefreshBtn').addEventListener('click', () => fetchNotifications(true));
        lucide.createIcons();
    }

    // ── موضع اللوحة ──────────────────────────────────────────────────────────
    function positionPanel() {
        if (!btn) return;
        const panel = document.getElementById('notifPanel');
        if (!panel) return;

        const rect    = btn.getBoundingClientRect();
        const vpWidth = window.innerWidth;
        const panelW  = 310;

        panel.style.top = (rect.bottom + 10) + 'px';

        let leftPos = rect.left;
        if (leftPos + panelW > vpWidth - 12) leftPos = vpWidth - panelW - 12;
        if (leftPos < 12) leftPos = 12;

        panel.style.left  = leftPos + 'px';
        panel.style.right = 'auto';
    }

    // ── فتح / إغلاق ──────────────────────────────────────────────────────────
    function togglePanel() { panelOpen ? closePanel() : openPanel(); }

    function openPanel() {
        const panel = document.getElementById('notifPanel');
        if (!panel) return;
        positionPanel();
        panel.classList.remove('hidden');
        panel.classList.add('notif-panel-visible');
        panelOpen = true;
        btn?.classList.add('btn-active');
        renderNotifications();
    }

    function closePanel() {
        const panel = document.getElementById('notifPanel');
        if (!panel) return;
        panel.classList.add('notif-panel-hiding');
        btn?.classList.remove('btn-active');
        setTimeout(() => {
            panel.classList.remove('notif-panel-visible', 'notif-panel-hiding');
            panel.classList.add('hidden');
            panelOpen = false;
        }, 250);
    }

    // ── جلب البيانات ──────────────────────────────────────────────────────────
    async function fetchNotifications(showSync = false) {
        if (isLoading) return;
        isLoading = true;

        const syncBar = document.getElementById('notifSyncBar');
        if (showSync && syncBar) syncBar.classList.add('notif-sync-visible');
        dot?.classList.remove('dot-active');
        btn?.classList.add('btn-loading');

        try {
            const res  = await fetch(`${SCRIPT_URL}?action=getSchedule`);
            const data = await res.json();

            if (data.result === 'success' && Array.isArray(data.schedule)) {
                notifications = data.schedule.map(row => ({
                    branch:   row[0] || '—',
                    lastDate: row[1] || '—',   // yyyy-MM-dd
                    lastTime: row[2] || '—',   // HH:mm أو HH:mm:ss
                    nextTime: row[3] || '—'    // HH:mm أو HH:mm:ss
                }));

                console.log('[FIL-Notif] بيانات مستلمة:', JSON.stringify(notifications));

                updateDot();
                if (panelOpen) renderNotifications();
            }
        } catch (err) {
            console.warn('[FIL-Notif] خطأ في الجلب:', err);
        } finally {
            isLoading = false;
            if (syncBar) syncBar.classList.remove('notif-sync-visible');
            btn?.classList.remove('btn-loading');

            const el = document.getElementById('notifLastUpdate');
            if (el) {
                const t = new Date();
                el.textContent = `آخر تحديث: ${t.toLocaleTimeString('er-SA', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }
    }

    function updateDot() {
        if (!dot) return;
        dot.classList.toggle('dot-active', notifications.length > 0);
    }

    function parseTime24(str) {
        if (!str || str === '—') return null;
        let s = str.toString().trim().toUpperCase();

        const isPM = s.includes('PM') || s.includes('م');
        const isAM = s.includes('AM') || s.includes('ص');

        s = s.replace(/[^\d:]/g, '');

        const parts = s.split(':');
        if (parts.length < 2) return null;

        let hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);

        if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;

        if (isPM || isAM) {
            if (isPM && hours < 12) hours += 12;
            if (isAM && hours === 12) hours = 0;
        }

        if (hours < 0 || hours > 23) return null;

        return { h24: hours, min: minutes };
    }

    /**
     * formatTime — تحويل "HH:mm" أو "HH:mm:ss" → "H:mm ص/م"
     */
    function formatTime(val) {
        if (!val || val === '—') return '—';

        const t = parseTime24(val);
        if (!t) return val.toString();

        const { h24, min } = t;
        const suffix = h24 >= 12 ? 'م' : 'ص';
        const h12    = h24 % 12 || 12; 
        const mm     = String(min).padStart(2, '0');

        return `${h12}:${mm} ${suffix}`;
    }

    // ── رسم الإشعارات الموحدة بدون تصنيفات ──────────────────────────────────────
    function renderNotifications() {
        const body = document.getElementById('notifBody');
        if (!body) return;

        if (notifications.length === 0) {
            body.innerHTML = `
                <div class="notif-empty">
                    <i data-lucide="check-circle-2" class="notif-empty-icon"></i>
                    <p>لا توجد إشعارات حالياً</p>
                    <small>No pending inspections</small>
                </div>`;
            lucide.createIcons();
            return;
        }

        body.innerHTML = notifications.map((n, i) => {
            return `
            <div class="notif-item" style="animation-delay:${i * 55}ms; border-right: 4px solid #6c757d;">
                <div class="notif-item-icon" style="background-color: #f8f9fa; color: #495057;">
                    <i data-lucide="calendar-clock"></i>
                </div>
                <div class="notif-item-body">
                    <div class="notif-item-branch" style="font-weight: bold; color: #212529; margin-bottom: 6px;">
                        <i data-lucide="map-pin" class="notif-branch-pin"></i>
                        ${n.branch}
                    </div>
                    <div class="notif-item-detail">
                        <i data-lucide="calendar" class="notif-row-icon"></i>
                        <span class="notif-label">تاريخ آخر فحص:</span>
                        <span class="notif-val">${formatDate(n.lastDate)}</span>
                    </div>
                    <div class="notif-item-detail">
                        <i data-lucide="clock" class="notif-row-icon"></i>
                        <span class="notif-label">وقت آخر فحص:</span>
                        <span class="notif-val">${formatTime(n.lastTime)}</span>
                    </div>
                    <div class="notif-item-next" style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #eee;">
                        <i data-lucide="alarm-clock" class="notif-row-icon" style="color: #198754;"></i>
                        <span class="notif-label" style="font-weight: bold;">الفحص القادم:</span>
                        <span class="notif-time" style="color: #198754; font-weight: bold;">${formatTime(n.nextTime)}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        lucide.createIcons();
    }

    function formatDate(val) {
        if (!val || val === '—') return '—';
        const match = val.toString().match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}/${match[2]}/${match[3]}`;
        const d = new Date(val);
        if (!isNaN(d)) {
            return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
        }
        return val.toString();
    }

    // ── التهيئة ──────────────────────────────────────────────────────────────
    function init() {
        buildPanel();

        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel();
        });

        document.addEventListener('click', (e) => {
            if (!panelOpen) return;
            const panel = document.getElementById('notifPanel');
            if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
                closePanel();
            }
        });

        window.addEventListener('resize', () => {
            if (panelOpen) positionPanel();
        });

        fetchNotifications(false);
    }

    return { init, refresh: () => fetchNotifications(true) };

})();

document.addEventListener('DOMContentLoaded', () => {
    FILNotifications.init();
});