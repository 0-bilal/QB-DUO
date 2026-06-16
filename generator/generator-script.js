/**
 * QB-Sentinel — generator-script.js v2.0
 * شاشة مولّد QR الخاصة بجهاز الفرع (iPad/Tablet)
 */
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const SCRIPT_URL = window.QB_ENDPOINTS.GENERATOR;

    let currentMode = 'IN';
    let deviceId    = localStorage.getItem('QB_DEVICE_ID');
    let branchName  = localStorage.getItem('QB_BRANCH_NAME');
    let qrTimer     = null;
    let qrInstance  = null;

    const els = {
        setupScreen:   document.getElementById('setupScreen'),
        deviceInput:   document.getElementById('deviceIdInput'),
        saveSetupBtn:  document.getElementById('saveSetupBtn'),
        setupStatus:   document.getElementById('setupStatus'),
        deviceDisplay: document.getElementById('deviceDisplay'),
        timestamp:     document.getElementById('timestamp'),
        selectionView: document.getElementById('selectionView'),
        qrView:        document.getElementById('qrView'),
        qrContainer:   document.getElementById('qrContainer'),
        qrModeBadge:   document.getElementById('qrModeBadge'),
        qrModeIcon:    document.getElementById('qrModeIcon'),
        qrModeLabel:   document.getElementById('qrModeLabel'),
        qrModeSub:     document.getElementById('qrModeSub'),
        timerFill:     document.getElementById('timerFill'),
    };

    // =========================================================
    // التحقق من الجلسة
    // =========================================================
    if (!deviceId || !branchName) {
        els.setupScreen.classList.remove('hidden');
    } else {
        initMainSystem();
    }

    // =========================================================
    // حفظ إعداد الجهاز
    // الخطوة 1: POST (no-cors) → تسجيل في الشيت
    // الخطوة 2: JSONP (doGet)  → جلب اسم الفرع العربي
    // =========================================================
    els.saveSetupBtn.onclick = async () => {
        const input = els.deviceInput.value.trim();
        if (!input) return;

        els.saveSetupBtn.disabled = true;
        setStatus('loading', 'جاري التحقق من الجهاز...');

        try {
            const device = await getDeviceInfo();

            // الخطوة 1: تسجيل الجهاز في الشيت
            await fetch(SCRIPT_URL, {
                method:  'POST',
                mode:    'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action:    'REGISTER_DEVICE',
                    deviceId:  input,
                    ip:        device.ip,
                    location:  device.loc,
                    userAgent: navigator.userAgent,
                    screenRes: `${screen.width}x${screen.height}`,
                }),
            });

            // الخطوة 2: جلب اسم الفرع عبر JSONP
            const branchAr = await fetchBranchViaJsonp(SCRIPT_URL, input);

            // حفظ البيانات
            localStorage.setItem('QB_DEVICE_ID',   input);
            localStorage.setItem('QB_BRANCH_NAME', branchAr);

            setStatus('success', `✅ تم التسجيل — ${branchAr}`);

            setTimeout(() => {
                deviceId   = input;
                branchName = branchAr;
                els.setupScreen.classList.add('hidden');
                initMainSystem();
            }, 1200);

        } catch (err) {
            console.error(err);
            setStatus('error', '⚠️ تعذر الاتصال. تحقق من الاتصال وأعد المحاولة.');
            els.saveSetupBtn.disabled = false;
        }
    };

    // =========================================================
    // جلب اسم الفرع عبر JSONP
    // =========================================================
    function fetchBranchViaJsonp(url, dId) {
        return new Promise((resolve) => {
            const cbName = 'QB_CB_' + Date.now();
            let script;

            const timer = setTimeout(() => {
                cleanup();
                resolve(localBranchName(dId));
            }, 8000);

            window[cbName] = (data) => {
                clearTimeout(timer);
                cleanup();
                resolve(data?.branchAr || localBranchName(dId));
            };

            function cleanup() {
                delete window[cbName];
                script?.remove();
            }

            script     = document.createElement('script');
            script.src = `${url}?action=GET_BRANCH_NAME&deviceId=${encodeURIComponent(dId)}&callback=${cbName}`;
            script.onerror = () => { clearTimeout(timer); cleanup(); resolve(localBranchName(dId)); };
            document.head.appendChild(script);
        });
    }

    // قاموس احتياطي محلي
    function localBranchName(id) {
        const m = {
            Muzahmiyah: 'المزاحمية', muzahmiyah: 'المزاحمية',
            Dawadimi:   'الدوادمي',  dawadimi:   'الدوادمي',
        };
        return m[id] || id;
    }

    function setStatus(type, msg) {
        if (!els.setupStatus) return;
        els.setupStatus.className   = 'setup-status ' + type;
        els.setupStatus.innerText   = msg;
        els.setupStatus.classList.remove('hidden');
    }

    // =========================================================
    // تشغيل النظام الرئيسي
    // =========================================================
    function initMainSystem() {
        els.deviceDisplay.innerText = `فرع: ${branchName}`;
        updateTime();
        setInterval(updateTime, 1000);
    }

    function updateTime() {
        els.timestamp.innerText = new Date().toLocaleTimeString('en-EN', { hour12: false });
    }

    // =========================================================
    // تفعيل الوضع (حضور / انصراف)
    // =========================================================
    window.activateMode = function(mode) {
        currentMode = mode;
        const isIn  = mode === 'IN';

        els.qrModeBadge.className = 'qr-mode-badge ' + (isIn ? 'in-mode' : 'out-mode');
        els.qrModeIcon.setAttribute('data-lucide', isIn ? 'log-in' : 'log-out');
        els.qrModeLabel.innerText = isIn ? 'تسجيل حضور'  : 'تسجيل انصراف';
        els.qrModeSub.innerText   = isIn ? 'Check-In'     : 'Check-Out';

        const qrCard = els.qrView.querySelector('.qr-card');
        if (qrCard) qrCard.className = 'qr-card ' + (isIn ? 'in-mode' : 'out-mode');
        if (els.timerFill) els.timerFill.classList.toggle('in-mode', isIn);

        lucide.createIcons();

        els.selectionView.style.animation = 'fadeSlideDown 0.3s ease forwards';
        setTimeout(() => {
            els.selectionView.classList.add('hidden');
            els.selectionView.style.animation = '';
            generateQR();
            els.qrView.classList.remove('hidden');
            els.qrView.style.animation = 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
        }, 280);
    };

    // =========================================================
    // العودة لشاشة الاختيار
    // =========================================================
    window.goBack = function() {
        clearInterval(qrTimer);
        qrTimer = null;

        els.qrView.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            els.qrView.classList.add('hidden');
            els.qrView.style.animation = '';
            els.selectionView.classList.remove('hidden');
            els.selectionView.style.animation = 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
        }, 280);
    };

    // =========================================================
    // توليد QR
    // =========================================================
    function generateQR() {
        els.qrContainer.innerHTML = '';
        qrInstance = new QRCode(els.qrContainer, {
            width: 256, height: 256,
            correctLevel: QRCode.CorrectLevel.H,
        });
        updateQR();
        clearInterval(qrTimer);
        qrTimer = setInterval(updateQR, 30000);
    }

    function updateQR() {
        if (!qrInstance) return;
        const raw     = `${deviceId}|${currentMode}|${Date.now()}`;
        const encoded = btoa(raw);
        qrInstance.clear();
        qrInstance.makeCode(encoded);
        animateTimer();
    }

    function animateTimer() {
        const fill = els.timerFill;
        if (!fill) return;
        fill.style.transition = 'none';
        fill.style.width      = '100%';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            fill.style.transition = 'width 30s linear';
            fill.style.width      = '0%';
        }));
    }

    // =========================================================
    // جلب معلومات الجهاز
    // =========================================================
    async function getDeviceInfo() {
        const info = { ip: "0.0.0.0", loc: "Denied" };
        try {
            info.ip = (await (await fetch('https://api.ipify.org?format=json')).json()).ip;
        } catch (_) {}
        try {
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
            info.loc = `${pos.coords.latitude},${pos.coords.longitude}`;
        } catch (_) {}
        return info;
    }

});