// ══════════════════════════════════════════════════════════════════
//  RFM-supplier-script.js — صفحة المورد
//  QB-Sentinel | برمجيات QB
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    const loadingState   = document.getElementById('loadingState');
    const mainContent    = document.getElementById('mainContent');
    const errorState     = document.getElementById('errorState');
    const errorMsg       = document.getElementById('errorMsg');
    const pendingActions = document.getElementById('pendingActions');
    const approveBtn     = document.getElementById('approveBtn');
    const rejectBtn      = document.getElementById('rejectBtn');
    const rejectArea     = document.getElementById('rejectArea');
    const rejectReason   = document.getElementById('rejectReason');
    const confirmRejectBtn = document.getElementById('confirmRejectBtn');
    const uploadSection  = document.getElementById('uploadSection');
    const cameraBtn      = document.getElementById('cameraBtn');
    const galleryInput   = document.getElementById('galleryInput');
    const photoPreview   = document.getElementById('photoPreview');
    const photoPreviewImg= document.getElementById('photoPreviewImg');
    const retakeBtn      = document.getElementById('retakeBtn');
    const submitApprovalBtn = document.getElementById('submitApprovalBtn');
    const approvedState  = document.getElementById('approvedState');
    const approvedNote   = document.getElementById('approvedNote');
    const fileLink       = document.getElementById('fileLink');
    const rejectedState  = document.getElementById('rejectedState');
    const rejectedNote   = document.getElementById('rejectedNote');

    let orderData    = null;
    let capturedData = null; // { base64, mimeType, fileName }

    // ══════════════════════════════════════════════════════════════
    //  Crypto
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
    //  تحميل الطلب
    // ══════════════════════════════════════════════════════════════
    function loadOrderData() {
        try {
            const params = new URLSearchParams(window.location.search);
            const enc = params.get('d');
            if (!enc) throw new Error('no_data');
            const decrypted = rfmDecrypt(decodeURIComponent(enc));
            orderData = JSON.parse(decrypted);
            renderOrder(orderData);
        } catch (e) {
            console.error(e);
            showError('تعذّر تحميل بيانات الطلب. تأكد من صحة الرابط.\nError loading order. Check the link.');
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  رسم الطلب
    // ══════════════════════════════════════════════════════════════
    function renderOrder(d) {
        loadingState.classList.add('hidden');
        mainContent.classList.remove('hidden');

        document.getElementById('trackIdDisplay').textContent    = d.trackId || '—';
        document.getElementById('dateDisplay').textContent       = d.date || '';
        document.getElementById('branchDisplay').textContent     = d.branch || '—';
        document.getElementById('locationDisplay').textContent   = d.locationAR ? d.locationAR + ' / ' + (d.locationEN || '') : '';
        document.getElementById('supplierNameDisplay').textContent = d.supplierName || '—';
        document.getElementById('managerDisplay').textContent    = (d.managerNameAR || '—') + ' / ' + (d.managerNameEN || '');
        document.getElementById('managerPhoneDisplay').textContent = d.managerPhone || '—';

        // عرض المواد — الكمية المطلوبة فقط
        const container = document.getElementById('itemsContainer');
        container.innerHTML = '';
        const icons = ['package','box','layers','archive','database','grid','gift','tag','bookmark','cpu'];
        (d.items || []).forEach((it, idx) => {
            const card = document.createElement('div');
            card.className = 'sup-mat-card';
            card.innerHTML = `
                <div class="sup-mat-head">
                    <div class="sup-mat-icon">
                        <i data-lucide="${icons[idx % icons.length]}"></i>
                    </div>
                    <div class="sup-mat-names">
                        <div class="ar">${it.nameAR}</div>
                        <div class="en">${it.nameEN}</div>
                    </div>
                </div>
                <div class="qty-requested-badge">
                    <div class="label-ar">الكمية المطلوبة</div>
                    <div class="label-en">Requested Quantity</div>
                    <div class="value">${it.requestedQty}</div>
                    <div class="unit-bi">${it.requestUnitAR} / ${it.requestUnitEN}</div>
                </div>`;
            container.appendChild(card);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ══════════════════════════════════════════════════════════════
    //  الاعتماد → يفتح قسم رفع الملف
    // ══════════════════════════════════════════════════════════════
    approveBtn.addEventListener('click', () => {
        rejectArea.style.display  = 'none';
        rejectBtn.style.opacity   = '0.4';
        rejectBtn.disabled        = true;
        uploadSection.style.display = 'block';
        uploadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    // ══════════════════════════════════════════════════════════════
    //  الرفض → يفتح منطقة السبب
    // ══════════════════════════════════════════════════════════════
    rejectBtn.addEventListener('click', () => {
        uploadSection.style.display = 'none';
        approveBtn.style.opacity    = '0.4';
        approveBtn.disabled         = true;
        rejectArea.style.display    = 'block';
        rejectReason.focus();
    });

    // ══════════════════════════════════════════════════════════════
    //  الكاميرا — نفس أسلوب FIL-camera
    // ══════════════════════════════════════════════════════════════
    cameraBtn.addEventListener('click', () => {
        if (!orderData) return;
        RFMCamera.init({
            trackId:      orderData.trackId,
            branchName:   orderData.branch,
            supplierName: orderData.supplierName,
            contextLine:  'طلب توريد مواد / RFM — ' + (orderData.trackId || ''),
            onCapture(dataUrl) {
                // dataUrl = "data:image/jpeg;base64,XXXX"
                const parts = dataUrl.split(',');
                const mimeMatch = dataUrl.match(/data:([^;]+);/);
                capturedData = {
                    base64:   parts[1],
                    mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
                    fileName: 'rfm-quote-' + Date.now() + '.jpg'
                };
                photoPreviewImg.src        = dataUrl;
                photoPreview.style.display = 'block';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
        RFMCamera.open();
    });

    // ══════════════════════════════════════════════════════════════
    //  المعرض / ملف
    // ══════════════════════════════════════════════════════════════
    galleryInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('حجم الملف كبير جداً (الحد 10 MB)\nFile too large (max 10 MB)');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            const parts   = dataUrl.split(',');
            const mimeMatch = dataUrl.match(/data:([^;]+);/);
            capturedData = {
                base64:   parts[1],
                mimeType: mimeMatch ? mimeMatch[1] : 'application/octet-stream',
                fileName: file.name
            };
            if (file.type.startsWith('image/')) {
                photoPreviewImg.src        = dataUrl;
                photoPreview.style.display = 'block';
            } else {
                // PDF — نعرض أيقونة
                photoPreviewImg.src = '';
                photoPreview.style.display = 'block';
                photoPreview.querySelector('img').style.display = 'none';
                photoPreview.querySelector('img').insertAdjacentHTML('afterend',
                    `<div style="padding:20px;text-align:center;background:#f9fafb;">
                        <i data-lucide="file-text" style="width:40px;height:40px;color:var(--primary);"></i>
                        <div style="font-weight:700;margin-top:8px;">${file.name}</div>
                     </div>`
                );
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };
        reader.readAsDataURL(file);
    });

    retakeBtn.addEventListener('click', () => {
        capturedData = null;
        photoPreviewImg.src = '';
        photoPreview.style.display = 'none';
        galleryInput.value = '';
    });

    // ══════════════════════════════════════════════════════════════
    //  إرسال الاعتماد
    // ══════════════════════════════════════════════════════════════
    submitApprovalBtn.addEventListener('click', async () => {
        if (!orderData) return;
        submitApprovalBtn.disabled = true;
        window.showModal('loading', 'جارٍ الإرسال... / Submitting...', 'يرجى الانتظار');

        const payload = {
            type:          'RFM_SUPPLIER_APPROVE',
            trackId:       orderData.trackId,
            branch:        orderData.branch,
            employeeName:  orderData.employeeName || '',
            supplierName:  orderData.supplierName,
            supplierEmail: orderData.supplierEmail,
            items:         orderData.items,
            date:          orderData.date || '',
            fileData:      capturedData ? capturedData.base64    : null,
            fileName:      capturedData ? capturedData.fileName  : null,
            mimeType:      capturedData ? capturedData.mimeType  : null
        };

        try {
            const result = await postToGas(payload);
            document.getElementById('customModal').classList.add('hidden');
            pendingActions.classList.add('hidden');
            approvedState.classList.remove('hidden');
            approvedNote.textContent = capturedData
                ? 'تم رفع الملف وإرسال الاعتماد ✓\nFile uploaded & approval sent'
                : 'تم إرسال الاعتماد بدون ملف\nApproval sent without file';
            if (result.fileUrl) {
                fileLink.style.display = 'block';
                fileLink.innerHTML = `<a href="${result.fileUrl}" target="_blank">📄 عرض الملف / View File</a>`;
            }
        } catch (e) {
            submitApprovalBtn.disabled = false;
            window.showModal('error', 'خطأ / Error', 'يرجى المحاولة مرة أخرى\nPlease try again.');
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  تأكيد الرفض
    // ══════════════════════════════════════════════════════════════
    confirmRejectBtn.addEventListener('click', async () => {
        if (!orderData) return;
        const reason = rejectReason.value.trim();
        if (!reason) { rejectReason.style.borderColor = '#c62828'; rejectReason.focus(); return; }
        confirmRejectBtn.disabled = true;
        window.showModal('loading', 'جارٍ الإرسال...', 'يرجى الانتظار');

        const payload = {
            type:          'RFM_SUPPLIER_REJECT',
            trackId:       orderData.trackId,
            branch:        orderData.branch,
            employeeName:  orderData.employeeName || '',
            supplierName:  orderData.supplierName,
            supplierEmail: orderData.supplierEmail,
            items:         orderData.items || [],   // تفاصيل الطلب عند الرفض أيضاً
            date:          orderData.date || '',
            reason
        };

        try {
            await postToGas(payload);
            document.getElementById('customModal').classList.add('hidden');
            pendingActions.classList.add('hidden');
            rejectedState.classList.remove('hidden');
            rejectedNote.textContent = 'السبب / Reason: ' + reason;
        } catch (e) {
            confirmRejectBtn.disabled = false;
            window.showModal('error', 'خطأ / Error', 'حاول مرة أخرى / Try again.');
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  POST helper
    // ══════════════════════════════════════════════════════════════
    async function postToGas(payload) {
        const encPayload = rfmEncrypt(JSON.stringify(payload));
        const resp = await fetch(window.QB_ENDPOINTS.RFM, {
            method:   'POST',
            headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:     'payload=' + encodeURIComponent(encPayload),
            redirect: 'follow'
        });
        let result = { result: 'success' };
        try {
            const text = await resp.text();
            if (text.trim().startsWith('{')) result = JSON.parse(text);
        } catch (_) {}
        if (result.result === 'error') throw new Error(result.message || 'unknown error');
        return result;
    }

    function showError(msg) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMsg.textContent = msg;
    }

    loadOrderData();
});
