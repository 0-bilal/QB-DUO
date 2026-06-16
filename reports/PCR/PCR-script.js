/**
 * PCR-script.js — طلب عهدة (Petty Cash Request)
 * يستخدم:
 *   · QB.employees        (من js/config.js)
 *   · QB.translateBranch  (من js/config.js)
 *   · window.showModal()  (من js/common.js)
 *   · window.QBSession    (من js/session.js)
 */
document.addEventListener('DOMContentLoaded', () => {

    const SCRIPT_URL = window.QB_ENDPOINTS.PCR;

    // ── تهيئة الجلسة ─────────────────────────────────────────────────────
    QBSession.initPage();

    const els = {
        form:       document.getElementById('pcrForm'),
        submitBtn:  document.getElementById('submitBtn'),
        modalClose: document.getElementById('modalClose'),
        reqAmount:  document.getElementById('requestedAmount'),
        quickBtns:  document.querySelectorAll('.quick-btn')
    };

    // إغلاق المودال
    if (els.modalClose) {
        els.modalClose.onclick = () => document.getElementById('customModal').classList.add('hidden');
    }

    // ── أزرار الاختيار السريع للمبالغ المحددة مسبقاً ────────────────────
    els.quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.quickBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            els.reqAmount.value = btn.dataset.amount;
        });
    });

    // إزالة تفعيل أزرار الاختيار السريع عند الكتابة اليدوية
    els.reqAmount.addEventListener('input', () => {
        els.quickBtns.forEach(btn => {
            if (btn.dataset.amount !== els.reqAmount.value) {
                btn.classList.remove('active');
            } else {
                btn.classList.add('active');
            }
        });
    });

    // ── إرسال النموذج ────────────────────────────────────────────────────
    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const branchRadio     = document.querySelector('input[name="branch"]:checked');
        const empId           = document.getElementById('employeeId').value;
        const currentAmount   = document.getElementById('currentAmount').value;
        const requestedAmount = els.reqAmount.value;

        if (!branchRadio || !empId || !currentAmount || !requestedAmount) {
            showModal('error', 'بيانات ناقصة', 'يرجى إكمال جميع الحقول المطلوبة.');
            return;
        }

        const employeeName = QB.getEmployee(empId);
        if (!employeeName) {
            showModal('error', 'خطأ في التحقق', 'رقم الموظف المدخل غير مسجل في النظام.');
            return;
        }

        showModal('loading', 'جاري الإرسال', 'يرجى الانتظار، يتم تسجيل طلب العهدة...');
        els.submitBtn.disabled = true;
        els.submitBtn.style.opacity = "0.7";

        const payload = {
            branch:          QB.translateBranch(branchRadio.value),
            employeeName:    employeeName,
            currentAmount:   currentAmount,
            requestedAmount: requestedAmount,
            type:            "PCR"
        };

        try {
            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));

            await fetch(SCRIPT_URL, {
                method: 'POST',
                body: formData,
                mode: 'no-cors'  // يتجاوز CORS — البيانات تُرسَل والرد opaque
            });

            // الوصول للسطر التالي = الطلب أُرسل بنجاح
            QBSession.save(empId, branchRadio.value);
            showModal('success', 'تم الإرسال بنجاح', 'تم تسجيل طلب العهدة بنجاح');
            document.getElementById('currentAmount').value = '';
            els.reqAmount.value = '';
            els.quickBtns.forEach(b => b.classList.remove('active'));

        } catch (error) {
            console.error("Submission Error:", error);
            showModal('error', 'فشل في الإرسال', 'تعذّر تحقق من الاتصال بالإنترنت.');
        } finally {
            els.submitBtn.disabled = false;
            els.submitBtn.style.opacity = "1";
        }
    });
});
