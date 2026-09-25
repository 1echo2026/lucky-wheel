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
 */
(function (global) {
  'use strict';

  var RED_700 = '#8E0F18', RED_600 = '#B3121B', RED_500 = '#C8202A', RED_800 = '#6E0910';
  var GOLD_100 = '#FFF6DA', GOLD_200 = '#FFE9A8', GOLD_300 = '#F2D288', GOLD_500 = '#D2A544', GOLD_700 = '#9A6E1E';
  var PAPER = '#FFF9F0', PAPER_2 = '#F6D9CF';
  var VOID_TONE = { f: '#EADCC4', t: '#8A5F16' };

  var CX = 160, CY = 160, R = 140;

  var CSS = [
    '.lw-stage{position:relative;width:100%;}',
    '.lw-stage svg.lw-wheel,.lw-stage svg.lw-grid{display:block;width:100%;height:auto;}',
    '.lw-rotor{transform-origin:' + CX + 'px ' + CY + 'px;}',
    '@media (prefers-reduced-motion:no-preference){.lw-rotor{transition:transform 4.2s cubic-bezier(.16,.84,.22,1);}}',
    '.lw-slice-label{font-family:"STZhongsong","Songti SC","STSong","SimSun",serif;letter-spacing:.5px;}',
    '.lw-slice.win{animation:lwWinFlash .5s ease-in-out 5 alternate;}',
    '@keyframes lwWinFlash{to{fill:' + GOLD_200 + ';}}',
    '.lw-light{fill:' + RED_700 + ';opacity:.9;}',
    '.lw-stage.spinning .lw-light{animation:lwBlink .62s linear infinite;}',
    '@keyframes lwBlink{0%,100%{fill:' + GOLD_200 + ';opacity:1;}50%{fill:' + RED_700 + ';opacity:.55;}}',
    '.lw-pointer{position:absolute;left:50%;top:-7%;transform:translateX(-50%);z-index:3;',
    'filter:drop-shadow(0 4px 6px rgba(0,0,0,.5));}',
    '.lw-pointer.spin{animation:lwNeedle .16s ease-in-out 3;}',
    '@keyframes lwNeedle{50%{transform:translateX(-50%) translateY(3px) scale(.96);}}',
    '.lw-spin-btn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);',
    'width:30%;aspect-ratio:1/1;min-width:78px;border-radius:50%;border:2px solid ' + GOLD_700 + ';',
    'cursor:pointer;z-index:4;padding:0;font-family:"STZhongsong","Songti SC","STSong","SimSun",serif;',
    'font-size:26px;font-weight:900;letter-spacing:1px;line-height:1;color:#6B1409;',
    'background:radial-gradient(circle at 34% 28%,#FFF9E6 0%,' + GOLD_300 + ' 42%,' + GOLD_500 + ' 72%,' + GOLD_700 + ' 100%);',
    'box-shadow:0 6px 16px rgba(0,0,0,.42),inset 0 0 0 3px rgba(255,253,240,.55);',
    'transition:transform .14s ease,filter .18s;}',
    '.lw-spin-btn:hover:not(:disabled){filter:brightness(1.06);transform:translate(-50%,-50%) scale(1.04);}',
    '.lw-spin-btn:active:not(:disabled){transform:translate(-50%,-50%) scale(.96);}',
    '.lw-spin-btn--line{background:' + PAPER + ';color:' + RED_700 + ';}',
    '.lw-spin-btn[data-state="used"]{font-size:15px;letter-spacing:0;}',
    '.lw-spin-btn:disabled{cursor:not-allowed;filter:grayscale(.55) brightness(.9);}',
    /* 九宫格 */
    '.lw-cell{fill:' + PAPER + ';stroke:#E9C468;stroke-width:1.6;}',
    '.lw-cell.on{fill:' + RED_500 + ';}',
    '.lw-cell-t{fill:#8A5F16;font-family:"STZhongsong","Songti SC","STSong","SimSun",serif;font-weight:700;}',
    '.lw-cell.on .lw-cell-t{fill:' + GOLD_200 + ';}',
    '.lw-preview .lw-stage{pointer-events:none;}',
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

  /* 扇形短标签：去掉分隔符后的奖品名，过长截断（径向排布，横向空间充足） */
  function shortLabel(name, maxLen) {
    var raw = String(name == null ? '' : name);
    var head = raw.split(/[\s·：:，,、|\/]+/)[0] || raw;
    var len = maxLen || 7;
    return head.length > len ? head.slice(0, len) + '…' : head;
  }

  /* ---------------- 大转盘 ----------------
   * 扇区自正上方(-90°)顺时针铺开；文字沿半径由外向内排布，长奖品名不易互相挤压。 */
  function makeWheel(opt) {
    return {
      id: opt.id,
      name: opt.name,
      slots: 10,
      render: function (root, prizes) {
        var n = Math.min(prizes.length, 10);
        if (n < 2) n = 2;
        var seg = 360 / n;
        var fs = n > 8 ? 12 : 14;
        var s = '<div class="lw-stage">';
        s += '<svg class="lw-wheel" viewBox="0 0 ' + (CX * 2) + ' ' + (CY * 2) + '" role="img" aria-label="幸运大转盘">';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="156" fill="#42040A" opacity=".35"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="152" fill="none" stroke="url(#lwGold)" stroke-width="10"></circle>';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="145" fill="none" stroke="rgba(255,246,218,.35)" stroke-width="1"></circle>';
        var i, k;
        var lights = '';
        if (opt.lights) {
          var ln = 18;
          for (i = 0; i < ln; i++) {
            var la = (i * 360 / ln - 90) * Math.PI / 180;
            lights += '<circle class="lw-light" cx="' + (CX + 152 * Math.cos(la)).toFixed(1)
              + '" cy="' + (CY + 152 * Math.sin(la)).toFixed(1)
              + '" r="3.4" style="animation-delay:' + (i * 0.062).toFixed(2) + 's"></circle>';
          }
        }
        s += lights;
        s += '<g class="lw-rotor">';
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="' + opt.base + '"></circle>';
        for (i = 0; i < n; i++) {
          var a0 = (-90 + i * seg) * Math.PI / 180;
          var a1 = (-90 + (i + 1) * seg) * Math.PI / 180;
          var x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
          var x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
          var tone = isVoid(prizes[i]) ? VOID_TONE : opt.tones[i % opt.tones.length];
          s += '<path class="lw-slice" data-i="' + i + '" d="M' + CX + ' ' + CY
            + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2)
            + ' A' + R + ' ' + R + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2)
            + ' Z" fill="' + tone.f + '" stroke="' + opt.stroke.color + '" stroke-width="' + opt.stroke.width + '"></path>';
        }
        for (k = 0; k < n; k++) {
          var midDeg = -90 + k * seg + seg / 2;
          var tone2 = isVoid(prizes[k]) ? VOID_TONE : opt.tones[k % opt.tones.length];
          s += '<text class="lw-slice-label" x="' + (CX + R - 14) + '" y="' + CY
            + '" text-anchor="end" dominant-baseline="middle" font-size="' + fs
            + '" font-weight="700" fill="' + tone2.t + '"'
            + ' transform="rotate(' + midDeg.toFixed(2) + ' ' + CX + ' ' + CY + ')">'
            + esc(shortLabel(prizes[k] ? prizes[k].name : '')) + '</text>';
        }
        s += '<circle cx="' + CX + '" cy="' + CY + '" r="52" fill="url(#lwGold)" opacity=".28"></circle>';
        s += '</g>';
        s += '</svg>';
        s += '<svg class="lw-pointer" style="width:' + opt.pointerWidth + '%" viewBox="0 0 40 60" aria-hidden="true" focusable="false">'
          + '<path d="M20 58C12 40 4 34 4 22a16 16 0 0 1 32 0c0 12-8 18-16 36z" fill="url(#lwPointer)" stroke="' + GOLD_700 + '" stroke-width="1.4"/>'
          + '<circle cx="20" cy="22" r="5.5" fill="' + RED_700 + '" opacity=".78"/></svg>';
        s += '<button type="button" class="lw-spin-btn' + (opt.btnClass ? ' ' + opt.btnClass : '') + '" aria-label="开始抽奖">抽</button>';
        s += '</div>';
        root.innerHTML = s;
        root.setAttribute('data-slots', String(n));
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
   * 8 个奖品格绕外圈，中心是抽奖按钮；跑马灯高亮停在中奖格。 */
  var GRID_POS = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];

  function makeGrid(opt) {
    return {
      id: opt.id,
      name: opt.name,
      slots: 8,
      render: function (root, prizes) {
        var n = Math.min(prizes.length, 8);
        var PAD = 8, CELL = 96, STEP = 104;
        var s = '<div class="lw-stage">';
        s += '<svg class="lw-grid" viewBox="0 0 320 320" role="img" aria-label="九宫格抽奖">';
        for (var i = 0; i < 8; i++) {
          var col = GRID_POS[i][0], row = GRID_POS[i][1];
          var x = PAD + col * STEP, y = PAD + row * STEP;
          var label = i < n ? shortLabel(prizes[i].name, 5) : '—';
          s += '<g class="lw-cell">'
            + '<rect x="' + x + '" y="' + y + '" width="' + CELL + '" height="' + CELL + '" rx="14"></rect>'
            + '<text class="lw-cell-t" x="' + (x + CELL / 2) + '" y="' + (y + CELL / 2)
            + '" text-anchor="middle" dominant-baseline="middle" font-size="13">'
            + esc(label) + '</text></g>';
        }
        s += '</svg>';
        s += '<button type="button" class="lw-spin-btn' + (opt.btnClass ? ' ' + opt.btnClass : '') + '" aria-label="开始抽奖">抽</button>';
        s += '</div>';
        root.innerHTML = s;
        root.setAttribute('data-slots', String(Math.max(n, 1)));
      },
      spin: function (root, index, onDone) {
        var cells = root.querySelectorAll('.lw-cell');
        var total = cells.length || 8;
        var target = Math.min(Math.max(index, 0), total - 1);
        var steps = 4 * total + target;
        var still = reduceMotion();
        var k = 0;
        function paint() {
          for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('on', i === (k % total));
        }
        if (still) {
          k = steps;
          paint();
          setTimeout(onDone, 300);
          return;
        }
        function step() {
          paint();
          k++;
          if (k > steps) { setTimeout(onDone, 320); return; }
          var t = k / steps;
          setTimeout(step, 55 + 250 * t * t); /* 逐渐减速 */
        }
        step();
      }
    };
  }

  var TEMPLATES = [
    /* 丙：双强红 + 粗白分隔 + 大号如意指针（默认） */
    makeWheel({
      id: 'wheel-bing',
      name: '大转盘 · 丙 高对比',
      base: RED_800,
      tones: [
        { f: RED_500, t: GOLD_200 },
        { f: RED_700, t: GOLD_200 }
      ],
      stroke: { color: '#FFFFFF', width: 3.5 },
      lights: true,
      pointerWidth: 15,
      btnClass: ''
    }),
    /* 甲：深浅红四色交替 + 细金分隔（原国潮样式） */
    makeWheel({
      id: 'wheel-jia',
      name: '大转盘 · 甲 浓烈红',
      base: '#7A0A12',
      tones: [
        { f: RED_500, t: GOLD_200 },
        { f: RED_700, t: GOLD_200 },
        { f: RED_600, t: GOLD_200 },
        { f: '#7A0A12', t: GOLD_300 }
      ],
      stroke: { color: 'rgba(255,246,218,.85)', width: 1.6 },
      lights: true,
      pointerWidth: 12,
      btnClass: ''
    }),
    /* 乙：宣纸底 + 淡朱红 + 细金线，雅致款 */
    makeWheel({
      id: 'wheel-yi',
      name: '大转盘 · 乙 简金',
      base: PAPER,
      tones: [
        { f: PAPER, t: '#8A5F16' },
        { f: PAPER_2, t: RED_700 }
      ],
      stroke: { color: 'rgba(210,165,68,.55)', width: 1.2 },
      lights: false,
      pointerWidth: 10,
      btnClass: 'lw-spin-btn--line'
    }),
    makeGrid({
      id: 'grid-red',
      name: '九宫格 · 国潮',
      btnClass: ''
    })
  ];

  var DEFAULT_ID = 'wheel-bing';

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