/**
 * CPV-script.js — سند صرف نقدية
 * يستخدم:
 *   · QB.employees        (من js/config.js)
 *   · QB.translateBranch  (من js/config.js)
 *   · window.showModal()  (من js/common.js)
 */
document.addEventListener('DOMContentLoaded', () => {

    const SCRIPT_URL = window.QB_ENDPOINTS.CPV;

    // ── تهيئة الجلسة ─────────────────────────────────────────────────────
    QBSession.initPage();

    const els = {
        form:      document.getElementById('paymentVoucherForm'),
        submitBtn: document.getElementById('submitBtn'),
        modalClose: document.getElementById('modalClose')
    };

    // إغلاق المودال
    if (els.modalClose) {
        els.modalClose.onclick = () => document.getElementById('customModal').classList.add('hidden');
    }

    // ── إرسال النموذج ────────────────────────────────────────────────────
    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const branchRadio  = document.querySelector('input[name="branch"]:checked');
        const empId        = document.getElementById('employeeId').value;
        const reason       = document.getElementById('paymentReason').value;
        const amount       = document.getElementById('amount').value;
        const beneficiary  = document.getElementById('beneficiaryPhone').value;

        if (!branchRadio || !empId || !reason || !amount) {
            showModal('error', 'بيانات ناقصة', 'يرجى إكمال جميع الحقول المطلوبة.');
            return;
        }

        const employeeName = QB.getEmployee(empId);
        if (!employeeName) {
            showModal('error', 'خطأ في التحقق', 'رقم الموظف المدخل غير مسجل في النظام.');
            return;
        }

        showModal('loading', 'جاري الإرسال', 'يرجى الانتظار، يتم تسجيل سند الصرف...');
        els.submitBtn.disabled = true;
        els.submitBtn.style.opacity = "0.7";

        const payload = {
            branch:       QB.translateBranch(branchRadio.value),
            employeeName: employeeName,
            reason:       reason,
            amount:       amount,
            beneficiary:  beneficiary || "None",
            type:         "PV"
        };

        try {
            const formData = new URLSearchParams();
            formData.append('payload', JSON.stringify(payload));

            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: formData,
                mode: 'cors'
            });

            const result = await response.json();

            if (result.result === 'success') {
                QBSession.save(empId, branchRadio.value);
                showModal('success', 'تم الإرسال بنجاح', `تم تسجيل السند برقم: ${result.id}`);
                els.form.reset();
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Submission Error:", error);
            showModal('error', 'فشل في الإرسال', 'حدث خطأ.');
        } finally {
            els.submitBtn.disabled = false;
            els.submitBtn.style.opacity = "1";
        }
    });
});
