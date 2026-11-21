/* ============================================================
 * charts.js — 图 1-2 实施甘特图
 * 方案：横向堆叠条形（透明 base 偏移条 + 实色 duration 条，同一 stack）
 * 该方案在本地浏览器实测稳定；勿改用 custom renderItem。
 * ============================================================ */
(function () {
  'use strict';

  var el = document.getElementById('chart-gantt');
  if (!el || typeof echarts === 'undefined') { return; }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = v ? v.trim() : '';
    return v || fallback;
  }

  var BLUE   = '#1457a8';   /* 桌面工程 */
  var ORANGE = '#d97316';   /* 生成/关键节点 */
  var GREEN  = '#15803d';   /* 硬件/总线/调试 */
  var INK    = cssVar('--ink', '#101b2c');
  var MUTED  = cssVar('--muted', '#55657d');
  var RULE   = cssVar('--rule', '#d7e0ec');

  /* [任务名, 开始(工作日), 工期(工作日), 阶段色] */
  var tasks = [
    ['许可申请与工具链安装',        0, 2,   BLUE],
    ['硬件到货 / DAP·CAN 接线自检', 1, 2,   GREEN],
    ['SRS 澄清两轮与基线化',        2, 2,   BLUE],
    ['DaVinci SWC 建模与 ARXML',    4, 2,   BLUE],
    ['MCAL/BSW：EB tresos + DaVinci 配置', 5, 2, BLUE],
    ['Runnable 手写编码（App/）',   6, 2,   BLUE],
    ['RTE / BSW / MCAL 代码生成',   7, 0.5, ORANGE],
    ['TASKING make 构建与错误清零', 8, 1,   BLUE],
    ['winIDEA 连接与烧录',          8, 1,   GREEN],
    ['CAN/XCP 四层调试与 AC 回归',  9, 1,   GREEN]
  ];

  /* y 轴反序：第一个任务显示在最上方 */
  var labels   = tasks.map(function (t) { return t[0]; }).reverse();
  var baseData = tasks.map(function (t) { return t[1]; }).reverse();
  var durData  = tasks.slice().reverse().map(function (t) {
    var item = {
      value: t[2],
      itemStyle: { color: t[3], borderRadius: 3 }
    };
    /* 不足 1 个工作日的短条：标签移到条右侧，避免条内文字被裁切 */
    if (t[2] < 1) {
      item.label = { show: true, position: 'right', color: t[3], fontSize: 11 };
    }
    return item;
  });

  var chart = echarts.init(el, null, { renderer: 'svg' });

  chart.setOption({
    animation: false,
    grid: { left: 210, right: 30, top: 36, bottom: 40, containLabel: false },
    tooltip: {
      appendToBody: true,
      trigger: 'item',
      formatter: function (p) {
        if (p.seriesName !== 'duration') { return ''; }
        var idx = tasks.length - 1 - p.dataIndex;
        var t = tasks[idx];
        return '<b>' + t[0] + '</b><br/>开始：第 ' + (t[1] + 1) +
               ' 工作日<br/>工期：' + t[2] + ' 工作日';
      }
    },
    xAxis: {
      type: 'value',
      name: '工作日',
      nameLocation: 'middle',
      nameGap: 28,
      min: 0,
      max: 10,
      interval: 1,
      axisLine: { lineStyle: { color: RULE } },
      axisLabel: { color: MUTED },
      splitLine: { lineStyle: { color: RULE, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: RULE } },
      axisTick: { show: false },
      axisLabel: { color: INK, fontSize: 12, width: 196, overflow: 'truncate' }
    },
    series: [
      {
        name: 'base',
        type: 'bar',
        stack: 'gantt',
        silent: true,
        barWidth: 16,
        itemStyle: { color: 'rgba(0,0,0,0)' },
        emphasis: { disabled: true },
        data: baseData,
        tooltip: { show: false }
      },
      {
        name: 'duration',
        type: 'bar',
        stack: 'gantt',
        barWidth: 16,
        label: {
          show: true,
          position: 'insideRight',
          formatter: function (p) { return p.value + 'd'; },
          color: '#fff',
          fontSize: 11
        },
        data: durData
      }
    ]
  });

  window.addEventListener('resize', function () { chart.resize(); });
})();
