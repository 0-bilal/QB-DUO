'use strict';

/**
 * RMM-script.js — سجل تصنيع المواد الأولية
 * يستخدم:
 *   · QB.employees        (من js/config.js)
 *   · QB.translateBranch  (من js/config.js)
 *   · window.showModal()  (من js/common.js)
 *   · window.QBSession    (من js/session.js)
 */

// ── تهيئة الجلسة (السكريبت يعمل في نهاية الصفحة والـ DOM جاهز) ──────────
document.addEventListener('DOMContentLoaded', () => QBSession.initPage());

/* =============================================
   CONFIGURATION
   ============================================= */

const SCRIPT_URL = window.QB_ENDPOINTS.RMM;

const OPERATIONS = {
    dough: {
        ar: 'تصنيع عجين ميني بان كيك',
        en: 'Mini Pancake Dough',
        summaryClass: 'si-dough',
        icon: 'cookie',
        resultTpl: (qty) => `تم تسجيل تصنيع ${formatGrams(qty)} من عجين ميني بان كيك`,
    },
    berry: {
        ar: 'تحويل الفراولة الطبيعي ← مجمد',
        en: 'Fresh Strawberry → Frozen',
        summaryClass: 'si-berry',
        icon: 'snowflake',
        resultTpl: (qty) => `تحويل ${formatGrams(qty)} فراولة طبيعي ← فراولة مجمد`,
    },
    red: {
        ar: 'تحويل التوت الأحمر الطبيعي ← مجمد',
        en: 'Fresh Red Raspberry → Frozen',
        summaryClass: 'si-red',
        icon: 'snowflake',
        resultTpl: (qty) => `تحويل ${formatGrams(qty)} توت أحمر طبيعي ← توت أحمر مجمد`,
    },
    black: {
        ar: 'تحويل التوت الأسود الطبيعي ← مجمد',
        en: 'Fresh Blackberry → Frozen',
        summaryClass: 'si-black',
        icon: 'snowflake',
        resultTpl: (qty) => `تحويل ${formatGrams(qty)} توت أسود طبيعي ← توت أسود مجمد`,
    },
};

function formatGrams(g) {
    const n = parseInt(g) || 0;
    if (n >= 1000) {
        const kg = (n / 1000).toFixed(n % 1000 === 0 ? 0 : 2);
        return `kg ${kg} (${n} g)`;
    }
    return `${n} g`;
}

function setHidden(el, hide) {
    if (!el) return;
    el.classList.toggle('hidden', hide);
}

/* =============================================
   TOGGLE — open/close operation panel
   ============================================= */

document.querySelectorAll('.mfg-toggle input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', function () {
        const opKey = this.dataset.op;
        const opEl  = document.getElementById(`op-${opKey}`);
        const body  = document.getElementById(`det-${opKey}`);
        const input = document.getElementById(`qty-${opKey}`);
        const res   = document.getElementById(`res-${opKey}`);

        if (this.checked) {
            opEl.classList.add('is-active');
            body.classList.add('is-open');
            setTimeout(() => {
                const firstInput = body.querySelector('input');
                if (firstInput) {
                    firstInput.focus({ preventScroll: true });
                    opEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 430);
        } else {
            opEl.classList.remove('is-active');
            body.classList.remove('is-open');
            if (input) input.value = '';
            if (res)   res.classList.add('hidden');
        }

        refreshSummary();
        lucide.createIcons();
    });
});

/* =============================================
   DOUGH INGREDIENTS
   ============================================= */

const DOUGH_INGREDIENTS = [
    { id: 'ing-egg',       ar: 'بيض',           unit: 'حبة', isCount: true  },
    { id: 'ing-sugar',     ar: 'سكر',           unit: 'g',   isCount: false },
    { id: 'ing-vanilla',   ar: 'فانيليا باودر', unit: 'g',   isCount: false },
    { id: 'ing-baking',    ar: 'بيكنج باودر',   unit: 'g',   isCount: false },
    { id: 'ing-sweetener', ar: 'محلي',          unit: 'g',   isCount: false },
    { id: 'ing-butter',    ar: 'زبدة',          unit: 'g',   isCount: false },
    { id: 'ing-flour',     ar: 'طحين',          unit: 'g',   isCount: false },
    { id: 'ing-milk',      ar: 'حليب',          unit: 'g',   isCount: false },
];

