const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak
} = require("docx");

const cjkFont = "Microsoft YaHei";
const asciiFont = "Arial";

const fontConfig = { ascii: asciiFont, hAnsi: asciiFont, eastAsia: cjkFont };

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "1E5F8E" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

const ACCENT = "1E5F8E";
const ACCENT2 = "E8814D";
const HEADER_BG = "1E5F8E";
const ALT_ROW_BG = "F0F4F8";
const LIGHT_BG = "E8F0F7";

function txt(text, opts = {}) {
  return new TextRun({ text, font: fontConfig, ...opts });
}

function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [txt(text)];
  return new Paragraph({ children: runs, ...opts });
}

function heading(text, level) {
  return new Paragraph({
    heading: level,
    children: [txt(text, { bold: true })],
  });
}

function h1(text) { return heading(text, HeadingLevel.HEADING_1); }
function h2(text) { return heading(text, HeadingLevel.HEADING_2); }
function h3(text) { return heading(text, HeadingLevel.HEADING_3); }

function bullet(text, ref = "bullets", level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    children: [txt(text)],
  });
}

function cell(text, opts = {}) {
  const isHeader = opts.header || false;
  const runs = Array.isArray(text) ? text : [txt(text, {
    bold: isHeader,
    color: isHeader ? "FFFFFF" : "000000",
    size: isHeader ? 20 : 20,
  })];
  return new TableCell({
    borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: isHeader ? { fill: HEADER_BG, type: ShadingType.CLEAR } : (opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined),
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: runs, alignment: opts.align || AlignmentType.LEFT })],
  });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = 9360;
  const widths = colWidths || headers.map(() => Math.floor(totalWidth / headers.length));

  const headerRow = new TableRow({
    cantSplit: true,
    children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      cantSplit: true,
      children: row.map((c, ci) => cell(c, { width: widths[ci], shading: ri % 2 === 1 ? ALT_ROW_BG : undefined })),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

function spacer() {
  return new Paragraph({ children: [txt("")], spacing: { before: 100, after: 100 } });
}

function calloutPara(text, label) {
  return new Paragraph({
    children: [
      txt(label + "：", { bold: true, color: ACCENT }),
      txt(text),
    ],
    spacing: { before: 120, after: 120 },
    shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
    },
  });
}

// ===== Build Document Content =====
const children = [];

// Cover Page
children.push(new Paragraph({
  spacing: { before: 2400, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [txt("MES 制造执行系统", { bold: true, size: 52, color: ACCENT, font: fontConfig })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [txt("产品需求文档 PRD", { size: 32, color: "6B7785", font: fontConfig })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 600 },
  children: [txt("面向工厂生产全流程的数字化管理与执行平台", { size: 24, color: "6B7785", italics: true, font: fontConfig })],
}));

// Cover info table
const coverInfo = [
  ["文档类型", "产品需求文档"],
  ["行业领域", "制造业 / 工业软件"],
  ["系统版本", "V1.0"],
  ["日期", "2026-08-04"],
];
children.push(new Table({
  width: { size: 60, type: WidthType.PERCENTAGE },
  columnWidths: [2800, 2800],
  alignment: AlignmentType.CENTER,
  rows: coverInfo.map(([k, v]) => new TableRow({
    cantSplit: true,
    children: [
      new TableCell({ borders, width: { size: 2800, type: WidthType.DXA }, shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [p(k, { alignment: AlignmentType.RIGHT })] }),
      new TableCell({ borders, width: { size: 2800, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [p(v)] }),
    ],
  })),
}));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 1. 系统概述 =====
children.push(h1("一、系统概述"));

children.push(h2("1.1 需求背景"));
children.push(p("生产管理依赖人工排程和纸质记录时代，存在以下核心问题：生产订单排程靠经验手动分配，无法实时反映产线产能变化；生产过程各工站信息孤岛严重，工站在制品数量和流转状态不透明；质量问题分散在各工站记录本上，无法集中分析和追溯；设备状态靠巡检人员口头汇报，故障响应滞后；产能数据缺乏统一管理，排程时无法准确参考实际可用产能。"));
children.push(p("本 MES 系统旨在将工厂从订单接收、排程调度、生产执行、质量管控到入库的完整生产链条数字化，实现生产过程的透明化、可追溯和实时可控。"));

children.push(h2("1.2 需求目标"));
children.push(p("系统需覆盖以下核心能力："));
children.push(makeTable(
  ["目标维度", "具体指标", "说明"],
  [
    ["排程效率", "排程时间从 4 小时缩短至 30 分钟", "基于产能数据自动生成排程方案，人工仅做微调确认"],
    ["过程透明", "各工站在制品状态实时可见", "5 个工站的生产进度、WIP 数量实时更新"],
    ["质量追溯", "质量问题 100% 可追溯到工站和批次", "各工站质量问题统一收集，关联生产订单和产品批次"],
    ["设备可视化", "设备故障响应时间缩短 50%", "设备状态实时监控，故障自动告警"],
    ["产能管理", "产能利用率提升至 85% 以上", "产线产能可配置，排程时自动参考可用产能"],
  ],
  [2000, 3200, 4160]
));

children.push(h2("1.3 系统范围"));
children.push(p("本系统包含六大功能模块：生产调度与排程、生产过程管理、质量管理、设备管理、工厂产能管理、数据采集与分析。系统不包含 ERP 层面的采购、财务、客户管理功能，但需与 ERP 系统对接接收生产订单数据。"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 2. 系统总体架构 =====
children.push(h1("二、系统总体架构"));
children.push(p("系统采用分层架构设计，底层为数据采集层，中间为核心业务层（六大功能模块），上层为数据分析与展示层。各模块间通过统一的数据总线进行通信，确保生产数据在各环节实时流转。"));

children.push(h2("2.1 架构层次说明"));
children.push(makeTable(
  ["架构层", "包含组件", "职责说明"],
  [
    ["数据展示层", "生产排程看板、产线监控大屏、质量分析报表、设备状态监控、产能分析仪表盘", "面向各角色用户的数据可视化展示，支持实时监控和统计分析"],
    ["核心业务层", "生产调度与排程、生产过程管理、质量管理、设备管理、工厂产能管理、数据采集与分析", "系统的六大核心功能模块，处理所有生产管理业务逻辑"],
    ["数据采集层", "PLC 设备数据采集、工站扫码终端、检测设备接口、人工录入终端", "从车间现场设备和人机交互终端采集实时生产数据"],
    ["外部系统", "ERP 系统、WMS 仓储系统", "ERP 下发生产订单，WMS 接收入库指令"],
  ],
  [1800, 4000, 3560]
));

children.push(h2("2.2 模块间数据流转关系"));
children.push(makeTable(
  ["上游模块", "下游模块", "流转数据", "触发时机"],
  [
    ["ERP 系统", "生产调度与排程", "生产订单（订单号、产品、数量、交期）", "ERP 下发订单时"],
    ["工厂产能管理", "生产调度与排程", "各产线可用产能、班次配置", "排程计算前加载"],
    ["生产调度与排程", "生产过程管理", "生产任务订单（产线号、工站工序、时间）", "排程确认后自动下发"],
    ["生产过程管理", "质量管理", "各工站生产批次、在制品信息", "产品经过各工站时"],
    ["生产过程管理", "设备管理", "设备使用记录、运行时长", "设备启停时"],
    ["数据采集层", "数据采集与分析", "设备运行数据、工站扫码数据、检测结果", "实时采集"],
    ["生产过程管理", "WMS 仓储系统", "入库指令（产品、数量、批次）", "入库工站完成时"],
  ],
  [2000, 2000, 3360, 2000]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 3. 生产调度与排程 =====
children.push(h1("三、生产调度与排程"));

children.push(h2("3.1 功能说明"));
children.push(p("生产调度与排程模块是 MES 系统的起点。该模块接收来自 ERP 系统的生产订单，结合工厂产能管理模块提供的各产线可用产能数据，自动生成工厂生产排程。排程结果需明确到具体产线和具体开始/结束时间，并以生产任务订单的形式下发给生产过程管理模块执行。"));

children.push(h2("3.2 排程逻辑"));
children.push(p("排程算法按照以下优先级规则执行："));
children.push(makeTable(
  ["步骤", "规则", "处理逻辑"],
  [
    ["1", "订单优先级排序", "按交期紧急程度排序，紧急订单优先排程；同交期按订单金额排序"],
    ["2", "产线匹配", "根据产品类型匹配可生产的产线，每条产线有可生产的产品类型清单"],
    ["3", "产能校验", "查询各产线当前可用产能（考虑班次配置、设备状态），计算完成订单所需工时"],
    ["4", "任务拆分", "每个生产任务订单的产品数量固定（可配置），大订单自动拆分为多个任务订单"],
    ["5", "时间段分配", "在产线空闲时间段内分配任务订单，生成开始时间和结束时间"],
    ["6", "冲突检测", "检测同一产线同一时间段是否有重叠任务，存在冲突时调整至下一空闲时段"],
  ],
  [1000, 2500, 5860]
));

children.push(calloutPara("每个生产任务订单的产品数量固定且可配置（例如设置为 100 件/单）。当一个生产订单总数量为 500 件时，系统自动拆分为 5 个生产任务订单，每个任务订单 100 件，分别排程到产线的不同时间段。拆分粒度由工厂管理员在产能管理模块中配置。", "任务订单拆分规则"));

children.push(h2("3.3 生产任务订单数据结构"));
children.push(p("排程完成后，每个生产任务订单包含以下字段："));
children.push(makeTable(
  ["字段名称", "字段标识", "类型", "必填", "说明"],
  [
    ["生产任务订单号", "task_order_id", "String", "是", "系统自动生成，格式：TO + 日期 + 序号，如 TO20260804001"],
    ["生产订单号", "order_id", "String", "是", "关联 ERP 下发的生产订单号，如 PO20260804-001"],
    ["产品名称", "product_name", "String", "是", "生产的产品名称"],
    ["产品数量", "product_qty", "Integer", "是", "本任务订单的产品数量，固定值，由配置决定（如 100 件）"],
    ["产线号", "line_id", "String", "是", "分配的生产产线编号，如 L01、L02"],
    ["创建时间", "create_time", "DateTime", "是", "任务订单创建时间，排程生成时自动写入"],
    ["计划开始时间", "plan_start_time", "DateTime", "是", "排程分配的计划生产开始时间，精确到分钟"],
    ["计划完成时间", "plan_end_time", "DateTime", "是", "排程分配的计划生产完成时间，精确到分钟"],
    ["任务状态", "status", "Enum", "是", "待生产 / 生产中 / 已完成 / 已取消"],
  ],
  [2000, 1800, 1200, 800, 3560]
));

children.push(h2("3.4 生产调度与排程任务 UI 操作界面设计"));
children.push(p("本章节对生产调度与排程模块的 UI 操作界面进行详细设计，描述界面整体布局、各功能区域的组成与操作方式，以及用户完成排程任务的交互流程。"));

children.push(h3("3.4.1 界面整体布局"));
children.push(p("排程操作界面采用上中下三段式布局：顶部为工具栏区域，中部为视图切换与内容展示区域，底部为状态栏区域。整体页面宽度自适应浏览器窗口，最小支持分辨率 1280×720。"));
children.push(makeTable(
  ["区域", "位置", "组成元素", "职责说明"],
  [
    ["工具栏区域", "页面顶部", "产线筛选下拉框、日期选择器、自动排程按钮、重置按钮、视图切换标签页", "提供排程操作的入口控制和全局筛选条件"],
    ["内容展示区域", "页面中部", "甘特图视图 / 任务订单列表视图（通过标签页切换）", "展示排程结果，支持可视化查看和编辑操作"],
    ["状态栏区域", "页面底部", "工厂日总产能汇总、当前排程达成率、冲突告警提示", "展示全局排程状态和关键指标"],
  ],
  [1500, 1200, 3500, 3160]
));

children.push(h3("3.4.2 工具栏区域设计"));
children.push(p("工具栏位于页面顶部，从左到右依次排列以下操作元素："));
children.push(makeTable(
  ["序号", "控件名称", "控件类型", "操作说明"],
  [
    ["1", "产线筛选", "下拉选择框", "下拉选项包含\"全部产线\"及各产线编号（L01、L02、L03...），选择后甘特图和列表仅显示该产线的任务订单"],
    ["2", "日期选择器", "日期选择控件", "选择排程日期，默认为当天，选择后视图数据切换至所选日期的排程"],
    ["3", "自动排程", "主操作按钮", "蓝色主色调按钮，点击后系统自动执行排程算法，生成任务订单并分配至产线"],
    ["4", "重置", "次要按钮", "灰色按钮，点击后清除当前排程结果，恢复至未排程状态"],
    ["5", "视图切换", "标签页", "两个标签页：\"排程甘特图\"和\"任务订单列表\"，点击切换中部内容展示区域"],
  ],
  [600, 1500, 1500, 5760]
));

children.push(h3("3.4.3 甘特图视图设计"));
children.push(p("甘特图视图是排程结果的核心可视化展示界面，以产线为行、时间为列，直观呈现各任务订单在产线上的时间分配。"));
children.push(p("甘特图区域结构如下："));
children.push(makeTable(
  ["区域", "位置", "内容说明"],
  [
    ["时间轴", "甘特图顶部", "横轴为时间刻度，从 08:00 到 17:00（对应一个班次时段），每小时为一个刻度，刻度文字显示\"HH:00\"格式"],
    ["产线行标签", "甘特图左侧", "纵向排列各产线编号（L01、L02、L03），每行对应一条产线，行高 32px，标签宽度 80px"],
    ["甘特条", "产线行内", "彩色矩形条，表示一个任务订单在该产线上的时间段。条内显示任务订单号和产品数量，不同订单用不同颜色区分"],
    ["空闲区域", "产线行内", "甘特条之间的空白区域，表示该产线在该时间段无生产任务，可接受拖拽放入新任务"],
  ],
  [1500, 1500, 6360]
));

children.push(p("甘特图交互操作说明："));
children.push(makeTable(
  ["操作方式", "触发条件", "系统响应"],
  [
    ["鼠标悬停甘特条", "光标移至任一甘特条上", "显示浮动提示框，展示任务订单号、生产订单号、产品名称、数量、产线、开始-结束时间"],
    ["点击甘特条", "鼠标左键单击甘特条", "弹出任务订单详情对话框，展示完整字段信息，支持编辑产线分配和时间段"],
    ["拖拽甘特条", "鼠标左键按住甘特条左右拖动", "调整该任务订单的开始时间，系统实时计算结束时间，并检测与同产线其他任务的时间冲突"],
    ["右键甘特条", "鼠标右键单击甘特条", "弹出快捷菜单：编辑、取消任务、拆分任务、查看关联质量记录"],
  ],
  [2000, 2500, 4860]
));

children.push(h3("3.4.4 任务订单列表视图设计"));
children.push(p("任务订单列表视图以表格形式展示所有排程任务订单的详细信息，支持筛选和编辑操作。当用户需要查看完整字段或批量操作时，切换至此视图。"));
children.push(p("列表表格列定义如下："));
children.push(makeTable(
  ["列名", "数据来源", "列宽", "操作说明"],
  [
    ["任务订单号", "系统自动生成", "较宽", "可点击跳转至任务详情页"],
    ["生产订单号", "ERP 下发", "较宽", "只读，关联 ERP 订单"],
    ["产品名称", "ERP 下发", "中等", "只读"],
    ["产品数量", "配置拆分数量", "较窄", "只读，显示固定拆分数量"],
    ["产线号", "排程分配", "较窄", "下拉框，可修改产线分配，修改后系统重新检测冲突"],
    ["创建时间", "系统自动写入", "中等", "只读"],
    ["计划开始时间", "排程分配", "中等", "可编辑，修改后系统重新计算结束时间"],
    ["计划完成时间", "排程分配", "中等", "只读，由开始时间 + 所需工时自动计算"],
    ["状态", "系统更新", "较窄", "颜色标签显示：待生产（蓝色）、生产中（绿色）、已完成（灰色）、已取消（红色）"],
  ],
  [1500, 1500, 800, 5560]
));

children.push(p("列表上方提供筛选工具栏，包含以下筛选条件："));
children.push(bullet("产线筛选：下拉选择框，筛选指定产线的任务订单"));
children.push(bullet("状态筛选：下拉选择框，筛选指定状态的任务订单"));
children.push(bullet("搜索框：输入任务订单号或生产订单号进行模糊搜索"));
children.push(bullet("导出按钮：将当前筛选结果导出为 Excel 文件"));

children.push(h3("3.4.5 底部状态栏设计"));
children.push(p("状态栏位于页面底部，固定显示全局排程指标："));
children.push(makeTable(
  ["指标项", "显示格式", "说明"],
  [
    ["工厂日总产能", "\"4800 件/日\"", "汇总所有正常状态产线的日最大产能"],
    ["已排程产能", "\"3200 件\"", "汇总所有已排程任务订单的产品数量"],
    ["排程达成率", "\"66.7%\"", "已排程产能 / 日总产能 × 100%"],
    ["冲突告警", "红色文字提示", "若存在时间冲突的任务订单，显示\"存在 N 个冲突任务，请处理\"，点击可跳转至冲突列表"],
  ],
  [2000, 2500, 4860]
));

children.push(h3("3.4.6 用户操作流程"));
children.push(p("生产调度员完成一次排程操作的完整流程如下："));
children.push(makeTable(
  ["步骤", "操作", "系统响应", "界面变化"],
  [
    ["1", "打开排程看板页面", "加载当天排程数据", "甘特图和列表展示当前排程状态，状态栏显示产能指标"],
    ["2", "在工具栏选择日期", "加载所选日期的排程数据", "甘特图和列表切换至所选日期数据"],
    ["3", "点击\"自动排程\"按钮", "系统执行排程算法（约 30 秒）", "按钮显示 loading 状态，完成后弹出提示\"排程完成，共处理 N 个订单，拆分为 M 个任务订单\""],
    ["4", "查看甘特图排程结果", "甘特图渲染所有任务订单甘特条", "各产线行内显示彩色甘特条，空闲区域为空白"],
    ["5", "悬停或点击甘特条查看详情", "显示浮动提示或详情对话框", "展示任务订单完整信息"],
    ["6", "如需调整，拖拽甘特条或编辑列表", "系统实时重新计算和冲突检测", "甘特条位置更新，如有冲突状态栏显示告警"],
    ["7", "确认排程无误，点击\"下发\"按钮", "系统将任务订单下发至生产过程管理模块", "按钮变为\"已下发\"，任务状态更新为\"待生产\""],
  ],
  [600, 2500, 2500, 3760]
));

children.push(h3("3.4.7 界面视觉规范"));
children.push(makeTable(
  ["设计元素", "规格", "说明"],
  [
    ["主色调", "#1E5F8E（深蓝色）", "用于标题、主操作按钮、选中状态"],
    ["辅助色", "#E8814D（橙色）", "用于告警提示、次要操作按钮"],
    ["成功色", "#2D9E6E（绿色）", "用于运行中状态、排程达成率达标"],
    ["危险色", "#D4453A（红色）", "用于故障状态、冲突告警"],
    ["背景色", "#F0F2F5（浅灰）", "页面整体背景"],
    ["表格表头", "深蓝底白字", "表头行背景色 #1E5F8E，文字白色"],
    ["表格斑马纹", "奇数行白色、偶数行 #F0F4F8", "提高数据行可读性"],
    ["甘特条高度", "24px", "条内文字 12px 白色加粗"],
    ["按钮圆角", "6px", "统一控件圆角风格"],
    ["字体", "微软雅黑 / Arial", "中文使用微软雅黑，英文和数字使用 Arial"],
  ],
  [1800, 2500, 5060]
));

children.push(h3("3.4.8 界面整体布局画面"));
children.push(p("以下为生产调度与排程任务操作界面的整体布局线框图，展示工具栏区域、内容展示区域（甘特图视图）和底部状态栏区域的空间结构和元素排布。"));

// --- Wireframe helper functions ---
const WF_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const wfBorders = { top: WF_BORDER, bottom: WF_BORDER, left: WF_BORDER, right: WF_BORDER };

function wfCell(text, opts) {
  opts = opts || {};
  var lines = text ? text.split("\n") : [""];
  var paras = lines.map(function(line) {
    return new Paragraph({
      children: [new TextRun({
        text: line,
        size: opts.size || 16,
        bold: opts.bold || false,
        color: opts.color || "333333",
        font: fontConfig,
      })],
      alignment: opts.align || AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
    });
  });
  return new TableCell({
    borders: wfBorders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    columnSpan: opts.colSpan,
    margins: { top: 50, bottom: 50, left: 40, right: 40 },
    verticalAlign: VerticalAlign.CENTER,
    children: paras,
  });
}

function pushArray(arr, items) {
  items.forEach(function(el) { arr.push(el); });
}

function buildStationWireframe(title, layout, operations, faultOperations) {
  var items = [];
  var swColW = [2340, 2340, 2340, 2340];
  var swTotalW = swColW[0] + swColW[1] + swColW[2] + swColW[3];
  var swRows = [];

  layout.forEach(function(rowData, idx) {
    if (idx === 0) {
      swRows.push(new TableRow({
        cantSplit: true,
        children: [wfCell(title + "    " + rowData.join("    "), {
          colSpan: 4, width: swTotalW, fill: "1E5F8E", color: "FFFFFF",
          bold: true, size: 18, align: AlignmentType.LEFT,
        })],
      }));
    } else if (idx === 1) {
      swRows.push(new TableRow({
        cantSplit: true,
        children: [
          wfCell("[ 操作区 ]", { colSpan: 2, width: swColW[0] + swColW[1], fill: "D6E4F0", color: "1E5F8E", bold: true, size: 16 }),
          wfCell("[ 信息显示区 ]", { colSpan: 2, width: swColW[2] + swColW[3], fill: "D6E4F0", color: "1E5F8E", bold: true, size: 16 }),
        ],
      }));
    } else {
      var rowCells = [];
      for (var i = 0; i < 4; i++) {
        var text = rowData[i] || "";
        var isLeft = i < 2;
        rowCells.push(wfCell(text, {
          width: swColW[i],
          fill: isLeft ? "FFFFFF" : "F8F9FA",
          size: 15,
          align: AlignmentType.LEFT,
          color: "333333",
        }));
      }
      swRows.push(new TableRow({
        cantSplit: true,
        children: rowCells,
      }));
    }
  });

  swRows.push(new TableRow({
    cantSplit: true,
    children: [
      wfCell("[ 确认操作完成 ]", { colSpan: 2, width: swColW[0] + swColW[1], fill: "E8F5E9", color: "2E7D32", bold: true, size: 16, align: AlignmentType.CENTER }),
      wfCell("确认后界面重置为待扫描状态", { colSpan: 2, width: swColW[2] + swColW[3], fill: "F8F9FA", color: "666666", size: 15, align: AlignmentType.LEFT }),
    ],
  }));

  swRows.push(new TableRow({
    cantSplit: true,
    children: [wfCell("操作按钮栏区域", {
      colSpan: 4, width: swTotalW, fill: "F0F2F5", color: "666666",
      bold: true, size: 16, align: AlignmentType.LEFT,
    })],
  }));

  swRows.push(new TableRow({
    cantSplit: true,
    children: [
      wfCell("[ 退出 ]", { colSpan: 4, width: swTotalW, fill: "FFFFFF", color: "333333", size: 16, align: AlignmentType.CENTER }),
    ],
  }));

  items.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: swColW,
    rows: swRows,
  }));
  items.push(spacer());
  items.push(p("操作区操作方法说明："));
  operations.push(["点击\"确认操作完成\"按钮", "当本工站所有操作步骤完成后，点击操作区的\"确认操作完成\"按钮，系统根据故障检测操作区是否填写故障信息执行不同流程：若未检测到故障（故障检测操作区未填写），系统确认本站操作已完成，将当前产品状态更新为已流转并推送至下一工站，当前工站WIP数量减1、已完成数量加1；若已检测到故障（已选择故障类型并填写故障描述），系统生成故障记录单（包含故障编号、工站编号、产品序列号、故障类型、故障等级、故障描述、操作员工号、提交时间）并保存至质量管理系统，自动将下一工站标记为维修站，将故障产品信息推送至ST-00维修站，当前工站WIP数量减1、维修站待维修数量加1。确认后操作界面自动重置为待扫描状态：顶部信息栏的任务订单号、产品、产品序列号、数量/批次恢复为\"--\"或\"待扫描\"，操作区各步骤控件和故障检测操作区控件恢复初始状态，等待操作员扫描新产品条码继续作业。"]);
  operations.push(["点击\"退出\"按钮", "点击底部按钮栏的\"退出\"按钮，系统在当前工站操作界面上方弹出退出操作设置弹窗，工站操作界面背景置灰不可操作。在弹窗中选择\"正常登出\"或\"故障登出\"并完成相关设置后，点击\"确认退出\"，系统保存退出信息并清除登录状态，界面返回工站操作登录界面。正常登出后工站状态设置为\"待机\"，故障登出后工站状态设置为\"故障\"并自动向维护人员发送告警通知。"]);
  items.push(makeTable(
    ["操作步骤", "操作方法"],
    operations,
    [2200, 7160]
  ));
  items.push(spacer());

  if (faultOperations && faultOperations.length > 0) {
    items.push(p("故障检测操作区操作方法说明："));
    items.push(makeTable(
      ["操作步骤", "操作方法"],
      faultOperations,
      [2200, 7160]
    ));
    items.push(spacer());
  }

  return items;
}

function buildFaultDetectionFlow(stationName, flowItems) {
  var items = [];
  items.push(p("故障检测操作流程定义："));
  items.push(makeTable(
    ["检测步骤", "检测动作", "合格判定标准", "不合格处理动作", "后续流转"],
    flowItems,
    [1500, 1800, 1800, 2200, 2060]
  ));
  items.push(spacer());
  return items;
}

function buildFaultTypeDetails(stationName, faultTypes) {
  var items = [];
  items.push(p("故障类型详细说明（" + stationName + "）："));
  items.push(makeTable(
    ["故障类型", "故障等级", "故障说明", "处理动作"],
    faultTypes,
    [1800, 800, 4000, 1960]
  ));
  items.push(spacer());
  return items;
}

function buildStatusRules(stationName, runningOps) {
  var items = [];
  items.push(p(stationName + "操作界面\"状态\"显示信息规则描述："));
  items.push(makeTable(
    ["状态值", "显示标识", "触发条件", "操作权限", "说明"],
    [
      ["运行中", "绿色标识", "操作员登录后，系统读取工站当前状态为非故障状态（包括\"待机\"和\"运行中\"）", "全部操作可用", "信息栏状态显示为\"运行中\"，操作员可正常执行" + runningOps + "等操作"],
      ["故障", "红色标识", "操作员登录后，系统读取工站当前状态为\"故障\"状态", "仅\"退出\"按钮可用，操作区的\"确认操作完成\"按钮和其他操作按钮、故障检测按钮置灰禁用", "信息栏状态以红色标识显示\"故障\"，操作区仅显示故障信息，操作员需点击\"退出\"按钮退出工站，等待维护人员修复设备并将工站状态切换为非故障状态后重新登录"],
    ],
    [1000, 1000, 2400, 1600, 2560]
  ));
  items.push(spacer());
  return items;
}

// Column widths: 1 label col + 9 time cols
var colW = [1100, 918, 918, 918, 918, 918, 918, 918, 918, 918];
var totalW = colW.reduce(function(a, b) { return a + b; }, 0);

// --- Build wireframe table ---
var wfRows = [];

// Row 1: Toolbar (full width)
wfRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("工具栏区域", {
    colSpan: 10, width: totalW, fill: "1E5F8E", color: "FFFFFF",
    bold: true, size: 18, align: AlignmentType.LEFT,
  })],
}));

// Row 2: Toolbar controls
wfRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("[ 产线筛选: 全部产线 ▼ ]  [ 日期: 2026-08-04 📅 ]  [ 自动排程 ]  [ 重置 ]", {
    colSpan: 10, width: totalW, fill: "D6E4F0", color: "1E5F8E",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

// Row 3: Tab labels
wfRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("排程甘特图", { colSpan: 5, width: Math.floor(totalW / 2), fill: "FFFFFF", color: "1E5F8E", bold: true }),
    wfCell("任务订单列表", { colSpan: 5, width: Math.floor(totalW / 2), fill: "E8EDF2", color: "999999" }),
  ],
}));

