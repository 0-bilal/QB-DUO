// ══════════════════════════════════════════════════════════════════
//  RFM-script.js — طلب توريد مواد | Request for Materials
//  QB-Sentinel | برمجيات QB
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // ── مراجع العناصر ───────────────────────────────────────────
    const form          = document.getElementById('rfmForm');
    const materialsCard = document.getElementById('materialsCard');
    const submitArea    = document.getElementById('submitArea');
    const matLoader     = document.getElementById('matLoader');
    const matError      = document.getElementById('matError');
    const matEmpty      = document.getElementById('matEmpty');
    const matGrid       = document.getElementById('matGrid');
    const rfmSummary    = document.getElementById('rfmSummary');
    const rfmSummaryList= document.getElementById('rfmSummaryList');
    const selectedCount = document.getElementById('selectedCount');
    const retryBtn      = document.getElementById('retryBtn');

    // ── حالة التطبيق ────────────────────────────────────────────
    let currentBranch      = '';
    let loadedMaterials    = [];
    let supplierPhone      = '';
    let supplierName       = '';
    let materialsLoaded    = false;

    // ══════════════════════════════════════════════════════════════
    //  AES-256-CBC — تشفير CryptoJS
    // ══════════════════════════════════════════════════════════════

    /**
     * تشفير نص باستخدام AES-256-CBC
     * @param {string} plaintext - النص
     * @returns {string} - "ivHex:ciphertextBase64"
     */
    function rfmEncrypt(plaintext) {
        const key = CryptoJS.enc.Hex.parse(window.QB.rfmKey);
        const iv  = CryptoJS.lib.WordArray.random(16);
        const enc = CryptoJS.AES.encrypt(plaintext, key, {
            iv,
            mode:    CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return iv.toString(CryptoJS.enc.Hex) + ':' + enc.ciphertext.toString(CryptoJS.enc.Base64);
    }

    /**
     * فك تشفير نص
     * @param {string} encStr - "ivHex:ciphertextBase64"
     * @returns {string} - النص الأصلي
     */
    function rfmDecrypt(encStr) {
        const parts = encStr.split(':');
        if (parts.length < 2) throw new Error('تنسيق تشفير غير صحيح');
        const iv  = CryptoJS.enc.Hex.parse(parts[0]);
        const ct  = CryptoJS.enc.Base64.parse(parts.slice(1).join(':'));
        const key = CryptoJS.enc.Hex.parse(window.QB.rfmKey);
        const dec = CryptoJS.AES.decrypt({ ciphertext: ct }, key, {
            iv,
            mode:    CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return dec.toString(CryptoJS.enc.Utf8);
    }

    // ══════════════════════════════════════════════════════════════
    //  توليد توقيع HMAC-SHA256 للطلبات
    // ══════════════════════════════════════════════════════════════
    function rfmHmac(message) {
        const key = CryptoJS.enc.Hex.parse(window.QB.rfmKey);
        return CryptoJS.HmacSHA256(message, key).toString(CryptoJS.enc.Hex);
    }

    // ══════════════════════════════════════════════════════════════
    //  إعداد نظام الجلسة
    // ══════════════════════════════════════════════════════════════
    QBSession.initPage({
        onApply(s) {
            currentBranch = s.branch;
            // تحميل المواد بعد تطبيق الجلسة
            setTimeout(() => showMaterialsSection(s.branch), 300);
        },
        onReset() {
            currentBranch   = '';
            loadedMaterials = [];
            supplierPhone   = '';
            supplierName    = '';
            materialsLoaded = false;
            hideMaterialsSection();
        }
    });

    // ── مراقبة التغييرات في الفرع + رقم الموظف ─────────────────
    document.querySelectorAll('input[name="branch"]').forEach(r => {
        r.addEventListener('change', () => {
            // إعادة تعيين المواد عند تغيير الفرع
            if (materialsLoaded) {
                loadedMaterials = [];
                supplierPhone   = '';
                supplierName    = '';
                materialsLoaded = false;
                resetMaterialsUI();
            }
        });
    });

    // ══════════════════════════════════════════════════════════════
    //  عرض / إخفاء قسم المواد
    // ══════════════════════════════════════════════════════════════
    function showMaterialsSection(branch) {
        currentBranch = branch;
        materialsCard.style.display = 'block';
        submitArea.style.display    = 'block';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (!materialsLoaded) {
            fetchMaterials(branch);
        }
    }

    function hideMaterialsSection() {
        materialsCard.style.display = 'none';
        submitArea.style.display    = 'none';
        matGrid.innerHTML = '';
        matGrid.classList.add('hidden');
        rfmSummary.classList.add('hidden');
        rfmSummary.classList.remove('visible');
        showLoader();
    }

    function resetMaterialsUI() {
        matGrid.innerHTML = '';
        matGrid.classList.add('hidden');
        rfmSummary.classList.add('hidden');
        rfmSummary.classList.remove('visible');
        updateSelectedCount();
        showLoader();
    }

    // ══════════════════════════════════════════════════════════════
    //  حالات الواجهة
    // ══════════════════════════════════════════════════════════════
    function showLoader() {
        matLoader.classList.remove('hidden');
        matError.classList.add('hidden');
        matEmpty.classList.add('hidden');
        matGrid.classList.add('hidden');
    }

    function showError() {
        matLoader.classList.add('hidden');
        matError.classList.remove('hidden');
        matEmpty.classList.add('hidden');
        matGrid.classList.add('hidden');
    }

    function showEmpty() {
        matLoader.classList.add('hidden');
        matError.classList.add('hidden');
        matEmpty.classList.remove('hidden');
        matGrid.classList.add('hidden');
    }

    function showGrid() {
        matLoader.classList.add('hidden');
        matError.classList.add('hidden');
        matEmpty.classList.add('hidden');
        matGrid.classList.remove('hidden');
    }

    // ══════════════════════════════════════════════════════════════
    //  جلب المواد من Apps Script
    // ══════════════════════════════════════════════════════════════
    function fetchMaterials(branch) {
        showLoader();

        const ts  = Date.now().toString();
        const sig = rfmHmac(branch + ':' + ts);
        const url = window.QB_ENDPOINTS.RFM
            + '?action=getMaterials'
            + '&branch=' + encodeURIComponent(branch)
            + '&ts='     + ts
            + '&sig='    + sig;

        fetch(url)
            .then(r => r.json())
            .then(resp => {
                if (resp.result !== 'success' || !resp.data) {
                    console.error('[RFM] خطأ من الخادم:', resp.message);
                    showError();
                    return;
                }

                // فك التشفير
                const decrypted = rfmDecrypt(resp.data);
                const payload   = JSON.parse(decrypted);

                loadedMaterials = payload.materials || [];
                supplierPhone   = payload.supplierPhone || '';
                supplierName    = payload.supplierName  || '';
                materialsLoaded = true;

                if (loadedMaterials.length === 0) {
                    showEmpty();
                    return;
                }

                renderMaterials(loadedMaterials);
                showGrid();
            })
            .catch(err => {
                console.error('[RFM] خطأ في الجلب:', err);
                showError();
            });
    }

    // ══════════════════════════════════════════════════════════════
    //  رسم بطاقات المواد
    // ══════════════════════════════════════════════════════════════
    function renderMaterials(materials) {
        matGrid.innerHTML = '';

        const icons = [
            'package','box','layers','archive','database','server',
            'cpu','grid','gift','shopping-bag','bookmark','tag'
        ];

        materials.forEach((mat, idx) => {
            const icon = icons[idx % icons.length];
            const card = document.createElement('div');
            card.className = 'mat-card';
            card.dataset.matId = mat.id;
            card.dataset.idx   = idx;

            // شارة الحد الأدنى
            const minBadge = mat.minLevel
                ? `<div class="mat-min-level">
                       <i data-lucide="alert-triangle"></i>
                       <span>الحد الأدنى: ${mat.minLevel} ${mat.currentUnitAR}</span>
                       <small>/ Min: ${mat.minLevel} ${mat.currentUnitEN}</small>
                   </div>`
                : '';

            card.innerHTML = `
                <div class="mat-card-head">
                    <div class="mat-icon-wrap">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="mat-names">
                        <span class="mat-name-ar">${mat.nameAR}</span>
                        <small class="mat-name-en">${mat.nameEN}</small>
                        ${minBadge}
                    </div>
                    <label class="mat-check" title="تحديد">
                        <input type="checkbox" class="mat-checkbox">
                        <span class="mat-check-box">
                            <i data-lucide="check"></i>
                        </span>
                    </label>
                </div>
                <div class="mat-card-body">
                    <div class="mat-divider"></div>

                    <div class="mat-qty-row">
                        <div class="mat-qty-label">
                            <i data-lucide="package-check"></i>
                            <span>الكمية الحالية / Current Quantity</span>
                        </div>
                        <div class="mat-input-wrap">
                            <input type="number"
                                   class="mat-current-qty"
                                   placeholder="0"
                                   min="0"
                                   inputmode="numeric">
                            <span class="mat-unit-tag current"
                                  data-unit="${mat.currentUnitAR}">
                                <span class="tag-ar">${mat.currentUnitAR}</span>
                                <small class="tag-en">${mat.currentUnitEN}</small>
                            </span>
                        </div>
                    </div>

                    <div class="mat-qty-row">
                        <div class="mat-qty-label">
                            <i data-lucide="package-plus"></i>
                            <span>الكمية المطلوبة / Requested Quantity</span>
                        </div>
                        <div class="mat-input-wrap">
                            <input type="number"
                                   class="mat-requested-qty"
                                   placeholder="0"
                                   min="1"
                                   inputmode="numeric">
                            <span class="mat-unit-tag requested"
                                  data-unit="${mat.requestUnitAR}">
                                <span class="tag-ar">${mat.requestUnitAR}</span>
                                <small class="tag-en">${mat.requestUnitEN}</small>
                            </span>
                        </div>
                    </div>
                </div>`;

            // أحداث التحديد
            const checkbox = card.querySelector('.mat-checkbox');
            checkbox.addEventListener('change', () => {
                toggleCardSelection(card, checkbox.checked);
            });

            // النقر على رأس البطاقة يفعّل الاختيار
            card.querySelector('.mat-card-head').addEventListener('click', (e) => {
                if (e.target.closest('.mat-check')) return; // تجنب التكرار
                checkbox.checked = !checkbox.checked;
                toggleCardSelection(card, checkbox.checked);
            });

            // تحديث الملخص عند تغيير الكميات
            card.querySelectorAll('input[type="number"]').forEach(inp => {
                inp.addEventListener('input', updateSummary);
            });

            matGrid.appendChild(card);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
        updateSelectedCount();
    }

    // ══════════════════════════════════════════════════════════════
    //  إدارة تحديد البطاقة
    // ══════════════════════════════════════════════════════════════
    function toggleCardSelection(card, selected) {
        card.classList.toggle('selected', selected);
        if (selected) {
            // تركيز على أول حقل إدخال
            setTimeout(() => {
                const inp = card.querySelector('.mat-current-qty');
                if (inp) inp.focus();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 50);
        }
        updateSelectedCount();
        updateSummary();
    }

    // ══════════════════════════════════════════════════════════════
    //  تحديث عداد المواد المحددة
    // ══════════════════════════════════════════════════════════════
    function updateSelectedCount() {
        const count = matGrid.querySelectorAll('.mat-card.selected').length;
        selectedCount.textContent = count > 0 ? count + ' محدد' : '0 محدد';
    }

    // ══════════════════════════════════════════════════════════════
    //  تحديث ملخص الطلب
    // ══════════════════════════════════════════════════════════════
    function updateSummary() {
        const selectedCards = matGrid.querySelectorAll('.mat-card.selected');

        if (selectedCards.length === 0) {
            rfmSummary.classList.add('hidden');
            rfmSummary.classList.remove('visible');
            return;
        }

        rfmSummaryList.innerHTML = '';
        let hasData = false;

        selectedCards.forEach(card => {
            const nameAR  = card.querySelector('.mat-name-ar').textContent;
            const reqQty  = card.querySelector('.mat-requested-qty').value;
            const reqUnit = card.querySelector('.mat-unit-tag.requested').dataset.unit || '';

            if (reqQty && parseFloat(reqQty) > 0) {
                hasData = true;
                const item = document.createElement('div');
                item.className = 'rfm-summary-item';
                item.innerHTML = `
                    <span class="rfm-summary-item-name">${nameAR}</span>
                    <span class="rfm-summary-item-qty">طلب: ${reqQty} ${reqUnit}</span>`;
                rfmSummaryList.appendChild(item);
            }
        });

        if (hasData) {
            rfmSummary.classList.remove('hidden');
            rfmSummary.classList.add('visible');
        } else {
            rfmSummary.classList.add('hidden');
            rfmSummary.classList.remove('visible');
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  إعادة المحاولة
    // ══════════════════════════════════════════════════════════════
    retryBtn.addEventListener('click', () => {
        if (currentBranch) fetchMaterials(currentBranch);
    });

    // ══════════════════════════════════════════════════════════════
    //  إرسال النموذج
    // ══════════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // التحقق من الجلسة
        const session = QBSession.get();
        if (!session) {
            window.showModal('error', 'خطأ', 'يرجى تحديد الفرع ورقم الموظف أولاً');
            return;
        }

        const employeeName = QB.getEmployee(session.empId);
        if (!employeeName) {
            window.showModal('error', 'خطأ', 'رقم الموظف غير صحيح');
            return;
        }

        // جمع المواد المحددة
        const selectedCards = matGrid.querySelectorAll('.mat-card.selected');
        if (selectedCards.length === 0) {
            window.showModal('error', 'لا توجد مواد محددة',
                'يرجى تحديد مادة واحدة على الأقل');
            return;
        }

        // التحقق من الكميات
        const items = [];
        let hasError = false;

        selectedCards.forEach(card => {
            const idx        = parseInt(card.dataset.idx, 10);
            const mat        = loadedMaterials[idx];
            const currentQty = parseFloat(card.querySelector('.mat-current-qty').value) || 0;
            const reqQty     = parseFloat(card.querySelector('.mat-requested-qty').value);

            const reqInput   = card.querySelector('.mat-requested-qty');
            const reqWrapper = reqInput.closest('.mat-input-wrap');
            if (!reqQty || reqQty <= 0) {
                reqWrapper.style.borderColor = '#c62828';
                reqWrapper.style.boxShadow   = '0 0 0 2px rgba(198,40,40,0.15)';
                hasError = true;
                return;
            }
            reqWrapper.style.borderColor = '';
            reqWrapper.style.boxShadow   = '';

            items.push({
                id:            mat.id,
                nameAR:        mat.nameAR,
                nameEN:        mat.nameEN,
                currentQty:    currentQty,
                currentUnitAR: mat.currentUnitAR,
                currentUnitEN: mat.currentUnitEN || mat.currentUnitAR,
                requestedQty:  reqQty,
                requestUnitAR: mat.requestUnitAR,
                requestUnitEN: mat.requestUnitEN || mat.requestUnitAR,
                supplierEmail: mat.supplierEmail || '',
                supplierName:  mat.supplierName  || ''
            });
        });

        if (hasError) {
            window.showModal('error', 'بيانات ناقصة',
                'يرجى إدخال الكمية المطلوبة لجميع المواد المحددة');
            return;
        }

        // إرسال الطلب
        window.showModal('loading', 'جارٍ إرسال الطلب...', 'يرجى الانتظار');

        const branchAR = QB.translateBranch(session.branch);
        const payload  = {
            branch:       branchAR,
            branchEn:     session.branch,
            employeeName: employeeName,
            items:        items   // كل مادة تحمل supplierPhone + supplierName الخاص بها
        };

        try {
            const encPayload = rfmEncrypt(JSON.stringify(payload));
            const endpoint   = window.QB_ENDPOINTS.RFM;

            const resp = await fetch(endpoint, {
                method:   'POST',
                headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
                body:     'payload=' + encodeURIComponent(encPayload),
                redirect: 'follow'
            });

            // ── معالجة رد Apps Script ──────────────────────────────────
            // GAS أحياناً يُعيد redirect إلى echo URL تنتهي بـ 404 مع HTML
            // البيانات تكون قد حُفظت بالفعل — نتعامل مع هذا بأمان
            let result = { result: 'success', id: 'RFM' };
            try {
                const text = await resp.text();
                if (text.trim().startsWith('{')) {
                    result = JSON.parse(text);
                }
                // إن كان HTML (redirect) → نفترض النجاح لأن الشيت يتم الحفظ فيه
            } catch (_) { /* نفترض النجاح */ }

            if (result.result === 'success') {
                window.showModal('success',
                    'تم إرسال الطلب بنجاح ',
                    'رقم الطلب: ' + result.id 
                );
                // إعادة تعيين التحديدات
                matGrid.querySelectorAll('.mat-card.selected').forEach(card => {
                    card.classList.remove('selected');
                    card.querySelector('.mat-checkbox').checked = false;
                    card.querySelectorAll('input[type="number"]').forEach(i => i.value = '');
                });
                rfmSummary.classList.add('hidden');
                rfmSummary.classList.remove('visible');
                updateSelectedCount();
            } else {
                window.showModal('error', 'فشل الإرسال',
                    result.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
            }
        } catch (err) {
            console.error('[RFM] خطأ في الإرسال:', err);
            window.showModal('error', 'خطأ في الاتصال',
                'تعذّر الوصول إلى الخادم، تحقق من الاتصال بالإنترنت');
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  فحص الجلسة عند التحميل — إن وُجدت جلسة محفوظة
    // ══════════════════════════════════════════════════════════════
    const existingSession = QBSession.get();
    if (existingSession) {
        // onApply سيتم استدعاؤه من initPage
        currentBranch = existingSession.branch;
    }

});
