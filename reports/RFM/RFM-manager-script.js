// ══════════════════════════════════════════════════════════════════
//  RFM-manager-script.js — صفحة اعتماد المدير
//  QB-Sentinel | برمجيات QB
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // ── عناصر الصفحة ────────────────────────────────────────────
    const loadingState     = document.getElementById('loadingState');
    const errorState       = document.getElementById('errorState');
    const errorMsg         = document.getElementById('errorMsg');
    const mainContent      = document.getElementById('mainContent');
    const trackIdDisplay   = document.getElementById('trackIdDisplay');
    const dateDisplay      = document.getElementById('dateDisplay');
    const branchDisplay    = document.getElementById('branchDisplay');
    const employeeDisplay  = document.getElementById('employeeDisplay');
    const suppliersContainer = document.getElementById('suppliersContainer');
    const pendingActions   = document.getElementById('pendingActions');
    const approveBtn       = document.getElementById('approveBtn');
    const rejectBtn        = document.getElementById('rejectBtn');
    const rejectArea       = document.getElementById('rejectArea');
    const rejectReason     = document.getElementById('rejectReason');
    const confirmRejectBtn = document.getElementById('confirmRejectBtn');
    const approvedState    = document.getElementById('approvedState');
    const rejectedState    = document.getElementById('rejectedState');
    const rejectionReasonDisplay = document.getElementById('rejectionReasonDisplay');

    let orderData = null;

    // ══════════════════════════════════════════════════════════════
    //  فك التشفير
    // ══════════════════════════════════════════════════════════════
    function rfmDecrypt(encStr) {
        const parts = encStr.split(':');
        if (parts.length < 2) throw new Error('bad format');
        const iv  = CryptoJS.enc.Hex.parse(parts[0]);
        const ct  = CryptoJS.enc.Base64.parse(parts.slice(1).join(':'));
        const key = CryptoJS.enc.Hex.parse(window.QB.rfmKey);
        const dec = CryptoJS.AES.decrypt({ ciphertext: ct }, key, {
            iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
        });
        return dec.toString(CryptoJS.enc.Utf8);
    }

    function rfmEncrypt(plaintext) {
        const key = CryptoJS.enc.Hex.parse(window.QB.rfmKey);
        const iv  = CryptoJS.lib.WordArray.random(16);
        const enc = CryptoJS.AES.encrypt(plaintext, key, {
            iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
        });
        return iv.toString(CryptoJS.enc.Hex) + ':' + enc.ciphertext.toString(CryptoJS.enc.Base64);
    }

    // ══════════════════════════════════════════════════════════════
    //  قراءة URL parameter وفك التشفير
    // ══════════════════════════════════════════════════════════════
    function loadOrderData() {
        try {
            const params = new URLSearchParams(window.location.search);
            const enc    = params.get('d');
            if (!enc) throw new Error('no_data');
            const decrypted = rfmDecrypt(decodeURIComponent(enc));
            orderData = JSON.parse(decrypted);
            renderOrder(orderData);
        } catch (e) {
            showError('تعذّر فك تشفير بيانات الطلب. تأكد من صحة الرابط.');
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  عرض بيانات الطلب
    // ══════════════════════════════════════════════════════════════
    function renderOrder(d) {
        loadingState.classList.add('hidden');
        mainContent.classList.remove('hidden');

        trackIdDisplay.textContent  = d.trackId || '—';
        dateDisplay.textContent     = (d.date || '') + (d.time ? '  —  ' + d.time : '');
        branchDisplay.textContent   = d.branch || '—';
        employeeDisplay.textContent = d.employeeName || '—';

        // عرض الموردين والمواد
        suppliersContainer.innerHTML = '';
        const groups = d.supplierGroups || [];
        const totalItems = groups.reduce((s,g) => s + g.items.length, 0);

        // عداد إجمالي
        const totalBadge = document.createElement('div');
        totalBadge.style.cssText = 'margin-bottom:12px;font-size:13px;color:var(--text-light);';
        totalBadge.textContent = groups.length + ' مورد — ' + totalItems + ' مادة';
        suppliersContainer.appendChild(totalBadge);

        groups.forEach((group, idx) => {
            const section = document.createElement('div');
            section.className = 'supplier-section';

            let itemsHtml = '';
            group.items.forEach(it => {
                itemsHtml += `
                    <div class="item-row">
                        <div class="item-name-ar">${it.nameAR}</div>
                        <div class="item-quantities">
                            <span class="qty-badge-current">الحالي: ${it.currentQty} ${it.currentUnitAR}</span>
                            <span class="qty-badge-requested">المطلوب: ${it.requestedQty} ${it.requestUnitAR}</span>
                        </div>
                    </div>`;
            });

            section.innerHTML = `
                <div class="supplier-header">
                    ${groups.length > 1 ? `<span class="supplier-num">${idx+1}</span>` : ''}
                    <span>${group.supplierName}</span>
                    <span class="supplier-count">${group.items.length} مادة</span>
                </div>
                <div class="supplier-items">${itemsHtml}</div>`;
            suppliersContainer.appendChild(section);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ══════════════════════════════════════════════════════════════
    //  الاعتماد
    // ══════════════════════════════════════════════════════════════
    approveBtn.addEventListener('click', async () => {
        if (!orderData) return;
        window.showModal('loading', 'جارٍ إرسال الاعتماد...', 'يرجى الانتظار');

        const payload = {
            type: 'RFM_MANAGER_APPROVE',
            trackId:       orderData.trackId,
            branch:        orderData.branch,
            branchEn:      orderData.branchEn,
            employeeName:  orderData.employeeName,
            supplierGroups: orderData.supplierGroups
        };

        try {
            const resp = await postToGas(payload);
            document.getElementById('customModal').classList.add('hidden');
            pendingActions.classList.add('hidden');
            approvedState.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (e) {
            window.showModal('error', 'خطأ', 'تعذّر إرسال القرار، حاول مرة أخرى');
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  إظهار منطقة الرفض
    // ══════════════════════════════════════════════════════════════
    rejectBtn.addEventListener('click', () => {
        rejectArea.style.display = 'block';
        rejectBtn.style.display  = 'none';
        rejectReason.focus();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    // ══════════════════════════════════════════════════════════════
    //  تأكيد الرفض
    // ══════════════════════════════════════════════════════════════
    confirmRejectBtn.addEventListener('click', async () => {
        if (!orderData) return;
        const reason = rejectReason.value.trim();
        if (!reason) {
            rejectReason.style.borderColor = '#c62828';
            rejectReason.focus();
            return;
        }
        window.showModal('loading', 'جارٍ إرسال الرفض...', 'يرجى الانتظار');

        const payload = {
            type: 'RFM_MANAGER_REJECT',
            trackId:      orderData.trackId,
            branch:       orderData.branch,
            employeeName: orderData.employeeName,
            reason
        };

        try {
            await postToGas(payload);
            document.getElementById('customModal').classList.add('hidden');
            pendingActions.classList.add('hidden');
            rejectedState.classList.remove('hidden');
            rejectionReasonDisplay.textContent = 'السبب: ' + reason;
        } catch (e) {
            window.showModal('error', 'خطأ', 'تعذّر إرسال القرار، حاول مرة أخرى');
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  إرسال لـ Apps Script
    // ══════════════════════════════════════════════════════════════
    async function postToGas(payload) {
        const encPayload = rfmEncrypt(JSON.stringify(payload));
        const endpoint   = window.QB_ENDPOINTS.RFM;
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'payload=' + encodeURIComponent(encPayload),
            redirect: 'follow'
        });
        let result = { result: 'success' };
        try {
            const text = await resp.text();
            if (text.trim().startsWith('{')) result = JSON.parse(text);
        } catch (_) {}
        if (result.result === 'error') throw new Error(result.message);
        return result;
    }

    function showError(msg) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMsg.textContent = msg;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── تشغيل ────────────────────────────────────────────────────
    loadOrderData();
});
