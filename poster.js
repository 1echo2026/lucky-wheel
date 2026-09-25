/* ============================================================
   推广海报：把封面图 + 活动信息 + 二维码合成一张图片
   用法：LuckyPoster.open({ title, subtitle, lines, url, cover, footer })
   说明：二维码用 qrcode-generator 库，自托管在同源 assets/qrcode.js，无需联网；
        封面必须是同源图片，否则 canvas 会被污染，toDataURL 会失败。
   ============================================================ */
(function () {
  'use strict';

  var W = 750, H = 1180;
  /* 二维码库自托管在同源 assets/qrcode.js（单文件 qrcode-generator，无需联网） */
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
  var RED = '#8C1C13', RED2 = '#A2553F', GOLD = '#D2A544', INK = '#5A2A18';

  var cssDone = false, modal = null, qrMod = null;

  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    var st = document.createElement('style');
    st.textContent =
      '.p-mask{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;'
      + 'padding:18px;overflow:auto;background:radial-gradient(120% 80% at 50% 40%,rgba(78,5,9,.72),rgba(20,2,4,.9));}'
      + '.p-mask.open{display:flex;}'
      + '.p-box{width:100%;max-width:400px;text-align:center;}'
      + '.p-tip{color:#FFF3D6;font-size:13px;letter-spacing:.5px;margin-bottom:12px;}'
      + '.p-box img{width:100%;border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.45);background:#FFF9F0;}'
      + '.p-load{color:#FFF3D6;font-size:15px;padding:70px 0;}'
      + '.p-box .btnrow{margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}'
      + '.p-box .btn{width:auto;min-width:132px;height:44px;padding:0 20px;font-size:16px;'
      + 'display:inline-flex;align-items:center;justify-content:center;text-decoration:none;}'
      + '.p-box .btn.ghost{background:#FFF9F0;color:#8C1C13;border:1px solid rgba(210,165,68,.85);'
      + 'box-shadow:0 3px 12px rgba(0,0,0,.28);}';
    document.head.appendChild(st);
  }

  function buildModal() {
    if (modal) return modal;
    injectCss();
    modal = document.createElement('div');
    modal.className = 'p-mask';
    modal.id = 'posterMask';
    modal.innerHTML = '<div class="p-box">'
      + '<div class="p-tip">长按图片保存到相册，再转发给老师</div>'
      + '<div class="p-load" id="posterLoad">正在生成海报…</div>'
      + '<img id="posterImg" alt="活动推广海报" style="display:none">'
      + '<div class="btnrow" id="posterBtns" style="display:none">'
      + '<a class="btn" id="posterDl" download="活动推广海报.png">下载图片</a>'
      + '<button type="button" class="btn ghost" id="posterClose">关闭</button>'
      + '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (ev) { if (ev.target === modal) close(); });
    modal.querySelector('#posterClose').addEventListener('click', close);
    return modal;
  }

  function close() { if (modal) modal.classList.remove('open'); }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function loadImage(src, cb) {
    var im = new Image();
    if (src.indexOf('data:') !== 0) im.crossOrigin = 'anonymous';
    im.onload = function () { cb(im); };
    im.onerror = function () { cb(null); };
    im.src = src;
  }

  function loadQR(cb) {
    if (window.qrcode) return cb(true);
    var s = document.createElement('script');
    s.src = 'assets/qrcode.js';
    s.onload = function () { cb(!!window.qrcode); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }

  /* 生成二维码图片：按模块数取整数倍 cell，避免缩放发虚 */
  function makeQR(text, size, cb) {
    if (!window.qrcode || !text) return cb(null);
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var n = qr.getModuleCount();
      var cell = Math.max(2, Math.floor(size / n));
      loadImage(qr.createDataURL(cell, 0), function (im) { cb(im); });
    } catch (e) { cb(null); }
  }

  function drawCover(g, im, x, y, w, h) {
    var s = Math.max(w / im.width, h / im.height);
    var dw = im.width * s, dh = im.height * s;
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    g.restore();
  }

  function compose(data, cover, qr, cb) {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');

    /* 暖白底 + 描金外框 */
    g.fillStyle = '#FFF9F0';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = GOLD;
    g.lineWidth = 4;
    roundRect(g, 14, 14, W - 28, H - 28, 18);
    g.stroke();

    /* 顶部封面；无图时用红金渐变头图 */
    var headH = 430;
    if (cover) {
      drawCover(g, cover, 14, 14, W - 28, headH);
    } else {
      var lg = g.createLinearGradient(0, 14, 0, headH);
      lg.addColorStop(0, '#B33A2B');
      lg.addColorStop(1, '#8C1C13');
      g.fillStyle = lg;
      g.fillRect(14, 14, W - 28, headH);
    }
    g.fillStyle = 'rgba(210,165,68,.9)';
    g.fillRect(14, headH + 12, W - 28, 4);

    var cy = headH + 108;
    g.textAlign = 'center';

    g.fillStyle = RED;
    g.font = 'bold 48px ' + FONT;
    g.fillText(data.title, W / 2, cy);

    if (data.subtitle) {
      g.fillStyle = RED2;
      g.font = '26px ' + FONT;
      g.fillText(data.subtitle, W / 2, cy + 46);
    }

    var lines = data.lines || [];
    g.fillStyle = INK;
    g.font = '26px ' + FONT;
    for (var i = 0; i < lines.length; i++) g.fillText(lines[i], W / 2, cy + 100 + i * 42);

    /* 二维码卡 */
    var qs = 240;
    var qy = cy + 130 + lines.length * 42;
    var qx = (W - qs) / 2;
    g.fillStyle = '#FFFFFF';
    roundRect(g, qx - 16, qy - 16, qs + 32, qs + 32, 18);
    g.fill();
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.stroke();
    if (qr) {
      var qsN = qr.width || qs;
      g.drawImage(qr, (W - qsN) / 2, qy + (qs - qsN) / 2, qsN, qsN);
    } else {
      g.fillStyle = 'rgba(140,28,19,.55)';
      g.font = '20px ' + FONT;
      g.fillText('二维码加载失败', W / 2, qy + qs / 2 - 8);
      g.fillText('（需联网）可把链接直接发群', W / 2, qy + qs / 2 + 24);
    }
    g.fillStyle = RED;
    g.font = 'bold 30px ' + FONT;
    g.fillText('长按识别二维码 · 参与抽奖', W / 2, qy + qs + 72);

    g.fillStyle = 'rgba(140,28,19,.62)';
    g.font = '22px ' + FONT;
    g.fillText(data.footer || '', W / 2, H - 44);

    cb(cv.toDataURL('image/png'));
  }

  function open(data) {
    var m = buildModal();
    var load = m.querySelector('#posterLoad');
    var img = m.querySelector('#posterImg');
    var btns = m.querySelector('#posterBtns');
    m.classList.add('open');
    load.textContent = '正在生成海报…';
    load.style.display = '';
    img.style.display = 'none';
    btns.style.display = 'none';

    loadQR(function (ok) {
      makeQR(ok ? data.url : '', 240, function (qr) {
        var start = function (cover) {
          compose(data, cover, qr, function (dataURL) {
            img.onload = function () {
              img.style.display = '';
              load.style.display = 'none';
              btns.style.display = '';
            };
            img.src = dataURL;
            m.querySelector('#posterDl').href = dataURL;
          });
        };
        if (data.cover) loadImage(data.cover, function (im) { start(im); });
        else start(null);
      });
    });
  }

  window.LuckyPoster = { open: open };
})();