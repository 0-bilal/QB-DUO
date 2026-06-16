const FILCamera = (() => {

    // ─── الحالة الداخلية ───────────────────────────────────
    let _stream         = null;
    let _capturedImage  = null;
    let _config         = {};

    let _overlay        = null;
    let _video          = null;
    let _canvas         = null;
    let _captureBtn     = null;
    let _confirmBtn     = null;
    let _closeBtn       = null;

    // ─── الإعدادات الافتراضية ──────────────────────────────
    const _defaults = {

    };

    function init(options) {
        _config = { ..._defaults, ...options };
    }

    function open() {
        _resetState();
        _buildOverlay();
        _startCamera();
    }

    function _resetState() {
        _capturedImage = null;
        if (_overlay) {
            document.body.removeChild(_overlay);
            _overlay = null;
        }
    }

    function _buildOverlay() {
        _overlay = document.createElement('div');
        _overlay.id = 'filCamOverlay';

        const style = document.createElement('style');
        style.textContent = `
            #filCamOverlay {
                position: fixed; inset: 0; z-index: 9999;
                background: #f3f4f6;
                display: flex; flex-direction: column;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                direction: rtl;
            }

            /* ── Header ── */
            .fil-cam__header {
                width: 100%; padding: 20px 16px;
                background: linear-gradient(135deg, #c62828 0%, #8e0000 100%);
                display: flex; align-items: center; justify-content: space-between;
                box-shadow: 0 4px 15px rgba(22, 163, 74, 0.25);
                border-radius: 0 0 20px 20px;
                z-index: 10;
            }
            .fil-cam__title { color: #fff; display: flex; flex-direction: column; }
            .fil-cam__title span { font-size: 16px; font-weight: 700; }
            .fil-cam__title small { font-size: 10px; opacity: 0.8; letter-spacing: 1px; margin-top: 2px; }

            #filCloseBtn {
                background: rgba(255,255,255,0.2); color: #fff;
                border: none; border-radius: 10px; width: 40px; height: 40px;
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                transition: background 0.2s;
            }
            #filCloseBtn:active { background: rgba(255,255,255,0.35); }

            /* ── Viewport ── */
            .fil-cam__viewport {
                flex: 1; position: relative; overflow: hidden;
                margin: 15px; border-radius: 20px;
                border: 3px solid #fff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.12);
                background: #000;
            }
            #filCamVideo, #filCamCanvas {
                width: 100%; height: 100%; object-fit: cover;
                display: block;
            }

            /* ── Info bar (bottom of viewport) ── */
            .fil-cam__info-bar {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
                padding: 12px; border-top: 1px solid rgba(255,255,255,0.2);
                pointer-events: none;
            }
            .fil-cam__info-bar span {
                color: #fff; font-size: 11px; display: block; margin-bottom: 2px;
            }

            /* ── Controls ── */
            .fil-cam__controls {
                padding: 28px 20px 30px;
                background: #fff;
                border-radius: 30px 30px 0 0;
                display: flex; flex-direction: column;
                align-items: center; gap: 18px;
                box-shadow: 0 -10px 25px rgba(0,0,0,0.06);
            }
            .fil-cam__btn-row {
                width: 100%; display: flex; justify-content: center; position: relative;
            }

            #filCaptureBtn {
                width: 80px; height: 80px; border-radius: 50%;
                background: #fff; border: 4px solid #f3f4f6;
                box-shadow: 0 0 0 4px #c62828;
                cursor: pointer; transition: transform 0.2s;
                display: flex; align-items: center; justify-content: center;
                color: #c62828; padding: 0;
            }
            #filCaptureBtn i { width: 32px; height: 32px; }
            #filCaptureBtn:active { transform: scale(0.92); }

            #filConfirmBtn {
                width: 100%; max-width: 320px;
                background: #c62828; color: white;
                border: none; border-radius: 15px;
                padding: 16px; font-size: 16px; font-weight: 700;
                display: flex; align-items: center; justify-content: center;
                gap: 10px; box-shadow: 0 8px 20px rgba(22, 163, 74, 0.3);
                cursor: pointer; transition: transform 0.2s;
            }
            #filConfirmBtn i { width: 20px; height: 20px; }
            #filConfirmBtn:active { transform: scale(0.98); }

            .hidden { display: none !important; }
        `;
        document.head.appendChild(style);

        _overlay.innerHTML = `
            <div class="fil-cam__header">
                <div class="fil-cam__title">
                    <span>كاميرا</span>
                    <small>QB-FIL CAMERA</small>
                </div>
                <button id="filCloseBtn"><i data-lucide="x"></i></button>
            </div>

            <div class="fil-cam__viewport">
                <video id="filCamVideo" autoplay playsinline muted></video>
                <canvas id="filCamCanvas" class="hidden"></canvas>
                <div class="fil-cam__info-bar">
                    <span id="filInfoTime"></span>
                </div>
            </div>

            <div class="fil-cam__controls">
                <div class="fil-cam__btn-row">
                    <button id="filCaptureBtn">
                        <i data-lucide="camera"     id="filCapIcon"></i>
                        <i data-lucide="rotate-ccw" id="filRetakeIcon" class="hidden"></i>
                    </button>
                </div>
                <button id="filConfirmBtn" class="hidden">
                    <i data-lucide="check-circle"></i>
                    اعتماد الصورة واستخدامها
                </button>
            </div>
        `;

        document.body.appendChild(_overlay);

        _video      = document.getElementById('filCamVideo');
        _canvas     = document.getElementById('filCamCanvas');
        _captureBtn = document.getElementById('filCaptureBtn');
        _confirmBtn = document.getElementById('filConfirmBtn');
        _closeBtn   = document.getElementById('filCloseBtn');

        _captureBtn.onclick = _handleCaptureClick;
        _confirmBtn.onclick = _handleConfirm;
        _closeBtn.onclick   = () => { _stopStream(); _resetState(); };

        if (window.lucide) lucide.createIcons();
        _startTimeClock();
    }

    // ساعة حية في شريط المعلومات
    function _startTimeClock() {
        const tick = () => {
            if (!_overlay) return;
            const el = document.getElementById('filInfoTime');
            if (el) el.innerText = 'الوقت: ' + new Date().toLocaleString('er-ER');
            setTimeout(tick, 1000);
        };
        tick();
    }

    async function _startCamera() {
        try {
            _stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            _video.srcObject = _stream;
        } catch (err) {
            console.error("Camera error:", err);
            alert("تعذر فتح الكاميرا. تأكد من إعطاء الصلاحيات.");
            _stopStream();
            _resetState();
        }
    }

    function _handleCaptureClick() {
        if (_capturedImage) {
            // إعادة الالتقاط
            _capturedImage = null;
            _video.classList.remove('hidden');
            _canvas.classList.add('hidden');
            _setCaptureMode();
        } else {
            _capture();
        }
    }

    function _capture() {
        const ctx = _canvas.getContext('2d');
        _canvas.width  = _video.videoWidth;
        _canvas.height = _video.videoHeight;
        ctx.drawImage(_video, 0, 0);
        _addWatermark(ctx);

        _capturedImage = _canvas.toDataURL('image/jpeg', 0.8);
        _video.classList.add('hidden');
        _canvas.classList.remove('hidden');
        _setConfirmMode();
    }

    function _addWatermark(ctx) {
        const w = _canvas.width;
        const h = _canvas.height;

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, h - 120, w, 120);

        ctx.fillStyle = "white";
        ctx.font = "bold 26px Arial";
        ctx.textAlign = "right";
        const dateStr = new Date().toLocaleString('er-ER');

        ctx.fillText(`فحص جودة الفواكه — ${_config.branchName}`, w - 30, h - 80);
        ctx.fillText(`الموظف: ${_config.employeeName} | ${dateStr}`, w - 30, h - 40);
    }

    function _setCaptureMode() {
        document.getElementById('filCapIcon').classList.remove('hidden');
        document.getElementById('filRetakeIcon').classList.add('hidden');
        _confirmBtn.classList.add('hidden');
        if (window.lucide) lucide.createIcons();
    }

    function _setConfirmMode() {
        document.getElementById('filCapIcon').classList.add('hidden');
        document.getElementById('filRetakeIcon').classList.remove('hidden');
        _confirmBtn.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    }

    function _handleConfirm() {
        if (_config.onCapture) _config.onCapture(_capturedImage);
        _stopStream();
        _resetState();
    }

    function _stopStream() {
        if (_stream) {
            _stream.getTracks().forEach(t => t.stop());
            _stream = null;
        }
    }

    return { init, open };

})();