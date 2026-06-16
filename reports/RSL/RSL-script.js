/**
 * RSL-script.js — سجل معايرة المكونات
 * يستخدم:
 *   · QB.getEmployee() / QB.translateBranch()  (js/config.js)
 *   · QBSession.initPage() / save()            (js/session.js)
 *   · window.showModal()                        (js/common.js)
 *   · RSLCamera                                 (RSL-camera.js)
 *   · window.QB_ENDPOINTS.RSL                   (js/endpoints.js)
 *
 * المنتجات والمكونات والأحجام تأتي من Google Sheets (يديرها المدير).
 */
document.addEventListener('DOMContentLoaded', () => {
    const SCRIPT_URL = window.QB_ENDPOINTS.RSL;

    QBSession.initPage();

    const els = {
        form:          document.getElementById('rslReportForm'),
        submitBtn:     document.getElementById('submitBtn'),
        productGrid:   document.getElementById('productGrid'),
        productHint:   document.getElementById('productHint'),
        sizeCard:      document.getElementById('sizeCard'),
        sizeGrid:      document.getElementById('sizeGrid'),
        ingredientsCard: document.getElementById('ingredientsCard'),
        ingredientsList: document.getElementById('ingredientsList'),
        photoCard:     document.getElementById('photoCard'),
        dropArea:      document.getElementById('dropArea'),
        preview:       document.getElementById('imagePreview'),
        container:     document.getElementById('imagePreviewContainer'),
        remove:        document.getElementById('removeImage'),
        modalClose:    document.getElementById('modalClose'),
        modalTitle:    document.getElementById('modalTitle')
    };

    let products = [];
    let currentProduct = null;
    let capturedImageBase64 = '';

    // ── جلب المنتجات من جوجل شيت ─────────────────────────────────────────
    async function loadProducts() {
        try {
            const res = await fetch(`${SCRIPT_URL}?action=getProducts`, { method: 'GET' });
            const data = await res.json();
            if (data.result === 'success' && Array.isArray(data.products)) {
                products = data.products;
                renderProductTiles();
            } else {
                throw new Error(data.message || 'تعذر تحميل المنتجات');
            }
        } catch (err) {
            console.error('loadProducts error:', err);
            els.productGrid.innerHTML = '<p class="rsl-empty">— تعذّر تحميل المنتجات —</p>';
            showModal('error', 'خطأ في التحميل', 'تعذّر تحميل قائمة المنتجات. تأكد من الاتصال وحاول تحديث الصفحة.');
        }
    }

    function renderProductTiles() {
        if (!products.length) {
            els.productGrid.innerHTML = '<p class="rsl-empty">— لا توجد منتجات مُعرّفة —</p>';
            return;
        }
        let html = '';
        products.forEach((p, i) => {
            html += `
                <input type="radio" id="prod_${i}" name="rslProduct" value="${p.id}">
                <label for="prod_${i}" class="rsl-product-tile">
                    <span class="prod-ar">${p.ar}</span>
                    ${p.en ? `<span class="prod-en">${p.en}</span>` : ''}
                </label>`;
        });
        els.productGrid.innerHTML = html;
    }

    // ── عند اختيار منتج ──────────────────────────────────────────────────
    els.productGrid.addEventListener('change', (e) => {
        if (e.target.name !== 'rslProduct') return;
        currentProduct = products.find(p => p.id === e.target.value) || null;

        resetImageState();
        capturedImageBase64 = '';

        if (!currentProduct) {
            els.sizeCard.classList.add('hidden');
            els.ingredientsCard.classList.add('hidden');
            els.photoCard.classList.add('hidden');
            els.productHint.classList.add('hidden');
            return;
        }

        renderSizes(currentProduct);
        renderIngredients(currentProduct);
        els.photoCard.classList.remove('hidden');
    });

    function renderSizes(product) {
        const sizes = product.sizes || [];
        if (!sizes.length) {
            els.sizeCard.classList.add('hidden');
            return;
        }
        let html = '';
        sizes.forEach((s, i) => {
            html += `
                <input type="radio" id="size_${i}" name="rslSize" value="${s.ar}">
                <label for="size_${i}" class="rsl-size-tile">
                    <i data-lucide="cup-soda"></i>
                    <span class="size-ar">${s.ar}</span>
                    ${s.en ? `<span class="size-en">${s.en}</span>` : ''}
                </label>`;
        });
        els.sizeGrid.innerHTML = html;
        els.sizeCard.classList.remove('hidden');
        lucide.createIcons();
    }

    function renderIngredients(product) {
        const ings = product.ingredients || [];
        if (!ings.length) {
            els.ingredientsList.innerHTML = '<p class="rsl-empty">لا توجد مكونات مُعرّفة لهذا.</p>';
            els.ingredientsCard.classList.remove('hidden');
            return;
        }
        let html = '';
        ings.forEach((ing, i) => {
            html += `
                <div class="rsl-ing-row" data-index="${i}">
                    <div class="rsl-ing-info">
                        <span class="rsl-ing-name">${ing.ar} <span class="req-star">*</span></span>
                        ${ing.en ? `<small class="rsl-ing-en">${ing.en}</small>` : ''}
                    </div>
                    <div class="rsl-ing-input">
                        <input type="number" class="ing-qty" inputmode="decimal" min="0" step="any"
                               placeholder="0" data-ar="${ing.ar}" data-unit="${ing.unit}">
                        <span class="unit">${ing.unit}</span>
                    </div>
                    <input type="checkbox" class="ing-unused" id="unused_${i}" hidden>
                    <label for="unused_${i}" class="rsl-unused-btn"
                           title="اضغط لتثبيت أن هذا المكوّن غير مستخدم في هذا المنتج">
                        <i data-lucide="ban"></i>
                    </label>
                </div>`;
        });
        els.ingredientsList.innerHTML = html;
        els.ingredientsCard.classList.remove('hidden');
        lucide.createIcons();
    }

    // مُستمع واحد على الحاوية (مُفوَّض)
    els.ingredientsList.addEventListener('input', (e) => {
        if (e.target.classList.contains('ing-qty')) {
            e.target.closest('.rsl-ing-row').classList.remove('row-error');
        }
    });

    // عند تفعيل/إلغاء «غير مستخدم»: تعطيل حقل الكمية وتفريغه
    els.ingredientsList.addEventListener('change', (e) => {
        if (!e.target.classList.contains('ing-unused')) return;
        const row   = e.target.closest('.rsl-ing-row');
        const input = row.querySelector('.ing-qty');
        const unused = e.target.checked;
        row.classList.toggle('is-unused', unused);
        row.classList.remove('row-error');
        if (input) {
            input.disabled = unused;
            if (unused) input.value = '';
        }
    });

    // ── جمع المكونات المُدخلة كنصوص ──────────────────────────────────────
    // يُرجع { list:[...], missing:[...] }
    function collectIngredients() {
        const rows = els.ingredientsList.querySelectorAll('.rsl-ing-row');
        const list = [];
        const missing = [];
        rows.forEach(row => {
            const input  = row.querySelector('.ing-qty');
            if (!input) return;
            const ar     = input.getAttribute('data-ar');
            const unit   = input.getAttribute('data-unit');
            const unused = row.querySelector('.ing-unused');

            // مكوّن مُثبَّت أنه غير مستخدم → يُسجَّل دون كمية ولا يُعد ناقصاً
            if (unused && unused.checked) {
                list.push(`${ar} ( لا يُستخدم )`);
                return;
            }

            const val = input.value.trim();
            if (val === '' || parseFloat(val) <= 0 || isNaN(parseFloat(val))) {
                row.classList.add('row-error');
                missing.push(ar);
            } else {
                list.push(`${ar} ( ${val} ${unit} )`);
            }
        });
        return { list, missing };
    }

    // ── الكاميرا ─────────────────────────────────────────────────────────
    els.dropArea.addEventListener('click', (e) => {
        e.preventDefault();
        openCamera();
    });

    function openCamera() {
        if (!currentProduct) {
            showModal('error', 'لم يُختر منتج', 'يرجى اختيار المنتج أولاً.');
            return;
        }
        // التحقق من الحجم
        const sizeEl = document.querySelector('input[name="rslSize"]:checked');
        if ((currentProduct.sizes || []).length && !sizeEl) {
            showModal('error', 'الحجم مطلوب', 'يرجى اختيار الحجم المطلوب قبل التصوير.');
            return;
        }
        // التحقق من المكونات قبل التصوير (لتظهر في بصمة الصورة بدقة)
        const { list, missing } = collectIngredients();
        if (missing.length > 0) {
            showModal('error', 'كميات ناقصة', `يرجى إدخال كمية المكونات أولاً: ${missing.slice(0, 4).join('، ')}`);
            return;
        }

        const empId  = document.getElementById('employeeId').value.trim();
        const branch = document.querySelector('input[name="branch"]:checked');

        RSLCamera.init({
            productName:  currentProduct.ar,
            sizeName:     sizeEl ? sizeEl.value : '',
            branchName:   branch ? QB.translateBranch(branch.value) : 'غير محدد',
            employeeName: QB.getEmployee(empId) || 'غير محدد',
            ingredients:  list,
            onCapture:    handleCameraCapture
        });
        RSLCamera.open();
    }

    function handleCameraCapture(imageBase64) {
        capturedImageBase64 = imageBase64;
        els.preview.src = imageBase64;
        els.container.classList.remove('hidden');
        els.dropArea.classList.add('hidden');
    }

    function resetImageState() {
        capturedImageBase64 = '';
        els.preview.src = '';
        els.container.classList.add('hidden');
        els.dropArea.classList.remove('hidden');
    }

    els.remove.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetImageState();
    });

    // ── سلوك زر إغلاق المودال ────────────────────────────────────────────
    if (els.modalClose) {
        els.modalClose.onclick = () => {
            document.getElementById('customModal').classList.add('hidden');
            if (els.modalTitle.innerText === 'تم الإرسال') resetFullForm();
        };
    }

    function resetFullForm() {
        els.form.reset();

        // إعادة تطبيق الجلسة المحفوظة (reset يمسح الفرع ورقم الموظف لأنهما داخل النموذج)
        const s = QBSession.get();
        if (s) {
            const radio = document.querySelector(`input[name="branch"][value="${s.branch}"]`);
            if (radio) radio.checked = true;
            const empInput = document.getElementById('employeeId');
            if (empInput) empInput.value = s.empId;
        }

        currentProduct = null;
        capturedImageBase64 = '';
        els.sizeCard.classList.add('hidden');
        els.ingredientsCard.classList.add('hidden');
        els.photoCard.classList.add('hidden');
        els.productHint.classList.add('hidden');
        els.sizeGrid.innerHTML = '';
        els.ingredientsList.innerHTML = '';
        resetImageState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── الإرسال ──────────────────────────────────────────────────────────
    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const empId  = document.getElementById('employeeId').value.trim();
        const branch = document.querySelector('input[name="branch"]:checked');

        if (!branch || !QB.getEmployee(empId)) {
            showModal('error', 'بيانات ناقصة', 'يرجى اختيار الفرع والتأكد من رقم الموظف.');
            return;
        }
        if (!currentProduct) {
            showModal('error', 'المنتج مطلوب', 'يرجى اختيار المنتج.');
            return;
        }

        const sizeEl = document.querySelector('input[name="rslSize"]:checked');
        if ((currentProduct.sizes || []).length && !sizeEl) {
            showModal('error', 'الحجم مطلوب', 'يرجى اختيار الحجم المطلوب.');
            return;
        }

        const { list, missing } = collectIngredients();
        if (missing.length > 0) {
            showModal('error', 'كميات ناقصة', `يرجى إدخال كمية: ${missing.slice(0, 4).join('، ')}`);
            return;
        }
        if (!list.length) {
            showModal('error', 'لا توجد مكونات', 'هذا المنتج لا يحتوي على مكونات مُعرّفة للتسجيل.');
            return;
        }
        if (!capturedImageBase64) {
            showModal('error', 'صورة مفقودة', 'يرجى التقاط صورة حية للمنتج قبل الإرسال.');
            return;
        }

        showModal('loading', 'جاري الإرسال', 'يرجى الانتظار، يتم رفع البيانات والصورة...');
        els.submitBtn.disabled = true;

        const payload = {
            reportType:      'سجل معايرة المكونات',
            branch:          QB.translateBranch(branch.value),
            employeeId:      empId,
            employeeName:    QB.getEmployee(empId),
            product:         currentProduct.ar,
            productEn:       currentProduct.en || '',
            size:            sizeEl ? sizeEl.value : '',
            ingredientsText: list.join(' - '),
            image:           capturedImageBase64
        };

        const formData = new URLSearchParams();
        formData.append('payload', JSON.stringify(payload));

        try {
            const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData, mode: 'cors' });
            const result = await response.json();

            if (result.result === 'success') {
                QBSession.save(empId, branch.value);
                showModal('success', 'تم الإرسال', `تم تسجيل معايرة المكونات بنجاح برقم: ${result.id}`);
                resetFullForm();
            } else {
                throw new Error(result.message || 'فشل السيرفر في معالجة الطلب');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            showModal('error', 'فشل الإرسال', 'حدث خطأ في الاتصال بالسيرفر. تأكد من جودة الإنترنت وحاول مجدداً.');
        } finally {
            els.submitBtn.disabled = false;
            els.submitBtn.style.opacity = '1';
        }
    });

    // ── تشغيل ────────────────────────────────────────────────────────────
    loadProducts();
});
