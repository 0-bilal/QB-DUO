/**
 * ATT-script.js — تسجيل الحضور والانصراف
 * يستخدم:
 *   · QB.branchEmployees  (من js/config.js)
 *   · QB.branchLabel      (من js/config.js)
 *   · window.showModal()  (من js/common.js)
 */
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    const SCRIPT_URL = window.QB_ENDPOINTS.ATT;

    // ─── الحالة ────────────────────────────────────────────────
    let selectedEmployee  = localStorage.getItem('qb_staff_name')   || "";
    let selectedBranchAr  = localStorage.getItem('qb_staff_branch') || "";
    let html5QrCode       = null;
    let employeeReady     = false;
    let deviceFingerprint = "";

    // ─── العناصر ───────────────────────────────────────────────
    const els = {
        branchCard:        document.getElementById('branchCard'),
        employeeCard:      document.getElementById('employeeCard'),
        empGrid:           document.getElementById('employeeGrid'),
        scannerCard:       document.getElementById('scannerCard'),
        scannerIdle:       document.getElementById('scannerIdle'),
        scannerPermission: document.getElementById('scannerPermission'),
        scannerSection:    document.getElementById('scannerSection'),
        savedInfo:         document.getElementById('savedInfo'),
        displayUser:       document.getElementById('displayUser'),
        displayBranch:     document.getElementById('displayBranch'),
        fpBadge:           document.getElementById('fpBadge'),
        resetBtn:          document.getElementById('resetBtn'),
        retryCamera:       document.getElementById('retryCamera'),
        modalClose:        document.getElementById('modalClose'),
        resetModal:        document.getElementById('resetModal'),
        resetCodeInput:    document.getElementById('resetCodeInput'),
        confirmReset:      document.getElementById('confirmReset'),
        cancelReset:       document.getElementById('cancelReset'),
    };

    // ── إغلاق المودال ────────────────────────────────────────────
    if (els.modalClose) {
        els.modalClose.onclick = () => document.getElementById('customModal').classList.add('hidden');
    }

    // =========================================================
    // 1. تهيئة FingerprintJS
    // =========================================================
    async function initFingerprint() {
        try {
            const fp     = await FingerprintJS.load();
            const result = await fp.get();
            deviceFingerprint = result.visitorId;
            console.log("✅ FP ready:", deviceFingerprint.substring(0, 8) + "...");

            if (els.fpBadge) {
                els.fpBadge.innerText  = "🔐 " + deviceFingerprint.substring(0, 6).toUpperCase();
                els.fpBadge.title      = "بصمة الجهاز (FingerprintJS)";
                els.fpBadge.classList.remove('hidden');
            }
        } catch (err) {
            console.warn("FingerprintJS error:", err);
            deviceFingerprint = fallbackFingerprint();
        }
    }

    function fallbackFingerprint() {
        const raw = [
            navigator.userAgent,
            navigator.language,
            screen.width + "x" + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 0,
            navigator.deviceMemory        || 0,
        ].join("|");
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }

    await initFingerprint();

    // =========================================================
    // 2. حالات الماسح
    // =========================================================
    function showScannerIdle() {
        els.scannerIdle.classList.remove('hidden');
        els.scannerPermission.classList.add('hidden');
        els.scannerSection.classList.add('hidden');
    }
    function showScannerPermission() {
        els.scannerIdle.classList.add('hidden');
        els.scannerPermission.classList.remove('hidden');
        els.scannerSection.classList.add('hidden');
    }
    function showScannerActive() {
        els.scannerIdle.classList.add('hidden');
        els.scannerPermission.classList.add('hidden');
        els.scannerSection.classList.remove('hidden');
    }

    // =========================================================
    // 3. التحقق من الجلسة المحفوظة
    // =========================================================
    function checkSavedSession() {
        if (selectedEmployee && selectedBranchAr) {
            els.branchCard.classList.add('hidden');
            els.employeeCard.classList.add('hidden');
            els.savedInfo.classList.remove('hidden');
            els.displayUser.innerText   = selectedEmployee;
            els.displayBranch.innerText = selectedBranchAr;
            employeeReady = true;
            startScanner();
        } else {
            showScannerIdle();
        }
    }

    // =========================================================
    // 4. اختيار الفرع — يستخدم QB.branchEmployees و QB.branchLabel
    // =========================================================
    document.querySelectorAll('input[name="branch"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedBranchAr = QB.branchLabel[e.target.value] || e.target.value;

            els.empGrid.innerHTML = "";
            els.empGrid.classList.remove('employee-placeholder-grid');
            els.empGrid.classList.add('active-grid');

            (QB.branchEmployees[e.target.value] || []).forEach(emp => {
                const btn       = document.createElement('button');
                btn.type        = 'button';
                btn.className   = 'emp-btn';
                btn.innerHTML   = `<i data-lucide="user"></i>${emp.ar} | ${emp.en}`;
                btn.onclick     = () => selectEmployee(emp.ar, btn);
                els.empGrid.appendChild(btn);
            });

            lucide.createIcons();
            employeeReady    = false;
            selectedEmployee = "";

            if (html5QrCode && html5QrCode.getState() > 1) {
                html5QrCode.stop().catch(() => {});
            }
            showScannerIdle();
        });
    });

    // =========================================================
    // 5. اختيار الموظف
    // =========================================================
    function selectEmployee(name, btnEl) {
        selectedEmployee = name;
        document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
        employeeReady = true;
        startScanner();
    }

    // =========================================================
    // 6. تشغيل الماسح
    // =========================================================
    function startScanner() {
        if (!employeeReady) { showScannerIdle(); return; }
        if (html5QrCode && html5QrCode.getState() > 1) {
            html5QrCode.stop().then(initCamera).catch(() => initCamera());
        } else {
            initCamera();
        }
    }

    function initCamera() {
        if (html5QrCode && html5QrCode.getState() === 2) return;
        showScannerActive();
        if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                if (html5QrCode.getState() > 1) html5QrCode.stop().catch(() => {});
                sendAttendance(decodedText);
            }
        ).catch(() => showScannerPermission());
    }

    if (els.retryCamera) {
        els.retryCamera.onclick = () => {
            if (employeeReady) initCamera();
            else showScannerIdle();
        };
    }

    // =========================================================
    // 7. إرسال الحضور
    // =========================================================
    async function sendAttendance(qrData) {
        showModal('loading', 'جاري التحقق...', 'يتم تسجيل والتحقق من هويتك...');

        if (!deviceFingerprint) await initFingerprint();

        let userIP = "Unknown";
        try {
            const res  = await fetch('https://api.ipify.org?format=json');
            const json = await res.json();
            userIP = json.ip;
        } catch (_) {}

        const payload = {
            action:       'ATTENDANCE',
            employeeName: selectedEmployee,
            branch:       selectedBranchAr,
            qrPayload:    qrData,
            ip:           userIP,
            fingerprint:  deviceFingerprint,
        };

        fetch(SCRIPT_URL, {
            method:  'POST',
            mode:    'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify(payload),
        }).then(() => {
            localStorage.setItem('qb_staff_name',   selectedEmployee);
            localStorage.setItem('qb_staff_branch', selectedBranchAr);
            showModal('success', 'تم التسجيل ',
                `شكراً ${selectedEmployee}، تم تسجيل بنجاح.`);
            setTimeout(() => location.reload(), 3000);
        }).catch(() => {
            showModal('error', 'خطأ في الاتصال',
                'تعذر إرسال البيانات، يرجى المحاولة مرة أخرى.');
        });
    }

    // =========================================================
    // 8. إعادة التعيين
    // =========================================================
    if (els.resetBtn) {
        els.resetBtn.onclick = () => {
            els.resetModal.classList.remove('hidden');
            els.resetCodeInput.value = "";
            els.resetCodeInput.focus();
            lucide.createIcons();
        };
    }

    if (els.cancelReset) {
        els.cancelReset.onclick = () => els.resetModal.classList.add('hidden');
    }

    if (els.confirmReset) {
        els.confirmReset.onclick = () => {
            const code = els.resetCodeInput.value.trim();
            if (!code) return;
            els.confirmReset.disabled = true;

            fetch(SCRIPT_URL, {
                method:  'POST',
                mode:    'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body:    JSON.stringify({ action: 'VERIFY_RESET', code }),
            }).then(() => {
                localStorage.removeItem('qb_staff_name');
                localStorage.removeItem('qb_staff_branch');
                location.reload();
            }).catch(() => {
                els.confirmReset.disabled = false;
                alert('تعذر الاتصال .');
            });
        };
    }

    // =========================================================
    // 9. التهيئة
    // =========================================================
    checkSavedSession();
});
