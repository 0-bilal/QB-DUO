/**
 * MVR-script.js — مراجعة الفروع الشهرية (Monthly Video Review)
 * يستخدم:
 *   · QB.employees        (من js/config.js)
 *   · QB.translateBranch  (من js/config.js)
 *   · window.QBSession    (من js/session.js)
 *   · window.showModal()  (من js/common.js)
 *   · window.MVRCamera    (من MVR/MVR-camera.js)
 */
document.addEventListener('DOMContentLoaded', () => {

    // ── رابط الخدمة — مصدره js/endpoints.js فقط ─────────────────────────
    const SCRIPT_URL = window.QB_ENDPOINTS.MVR;

    // ── تهيئة الجلسة ─────────────────────────────────────────────────────
    QBSession.initPage();

    // ── تهيئة وحدة التسجيل ───────────────────────────────────────────────
    MVRCamera.init({
        onStateChange(state) {
            // تحديث حالة زر الإرسال حسب حالة التسجيل
            updateSubmitState();

            // في وضع review: لفت انتباه المستخدم لمراجعة الفيديو
            if (state === 'review') {
                const reviewSection = document.getElementById('mvr-state-review');
                if (reviewSection) {
                    reviewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        },
        onError(err) {
            const msg = err.name === 'NotAllowedError'
                ? 'لم يتم السماح بالوصول للكاميرا. يرجى منح الإذن من إعدادات المتصفح.'
                : 'تعذّر فتح الكاميرا. تأكد من أن الجهاز يدعم التسجيل.';
            showModal('error', 'خطأ في الكاميرا', msg);
        }
    });

    // ── عناصر النموذج ────────────────────────────────────────────────────
    const form      = document.getElementById('mvrForm');
    const submitBtn = document.getElementById('submitBtn');
    const keepBtn   = document.getElementById('mvrKeepBtn');
    const modalClose = document.getElementById('modalClose');

    // إغلاق المودال
    if (modalClose) {
        modalClose.onclick = () => document.getElementById('customModal').classList.add('hidden');
    }

    // تفعيل زر "استخدام هذا الفيديو"
    if (keepBtn) {
        keepBtn.onclick = () => {
            // تمرير الشاشة مباشرة إلى زر الإرسال
            if (submitBtn) {
                submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };
    }

    // ── تحديث حالة زر الإرسال ─────────────────────────────────────────────
    function updateSubmitState() {
        if (!submitBtn) return;
        const state = MVRCamera.getState();
        const hasVideo = MVRCamera.hasRecording();

        if (state === 'recording') {
            // منع الإرسال أثناء التسجيل
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
        } else if (hasVideo) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }

    // ── إرسال النموذج ────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const branchRadio = document.querySelector('input[name="branch"]:checked');
        const empId       = document.getElementById('employeeId').value;

        // التحقق من الفرع ورقم الموظف
        if (!branchRadio || !empId) {
            showModal('error', 'بيانات ناقصة', 'يرجى اختيار الفرع وإدخال رقم الموظف.');
            return;
        }

        const employeeName = QB.getEmployee(empId);
        if (!employeeName) {
            showModal('error', 'خطأ في التحقق', 'رقم الموظف المدخل غير مسجل في النظام.');
            return;
        }

        // التحقق من وجود تسجيل
        if (!MVRCamera.hasRecording()) {
            showModal('error', 'لا يوجد فيديو', 'يرجى تسجيل فيديو مراجعة الفرع قبل الإرسال.');
            return;
        }

        // التحقق من أن المستخدم في وضع المراجعة (وليس التسجيل)
        if (MVRCamera.getState() === 'recording') {
            showModal('error', 'التسجيل جارٍ', 'يرجى إيقاف التسجيل أولاً قبل الإرسال.');
            return;
        }

        // التحقق من وجود SCRIPT_URL
        if (!SCRIPT_URL) {
            showModal('error', 'الباكند غير مفعّل', 'سيتم تفعيل الإرسال لاحقاً — الواجهة جاهزة.');
            return;
        }

        // ── إرسال البيانات (Proxy الآمن عبر Apps Script) ──────────────
        // المتصفح لا يتصل بـ googleapis مطلقاً — كل شيء يمر عبر السيرفر
        // ─────────────────────────────────────────────────────────────
        showModal('loading', 'جاري التحضير للرفع', 'يتم التحقق...', true);
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';

        try {
            const blob = MVRCamera.getBlob();

            // اسم الفيديو: مراجعة الفرع الشهري - [اسم الفرع] - [YYYY-MM-DD]
            const _now      = new Date();
            const _dateStr  = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
            const _branch   = QB.translateBranch(branchRadio.value);
            const fileName  = `مراجعة الفرع الشهري - ${_branch} - ${_dateStr}.mp4`;

            // حجم كل قطعة: 5MB بايناري = ~6.7MB base64 (ضمن حدود Apps Script)
            const CHUNK_SIZE = 5 * 1024 * 1024;

            /**
             * تحويل ArrayBuffer → base64 بأمان بدون stack overflow
             * يعالج البيانات بكتل 64KB لتجنب مشكلة String.fromCharCode الكبيرة
             */
            function bufferToBase64(buffer) {
                const bytes  = new Uint8Array(buffer);
                let binary   = '';
                const BLOCK  = 65536;
                for (let i = 0; i < bytes.length; i += BLOCK) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOCK));
                }
                return btoa(binary);
            }

            // المرحلة 1: تهيئة جلسة الرفع في Apps Script
            // Apps Script ينشئ جلسة Resumable مع Drive ويحفظ رابطها بأمان
            const initResponse = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: new URLSearchParams({
                    payload: JSON.stringify({
                        action: 'initUpload',
                        fileName: fileName,
                        mimeType: blob.type,
                        fileSize: blob.size,
                        empId: empId,
                        employeeName: employeeName
                    })
                })
            });

            const initResult = await initResponse.json();
            if (initResult.result !== 'success') throw new Error(initResult.message);

            const sessionId   = initResult.sessionId;
            const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);

            showModal('loading', 'جاري رفع الفيديو', 'يرجى عدم إغلاق الصفحة حتى اكتمال شريط التقدم...', true);

            // المرحلة 2: إرسال الفيديو في قطع عبر Apps Script → Drive
            let fileId = null;

            for (let i = 0; i < totalChunks; i++) {
                const rangeStart = i * CHUNK_SIZE;
                const rangeEnd   = Math.min(rangeStart + CHUNK_SIZE, blob.size) - 1;

                const arrayBuffer = await blob.slice(rangeStart, rangeEnd + 1).arrayBuffer();
                const base64Chunk = bufferToBase64(arrayBuffer);

                // شريط التقدم: 0% → 90% أثناء الرفع، نحتفظ بـ 10% للمرحلة 3
                updateModalProgress(Math.round(((i + 1) / totalChunks) * 90));

                const chunkResponse = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    body: new URLSearchParams({
                        payload: JSON.stringify({
                            action: 'uploadChunk',
                            sessionId: sessionId,
                            base64Chunk: base64Chunk,
                            rangeStart: rangeStart,
                            rangeEnd: rangeEnd,
                            fileSize: blob.size,
                            empId: empId,
                            employeeName: employeeName
                        })
                    })
                });

                const chunkResult = await chunkResponse.json();

                if (chunkResult.result === 'complete') {
                    fileId = chunkResult.fileId;
                    break;
                } else if (chunkResult.result !== 'success') {
                    throw new Error(chunkResult.message || 'فشل رفع إحدى القطع.');
                }
            }

            if (!fileId) throw new Error('لم يكتمل رفع الفيديو. يرجى المحاولة مجدداً.');

            // المرحلة 3: تسجيل البيانات في Google Sheets
            updateModalProgress(95);
            const finalResponse = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: new URLSearchParams({
                    payload: JSON.stringify({
                        action: 'finishReport',
                        empId: empId,
                        employeeName: employeeName,
                        branch: QB.translateBranch(branchRadio.value),
                        fileId: fileId
                    })
                })
            });

            const finalResult = await finalResponse.json();
            if (finalResult.result === 'success') {
                updateModalProgress(100);
                QBSession.save(empId, branchRadio.value);
                showModal('success', 'تم الإرسال بنجاح', 'تم تسجيل مراجعة الفرع بنجاح.');
                form.reset();
                MVRCamera.reset();
            } else {
                throw new Error(finalResult.message);
            }

        } catch (error) {
            console.error('MVR Submission Error:', error);
            showModal('error', 'خطأ في العملية', error.message || 'حدث خطأ غير متوقع.');
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    });

});
