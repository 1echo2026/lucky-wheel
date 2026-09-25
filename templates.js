/* 抽奖模板注册表 · 前台抽奖页(index.html)与后台(admin.html)共用
 *
 * 模板接口约定：
 *   id / name                  标识与后台显示名
 *   slots                      最多能展示多少个奖品（页面只会从这里挑奖，保证“看得见 = 抽得到”）
 *   render(root, prizes)       渲染整个舞台（含抽奖按钮 .lw-spin-btn）
 *   spin(root, index, onDone)  播放落点动画并高亮中奖格，结束后调用 onDone()
 *
 * 概率加权、库存扣减、记录写入都在页面侧完成；模板只管“长什么样、怎么动”。
 * 配色沿用页面的国潮红金体系，模板自包含（后台预览无需页面样式）。
 *
 * 质感做法（分层，全部是纯 SVG 元素，无滤镜、无位图）：
 *   外圈金晕 → 金环 + 内外双描边 → 环内凹槽 → 金珠串环 → 铆钉灯珠
 *   → 扇区（细金线分隔）→ 径向标签（描边光晕）→ 立体光影层 → 轮毂奖章 → 抽奖按钮
 */
(function (global) {
  'use strict';

  var RED_700 = '#8E0F18', RED_600 = '#B3121B', RED_500 = '#C8202A', RED_800 = '#6E0910';
  var DEEP = '#4E0509', CONTOUR = '#3A0407', INK = '#8A5F16';
  var GOLD_100 = '#FFF6DA', GOLD_200 = '#FFE9A8', GOLD_300 = '#F2D288', GOLD_500 = '#D2A544', GOLD_700 = '#9A6E1E';
  var PAPER = '#FFF9F0', PAPER_2 = '#F6D9CF';

  var CX = 160, CY = 160, R = 140;
  var TEXT_R = R - 12;                 /* 标签外端半径（内端 5 字时约 r=58，正好不压轮毂金线） */
  var HALO_DARK = 'rgba(58,4,7,.55)';  /* 深色扇区上的文字描边（压出清晰边缘） */
  var HALO_LIGHT = 'rgba(255,255,255,.85)';

  var SERIF = '"STZhongsong","Songti SC","STSong","SimSun",serif';

  var CSS = [
    '.lw-stage{position:relative;width:100%;}',
    '.lw-stage svg.lw-wheel,.lw-stage svg.lw-grid{display:block;width:100%;height:auto;}',
    '.lw-rotor{transform-origin:' + CX + 'px ' + CY + 'px;}',
    '@media (prefers-reduced-motion:no-preference){.lw-rotor{transition:transform 4.2s cubic-bezier(.16,.84,.22,1);}}',
    '.lw-slice-label{font-family:' + SERIF + ';letter-spacing:.6px;}',
    '.lw-slice.win{animation:lwWinFlash .5s ease-in-out 5 alternate;}',
    '@keyframes lwWinFlash{to{fill:' + GOLD_200 + ';}}',
    /* 铆钉灯珠：静止为深红铆钉，抽奖时点亮 */
    '.lw-light{fill:' + DEEP + ';opacity:.85;}',
    '.lw-stage.spinning .lw-light{animation:lwBlink .62s linear infinite;}',
    '@keyframes lwBlink{0%,100%{fill:' + GOLD_200 + ';opacity:1;}50%{fill:' + RED_700 + ';opacity:.55;}}',
    /* 如意水滴指针 */
    '.lw-pointer{position:absolute;left:50%;top:-7%;transform:translateX(-50%);z-index:3;',
    'filter:drop-shadow(0 5px 7px rgba(0,0,0,.55));}',
    '.lw-pointer.spin{animation:lwNeedle .16s ease-in-out 3;}',
    '@keyframes lwNeedle{50%{transform:translateX(-50%) translateY(3px) scale(.96);}}',
    /* 中心抽奖按钮（轮毂奖章之上） */
    '.lw-spin-btn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);',
    'width:30%;aspect-ratio:1/1;min-width:78px;border-radius:50%;border:2px solid ' + GOLD_700 + ';',
    'cursor:pointer;z-index:4;padding:0;font-family:' + SERIF + ';',
    'font-size:27px;font-weight:900;letter-spacing:1px;line-height:1;color:#6B1409;',
    'text-shadow:0 1px 0 rgba(255,255,255,.55);',
    'background:radial-gradient(circle at 34% 26%,#FFFDF4 0%,' + GOLD_300 + ' 40%,' + GOLD_500 + ' 70%,#9A6E1E 100%);',
    'box-shadow:0 7px 18px rgba(0,0,0,.45),inset 0 0 0 3px rgba(255,253,240,.6);',
    'transition:transform .14s ease,filter .18s;}',
    '.lw-spin-btn:hover:not(:disabled){filter:brightness(1.06);transform:translate(-50%,-50%) scale(1.04);}',
    '.lw-spin-btn:active:not(:disabled){transform:translate(-50%,-50%) scale(.96);}',
    '.lw-spin-btn--line{background:' + PAPER + ';color:' + RED_700 + ';text-shadow:none;}',
    '.lw-spin-btn[data-state="used"]{font-size:15px;letter-spacing:0;}',
    '.lw-spin-btn:disabled{cursor:not-allowed;filter:grayscale(.55) brightness(.9);}',
    /* 九宫格：朱红漆格 + 双勾金线，跑马灯加金色光晕 */
    '.lw-cell-glow{fill:url(#lwGold);opacity:0;}',
    '.lw-cell.on .lw-cell-glow{opacity:.92;}',
    '.lw-cell-plate{fill:rgba(0,0,0,.32);}',
    '.lw-cell-body{stroke:#5E070D;stroke-width:1;}',
    '.lw-cell.on .lw-cell-body{fill:url(#lwCellHot);}',
    '.lw-cell-gloss{fill:url(#lwCellGloss);}',
    '.lw-cell-in{fill:none;stroke:rgba(233,196,104,.55);stroke-width:1;}',
    '.lw-cell.on .lw-cell-in{stroke:rgba(255,246,218,.65);}',
    '.lw-cell-tier{font-family:' + SERIF + ';font-weight:700;fill:rgba(255,233,168,.8);}',
    '.lw-cell-name{font-family:' + SERIF + ';font-weight:700;fill:#FFF6DA;}',
    '.lw-cell.void .lw-cell-tier{fill:rgba(138,95,22,.8);}',
    '.lw-cell.void .lw-cell-name{fill:#7A1F10;}',
    '.lw-cell.on .lw-cell-tier{fill:#FFF6DA;}',
    '.lw-cell.on .lw-cell-name{fill:#FFFFFF;}',
    '.lw-cell.win .lw-cell-glow{animation:lwGridPulse .45s ease-in-out 5 alternate;}',
    '@keyframes lwGridPulse{from{opacity:.55;}to{opacity:1;}}',
    '.lw-diamond{fill:url(#lwGold);stroke:#9A6E1E;stroke-width:.6;}',
    '.lw-preview .lw-stage{pointer-events:none;}',
    /* 节庆橙：浅暖扇区 + 扇区奖品图 + 橙色立体按钮 + 底座 */
    '.lw-slice-label--sans{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;letter-spacing:0;}',
    '.lw-slice-img{pointer-events:none;}',
    '.lw-spin-btn--fest{color:#FFFFFF;text-shadow:0 1px 2px rgba(150,30,10,.5);',
    'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-weight:900;font-size:15px;line-height:1.15;',
    'letter-spacing:1px;border:3px solid #FFFFFF;',
    'background:radial-gradient(circle at 38% 28%,#FFB48C 0%,#FF7A4D 38%,#EE3B25 72%,#C81F12 100%);',
    'box-shadow:0 0 0 4px rgba(255,255,255,.35),0 8px 20px rgba(200,40,20,.4),inset 0 -6px 12px rgba(140,20,6,.35);}',
    '.lw-spin-btn--fest:hover:not(:disabled){filter:brightness(1.05);}',
    '.lw-stand{position:relative;height:34px;margin:-16px auto 0;width:74%;',
    'background:linear-gradient(180deg,#FFC79A 0%,#FFA76E 55%,#F58A4E 100%);',
    'border:1px solid #E9773C;border-radius:0 0 16px 16px;',
    'clip-path:polygon(9% 0,91% 0,100% 100%,0 100%);',
    'display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;',
    'box-shadow:0 8px 18px rgba(190,70,30,.28);}',
    '.lw-base-text{color:#FFFFFF;font-size:12px;font-weight:700;letter-spacing:.5px;',
    'text-shadow:0 1px 2px rgba(170,60,20,.55);white-space:nowrap;}',
    /* 九宫格 · 节庆橙：橙色粗框 + 白点铆钉 + 白底圆角格 + 中心 GO 格 */
    '.lw-gcell-body{fill:#FFFFFF;stroke:#B03A2E;stroke-width:2;}',
    '.lw-gcell.on .lw-gcell-body{fill:#FFF3D6;stroke:#F0601A;stroke-width:3;}',
    '.lw-gcell-glow{fill:none;stroke:#FFC24A;stroke-width:0;}',
    '.lw-gcell.on .lw-gcell-glow{stroke-width:7;opacity:.85;}',
    '.lw-gcell-name{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-weight:700;fill:#5A2A18;}',
    '.lw-gcell.on .lw-gcell-name{fill:#C0392B;}',
    '.lw-gcell.win .lw-gcell-glow{animation:lwGridPulse .45s ease-in-out 5 alternate;}',
    '.lw-spin-btn--gocell{border-radius:16px;border:2px solid #E08A1E;',
    'background:linear-gradient(180deg,#FFF0C8 0%,#FFD98A 45%,#FFA53C 100%);color:#7A3A12;',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;',
    'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 4px 12px rgba(200,120,20,.3);}',
    '.lw-spin-btn--gocell .go-go{font-size:24px;font-weight:900;color:#F0601A;line-height:1;letter-spacing:1px;}',
    '.lw-spin-btn--gocell .go-sub{font-size:12px;font-weight:800;color:#7A3A12;}',
    '.lw-spin-btn--gocell .go-times{font-size:11px;font-weight:600;color:#9A6B3A;}',
    '.lw-spin-btn--gocell:hover:not(:disabled){filter:brightness(1.04);}',
    '@media (max-width:360px){.lw-spin-btn{font-size:22px;}}'
  ].join('');

  var DEFS = '<svg class="lw-defs" aria-hidden="true" focusable="false" '
    + 'style="position:absolute;width:0;height:0;overflow:hidden"><defs>'
    + '<linearGradient id="lwGold" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="' + GOLD_100 + '"/><stop offset="45%" stop-color="#E9C468"/>'
    + '<stop offset="100%" stop-color="' + GOLD_700 + '"/></linearGradient>'
    + '<linearGradient id="lwPointer" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFF9E6"/><stop offset="55%" stop-color="#E9C468"/>'
    + '<stop offset="100%" stop-color="#C99A33"/></linearGradient>'
    /* 外圈金晕：只在轮缘外形成一圈微弱金雾 */
    + '<radialGradient id="lwHalo" gradientUnits="userSpaceOnUse" cx="' + CX + '" cy="' + CY + '" r="160">'
    + '<stop offset="0%" stop-color="' + GOLD_200 + '" stop-opacity="0"/>'
    + '<stop offset="85%" stop-color="' + GOLD_200 + '" stop-opacity="0"/>'
    + '<stop offset="94%" stop-color="' + GOLD_200 + '" stop-opacity=".38"/>'
    + '<stop offset="100%" stop-color="' + GOLD_200 + '" stop-opacity="0"/></radialGradient>'
    /* 立体光影：中心提亮 → 边缘压暗，让圆盘像实心金属盘 */
    + '<radialGradient id="lwShade" gradientUnits="userSpaceOnUse" cx="' + CX + '" cy="' + CY + '" r="' + R + '">'
    + '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".16"/>'
    + '<stop offset="40%" stop-color="#FFFFFF" stop-opacity="0"/>'
    + '<stop offset="76%" stop-color="#000000" stop-opacity=".10"/>'
    + '<stop offset="100%" stop-color="#000000" stop-opacity=".30"/></radialGradient>'
    /* 宣纸款：不能用压实暗，改成中心柔光 + 边缘微暖 */
    + '<radialGradient id="lwShadeLight" gradientUnits="userSpaceOnUse" cx="' + CX + '" cy="' + CY + '" r="' + R + '">'
    + '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".5"/>'
    + '<stop offset="55%" stop-color="#FFFFFF" stop-opacity=".06"/>'
    + '<stop offset="100%" stop-color="' + GOLD_700 + '" stop-opacity=".16"/></radialGradient>'
    /* 九宫格：漆面底板 / 两色漆格 / 高亮热格 / 宣纸格 / 顶部光泽 */
    + '<linearGradient id="lwGridPlate" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#8E0F18"/><stop offset="48%" stop-color="#6E0910"/>'
    + '<stop offset="100%" stop-color="#4A060B"/></linearGradient>'
    + '<radialGradient id="lwGridShade" gradientUnits="userSpaceOnUse" cx="160" cy="168" r="205">'
    + '<stop offset="0%" stop-color="#000000" stop-opacity="0"/>'
    + '<stop offset="64%" stop-color="#000000" stop-opacity="0"/>'
    + '<stop offset="100%" stop-color="#000000" stop-opacity=".34"/></radialGradient>'
    + '<linearGradient id="lwCellA" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#D42A34"/><stop offset="50%" stop-color="#B3121B"/>'
    + '<stop offset="100%" stop-color="#8E0F18"/></linearGradient>'
    + '<linearGradient id="lwCellB" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#C01E28"/><stop offset="50%" stop-color="#9E131D"/>'
    + '<stop offset="100%" stop-color="#7A0F16"/></linearGradient>'
    + '<linearGradient id="lwCellHot" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FF5A52"/><stop offset="45%" stop-color="#E53337"/>'
    + '<stop offset="100%" stop-color="#B3121B"/></linearGradient>'
    + '<linearGradient id="lwCellPaper" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFF9F0"/><stop offset="100%" stop-color="#F0E0C4"/></linearGradient>'
    + '<linearGradient id="lwCellGloss" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".22"/>'
    + '<stop offset="38%" stop-color="#FFFFFF" stop-opacity=".05"/>'
    + '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>'
    + '<linearGradient id="lwStandFest" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFD3AC"/><stop offset="55%" stop-color="#FFA76E"/>'
    + '<stop offset="100%" stop-color="#F0844A"/></linearGradient>'
    + '<linearGradient id="lwRingFest" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFF6DA"/><stop offset="46%" stop-color="#FFD24A"/>'
    + '<stop offset="100%" stop-color="#EFA31C"/></linearGradient>'
    + '<radialGradient id="lwBtnFest" cx="38%" cy="28%" r="82%">'
    + '<stop offset="0%" stop-color="#FFB48C"/><stop offset="38%" stop-color="#FF7A4D"/>'
    + '<stop offset="72%" stop-color="#EE3B25"/><stop offset="100%" stop-color="#C81F12"/></radialGradient>'
    + '<linearGradient id="lwPtrFest" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FF8A5B"/><stop offset="60%" stop-color="#EE3B25"/>'
    + '<stop offset="100%" stop-color="#C81F12"/></linearGradient>'
    + '<linearGradient id="lwGFrame" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFB03A"/><stop offset="52%" stop-color="#FF8A1F"/>'
    + '<stop offset="100%" stop-color="#F2700A"/></linearGradient>'
    + '<linearGradient id="lwGoCell" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#FFF0C8"/><stop offset="45%" stop-color="#FFD98A"/>'
    + '<stop offset="100%" stop-color="#FFA53C"/></linearGradient>'
    + '</defs></svg>';

  function inject() {
    if (!document.getElementById('lw-template-style')) {
      var el = document.createElement('style');
      el.id = 'lw-template-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    if (!document.querySelector('.lw-defs')) {
      var box = document.createElement('div');
      box.innerHTML = DEFS;
      document.body.appendChild(box.firstChild);
    }
  }

  function reduceMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function isVoid(p) { return !!p && /谢谢|未中奖|再来一次/.test(p.name || ''); }

  /* 扇形短标签：取分隔符前的奖项名，过长截断（径向排布，且不能压到中心轮毂） */
  function shortLabel(name, maxLen) {
    var raw = String(name == null ? '' : name);
    var head = raw.split(/[\s·：:，,、|\/]+/)[0] || raw;
    var len = maxLen || 5;
    return head.length > len ? head.slice(0, len) + '…' : head;
  }

  /* 描边光晕标签：深底压深边、浅底压白边，字始终清楚 */
  function labelSvg(cx, cy, r, deg, size, text, fill, halo, extraCls) {
    return '<text class="lw-slice-label' + (extraCls || '') + '" x="' + (cx + r) + '" y="' + cy
      + '" text-anchor="end" dominant-baseline="middle" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" stroke="' + halo + '" stroke-width="2.6" paint-order="stroke"'
      + ' transform="rotate(' + deg.toFixed(2) + ' ' + cx + ' ' + cy + ')">' + esc(text) + '</text>';
  }

  var POINTER_SVG = function (width) {
    return '<svg class="lw-pointer" style="width:' + width + '%" viewBox="0 0 40 62" aria-hidden="true" focusable="false">'
      + '<path d="M20 60C11.6 41 4 34.4 4 22.4a16 16 0 0 1 32 0C36 34.4 28.4 41 20 60z"'
      + ' fill="url(#lwPointer)" stroke="#7A0A12" stroke-width="1.3"/>'
      + '<path d="M20 60C11.6 41 4 34.4 4 22.4a16 16 0 0 1 32 0C36 34.4 28.4 41 20 60z"'
      + ' fill="none" stroke="' + GOLD_700 + '" stroke-width="1.3" opacity=".55"/>'
      + '<ellipse cx="14" cy="16" rx="5" ry="3.4" fill="#FFFDF4" opacity=".55"/>'
      + '<circle cx="20" cy="22.4" r="6" fill="' + RED_700 + '" opacity=".85"/>'
      + '<circle cx="20" cy="22.4" r="6" fill="none" stroke="' + GOLD_200 + '" stroke-width="1.2"/>'
      + '</svg>';
  };

  /* ---------------- 大转盘 ----------------
   * 扇区自正上方(-90°)顺时针铺开；文字沿半径由外向内排布，长奖品名不易互相挤压。 */
  function makeWheel(opt) {
    return {
      id: opt.id,
      name: opt.name,
      slots: 10,
      render: function (root, prizes, ctx) {
        var n = Math.min(prizes.length, 10);
        if (n < 2) n = 2;
        var seg = 360 / n;
        var fs = opt.fontSize || (n > 8 ? 12 : 14);
        var shade = opt.shade === 'light' ? 'lwShadeLight' : 'lwShade';
        var ringGrad = opt.ringGrad || 'lwGold';
        var hubR = opt.hubR || 52;
        var i;

        var s = '<div class="lw-stage">';
        s += '<svg class="lw-wheel" viewBox="0 0 ' + (CX * 2) + ' ' + (CX * 2) + '" role="img" aria-label="幸运大转盘">';

        /* —— 静态外圈：金晕 / 金环 / 内外描边 / 环内凹槽 / 珠串 / 铆钉 —— */
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="160" fill="url(#lwHalo)"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="152" fill="none" stroke="url(#' + ringGrad + ')" stroke-width="11"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="158" fill="none" stroke="rgba(255,246,218,.5)" stroke-width="1"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="159.2" fill="none" stroke="' + CONTOUR + '" stroke-width="1.4" opacity=".5"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="141.5" fill="none" stroke="' + DEEP + '" stroke-width="7" opacity=".5"></circle>';
        if (opt.beads) {
          s += '<circle cx="' + CX + '" cy="' + CY + '" r="137" fill="none" stroke="url(#' + ringGrad + ')"'
            + ' stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.1 9" opacity=".9"></circle>';
        }
        if (opt.lights) {
          var ln = 18;
          for (i = 0; i < ln; i++) {
            var la = (i * 360 / ln - 90) * Math.PI / 180;
            s += '<circle class="lw-light" cx="' + (CX + 152 * Math.cos(la)).toFixed(1)
              + '" cy="' + (CY + 152 * Math.sin(la)).toFixed(1)
              + '" r="2.7" style="animation-delay:' + (i * 0.062).toFixed(2) + 's"></circle>';
          }
        }

        /* —— 旋转体：盘面 / 扇区 / 奖品图 / 标签 / 光影 / 轮毂 —— */
        s += '<g class="lw-rotor">';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="' + opt.base + '"></circle>';
        for (i = 0; i < n; i++) {
          var a0 = (-90 + i * seg) * Math.PI / 180;
          var a1 = (-90 + (i + 1) * seg) * Math.PI / 180;
          var x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
          var x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
          var tone = isVoid(prizes[i]) ? opt.voidTone : opt.tones[i % opt.tones.length];
          s += '<path class="lw-slice" data-i="' + i + '" d="M' + CX + ' ' + CY
            + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2)
            + ' A' + R + ' ' + R + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2)
            + ' Z" fill="' + tone.f + '" stroke="' + opt.stroke.color + '" stroke-width="' + opt.stroke.width + '"></path>';
        }
        /* 奖品图挂载点（扇区内，径向摆正；图片由 ctx.getImage 异步填充） */
        if (opt.images) {
          var imgR = opt.imgR || 112, imgSize = opt.imgSize || 44;
          for (i = 0; i < n; i++) {
            if (isVoid(prizes[i])) continue;
            var mDeg = -90 + i * seg + seg / 2;
            var rad = mDeg * Math.PI / 180;
            var ix = CX + imgR * Math.cos(rad), iy = CY + imgR * Math.sin(rad);
            s += '<g class="lw-slice-img" data-img="' + i + '" transform="translate('
              + ix.toFixed(2) + ' ' + iy.toFixed(2) + ') rotate(' + (mDeg + 90).toFixed(2) + ')"></g>';
          }
        }
        var labelCls = opt.labelSans ? ' lw-slice-label--sans' : '';
        for (i = 0; i < n; i++) {
          var midDeg = -90 + i * seg + seg / 2;
          var vd = isVoid(prizes[i]);
          var t2 = vd ? opt.voidTone : opt.tones[i % opt.tones.length];
          /* 有图的模板里，未中奖格没有奖品图，径向空间更宽裕：标签可放宽 1 字并外移 */
          var lr = (opt.images && vd) ? (opt.textR || TEXT_R) + 12 : (opt.textR || TEXT_R);
          var llen = (opt.labelLen || 5) + ((opt.images && vd) ? 1 : 0);
          s += labelSvg(CX, CY, lr, midDeg, fs,
            shortLabel(prizes[i] ? prizes[i].name : '', llen), t2.t, t2.h || HALO_DARK, labelCls);
        }
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="url(#' + shade + ')"></circle>';
        /* 轮毂：金带 → 凹槽 → 金细线 */
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + hubR + '" fill="url(#lwGold)"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + (hubR + 3) + '" fill="none" stroke="' + DEEP + '" stroke-width="6" opacity=".5"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + (hubR + 6.5) + '" fill="none" stroke="url(#lwGold)" stroke-width="1.5"></circle>';
        s += '</g>';
        s += '</svg>';
        if (opt.pointerFest) {
          s += '<svg class="lw-pointer" style="width:' + opt.pointerWidth + '%" viewBox="0 0 40 62" aria-hidden="true" focusable="false">'
            + '<path d="M20 60C11.6 41 4 34.4 4 22.4a16 16 0 0 1 32 0C36 34.4 28.4 41 20 60z"'
            + ' fill="url(#lwPtrFest)" stroke="#FFFFFF" stroke-width="2.2"/>'
            + '<circle cx="20" cy="22.4" r="6" fill="#FFFFFF" opacity=".5"/>'
            + '</svg>';
        } else {
          s += POINTER_SVG(opt.pointerWidth);
        }
        s += '<button type="button" class="lw-spin-btn' + (opt.btnClass ? ' ' + opt.btnClass : '') + '"'
          + (opt.btnSize ? ' style="width:' + opt.btnSize + '%"' : '') + ' aria-label="开始抽奖">'
          + (opt.btnText || '抽') + '</button>';
        /* 先关掉 .lw-stage：按钮与指针都是 absolute + 百分比定位，包含块必须只等于 SVG 本身。
           底座若留在 stage 内，会把 stage 撑高（height 34 − margin-top 16 = 净 18），
           使 top:50% 算出的圆心下移约 9px，中心圆就与轮毂环不同心了。 */
        s += '</div>';
        if (opt.stand) {
          s += '<div class="lw-stand"><span class="lw-base-text">'
            + esc((ctx && ctx.leftText) || '点击中心开始抽奖') + '</span></div>';
        }
        root.innerHTML = s;
        root.setAttribute('data-slots', String(n));
        /* 异步填充扇区里的奖品图（没有图的奖品保持纯文字） */
        if (opt.images && ctx && typeof ctx.getImage === 'function') {
          for (i = 0; i < n; i++) {
            (function (idx) {
              var box = root.querySelector('.lw-slice-img[data-img="' + idx + '"]');
              if (!box) return;
              ctx.getImage(prizes[idx]).then(function (src) {
                if (!src) return;
                var w = opt.imgSize || 44;
                box.innerHTML = '<image class="lw-slice-img-el" href="' + src + '" x="' + (-w / 2)
                  + '" y="' + (-w / 2) + '" width="' + w + '" height="' + w
                  + '" preserveAspectRatio="xMidYMid meet"></image>';
              })['catch'](function () { /* 取图失败就保持纯文字 */ });
            })(i);
          }
        }
      },
      spin: function (root, index, onDone) {
        var stage = root.querySelector('.lw-stage');
        var rotor = root.querySelector('.lw-rotor');
        var ptr = root.querySelector('.lw-pointer');
        if (!rotor) { onDone(); return; }
        var n = parseInt(root.getAttribute('data-slots'), 10) || 8;
        var seg = 360 / n;
        var cur = parseFloat(root.getAttribute('data-deg') || '0');
        var jitter = (Math.random() - 0.5) * seg * 0.5;
        var target = 360 - (index * seg + seg / 2 + jitter);
        var delta = (target - (cur % 360) + 360) % 360;
        if (delta <= 0) delta += 360;
        var next = cur + 5 * 360 + delta;
        var still = reduceMotion();

        if (stage) stage.classList.add('spinning');
        if (ptr) {
          ptr.classList.remove('spin');
          void ptr.offsetWidth;
          ptr.classList.add('spin');
        }
        rotor.style.transition = 'none';
        rotor.style.transform = 'rotate(' + cur + 'deg)';
        void rotor.offsetWidth; /* 强制回流：先回到上次停留角度再起转 */
        rotor.style.transition = '';
        rotor.style.transform = 'rotate(' + next + 'deg)';
        root.setAttribute('data-deg', String(next));

        setTimeout(function () {
          if (stage) stage.classList.remove('spinning');
          var el = root.querySelector('.lw-slice[data-i="' + index + '"]');
          if (el && !still) {
            el.classList.remove('win');
            void el.offsetWidth;
            el.classList.add('win');
          }
          onDone();
        }, still ? 300 : 4350);
      }
    };
  }

  /* ---------------- 九宫格 ----------------
   * 8 个朱红漆格绕外圈，中心是金章抽奖按钮；跑马灯高亮停在中奖格。
   * 漆格分层：金晕底 → 投影托板 → 漆面渐变格 → 顶部光泽 → 内嵌发丝金线 → 奖项/奖名两行字。 */
  var GRID_POS = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];

  /* 解析“一等奖：冰箱”这类文案为 奖项等级 + 奖品名 两行；无法解析时只显奖名 */
  function parseCellLabel(p) {
    var raw = String(p && p.name || '');
    var parts = raw.split(/[\s·：:，,、|\/]+/);
    var tier, name;
    if (parts.length > 1) { tier = parts[0]; name = parts.slice(1).join(''); }
    else { tier = ''; name = raw; }
    if (tier.length > 4) tier = tier.slice(0, 4) + '…';
    if (name.length > 5) name = name.slice(0, 5) + '…';
    return { tier: tier, name: name };
  }

  function makeGrid(opt) {
    return {
      id: opt.id,
      name: opt.name,
      slots: 8,
      render: function (root, prizes) {
        var n = Math.min(prizes.length, 8);
        var PAD = 10, CELL = 94, STEP = 102;
        var i;
        var s = '<div class="lw-stage">';
        s += '<svg class="lw-grid" viewBox="0 0 320 320" role="img" aria-label="九宫格抽奖">';

        /* —— 漆面底板：朱红渐变 → 边缘压暗 → 金边双描边 —— */
        s += '<rect x="0" y="0" width="320" height="320" rx="22" fill="url(#lwGridPlate)"></rect>';
        s += '<rect x="0" y="0" width="320" height="320" rx="22" fill="url(#lwGridShade)"></rect>';
        s += '<rect x="2" y="2" width="316" height="316" rx="20" fill="none" stroke="rgba(255,246,218,.4)" stroke-width="1"></rect>';
        s += '<rect x="3.5" y="3.5" width="313" height="313" rx="19" fill="none" stroke="url(#lwGold)" stroke-width="3"></rect>';
        s += '<rect x="6.4" y="6.4" width="307.2" height="307.2" rx="17" fill="none" stroke="' + CONTOUR + '" stroke-width="1.1" opacity=".55"></rect>';
        s += '<rect x="9.5" y="9.5" width="301" height="301" rx="15" fill="none" stroke="rgba(255,246,218,.16)" stroke-width="1"></rect>';
        /* 24 颗铆钉（上下各 7、左右各 5）：抽奖时点亮，复用 .lw-light */
        for (i = 0; i < 7; i++) {
          var rx0 = 40 + i * 40;
          s += '<circle class="lw-light" cx="' + rx0 + '" cy="5.5" r="2.2" style="animation-delay:' + (i * 0.06).toFixed(2) + 's"></circle>';
          s += '<circle class="lw-light" cx="' + rx0 + '" cy="314.5" r="2.2" style="animation-delay:' + ((i + 7) * 0.06).toFixed(2) + 's"></circle>';
        }
        for (i = 0; i < 5; i++) {
          var ry0 = 80 + i * 40;
          s += '<circle class="lw-light" cx="5.5" cy="' + ry0 + '" r="2.2" style="animation-delay:' + ((i + 3) * 0.06).toFixed(2) + 's"></circle>';
          s += '<circle class="lw-light" cx="314.5" cy="' + ry0 + '" r="2.2" style="animation-delay:' + ((i + 10) * 0.06).toFixed(2) + 's"></circle>';
        }

        /* —— 中心金章（按钮坐在上面）：投影 → 凹槽 → 金面 → 红漆内芯 —— */
        s += '<rect x="106" y="109" width="108" height="108" rx="24" fill="rgba(0,0,0,.3)"></rect>';
        s += '<rect x="105" y="105" width="110" height="110" rx="25" fill="none" stroke="' + DEEP + '" stroke-width="7" opacity=".5"></rect>';
        s += '<rect x="107" y="107" width="106" height="106" rx="22" fill="url(#lwGold)"></rect>';
        s += '<rect x="107" y="107" width="106" height="106" rx="22" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"></rect>';
        s += '<rect x="115" y="115" width="90" height="90" rx="17" fill="url(#lwCellB)"></rect>';
        s += '<rect x="120" y="120" width="80" height="80" rx="13" fill="none" stroke="rgba(233,196,104,.5)" stroke-width="1"></rect>';

        /* —— 8 个漆格：两色红交替，“谢谢参与”用宣纸色 —— */
        for (i = 0; i < 8; i++) {
          var col = GRID_POS[i][0], row = GRID_POS[i][1];
          var x = PAD + col * STEP, y = PAD + row * STEP;
          var voidCell = i < n && isVoid(prizes[i]);
          var tone = voidCell ? '#lwCellPaper' : (i % 2 ? '#lwCellB' : '#lwCellA');
          var lab = i < n ? parseCellLabel(prizes[i]) : { tier: '', name: '—' };
          var ccx = x + CELL / 2, ccy = y + CELL / 2;
          s += '<g class="lw-cell' + (voidCell ? ' void' : '') + '">'
            + '<rect class="lw-cell-glow" x="' + (x - 2) + '" y="' + (y - 2) + '" width="' + (CELL + 4)
            + '" height="' + (CELL + 4) + '" rx="16"></rect>'
            + '<rect class="lw-cell-plate" x="' + (x + 1) + '" y="' + (y + 3.5) + '" width="' + CELL
            + '" height="' + CELL + '" rx="14"></rect>'
            + '<rect class="lw-cell-body" x="' + x + '" y="' + y + '" width="' + CELL + '" height="' + CELL
            + '" rx="14" fill="url(' + tone + ')"></rect>'
            + '<rect class="lw-cell-gloss" x="' + (x + 5) + '" y="' + (y + 4) + '" width="' + (CELL - 10)
            + '" height="44" rx="10"></rect>'
            + '<rect class="lw-cell-in" x="' + (x + 5.5) + '" y="' + (y + 5.5) + '" width="' + (CELL - 11)
            + '" height="' + (CELL - 11) + '" rx="10"></rect>';
          if (lab.tier) {
            s += '<text class="lw-cell-tier" x="' + ccx + '" y="' + (ccy - 14) + '" text-anchor="middle" font-size="9.5">'
              + esc(lab.tier) + '</text>'
              + '<text class="lw-cell-name" x="' + ccx + '" y="' + (ccy + 7) + '" text-anchor="middle" font-size="13.5">'
              + esc(lab.name) + '</text>';
          } else {
            s += '<text class="lw-cell-name" x="' + ccx + '" y="' + (ccy + 1) + '" text-anchor="middle" font-size="14">'
              + esc(lab.name) + '</text>';
          }
          s += '</g>';
        }

        /* 十字缝里的四枚小金铢 */
        var diamonds = [[107, 107], [213, 107], [107, 213], [213, 213]];
        for (i = 0; i < diamonds.length; i++) {
          var dcx = diamonds[i][0], dcy = diamonds[i][1];
          s += '<path class="lw-diamond" d="M' + dcx + ' ' + (dcy - 4.5) + 'L' + (dcx + 4.5) + ' ' + dcy
            + 'L' + dcx + ' ' + (dcy + 4.5) + 'L' + (dcx - 4.5) + ' ' + dcy + 'Z"></path>';
        }

        s += '</svg>';
        s += '<button type="button" class="lw-spin-btn' + (opt.btnClass ? ' ' + opt.btnClass : '') + '" aria-label="开始抽奖">抽</button>';
        s += '</div>';
        root.innerHTML = s;
        root.setAttribute('data-slots', String(Math.max(n, 1)));
      },
      spin: function (root, index, onDone) {
        var stage = root.querySelector('.lw-stage');
        var cells = root.querySelectorAll('.lw-cell');
        var total = cells.length || 8;
        var target = Math.min(Math.max(index, 0), total - 1);
        var steps = 4 * total + target;
        var still = reduceMotion();
        var k = 0;
        var c;
        for (c = 0; c < cells.length; c++) cells[c].classList.remove('win');
        if (stage) stage.classList.add('spinning');
        function paint() {
          for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('on', i === (k % total));
        }
        function finish() {
          if (stage) stage.classList.remove('spinning');
          if (cells[target] && !still) cells[target].classList.add('win');
          onDone();
        }
        if (still) {
          k = steps;
          paint();
          setTimeout(finish, 300);
          return;
        }
        function step() {
          paint();
          k++;
          if (k > steps) { setTimeout(finish, 320); return; }
          var t = k / steps;
          setTimeout(step, 55 + 250 * t * t); /* 逐渐减速 */
        }
        step();
      }
    };
  }

  /* ---------------- 九宫格 · 节庆橙（按参考设计） ----------------
 * 橙色粗框 + 白点铆钉 + 白底圆角格（奖品图在上、奖项名在下）+ 中心 GO 格（立即抽奖 / 共N次）。
 * 几何：框内 30~290，格 82、缝 7，中心格 (119,119)-(201,201) 正好是 50% 位置。 */
  function makeGridFest(opt) {
    return {
      id: opt.id,
      name: opt.name,
      slots: 8,
      render: function (root, prizes, ctx) {
        var n = Math.min(prizes.length, 8);
        var PAD = 30, CELL = 82, STEP = 89;
        var i;
        var s = '<div class="lw-stage">';
        s += '<svg class="lw-grid" viewBox="0 0 320 320" role="img" aria-label="九宫格抽奖">';

        /* 橙色外框 + 内外描边 + 白点铆钉 */
        s += '<rect x="0" y="0" width="320" height="320" rx="34" fill="url(#lwGFrame)"></rect>';
        s += '<rect x="4" y="4" width="312" height="312" rx="30" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.6"></rect>';
        s += '<rect x="9" y="9" width="302" height="302" rx="26" fill="none" stroke="rgba(150,60,0,.26)" stroke-width="1.2"></rect>';
        var dots = [], k;
        for (k = 0; k < 5; k++) dots.push([48 + k * 56, 16], [48 + k * 56, 304]);
        for (k = 0; k < 3; k++) dots.push([16, 112 + k * 48], [304, 112 + k * 48]);
        for (i = 0; i < dots.length; i++) {
          s += '<circle cx="' + dots[i][0] + '" cy="' + dots[i][1] + '" r="' + (i % 2 ? 3.2 : 4.6)
            + '" fill="#FFFFFF" opacity="' + (i % 3 ? .95 : .78) + '"></circle>';
        }

        /* 8 个奖品格：白底圆角 + 暗红细边，上奖品图、下奖项名 */
        for (i = 0; i < 8; i++) {
          var col = GRID_POS[i][0], row = GRID_POS[i][1];
          var x = PAD + col * STEP, y = PAD + row * STEP;
          var cx = x + CELL / 2, cy = y + CELL / 2;
          var label = i < n ? shortLabel(prizes[i].name, 5) : '—';
          s += '<g class="lw-gcell" data-i="' + i + '">'
            + '<rect class="lw-gcell-glow" x="' + (x - 3) + '" y="' + (y - 3) + '" width="' + (CELL + 6)
            + '" height="' + (CELL + 6) + '" rx="17"></rect>'
            + '<rect class="lw-gcell-body" x="' + x + '" y="' + y + '" width="' + CELL + '" height="' + CELL
            + '" rx="14"></rect>'
            + '<g class="lw-gimg" data-img="' + i + '" transform="translate(' + cx + ' ' + (cy - 14) + ')"></g>'
            + '<text class="lw-gcell-name" x="' + cx + '" y="' + (cy + 26) + '" text-anchor="middle" font-size="12">'
            + esc(label) + '</text></g>';
        }
        s += '</svg>';

        /* 中心 GO 格（HTML 按钮，正好落在中心格上） */
        var times = (ctx && ctx.leftCount !== undefined) ? ctx.leftCount : '';
        s += '<button type="button" class="lw-spin-btn lw-spin-btn--gocell" style="width:25.5%" aria-label="开始抽奖">'
          + '<span class="go-go">GO</span><span class="go-sub">立即抽奖</span>'
          + '<span class="go-times">共 ' + times + ' 次</span></button>';
        s += '</div>';
        root.innerHTML = s;
        root.setAttribute('data-slots', String(Math.max(n, 1)));

        /* 异步填奖品图；没有图的格子只显示奖项名 */
        if (ctx && typeof ctx.getImage === 'function') {
          for (i = 0; i < n; i++) {
            (function (idx) {
              var box = root.querySelector('.lw-gimg[data-img="' + idx + '"]');
              if (!box) return;
              ctx.getImage(prizes[idx]).then(function (src) {
                if (!src) return;
                box.innerHTML = '<image href="' + src + '" x="-20" y="-20" width="40" height="40"'
                  + ' preserveAspectRatio="xMidYMid meet"></image>';
              })['catch'](function () { /* 取图失败就保持纯文字 */ });
            })(i);
          }
        }
      },
      spin: function (root, index, onDone) {
        var stage = root.querySelector('.lw-stage');
        var cells = root.querySelectorAll('.lw-gcell');
        var total = cells.length || 8;
        var target = Math.min(Math.max(index, 0), total - 1);
        var steps = 4 * total + target;
        var still = reduceMotion();
        var k = 0, c;
        for (c = 0; c < cells.length; c++) cells[c].classList.remove('win');
        if (stage) stage.classList.add('spinning');
        function paint() {
          for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('on', i === (k % total));
        }
        function finish() {
          if (stage) stage.classList.remove('spinning');
          if (cells[target] && !still) cells[target].classList.add('win');
          onDone();
        }
        if (still) {
          k = steps;
          paint();
          setTimeout(finish, 300);
          return;
        }
        function step() {
          paint();
          k++;
          if (k > steps) { setTimeout(finish, 320); return; }
          var t = k / steps;
          setTimeout(step, 55 + 250 * t * t); /* 逐渐减速 */
        }
        step();
      }
    };
  }

  var VOID_DARK = { f: '#EADCC4', t: INK, h: HALO_LIGHT };
  var VOID_LIGHT = { f: '#F1E3CE', t: INK, h: HALO_LIGHT };

  var TEMPLATES = [
    /* 转盘 · 珍藏红金（国潮款） */
    makeWheel({
      id: 'wheel-bing',
      name: '大转盘 · 珍藏红金',
      base: RED_800,
      tones: [
        { f: RED_500, t: GOLD_200 },
        { f: RED_700, t: GOLD_200 },
        { f: '#A8121C', t: GOLD_200 },
        { f: RED_800, t: GOLD_300 }
      ],
      voidTone: VOID_DARK,
      stroke: { color: 'rgba(255,246,218,.55)', width: 1.3 },
      beads: true,
      lights: true,
      pointerWidth: 12,
      shade: 'dark',
      btnClass: ''
    }),
    /* 转盘 · 节庆橙（参考设计：扇区内显示奖品图 + 橙色立体按钮 + 底座剩余次数） */
    makeWheel({
      id: 'wheel-festive',
      name: '大转盘 · 节庆橙（参考设计）',
      base: '#FFE8D8',
      tones: [
        { f: '#FFF0E4', t: '#E24A2E', h: 'rgba(255,255,255,.95)' },
        { f: '#FFD9C4', t: '#D93A22', h: 'rgba(255,255,255,.95)' }
      ],
      voidTone: { f: '#FFF1E6', t: '#B9862F', h: 'rgba(255,255,255,.95)' },
      stroke: { color: '#FFFFFF', width: 2 },
      beads: false,
      lights: true,
      ringGrad: 'lwRingFest',
      shade: 'light',
      /* 径向占位（半径140）：按钮≈41.6 < 轮毂46(外线52.5) < 标签内端54 < 标签外端90 < 奖品图92~136 < 扇区边140 */
      hubR: 46,
      btnSize: 26,
      fontSize: 12,
      images: true,
      imgR: 114,
      imgSize: 44,
      textR: 90,
      labelLen: 3,
      labelSans: true,
      pointerFest: true,
      pointerWidth: 13,
      stand: true,
      btnText: '点击<br>抽奖',
      btnClass: 'lw-spin-btn--fest'
    }),
    /* 九宫格 · 国潮（朱红漆格） */
    makeGrid({
      id: 'grid-red',
      name: '九宫格 · 国潮',
      btnClass: ''
    }),
    /* 九宫格 · 节庆橙（参考设计：橙框白点 + 白底圆角格 + 上图下文 + 中心 GO 格） */
    makeGridFest({
      id: 'grid-festive',
      name: '九宫格 · 节庆橙（参考设计）'
    })
  ];

  var DEFAULT_ID = 'wheel-festive';

  global.LuckyTemplates = {
    list: TEMPLATES.map(function (t) { return { id: t.id, name: t.name, slots: t.slots }; }),
    defaultId: DEFAULT_ID,
    inject: inject,
    get: function (id) {
      var i;
      for (i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].id === id) return TEMPLATES[i];
      }
      for (i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].id === DEFAULT_ID) return TEMPLATES[i];
      }
      return TEMPLATES[0];
    }
  };
})(window);