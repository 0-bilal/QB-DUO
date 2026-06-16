const ECLCamera = (() => {

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
        employeeName: 'غير محدد',
        equipmentName: 'غير محدد',
        onCapture: null
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
        _overlay.id = 'eclCamOverlay';
        
        const style = document.createElement('style');
        style.textContent = `
            #eclCamOverlay {
                position: fixed; inset: 0; z-index: 9999;
                background: #f3f4f6;
                display: flex; flex-direction: column;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                direction: rtl;
            }
            .ecl-cam__header {
                width: 100%; padding: 20px 16px;
                background: linear-gradient(135deg, #c62828 0%, #8e0000 100%);
                display: flex; align-items: center; justify-content: space-between;
                box-shadow: 0 4px 15px rgba(198, 40, 40, 0.2);
                border-radius: 0 0 20px 20px;
                z-index: 10;
            }
            .ecl-cam__title { color: #fff; display: flex; flex-direction: column; }
            .ecl-cam__title span { font-size: 16px; font-weight: 700; }
            .ecl-cam__title small { font-size: 10px; opacity: 0.8; letter-spacing: 1px; margin-top: 2px; }
            
            #eclCloseBtn {
                background: rgba(255,255,255,0.2); color: #fff;
                border: none; border-radius: 10px; width: 40px; height: 40px;
                display: flex; align-items: center; justify-content: center; cursor: pointer;
            }

            .ecl-cam__viewport {
                flex: 1; position: relative; overflow: hidden;
                margin: 15px; border-radius: 20px;
                border: 3px solid #fff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                background: #000;
            }
            #eclCamVideo, #eclCamCanvas { width: 100%; height: 100%; object-fit: cover; }

            .ecl-cam__info-bar {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
                padding: 12px; border-top: 1px solid rgba(255,255,255,0.2);
            }
            .ecl-cam__info-bar span { color: #fff; font-size: 11px; display: block; margin-bottom: 2px; }

            .ecl-cam__controls {
                padding: 30px 20px;
                background: #fff;
                border-radius: 30px 30px 0 0;
                display: flex; flex-direction: column;
                align-items: center; gap: 20px;
                box-shadow: 0 -10px 25px rgba(0,0,0,0.05);
            }
            .ecl-cam__btn-row { width: 100%; display: flex; justify-content: center; position: relative; }
            
            #eclCaptureBtn {
                width: 80px; height: 80px; border-radius: 50%;
                background: #fff; border: 4px solid #f3f4f6;
                box-shadow: 0 0 0 4px #c62828;
                cursor: pointer; transition: 0.3s;
                display: flex; align-items: center; justify-content: center;
                color: #c62828; padding: 0;
            }
            #eclCaptureBtn i { width: 32px; height: 32px; }
            #eclCaptureBtn:active { transform: scale(0.92); }

            #eclConfirmBtn {
                width: 100%; max-width: 320px;
                background: #c62828; color: white;
                border: none; border-radius: 15px;
                padding: 16px; font-size: 16px; font-weight: 700;
                display: flex; align-items: center; justify-content: center;
                gap: 10px; box-shadow: 0 8px 20px rgba(198, 40, 40, 0.3);
                cursor: pointer; transition: 0.3s;
            }
            #eclConfirmBtn i { width: 20px; height: 20px; }
            #eclConfirmBtn:active { transform: scale(0.98); }

            .hidden { display: none !important; }
        `;
        document.head.appendChild(style);

        _overlay.innerHTML = `
            <div class="ecl-cam__header">
                <div class="ecl-cam__title">
                    <span>كاميرا الوثيق </span>
                    <small>QB-ECL CAMERA</small>
                </div>
                <button id="eclCloseBtn"><i data-lucide="x"></i></button>
            </div>

            <div class="ecl-cam__viewport">
                <video id="eclCamVideo" autoplay playsinline muted></video>
                <canvas id="eclCamCanvas" class="hidden"></canvas>
                <div class="ecl-cam__info-bar" id="eclInfoBar">
                    <span id="eclInfoTime"></span>
                    <span id="eclInfoEmployee"></span>
                    <span id="eclInfoEquipment"></span>
                </div>
            </div>

            <div class="ecl-cam__controls">
                <div class="ecl-cam__btn-row">
                    <button id="eclCaptureBtn">
                        <i data-lucide="camera" id="captureIcon"></i>
                        <i data-lucide="rotate-ccw" id="retakeIcon" class="hidden"></i>
                    </button>
                </div>
                <button id="eclConfirmBtn" class="hidden">
                    <i data-lucide="check-circle"></i>
                    اعتماد الصورة واستخدامها
                </button>
            </div>
        `;

        document.body.appendChild(_overlay);

        _video = document.getElementById('eclCamVideo');
        _canvas = document.getElementById('eclCamCanvas');
        _captureBtn = document.getElementById('eclCaptureBtn');
        _confirmBtn = document.getElementById('eclConfirmBtn');
        _closeBtn = document.getElementById('eclCloseBtn');

        _updateInfoBar();

        _captureBtn.onclick = _handleCaptureClick;
        _confirmBtn.onclick = _handleConfirm;
        _closeBtn.onclick = () => { _stopStream(); _resetState(); };

        if(window.lucide) lucide.createIcons();
    }

    function _updateInfoBar() {
        document.getElementById('eclInfoTime').innerText = 'الوقت: ' + new Date().toLocaleString('er-ER');
        
        
    }

    async function _startCamera() {
        try {
            _stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            _video.srcObject = _stream;
        } catch (err) {
            console.error("Camera error:", err);
            alert("تعذر فتح الكاميرا. تأكد من إعطاء الصلاحيات.");
        }
    }

    function _handleCaptureClick() {
        if (_capturedImage) {
            // حالة إعادة الالتقاط
            _capturedImage = null;
            _video.classList.remove('hidden');
            _canvas.classList.add('hidden');
            _setCaptureMode();
        } else {
            // حالة الالتقاط
            _capture();
        }
    }

    function _capture() {
        const context = _canvas.getContext('2d');
        _canvas.width = _video.videoWidth;
        _canvas.height = _video.videoHeight;
        context.drawImage(_video, 0, 0);
        
        // رسم الـ Watermark برمجياً على الكانفاس (اختياري، حالياً يظهر عبر CSS)
        _addWatermarkToCanvas(context);

        _capturedImage = _canvas.toDataURL('image/jpeg', 0.7);
        _video.classList.add('hidden');
        _canvas.classList.remove('hidden');
        _setConfirmMode();
    }

    function _addWatermarkToCanvas(ctx) {
        const w = _canvas.width;
        const h = _canvas.height;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, h - 100, w, 100);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "right";
        ctx.fillText(new Date().toLocaleString('er-ER'), w - 20, h - 70);
        
       
    }

    function _setCaptureMode() {
        document.getElementById('captureIcon').classList.remove('hidden');
        document.getElementById('retakeIcon').classList.add('hidden');
        _confirmBtn.classList.add('hidden');
        if(window.lucide) lucide.createIcons();
    }

    function _setConfirmMode() {
        document.getElementById('captureIcon').classList.add('hidden');
        document.getElementById('retakeIcon').classList.remove('hidden');
        _confirmBtn.classList.remove('hidden');
        if(window.lucide) lucide.createIcons();
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

    return { init, open, getImage: () => _capturedImage, reset: _resetState };

})();