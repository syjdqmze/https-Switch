/* ============================================================
 * app.js — Mermaid 显式渲染 / 阅读进度条 / 移动目录抽屉 / TOC 高亮
 * 关键教训：mermaid startOnLoad 在本地环境不可靠，
 *           必须 initialize({startOnLoad:false}) 后显式 mermaid.run()。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Mermaid ---------- */
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      fontFamily: 'InstrumentSans, "Microsoft YaHei", sans-serif',
      themeVariables: {
        primaryColor: '#eaf1fa',
        primaryTextColor: '#101b2c',
        primaryBorderColor: '#1457a8',
        lineColor: '#55657d',
        secondaryColor: '#fdf0e2',
        tertiaryColor: '#ffffff',
        edgeLabelBackground: '#ffffff',
        clusterBkg: '#f7faff',
        clusterBorder: '#d7e0ec',
        noteBkgColor: '#fdf0e2',
        noteBorderColor: '#d97316',
        actorBkg: '#eaf1fa',
        actorBorder: '#1457a8',
        signalColor: '#101b2c',
        labelBoxBkgColor: '#eaf1fa',
        labelBoxBorderColor: '#1457a8'
      },
      flowchart: { htmlLabels: true, curve: 'basis' },
      sequence: { actorMargin: 60, boxMargin: 8 }
    });

    function renderMermaid() {
      if (typeof mermaid.run === 'function') {
        mermaid.run({ querySelector: 'pre.mermaid' })['catch'](function (e) {
          console.error('mermaid render failed:', e);
        });
      } else {
        /* 极旧版回退 */
        mermaid.init(undefined, document.querySelectorAll('pre.mermaid'));
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderMermaid);
    } else {
      renderMermaid();
    }
  }

  /* ---------- 2. 顶部阅读进度条 ---------- */
  var progress = document.getElementById('progress');
  function updateProgress() {
    if (!progress) { return; }
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    progress.style.width = pct + '%';
  }
  document.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* ---------- 3. 移动端目录抽屉 ---------- */
  var toc = document.getElementById('toc');
  var toggle = document.getElementById('tocToggle');
  if (toc && toggle) {
    toggle.addEventListener('click', function () {
      toc.classList.toggle('open');
    });
    toc.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toc.classList.remove('open'); });
    });
  }

  /* ---------- 4. 侧边 TOC 滚动高亮 ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  var map = {};
  tocLinks.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    var target = document.getElementById(id);
    if (target) { map[id] = a; }
  });

  if ('IntersectionObserver' in window) {
    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { visible[en.target.id] = true; }
        else { delete visible[en.target.id]; }
      });

      var current = null;
      Object.keys(map).forEach(function (id) {
        if (visible[id]) { current = id; }
      });

      if (current) {
        tocLinks.forEach(function (a) { a.classList.remove('active'); });
        var active = map[current];
        if (active) {
          active.classList.add('active');
          /* 若命中的是二级标题，同时高亮其父章节链接 */
          if (active.classList.contains('lvl2')) {
            var parent = current.split('-')[0];
            if (map[parent]) { map[parent].classList.add('active'); }
          }
        }
      }
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });

    Object.keys(map).forEach(function (id) {
      observer.observe(document.getElementById(id));
    });
  }
})();
