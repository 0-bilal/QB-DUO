/**
 * EDR-script.js — تقرير نهاية اليوم
 * يستخدم:
 *   · QB.employees        (من js/config.js)
 *   · QB.translateBranch  (من js/config.js)
 *   · window.showModal()  (من js/common.js)
 */
document.addEventListener('DOMContentLoaded', () => {

    const SCRIPT_URL = window.QB_ENDPOINTS.EDR;

    // ── تهيئة الجلسة ─────────────────────────────────────────────────────
    QBSession.initPage();

    // ── الحقول المالية موزعة على ثلاثة أقسام ───────────────────────────────
    const fields = [
        { key: 'cashSales',     ar: 'مبيعات الكاش',           en: 'Cash Sales',          icon: 'banknote',     required: true,  inSales: true,  group: 'sales'   },
        { key: 'networkTotal',  ar: 'إجمالي الشبكة',          en: 'Network Total',       icon: 'credit-card',  required: true,  inSales: true,  group: 'sales'   },
        { key: 'jahezTotal',    ar: 'إجمالي تطبيق جاهز',      en: 'Jahez App Total',     icon: 'smartphone',   required: true,  inSales: true,  group: 'sales'   },
        { key: 'hungerTotal',   ar: 'إجمالي تطبيق هنقرستيشن', en: 'HungerStation Total', icon: 'smartphone',   required: true,  inSales: true,  group: 'sales'   },
        { key: 'daySalesTotal', ar: 'إجمالي المبيعات لليوم',  en: 'Total Day Sales',     icon: 'trending-up',  required: true,  inSales: false, group: 'sales'   },
        { key: 'fullCashTotal', ar: 'إجمالي الكاش الكامل',    en: 'Full Cash Total',     icon: 'wallet',       required: true,  inSales: false, group: 'cash'    },
        { key: 'custodyRemain', ar: 'المتبقي من العهدة',      en: 'Remaining Custody',   icon: 'landmark',     required: true,  inSales: false, group: 'custody' },
        { key: 'purchases',     ar: 'مبلغ المشتريات',         en: 'Purchases Amount',    icon: 'shopping-cart',required: false, inSales: false, group: 'custody' }
    ];

    const grids = {
        sales:   document.getElementById('salesGrid'),
        cash:    document.getElementById('cashGrid'),
        custody: document.getElementById('custodyGrid')
    };

    const els = {
        form:        document.getElementById('edrReportForm'),
        submitBtn:   document.getElementById('submitBtn'),
        employeeId:  document.getElementById('employeeId'),
        calcSales:   document.getElementById('calcSales'),
        calcDiff:    document.getElementById('calcDiff'),
        summaryHint: document.getElementById('summaryHint'),
        modalClose:  document.getElementById('modalClose'),
        modalTitle:  document.getElementById('modalTitle')
    };

    // ── بناء الحقول المالية ──────────────────────────────────────────────
    function buildField(field) {
        const row = document.createElement('div');
        row.className = 'field-row';
        row.setAttribute('data-field', field.key);
        row.innerHTML = `
            <div class="field-head">
                <div class="field-icon">
                    <i data-lucide="${field.icon}"></i>
                </div>
                <div class="field-text">
                    <span class="field-name">
                        ${field.ar}
                        ${field.required
                            ? '<span class="req-star">*</span>'
                            : '<span class="opt-tag">(اختياري)</span>'}
                    </span>
                    <span class="field-en">${field.en}</span>
                </div>
            </div>
            <div class="field-input-wrap">
                <input type="number" inputmode="decimal" step="0.01" min="0"
                       class="field-value" data-field="${field.key}"
                       data-in-sales="${field.inSales}" placeholder="0.00"
                       enterkeyhint="next">
                <span class="currency-tag">ر.س</span>
            </div>
        `;
        return row;
    }

    fields.forEach(field => {
        const target = grids[field.group];
        if (target) target.appendChild(buildField(field));
    });
    lucide.createIcons();

    // ── طي / فتح الأقسام ────────────────────────────────────────────────
    document.querySelectorAll('.section-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.section-card');
            card.classList.toggle('open');
        });
    });

    const allInputs = [
        els.employeeId,
        ...document.querySelectorAll('.field-value')
    ];

    function centerField(input) {
        const row = input.closest('.field-row') || input.closest('.card');
        if (!row) return;
        setTimeout(() => {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 280);
    }

    function focusNext(currentInput) {
        const idx = allInputs.indexOf(currentInput);
        if (idx === -1) return;
        const next = allInputs[idx + 1];
        if (next) {
            const nextCard = next.closest('.section-card');
            if (nextCard && !nextCard.classList.contains('open')) {
                nextCard.classList.add('open');
            }
            next.focus();
        } else {
            currentInput.blur();
        }
    }

    allInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('focus', () => {
            centerField(input);
            const row = input.closest('.field-row');
            if (row) row.classList.add('is-focused');
        });
        input.addEventListener('blur', () => {
            const row = input.closest('.field-row');
            if (row) row.classList.remove('is-focused');
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                focusNext(input);
            }
        });
    });

    // ── الحساب التلقائي للملخص ──────────────────────────────────────────
    function recalcSummary() {
        let calculated = 0;
        document.querySelectorAll('.field-value').forEach(input => {
            if (input.getAttribute('data-in-sales') === 'true') {
                calculated += parseFloat(input.value) || 0;
            }
        });

        const daySales = parseFloat(
            document.querySelector('.field-value[data-field="daySalesTotal"]').value
        ) || 0;

        const diff = daySales - calculated;

        els.calcSales.innerText = calculated.toFixed(2);
        els.calcDiff.innerText  = diff.toFixed(2);

        els.calcDiff.classList.remove('match-ok', 'match-bad');
        if (daySales === 0 && calculated === 0) {
            els.summaryHint.innerText = 'أدخل القيم لمطابقة إجمالي المبيعات تلقائياً.';
        } else if (Math.abs(diff) < 0.01) {
            els.calcDiff.classList.add('match-ok');
            els.summaryHint.innerText = 'المبالغ متطابقة تماماً.';
        } else {
            els.calcDiff.classList.add('match-bad');
            els.summaryHint.innerText = diff > 0
                ? 'يوجد زيادة في إجمالي المبيعات لليوم عن مجموع الكاش والشبكة والتطبيقات.'
                : 'يوجد عجز في إجمالي المبيعات لليوم عن مجموع الكاش والشبكة والتطبيقات.';
        }
    }

    document.querySelectorAll('.fields-grid').forEach(grid => {
        grid.addEventListener('input', (e) => {
            if (e.target.classList.contains('field-value')) {
                e.target.closest('.field-row').classList.remove('row-error');
                recalcSummary();
            }
        });
    });

    // ── سلوك إغلاق المودال (خاص بهذه الصفحة) ────────────────────────────
    if (els.modalClose) {
        els.modalClose.onclick = () => {
            document.getElementById('customModal').classList.add('hidden');
            if (els.modalTitle.innerText === 'تم الإرسال') {
                resetFullForm();
            }
        };
    }

    function resetFullForm() {
        els.form.reset();
        document.querySelectorAll('.field-row').forEach(r => r.classList.remove('row-error'));
        recalcSummary();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── إرسال النموذج ────────────────────────────────────────────────────
    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const empId  = els.employeeId.value.trim();
        const branch = document.querySelector('input[name="branch"]:checked');

        if (!branch) {
            showModal('error', 'بيانات ناقصة', 'يرجى اختيار الفرع.');
            return;
        }
        if (!empId || !QB.getEmployee(empId)) {
            showModal('error', 'كود غير صحيح', 'يرجى التأكد من إدخال رقم الموظف الصحيح.');
            return;
        }

        let missing = [];
        const values = {};

        fields.forEach(field => {
            const input = document.querySelector(`.field-value[data-field="${field.key}"]`);
            const row   = input.closest('.field-row');
            const raw   = input.value.trim();
            row.classList.remove('row-error');

            if (raw === '') {
                if (field.required) {
                    row.classList.add('row-error');
                    missing.push(field.ar);
                }
                values[field.key] = field.required ? null : 0;
            } else {
                const num = parseFloat(raw);
                if (isNaN(num) || num < 0) {
                    row.classList.add('row-error');
                    missing.push(field.ar);
                    values[field.key] = null;
                } else {
                    values[field.key] = num;
                }
            }
        });

        if (missing.length > 0) {
            showModal('error', 'تقرير غير مكتمل',
                `يرجى تعبئة الحقول التالية: ${missing.slice(0, 3).join('، ')}`);
            return;
        }

        showModal('loading', 'جاري الإرسال', 'يرجى الانتظار، يتم حفظ تقرير نهاية اليوم...');
        els.submitBtn.disabled = true;

        const calculatedSales = (values.cashSales + values.networkTotal +
                                 values.jahezTotal + values.hungerTotal);
        const difference = values.daySalesTotal - calculatedSales;

        const payload = {
            reportType:      "تقرير نهاية اليوم",
            branch:          QB.translateBranch(branch.value),
            branchKey:       branch.value,
            employeeName:    QB.getEmployee(empId),
            cashSales:       values.cashSales,
            networkTotal:    values.networkTotal,
            jahezTotal:      values.jahezTotal,
            hungerTotal:     values.hungerTotal,
            daySalesTotal:   values.daySalesTotal,
            fullCashTotal:   values.fullCashTotal,
            custodyRemain:   values.custodyRemain,
            purchases:       values.purchases,
            calculatedSales: calculatedSales,
            difference:      difference
        };

        const formData = new URLSearchParams();
        formData.append('payload', JSON.stringify(payload));

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: formData,
                mode: 'cors'
            });

            const result = await response.json();

            if (result.result === 'success') {
                QBSession.save(empId, branch.value);
                showModal('success', 'تم الإرسال',
                    `تم حفظ تقرير نهاية اليوم بنجاح برقم: ${result.id}`);
                resetFullForm();
            } else {
                throw new Error(result.message || 'فشل في معالجة الطلب');
            }
        } catch (error) {
            console.error("Submission Error:", error);
            showModal('error', 'فشل الإرسال',
                'حدث خطأ يرجى التأكد من جودة الإنترنت وحاول مجدداً.');
        } finally {
            els.submitBtn.disabled = false;
        }
    });

});
