(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = (style.getPropertyValue('--accent') || '').trim() || '#0b68d4';
  var accent2 = (style.getPropertyValue('--accent2') || '').trim() || '#0d9488';
  var ink = (style.getPropertyValue('--ink') || '').trim() || '#0f1d33';
  var muted = (style.getPropertyValue('--muted') || '').trim() || '#51637c';
  var rule = (style.getPropertyValue('--rule') || '').trim() || '#d8e2f0';

  var el = document.getElementById('chart-gantt');
  if (!el || !window.echarts) { return; }

  var chart = echarts.init(el, null, { renderer: 'svg' });

  // phase: 0 = 工程产出（蓝），1 = 硬件上板（青）
  var tasks = [
    { name: '环境部署（M1）',        start: 0.00, end: 1.00, phase: 0 },
    { name: '需求澄清 + SRS（M2）', start: 0.30, end: 1.40, phase: 0 },
    { name: '架构设计 SAD（M3）',   start: 1.30, end: 2.10, phase: 0 },
    { name: 'CubeMX 配置 + 分层编码', start: 2.00, end: 3.30, phase: 0 },
    { name: '编译构建（M4）',        start: 2.90, end: 3.50, phase: 0 },
    { name: '串口连接与验证',        start: 3.40, end: 3.80, phase: 1 },
    { name: 'ISP 串口烧录',         start: 3.70, end: 4.10, phase: 1 },
    { name: '串口调试与回归',        start: 4.00, end: 4.80, phase: 1 },
    { name: '验收交付',             start: 4.70, end: 5.00, phase: 1 }
  ];
  var categories = tasks.map(function (t) { return t.name; });

  // 经典甘特实现：透明偏移条 + 持续时间条，同一 stack
  var baseData = tasks.map(function (t) { return t.start; });
  var durationData = tasks.map(function (t) {
    return {
      value: +(t.end - t.start).toFixed(2),
      itemStyle: {
        color: t.phase === 0 ? accent : accent2,
        borderRadius: 4
      }
    };
  });

  chart.setOption({
    animation: false,
    grid: { left: 172, right: 56, top: 24, bottom: 44 },
    tooltip: {
      appendToBody: true,
      trigger: 'item',
      formatter: function (p) {
        if (p.seriesName !== 'duration') { return ''; }
        var t = tasks[p.dataIndex];
        return t.name + '<br/>第 ' + t.start.toFixed(1) + ' 天 → 第 ' +
               t.end.toFixed(1) + ' 天（' + (t.end - t.start).toFixed(1) + ' 天）';
      }
    },
    xAxis: {
      type: 'value',
      min: 0, max: 5, interval: 1,
      name: '项目天', nameLocation: 'middle', nameGap: 28,
      nameTextStyle: { color: muted, fontSize: 12 },
      axisLabel: { color: muted, formatter: 'D{value}' },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: categories,
      axisLabel: { color: ink, fontSize: 12.5 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        name: 'base',
        type: 'bar',
        stack: 'gantt',
        silent: true,
        barWidth: '56%',
        itemStyle: { color: 'rgba(0,0,0,0)' },
        emphasis: { disabled: true },
        data: baseData
      },
      {
        name: 'duration',
        type: 'bar',
        stack: 'gantt',
        barWidth: '56%',
        label: {
          show: true,
          position: 'insideRight',
          distance: 6,
          color: '#ffffff',
          fontSize: 11,
          fontFamily: 'JetBrainsMono, monospace',
          formatter: function (p) { return p.value.toFixed(1) + 'd'; }
        },
        data: durationData
      }
    ]
  });

  window.addEventListener('resize', function () { chart.resize(); });
})();