function getDoughIngredientsFilled() {
    return DOUGH_INGREDIENTS.map(ing => {
        const el  = document.getElementById(ing.id);
        const val = parseFloat(el?.value) || 0;
        return { ...ing, val };
    }).filter(i => i.val > 0);
}

function formatIngVal(ing) {
    if (ing.isCount) return `${ing.val} ${ing.unit}`;
    const n = ing.val;
    if (n >= 1000) {
        const kg = (n / 1000).toFixed(n % 1000 === 0 ? 0 : 2);
        return `kg ${kg} (${n}g)`;
    }
    return `${n} ${ing.unit}`;
}

function refreshDoughResult() {
    const totalInput = document.getElementById('qty-dough');
    const res        = document.getElementById('res-dough');
    const txt        = document.getElementById('res-dough-text');
    const totalVal   = parseInt(totalInput?.value) || 0;

    if (totalVal > 0 && res && txt) {
        txt.textContent = `تم تسجيل تصنيع ${formatGrams(totalVal)} من عجين ميني بان كيك`;
        res.classList.remove('hidden');
    } else if (res) {
        res.classList.add('hidden');
    }
}

function bindIngredientInputs() {
    document.querySelectorAll('.ing-input').forEach(input => {
        input.addEventListener('input', () => {
            refreshDoughResult();
            refreshSummary();
        });
        input.addEventListener('focus', function () {
            setTimeout(() => {
                this.closest('.ing-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 350);
        });
    });
}

/* =============================================
   QUANTITY INPUT — live result feedback
   ============================================= */

document.querySelectorAll('.qty-input').forEach(input => {
    if (input.classList.contains('ing-input')) return;

    input.addEventListener('input', function () {
        const opKey = this.dataset.op;

        if (opKey === 'dough') {
            refreshDoughResult();
            refreshSummary();
            return;
        }

        const val = parseInt(this.value);
        const res = document.getElementById(`res-${opKey}`);
        const txt = document.getElementById(`res-${opKey}-text`);

        if (val > 0 && txt && res) {
            txt.textContent = OPERATIONS[opKey].resultTpl(val);
            res.classList.remove('hidden');
        } else if (res) {
            res.classList.add('hidden');
        }

        refreshSummary();
    });
});

/* =============================================
   SUMMARY BANNER
   ============================================= */

function refreshSummary() {
    const banner = document.getElementById('mfgSummaryBanner');
    const list   = document.getElementById('summaryList');
    const count  = document.getElementById('summaryCount');

    const activeOps = [];

    Object.keys(OPERATIONS).forEach(opKey => {
        const chk = document.getElementById(`toggle-${opKey}`);
        const qty = parseInt(document.getElementById(`qty-${opKey}`)?.value) || 0;
        if (chk && chk.checked) {
            activeOps.push({ opKey, qty });
        }
    });

    if (activeOps.length === 0) {
        setHidden(banner, true);
        return;
    }

    setHidden(banner, false);
    count.textContent = `${activeOps.length} ${activeOps.length === 1 ? 'عملية' : 'عمليات'}`;

    list.innerHTML = activeOps.map(({ opKey, qty }) => {
        const op      = OPERATIONS[opKey];
        const qtyText = qty > 0 ? formatGrams(qty) : 'لم تُدخل كمية';
        return `
            <div class="summary-item ${op.summaryClass}">
                <i data-lucide="${op.icon}"></i>
                <span>${op.ar}</span>
                <span class="summary-item-qty">${qtyText}</span>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

/* =============================================
   RESET FORM
   ============================================= */

let pendingReset = false;

function resetForm() {
    document.querySelectorAll('input[name="branch"]').forEach(r => r.checked = false);

    const empEl = document.getElementById('employeeId');
    if (empEl) empEl.value = '';

    Object.keys(OPERATIONS).forEach(opKey => {
        const chk   = document.getElementById(`toggle-${opKey}`);
        const opEl  = document.getElementById(`op-${opKey}`);
        const body  = document.getElementById(`det-${opKey}`);
        const input = document.getElementById(`qty-${opKey}`);
        const res   = document.getElementById(`res-${opKey}`);

        if (chk)   chk.checked = false;
        if (opEl)  opEl.classList.remove('is-active');
        if (body)  body.classList.remove('is-open');
        if (input) input.value = '';
        if (res)   res.classList.add('hidden');
    });

    DOUGH_INGREDIENTS.forEach(ing => {
        const el = document.getElementById(ing.id);
        if (el) el.value = '';
    });

    refreshSummary();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
}

/* =============================================
   MODAL — يستخدم window.showModal من common.js
   ============================================= */

document.getElementById('modalClose').addEventListener('click', () => {
    setHidden(document.getElementById('customModal'), true);
    if (pendingReset) {
        pendingReset = false;
        resetForm();
    }
});

/* =============================================
   FORM SUBMIT
   ============================================= */

document.getElementById('mfgForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const branchEl = document.querySelector('input[name="branch"]:checked');
    if (!branchEl) {
        showModal('error', 'خطأ في الإدخال', 'يرجى اختيار الفرع أولاً');
        return;
    }
    const branchAr = QB.translateBranch(branchEl.value);

    const empId = document.getElementById('employeeId').value.trim();
    if (!empId) {
        showModal('error', 'خطأ في الإدخال', 'يرجى إدخال رقم الموظف للتحقق');
        return;
    }

    const employeeName = QB.getEmployee(empId);
    if (!employeeName) {
        showModal('error', 'رقم موظف غير صحيح', `لا يوجد موظف برقم: ${empId}\nيرجى التحقق من الرقم وإعادة المحاولة`);
        return;
    }

    const activeOps = [];
    Object.keys(OPERATIONS).forEach(opKey => {
        const chk = document.getElementById(`toggle-${opKey}`);
        if (chk && chk.checked) {
            const qty = parseInt(document.getElementById(`qty-${opKey}`)?.value) || 0;
            activeOps.push({ opKey, qty });
        }
    });

    if (activeOps.length === 0) {
        showModal('error', 'خطأ في الإدخال', 'يرجى تفعيل عملية تصنيع واحدة على الأقل');
        return;
    }

    const missingQty = activeOps.find(o => o.qty < 1);
    if (missingQty) {
        const opName = OPERATIONS[missingQty.opKey].ar;
        showModal('error', 'كمية مفقودة', `يرجى إدخال الكمية الإجمالية لعملية:\n${opName}`);
        return;
    }

    let doughField  = '';
    let doughIngs   = '';
    let berryField  = '';
    let redField    = '';
    let blackField  = '';

    activeOps.forEach(({ opKey, qty }) => {
        const formatted = formatGrams(qty);
        if (opKey === 'dough') {
            doughField = formatted;
            const ings = getDoughIngredientsFilled();
            if (ings.length > 0) {
                doughIngs = ings.map(i => `${i.ar}: ${formatIngVal(i)}`).join('، ');
            }
        } else if (opKey === 'berry') {
            berryField = formatted;
        } else if (opKey === 'red') {
            redField = formatted;
        } else if (opKey === 'black') {
            blackField = formatted;
        }
    });

    const payload = {
        branch:           branchAr,
        employeeName:     employeeName,
        dough:            doughField,
        doughIngredients: doughIngs,
        berry:            berryField,
        red:              redField,
        black:            blackField
    };

    showModal('loading', 'جارٍ الإرسال...', 'يتم رفع بيانات التصنيع إلى السجل');

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.result === 'success') {
            QBSession.save(empId, branchEl.value);
            pendingReset = true;
            showModal(
                'success',
                'تم الإرسال بنجاح',
                `تم تسجيل التقرير رقم #${result.id}\nفرع ${branchAr} — ${employeeName}`
            );
        } else {
            showModal('error', 'فشل الإرسال', result.message || 'حدث خطأ غير معروف');
        }
    })
    .catch(err => {
        showModal('error', 'فشل الاتصال', `تعذر :\n${err.message}`);
    });
});
