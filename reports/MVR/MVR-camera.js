/**
 * MVR-camera.js — وحدة تسجيل الفيديو
 * ─────────────────────────────────────────────────────────────
 * تتحكم في دورة حياة MediaRecorder:
 *   idle → recording → review → idle
 *
 * الاستخدام:
 *   MVRCamera.init({ onStateChange, onTimer })
 *   MVRCamera.start()
 *   MVRCamera.stop()
 *   MVRCamera.discard()
 *   MVRCamera.getBlob()       → Blob | null
 *   MVRCamera.hasRecording()  → boolean
 *   MVRCamera.getState()      → 'idle' | 'recording' | 'review'
 * ─────────────────────────────────────────────────────────────
 */

window.MVRCamera = (() => {

    // ── الحالة الداخلية ──────────────────────────────────────────────────
    let _state       = 'idle';   // 'idle' | 'recording' | 'review'
    let _stream      = null;
    let _recorder    = null;
    let _chunks      = [];
    let _blob        = null;
    let _timerInterval = null;
    let _elapsed     = 0;
    let _opts        = {};

    // ── عناصر DOM ────────────────────────────────────────────────────────
    let _els = {};

    // ── تحديد MIME type المدعوم ──────────────────────────────────────────
    function getMimeType() {
        const candidates = [
            'video/mp4;codecs=h264,aac',
            'video/mp4',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        for (const mime of candidates) {
            if (MediaRecorder.isTypeSupported(mime)) return mime;
        }
        return '';
    }

    // ── تنسيق الوقت (ث → MM:SS) ─────────────────────────────────────────
    function formatTime(sec) {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${m}:${s}`;
    }

    // ── تنسيق الحجم ──────────────────────────────────────────────────
    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // ── تغيير الحالة وإخبار المستمع ──────────────────────────────────────
    function setState(newState) {
        _state = newState;
        _renderState();
        if (typeof _opts.onStateChange === 'function') {
            _opts.onStateChange(newState);
        }
    }

    // ── تحديث واجهة المستخدم حسب الحالة ────────────────────────────────
    function _renderState() {
        const states = ['idle', 'recording', 'review'];
        states.forEach(s => {
            const el = document.getElementById(`mvr-state-${s}`);
            if (el) el.classList.toggle('hidden', s !== _state);
        });
    }

    // ── بدء التسجيل ─────────────────────────────────────────────────────
    async function start() {
        if (_state !== 'idle') return;

        try {
            _stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true
            });

            // عرض البث المباشر في عنصر الفيديو
            const liveEl = document.getElementById('mvrLiveVideo');
            if (liveEl) {
                liveEl.srcObject = _stream;
                liveEl.muted = true;
                liveEl.play().catch(() => {});
            }

            _chunks  = [];
            _blob    = null;
            _elapsed = 0;

            const mime = getMimeType();
            _recorder = new MediaRecorder(_stream, mime ? { mimeType: mime } : {});

            _recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) _chunks.push(e.data);
            };

            _recorder.onstop = () => {
                const finalMime = mime || 'video/webm';
                _blob = new Blob(_chunks, { type: finalMime });
                _stopStream();
                _stopTimer();

                // عرض الفيديو المسجّل في وضع المراجعة
                const reviewEl = document.getElementById('mvrReviewVideo');
                if (reviewEl) {
                    reviewEl.src = URL.createObjectURL(_blob);
                    reviewEl.load();
                }

                const sizeEl = document.getElementById('mvrVideoSize');
                if (sizeEl) {
                    sizeEl.textContent = `حجم الفيديو: ${formatSize(_blob.size)}`;
                }

                setState('review');
            };

            _recorder.start(1000); // تجميع البيانات كل ثانية
            _startTimer();
            setState('recording');

        } catch (err) {
            console.error('MVRCamera.start error:', err);
            if (typeof _opts.onError === 'function') {
                _opts.onError(err);
            }
        }
    }

    // ── إيقاف التسجيل ────────────────────────────────────────────────────
    function stop() {
        if (_state !== 'recording') return;
        if (_recorder && _recorder.state !== 'inactive') {
            _recorder.stop();
        }
        // setState → 'review' يحدث في onstop
    }

    // ── تجاهل التسجيل والرجوع للبدء ─────────────────────────────────────
    function discard() {
        _blob   = null;
        _chunks = [];
        const reviewEl = document.getElementById('mvrReviewVideo');
        if (reviewEl) {
            if (reviewEl.src) URL.revokeObjectURL(reviewEl.src);
            reviewEl.src = '';
        }
        setState('idle');
    }

    // ── مؤقت التسجيل ─────────────────────────────────────────────────────
    function _startTimer() {
        _elapsed = 0;
        _updateTimerDisplay();
        _timerInterval = setInterval(() => {
            _elapsed++;
            _updateTimerDisplay();
            if (typeof _opts.onTimer === 'function') _opts.onTimer(_elapsed);
        }, 1000);
    }

    function _stopTimer() {
        clearInterval(_timerInterval);
        _timerInterval = null;
    }

    function _updateTimerDisplay() {
        const el = document.getElementById('mvrTimer');
        if (el) el.textContent = formatTime(_elapsed);
    }

    // ── تحرير البث ───────────────────────────────────────────────────────
    function _stopStream() {
        if (_stream) {
            _stream.getTracks().forEach(t => t.stop());
            _stream = null;
        }
        const liveEl = document.getElementById('mvrLiveVideo');
        if (liveEl) {
            liveEl.srcObject = null;
            liveEl.src = '';
        }
    }

    // ── واجهة الأزرار ────────────────────────────────────────────────────
    function _bindButtons() {
        const startBtn   = document.getElementById('mvrStartBtn');
        const stopBtn    = document.getElementById('mvrStopBtn');
        const discardBtn = document.getElementById('mvrDiscardBtn');

        if (startBtn)   startBtn.onclick   = () => start();
        if (stopBtn)    stopBtn.onclick    = () => stop();
        if (discardBtn) discardBtn.onclick = () => discard();
    }

    // ─────────────────────────────────────────────────────────────────────
    // الواجهة العامة
    // ─────────────────────────────────────────────────────────────────────
    return {

        /**
         * تهيئة الوحدة — تُستدعى مرة واحدة في DOMContentLoaded
         * @param {Object} [opts]
         * @param {Function} [opts.onStateChange]  — يُستدعى عند تغيّر الحالة
         * @param {Function} [opts.onTimer]        — يُستدعى كل ثانية أثناء التسجيل
         * @param {Function} [opts.onError]        — يُستدعى عند خطأ في الكاميرا
         */
        init(opts = {}) {
            _opts = opts;
            _renderState();
            _bindButtons();
        },

        start,
        stop,
        discard,

        /** يُرجع Blob الفيديو المسجّل أو null */
        getBlob()      { return _blob; },

        /** هل يوجد تسجيل جاهز؟ */
        hasRecording() { return _blob !== null; },

        /** الحالة الحالية: 'idle' | 'recording' | 'review' */
        getState()     { return _state; },

        /** مسح كامل (للاستخدام بعد الإرسال الناجح) */
        reset() {
            _stopTimer();
            _stopStream();
            discard();
        }
    };

})();