// Row 4: Time axis header
wfRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("产线 \\ 时间", { width: colW[0], fill: "F0F2F5", bold: true, size: 14 }),
    wfCell("08:00", { width: colW[1], fill: "F0F2F5", size: 14 }),
    wfCell("09:00", { width: colW[2], fill: "F0F2F5", size: 14 }),
    wfCell("10:00", { width: colW[3], fill: "F0F2F5", size: 14 }),
    wfCell("11:00", { width: colW[4], fill: "F0F2F5", size: 14 }),
    wfCell("12:00", { width: colW[5], fill: "F0F2F5", size: 14 }),
    wfCell("13:00", { width: colW[6], fill: "F0F2F5", size: 14 }),
    wfCell("14:00", { width: colW[7], fill: "F0F2F5", size: 14 }),
    wfCell("15:00", { width: colW[8], fill: "F0F2F5", size: 14 }),
    wfCell("16:00", { width: colW[9], fill: "F0F2F5", size: 14 }),
  ],
}));

// Row 5: L01 gantt row
wfRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("产线\nL01", { width: colW[0], fill: "FFFFFF", bold: true, size: 14 }),
    wfCell("TO001\n100件", { width: colW[1], fill: "1E5F8E", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO001", { width: colW[2], fill: "1E5F8E", color: "FFFFFF", size: 12 }),
    wfCell("", { width: colW[3], fill: "FAFBFC" }),
    wfCell("", { width: colW[4], fill: "FAFBFC" }),
    wfCell("", { width: colW[5], fill: "FAFBFC" }),
    wfCell("TO002\n100件", { width: colW[6], fill: "1E5F8E", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO002", { width: colW[7], fill: "1E5F8E", color: "FFFFFF", size: 12 }),
    wfCell("", { width: colW[8], fill: "FAFBFC" }),
    wfCell("", { width: colW[9], fill: "FAFBFC" }),
  ],
}));

// Row 6: L02 gantt row
wfRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("产线\nL02", { width: colW[0], fill: "FFFFFF", bold: true, size: 14 }),
    wfCell("TO003\n100件", { width: colW[1], fill: "E8814D", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO003", { width: colW[2], fill: "E8814D", color: "FFFFFF", size: 12 }),
    wfCell("TO003", { width: colW[3], fill: "E8814D", color: "FFFFFF", size: 12 }),
    wfCell("", { width: colW[4], fill: "FAFBFC" }),
    wfCell("", { width: colW[5], fill: "FAFBFC" }),
    wfCell("TO004\n100件", { width: colW[6], fill: "E8814D", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO004", { width: colW[7], fill: "E8814D", color: "FFFFFF", size: 12 }),
    wfCell("TO004", { width: colW[8], fill: "E8814D", color: "FFFFFF", size: 12 }),
    wfCell("", { width: colW[9], fill: "FAFBFC" }),
  ],
}));

// Row 7: L03 gantt row
wfRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("产线\nL03", { width: colW[0], fill: "FFFFFF", bold: true, size: 14 }),
    wfCell("TO005\n100件", { width: colW[1], fill: "2D9E6E", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO005", { width: colW[2], fill: "2D9E6E", color: "FFFFFF", size: 12 }),
    wfCell("TO006\n100件", { width: colW[3], fill: "2D9E6E", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO006", { width: colW[4], fill: "2D9E6E", color: "FFFFFF", size: 12 }),
    wfCell("", { width: colW[5], fill: "FAFBFC" }),
    wfCell("TO008\n100件", { width: colW[6], fill: "8B5CF6", color: "FFFFFF", bold: true, size: 12 }),
    wfCell("TO008", { width: colW[7], fill: "8B5CF6", color: "FFFFFF", size: 12 }),
    wfCell("TO008", { width: colW[8], fill: "8B5CF6", color: "FFFFFF", size: 12 }),
    wfCell("", { width: colW[9], fill: "FAFBFC" }),
  ],
}));

// Row 8: Status bar (full width)
wfRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("状态栏区域", {
    colSpan: 10, width: totalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

// Row 9: Status bar content
wfRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("工厂日总产能: 4800 件/日    已排程: 3200 件    排程达成率: 66.7%    [!] 存在 0 个冲突任务", {
    colSpan: 10, width: totalW, fill: "FFF8E6", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: colW,
  rows: wfRows,
}));

children.push(spacer());

// Legend table
children.push(p("布局图各区域说明："));
children.push(makeTable(
  ["区域", "图中位置", "背景色", "内容说明"],
  [
    ["工具栏区域", "第 1-2 行", "深蓝色 / 浅蓝色", "产线筛选、日期选择器、自动排程按钮、重置按钮"],
    ["视图切换标签页", "第 3 行", "白色（选中）/ 灰色（未选中）", "\"排程甘特图\"和\"任务订单列表\"两个标签页"],
    ["甘特图时间轴", "第 4 行", "浅灰色", "横轴时间刻度，从 08:00 到 16:00，每小时一格"],
    ["甘特图产线行", "第 5-7 行", "彩色甘特条 / 浅色空白", "L01（蓝色）、L02（橙色）、L03（绿色/紫色）的任务订单甘特条"],
    ["状态栏区域", "第 8-9 行", "浅灰色 / 浅黄色", "工厂日总产能、已排程产能、排程达成率、冲突告警"],
  ],
  [1800, 1200, 2500, 3860]
));

children.push(p("图中甘特条颜色对应说明：蓝色为 L01 产线任务订单，橙色为 L02 产线任务订单，绿色为 L03 产线已完成的任务订单，紫色为 L03 产线待生产任务订单。空白区域表示该产线在该时间段无生产任务，为空闲产能。"));

// ===== Task Order List View Wireframe =====
children.push(p("以下为切换至\"任务订单列表\"视图时的界面整体布局线框图："));

// List view column widths
var lstColW = [1300, 1300, 1100, 700, 700, 1100, 900, 900, 760];
var lstTotalW = lstColW.reduce(function(a, b) { return a + b; }, 0);

var lstRows = [];

// Row 1: Toolbar (same as gantt view)
lstRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("工具栏区域", {
    colSpan: 9, width: lstTotalW, fill: "1E5F8E", color: "FFFFFF",
    bold: true, size: 18, align: AlignmentType.LEFT,
  })],
}));

// Row 2: Toolbar controls
lstRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("[ 产线筛选: 全部产线 ▼ ]  [ 日期: 2026-08-04 📅 ]  [ 自动排程 ]  [ 重置 ]", {
    colSpan: 9, width: lstTotalW, fill: "D6E4F0", color: "1E5F8E",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

// Row 3: Tab labels (list tab now active)
lstRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("排程甘特图", { colSpan: 4, width: Math.floor(lstTotalW * 4 / 9), fill: "E8EDF2", color: "999999" }),
    wfCell("任务订单列表", { colSpan: 5, width: lstTotalW - Math.floor(lstTotalW * 4 / 9), fill: "FFFFFF", color: "1E5F8E", bold: true }),
  ],
}));

// Row 4: List filter bar
lstRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("筛选: [ 产线 ▼ ]  [ 状态 ▼ ]  [ 搜索: 输入订单号... ]  [ 导出Excel ]", {
    colSpan: 9, width: lstTotalW, fill: "F0F4F8", color: "666666",
    size: 15, align: AlignmentType.LEFT,
  })],
}));

// Row 5: Table header
var lstHeaders = ["任务订单号", "生产订单号", "产品名称", "数量", "产线", "创建时间", "计划开始", "计划完成", "状态"];
lstRows.push(new TableRow({
  cantSplit: true,
  children: lstHeaders.map(function(h, i) {
    return wfCell(h, { width: lstColW[i], fill: "1E5F8E", color: "FFFFFF", bold: true, size: 15 });
  }),
}));

// Data rows
var lstData = [
  ["TO20260804001", "PO20260804-001", "电机壳体A型", "100", "L01", "08-04 08:00", "08:00", "10:00", "生产中"],
  ["TO20260804002", "PO20260804-001", "电机壳体A型", "100", "L01", "08-04 08:00", "10:00", "12:00", "待生产"],
  ["TO20260804003", "PO20260804-002", "控制器B型", "100", "L02", "08-04 08:00", "08:00", "11:00", "生产中"],
  ["TO20260804004", "PO20260804-002", "控制器B型", "100", "L02", "08-04 08:00", "13:00", "16:00", "待生产"],
  ["TO20260804005", "PO20260804-003", "传感器C型", "100", "L03", "08-04 08:00", "08:00", "09:30", "已完成"],
  ["TO20260804006", "PO20260804-003", "传感器C型", "100", "L03", "08-04 08:00", "09:30", "11:00", "已完成"],
  ["TO20260804007", "PO20260804-004", "电机壳体A型", "100", "L01", "08-04 08:00", "13:00", "15:00", "待生产"],
  ["TO20260804008", "PO20260804-005", "控制器B型", "100", "L03", "08-04 08:00", "13:00", "16:00", "待生产"],
];

