(function () {
  'use strict';

  /* ---------- Mermaid 初始化 + 显式渲染（不依赖 startOnLoad 时机） ---------- */
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      flowchart: { htmlLabels: true, curve: 'basis' },
      themeVariables: {
        primaryColor: '#e8f1fc',
        primaryTextColor: '#0f1d33',
        primaryBorderColor: '#0b68d4',
        lineColor: '#51637c',
        secondaryColor: '#e6f6f4',
        secondaryBorderColor: '#0d9488',
        tertiaryColor: '#ffffff',
        fontFamily: 'InstrumentSans, "Microsoft YaHei", sans-serif',
        fontSize: '13px'
      }
    });

    var runMermaid = function () {
      if (!document.querySelectorAll('pre.mermaid:not([data-processed])').length) { return; }
      try {
        var r = mermaid.run({ querySelector: 'pre.mermaid' });
        if (r && typeof r.then === 'function') {
          r.catch(function (e) { console.error('mermaid render error:', e); });
        }
      } catch (e) {
        console.error('mermaid render error:', e);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runMermaid);
    } else {
      runMermaid();
    }
  }

  /* ---------- 顶部阅读进度条 ---------- */
  var bar = document.getElementById('progress');
  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    if (bar) { bar.style.width = pct + '%'; }
  }
  document.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  /* ---------- 移动端目录抽屉 ---------- */
  var btn = document.getElementById('tocToggle');
  var toc = document.getElementById('toc');
  if (btn && toc) {
    btn.addEventListener('click', function () {
      toc.classList.toggle('open');
      btn.textContent = toc.classList.contains('open') ? '关闭' : '目录';
    });
    toc.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        toc.classList.remove('open');
        btn.textContent = '目录';
      }
    });
  }

  /* ---------- 侧边目录当前章节高亮 ---------- */
  if (toc && window.IntersectionObserver) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var targetMap = {};
    links.forEach(function (a) {
      targetMap[a.getAttribute('href').slice(1)] = a;
    });
    var targets = Object.keys(targetMap)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var active = targetMap[entry.target.id];
        if (!active) { return; }
        links.forEach(function (a) { a.classList.remove('active'); });
        active.classList.add('active');
      });
    }, { rootMargin: '-12% 0px -78% 0px', threshold: 0 });

    targets.forEach(function (t) { observer.observe(t); });
  }
})();
