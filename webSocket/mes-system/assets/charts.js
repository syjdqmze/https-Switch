(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var success = style.getPropertyValue('--success').trim();
  var warning = style.getPropertyValue('--warning').trim();
  var danger = style.getPropertyValue('--danger').trim();

  var stations = ['ST-01 产线导入', 'ST-02 生产装配', 'ST-03 外观检测', 'ST-04 生产包装', 'ST-05 生产装箱', 'ST-06 生产入库'];

  function initChart(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    return echarts.init(el, null, { renderer: 'svg' });
  }

  // ===== Chart 1: Quality Issues by Station (Bar) =====
  var chart1 = initChart('chart-quality-station');
  if (chart1) {
    chart1.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      legend: { data: ['外观缺陷', '装配不良', '尺寸超差', '包装破损', '功能异常'], top: 0, textStyle: { color: muted, fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 50, containLabel: true },
      xAxis: {
        type: 'category',
        data: stations,
        axisLabel: { color: muted, fontSize: 10, rotate: 15 },
        axisLine: { lineStyle: { color: rule } }
      },
      yAxis: {
        type: 'value',
        name: '问题数量',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } }
      },
      series: [
        { name: '外观缺陷', type: 'bar', stack: 'total', data: [0, 0, 3, 0, 0, 0], color: accent },
        { name: '装配不良', type: 'bar', stack: 'total', data: [0, 4, 0, 0, 0, 0], color: accent2 },
        { name: '尺寸超差', type: 'bar', stack: 'total', data: [0, 1, 0, 0, 0, 0], color: warning },
        { name: '包装破损', type: 'bar', stack: 'total', data: [0, 0, 0, 1, 0, 0], color: success },
        { name: '功能异常', type: 'bar', stack: 'total', data: [0, 0, 0, 0, 1, 0], color: danger }
      ]
    });
    window.addEventListener('resize', function() { chart1.resize(); });
  }

  // ===== Chart 2: Capacity Utilization (Bar) =====
  var chart2 = initChart('chart-capacity-util');
  if (chart2) {
    chart2.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true, formatter: function(p) { return p[0].name + '<br/>利用率: ' + p[0].value + '%<br/>日产能: ' + p[1].value + ' 件/日'; } },
      legend: { data: ['利用率', '日最大产能'], top: 0, textStyle: { color: muted, fontSize: 11 } },
      grid: { left: '3%', right: '8%', bottom: '3%', top: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['L01 一号产线', 'L02 二号产线', 'L03 三号产线'],
        axisLabel: { color: muted, fontSize: 11 },
        axisLine: { lineStyle: { color: rule } }
      },
      yAxis: [
        {
          type: 'value',
          name: '利用率(%)',
          nameTextStyle: { color: muted, fontSize: 11 },
          axisLabel: { color: muted, fontSize: 11, formatter: '{value}%' },
          splitLine: { lineStyle: { color: rule } },
          max: 100
        },
        {
          type: 'value',
          name: '日产能(件)',
          nameTextStyle: { color: muted, fontSize: 11 },
          axisLabel: { color: muted, fontSize: 11 },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '利用率',
          type: 'bar',
          data: [
            { value: 75, itemStyle: { color: success } },
            { value: 60, itemStyle: { color: warning } },
            { value: 55, itemStyle: { color: warning } }
          ],
          barWidth: '30%',
          label: { show: true, position: 'top', color: ink, fontSize: 12, fontWeight: 600, formatter: '{c}%' }
        },
        {
          name: '日最大产能',
          type: 'bar',
          yAxisIndex: 1,
          data: [1920, 1600, 1280],
          barWidth: '30%',
          color: accent + '40',
          label: { show: true, position: 'top', color: muted, fontSize: 10 }
        }
      ]
    });
    window.addEventListener('resize', function() { chart2.resize(); });
  }

  // ===== Chart 3: Production Output Trend (Line) =====
  var chart3 = initChart('chart-output-trend');
  if (chart3) {
    chart3.setOption({
      animation: false,
      tooltip: { trigger: 'axis', appendToBody: true },
      legend: { data: ['L01', 'L02', 'L03'], top: 0, textStyle: { color: muted, fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['7/29', '7/30', '7/31', '8/01', '8/02', '8/03', '8/04'],
        axisLabel: { color: muted, fontSize: 11 },
        axisLine: { lineStyle: { color: rule } },
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        name: '产量(件)',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } }
      },
      series: [
        { name: 'L01', type: 'line', data: [1820, 1850, 1780, 1900, 1860, 1890, 1920], smooth: true, color: accent, lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 6 },
        { name: 'L02', type: 'line', data: [1520, 1480, 1560, 1600, 1550, 1580, 1600], smooth: true, color: accent2, lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 6 },
        { name: 'L03', type: 'line', data: [1180, 1220, 1250, 1280, 1200, 1260, 1280], smooth: true, color: success, lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 6 }
      ]
    });
    window.addEventListener('resize', function() { chart3.resize(); });
  }

  // ===== Chart 4: Defect Rate by Station (Bar) =====
  var chart4 = initChart('chart-defect-rate');
  if (chart4) {
    chart4.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true, formatter: function(p) { return p[0].name + '<br/>不良率: ' + p[0].value + '%'; } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: stations,
        axisLabel: { color: muted, fontSize: 10, rotate: 15 },
        axisLine: { lineStyle: { color: rule } }
      },
      yAxis: {
        type: 'value',
        name: '不良率(%)',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'bar',
        data: [
          { value: 0.2, itemStyle: { color: success } },
          { value: 2.3, itemStyle: { color: danger } },
          { value: 1.8, itemStyle: { color: accent2 } },
          { value: 0.6, itemStyle: { color: warning } },
          { value: 0.6, itemStyle: { color: warning } },
          { value: 0.0, itemStyle: { color: success } }
        ],
        barWidth: '40%',
        label: { show: true, position: 'top', color: ink, fontSize: 11, fontWeight: 600, formatter: '{c}%' },
        markLine: {
          data: [{ yAxis: 1.0, name: '目标线' }],
          lineStyle: { color: danger, type: 'dashed' },
          label: { color: danger, fontSize: 10, formatter: '目标 1%' },
          symbol: 'none'
        }
      }]
    });
    window.addEventListener('resize', function() { chart4.resize(); });
  }

  // ===== Chart 5: Equipment OEE (Radar) =====
  var chart5 = initChart('chart-oee');
  if (chart5) {
    chart5.setOption({
      animation: false,
      tooltip: { appendToBody: true },
      legend: { data: ['L01 产线', 'L02 产线', 'L03 产线'], top: 0, textStyle: { color: muted, fontSize: 11 } },
      radar: {
        indicator: [
          { name: '可用率', max: 100 },
          { name: '表现指数', max: 100 },
          { name: '质量指数', max: 100 }
        ],
        center: ['50%', '55%'],
        radius: '65%',
        axisName: { color: ink, fontSize: 12, fontWeight: 600 },
        splitLine: { lineStyle: { color: rule } },
        splitArea: { areaStyle: { color: [bg2, 'transparent'] } },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'radar',
        data: [
          { value: [85, 78, 98], name: 'L01 产线', lineStyle: { color: accent, width: 2 }, areaStyle: { color: accent + '30' }, itemStyle: { color: accent } },
          { value: [72, 65, 96], name: 'L02 产线', lineStyle: { color: accent2, width: 2 }, areaStyle: { color: accent2 + '30' }, itemStyle: { color: accent2 } },
          { value: [68, 70, 97], name: 'L03 产线', lineStyle: { color: success, width: 2 }, areaStyle: { color: success + '30' }, itemStyle: { color: success } }
        ]
      }]
    });
    window.addEventListener('resize', function() { chart5.resize(); });
  }

  // ===== Chart 6: Cycle Time by Station (Bar) =====
  var chart6 = initChart('chart-cycle-time');
  if (chart6) {
    chart6.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true, formatter: function(p) { return p[0].name + '<br/>平均节拍: ' + p[0].value + ' 秒'; } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: stations,
        axisLabel: { color: muted, fontSize: 10, rotate: 15 },
        axisLine: { lineStyle: { color: rule } }
      },
      yAxis: {
        type: 'value',
        name: '节拍(秒)',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'bar',
        data: [
          { value: 28, itemStyle: { color: accent } },
          { value: 52, itemStyle: { color: danger } },
          { value: 35, itemStyle: { color: accent2 } },
          { value: 22, itemStyle: { color: accent } },
          { value: 18, itemStyle: { color: accent } },
          { value: 15, itemStyle: { color: accent } }
        ],
        barWidth: '45%',
        label: { show: true, position: 'top', color: ink, fontSize: 11, fontWeight: 600, formatter: '{c}s' },
        markLine: {
          data: [{ yAxis: 35, name: '产线节拍' }],
          lineStyle: { color: accent2, type: 'dashed' },
          label: { color: accent2, fontSize: 10, formatter: '节拍 35s' },
          symbol: 'none'
        }
      }]
    });
    window.addEventListener('resize', function() { chart6.resize(); });
  }
})();
