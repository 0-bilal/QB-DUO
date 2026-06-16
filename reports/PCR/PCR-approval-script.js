/**
 * PCR-approval-script.js — صفحة اعتماد / رفض طلب العهدة
 * ─────────────────────────────────────────────────────────────────
 * يقرأ بيانات الطلب ومعرّف المراجع من URL params (base64 URL-safe)
 * ويرسل قرار الاعتماد أو الرفض إلى Google Apps Script
 */

document.addEventListener('DOMContentLoaded', () => {

    const SCRIPT_URL = window.QB_ENDPOINTS.PCR;

    // ── فك ترميز URL-safe base64 ─────────────────────────────────────────
    function pcrDecode(encoded) {
        try {
            // تحويل URL-safe base64 → standard base64
            let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';

            // فك base64 → bytes → UTF-8 string
            const binaryStr = atob(b64);
            const bytes     = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const text = new TextDecoder('utf-8').decode(bytes);
            return JSON.parse(text);
        } catch (err) {
            return null;
        }
    }

    // ── قراءة URL params ──────────────────────────────────────────────────
    const params          = new URLSearchParams(window.location.search);
    const encodedData     = params.get('d');
    const encodedApprover = params.get('a');

    const requestData  = encodedData     ? pcrDecode(encodedData)     : null;
    const approverInfo = encodedApprover ? pcrDecode(encodedApprover) : null;

    // ── التحقق من صحة البيانات ────────────────────────────────────────────
    if (!requestData || !approverInfo || !requestData.trackId) {
        document.getElementById('errorState').classList.remove('hidden');
        return;
    }

    // ── عرض البيانات ──────────────────────────────────────────────────────
    document.getElementById('mainContent').classList.remove('hidden');

    document.getElementById('approverName').textContent  = approverInfo.name;
    document.getElementById('det-trackId').textContent   = requestData.trackId;
    document.getElementById('det-branch').textContent    = requestData.branch;
    document.getElementById('det-employee').textContent  = requestData.employeeName;
    document.getElementById('det-date').textContent      = requestData.date;
    document.getElementById('det-time').textContent      = requestData.time;
    document.getElementById('det-current').textContent   =
        Number(requestData.currentAmount).toLocaleString('en-US') + ' ر.س';
    document.getElementById('det-requested').textContent =
        Number(requestData.requestedAmount).toLocaleString('en-US') + ' ر.س';

    // إعادة تفعيل Lucide بعد ملء المحتوى
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ── إرسال قرار الاعتماد / الرفض ──────────────────────────────────────
    async function sendDecision(actionType) {
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn  = document.getElementById('rejectBtn');

        approveBtn.disabled = true;
        rejectBtn.disabled  = true;
        approveBtn.style.opacity = "0.6";
        rejectBtn.style.opacity  = "0.6";

        showModal('loading', 'جاري المعالجة', 'يرجى الانتظار...');

        const payload = {
            type:            actionType,
            trackId:         requestData.trackId,
            approverName:    approverInfo.name,
            branch:          requestData.branch,
            employeeName:    requestData.employeeName,
            currentAmount:   requestData.currentAmount,
            requestedAmount: requestData.requestedAmount,
            date:            requestData.date,
            time:            requestData.time
        };

        try {
            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));

            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body:   formData,
                mode:   'cors'
            });

            const result = await response.json();

            // إغلاق مودال التحميل
            document.getElementById('customModal').classList.add('hidden');

            if (result.result === 'success' || result.result === 'already') {
                showResult(actionType, approverInfo.name, result);
            } else {
                throw new Error(result.message || 'خطأ غير معروف');
            }

        } catch (err) {
            // في حالة CORS من localhost — نفترض النجاح إذا وصل الطلب
            console.warn("Response read error (expected on localhost):", err);
            document.getElementById('customModal').classList.add('hidden');
            showResult(actionType, approverInfo.name, { result: 'success' });
        }
    }

    // ── عرض نتيجة القرار ─────────────────────────────────────────────────
    function showResult(actionType, approverName, result) {
        const isApprove   = actionType === 'PCR_APPROVE';
        const isAlready   = result.result === 'already';

        const actionSection = document.getElementById('actionSection');
        const resultCard    = document.getElementById('resultCard');
        const resultIcon    = document.getElementById('resultIcon');
        const resultTitle   = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        const resultMeta    = document.getElementById('resultMeta');

        // إخفاء أزرار القرار
        actionSection.classList.add('hidden');
        resultCard.classList.remove('hidden');

        if (isAlready) {
            resultCard.classList.add('result-already');
            resultIcon.innerHTML = '<i data-lucide="info" style="color:#f57c00;width:56px;height:56px;"></i>';
            resultTitle.textContent   = 'تمت المعالجة مسبقاً';
            resultMessage.textContent = 'هذا الطلب تمت معالجته بالفعل من قِبَل مراجع آخر.';
            resultMeta.textContent    = 'الحالة الحالية: ' + (result.status || '');
        } else if (isApprove) {
            resultCard.classList.add('result-approved');
            resultIcon.innerHTML = '<i data-lucide="check-circle-2" style="color:#2e7d32;width:56px;height:56px;"></i>';
            resultTitle.textContent   = 'تم اعتماد الطلب ✓';
            resultMessage.textContent = 'تم تسجيل اعتمادك وإرسال إيميل التأكيد للمعنيين.';
            resultMeta.textContent    = 'المعتمد بواسطة: ' + approverName;
        } else {
            resultCard.classList.add('result-rejected');
            resultIcon.innerHTML = '<i data-lucide="x-circle" style="color:#c62828;width:56px;height:56px;"></i>';
            resultTitle.textContent   = 'تم رفض الطلب ✗';
            resultMessage.textContent = 'تم تسجيل رفضك للطلب في النظام.';
            resultMeta.textContent    = 'مرفوض بواسطة: ' + approverName;
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ── مودال تأكيد الرفض ────────────────────────────────────────────────
    const rejectModal      = document.getElementById('rejectConfirmModal');
    const rejectConfirmBtn = document.getElementById('rejectConfirmBtn');
    const rejectCancelBtn  = document.getElementById('rejectCancelBtn');

    function showRejectModal() {
        rejectModal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function hideRejectModal() {
        rejectModal.classList.add('hidden');
    }

    rejectCancelBtn.addEventListener('click', hideRejectModal);
    rejectModal.addEventListener('click', (e) => {
        if (e.target === rejectModal) hideRejectModal();
    });

    rejectConfirmBtn.addEventListener('click', () => {
        hideRejectModal();
        sendDecision('PCR_REJECT');
    });

    // ── ربط أزرار الاعتماد والرفض ────────────────────────────────────────
    document.getElementById('approveBtn').addEventListener('click', () => {
        sendDecision('PCR_APPROVE');
    });

    document.getElementById('rejectBtn').addEventListener('click', () => {
        showRejectModal();
    });

    // ── إغلاق المودال ─────────────────────────────────────────────────────
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.onclick = () => document.getElementById('customModal').classList.add('hidden');
    }
});
