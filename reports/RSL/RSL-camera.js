/**
 * RSL-camera.js — وحدة الكاميرا لسجل معايرة المكونات
 * ─────────────────────────────────────────────────────────────
 * مطابقة لكاميرا FIL في الهوية البصرية، مع إضافة بصمة على الصورة
 * تحتوي على: اسم المنتج + المكونات + الفرع + الموظف + الوقت.
 *
 * الاستخدام:
 *   RSLCamera.init({
 *     productName:   'عصير مانجو',
 *     sizeName:      'كاسة كبيرة',
 *     branchName:    'الدوادمي',
 *     employeeName:  'بلال',
 *     ingredients:   ['حليب ( 10 مل )', 'مانجو ( 200 جرام )'],
 *     onCapture:     (base64) => { ... }
 *   });
 *   RSLCamera.open();
 */
const RSLCamera = (() => {

    let _stream        = null;
    let _capturedImage = null;
    let _config        = {};

    let _overlay     = null;
    let _video       = null;
    let _canvas      = null;
    let _captureBtn  = null;
    let _confirmBtn  = null;
    let _closeBtn    = null;

    const _defaults = {
        productName:  'غير محدد',
        sizeName:     '',
        branchName:   'غير محدد',
        employeeName: 'غير محدد',
        ingredients:  []
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
        _overlay.id = 'rslCamOverlay';

        const style = document.createElement('style');
        style.textContent = `
            #rslCamOverlay {
                position: fixed; inset: 0; z-index: 9999;
                background: #f3f4f6;
                display: flex; flex-direction: column;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                direction: rtl;
            }
            .rsl-cam__header {
                width: 100%; padding: 20px 16px;
                background: linear-gradient(135deg, #c62828 0%, #8e0000 100%);
                display: flex; align-items: center; justify-content: space-between;
                box-shadow: 0 4px 15px rgba(198,40,40,0.25);
                border-radius: 0 0 20px 20px;
                z-index: 10;
            }
            .rsl-cam__title { color: #fff; display: flex; flex-direction: column; }
            .rsl-cam__title span { font-size: 16px; font-weight: 700; }
            .rsl-cam__title small { font-size: 10px; opacity: 0.8; letter-spacing: 1px; margin-top: 2px; }

            #rslCloseBtn {
                background: rgba(255,255,255,0.2); color: #fff;
                border: none; border-radius: 10px; width: 40px; height: 40px;
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                transition: background 0.2s;
            }
            #rslCloseBtn:active { background: rgba(255,255,255,0.35); }

            .rsl-cam__viewport {
                flex: 1; position: relative; overflow: hidden;
                margin: 15px; border-radius: 20px;
                border: 3px solid #fff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.12);
                background: #000;
            }
            #rslCamVideo, #rslCamCanvas {
                width: 100%; height: 100%; object-fit: cover;
                display: block;
            }
            .rsl-cam__info-bar {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
                padding: 12px; border-top: 1px solid rgba(255,255,255,0.2);
                pointer-events: none;
            }
            .rsl-cam__info-bar span {
                color: #fff; font-size: 11px; display: block; margin-bottom: 2px;
            }

            .rsl-cam__controls {
                padding: 28px 20px 30px;
                background: #fff;
                border-radius: 30px 30px 0 0;
                display: flex; flex-direction: column;
                align-items: center; gap: 18px;
                box-shadow: 0 -10px 25px rgba(0,0,0,0.06);
            }
            .rsl-cam__btn-row {
                width: 100%; display: flex; justify-content: center; position: relative;
            }
            #rslCaptureBtn {
                width: 80px; height: 80px; border-radius: 50%;
                background: #fff; border: 4px solid #f3f4f6;
                box-shadow: 0 0 0 4px #c62828;
                cursor: pointer; transition: transform 0.2s;
                display: flex; align-items: center; justify-content: center;
                color: #c62828; padding: 0;
            }
            #rslCaptureBtn i { width: 32px; height: 32px; }
            #rslCaptureBtn:active { transform: scale(0.92); }

            #rslConfirmBtn {
                width: 100%; max-width: 320px;
                background: #c62828; color: white;
                border: none; border-radius: 15px;
                padding: 16px; font-size: 16px; font-weight: 700;
                display: flex; align-items: center; justify-content: center;
                gap: 10px; box-shadow: 0 8px 20px rgba(198,40,40,0.3);
                cursor: pointer; transition: transform 0.2s;
            }
            #rslConfirmBtn i { width: 20px; height: 20px; }
            #rslConfirmBtn:active { transform: scale(0.98); }

            .hidden { display: none !important; }
        `;
        document.head.appendChild(style);

        _overlay.innerHTML = `
            <div class="rsl-cam__header">
                <div class="rsl-cam__title">
                    <span>تصوير المنتج</span>
                    <small>QB-RSL CAMERA</small>
                </div>
                <button id="rslCloseBtn"><i data-lucide="x"></i></button>
            </div>

            <div class="rsl-cam__viewport">
                <video id="rslCamVideo" autoplay playsinline muted></video>
                <canvas id="rslCamCanvas" class="hidden"></canvas>
                <div class="rsl-cam__info-bar">
                    <span id="rslInfoProduct"></span>
                    <span id="rslInfoTime"></span>
                </div>
            </div>

            <div class="rsl-cam__controls">
                <div class="rsl-cam__btn-row">
                    <button id="rslCaptureBtn">
                        <i data-lucide="camera"     id="rslCapIcon"></i>
                        <i data-lucide="rotate-ccw" id="rslRetakeIcon" class="hidden"></i>
                    </button>
                </div>
                <button id="rslConfirmBtn" class="hidden">
                    <i data-lucide="check-circle"></i>
                    اعتماد الصورة واستخدامها
                </button>
            </div>
        `;

        document.body.appendChild(_overlay);

        _video      = document.getElementById('rslCamVideo');
        _canvas     = document.getElementById('rslCamCanvas');
        _captureBtn = document.getElementById('rslCaptureBtn');
        _confirmBtn = document.getElementById('rslConfirmBtn');
        _closeBtn   = document.getElementById('rslCloseBtn');

        const prodEl = document.getElementById('rslInfoProduct');
        if (prodEl) prodEl.innerText = 'المنتج: ' + _config.productName +
            (_config.sizeName ? ' — ' + _config.sizeName : '');

        _captureBtn.onclick = _handleCaptureClick;
        _confirmBtn.onclick = _handleConfirm;
        _closeBtn.onclick   = () => { _stopStream(); _resetState(); };

        if (window.lucide) lucide.createIcons();
        _startTimeClock();
    }

    function _startTimeClock() {
        const tick = () => {
            if (!_overlay) return;
            const el = document.getElementById('rslInfoTime');
            if (el) el.innerText = 'الوقت: ' + new Date().toLocaleString('er-ER');
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
            console.error('Camera error:', err);
            alert('تعذر فتح الكاميرا. تأكد من إعطاء الصلاحيات.');
            _stopStream();
            _resetState();
        }
    }

    function _handleCaptureClick() {
        if (_capturedImage) {
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

        _capturedImage = _canvas.toDataURL('image/jpeg', 0.85);
        _video.classList.add('hidden');
        _canvas.classList.remove('hidden');
        _setConfirmMode();
    }

    // ── بصمة على الصورة: المنتج + المكونات + الفرع + الوقت ──────────────
    function _addWatermark(ctx) {
        const w = _canvas.width;
        const h = _canvas.height;

        // أحجام ديناميكية بحسب أبعاد الصورة
        const base       = Math.max(w, h);
        const titleSize  = Math.round(base * 0.026);
        const lineSize   = Math.round(base * 0.020);
        const pad        = Math.round(base * 0.022);
        const lineGap    = Math.round(lineSize * 1.45);

        const ingredients = Array.isArray(_config.ingredients) ? _config.ingredients : [];
        const dateStr  = new Date().toLocaleString('er-ER');
        const titleTxt = _config.productName + (_config.sizeName ? ' — ' + _config.sizeName : '');
        const metaTxt  = `${_config.branchName} | ${_config.employeeName} | ${dateStr}`;

        // عدد الأسطر: عنوان + سطر معلومات + أسطر المكونات
        const linesCount = 2 + ingredients.length;
        const boxHeight  = pad * 2 + titleSize + lineGap * (linesCount - 0.2);

        // خلفية شبه شفافة
        const grad = ctx.createLinearGradient(0, h - boxHeight, 0, h);
        grad.addColorStop(0, 'rgba(0,0,0,0.35)');
        grad.addColorStop(1, 'rgba(0,0,0,0.78)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h - boxHeight, w, boxHeight);

        // شريط أحمر علوي للبصمة (هوية QB)
        ctx.fillStyle = '#c62828';
        ctx.fillRect(0, h - boxHeight, w, Math.max(4, Math.round(base * 0.006)));

        ctx.textAlign = 'right';
        let y = h - boxHeight + pad + titleSize;

        // العنوان (اسم المنتج)
        ctx.fillStyle = '#ffd5d5';
        ctx.font = `bold ${titleSize}px Arial`;
        ctx.fillText(titleTxt, w - pad, y);

        // معلومات الفرع/الموظف/الوقت
        y += lineGap;
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `${Math.round(lineSize * 0.92)}px Arial`;
        ctx.fillText(metaTxt, w - pad, y);

        // المكونات
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${lineSize}px Arial`;
        ingredients.forEach(line => {
            y += lineGap;
            ctx.fillText('• ' + line, w - pad, y);
        });

        // ختم QB في الزاوية اليسرى السفلى
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `bold ${Math.round(lineSize * 0.9)}px Arial`;
        ctx.fillText('QB-Sentinel', pad, h - pad);
    }

    function _setCaptureMode() {
        document.getElementById('rslCapIcon').classList.remove('hidden');
        document.getElementById('rslRetakeIcon').classList.add('hidden');
        _confirmBtn.classList.add('hidden');
        if (window.lucide) lucide.createIcons();
    }

    function _setConfirmMode() {
        document.getElementById('rslCapIcon').classList.add('hidden');
        document.getElementById('rslRetakeIcon').classList.remove('hidden');
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
