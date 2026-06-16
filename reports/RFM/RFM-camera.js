/**
 * RFM-camera.js — كاميرا طلب التوريد
 * QB-Sentinel | برمجيات QB
 * نفس أسلوب FIL-camera.js مع علامة مائية خاصة بـ RFM
 */
const RFMCamera = (() => {

    let _stream        = null;
    let _capturedImage = null;
    let _config        = {};
    let _overlay       = null;
    let _video         = null;
    let _canvas        = null;
    let _captureBtn    = null;
    let _confirmBtn    = null;
    let _closeBtn      = null;

    function init(options) {
        _config = { ...options };
    }

    function open() {
        _resetState();
        _buildOverlay();
        _startCamera();
    }

    function _resetState() {
        _capturedImage = null;
        if (_overlay) { document.body.removeChild(_overlay); _overlay = null; }
    }

    function _buildOverlay() {
        _overlay = document.createElement('div');
        _overlay.id = 'rfmCamOverlay';

        const style = document.createElement('style');
        style.id = 'rfmCamStyle';
        style.textContent = `
            #rfmCamOverlay {
                position: fixed; inset: 0; z-index: 9999;
                background: #f3f4f6;
                display: flex; flex-direction: column;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                direction: rtl;
            }
            .rfm-cam__header {
                width: 100%; padding: 20px 16px;
                background: linear-gradient(135deg, #c62828 0%, #8e0000 100%);
                display: flex; align-items: center; justify-content: space-between;
                box-shadow: 0 4px 15px rgba(198,40,40,0.25);
                border-radius: 0 0 20px 20px; z-index: 10;
            }
            .rfm-cam__title { color: #fff; display: flex; flex-direction: column; }
            .rfm-cam__title span { font-size: 16px; font-weight: 700; }
            .rfm-cam__title small { font-size: 10px; opacity: 0.8; letter-spacing: 1px; margin-top: 2px; }
            #rfmCloseBtn {
                background: rgba(255,255,255,0.2); color: #fff;
                border: none; border-radius: 10px; width: 40px; height: 40px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: background 0.2s;
            }
            #rfmCloseBtn:active { background: rgba(255,255,255,0.35); }
            .rfm-cam__viewport {
                flex: 1; position: relative; overflow: hidden;
                margin: 15px; border-radius: 20px;
                border: 3px solid #fff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.12);
                background: #000;
            }
            #rfmCamVideo, #rfmCamCanvas {
                width: 100%; height: 100%; object-fit: cover; display: block;
            }
            .rfm-cam__info-bar {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
                padding: 12px; border-top: 1px solid rgba(255,255,255,0.2);
                pointer-events: none;
            }
            .rfm-cam__info-bar span { color: #fff; font-size: 11px; display: block; margin-bottom: 2px; }
            .rfm-cam__controls {
                padding: 28px 20px 30px; background: #fff;
                border-radius: 30px 30px 0 0;
                display: flex; flex-direction: column; align-items: center;
                gap: 18px; box-shadow: 0 -10px 25px rgba(0,0,0,0.06);
            }
            .rfm-cam__btn-row {
                width: 100%; display: flex; justify-content: center; position: relative;
            }
            #rfmCaptureBtn {
                width: 80px; height: 80px; border-radius: 50%;
                background: #fff; border: 4px solid #f3f4f6;
                box-shadow: 0 0 0 4px #c62828;
                cursor: pointer; transition: transform 0.2s;
                display: flex; align-items: center; justify-content: center;
                color: #c62828; padding: 0;
            }
            #rfmCaptureBtn i { width: 32px; height: 32px; }
            #rfmCaptureBtn:active { transform: scale(0.92); }
            #rfmConfirmBtn {
                width: 100%; max-width: 320px;
                background: linear-gradient(135deg, #c62828, #8e0000);
                color: white; border: none; border-radius: 15px;
                padding: 16px; font-size: 16px; font-weight: 700;
                display: flex; align-items: center; justify-content: center;
                gap: 10px; box-shadow: 0 8px 20px rgba(198,40,40,0.3);
                cursor: pointer; transition: transform 0.2s;
            }
            #rfmConfirmBtn i { width: 20px; height: 20px; }
            #rfmConfirmBtn:active { transform: scale(0.98); }
            .rfm-cam-hidden { display: none !important; }
        `;
        if (!document.getElementById('rfmCamStyle')) document.head.appendChild(style);

        _overlay.innerHTML = `
            <div class="rfm-cam__header">
                <div class="rfm-cam__title">
                    <span>رفع عرض السعر / Quote</span>
                    <small>RFM — QB-SENTINEL CAMERA</small>
                </div>
                <button id="rfmCloseBtn"><i data-lucide="x"></i></button>
            </div>
            <div class="rfm-cam__viewport">
                <video id="rfmCamVideo" autoplay playsinline muted></video>
                <canvas id="rfmCamCanvas" class="rfm-cam-hidden"></canvas>
                <div class="rfm-cam__info-bar">
                    <span id="rfmInfoTime"></span>
                    <span id="rfmInfoContext"></span>
                </div>
            </div>
            <div class="rfm-cam__controls">
                <div class="rfm-cam__btn-row">
                    <button id="rfmCaptureBtn">
                        <i data-lucide="camera"     id="rfmCapIcon"></i>
                        <i data-lucide="rotate-ccw" id="rfmRetakeIcon" class="rfm-cam-hidden"></i>
                    </button>
                </div>
                <button id="rfmConfirmBtn" class="rfm-cam-hidden">
                    <i data-lucide="check-circle"></i>
                    اعتماد الصورة / Use Photo
                </button>
            </div>
        `;

        document.body.appendChild(_overlay);

        _video      = document.getElementById('rfmCamVideo');
        _canvas     = document.getElementById('rfmCamCanvas');
        _captureBtn = document.getElementById('rfmCaptureBtn');
        _confirmBtn = document.getElementById('rfmConfirmBtn');
        _closeBtn   = document.getElementById('rfmCloseBtn');

        // معلومات السياق
        const ctxEl = document.getElementById('rfmInfoContext');
        if (ctxEl && _config.contextLine) ctxEl.textContent = _config.contextLine;

        _captureBtn.onclick = _handleCaptureClick;
        _confirmBtn.onclick = _handleConfirm;
        _closeBtn.onclick   = () => { _stopStream(); _resetState(); };

        if (window.lucide) lucide.createIcons();
        _startTimeClock();
    }

    function _startTimeClock() {
        const tick = () => {
            if (!_overlay) return;
            const el = document.getElementById('rfmInfoTime');
            if (el) el.textContent = new Date().toLocaleString('ar-SA');
            setTimeout(tick, 1000);
        };
        tick();
    }

    async function _startCamera() {
        try {
            _stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            _video.srcObject = _stream;
        } catch (err) {
            console.error('RFM Camera error:', err);
            alert('تعذر فتح الكاميرا. تأكد من إعطاء الصلاحيات.\nCould not open camera — check permissions.');
            _stopStream();
            _resetState();
        }
    }

    function _handleCaptureClick() {
        if (_capturedImage) {
            _capturedImage = null;
            _video.classList.remove('rfm-cam-hidden');
            _canvas.classList.add('rfm-cam-hidden');
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

        _capturedImage = _canvas.toDataURL('image/jpeg', 0.85);
        _video.classList.add('rfm-cam-hidden');
        _canvas.classList.remove('rfm-cam-hidden');
        _setConfirmMode();
    }

    function _addWatermark(ctx) {
        const w = _canvas.width;
        const h = _canvas.height;
        const dateStr = new Date().toLocaleString('ar-SA');

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, h - 130, w, 130);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'right';

        const trackLine  = _config.trackId   ? 'رقم الطلب: ' + _config.trackId : 'طلب توريد مواد';
        const branchLine = _config.branchName ? 'الفرع: ' + _config.branchName  : '';
        const supplierLine = _config.supplierName ? 'المورد: ' + _config.supplierName : '';

        ctx.fillText(trackLine,   w - 30, h - 90);
        if (branchLine)   ctx.fillText(branchLine,   w - 30, h - 56);
        if (supplierLine) ctx.fillText(supplierLine, w - 30, h - 22);

        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(dateStr, 20, h - 20);
    }

    function _setCaptureMode() {
        document.getElementById('rfmCapIcon').classList.remove('rfm-cam-hidden');
        document.getElementById('rfmRetakeIcon').classList.add('rfm-cam-hidden');
        _confirmBtn.classList.add('rfm-cam-hidden');
        if (window.lucide) lucide.createIcons();
    }

    function _setConfirmMode() {
        document.getElementById('rfmCapIcon').classList.add('rfm-cam-hidden');
        document.getElementById('rfmRetakeIcon').classList.remove('rfm-cam-hidden');
        _confirmBtn.classList.remove('rfm-cam-hidden');
        if (window.lucide) lucide.createIcons();
    }

    function _handleConfirm() {
        if (_config.onCapture) _config.onCapture(_capturedImage);
        _stopStream();
        _resetState();
    }

    function _stopStream() {
        if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    }

    return { init, open };

})();
