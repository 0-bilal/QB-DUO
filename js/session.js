/**
 * QB-Sentinel — js/session.js
 * ─────────────────────────────────────────────────────────────
 * إدارة جلسة الموظف (رقمه + فرعه) عبر جميع التقارير.
 *
 * الميزات:
 *   1. حفظ تلقائي فوري — عند اكتمال الفرع + رقم الموظف الصحيح
 *      يُخفى حقلا الإدخال ويظهر بطاقة الجلسة في الحال، بدون تحديث.
 *   2. مودال التصريح — زر "تغيير" يفتح نافذة منبثقة تطلب رقم
 *      التصريح (6 أرقام). إن صح الرقم تُمسح الجلسة وتظهر الحقول.
 *   3. تطبيق الجلسة عند التحميل — إن وُجدت جلسة محفوظة تُطبَّق
 *      تلقائياً لحظة فتح الصفحة.
 *
 * يُصدِّر:
 *   · window.QBSession.save(empId, branch)
 *   · window.QBSession.get()
 *   · window.QBSession.clear()
 *   · window.QBSession.initPage(opts)
 * ─────────────────────────────────────────────────────────────
 */

window.QBSession = (() => {

    const KEY_EMP    = 'qb_session_empId';
    const KEY_BRANCH = 'qb_session_branch';

    // ── مودال رقم التصريح ────────────────────────────────────────────────

    /** يُنشئ مودال التصريح ويُضيفه للـ DOM (مرة واحدة فقط) */
    function buildPinModal() {
        if (document.getElementById('qbPinModal')) return;

        const el = document.createElement('div');
        el.id = 'qbPinModal';
        el.className = 'modal-overlay hidden';
        el.innerHTML = `
            <div class="modal-content">
                <div class="modal-icon">
                    <i data-lucide="shield-alert" class="error-icon"
                       style="color:var(--primary);width:48px;height:48px;"></i>
                </div>
                <h3>رقم التصريح / Authorization</h3>
                <p style="margin:0 0 4px;">أدخل رقم التصريح</p>
                <p style="font-size:12px;color:#aaa;margin:0 0 2px;">
                    Enter the 6-digit code to reset session
                </p>
                <input
                    type="password"
                    id="qbPinInput"
                    class="code-input"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="6"
                    autocomplete="off"
                    placeholder="● ● ● ● ● ●">
                <p id="qbPinError" class="pin-error-msg hidden">
                    ✗ رقم التصريح غير صحيح — Incorrect code
                </p>
                <div class="modal-footer">
                    <button id="qbPinConfirm" class="modal-btn">تأكيد / Confirm</button>
                    <button id="qbPinCancel"  class="modal-btn secondary">إلغاء / Cancel</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * يعرض مودال التصريح.
     * @param {Function} onSuccess — يُستدعى إذا أدخل المستخدم الرقم الصحيح
     */
    function showPinModal(onSuccess) {
        buildPinModal();

        const modal      = document.getElementById('qbPinModal');
        const input      = document.getElementById('qbPinInput');
        const errorMsg   = document.getElementById('qbPinError');
        const confirmBtn = document.getElementById('qbPinConfirm');
        const cancelBtn  = document.getElementById('qbPinCancel');

        // إعادة تهيئة المودال في كل فتح
        input.value = '';
        errorMsg.classList.add('hidden');
        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 120);

        // أرقام فقط
        input.oninput = () => {
            input.value = input.value.replace(/\D/g, '').slice(0, 6);
            errorMsg.classList.add('hidden');
        };

        function tryConfirm() {
            const correctPin = (window.QB && window.QB.resetPin)
                ? String(window.QB.resetPin)
                : '112233';

            if (input.value === correctPin) {
                modal.classList.add('hidden');
                onSuccess();
            } else {
                errorMsg.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        }

        input.onkeydown   = (e) => { if (e.key === 'Enter') tryConfirm(); };
        confirmBtn.onclick = tryConfirm;
        cancelBtn.onclick  = () => { modal.classList.add('hidden'); };

        // إغلاق عند النقر خارج المودال
        modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    }

    // ── الكائن العام QBSession ────────────────────────────────────────────

    return {

        /** حفظ بيانات الجلسة */
        save(empId, branch) {
            localStorage.setItem(KEY_EMP,    String(empId));
            localStorage.setItem(KEY_BRANCH, String(branch));
        },

        /** استرجاع الجلسة — يُرجع { empId, branch } أو null */
        get() {
            const empId  = localStorage.getItem(KEY_EMP);
            const branch = localStorage.getItem(KEY_BRANCH);
            if (!empId || !branch) return null;
            return { empId, branch };
        },

        /** مسح الجلسة من localStorage */
        clear() {
            localStorage.removeItem(KEY_EMP);
            localStorage.removeItem(KEY_BRANCH);
        },

        /**
         * initPage — تهيئة صفحة تقرير
         *
         * · عند وجود جلسة: تُخفى بطاقات الإدخال فوراً وتظهر بطاقة الجلسة.
         * · عند اكتمال الفرع + رقم الموظف لأول مرة: يُحفظ ويُطبَّق فوراً.
         * · زر "تغيير": يفتح مودال رقم التصريح قبل المسح.
         *
         * @param {Object}   [opts]
         * @param {string}   [opts.branchCard='branchCard']
         * @param {string}   [opts.idCard='idCard']
         * @param {string[]} [opts.extraHide=[]]   — معرّفات بطاقات إضافية تُخفى
         * @param {Function} [opts.onApply]         — callback بعد تطبيق الجلسة(s)
         * @param {Function} [opts.onReset]         — callback بعد مسح الجلسة
         * @returns {boolean} true إن طُبِّقت جلسة محفوظة
         */
        initPage({ branchCard = 'branchCard', idCard = 'idCard',
                   extraHide = [], onApply, onReset } = {}) {

            const savedInfoEl = document.getElementById('savedInfo');
            const displayUser = document.getElementById('displayUser');
            const displayBrEl = document.getElementById('displayBranch');
            const resetBtn    = document.getElementById('resetBtn');
            const allHideIds  = [branchCard, idCard, ...extraHide];

            // ── مساعد: إخفاء البطاقات (مع انيميشن اختياري) ─────────────
            const hideCards = (animate = false) => {
                allHideIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el || el.classList.contains('hidden')) return;
                    if (animate) {
                        el.classList.add('session-fade-out');
                        el.addEventListener('animationend', () => {
                            el.classList.remove('session-fade-out');
                            el.classList.add('hidden');
                        }, { once: true });
                    } else {
                        el.classList.add('hidden');
                    }
                });
            };

            // ── مساعد: إظهار البطاقات ────────────────────────────────────
            const showCards = () => allHideIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });

            // ── تطبيق جلسة على الواجهة ───────────────────────────────────
            // animate=true → عند الحفظ الأول من المستخدم (تدريجي)
            // animate=false → عند تحميل الصفحة (فوري بلا انيميشن)
            const applySession = (s, animate = false) => {
                if (!window.QB) return false;
                const name = QB.getEmployee(s.empId);
                if (!name) return false;

                // ملء بيانات بطاقة الجلسة
                if (displayUser)  displayUser.textContent  = name;
                if (displayBrEl)  displayBrEl.textContent  = QB.translateBranch(s.branch);

                // إظهار البطاقة مع الانيميشن إن طُلب
                if (savedInfoEl) {
                    savedInfoEl.classList.remove('hidden', 'session-slide-in');
                    // force reflow لإعادة تشغيل الأنيميشن في كل مرة
                    void savedInfoEl.offsetWidth;
                    if (animate) savedInfoEl.classList.add('session-slide-in');
                }

                // ملء حقول النموذج المخفية (لضمان صحة الإرسال)
                const radio = document.querySelector(
                    `input[name="branch"][value="${s.branch}"]`);
                if (radio) radio.checked = true;

                const empInput = document.getElementById('employeeId');
                if (empInput) empInput.value = s.empId;

                hideCards(animate);

                if (typeof onApply === 'function') onApply(s);
                return true;
            };

            // ── مسح الجلسة وإعادة الواجهة ────────────────────────────────
            const clearSession = () => {
                this.clear();
                if (savedInfoEl) savedInfoEl.classList.add('hidden');

                document.querySelectorAll('input[name="branch"]')
                    .forEach(r => r.checked = false);
                const empInput = document.getElementById('employeeId');
                if (empInput) empInput.value = '';

                showCards();
                if (typeof onReset === 'function') onReset();
            };

            // ── زر "تغيير" ← يفتح مودال التصريح ─────────────────────────
            if (resetBtn) {
                resetBtn.onclick = () => showPinModal(clearSession);
            }

            // ── حفظ تلقائي فوري ──────────────────────────────────────────
            // يُشغَّل عند كل تغيير في الفرع أو رقم الموظف.
            // إن اكتمل كلاهما بشكل صحيح → حفظ + تطبيق فوري على الواجهة.
            const tryAutoSave = () => {
                // لا تحفظ إن كانت الجلسة نشطة بالفعل (savedInfo ظاهر)
                if (savedInfoEl && !savedInfoEl.classList.contains('hidden')) return;

                const radio    = document.querySelector('input[name="branch"]:checked');
                const empInput = document.getElementById('employeeId');
                if (!radio || !empInput) return;

                const empId = empInput.value.trim();
                if (!empId || !window.QB) return;

                const name = QB.getEmployee(empId);
                if (!name) return;

                // اكتملت البيانات — احفظ وطبِّق فوراً مع انيميشن
                this.save(empId, radio.value);
                applySession({ empId, branch: radio.value }, true);
            };

            // ربط مستمعي الأحداث
            document.querySelectorAll('input[name="branch"]').forEach(r => {
                r.addEventListener('change', tryAutoSave);
            });

            const empInput = document.getElementById('employeeId');
            if (empInput) {
                empInput.addEventListener('input', tryAutoSave);
            }

            // ── تطبيق الجلسة عند تحميل الصفحة ───────────────────────────
            const existing = this.get();
            if (existing) {
                return applySession(existing);
            }

            return false;
        }
    };

})();
