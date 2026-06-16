/**
 * ECL-script.js — سجل تنظيف المعدات
 * يستخدم:
 *   · QB.employees        (من js/config.js)
 *   · QB.branchEmployees  (من js/config.js)
 *   · QB.translateBranch  (من js/config.js)
 *   · window.showModal()  (من js/common.js)
 */
document.addEventListener('DOMContentLoaded', () => {
    const SCRIPT_URL = window.QB_ENDPOINTS.ECL;

    // ── مساعد: ملء شبكة الموظفين من فرع معيّن ───────────────────────────
    function fillEmployeeGrid(branchKey) {
        const grid = document.getElementById('employeeGrid');
        if (!grid) return;
        const employees = (window.QB && QB.branchEmployees[branchKey]) || [];
        if (employees.length === 0) {
            grid.innerHTML = `<span>لا يوجد موظفون لهذا الفرع</span>`;
            return;
        }
        grid.innerHTML = '';
        employees.forEach((emp, index) => {
            const id = `emp_${index}`;
            grid.innerHTML += `
                <div class="employee-option">
                    <input type="radio" id="${id}" name="employeeName" value="${emp.ar}" required>
                    <label for="${id}" class="branch-tile">
                        <i data-lucide="user"></i>
                        <div class="tile-text">
                            <span>${emp.ar}</span>
                            <small>${emp.en}</small>
                        </div>
                    </label>
                </div>`;
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── تهيئة الجلسة ─────────────────────────────────────────────────────
    // employeeCard يبقى ظاهراً دائماً (المستخدم يختار من قام بالتنظيف)
    // عند وجود جلسة: نملأ الشبكة مباشرة دون الاعتماد على أحداث الفرع
    QBSession.initPage({
        onApply(s) {
            fillEmployeeGrid(s.branch);
        },
        onReset() {
            const grid = document.getElementById('employeeGrid');
            if (grid) grid.innerHTML = `
                <span>يرجى اختيار الفرع </span>
                <small>Please select the branch</small>`;
        }
    });

    const els = {
        branchRadios : document.querySelectorAll('input[name="branch"]'),
        employeeGrid : document.getElementById('employeeGrid'),
        preview      : document.getElementById('imagePreview'),
        container    : document.getElementById('imagePreviewContainer'),
        drop         : document.getElementById('dropArea'),
        remove       : document.getElementById('removeImage'),
        form         : document.getElementById('cleaningReportForm'),
        submitBtn    : document.querySelector('button[type="submit"]'),
        modalClose   : document.getElementById('modalClose')
    };

    let compressedImageBase64 = null;

    // ── تهيئة وحدة الكاميرا ──────────────────────────────────────────────
    ECLCamera.init({
        maxWidth : 1024,
        maxHeight: 1024,
        quality  : 0.80,
        onCapture: (base64Image) => {
            compressedImageBase64 = base64Image;
            els.preview.src = base64Image;
            els.container.classList.remove('hidden');
            els.drop.classList.add('hidden');
        },
        onClose: () => {}
    });

    els.drop.addEventListener('click', (e) => {
        e.preventDefault();
        ECLCamera.open();
    });

    els.remove.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetImageState();
    });

    function resetImageState() {
        compressedImageBase64 = null;
        els.preview.src = '';
        els.container.classList.add('hidden');
        els.drop.classList.remove('hidden');
        ECLCamera.reset();
        els.submitBtn.disabled = false;
        els.submitBtn.style.opacity = '1';
    }

    // ── اختيار موظفي الفرع (يستخدم fillEmployeeGrid المشتركة) ──────────
    els.branchRadios.forEach(radio => {
        radio.addEventListener('change', (e) => fillEmployeeGrid(e.target.value));
    });

    // ── إغلاق المودال ────────────────────────────────────────────────────
    if (els.modalClose) {
        els.modalClose.onclick = () => document.getElementById('customModal').classList.add('hidden');
    }

    // ── إرسال النموذج ────────────────────────────────────────────────────
    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const branch    = document.querySelector('input[name="branch"]:checked');
        const empName   = document.querySelector('input[name="employeeName"]:checked');
        const equipment = document.querySelector('input[name="equipment"]:checked');
        const empId     = document.getElementById('employeeId').value;

        if (!branch || !empName || !equipment || !compressedImageBase64) {
            showModal('error', 'بيانات ناقصة', 'يرجى إكمال جميع الحقول والتقاط صورة المعدة.');
            return;
        }

        const employeeName = QB.getEmployee(empId);
        if (!employeeName) {
            showModal('error', 'خطأ في التحقق', 'رقم الموظف المُدخَل غير مسجل في النظام.');
            return;
        }

        showModal('loading', 'جاري الإرسال', 'يرجى الانتظار، يتم تسجيل...');
        els.submitBtn.disabled = true;

        const payload = {
            branch      : QB.translateBranch(branch.value),
            senderName  : employeeName,
            cleanerName : empName.value,
            equipmentAr : equipment.parentElement.querySelector('span').innerText,
            equipmentEn : equipment.parentElement.querySelector('small').innerText,
            equipmentId : equipment.getAttribute('data-id'),
            image       : compressedImageBase64
        };

        const formData = new URLSearchParams();
        formData.append('payload', JSON.stringify(payload));

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body  : formData,
                mode  : 'cors'
            });

            const result = await response.json();

            if (result.result === 'success') {
                QBSession.save(empId, branch.value);
                showModal('success', 'تم الإرسال', `تم إرسال تقرير النظافة بنجاح برقم: ${result.id}`);
                els.form.reset();
                resetImageState();
            } else {
                throw new Error(result.message || 'فشل في معالجة البيانات');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            showModal('error', 'خطأ في الإرسال', 'تعذّر تأكد من الإنترنت وحاول مجدداً.');
        } finally {
            els.submitBtn.disabled = false;
            els.submitBtn.style.opacity = '1';
        }
    });
});


// ── Accordion للمعدات ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const body = document.getElementById(targetId);
            const group = header.closest('.accordion-group');
            const isOpen = group.classList.contains('is-open');

            document.querySelectorAll('.accordion-group.is-open').forEach(g => {
                g.classList.remove('is-open');
                g.querySelector('.accordion-body').style.maxHeight = '0';
            });

            if (!isOpen) {
                group.classList.add('is-open');
                body.style.maxHeight = body.scrollHeight + 'px';
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    // تحديث البانر عند اختيار جهاز
    document.querySelectorAll('input[name="equipment"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const banner = document.getElementById('selectedEquipmentBanner');
            const arSpan = document.getElementById('selectedEqAr');
            const enSpan = document.getElementById('selectedEqEn');
            const idSpan = document.getElementById('selectedEqId');

            if (radio.checked) {
                const tile = radio.closest('.check-tile');
                arSpan.innerText = tile.querySelector('span').innerText;
                enSpan.innerText = tile.querySelector('small').innerText;
                idSpan.innerText = radio.getAttribute('data-id');
                banner.classList.remove('hidden');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    });

    // افتح القسم الأول افتراضياً
    const firstGroup = document.querySelector('.accordion-group');
    if (firstGroup) {
        firstGroup.classList.add('is-open');
        const firstBody = firstGroup.querySelector('.accordion-body');
        setTimeout(() => {
            firstBody.style.maxHeight = firstBody.scrollHeight + 'px';
        }, 100);
    }
});