var statusColors = {
  "生产中": { fill: "E6F7EE", color: "2D9E6E" },
  "待生产": { fill: "E8F0F7", color: "1E5F8E" },
  "已完成": { fill: "F0F2F5", color: "999999" },
};

lstData.forEach(function(row, ri) {
  var rowFill = ri % 2 === 1 ? "FAFBFC" : "FFFFFF";
  lstRows.push(new TableRow({
    cantSplit: true,
    children: row.map(function(cellText, ci) {
      var st = statusColors[cellText];
      if (st && ci === 8) {
        return wfCell(cellText, { width: lstColW[ci], fill: st.fill, color: st.color, bold: true, size: 14 });
      }
      return wfCell(cellText, { width: lstColW[ci], fill: rowFill, size: 14 });
    }),
  }));
});

// Pagination row
lstRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("共 8 条记录  |  第 1/1 页  |  [ 首页 ] [ 上一页 ] [ 下一页 ] [ 末页 ]", {
    colSpan: 9, width: lstTotalW, fill: "F0F4F8", color: "666666",
    size: 14, align: AlignmentType.RIGHT,
  })],
}));

// Status bar
lstRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("状态栏区域", {
    colSpan: 9, width: lstTotalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

lstRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("工厂日总产能: 4800 件/日    已排程: 800 件    排程达成率: 16.7%    [!] 存在 0 个冲突任务", {
    colSpan: 9, width: lstTotalW, fill: "FFF8E6", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: lstColW,
  rows: lstRows,
}));

children.push(spacer());

// List view legend
children.push(p("任务订单列表视图布局图各区域说明："));
children.push(makeTable(
  ["区域", "图中位置", "背景色", "内容说明"],
  [
    ["工具栏区域", "第 1-2 行", "深蓝色 / 浅蓝色", "与甘特图视图共用，包含产线筛选、日期选择器、自动排程、重置按钮"],
    ["视图切换标签页", "第 3 行", "灰色（未选中）/ 白色（选中）", "\"任务订单列表\"标签页为选中状态，\"排程甘特图\"为未选中状态"],
    ["列表筛选工具栏", "第 4 行", "浅蓝色", "产线筛选、状态筛选、搜索框、导出Excel按钮"],
    ["列表表头", "第 5 行", "深蓝色底白字", "9 列：任务订单号、生产订单号、产品名称、数量、产线、创建时间、计划开始、计划完成、状态"],
    ["列表数据行", "第 6-13 行", "白色 / 浅灰色斑马纹", "8 条任务订单数据，状态列使用彩色标签区分"],
    ["分页栏", "第 14 行", "浅蓝色", "记录总数、页码、翻页按钮"],
    ["状态栏区域", "第 15-16 行", "浅灰色 / 浅黄色", "与甘特图视图共用，展示全局产能指标和冲突告警"],
  ],
  [1800, 1200, 2500, 3860]
));

children.push(p("列表视图与甘特图视图共享相同的工具栏和底部状态栏，差异在于中部内容区域：甘特图视图以可视化甘特条展示时间分配，列表视图以表格形式展示完整字段数据并支持筛选、搜索和导出操作。状态列使用绿色标签表示\"生产中\"、蓝色标签表示\"待生产\"、灰色标签表示\"已完成\"。"));

children.push(h2("3.5 排程看板页面布局"));
children.push(p("排程看板分为两个视图：甘特图视图以产线为行、时间为列，直观展示各任务订单在产线上的时间分配；任务订单列表视图以表格形式展示所有任务订单的详细字段信息，支持按产线、状态筛选。顶部工具栏提供产线筛选、日期选择和自动排程操作按钮。"));

children.push(h2("3.6 业务逻辑"));
children.push(p("用户从 ERP 接收生产订单后，点击\"自动排程\"按钮触发排程计算。系统按排程逻辑的 6 个步骤依次执行：读取待排程订单并按优先级排序，匹配可生产产线，查询可用产能，按固定数量拆分任务订单，在产线空闲时段分配时间，检测并解决冲突。排程完成后甘特图和订单列表同步更新，展示分配结果。用户可在甘特图上拖拽调整任务时间段，也可在列表中修改产线分配，修改后系统重新检测冲突。"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 4. 生产过程管理 =====
children.push(h1("四、生产过程管理"));

children.push(h2("4.1 站点说明"));
children.push(p("生产过程管理模块负责管理产品在产线上各工站之间的流转过程。每条产线包含 5 个标准工站站点，产品按照工站顺序依次流转，系统实时记录每个工站的在制品数量、生产进度和流转状态。"));

children.push(h3("4.1.1 产线工站站点定义"));
children.push(p("每条产线包含以下 5 个工站站点，产品按顺序依次经过："));
children.push(makeTable(
  ["序号", "工站名称", "工站编码", "核心职责", "关键操作"],
  [
    ["1", "产线导入工站", "ST-01", "接收排程下发的任务订单，导入生产物料和BOM清单", "扫描任务订单号、物料齐套检查、导入BOM、初始化批次号"],
    ["2", "生产装配工站", "ST-02", "按照BOM和工艺要求进行产品装配", "扫描物料条码、按工艺步骤装配、装配工时记录、装配结果确认"],
    ["3", "生产外观检测工站", "ST-03", "对装配完成的产品进行外观质量检测", "外观项目检查、缺陷拍照记录、检测结论判定（合格/不合格/让步接收）"],
    ["4", "生产包装工站", "ST-04", "对检测合格的产品进行包装", "扫描产品序列号、选择包装规格、包装操作确认、打印包装标签"],
    ["5", "生产装箱入库工站", "ST-05", "将包装好的产品按数量要求装箱并完成成品入库", "扫描产品条码入箱、装箱数量校验、封箱操作、打印箱号标签、扫描箱号、确认入库数量、生成入库单、同步WMS系统"],
  ],
  [600, 1600, 1000, 3000, 3160]
));

children.push(h3("4.1.2 工站状态定义"));
children.push(makeTable(
  ["状态", "标识颜色", "含义", "触发条件"],
  [
    ["运行中", "绿色", "工站正在执行生产操作", "有在制品且操作员已确认开始"],
    ["待机", "灰色", "工站无在制品，等待上游流转", "WIP = 0"],
    ["故障", "红色", "工站设备故障，无法生产", "设备管理模块推送故障状态"],
    ["维护", "橙色", "工站正在进行计划性维护", "维护计划到期或手动设置"],
  ],
  [1500, 1200, 3000, 3660]
));

children.push(h3("4.1.3 页面布局与工站运行状态示例"));
children.push(p("页面主体为横向工站流程图，5 个工站卡片从左到右排列，卡片间用箭头连接表示产品流转方向。每个工站卡片显示工站名称、运行状态、当前在制品数量和已完成数量。点击任一工站卡片，下方展开该工站的详细信息面板，包括当前操作员工号、设备编号、任务订单号、工站操作记录等。"));
children.push(p("以下为产线 L01 各工站的实时运行状态示例："));
children.push(makeTable(
  ["工站编码", "工站名称", "状态", "在制品数量(WIP)", "已完成数量", "操作员工号", "设备编号"],
  [
    ["ST-01", "产线导入", "运行中", "25", "180", "OP-1023", "EQ-L01-001"],
    ["ST-02", "生产装配", "运行中", "18", "175", "OP-1024", "EQ-L01-002"],
    ["ST-03", "外观检测", "运行中", "12", "170", "OP-1025", "EQ-L01-003"],
    ["ST-04", "生产包装", "运行中", "8", "165", "OP-1026", "EQ-L01-004"],
    ["ST-05", "生产装箱入库", "待机", "0", "155", "OP-1027", "EQ-L01-005"],
  ],
  [1000, 1200, 900, 1300, 1100, 1100, 1000]
));

children.push(h2("4.2 工站故障检测与维修流转"));
children.push(p("每个工站在生产过程中均需执行故障检测流程。当工站检测到产品故障时，在当前工站对故障进行分类标记，并将产品的下一流转目标标记为维修站而非正常后续工站，产品进入维修站进行维修处理后，根据维修结果决定是否返回原工站继续生产或标记为报废。"));

children.push(h3("4.2.1 故障检测通用流程"));
children.push(p("所有工站共享统一的故障检测处理框架，各工站在此框架基础上定义本工站特有的检测项目和故障分类："));
children.push(makeTable(
  ["步骤", "环节", "处理逻辑", "系统响应"],
  [
    ["1", "故障检测", "工站在完成本站生产操作后，根据该工站的检测项目清单对产品进行检测", "检测通过则进入步骤6正常流转；检测不通过则进入步骤2"],
    ["2", "故障分类", "操作员或自动检测设备在当前工站对故障进行分类，选择故障类型和严重等级", "系统记录故障分类信息，生成故障记录单，关联产品序列号和当前工站"],
    ["3", "维修站标记", "系统将该产品的下一流转目标从正常后续工站变更为维修站", "产品状态标记为\"待维修\"，流转路径变更为：当前工站 → 维修站"],
    ["4", "维修处理", "维修站接收待维修产品，根据故障分类执行维修操作", "维修完成后记录维修结果（修复成功/修复失败/报废）"],
    ["5", "维修后流转", "维修成功的产品返回原故障工站重新检测；维修失败的产品标记为报废", "修复成功：产品返回步骤1重新检测；报废：产品状态标记为\"已报废\"，终止流转"],
    ["6", "正常流转", "检测通过的产品按正常路径流转至下一工站", "产品状态更新为\"正常\"，WIP数量同步更新"],
  ],
  [600, 1500, 3500, 3760]
));

children.push(h3("4.2.2 ST-01 产线导入工站故障检测"));
children.push(p("产线导入工站在物料齐套检查和 BOM 导入阶段执行故障检测，主要检测物料是否齐全、BOM 是否匹配。"));
children.push(makeTable(
  ["检测项目", "故障类型", "严重等级", "处理方式", "维修站操作说明"],
  [
    ["物料齐套检查", "物料缺失", "严重", "暂停导入，通知维修站补充物料", "维修站接收物料补充需求，人工补齐缺失物料后返回 ST-01 重新导入"],
    ["BOM 版本匹配", "BOM 版本不一致", "一般", "标记下一站为维修站，由维修站核对正确BOM版本", "维修站核对产品对应的正确BOM版本，修正后返回 ST-01 重新导入"],
    ["物料条码扫描", "条码无法识别", "轻微", "标记下一站为维修站，由维修站人工录入物料信息", "维修站操作员人工核对物料并手动录入物料信息，返回 ST-01 确认"],
    ["批次号初始化", "批次号生成失败", "严重", "标记下一站为维修站，由维修站排查系统异常", "维修站排查批次号生成模块异常，修复后返回 ST-01 重新初始化"],
  ],
  [1800, 1500, 800, 2200, 3060]
));

children.push(h3("4.2.3 ST-02 生产装配工站故障检测"));
children.push(p("生产装配工站在装配完成后对装配结果进行检测，主要检测装配精度、零部件完整性、紧固力矩等。"));
children.push(makeTable(
  ["检测项目", "故障类型", "严重等级", "处理方式", "维修站操作说明"],
  [
    ["装配精度检测", "尺寸超差", "严重", "标记下一站为维修站，产品转入维修站调整", "维修站对超差部位进行重新调整或返工装配，修复后返回 ST-02 重新检测"],
    ["零部件完整性", "漏装/错装", "致命", "标记下一站为维修站，产品转入维修站补装", "维修站核对 BOM 补装缺失零部件或拆除错装零部件重新装配，返回 ST-02 复检"],
    ["紧固力矩检测", "力矩不足/过大", "严重", "标记下一站为维修站，产品转入维修站重新紧固", "维修站按标准力矩重新紧固，修复后返回 ST-02 复检"],
    ["装配外观检查", "划伤/变形", "一般", "标记下一站为维修站，产品转入维修站修复外观", "维修站对划伤或变形部位进行修复或更换零部件，返回 ST-02 复检"],
    ["功能预测试", "功能异常", "致命", "标记下一站为维修站，产品转入维修站排查故障", "维修站对功能异常进行电路/机械排查，修复后返回 ST-02 复检；无法修复则报废"],
  ],
  [1800, 1500, 800, 2200, 3060]
));

children.push(h3("4.2.4 ST-03 生产外观检测工站故障检测"));
children.push(p("外观检测工站是核心质量把关工站，对产品进行全面外观质量检测，检测项目最多、分类最细。"));
children.push(makeTable(
  ["检测项目", "故障类型", "严重等级", "处理方式", "维修站操作说明"],
  [
    ["表面缺陷检测", "外观缺陷-划痕", "一般", "标记下一站为维修站，产品转入维修站修复表面", "维修站对划痕部位进行打磨抛光或更换外壳件，修复后返回 ST-03 复检"],
    ["表面缺陷检测", "外观缺陷-污渍", "轻微", "标记下一站为维修站，产品转入维修站清洁", "维修站对污渍部位进行清洁处理，清洁后返回 ST-03 复检"],
    ["色差检测", "外观缺陷-色差", "一般", "标记下一站为维修站，产品转入维修站处理", "维修站评估色差程度，轻微则让步接收，严重则更换外观件，返回 ST-03 复检"],
    ["结构完整性", "外观缺陷-破损", "致命", "标记下一站为维修站，产品转入维修站评估", "维修站评估破损程度，可修复则更换破损件，不可修复则标记报废"],
    ["标识/标签检测", "标识缺失/错误", "严重", "标记下一站为维修站，产品转入维修站补标", "维修站核对正确标识内容，重新打印粘贴标签，返回 ST-03 复检"],
    ["尺寸外观检测", "尺寸超差", "严重", "标记下一站为维修站，产品转入维修站调整", "维修站对超差部位进行机械调整或返工，修复后返回 ST-03 复检"],
  ],
  [1800, 1500, 800, 2200, 3060]
));

children.push(h3("4.2.5 ST-04 生产包装工站故障检测"));
children.push(p("包装工站在包装完成后对包装质量进行检测，主要检测包装规格、密封性、标签正确性等。"));
children.push(makeTable(
  ["检测项目", "故障类型", "严重等级", "处理方式", "维修站操作说明"],
  [
    ["包装规格匹配", "包装规格错误", "严重", "标记下一站为维修站，产品转入维修站重新包装", "维修站拆除错误包装，按正确规格重新包装，返回 ST-04 复检"],
    ["包装密封性", "密封不良", "一般", "标记下一站为维修站，产品转入维修站重新密封", "维修站检查密封部位，重新执行密封操作，返回 ST-04 复检"],
    ["包装标签", "标签打印错误/缺失", "严重", "标记下一站为维修站，产品转入维修站补打标签", "维修站核对正确标签内容，重新打印粘贴标签，返回 ST-04 复检"],
    ["包装外观", "包装破损/变形", "一般", "标记下一站为维修站，产品转入维修站更换包装", "维修站更换破损包装材料，重新包装，返回 ST-04 复检"],
    ["防潮/防震材料", "防护材料缺失", "一般", "标记下一站为维修站，产品转入维修站补加防护", "维修站拆开包装补加防潮/防震材料，重新包装，返回 ST-04 复检"],
  ],
  [1800, 1500, 800, 2200, 3060]
));

children.push(h3("4.2.6 ST-05 生产装箱入库工站故障检测"));
children.push(p("装箱入库工站在装箱完成后对装箱质量进行检测，在入库前对成品进行最终检测，主要检测装箱数量、箱内产品排列、封箱质量、入库信息匹配、成品状态、WMS 系统对接等。"));
children.push(makeTable(
  ["检测项目", "故障类型", "严重等级", "处理方式", "维修站操作说明"],
  [
    ["装箱数量校验", "数量不足/过多", "严重", "标记下一站为维修站，整箱转入维修站重新装箱", "维修站拆箱清点产品，按正确数量重新装箱，返回 ST-05 复检"],
    ["产品排列检查", "排列不规范", "轻微", "标记下一站为维修站，整箱转入维修站重新排列", "维修站拆箱按规范重新排列产品，重新封箱，返回 ST-05 复检"],
    ["封箱质量", "封箱不牢/破损", "一般", "标记下一站为维修站，整箱转入维修站重新封箱", "维修站检查封箱部位，重新执行封箱操作，返回 ST-05 复检"],
    ["箱号标签", "箱号标签错误/缺失", "严重", "标记下一站为维修站，整箱转入维修站补打标签", "维修站核对正确箱号信息，重新打印粘贴箱号标签，返回 ST-05 复检"],
    ["装箱清单", "装箱清单与实物不符", "严重", "标记下一站为维修站，整箱转入维修站核对修正", "维修站逐件核对装箱清单与实物，修正清单或补换产品，返回 ST-05 复检"],
    ["入库信息匹配", "入库单与实物不符", "严重", "标记下一站为维修站，产品暂存维修站核查", "维修站逐项核对入库单信息与实物（产品型号、数量、批次），修正后返回 ST-05 重新入库"],
    ["成品状态检测", "成品状态异常", "致命", "标记下一站为维修站，产品转入维修站全面复检", "维修站对成品进行全面复检，可修复则修复后返回 ST-05 入库；不可修复则报废"],
    ["WMS 系统对接", "WMS 同步失败", "严重", "标记下一站为维修站，产品暂存维修站等待系统恢复", "维修站排查 WMS 接口异常，系统恢复后返回 ST-05 重新执行入库同步"],
    ["批次追溯信息", "追溯信息缺失", "严重", "标记下一站为维修站，产品转入维修站补录信息", "维修站追溯产品生产全流程数据，补录缺失的追溯信息，返回 ST-05 重新入库"],
    ["库存容量校验", "库位已满", "一般", "标记下一站为维修站，产品暂存维修站等待库位释放", "维修站协调仓库释放库位或分配新库位，库位就绪后返回 ST-05 执行入库"],
  ],
  [1800, 1500, 800, 2200, 3060]
));

children.push(h3("4.2.7 维修站设计"));
children.push(p("维修站是各工站故障检测流程的配套站点，不属于 5 个标准生产工站序列，而是作为旁路站点独立设置。每个产线配备一个维修站，接收来自各工站的故障产品。"));
children.push(makeTable(
  ["属性", "说明"],
  [
    ["站点编码", "ST-00（维修站）"],
    ["站点名称", "维修站"],
    ["站点位置", "产线旁路，与 5 个标准工站平行设置，不在主生产流线上"],
    ["接收来源", "ST-01 ~ ST-05 任一工站检测到故障后，将产品标记下一站为维修站"],
    ["人员配置", "维修技术员（具备机械、电气、包装等多技能）"],
    ["核心职责", "接收故障产品、根据故障分类执行维修、记录维修结果、决定产品后续流转"],
    ["维修结果", "修复成功（返回原故障工站重新检测）/ 修复失败（标记报废，终止流转）/ 让步接收（标记降级品，继续流转至下一工站）"],
    ["数据记录", "维修记录单：维修单号、来源工站、故障类型、维修操作、维修耗时、维修结果、维修人员"],
  ],
  [2000, 7360]
));

children.push(h3("4.2.8 故障流转状态定义"));
children.push(p("产品在故障检测和维修流转过程中的状态定义如下："));
children.push(makeTable(
  ["产品状态", "状态标识", "含义", "流转目标"],
  [
    ["正常", "NORMAL", "产品通过当前工站检测，进入正常流转", "下一标准工站"],
    ["待维修", "PENDING_REPAIR", "产品在当前工站检测到故障，已分类并标记下一站为维修站", "维修站（ST-00）"],
    ["维修中", "IN_REPAIR", "产品已到达维修站，正在执行维修操作", "维修站（ST-00），维修完成后流转"],
    ["返工检测", "RETEST", "维修成功的产品返回原故障工站重新检测", "原故障工站"],
    ["已报废", "SCRAPPED", "维修失败或故障等级为致命且不可修复，产品标记报废", "报废区，终止流转"],
    ["让步接收", "CONCESSION", "故障等级轻微，经评审可降级使用，继续流转", "下一标准工站（标记降级品）"],
  ],
  [1500, 2000, 3500, 2360]
));

children.push(h3("4.2.9 故障检测与维修流转示例"));
children.push(p("以 ST-02 生产装配工站检测到紧固力矩不足为例，完整流转过程如下："));
children.push(makeTable(
  ["步骤", "所处站点", "操作", "产品状态", "系统响应"],
  [
    ["1", "ST-02 装配工站", "装配完成，执行紧固力矩检测", "正常", "检测力矩值低于标准值，判定不合格"],
    ["2", "ST-02 装配工站", "操作员对故障进行分类：故障类型=力矩不足，严重等级=严重", "待维修", "生成故障记录单，产品下一站标记为维修站 ST-00"],
    ["3", "ST-00 维修站", "维修技术员接收产品，按标准力矩重新紧固", "维修中", "记录维修操作和维修耗时，维修完成后标记为返工检测"],
    ["4", "ST-02 装配工站", "产品返回 ST-02 重新执行紧固力矩检测", "返工检测", "检测力矩值达标，判定合格"],
    ["5", "ST-03 外观检测工站", "产品正常流转至下一工站", "正常", "WIP 数量更新，继续后续工站流转"],
  ],
  [600, 1500, 2500, 1500, 3260]
));

children.push(h2("4.3 工站操作控制布局界面"));
children.push(p("本章节为产线上每个工站设计操作控制布局界面，描述界面布局结构和操作方法。所有工站的操作界面共享统一的布局框架：顶部为工站信息栏，中部左侧为操作区、右侧为信息显示区，底部为操作按钮栏。操作区底部设有\"确认操作完成\"按钮，用于确认本站操作已完成，产品流转至下一工站，操作界面重置为待扫描状态等待新产品输入；底部操作按钮栏设有\"退出\"按钮，用于退出工站操作界面。各工站的操作区包含本站生产操作步骤和故障检测操作区两个功能区域，操作方法说明分为\"操作区操作方法说明\"和\"故障检测操作区操作方法说明\"两部分分别描述。每个工站操作界面均需先通过登录界面验证操作员身份和站点操作权限后方可进入。"));

children.push(p("工站信息栏显示规则：登录进入工站操作界面后，顶部信息栏初始显示为待扫描状态（任务订单号、产品、产品序列号、数量/批次均显示为\"--\"或\"待扫描\"）。ST-01产线导入工站在扫描任务订单条码后，系统自动在该任务订单下生成一个独一无二的产品序列号，并在信息栏显示任务订单号、产品名称、产品序列号和产品数量；ST-02至ST-05各工站在扫描物料条码或产品序列码后，系统自动在信息栏显示任务订单号、产品名称、产品序列号和批次号。信息栏内容随扫描结果自动更新。"));

children.push(p("工站状态显示规则：操作员登录工站后，系统读取工站当前状态并在顶部信息栏显示。若工站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮和所有操作按钮、故障检测按钮置灰禁用，仅\"退出\"按钮可用；若工站未处于\"故障\"状态（包括\"待机\"和\"运行中\"），则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行各项操作。"));

children.push(h3("4.3.1 工站操作登录界面"));
children.push(p("所有工站操作界面共享统一的登录入口。操作员在登录界面选择目标工站站点、输入员工工号和登录密码，系统校验工号与密码的匹配性以及该员工对目标站点的操作权限，校验通过后进入对应工站的操作界面。登录成功后，操作员的工号、姓名和权限信息将显示在工站操作界面的信息显示区，并与该工站的所有操作记录关联。"));

var loginColW = [2340, 2340, 2340, 2340];
var loginTotalW = loginColW[0] + loginColW[1] + loginColW[2] + loginColW[3];
var loginRows = [];

loginRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("工站操作登录界面", {
    colSpan: 4, width: loginTotalW, fill: "1E5F8E", color: "FFFFFF",
    bold: true, size: 18, align: AlignmentType.CENTER,
  })],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("MES 制造执行系统 - 工站操作终端", {
    colSpan: 4, width: loginTotalW, fill: "D6E4F0", color: "1E5F8E",
    bold: true, size: 16, align: AlignmentType.CENTER,
  })],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("站点选择", { colSpan: 1, width: loginColW[0], fill: "F0F2F5", bold: true, size: 16, align: AlignmentType.RIGHT }),
    wfCell("[ 请选择站点 ▼]", { colSpan: 3, width: loginColW[1] + loginColW[2] + loginColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("员工工号", { colSpan: 1, width: loginColW[0], fill: "F0F2F5", bold: true, size: 16, align: AlignmentType.RIGHT }),
    wfCell("[_____________________]", { colSpan: 3, width: loginColW[1] + loginColW[2] + loginColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("登录密码", { colSpan: 1, width: loginColW[0], fill: "F0F2F5", bold: true, size: 16, align: AlignmentType.RIGHT }),
    wfCell("[*********]", { colSpan: 3, width: loginColW[1] + loginColW[2] + loginColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("", { colSpan: 1, width: loginColW[0], fill: "FFFFFF" }),
    wfCell("[  登 录  ]    [  重 置  ]", { colSpan: 3, width: loginColW[1] + loginColW[2] + loginColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("登录状态栏", {
    colSpan: 4, width: loginTotalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

loginRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("登录状态: 待登录    提示信息: 请选择站点并输入工号和密码", {
    colSpan: 4, width: loginTotalW, fill: "FFF8E6", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: loginColW,
  rows: loginRows,
}));

children.push(spacer());

children.push(p("登录界面操作方法说明："));
children.push(makeTable(
  ["操作步骤", "操作方法"],
  [
    ["选择站点", "点击站点选择下拉框，系统显示当前可用工站列表（ST-01~ST-05及ST-00维修站），操作员选择要登录的目标工站站点"],
    ["输入员工工号", "在员工工号输入框中输入个人工号（如OP-1023），系统实时校验工号格式"],
    ["输入登录密码", "在登录密码输入框中输入个人密码，密码以星号掩码显示，确保输入安全"],
    ["点击登录", "点击\"登录\"按钮，系统依次校验：工号是否存在且已启用→密码是否正确→该员工是否有目标站点的操作权限，三项校验全部通过后进入对应工站操作界面"],
    ["点击重置", "点击\"重置\"按钮，清空已输入的工号和密码，保留站点选择，方便重新输入"],
  ],
  [2200, 7160]
));

children.push(spacer());

children.push(p("登录校验流程定义："));
children.push(makeTable(
  ["校验步骤", "校验内容", "校验通过条件", "校验失败处理"],
  [
    ["1. 站点状态校验", "检查目标工站当前状态", "站点状态为\"待机\"、\"运行中\"或\"故障\"", "站点状态为\"维护中\"时，提示\"站点维护中，禁止登录\"，仅维护人员可通过特殊权限登录"],
    ["1a. 故障状态处理", "若站点状态为\"故障\"，允许登录但进入受限模式", "登录成功，进入工站操作界面的故障状态显示模式", "工站操作界面所有操作按钮置灰禁用，顶部信息栏显示红色\"故障\"状态标识，仅显示故障信息和工站状态，需维护人员修复后将状态切换为\"待机\"方可正常操作"],
    ["2. 工号有效性校验", "校验员工工号是否存在且已启用", "工号存在于系统中且状态为\"启用\"", "提示\"工号不存在或已禁用，请联系管理员\""],
    ["3. 密码匹配校验", "校验输入密码与工号对应的密码是否一致", "密码与系统记录一致", "提示\"密码错误\"，累计错误3次锁定该工号30分钟"],
    ["4. 站点操作权限校验", "校验该员工是否拥有目标站点的操作权限", "员工权限配置中包含目标站点的操作权限", "提示\"无该站点操作权限，请联系管理员分配权限\""],
  ],
  [1800, 2200, 2500, 2860]
));

children.push(spacer());

children.push(p("操作员站点权限配置示例："));
children.push(makeTable(
  ["员工工号", "员工姓名", "岗位", "可操作站点", "权限说明"],
  [
    ["OP-1023", "张明", "产线导入操作员", "ST-01", "可登录ST-01产线导入工站，执行物料导入和批次初始化操作"],
    ["OP-1024", "李强", "装配操作员", "ST-02", "可登录ST-02生产装配工站，执行产品装配和装配检测操作"],
    ["OP-1025", "王芳", "外观检测员", "ST-03", "可登录ST-03外观检测工站，执行外观质量检测操作"],
    ["OP-1026", "赵伟", "包装操作员", "ST-04", "可登录ST-04生产包装工站，执行包装和包装检测操作"],
    ["OP-1027", "陈刚", "装箱入库员", "ST-05", "可登录ST-05装箱入库工站，执行装箱和入库操作"],
    ["OP-1099", "刘洋", "维修技术员", "ST-00", "可登录ST-00维修站，执行故障产品维修操作"],
    ["OP-1028", "孙磊", "多技能操作员", "ST-04, ST-05", "可登录ST-04和ST-05，执行包装、装箱和入库操作"],
  ],
  [1200, 1000, 1200, 1200, 4760]
));

children.push(spacer());

children.push(new Paragraph({ children: [new PageBreak()] }));

children.push(h3("4.3.2 ST-01 产线导入工站操作界面"));
children.push(p("产线导入工站的操作界面用于接收排程任务、检查物料齐套、导入BOM并初始化生产批次，完成后将产品流转至ST-02生产装配工站。"));
children.push(p("ST-01产线导入工站状态显示规则：操作员登录后，系统读取工站当前状态并在顶部信息栏显示。若工站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮置灰禁用，仅\"退出\"按钮可用；若工站未处于\"故障\"状态，则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行扫描任务订单、物料齐套检查、BOM版本导入、批次初始化、确认操作完成和流转至下一站等操作。"));

// ST-01 Wireframe
pushArray(children, buildStationWireframe("ST-01 产线导入工站", [
  ["任务订单号: 待扫描", "产品: --", "产品序列号: 待扫描", "数量: --", "状态: 运行中"],
  ["[ 操作区 ]", "", "[ 信息显示区 ]", ""],
  ["1. 扫描任务订单号", "  [扫描输入框]", "产品序列号: --", ""],
  ["2. 物料齐套检查", "  [开始检查] [重置]", "任务订单号: --", ""],
  ["3. BOM版本导入", "  [选择BOM版本 ▼] [导入]", "物料状态: 齐套 (8/8)", ""],
  ["4. 初始化批次号", "  [生成批次号]", "BOM版本: V2.1", ""],
  ["5. 流转至下一站", "  [流转至ST-02]", "操作员工号: OP-1023", ""],
  ["", "", "操作员姓名: 张明", ""],
  ["", "", "操作权限: 产线导入", ""],
  ["", "", "下一站: ST-02 生产装配", ""],
  ["", "", "设备: EQ-L01-001", ""],
  ["[ 故障检测操作区 ]", "", "[ 检测结果 ]", ""],
  ["故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["故障类型描述", "  [请输入故障描述...]", "", ""],
], [
  ["扫描任务订单号", "光标聚焦扫描输入框，使用扫码枪扫描任务订单条码，系统自动校验订单有效性。校验通过后，系统自动在该任务订单下生成一个独一无二的产品序列号（编号规则：任务订单号+流水号，如TO20260804001-001），并在顶部信息栏显示任务订单号、产品名称、产品序列号和产品数量，同时将产品序列号和任务订单号信息加载至信息显示区"],
  ["物料齐套检查", "点击\"开始检查\"按钮，系统自动比对BOM清单与实物物料，显示齐套状态（齐套/缺料数量）"],
  ["BOM版本导入", "下拉选择当前产品对应的BOM版本，点击\"导入\"按钮，系统加载BOM至当前任务订单"],
  ["初始化批次号", "点击\"生成批次号\"按钮，系统按规则生成批次号并关联任务订单"],
  ["流转至下一站", "批次初始化完成后，点击\"流转至ST-02\"按钮，系统将产品状态更新为已流转，产品流转至ST-02生产装配工站，当前工站WIP数量减1，ST-02工站WIP数量加1"],
], [
  ["选择故障类型", "在故障检测操作区点击\"故障类型选择\"下拉框，系统展示ST-01产线导入工站预定义的故障类型列表（物料缺失、BOM版本不一致、条码无法识别、批次号生成失败），操作员根据实际故障情况选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["确认故障等级", "系统根据所选故障类型自动关联故障等级（物料缺失-严重、BOM版本不一致-一般、条码无法识别-轻微、批次号生成失败-严重），操作员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级，调整后系统记录修改行为"],
  ["输入故障描述", "在\"故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"第3号物料仓缺料，BOM要求8件实际齐套7件\"）、发生位置（如\"物料仓M-03\"）、可能原因（如\"供应商少发或入库数量错误\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["点击\"确认操作完成\"按钮提交", "故障类型、等级和描述信息填写完成后，点击操作区的\"确认操作完成\"按钮，系统生成故障记录单（包含故障编号、工站编号ST-01、产品序列号、故障类型、故障等级、故障描述、操作员工号、提交时间）并保存至质量管理系统，自动将下一工站（ST-02生产装配工站）标记为维修站，将故障产品信息推送至ST-00维修站（包含来源工站ST-01、产品序列号、故障类型、故障等级、故障描述）。当前工站WIP数量减1、维修站待维修数量加1，操作界面重置为待扫描状态等待新产品输入"],
]));

pushArray(children, buildStatusRules("ST-01产线导入工站", "扫描任务订单、物料齐套检查、BOM版本导入、批次初始化、确认操作完成和流转至下一站"));

pushArray(children, buildFaultTypeDetails("ST-01 产线导入工站", [
  ["物料缺失", "严重", "BOM清单中的物料未齐套，部分物料缺失或数量不足，无法满足生产需求", "系统生成故障记录单，标记下一站为维修站，产品暂停流转"],
  ["BOM版本不一致", "一般", "待导入的BOM版本与系统标准版本不匹配，可能导致装配错误或物料清单错误", "系统标记下一站为维修站，需核对并导入正确BOM版本后重新生产"],
  ["条码无法识别", "轻微", "物料条码格式错误、条码污损或扫码设备故障导致条码无法扫描识别", "系统标记下一站为维修站，需重新打印条码或更换扫码设备后重新验证"],
  ["批次号生成失败", "严重", "系统无法生成批次号或批次号无法关联任务订单，导致生产批次无法初始化", "系统标记下一站为维修站，需检查系统配置和任务订单状态后重新生成"],
]));

children.push(h3("4.3.3 ST-02 生产装配工站操作界面"));
children.push(p("生产装配工站的操作界面用于指导操作员按工艺步骤装配产品，记录装配过程和结果，装配合格后将产品流转至ST-03生产外观检测工站。"));
children.push(p("ST-02生产装配工站状态显示规则：操作员登录后，系统读取工站当前状态并在顶部信息栏显示。若工站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮置灰禁用，仅\"退出\"按钮可用；若工站未处于\"故障\"状态，则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行扫描物料条码、装配工序引导、装配结果确认、工时记录、确认操作完成和流转至下一站等操作。"));

pushArray(children, buildStationWireframe("ST-02 生产装配工站", [
  ["任务订单号: 待扫描", "产品: --", "产品序列号: 待扫描", "批次: --", "状态: 运行中"],
  ["[ 操作区 ]", "", "[ 信息显示区 ]", ""],
  ["1. 扫描物料条码", "  [扫描输入框]", "产品序列号: --", ""],
  ["2. 装配工序引导", "  [上一步] [下一步]", "当前工序: 步骤3/5", ""],
  ["3. 装配结果确认", "  [合格] [不合格]", "WIP: 18 | 已完成: 175", ""],
  ["4. 工时记录", "  [开始计时] [停止计时]", "标准工时: 4.5min", ""],
  ["5. 流转至下一站", "  [流转至ST-03]", "实际工时: 4.2min", ""],
  ["", "", "操作员工号: OP-1024", ""],
  ["", "", "操作员姓名: 李强", ""],
  ["", "", "操作权限: 生产装配", ""],
  ["", "", "下一站: ST-03 外观检测", ""],
  ["[ 故障检测操作区 ]", "", "[ 检测结果 ]", ""],
  ["故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["故障类型描述", "  [请输入故障描述...]", "", ""],
], [
  ["扫描物料条码", "使用扫码枪扫描待装配物料的条码，系统校验物料是否属于当前BOM清单。校验通过后，系统自动在顶部信息栏显示任务订单号、产品名称、产品序列号和批次号，并将产品序列号和当前工序、WIP信息加载至信息显示区，进入装配工序引导"],
  ["装配工序引导", "系统按工艺路线逐步显示装配步骤说明和示意图，操作员按步骤执行装配，点击\"下一步\"进入下一工序步骤"],
  ["装配结果确认", "装配完成后，操作员根据实际装配情况点击\"合格\"或\"不合格\"按钮；点击\"不合格\"时弹出故障分类对话框，操作员选择故障类型和严重等级，系统标记下一站为维修站"],
  ["工时记录", "点击\"开始计时\"记录装配开始时间，装配完成后点击\"停止计时\"，系统自动计算实际装配工时并保存"],
  ["流转至下一站", "装配合格且工时记录完成后，点击\"流转至ST-03\"按钮，系统将产品状态更新为已流转，产品流转至ST-03生产外观检测工站，当前工站WIP数量减1，ST-03工站WIP数量加1"],
], [
  ["选择故障类型", "在故障检测操作区点击\"故障类型选择\"下拉框，系统展示ST-02生产装配工站预定义的故障类型列表（尺寸超差、漏装/错装、力矩不足/过大、划伤/变形、功能异常），操作员根据装配过程中发现的实际故障情况选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["确认故障等级", "系统根据所选故障类型自动关联故障等级（尺寸超差-严重、漏装/错装-致命、力矩不足/过大-严重、划伤/变形-一般、功能异常-致命），操作员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级，调整后系统记录修改行为"],
  ["输入故障描述", "在\"故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"第4装配步骤紧固螺栓力矩值为8.5N·m，标准范围为10-12N·m，力矩不足\"）、发生位置（如\"装配工位J-04，紧固点B2\"）、可能原因（如\"力矩扳手未校准或操作不到位\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["点击\"确认操作完成\"按钮提交", "故障类型、等级和描述信息填写完成后，点击操作区的\"确认操作完成\"按钮，系统生成故障记录单（包含故障编号、工站编号ST-02、产品序列号、故障类型、故障等级、故障描述、操作员工号、提交时间、装配工序步骤）并保存至质量管理系统，自动将下一工站（ST-03生产外观检测工站）标记为维修站，将故障产品信息推送至ST-00维修站（包含来源工站ST-02、产品序列号、故障类型、故障等级、故障描述、装配工序步骤）。当前工站WIP数量减1、维修站待维修数量加1，操作界面重置为待扫描状态等待新产品输入"],
]));

pushArray(children, buildStatusRules("ST-02生产装配工站", "扫描物料条码、装配工序引导、装配结果确认、工时记录、确认操作完成和流转至下一站"));

pushArray(children, buildFaultTypeDetails("ST-02 生产装配工站", [
  ["尺寸超差", "严重", "装配尺寸超出标准公差范围，测量工具采集的装配尺寸数据不在工艺文件规定的上下限之内，可能导致后续装配困难或功能异常", "系统标记下一站为维修站，需重新调整装配尺寸至公差范围内"],
  ["漏装/错装", "致命", "BOM清单中的零部件漏装或装配了错误型号的零部件，系统根据BOM核对发现已装零部件不齐全或型号不匹配", "系统标记下一站为维修站，需补装缺失零部件或更换正确型号后重新装配"],
  ["力矩不足/过大", "严重", "紧固点力矩值不在标准范围内，力矩检测仪采集的力矩值低于或高于工艺规定范围，可能导致紧固松动或螺纹损伤", "系统标记下一站为维修站，需重新调整紧固力矩至标准范围内"],
  ["划伤/变形", "一般", "装配部位出现划伤或变形，操作员目视检查发现装配表面存在物理损伤，可能影响产品外观和功能", "系统标记下一站为维修站，需修复划伤或更换变形部件后重新装配"],
  ["功能异常", "致命", "通电功能预测试未通过，系统对产品进行通电测试时检测到功能异常，可能存在电气连接不良或元器件损坏", "系统标记下一站为维修站，需排查电气连接和元器件状态后修复"],
]));

children.push(h3("4.3.4 ST-03 生产外观检测工站操作界面"));
children.push(p("外观检测工站的操作界面用于对产品进行全面外观质量检测，支持自动检测和人工判定结合，检测合格后将产品流转至ST-04生产包装工站。"));
children.push(p("ST-03生产外观检测工站状态显示规则：操作员登录后，系统读取工站当前状态并在顶部信息栏显示。若工站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮置灰禁用，仅\"退出\"按钮可用；若工站未处于\"故障\"状态，则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行扫描产品序列号、表面缺陷检测、色差检测、结构完整性检查、标识标签检测、检测结论判定、确认操作完成和流转至下一站等操作。"));

pushArray(children, buildStationWireframe("ST-03 生产外观检测工站", [
  ["任务订单号: 待扫描", "产品: --", "产品序列号: 待扫描", "批次: --", "状态: 运行中"],
  ["[ 操作区 ]", "", "[ 信息显示区 ]", ""],
  ["1. 扫描产品序列号", "  [扫描输入框]", "产品序列号: --", ""],
  ["2. 表面缺陷检测", "  [启动AOI] [人工判定]", "检测项目: 2/6", ""],
  ["3. 色差检测", "  [启动检测] [合格] [不合格]", "AOI结果: 合格", ""],
  ["4. 结构完整性", "  [合格] [不合格]", "色差值: 0.3 (达标)", ""],
  ["5. 标识标签检测", "  [扫描标签] [合格] [不合格]", "检测结果: 待判定", ""],
  ["6. 检测结论", "  [全部合格] [不合格-分类]", "标签核对: 待核对", ""],
  ["7. 流转至下一站", "  [流转至ST-04]", "综合判定: 待判定", ""],
  ["", "", "操作员工号: OP-1025", ""],
  ["", "", "操作员姓名: 王芳", ""],
  ["", "", "操作权限: 外观检测", ""],
  ["", "", "下一站: ST-04 生产包装", ""],
  ["[ 故障检测操作区 ]", "", "[ 检测结果 ]", ""],
  ["故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["故障类型描述", "  [请输入故障描述...]", "", ""],
], [
  ["扫描产品序列号", "扫描待检测产品的序列号，系统加载该产品的检测项目清单和标准参数。扫描成功后，系统自动在顶部信息栏显示任务订单号、产品名称、产品序列号和批次号，并将产品序列号和检测项目进度、标准参数加载至信息显示区"],
  ["表面缺陷检测", "点击\"启动AOI\"由自动光学检测设备执行表面缺陷扫描，结果显示在信息区；若AOI不可用则点击\"人工判定\"由操作员目视检查"],
  ["色差检测", "点击\"启动检测\"由色差仪自动检测色差值，系统对比标准阈值自动判定合格/不合格；操作员也可手动点击判定按钮"],
  ["结构完整性", "操作员目视检查产品结构完整性，点击\"合格\"或\"不合格\"；点击\"不合格\"时弹出故障分类对话框"],
  ["标识标签检测", "扫描产品上的标签条码，系统与标准标识内容比对，自动判定是否一致；不一致则标记不合格"],
  ["检测结论", "所有检测项目完成后，若全部合格则点击\"全部合格\"生成检测合格记录；若有不合格项则点击\"不合格-分类\"，弹出故障分类对话框，操作员选择故障类型后系统标记下一站为维修站"],
  ["流转至下一站", "检测结论为全部合格后，点击\"流转至ST-04\"按钮，系统将产品状态更新为已流转，产品流转至ST-04生产包装工站，当前工站WIP数量减1，ST-04工站WIP数量加1"],
], [
  ["选择故障类型", "在故障检测操作区点击\"故障类型选择\"下拉框，系统展示ST-03生产外观检测工站预定义的故障类型列表（外观缺陷-划痕、外观缺陷-污渍、外观缺陷-色差、外观缺陷-破损、标识缺失/错误、尺寸超差），操作员根据检测结果选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["确认故障等级", "系统根据所选故障类型自动关联故障等级（外观缺陷-划痕-一般、外观缺陷-污渍-轻微、外观缺陷-色差-一般、外观缺陷-破损-致命、标识缺失/错误-严重、尺寸超差-严重），操作员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级，调整后系统记录修改行为"],
  ["输入故障描述", "在\"故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"AOI扫描发现产品右侧表面存在长度约5mm的划痕，深度超出标准允许的0.1mm\"）、发生位置（如\"产品右侧面，距边缘约20mm处\"）、检测数据（如\"AOI检测结果：划痕长度5.2mm，深度0.15mm，标准限值：长度≤3mm，深度≤0.1mm\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["点击\"确认操作完成\"按钮提交", "故障类型、等级和描述信息填写完成后，点击操作区的\"确认操作完成\"按钮，系统生成故障记录单（包含故障编号、工站编号ST-03、产品序列号、故障类型、故障等级、故障描述、操作员工号、提交时间、AOI检测数据）并保存至质量管理系统，自动将下一工站（ST-04生产包装工站）标记为维修站，将故障产品信息推送至ST-00维修站（包含来源工站ST-03、产品序列号、故障类型、故障等级、故障描述、AOI检测数据）。当前工站WIP数量减1、维修站待维修数量加1，操作界面重置为待扫描状态等待新产品输入"],
]));

pushArray(children, buildStatusRules("ST-03生产外观检测工站", "扫描产品序列号、表面缺陷检测、色差检测、结构完整性检查、标识标签检测、检测结论判定、确认操作完成和流转至下一站"));

pushArray(children, buildFaultTypeDetails("ST-03 生产外观检测工站", [
  ["外观缺陷-划痕", "一般", "AOI设备扫描发现产品表面存在划痕，划痕长度或深度超出标准允许范围，影响产品外观质量", "系统标记下一站为维修站，需对划痕部位进行打磨抛光或更换部件"],
  ["外观缺陷-污渍", "轻微", "AOI设备扫描发现产品表面存在污渍，表面附着异物或油污，影响产品外观整洁度", "系统标记下一站为维修站，需清洁表面污渍后重新检测"],
  ["外观缺陷-色差", "一般", "色差仪采集的色差值超出标准阈值，产品表面颜色与标准色板存在明显色差，可能影响产品一致性", "系统标记下一站为维修站，需排查喷涂工艺或更换材料后重新检测"],
  ["外观缺陷-破损", "致命", "产品结构存在破损或裂纹，操作员检查发现外壳或结构件有物理破损，严重影响产品结构强度和安全性", "系统标记下一站为维修站，需更换破损部件后重新检测"],
  ["标识缺失/错误", "严重", "产品标识标签缺失或内容与标准标识不一致，系统扫描核对发现标签信息错误或标签脱落", "系统标记下一站为维修站，需重新打印并粘贴正确标识标签后重新检测"],
  ["尺寸超差", "严重", "外观尺寸超出标准公差范围，测量工具采集的外观尺寸数据不在工艺文件规定的上下限之内", "系统标记下一站为维修站，需排查尺寸偏差原因并调整后重新检测"],
]));

children.push(h3("4.3.5 ST-04 生产包装工站操作界面"));
children.push(p("包装工站的操作界面用于对检测合格的产品执行包装操作，选择包装规格并打印包装标签，包装合格后将产品流转至ST-05生产装箱入库工站。"));
children.push(p("ST-04生产包装工站状态显示规则：操作员登录后，系统读取工站当前状态并在顶部信息栏显示。若工站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮置灰禁用，仅\"退出\"按钮可用；若工站未处于\"故障\"状态，则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行扫描产品序列号、选择包装规格、包装操作、密封性检查、打印包装标签、确认操作完成和流转至下一站等操作。"));

pushArray(children, buildStationWireframe("ST-04 生产包装工站", [
  ["任务订单号: 待扫描", "产品: --", "产品序列号: 待扫描", "批次: --", "状态: 运行中"],
  ["[ 操作区 ]", "", "[ 信息显示区 ]", ""],
  ["1. 扫描产品序列号", "  [扫描输入框]", "产品序列号: --", ""],
  ["2. 选择包装规格", "  [标准盒 ▼] [确认]", "WIP: 8 | 已完成: 165", ""],
  ["3. 包装操作", "  [开始包装] [完成确认]", "包装规格: 标准盒A", ""],
  ["4. 密封性检查", "  [合格] [不合格]", "包装进度: 进行中", ""],
  ["5. 打印包装标签", "  [预览] [打印]", "密封检测结果: 待检测", ""],
  ["6. 流转至下一站", "  [流转至ST-05]", "标签状态: 待打印", ""],
  ["", "", "操作员工号: OP-1026", ""],
  ["", "", "操作员姓名: 赵伟", ""],
  ["", "", "操作权限: 生产包装", ""],
  ["", "", "下一站: ST-05 装箱入库", ""],
  ["[ 故障检测操作区 ]", "", "[ 检测结果 ]", ""],
  ["故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["故障类型描述", "  [请输入故障描述...]", "", ""],
], [
  ["扫描产品序列号", "扫描待包装产品的序列号，系统加载该产品信息并自动匹配包装规格。扫描成功后，系统自动在顶部信息栏显示任务订单号、产品名称、产品序列号和批次号，并将产品序列号和WIP数量、包装进度加载至信息显示区"],
  ["选择包装规格", "下拉选择包装规格（标准盒A/标准盒B/定制包装），点击\"确认\"锁定包装规格"],
  ["包装操作", "点击\"开始包装\"进入包装作业模式，操作员完成包装后点击\"完成确认\""],
  ["密封性检查", "包装完成后，操作员检查密封质量，点击\"合格\"或\"不合格\"；不合格时弹出故障分类对话框，标记下一站为维修站"],
  ["打印包装标签", "点击\"预览\"查看标签内容（产品名称/序列号/包装日期/批次号），确认无误后点击\"打印\"输出标签"],
  ["流转至下一站", "包装标签打印完成后，点击\"流转至ST-05\"按钮，系统将产品状态更新为已流转，产品流转至ST-05生产装箱入库工站，当前工站WIP数量减1，ST-05工站WIP数量加1"],
], [
  ["选择故障类型", "在故障检测操作区点击\"故障类型选择\"下拉框，系统展示ST-04生产包装工站预定义的故障类型列表（包装规格错误、密封不良、标签打印错误/缺失、包装破损/变形、防护材料缺失），操作员根据包装过程中发现的实际故障情况选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["确认故障等级", "系统根据所选故障类型自动关联故障等级（包装规格错误-严重、密封不良-一般、标签打印错误/缺失-严重、包装破损/变形-一般、防护材料缺失-一般），操作员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级，调整后系统记录修改行为"],
  ["输入故障描述", "在\"故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"包装封口处存在长约15mm的未封合区域，密封检测仪判定为漏封\"）、发生位置（如\"包装盒封口处，左侧中部\"）、可能原因（如\"封口机温度设置偏低或封口压力不足\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["点击\"确认操作完成\"按钮提交", "故障类型、等级和描述信息填写完成后，点击操作区的\"确认操作完成\"按钮，系统生成故障记录单（包含故障编号、工站编号ST-04、产品序列号、故障类型、故障等级、故障描述、操作员工号、提交时间、包装规格信息）并保存至质量管理系统，自动将下一工站（ST-05生产装箱入库工站）标记为维修站，将故障产品信息推送至ST-00维修站（包含来源工站ST-04、产品序列号、故障类型、故障等级、故障描述、包装规格信息）。当前工站WIP数量减1、维修站待维修数量加1，操作界面重置为待扫描状态等待新产品输入"],
]));

pushArray(children, buildStatusRules("ST-04生产包装工站", "扫描产品序列号、选择包装规格、包装操作、密封性检查、打印包装标签、确认操作完成和流转至下一站"));

pushArray(children, buildFaultTypeDetails("ST-04 生产包装工站", [
  ["包装规格错误", "严重", "实际使用的包装规格与BOM要求规格不一致，系统比对发现包装盒型号、尺寸或材质与工艺文件规定不匹配", "系统标记下一站为维修站，需更换正确规格包装材料后重新包装"],
  ["密封不良", "一般", "包装密封部位存在漏封或密封不良，密封检测发现封口处有缝隙、气泡或未完全封合", "系统标记下一站为维修站，需重新执行封合作业确保密封质量"],
  ["标签打印错误/缺失", "严重", "包装标签内容错误或标签缺失，系统扫描核对发现标签信息与产品信息不符或标签未粘贴", "系统标记下一站为维修站，需重新打印正确标签并粘贴后重新检测"],
  ["包装破损/变形", "一般", "包装外观存在破损或变形，操作员目视检查发现包装盒有压痕、撕裂或变形", "系统标记下一站为维修站，需更换完好包装盒后重新包装"],
  ["防护材料缺失", "一般", "包装内防潮/防震材料缺失，系统引导检查发现防潮袋、防震泡沫等防护材料不齐全", "系统标记下一站为维修站，需补充缺失的防护材料后重新包装"],
]));

children.push(h3("4.3.6 ST-05 生产装箱入库工站操作界面"));
children.push(p("装箱入库工站的操作界面用于将包装好的产品按规定数量装箱，校验装箱数量并打印箱号标签，随后完成成品入库操作，同步WMS系统并生成入库单，入库完成后产品流转至成品仓库。界面分为装箱操作区和入库操作区两个区域，操作员先完成装箱流程，再在同一界面继续执行入库流程。"));
children.push(p("ST-05生产装箱入库工站状态显示规则：操作员登录后，系统读取工站当前状态并在顶部信息栏显示。若工站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮置灰禁用，仅\"退出\"按钮可用；若工站未处于\"故障\"状态，则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行新建装箱箱号、扫描产品入箱、装箱数量校验、封箱操作、打印箱号标签、扫描箱号入库、同步WMS系统、生成入库单、确认操作完成和流转至成品仓等操作。"));

pushArray(children, buildStationWireframe("ST-05 生产装箱入库工站", [
  ["任务订单号: 待扫描", "产品: --", "产品序列号: 待扫描", "批次: --", "状态: 运行中"],
  ["[ 装箱操作区 ]", "", "[ 信息显示区 ]", ""],
  ["1. 新建装箱箱号", "  [生成箱号]", "产品序列号: --", ""],
  ["2. 扫描产品入箱", "  [扫描输入框]", "当前箱号: BX-001", ""],
  ["3. 装箱数量校验", "  [校验]", "已入箱: 0 / 20", ""],
  ["4. 封箱操作", "  [封箱确认]", "校验结果: 待校验", ""],
  ["5. 打印箱号标签", "  [预览] [打印]", "封箱状态: 未封箱", ""],
  ["", "", "标签状态: 待打印", ""],
  ["", "", "操作员工号: OP-1027", ""],
  ["", "", "操作员姓名: 陈刚", ""],
  ["", "", "操作权限: 装箱入库", ""],
  ["[ 装箱故障检测区 ]", "", "[ 检测结果 ]", ""],
  ["装箱故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["装箱故障类型描述", "  [请输入故障描述...]", "", ""],
  ["[ 入库操作区 ]", "", "[ 信息显示区 ]", ""],
  ["6. 扫描箱号", "  [扫描输入框]", "入库箱号: BX-001", ""],
  ["7. 确认入库数量", "  [确认]", "入库数量: 20 件", ""],
  ["8. 入库信息核对", "  [核对]", "入库单信息: 待核对", ""],
  ["9. 同步WMS系统", "  [执行同步]", "WMS状态: 待同步", ""],
  ["10. 生成入库单", "  [生成入库单]", "入库单号: 待生成", ""],
  ["11. 流转至成品仓", "  [入库完成-流转]", "下一站: 成品仓库", ""],
  ["[ 入库故障检测区 ]", "", "[ 检测结果 ]", ""],
  ["入库故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["入库故障类型描述", "  [请输入故障描述...]", "", ""],
], [
  ["新建装箱箱号", "点击\"生成箱号\"按钮，系统自动生成箱号（格式：BX + 日期 + 序号），初始化一个新装箱任务"],
  ["扫描产品入箱", "逐个扫描待装箱产品的序列号，系统自动累计入箱数量。首次扫描成功后，系统自动在顶部信息栏显示任务订单号、产品名称、产品序列号和批次号，并将产品序列号和当前箱号、入箱进度加载至信息显示区，达到规定数量（如20件/箱）时提示装箱已满"],
  ["装箱数量校验", "点击\"校验\"按钮，系统核对入箱产品数量与规定数量是否一致，显示校验结果（一致/数量不足/数量过多）"],
  ["封箱操作", "数量校验通过后，操作员执行物理封箱操作，完成后点击\"封箱确认\"记录封箱状态"],
  ["打印箱号标签", "点击\"预览\"查看箱号标签内容（箱号/产品名称/数量/批次/封箱日期），确认后点击\"打印\"输出标签"],
  ["扫描箱号", "扫描已封箱的成品箱号条码，系统加载箱内产品信息（产品名称/数量/批次号/序列号列表）"],
  ["确认入库数量", "系统自动显示箱内产品数量，操作员核对实物后点击\"确认\"确认入库数量"],
  ["入库信息核对", "点击\"核对\"按钮，系统比对入库单信息（产品型号/数量/批次）与实物信息，显示核对结果（一致/不符项）"],
  ["同步WMS系统", "信息核对一致后，点击\"执行同步\"按钮，系统调用WMS接口推送入库数据，显示同步状态（成功/失败）"],
  ["生成入库单", "WMS同步成功后，点击\"生成入库单\"按钮，系统生成入库单号并保存入库记录"],
  ["流转至成品仓", "入库单生成后，点击\"入库完成-流转\"按钮，系统将产品状态更新为已入库，产品流转至成品仓库，当前工站WIP数量减1，已完成数量加1，生产流程结束"],
], [
  ["装箱故障-选择故障类型", "在装箱故障检测区点击\"装箱故障类型选择\"下拉框，系统展示ST-05装箱环节预定义的故障类型列表（数量不足/过多、排列不规范、封箱不牢/破损、箱号标签错误/缺失、装箱清单与实物不符），操作员根据装箱过程中发现的实际故障情况选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["装箱故障-确认故障等级", "系统根据所选故障类型自动关联故障等级（数量不足/过多-严重、排列不规范-轻微、封箱不牢/破损-一般、箱号标签错误/缺失-严重、装箱清单与实物不符-严重），操作员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级"],
  ["装箱故障-输入故障描述", "在\"装箱故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"入箱产品数量为18件，规定数量为20件/箱，数量不足\"）、发生位置（如\"箱号BX-001\"）、可能原因（如\"扫描漏扫或产品流转异常\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["入库故障-选择故障类型", "在入库故障检测区点击\"入库故障类型选择\"下拉框，系统展示ST-05入库环节预定义的故障类型列表（成品状态异常、入库单与实物不符、WMS同步失败、追溯信息缺失、库位已满），操作员根据入库过程中发现的实际故障情况选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["入库故障-确认故障等级", "系统根据所选故障类型自动关联故障等级（成品状态异常-致命、入库单与实物不符-严重、WMS同步失败-严重、追溯信息缺失-严重、库位已满-一般），操作员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级"],
  ["入库故障-输入故障描述", "在\"入库故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"WMS系统接口调用超时，入库数据推送失败，HTTP状态码500\"）、发生位置（如\"WMS同步环节\"）、可能原因（如\"WMS服务器异常或网络连接中断\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["点击\"确认操作完成\"按钮提交", "装箱或入库故障类型、等级和描述信息填写完成后，点击操作区的\"确认操作完成\"按钮，系统生成故障记录单（包含故障编号、工站编号ST-05、产品序列号/箱号、故障类型、故障等级、故障描述、操作员工号、提交时间、故障环节标识：装箱/入库）并保存至质量管理系统，自动将下一环节标记为维修站（装箱故障标记入库环节为维修站，入库故障标记成品仓为维修待处理），将故障产品信息推送至ST-00维修站（包含来源工站ST-05、产品序列号/箱号、故障类型、故障等级、故障描述、故障环节标识）。当前工站WIP数量减1、维修站待维修数量加1，操作界面重置为待扫描状态等待新产品输入"],
]));

pushArray(children, buildStatusRules("ST-05生产装箱入库工站", "新建装箱箱号、扫描产品入箱、装箱数量校验、封箱操作、打印箱号标签、扫描箱号入库、同步WMS系统、生成入库单、确认操作完成和流转至成品仓"));

pushArray(children, buildFaultTypeDetails("ST-05 生产装箱入库工站-装箱", [
  ["数量不足/过多", "严重", "装箱产品数量与规定数量不一致，系统核对发现入箱产品数量少于或多于每箱规定数量（如20件/箱）", "系统标记下一站为维修站，需调整入箱数量至规定数量后重新校验"],
  ["排列不规范", "轻微", "箱内产品排列不符合规范，系统引导检查发现产品摆放方向错误或排列不整齐", "系统标记下一站为维修站，需重新排列产品至符合规范后重新检测"],
  ["封箱不牢/破损", "一般", "封箱部位不牢固或存在破损，操作员检查发现封箱胶带松动、封口开裂或箱体破损", "系统标记下一站为维修站，需重新封箱或更换箱体后重新检测"],
  ["箱号标签错误/缺失", "严重", "箱号标签内容错误或标签缺失，系统扫描核对发现标签信息与系统记录不符或标签未粘贴", "系统标记下一站为维修站，需重新打印正确标签并粘贴后重新检测"],
  ["装箱清单与实物不符", "严重", "装箱清单与箱内实物不一致，系统核对发现清单记录的产品序列号与箱内实际产品不匹配", "系统标记下一站为维修站，需核对并更正装箱清单后重新检测"],
]));

pushArray(children, buildFaultTypeDetails("ST-05 生产装箱入库工站-入库", [
  ["成品状态异常", "致命", "成品状态不符合入库要求，操作员全面检查发现成品存在损坏、变质或功能丧失等严重问题", "系统标记下一站为维修站，需对成品进行维修或报废处理"],
  ["入库单与实物不符", "严重", "入库单信息与实物信息不一致，系统比对发现产品型号、数量或批次与实物不匹配", "系统标记下一站为维修站，需更正入库单信息或更换实物后重新核对"],
  ["WMS同步失败", "严重", "WMS系统接口对接失败或数据同步异常，系统测试发现WMS接口无法连通或数据推送失败", "系统标记下一站为维修站，需排查WMS接口和网络连接后重新同步"],
  ["追溯信息缺失", "严重", "产品批次追溯信息不完整，系统检查发现生产记录、检测记录或流转记录存在缺失", "系统标记下一站为维修站，需补充完善追溯信息后重新检测"],
  ["库位已满", "一般", "目标库位已满无法入库，系统查询WMS发现目标库位容量已达到上限", "系统标记下一站为维修站，需分配新库位后重新执行入库"],
]));

children.push(h3("4.3.7 ST-00 维修站操作界面"));
children.push(p("维修站的操作界面用于接收各工站流转的故障产品，执行维修操作并记录维修结果，维修完成后根据维修结果将产品流转回原工站或转报废处理。"));
children.push(p("ST-00维修站状态显示规则：操作员登录后，系统读取维修站当前状态并在顶部信息栏显示。若维修站处于\"故障\"状态，则信息栏状态显示为\"故障\"（红色标识），操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮置灰禁用，仅\"退出\"按钮可用；若维修站未处于\"故障\"状态，则信息栏状态显示为\"运行中\"（正常标识），操作员可正常执行扫描待维修产品、查看故障信息、执行维修操作、记录维修结果、确认操作完成和返工流转等操作。"));

pushArray(children, buildStationWireframe("ST-00 维修站", [
  ["维修站 | 产线: L01", "产品序列号: 待扫描", "待维修: 3", "维修中: 1", "状态: 运行中"],
  ["[ 操作区 ]", "", "[ 信息显示区 ]", ""],
  ["1. 扫描待维修产品", "  [扫描输入框]", "产品序列号: --", ""],
  ["2. 查看故障信息", "  [查看故障详情]", "来源工站: ST-02", ""],
  ["3. 执行维修操作", "  [开始维修] [完成维修]", "故障类型: 力矩不足", ""],
  ["4. 记录维修结果", "  [修复成功] [修复失败] [让步接收]", "严重等级: 严重", ""],
  ["5. 返工流转", "  [返回原工站] [转报废]", "维修耗时: 待记录", ""],
  ["", "", "维修员工号: OP-1099", ""],
  ["", "", "维修员姓名: 刘洋", ""],
  ["", "", "操作权限: 维修操作", ""],
  ["", "", "下一站: 原故障工站/报废", ""],
  ["[ 故障检测操作区 ]", "", "[ 检测结果 ]", ""],
  ["故障类型选择", "  [请选择故障类型 ▼]", "故障等级: --", ""],
  ["故障类型描述", "  [请输入故障描述...]", "", ""],
], [
  ["扫描待维修产品", "扫描待维修产品的序列号，系统加载该产品的故障记录单（来源工站/故障类型/严重等级/故障描述），并在顶部信息栏显示产品序列号"],
  ["查看故障信息", "点击\"查看故障详情\"展开完整的故障分类信息，维修人员据此判断维修方案"],
  ["执行维修操作", "点击\"开始维修\"记录维修开始时间，维修人员执行维修作业；完成后点击\"完成维修\""],
  ["记录维修结果", "根据维修实际情况选择：\"修复成功\"（产品将返回原故障工站重新检测）、\"修复失败\"（产品标记报废）、\"让步接收\"（产品标记降级品继续流转）"],
  ["返工流转", "维修结果为\"修复成功\"时，点击\"返回原工站\"按钮，系统将产品状态更新为已流转，产品流转回原故障工站重新检测，维修站待维修数量减1，原故障工站WIP数量加1；维修结果为\"修复失败\"时，点击\"转报废\"按钮，系统将产品状态更新为已报废，终止流转，维修站待维修数量减1；维修结果为\"让步接收\"时，产品标记为降级品，点击\"返回原工站\"流转回原工站继续生产"],
], [
  ["选择故障类型", "在故障检测操作区点击\"故障类型选择\"下拉框，系统展示ST-00维修站预定义的故障类型列表（故障信息不完整、故障未复现、维修验证未通过），维修人员根据维修过程中发现的异常情况选择匹配的类型。选择后系统自动在右侧检测结果区显示对应的故障等级和故障说明"],
  ["确认故障等级", "系统根据所选故障类型自动关联故障等级（故障信息不完整-一般、故障未复现-一般、维修验证未通过-严重），维修人员可在\"故障等级\"显示区查看确认。如认为自动判定等级不准确，可手动调整等级，调整后系统记录修改行为"],
  ["输入故障描述", "在\"故障类型描述\"输入框中手动输入故障的详细描述信息，包括：故障现象（如\"来源工站ST-02提交的故障记录单缺少故障描述字段，仅记录了故障类型为力矩不足，无法定位具体紧固点位置\"）、诊断过程（如\"维修人员对产品进行全面复检，力矩检测 all pass，无法复现来源工站报告的故障\"）、处理建议（如\"建议来源工站补充故障描述后重新流转或标记为待观察\"）。描述内容支持中英文和特殊字符，最多500字"],
  ["点击\"确认操作完成\"按钮提交", "故障类型、等级和描述信息填写完成后，点击操作区的\"确认操作完成\"按钮，系统生成维修异常记录单（包含记录编号、维修站编号ST-00、产品序列号、来源工站、原故障类型、维修异常类型、故障等级、故障描述、维修员工号、提交时间）并保存至质量管理系统，同时根据故障类型触发对应的异常处理流程"],
  ["异常处理-待观察", "当故障类型为\"故障未复现\"时，点击\"确认操作完成\"按钮后系统将产品标记为\"待观察\"状态，暂存于待观察区，持续监控产品状态。系统在待观察列表中新增记录，并设置观察周期（如7天），观察期内若故障复现则重新进入维修流程"],
  ["异常处理-重新维修", "当故障类型为\"维修验证未通过\"时，点击\"确认操作完成\"按钮后系统提示维修人员需重新执行维修操作或转为报废处理。维修人员可选择\"重新维修\"重新进入维修流程，或选择\"转报废\"终止产品流转。系统更新产品状态并记录处理结果"],
  ["异常处理-补充信息", "当故障类型为\"故障信息不完整\"时，点击\"确认操作完成\"按钮后系统自动向来源工站发送补充故障信息的通知，来源工站操作员登录后在故障检测操作区补充故障描述并重新提交。系统将补充信息关联至原故障记录单，维修人员收到通知后继续维修流程"],
]));

pushArray(children, buildStatusRules("ST-00维修站", "扫描待维修产品、查看故障信息、执行维修操作、记录维修结果、确认操作完成和返工流转"));

pushArray(children, buildFaultTypeDetails("ST-00 维修站", [
  ["故障信息不完整", "一般", "来源工站提交的故障记录单信息不完整，系统核对发现故障类型、严重等级、故障描述或来源工站等信息缺失", "系统标记需来源工站补充故障信息后重新流转至维修站"],
  ["故障未复现", "一般", "维修人员根据故障信息对产品进行复现诊断时故障无法复现，无法确认故障原因，产品可能存在间歇性故障或误报", "系统标记产品为\"待观察\"，暂存待观察区，持续监控产品状态"],
  ["维修验证未通过", "严重", "维修完成后系统按原故障工站的检测项目清单重新检测，部分或全部检测项目未通过，维修效果未达到要求", "系统提示需重新维修或转为报废处理，维修人员需排查维修方案"],
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

children.push(h3("4.3.8 工站操作退出弹窗界面"));
children.push(p("所有工站操作界面的操作区设有\"确认操作完成\"按钮，底部按钮栏设有\"退出\"按钮。\"确认操作完成\"按钮用于确认本站操作已完成，产品流转至下一工站，操作界面重置为待扫描状态等待新产品输入。操作员点击\"退出\"按钮后，系统在当前工站操作界面上方弹出退出操作设置弹窗，操作员在弹窗中选择退出方式并完成相关设置后确认退出，系统保存退出信息并清除登录状态，界面返回到工站操作登录界面。退出弹窗提供正常登出和故障登出两种功能：正常登出后工站状态设置为\"待机\"，故障登出后工站状态设置为\"故障\"。"));

children.push(p("退出弹窗线框图（以ST-02生产装配工站为例，所有工站共享统一弹窗布局）："));

var exitColW = [2340, 2340, 2340, 2340];
var exitTotalW = exitColW[0] + exitColW[1] + exitColW[2] + exitColW[3];
var exitRows = [];

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("┌─ 工站操作退出设置 ─────────────────────── × ┐", {
    colSpan: 4, width: exitTotalW, fill: "1E5F8E", color: "FFFFFF",
    bold: true, size: 18, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  当前工站: ST-02 生产装配工站                              │", {
    colSpan: 4, width: exitTotalW, fill: "D6E4F0", color: "1E5F8E",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  当前操作员: OP-1024 李强    登录时间: 08:15              │", {
    colSpan: 4, width: exitTotalW, fill: "D6E4F0", color: "1E5F8E",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  请选择退出方式：                                                  │", {
    colSpan: 4, width: exitTotalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("│  [  正常登出  ]", { colSpan: 2, width: exitColW[0] + exitColW[1], fill: "E8F5E9", color: "2D9E6E", bold: true, size: 18, align: AlignmentType.LEFT }),
    wfCell("[  故障登出  ]  │", { colSpan: 2, width: exitColW[2] + exitColW[3], fill: "FFEBEE", color: "D32F2F", bold: true, size: 18, align: AlignmentType.LEFT }),
  ],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  ── 正常登出 ──                                                     │", {
    colSpan: 4, width: exitTotalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  完成当前工作后主动退出，工站状态变更为\"待机\"             │", {
    colSpan: 4, width: exitTotalW, fill: "FFFFFF", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("│  在制品处理:", { colSpan: 1, width: exitColW[0], fill: "FFFFFF", bold: true, size: 16, align: AlignmentType.LEFT }),
    wfCell("[保留在工站 ▼]  [流转至下一站 ▼]        │", { colSpan: 3, width: exitColW[1] + exitColW[2] + exitColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  ── 故障登出 ──                                                     │", {
    colSpan: 4, width: exitTotalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  设备异常无法继续生产时退出，工站状态变更为\"故障\"         │", {
    colSpan: 4, width: exitTotalW, fill: "FFFFFF", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("│  故障类型:", { colSpan: 1, width: exitColW[0], fill: "FFEBEE", bold: true, size: 16, align: AlignmentType.LEFT, color: "D32F2F" }),
    wfCell("[请选择故障类型 ▼]                              │", { colSpan: 3, width: exitColW[1] + exitColW[2] + exitColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("│  故障描述:", { colSpan: 1, width: exitColW[0], fill: "FFEBEE", bold: true, size: 16, align: AlignmentType.LEFT, color: "D32F2F" }),
    wfCell("[请输入故障描述...]                                │", { colSpan: 3, width: exitColW[1] + exitColW[2] + exitColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("│  在制品处理:", { colSpan: 1, width: exitColW[0], fill: "FFEBEE", bold: true, size: 16, align: AlignmentType.LEFT, color: "D32F2F" }),
    wfCell("[保留在工站 ▼]  [转维修站 ▼]                    │", { colSpan: 3, width: exitColW[1] + exitColW[2] + exitColW[3], fill: "FFFFFF", size: 16, align: AlignmentType.LEFT }),
  ],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("│  退出状态: 待操作    工站当前状态: 运行中    退出后状态: --  │", {
    colSpan: 4, width: exitTotalW, fill: "FFF8E6", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("│  [  取消  ]", { colSpan: 2, width: exitColW[0] + exitColW[1], fill: "F0F2F5", color: "666666", bold: true, size: 16, align: AlignmentType.CENTER }),
    wfCell("[  确认退出  ]  │", { colSpan: 2, width: exitColW[2] + exitColW[3], fill: "1E5F8E", color: "FFFFFF", bold: true, size: 16, align: AlignmentType.CENTER }),
  ],
}));

exitRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("└─────────────────────────────────────────────────┘", {
    colSpan: 4, width: exitTotalW, fill: "1E5F8E", color: "FFFFFF",
    bold: true, size: 18, align: AlignmentType.LEFT,
  })],
}));

children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: exitColW,
  rows: exitRows,
}));

children.push(spacer());

children.push(p("退出弹窗操作方法说明："));
children.push(makeTable(
  ["操作步骤", "操作方法"],
  [
    ["点击\"退出\"按钮", "在工站操作界面底部按钮栏点击\"退出\"按钮，系统在当前界面上方弹出退出操作设置弹窗，工站操作界面背景置灰不可操作"],
    ["选择退出方式", "在弹窗中选择\"正常登出\"或\"故障登出\"，系统根据选择展示对应的设置项"],
    ["正常登出-设置在制品处理", "选择\"保留在工站\"将当前在制品保留在工站等待下一操作员接手；选择\"流转至下一站\"将在制品流转至下一工站后退出"],
    ["故障登出-选择故障类型", "点击故障类型下拉框，选择故障类型（设备故障/电气故障/机械故障/系统异常/其他），系统自动关联故障等级"],
    ["故障登出-输入故障描述", "在故障描述输入框中输入故障现象的详细描述，便于维护人员快速定位问题"],
    ["故障登出-设置在制品处理", "选择\"保留在工站\"将当前在制品暂存在工站等待维修后继续处理；选择\"转维修站\"将在制品流转至维修站进行检测"],
    ["确认退出", "点击\"确认退出\"按钮，系统弹出确认对话框，确认后系统保存退出信息和操作记录，清除操作员登录状态，弹窗关闭，界面返回工站操作登录界面"],
    ["取消退出", "点击\"取消\"按钮或弹窗右上角\"×\"按钮，关闭退出弹窗，返回工站操作界面继续操作"],
  ],
  [2200, 7160]
));

children.push(spacer());

children.push(p("退出操作流程定义："));
children.push(makeTable(
  ["退出类型", "触发条件", "操作动作", "工站状态变更", "系统响应"],
  [
    ["正常登出", "操作员完成当前生产任务，或需要交接班、休息等主动退出", "工站操作界面点击\"退出\"→弹窗选择\"正常登出\"→设置在制品处理方式→点击\"确认退出\"→确认对话框确认", "运行中 → 待机", "保存操作记录，清除登录状态，释放工站操作权限，工站进入待机状态，界面返回登录界面，其他操作员可重新登录"],
    ["故障登出", "设备出现异常、工站无法继续正常生产，需紧急退出并报修", "工站操作界面点击\"退出\"→弹窗选择\"故障登出\"→选择故障类型→输入故障描述→设置在制品处理方式→点击\"确认退出\"→确认对话框确认", "运行中 → 故障", "保存操作记录和故障信息，清除登录状态，工站标记为故障状态，系统自动向维护人员发送告警通知，该工站暂停产品流转，界面返回登录界面"],
  ],
  [1200, 2000, 2200, 1200, 2760]
));

children.push(spacer());

children.push(p("退出后工站状态与后续处理："));
children.push(makeTable(
  ["退出类型", "退出后工站状态", "在制品处理", "设备处理", "恢复方式"],
  [
    ["正常登出", "待机", "在制品保留在工站或流转至下一站，WIP数量不变或相应减少", "设备保持当前状态，无需维护", "其他有权限操作员通过登录界面登录后即可恢复生产"],
    ["故障登出", "故障", "在制品保留在工站或转维修站，标记为\"待处理\"", "设备标记为故障，维护人员收到告警后介入维修", "维护人员将设备状态从\"故障\"切换为\"维护\"，维修完成后切换为\"待机\"，操作员方可重新登录"],
  ],
  [1200, 1200, 2000, 2000, 2960]
));

children.push(spacer());

children.push(h3("4.3.9 故障状态重新登录与工站操作界面显示"));
children.push(p("当操作员通过故障登出退出工站后，工站状态变更为\"故障\"。此时若有操作员重新登录该工站，系统允许登录但进入受限模式：工站操作界面顶部信息栏以红色标识显示\"故障\"状态，操作区的\"确认操作完成\"按钮、所有操作按钮和故障检测按钮全部置灰禁用，操作区仅显示故障信息和工站状态，操作员无法执行任何生产操作。只有维护人员修复设备并将工站状态从\"故障\"切换为\"待机\"后，操作员重新登录方可正常操作。"));

children.push(p("故障状态下的工站操作界面线框图（以ST-02生产装配工站为例）："));

var faultColW = [2340, 2340, 2340, 2340];
var faultTotalW = faultColW[0] + faultColW[1] + faultColW[2] + faultColW[3];
var faultRows = [];

faultRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("ST-02 生产装配工站    任务: TO20260804001    产品序列号: TO20260804001-003    状态: [故障]    操作员: OP-1024 李强", {
    colSpan: 4, width: faultTotalW, fill: "D32F2F", color: "FFFFFF",
    bold: true, size: 18, align: AlignmentType.LEFT,
  })],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("⚠ 该工站当前处于故障状态，所有操作已禁止，请联系维护人员修复设备", {
    colSpan: 4, width: faultTotalW, fill: "FFEBEE", color: "D32F2F",
    bold: true, size: 18, align: AlignmentType.CENTER,
  })],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("[ 操作区（已禁用） ]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F0F2F5", color: "999999", bold: true, size: 16 }),
    wfCell("[ 信息显示区 ]", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "D6E4F0", color: "1E5F8E", bold: true, size: 16 }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("1. 扫描物料条码  [灰色禁用]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
    wfCell("故障类型: 机械故障", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFFFFF", color: "333333", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("2. 装配工序引导  [灰色禁用]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
    wfCell("故障描述: 装配夹具卡死无法动作", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFFFFF", color: "333333", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("3. 装配结果确认  [灰色禁用]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
    wfCell("故障时间: 2026-08-09 10:35", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFFFFF", color: "333333", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("4. 工时记录  [灰色禁用]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
    wfCell("故障登出人: OP-1024 李强", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFFFFF", color: "333333", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("[ 故障检测操作区（已禁用） ]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F0F2F5", color: "999999", bold: true, size: 16 }),
    wfCell("维护状态: 待维修", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFEBEE", color: "D32F2F", bold: true, size: 16, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("检测1: 装配精度检测  [灰色禁用]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
    wfCell("告警通知: 已发送至维护部", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFFFFF", color: "333333", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("检测2-5: 其他检测项  [灰色禁用]", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
    wfCell("预计修复时间: 待定", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "FFFFFF", color: "333333", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("[ 确认操作完成 ]（灰色禁用）", { colSpan: 2, width: faultColW[0] + faultColW[1], fill: "F5F5F5", color: "999999", size: 16, align: AlignmentType.CENTER }),
    wfCell("确认后界面重置为待扫描状态  [灰色禁用]", { colSpan: 2, width: faultColW[2] + faultColW[3], fill: "F5F5F5", color: "999999", size: 15, align: AlignmentType.LEFT }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("操作按钮栏区域", {
    colSpan: 4, width: faultTotalW, fill: "F0F2F5", color: "666666",
    bold: true, size: 16, align: AlignmentType.LEFT,
  })],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [
    wfCell("[ 退出 ]", { colSpan: 4, width: faultTotalW, fill: "FFFFFF", color: "333333", size: 16, align: AlignmentType.CENTER }),
  ],
}));

faultRows.push(new TableRow({
  cantSplit: true,
  children: [wfCell("提示: 工站处于故障状态，点击\"退出\"按钮可弹出退出弹窗退出工站。维护人员修复设备后，工站状态将从\"故障\"切换为\"待机\"，届时操作员重新登录即可恢复正常操作。", {
    colSpan: 4, width: faultTotalW, fill: "FFF8E6", color: "333333",
    size: 16, align: AlignmentType.LEFT,
  })],
}));

children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: faultColW,
  rows: faultRows,
}));

children.push(spacer());

children.push(p("故障状态重新登录操作流程定义："));
children.push(makeTable(
  ["操作步骤", "操作动作", "系统响应", "界面显示"],
  [
    ["1. 登录故障工站", "操作员在登录界面选择故障状态的工站，输入工号和密码，点击\"登录\"", "系统校验站点状态为\"故障\"，允许登录但进入受限模式", "登录成功，进入工站操作界面故障状态显示模式"],
    ["2. 查看故障信息", "操作员查看信息显示区的故障类型、故障描述、故障时间和故障登出人信息", "系统展示故障详情和当前维护状态", "信息显示区显示故障信息，操作区全部置灰禁用"],
    ["3. 禁止操作", "操作员尝试点击操作区的\"确认操作完成\"按钮、任何操作按钮或故障检测按钮", "系统拒绝所有操作请求，按钮无响应", "操作区的\"确认操作完成\"按钮、操作按钮和检测按钮显示为灰色禁用状态，仅\"退出\"按钮可点击弹出退出弹窗"],
    ["4. 退出故障工站", "操作员点击\"退出\"按钮，弹出退出弹窗，选择\"正常登出\"退出", "系统保存查看记录，清除登录状态，工站状态保持\"故障\"不变", "界面返回登录界面，工站仍为故障状态等待维护"],
    ["5. 维护修复", "维护人员通过设备管理模块将工站状态从\"故障\"切换为\"维护\"，执行维修后切换为\"待机\"", "系统更新工站状态，解除操作禁止", "工站状态变更为\"待机\"，操作员可重新登录并正常操作"],
  ],
  [1500, 2200, 2200, 3460]
));

children.push(spacer());

children.push(p("工站状态与登录操作权限对照表："));
children.push(makeTable(
  ["工站状态", "登录权限", "操作权限", "界面显示", "状态变更触发条件"],
  [
    ["待机", "允许登录", "全部操作可用", "正常显示，操作按钮可点击", "正常登出后进入；维护完成后进入"],
    ["运行中", "禁止登录（已有操作员在线）", "—", "提示\"工站运行中，已有操作员登录\"", "操作员登录后进入"],
    ["故障", "允许登录（受限模式）", "全部操作禁止，仅可查看故障信息", "红色故障标识，操作按钮置灰，仅\"退出\"可用", "故障登出后进入"],
    ["维护中", "仅维护人员可登录", "仅维护操作可用", "维护模式界面，显示维修工单和设备状态", "维护人员将\"故障\"切换为\"维护\""],
  ],
  [1200, 1800, 2000, 2200, 2160]
));

children.push(spacer());

// ===== 5. 质量管理 =====
children.push(h1("五、质量管理"));

children.push(h2("5.1 功能说明"));
children.push(p("质量管理模块负责在生产过程中收集各工站出现的质量问题。当产品在任何工站被判定为不合格时，系统自动记录质量问题信息，包括发生工站、问题类型、严重等级、关联批次和操作员，形成统一的质量问题库供分析和追溯。"));

children.push(h2("5.2 质量问题数据结构"));
children.push(makeTable(
  ["字段名称", "字段标识", "类型", "必填", "说明"],
  [
    ["质量问题编号", "issue_id", "String", "是", "系统自动生成，格式：QI + 日期 + 序号"],
    ["发生工站", "station_id", "String", "是", "质量问题发生的工站编码（ST-01 ~ ST-05）"],
    ["产线号", "line_id", "String", "是", "发生的产线编号"],
    ["问题类型", "issue_type", "Enum", "是", "外观缺陷 / 装配不良 / 尺寸超差 / 功能异常 / 包装破损 / 其他"],
    ["严重等级", "severity", "Enum", "是", "致命 / 严重 / 一般 / 轻微"],
    ["关联任务订单", "task_order_id", "String", "是", "关联的生产任务订单号"],
    ["产品序列号", "product_sn", "String", "是", "不合格产品的序列号"],
    ["处理方式", "handling", "Enum", "是", "返工 / 报废 / 让步接收"],
    ["发现时间", "found_time", "DateTime", "是", "质量问题发现的时间"],
    ["操作员工号", "operator_id", "String", "是", "发现质量问题的操作员工号"],
    ["问题描述", "description", "Text", "是", "质量问题的详细描述"],
    ["处理状态", "status", "Enum", "是", "待处理 / 处理中 / 已闭环"],
  ],
  [1800, 1600, 1000, 600, 4360]
));

children.push(h2("5.3 页面布局"));
children.push(p("质量看板顶部为 4 个关键指标卡片（综合合格率、不良品总数、返工数、报废数）。下方分为两个视图：工站质量分布视图以柱状图展示各工站的质量问题数量，支持按问题类型分色显示；质量问题列表视图以表格展示所有质量问题的详细信息，支持按工站、严重等级、处理状态筛选。"));

children.push(h2("5.4 业务逻辑"));
children.push(p("质量问题主要由两个途径产生：一是外观检测工站（ST-03）检测判定不合格时，系统自动生成质量问题记录；二是其他工站操作员手动上报质量异常时，通过工站终端提交质量问题表单。每条质量问题记录关联发生工站、产线、任务订单和产品序列号，确保可追溯。质量问题默认为\"待处理\"状态，由质量工程师在列表中确认处理方式（返工/报废/让步接收），处理后状态变更为\"已闭环\"。质量看板的指标卡片实时统计当前日期范围内的质量数据。"));

children.push(h2("5.5 质量关键指标示例"));
children.push(makeTable(
  ["指标名称", "当前值", "说明"],
  [
    ["综合合格率", "98.2%", "合格产品数 / 总加工数 × 100%"],
    ["不良品总数", "14 件", "当前日期范围内累计不良品数量"],
    ["返工数", "8 件", "判定为返工处理的不良品数量"],
    ["报废数", "6 件", "判定为报废处理的不良品数量"],
  ],
  [2500, 2000, 4860]
));

children.push(h2("5.6 质量问题记录示例"));
children.push(makeTable(
  ["问题编号", "工站", "产线", "问题类型", "严重等级", "处理方式", "发现时间", "状态"],
  [
    ["QI20260804001", "ST-02", "L01", "装配不良", "严重", "返工", "08:35", "已闭环"],
    ["QI20260804002", "ST-03", "L01", "外观缺陷", "一般", "返工", "09:12", "已闭环"],
    ["QI20260804003", "ST-02", "L02", "装配不良", "致命", "报废", "09:45", "已闭环"],
    ["QI20260804004", "ST-03", "L01", "外观缺陷", "一般", "让步接收", "10:20", "已闭环"],
    ["QI20260804005", "ST-04", "L02", "包装破损", "轻微", "返工", "10:55", "处理中"],
    ["QI20260804006", "ST-02", "L01", "尺寸超差", "严重", "返工", "11:30", "处理中"],
    ["QI20260804007", "ST-03", "L03", "外观缺陷", "一般", "返工", "12:05", "待处理"],
    ["QI20260804008", "ST-05", "L02", "功能异常", "致命", "报废", "12:40", "待处理"],
    ["QI20260804009", "ST-03", "L01", "外观缺陷", "轻微", "让步接收", "13:15", "待处理"],
    ["QI20260804010", "ST-02", "L03", "装配不良", "一般", "返工", "13:50", "待处理"],
  ],
  [1400, 700, 600, 1000, 900, 900, 800, 760]
));

children.push(h2("5.7 故障统计分析"));
children.push(p("故障统计分析模块基于各工站提交的故障记录单，从产品故障类型、产线故障分布、任务订单故障类型三个维度进行统计与分析，为质量改进和生产优化提供数据支撑。"));

children.push(h3("5.7.1 按产品故障类型统计故障率"));
children.push(p("按产品故障类型维度统计各类故障的发生次数和故障率，帮助识别高频故障类型并针对性改进。统计范围覆盖所有工站（ST-01~ST-05）提交的故障记录，故障率=该类型故障发生次数/该类型所属工站总加工数×100%。"));
children.push(makeTable(
  ["故障类型", "发生次数", "所属工站", "总加工数", "故障率", "占比"],
  [
    ["外观缺陷-划痕", "5", "ST-03", "2000", "0.25%", "16.7%"],
    ["外观缺陷-污渍", "3", "ST-03", "2000", "0.15%", "10.0%"],
    ["外观缺陷-色差", "2", "ST-03", "2000", "0.10%", "6.7%"],
    ["外观缺陷-破损", "1", "ST-03", "2000", "0.05%", "3.3%"],
    ["装配不良-漏装/错装", "2", "ST-02", "1500", "0.13%", "6.7%"],
    ["装配不良-力矩不足/过大", "4", "ST-02", "1500", "0.27%", "13.3%"],
    ["装配不良-划伤/变形", "2", "ST-02", "1500", "0.13%", "6.7%"],
    ["尺寸超差", "3", "ST-02/ST-03", "1500", "0.20%", "10.0%"],
    ["物料缺失", "2", "ST-01", "2000", "0.10%", "6.7%"],
    ["BOM版本不一致", "1", "ST-01", "2000", "0.05%", "3.3%"],
    ["包装缺陷-密封不良", "2", "ST-04", "1200", "0.17%", "6.7%"],
    ["包装缺陷-标签打印错误", "3", "ST-04", "1200", "0.25%", "10.0%"],
    ["装箱缺陷-数量不足/过多", "2", "ST-05", "800", "0.25%", "6.7%"],
    ["入库异常-WMS同步失败", "1", "ST-05", "800", "0.13%", "3.3%"],
  ],
  [2000, 800, 1000, 800, 700, 700]
));
children.push(p("分析结论：外观缺陷-划痕（5次，占比16.7%）和装配不良-力矩不足/过大（4次，占比13.3%）为发生频率最高的故障类型，建议重点排查ST-03工站AOI检测设备校准情况和ST-02工站力矩扳手的定期标定记录。"));

children.push(h3("5.7.2 按产线故障统计"));
children.push(p("按产线维度统计各产线的故障发生情况，帮助对比不同产线的质量水平并定位薄弱产线。统计范围覆盖所有产线在指定时间范围内的故障记录。"));
children.push(makeTable(
  ["产线编号", "产线名称", "总加工数", "故障总数", "故障率", "致命故障数", "严重故障数", "主要故障类型"],
  [
    ["L01", "1号线", "2000", "15", "0.75%", "2", "5", "外观缺陷-划痕、装配不良-力矩不足、包装缺陷-标签错误"],
    ["L02", "2号线", "1800", "10", "0.56%", "1", "3", "尺寸超差、包装缺陷-密封不良、装箱缺陷-数量不足"],
    ["L03", "3号线", "1500", "5", "0.33%", "0", "2", "外观缺陷-色差、装配不良-漏装、外观缺陷-污渍"],
  ],
  [800, 800, 800, 800, 700, 700, 700, 3160]
));
children.push(p("分析结论：L01产线故障率最高（0.75%），且致命故障和严重故障数量最多，建议对L01产线开展专项质量审查，重点检查设备校准状态和操作员培训情况；L03产线故障率最低（0.33%），质量表现最优，可总结其生产管理经验推广至其他产线。"));

children.push(h3("5.7.3 按任务订单号统计故障类型"));
children.push(p("按任务订单号维度统计每个订单下发生的故障类型分布，帮助追溯批次性质量问题并评估供应商来料质量。统计范围覆盖指定时间范围内所有任务订单的故障记录。"));
children.push(makeTable(
  ["任务订单号", "产品名称", "计划数量", "已加工数", "故障数", "故障率", "主要故障类型"],
  [
    ["TO20260804001", "电机壳体A型", "500", "450", "5", "1.11%", "外观缺陷-划痕(2)、装配不良-力矩不足(2)、尺寸超差(1)"],
    ["TO20260804002", "电机壳体B型", "300", "280", "3", "1.07%", "尺寸超差(2)、外观缺陷-色差(1)"],
    ["TO20260804003", "减速器壳体", "800", "750", "8", "1.07%", "包装缺陷-标签错误(3)、装箱缺陷-数量不足(2)、外观缺陷-污渍(2)、入库异常-WMS同步失败(1)"],
    ["TO20260804004", "端盖组件", "200", "180", "2", "1.11%", "装配不良-漏装(1)、物料缺失(1)"],
    ["TO20260804005", "定子组件", "600", "580", "7", "1.21%", "外观缺陷-污渍(3)、装配不良-力矩不足(2)、外观缺陷-划痕(1)、BOM版本不一致(1)"],
    ["TO20260804006", "转子组件", "400", "380", "4", "1.05%", "尺寸超差(2)、入库异常-WMS同步失败(1)、装配不良-划伤(1)"],
    ["TO20260804007", "法兰盘", "350", "330", "3", "0.91%", "包装缺陷-密封不良(2)、外观缺陷-色差(1)"],
    ["TO20260804008", "轴承座", "250", "230", "1", "0.43%", "装配不良-力矩不足(1)"],
  ],
  [1500, 1200, 700, 700, 600, 600, 2700]
));
children.push(p("分析结论：TO20260804005（定子组件）故障率最高（1.21%），其中外观缺陷-污渍集中出现3次，建议排查该批次来料表面清洁度问题；TO20260804003（减速器壳体）故障数最多（8件），包装缺陷-标签错误为主要问题，建议检查ST-04工站标签打印机和打印模板配置；TO20260804008（轴承座）故障率最低（0.43%），质量表现最优。"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 6. 设备管理 =====
children.push(h1("六、设备管理"));

children.push(h2("6.1 功能说明"));
children.push(p("设备管理模块对产线各工站的生产设备进行状态管理。系统实时采集设备运行状态（运行、待机、维护、故障），记录设备运行时长和利用率，并在设备故障时自动告警通知维护人员。每条产线的每个工站关联一台或多台生产设备。"));

children.push(h2("6.2 设备数据结构"));
children.push(makeTable(
  ["字段名称", "字段标识", "类型", "必填", "说明"],
  [
    ["设备编号", "equip_id", "String", "是", "设备唯一标识，如 EQ-L01-001"],
    ["设备名称", "equip_name", "String", "是", "设备名称，如\"自动装配机A\""],
    ["所属产线", "line_id", "String", "是", "设备所在产线编号"],
    ["所属工站", "station_id", "String", "是", "设备所在工站编码"],
    ["设备类型", "equip_type", "Enum", "是", "装配设备 / 检测设备 / 包装设备 / 装箱设备 / 搬运设备 / 其他"],
    ["运行状态", "status", "Enum", "是", "运行 / 待机 / 维护 / 故障"],
    ["当日运行时长", "run_time_today", "Float", "是", "当日累计运行时长（小时）"],
    ["利用率", "utilization", "Float", "是", "运行时长 / 在线时长 × 100%"],
    ["上次维护日期", "last_maintenance", "Date", "否", "最近一次维护的日期"],
    ["下次维护日期", "next_maintenance", "Date", "否", "计划下次维护的日期"],
  ],
  [1800, 1700, 1000, 600, 4260]
));

children.push(h2("6.3 设备状态流转"));
children.push(p("设备状态之间的流转规则如下："));
children.push(makeTable(
  ["当前状态", "目标状态", "触发条件"],
  [
    ["待机", "运行", "开始生产，有在制品进入工站"],
    ["运行", "待机", "生产暂停或当前任务订单完成"],
    ["运行", "故障", "设备检测到异常或故障代码"],
    ["待机", "故障", "设备在待机状态下发生异常"],
    ["故障", "维护", "维护人员介入维修"],
    ["待机", "维护", "到达计划维护时间"],
    ["维护", "待机", "维护完成，设备恢复可用"],
  ],
  [2000, 2000, 5360]
));

children.push(h2("6.4 页面布局"));
children.push(p("设备状态面板主体为设备卡片网格，每张卡片代表一台设备，左侧边框颜色标识设备状态（绿色运行、灰色待机、橙色维护、红色故障）。卡片显示设备编号、名称、所属产线和工站、当日运行时长、利用率进度条。顶部工具栏支持按产线和状态筛选，右侧实时统计各状态设备数量。"));

children.push(h2("6.5 业务逻辑"));
children.push(p("设备状态由 PLC 数据采集层实时上报。当设备从待机切换为运行时，开始累计运行时长；当设备触发故障代码时，状态变更为\"故障\"，系统自动向维护人员发送告警通知，同时关联工站在生产过程管理模块中标记为\"故障\"状态，暂停该工站的产品流转。维护人员在系统中将设备状态从\"故障\"或\"待机\"切换为\"维护\"，维护完成后恢复为\"待机\"。设备利用率每日 0 点重置，按当日累计运行时长除以当日在线时长计算。"));

children.push(h2("6.6 设备状态示例"));
children.push(p("以下为工厂全部设备的实时状态示例："));
children.push(makeTable(
  ["设备编号", "设备名称", "产线", "工站", "设备类型", "状态", "运行时长", "利用率"],
  [
    ["EQ-L01-001", "自动导入机", "L01", "ST-01", "搬运设备", "运行", "6.5h", "81%"],
    ["EQ-L01-002", "装配机器人A", "L01", "ST-02", "装配设备", "运行", "6.2h", "78%"],
    ["EQ-L01-003", "AOI检测仪", "L01", "ST-03", "检测设备", "运行", "5.8h", "72%"],
    ["EQ-L01-004", "自动包装机", "L01", "ST-04", "包装设备", "运行", "5.5h", "69%"],
    ["EQ-L01-005", "装箱机器人", "L01", "ST-05", "装箱设备", "待机", "0h", "0%"],
    ["EQ-L01-006", "入库输送线", "L01", "ST-05", "搬运设备", "待机", "0h", "0%"],
    ["EQ-L02-001", "自动导入机", "L02", "ST-01", "搬运设备", "运行", "6.8h", "85%"],
    ["EQ-L02-002", "装配机器人B", "L02", "ST-02", "装配设备", "故障", "3.2h", "40%"],
    ["EQ-L02-003", "CCD检测仪", "L02", "ST-03", "检测设备", "运行", "6.0h", "75%"],
    ["EQ-L02-004", "自动包装机", "L02", "ST-04", "包装设备", "维护", "2.5h", "31%"],
    ["EQ-L03-001", "自动导入机", "L03", "ST-01", "搬运设备", "运行", "6.3h", "79%"],
    ["EQ-L03-002", "装配机器人C", "L03", "ST-02", "装配设备", "运行", "6.1h", "76%"],
    ["EQ-L03-003", "AOI检测仪", "L03", "ST-03", "检测设备", "维护", "4.0h", "50%"],
    ["EQ-L03-004", "自动包装机", "L03", "ST-04", "包装设备", "运行", "5.2h", "65%"],
  ],
  [1100, 1100, 600, 600, 1000, 700, 800, 700]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 7. 工厂产能管理 =====
children.push(h1("七、工厂产能管理"));

children.push(h2("7.1 功能说明"));
children.push(p("工厂产能管理模块对工厂各产线的生产产能进行管理和配置。管理员可设置每条产线的标准产能（单位时间产量）、班次配置（班次时间段、人员配置）、可生产产品类型以及任务订单拆分数量。这些产能数据作为生产调度排程模块的输入，确保排程方案基于实际可用产能。"));

children.push(h2("7.2 产能配置数据结构"));
children.push(makeTable(
  ["字段名称", "字段标识", "类型", "必填", "说明"],
  [
    ["产线编号", "line_id", "String", "是", "产线唯一标识，如 L01"],
    ["产线名称", "line_name", "String", "是", "如\"一号装配产线\""],
    ["标准产能", "std_capacity", "Integer", "是", "每小时标准产量（件/小时）"],
    ["班次数量", "shift_count", "Integer", "是", "每日班次数（1/2/3）"],
    ["班次配置", "shift_config", "JSON", "是", "各班次的起止时间，如 [{\"start\":\"08:00\",\"end\":\"16:00\"}]"],
    ["日可用工时", "daily_hours", "Float", "是", "每日总生产工时，由班次配置自动计算"],
    ["日最大产能", "daily_max_capacity", "Integer", "是", "日可用工时 × 标准产能，自动计算"],
    ["可生产产品类型", "product_types", "Array", "是", "该产线可生产的产品类型列表"],
    ["任务订单拆分数量", "task_split_qty", "Integer", "是", "每个任务订单的固定产品数量（件/单）"],
    ["当前利用率", "utilization", "Float", "是", "已排程工时 / 日可用工时 × 100%"],
    ["产线状态", "status", "Enum", "是", "正常 / 停线 / 维护中"],
  ],
  [1800, 1700, 1000, 600, 4260]
));

children.push(h2("7.3 页面布局"));
children.push(p("产能配置页面主体为产线配置列表，每行对应一条产线的产能参数，支持直接编辑标准产能、班次数、拆分数量等字段。日最大产能由系统根据标准产能和班次配置自动计算。底部展示各产线产能利用率的柱状图，直观反映产线负载情况。页面顶部显示工厂日总产能汇总值。"));

children.push(h2("7.4 业务逻辑"));
children.push(p("管理员在产能配置页面设置各产线的标准产能、班次配置和拆分数量。标准产能表示该产线在满负荷运行时每小时的产量；班次配置定义每日的工作时段（如两班制 8:00-16:00、16:00-24:00）；拆分数量决定生产调度模块将大订单拆分为任务订单的粒度。系统根据班次配置自动计算日可用工时，再乘以标准产能得出日最大产能。当产线状态为\"停线\"或\"维护中\"时，该产线日最大产能置零，排程模块自动跳过该产线。产能利用率 = 已排程任务订单总工时 / 日可用工时 × 100%，排程模块据此判断产线是否还有可用产能。"));

children.push(h2("7.5 产能配置示例"));
children.push(makeTable(
  ["产线编号", "产线名称", "标准产能(件/h)", "班次数", "日可用工时", "日最大产能", "拆分数量(件/单)", "当前利用率", "状态"],
  [
    ["L01", "一号装配产线", "120", "2", "16h", "1920", "100", "75%", "正常"],
    ["L02", "二号装配产线", "100", "2", "16h", "1600", "100", "60%", "正常"],
    ["L03", "三号装配产线", "80", "2", "16h", "1280", "100", "55%", "正常"],
  ],
  [800, 1200, 1000, 600, 800, 800, 1000, 800, 600]
));
children.push(p("工厂日总产能：4800 件/日"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 8. 数据采集与分析 =====
children.push(h1("八、数据采集与分析"));

children.push(h2("8.1 功能说明"));
children.push(p("数据采集与分析模块负责从各数据源采集生产过程数据，并进行多维度统计分析。数据来源包括 PLC 设备运行数据、工站扫码终端数据、检测设备结果数据和人工录入数据。分析结果以可视化图表形式展示，为生产决策提供数据支撑。"));

children.push(h2("8.2 数据采集方式"));
children.push(makeTable(
  ["数据源", "采集方式", "采集频率", "采集数据"],
  [
    ["PLC 设备", "OPC UA / Modbus 协议自动采集", "实时（秒级）", "设备启停状态、运行时长、故障代码、温度/压力等工艺参数"],
    ["工站扫码终端", "操作员扫码触发数据上传", "事件驱动", "产品序列号、工站进出时间、操作员工号、批次号"],
    ["检测设备", "检测设备接口自动上传", "每件检测完成时", "检测项目、检测值、判定结果、缺陷图像"],
    ["人工录入", "工站终端表单录入", "事件驱动", "质量问题上报、设备异常备注、物料异常记录"],
  ],
  [1500, 2500, 1500, 3860]
));

children.push(h2("8.3 分析维度"));
children.push(makeTable(
  ["分析维度", "分析指标", "数据来源模块", "用途"],
  [
    ["生产产出分析", "各产线日/周/月产量、产出趋势、计划达成率", "生产过程管理", "评估产线产出效率，识别产能瓶颈"],
    ["质量分析", "各工站不良率、质量问题类型分布、质量趋势", "质量管理", "定位高频质量问题工站，指导质量改进"],
    ["设备效率分析", "设备 OEE（综合效率）、各设备利用率、故障停机时长", "设备管理", "评估设备综合效率，制定维护计划"],
    ["产线节拍分析", "各工站平均节拍时间、WIP 堆积分析、瓶颈工站识别", "生产过程管理", "识别产线瓶颈工站，优化产线平衡"],
    ["排程执行分析", "排程达成率、计划 vs 实际工时偏差、延期订单分析", "生产调度与排程", "评估排程准确性，优化排程算法参数"],
  ],
  [1500, 2800, 1500, 3560]
));

children.push(h2("8.4 页面布局"));
children.push(p("数据分析仪表盘顶部为筛选工具栏，支持按时间范围和产线筛选。主体以 2×2 网格布局展示 4 个核心分析图表："));
children.push(bullet("生产产出趋势（折线图）：展示每日各产线产量变化趋势，支持多条产线对比"));
children.push(bullet("各工站质量不良率（柱状图）：对比各工站的质量水平，标注目标线"));
children.push(bullet("设备 OEE 综合效率（雷达图）：展示各产线设备的可用率、表现指数、质量指数三个维度"));
children.push(bullet("产线节拍分析（柱状图）：展示各工站的平均节拍时间，识别瓶颈工站"));

children.push(h2("8.5 业务逻辑"));
children.push(p("仪表盘默认加载近 7 天全部产线的数据。用户切换时间范围或产线筛选条件后，4 个图表同步刷新。生产产出趋势从生产过程管理模块获取每日各产线入库工站（ST-05）的完成数量；质量不良率从质量管理模块按工站汇总不良品数量除以该工站总加工数；设备 OEE 从设备管理模块获取各设备的可用率（运行时长/计划时长）、表现指数（实际节拍/标准节拍）、质量指数（合格数/加工数），三者相乘得出 OEE；产线节拍分析从工站扫码数据计算产品在每站平均停留时间，停留时间最长的工站即为瓶颈工站。"));

children.push(h2("8.6 设备 OEE 示例数据"));
children.push(makeTable(
  ["产线", "可用率", "表现指数", "质量指数", "OEE 综合效率"],
  [
    ["L01 一号产线", "85%", "78%", "98%", "64.9%"],
    ["L02 二号产线", "72%", "65%", "96%", "44.9%"],
    ["L03 三号产线", "68%", "70%", "97%", "46.1%"],
  ],
  [2000, 1800, 1800, 1800, 1860]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 9. 角色与权限 =====
children.push(h1("九、角色与权限"));
children.push(p("系统涉及以下角色，各角色的可见范围和操作权限如下："));

children.push(h2("9.1 生产调度员"));
children.push(bullet("查看和操作生产调度排程"));
children.push(bullet("查看工厂产能配置"));
children.push(bullet("查看生产过程状态"));
children.push(bullet("无产能配置修改权限"));

children.push(h2("9.2 产线操作员"));
children.push(bullet("操作所属产线工站终端"));
children.push(bullet("扫码确认产品流转"));
children.push(bullet("上报质量问题"));
children.push(bullet("仅可见本产线数据"));

children.push(h2("9.3 质量工程师"));
children.push(bullet("查看全部质量问题"));
children.push(bullet("处理质量问题（返工/报废判定）"));
children.push(bullet("查看质量分析报表"));
children.push(bullet("无排程和设备操作权限"));

children.push(h2("9.4 设备维护员"));
children.push(bullet("查看全部设备状态"));
children.push(bullet("变更设备状态（维护/恢复）"));
children.push(bullet("查看设备维护记录"));
children.push(bullet("无生产操作权限"));

children.push(h2("9.5 工厂管理员"));
children.push(bullet("全部模块查看和操作权限"));
children.push(bullet("配置工厂产能参数"));
children.push(bullet("管理用户和角色"));
children.push(bullet("查看全部分析报表"));

children.push(spacer());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [txt("— 文档结束 —", { color: "6B7785", italics: true, size: 20 })],
}));

// ===== Build Document =====
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: fontConfig, size: 22 },
        paragraph: { spacing: { after: 120, line: 360 } },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: ACCENT, font: fontConfig },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0, keepNext: false, keepLines: false },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: "1A2332", font: fontConfig },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: false, keepLines: false },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: ACCENT, font: fontConfig },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: false, keepLines: false },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [txt("MES 制造执行系统 - 产品需求文档", { size: 18, color: "999999", font: fontConfig })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            txt("第 ", { size: 18, color: "999999", font: fontConfig }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "999999", font: fontConfig }),
            txt(" 页 / 共 ", { size: 18, color: "999999", font: fontConfig }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "999999", font: fontConfig }),
            txt(" 页", { size: 18, color: "999999", font: fontConfig }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(function(buffer) {
  const outPath = "c:\\Users\\牛虫翻天\\Documents\\trae_projects\\Http-Switch\\webSocket\\MES制造执行系统设计方案.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Document generated: " + outPath);
});
