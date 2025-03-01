/*********************************************
 * main.js
 * 集成营业时间可视化 + 原有功能优化
 *********************************************/
// 调试变量：
// 取消下面一行的注释，即可在调试时使用指定时间
// let debugTime = new Date("2025-02-26T22:00:00");

// 辅助函数：返回当前时间，如果 debugTime 不为 null，则返回 debugTime，否则返回真实当前时间
function getCurrentTime() {
  return debugTime || new Date();
}
/*********************************************
 * 全局可修改配置变量
 *********************************************/
// 春假特殊营业时间配置（仅适用于春假期间的特殊日期）
// 日期格式为 YYYY-MM-DD 或区间（startDate ～ endDate），时间格式 "HH:mm"（24小时制）
// 注意：各设施日期区间可能不连续
const SPRING_BREAK_SCHEDULES = {
  // IM West
  "west": [
    { date: "2025-02-28", start: "06:00:00", end: "18:00:00" },
    { startDate: "2025-03-01", endDate: "2025-03-02", start: "11:59:00", end: "18:00:00" },
    { startDate: "2025-03-03", endDate: "2025-03-07", start: "09:00:00", end: "19:00:00" },
    { startDate: "2025-03-08", endDate: "2025-03-09", start: "11:59:00", end: "20:00:00" }
  ],
  // IM East
  "east": [
    { date: "2025-02-28", start: "06:00:00", end: "18:00:00" },
    { startDate: "2025-03-01", endDate: "2025-03-02", closed: true },
    { startDate: "2025-03-03", endDate: "2025-03-07", start: "10:00:00", end: "14:00:00" },
    { startDate: "2025-03-08", endDate: "2025-03-09", start: "11:59:00", end: "20:00:00" }
  ],
  // IM Circle
  "circle": [
    { date: "2025-02-28", start: "07:00", end: "17:00:00" },
    { startDate: "2025-03-01", endDate: "2025-03-02", start: "11:00:00", end: "19:00:00" },
    { startDate: "2025-03-03", endDate: "2025-03-07", start: "08:00:00", end: "16:30:00" },
    { startDate: "2025-03-08", endDate: "2025-03-09", start: "11:00:00", end: "19:00:00" }
  ]
};

// 管理员特殊管理日期（格式：YYYY-MM-DD），在这些日期下可强制开门或关闭，
// 可选配置：forceOpen（布尔值，全天强制开/关），
// 或 forceOpenTime（指定时间区间，格式为 { start: "HH:mm", end: "HH:mm" }，在该时段内采用 forceOpen 设置）
const ADMIN_MANAGEMENT_DATES = {
  // "2025-04-01": { forceOpen: true, forceOpenTime: { start: "08:00", end: "20:00" } },
  // "2025-04-02": { forceOpen: false }
};

/*********************************************
 * 以下为辅助函数：春假和管理员特殊管理判断
 *********************************************/

/**
 * 判断当前日期是否落在指定日期（YYYY-MM-DD）内
 */
function isSameDate(dateObj, dateStr) {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  return dateObj.getFullYear() === yyyy &&
      (dateObj.getMonth() + 1) === mm &&
      dateObj.getDate() === dd;
}

/**
 * 根据 SPRING_BREAK_SCHEDULES 配置，判断指定设施在 dateObj 是否有特殊营业设置。
 * 若命中，则返回布尔值表示是否开门；若未命中则返回 null
 */
function getSpringBreakScheduleOpen(facility, dateObj) {
  const schedules = SPRING_BREAK_SCHEDULES[facility];
  if (!schedules) return null;
  // 将当前日期格式化为 YYYY-MM-DD
  const yyyy = dateObj.getFullYear();
  const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const dd = dateObj.getDate().toString().padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  for (let schedule of schedules) {
    // 若配置中有 date 属性，直接比较
    if (schedule.date && schedule.date === dateStr) {
      if (schedule.closed) return false;
      // 检查当前时间是否在 [start, end)
      return isWithinTime(dateObj, schedule.start, schedule.end);
    }
    // 如果配置中有 startDate 与 endDate，则判断是否落在区间内
    if (schedule.startDate && schedule.endDate) {
      const start = new Date(schedule.startDate + "T00:00:00");
      const end = new Date(schedule.endDate + "T23:59:59");
      if (dateObj >= start && dateObj <= end) {
        if (schedule.closed) return false;
        return isWithinTime(dateObj, schedule.start, schedule.end);
      }
    }
  }
  return null;
}

/**
 * 判断 dateObj 当前时间是否在指定的时间区间内
 * 参数 timeStr 格式 "HH:mm"
 */
function isWithinTime(dateObj, startStr, endStr) {
  const [startHour, startMin] = startStr.split(":").map(Number);
  const [endHour, endMin] = endStr.split(":").map(Number);
  const currentMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * 获取管理员特殊管理配置，返回对应配置对象，
 * 格式如 { forceOpen: true, forceOpenTime: { start: "08:00", end: "20:00" } } 或 { forceOpen: false }
 * 如果不在名单中，返回 null
 */
function getAdminManagement(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const dd = dateObj.getDate().toString().padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  return ADMIN_MANAGEMENT_DATES[dateStr] || null;
}

/**
 * 判断 dateObj 当前时间是否在管理员配置的 forceOpenTime 内
 */
function isWithinAdminTime(dateObj, forceOpenTime) {
  return isWithinTime(dateObj, forceOpenTime.start, forceOpenTime.end);
}

/*********************************************
 * 以下为原有代码部分
 *********************************************/

// =====================
// 节日日期判断：如果今天是每年2月26，则替换 <title> 与 <header> 中的 <h2>
// =====================
(function() {
  const now = new Date();
  // 注意：JS中月份从0开始，所以 1 代表2月
  if (now.getMonth() === 1 && now.getDate() === 26) {
    document.title = "MSU Sweat Scheduler 🎂健身房人浪预报🎉";
    const h2 = document.querySelector("header h2");
    if (h2) {
      h2.innerHTML = "MSU 健身房人浪预报🎂";
    }
  }
})();

// 固定随机种子，确保刷新时随机数序列一致
Math.seedrandom('fixed-seed');

/**
 * 自定义时间格式化函数，返回 "HH:mm"
 */
function formatTime(date) {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 生成正态随机数 (Box-Muller)
 */
function randNormal(mean, stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

/**
 * 将 CSV 中的日期映射到今天（仅保留时分秒）
 * 形如 "2023-01-01 07:30:00" -> 今日 07:30:00
 */
function fixDateToToday(dateStr) {
  let parts = dateStr.split(/\s+/);
  if (parts.length < 2) return null;
  let [_, hhmmss] = parts; // 只取时分秒
  let [hh, mm, ss] = hhmmss.split(":").map(Number);
  let now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss);
}

/**
 * SG 平滑函数：使用给定卷积核对数据进行平滑
 */
function sgSmooth(arr, kernel) {
  let kHalf = Math.floor(kernel.length / 2);
  let smoothed = [];
  for (let i = 0; i < arr.length; i++) {
    let acc = 0;
    for (let j = 0; j < kernel.length; j++) {
      let idx = i + j - kHalf;
      if (idx < 0) idx = 0;
      if (idx >= arr.length) idx = arr.length - 1;
      acc += arr[idx] * kernel[j];
    }
    smoothed.push(acc);
  }
  return smoothed;
}

/**
 * 判断 IM West 在给定时间营业
 * 正常学期营业时间：
 *  - 周日: 10am - 10pm
 *  - 周六: 10am - 9pm
 *  - 周一至周五: 6am - 11pm
 * 优先：春假特殊营业时间 → 管理员特殊管理 → 正常学期营业时间
 */
function isOpenWest(dateObj) {
  // 先检测春假特殊营业时间
  const springStatus = getSpringBreakScheduleOpen("west", dateObj);
  if (springStatus !== null) return springStatus;

  // 管理员特殊管理配置
  const adminConfig = getAdminManagement(dateObj);
  if (adminConfig) {
    if (adminConfig.forceOpenTime) {
      if (isWithinAdminTime(dateObj, adminConfig.forceOpenTime)) {
        return adminConfig.forceOpen;
      }
    } else if (typeof adminConfig.forceOpen === 'boolean') {
      return adminConfig.forceOpen;
    }
  }

  // 正常学期营业时间
  const day = dateObj.getDay();
  const hour = dateObj.getHours();
  if (day === 0) return hour >= 10 && hour < 22;
  if (day === 6) return hour >= 10 && hour < 21;
  return hour >= 6 && hour < 23;
}

/**
 * 判断 IM East 在给定时间营业
 * 与 IM West 正常营业时间相同，但春假特殊营业时间不同
 * 优先：春假特殊营业时间 → 管理员特殊管理 → 正常学期营业时间
 */
function isOpenEast(dateObj) {
  const springStatus = getSpringBreakScheduleOpen("east", dateObj);
  if (springStatus !== null) return springStatus;

  const adminConfig = getAdminManagement(dateObj);
  if (adminConfig) {
    if (adminConfig.forceOpenTime) {
      if (isWithinAdminTime(dateObj, adminConfig.forceOpenTime)) {
        return adminConfig.forceOpen;
      }
    } else if (typeof adminConfig.forceOpen === 'boolean') {
      return adminConfig.forceOpen;
    }
  }

  const day = dateObj.getDay();
  const hour = dateObj.getHours();
  if (day === 0) return hour >= 10 && hour < 22;
  if (day === 6) return hour >= 10 && hour < 21;
  return hour >= 6 && hour < 23;
}

/**
 * 判断 IM Circle 是否在给定时间营业
 * 正常学期营业时间：
 *  - 周一至周四: 7:00 - 10pm（设备区 9:30 才开）
 *  - 周五: 7:00 - 8pm（设备区 9:30 才开）
 *  - 周六、周日: 12pm - 5pm
 * 优先：春假特殊营业时间 → 管理员特殊管理 → 正常学期营业时间
 */
function isOpenCircle(dateObj) {
  const springStatus = getSpringBreakScheduleOpen("circle", dateObj);
  if (springStatus !== null) return springStatus;

  const adminConfig = getAdminManagement(dateObj);
  if (adminConfig) {
    if (adminConfig.forceOpenTime) {
      if (isWithinAdminTime(dateObj, adminConfig.forceOpenTime)) {
        return adminConfig.forceOpen;
      }
    } else if (typeof adminConfig.forceOpen === 'boolean') {
      return adminConfig.forceOpen;
    }
  }

  const day = dateObj.getDay();
  const hour = dateObj.getHours();
  if (day >= 1 && day <= 4) {
    if (hour < 9 || (hour === 9 && dateObj.getMinutes() < 30)) return false;
    if (hour >= 22) return false;
    return true;
  }
  if (day === 5) {
    if (hour < 9 || (hour === 9 && dateObj.getMinutes() < 30)) return false;
    if (hour >= 20) return false;
    return true;
  }
  if (day === 6 || day === 0) return hour >= 12 && hour < 17;
  return false;
}

// 全局变量：保存实时人数数据（时间序列），用于更新液晶显示
let globalOccupancies = {
  timeData: [],
  westOcc: [],
  eastOcc: [],
  circleOcc: []
};

/**
 * 入口函数：读取 CSV -> 解析 -> 处理 -> 可视化
 */
async function loadData() {
  try {
    const response = await fetch("https://raw.githubusercontent.com/CharmingZh/gym_data_repo/refs/heads/main/data/today_data.csv");
    if (!response.ok) throw new Error("Failed to fetch CSV: " + response.statusText);
    const text = await response.text();
    processCSV(text);
    // 更新 "last-update" 显示
    const now = new Date();
    document.getElementById('last-update').innerText = formatTime(now);
  } catch (err) {
    console.error("Error fetching data:", err);
    document.getElementById("chart").innerHTML = "<p style='color: red;'>Failed to load data.</p>";
  }
}

/**
 * 解析并处理 CSV 文本
 */
function processCSV(csvText) {
  const MEAN_HOURS = 1.0;
  const STD_HOURS  = 0.4;
  let lines = csvText.trim().split("\n");
  let rawData = lines.map(line => {
    let [timeStr, w, e, c] = line.split(/,\s*/);
    if (!timeStr || w === undefined || e === undefined || c === undefined) return null;
    let t = fixDateToToday(timeStr);
    if (!t || isNaN(t.getTime())) return null;
    return { time: t, west: Number(w), east: Number(e), circle: Number(c) };
  }).filter(Boolean);

  if (!rawData.length) {
    document.getElementById("chart").innerHTML = "<p style='color:red;'>No valid data available.</p>";
    return;
  }
  rawData.sort((a, b) => a.time - b.time);
  let dataPoints = rawData.filter(dp => {
    let h = dp.time.getHours();
    return h >= 6 && h <= 23;
  });
  if (!dataPoints.length) {
    document.getElementById("chart").innerHTML = "<p style='color:red;'>No data in 6:00-23:00.</p>";
    return;
  }
  let xAxis = [];
  let timeData = [];
  let westOcc = [];
  let eastOcc = [];
  let circleOcc = [];
  let peopleWest = [];
  let peopleEast = [];
  let peopleCircle = [];
  let prev = null;

  dataPoints.forEach(dp => {
    let currTime = dp.time;
    if (!prev) prev = dp;
    peopleWest   = peopleWest.filter(p => p.exitTime > currTime);
    peopleEast   = peopleEast.filter(p => p.exitTime > currTime);
    peopleCircle = peopleCircle.filter(p => p.exitTime > currTime);
    let dWest   = Math.max(dp.west - prev.west, 0);
    let dEast   = Math.max(dp.east - prev.east, 0);
    let dCircle = Math.max(dp.circle - prev.circle, 0);
    for (let i = 0; i < dWest; i++) {
      let duration = randNormal(MEAN_HOURS, STD_HOURS);
      let exitTime = new Date(currTime.getTime() + duration * 3600000);
      peopleWest.push({ exitTime });
    }
    for (let i = 0; i < dEast; i++) {
      let duration = randNormal(MEAN_HOURS, STD_HOURS);
      let exitTime = new Date(currTime.getTime() + duration * 3600000);
      peopleEast.push({ exitTime });
    }
    for (let i = 0; i < dCircle; i++) {
      let duration = randNormal(MEAN_HOURS, STD_HOURS);
      let exitTime = new Date(currTime.getTime() + duration * 3600000);
      peopleCircle.push({ exitTime });
    }
    xAxis.push(formatTime(currTime));
    timeData.push(currTime);
    westOcc.push(peopleWest.length);
    eastOcc.push(peopleEast.length);
    circleOcc.push(peopleCircle.length);
    prev = dp;
  });

  globalOccupancies.timeData  = timeData;
  globalOccupancies.westOcc   = westOcc;
  globalOccupancies.eastOcc   = eastOcc;
  globalOccupancies.circleOcc = circleOcc;
  updateRealtimeDisplay();

  for (let i = 0; i < timeData.length; i++) {
    let t = timeData[i];
    if (!isOpenWest(t)) { westOcc[i] = null; eastOcc[i] = null; }
    if (!isOpenCircle(t)) { circleOcc[i] = null; }
  }
  const sgKernel = [-2, 3, 6, 7, 6, 3, -2].map(x => x / 21);
  const smoothWestOcc   = sgSmooth(westOcc,   sgKernel).map(v => Math.max(0, Math.floor(v || 0)));
  const smoothEastOcc   = sgSmooth(eastOcc,   sgKernel).map(v => Math.max(0, Math.floor(v || 0)));
  const smoothCircleOcc = sgSmooth(circleOcc, sgKernel).map(v => Math.max(0, Math.floor(v || 0)));
  renderChart(xAxis, smoothWestOcc, smoothEastOcc, smoothCircleOcc);
}

/**
 * 更新实时显示
 */
function updateRealtimeDisplay() {
  const timeData = globalOccupancies.timeData;
  if (!timeData.length) return;
  const currentIndex = timeData.length - 1;
  const currentTime = (typeof debugTime !== 'undefined') ? debugTime : new Date();

  function computeDiff(arr) {
    const currentVal = arr[currentIndex];
    const targetTime = new Date(currentTime.getTime() - 15 * 60000);
    let prevIndex = 0;
    for (let i = 0; i < timeData.length; i++) {
      if (timeData[i] <= targetTime) prevIndex = i;
    }
    return (currentVal || 0) - (arr[prevIndex] || 0);
  }
  const diffWest   = computeDiff(globalOccupancies.westOcc);
  const diffEast   = computeDiff(globalOccupancies.eastOcc);
  const diffCircle = computeDiff(globalOccupancies.circleOcc);

  function updateElement(id, value, diff) {
    let container = document.getElementById(id);
    if (!container) return;
    // 根据 id 判断采用不同的营业时间判断函数
    let isOpen;
    if (id.includes('west')) {
      isOpen = isOpenWest(currentTime);
    } else if (id.includes('east')) {
      isOpen = isOpenEast(currentTime);
    } else {
      isOpen = isOpenCircle(currentTime);
    }
    let labelColor = isOpen ? "#00ffc4" : "#767676";
    container.style.boxShadow = isOpen ? "" : "none";
    let badgeHTML = isOpen
        ? `<span class="realtime-status-badge realtime-open">OPEN</span>`
        : `<span class="realtime-status-badge realtime-closed">CLOSED</span>`;
    let displayHTML = isOpen
        ? `<span class="realtime-label" style="color:${labelColor}">${id.split('-')[1]}${badgeHTML}</span><br>
         <span class="realtime-count">${value || 0}${diff > 0 ? `<span class="realtime-indicator-up">▲${diff}</span>` : diff < 0 ? `<span class="realtime-indicator-down">▼${Math.abs(diff)}</span>` : `<span class="realtime-indicator-none">┉</span>`}</span>`
        : `<span class="realtime-label" style="color:${labelColor}">${id.split('-')[1]}</span><br>
         <span class="realtime-count closed_word">CLOSED</span>`;
    container.innerHTML = displayHTML;
  }
  updateElement("realtime-west", globalOccupancies.westOcc[currentIndex], diffWest);
  updateElement("realtime-east", globalOccupancies.eastOcc[currentIndex], diffEast);
  updateElement("realtime-circle", globalOccupancies.circleOcc[currentIndex], diffCircle);
}

/**
 * 用 ECharts 进行可视化
 */
function renderChart(xAxis, wData, eData, cData) {
  if (!xAxis.length) {
    document.getElementById("chart").innerHTML = "<p style='color:red;'>No data to display.</p>";
    return;
  }
  let chartDom = document.getElementById('chart');
  chartDom.innerHTML = '';
  let myChart = echarts.init(chartDom);
  const now = formatTime(new Date());
  if (!xAxis.includes(now)) xAxis.push(now);
  const showTimes = ['06:00','09:00','12:00','15:00','18:00','21:00', '22:00', '23:00'];
  // const showTimes = [];
  let option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['West', 'East', 'Circle'] },
    xAxis: {
      type: 'category',
      data: xAxis,
      axisLabel: {
        // interval: 1,
        rotate: 45,
        formatter: function(value) { return showTimes.includes(value) ? value : ''; }
      }
    },
    yAxis: { type: 'value' },
    grid: { top: '12%', left: '10%', right: '10%', bottom: '12%' },
    series: [
      { name: 'West', type: 'line', smooth: true, data: wData, itemStyle: { color: '#F2A2A2' }, lineStyle: { color: '#F2A2A2' } },
      { name: 'East', type: 'line', smooth: true, data: eData, itemStyle: { color: '#C5AAFF' }, lineStyle: { color: '#C5AAFF' } },
      { name: 'Circle', type: 'line', smooth: true, data: cData, itemStyle: { color: '#B5E8BC' }, lineStyle: { color: '#B5E8BC' },
        markLine: {
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#f68181' },
          data: [{ xAxis: now }]
        }
      }
    ]
  };
  myChart.setOption(option);
}

// 页面加载后立即执行数据加载
window.addEventListener('DOMContentLoaded', loadData);



// ── 弹窗与图表的逻辑（合并事件绑定） ─────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById("toggle-hours-btn");
  const hoursPopup = document.getElementById("hours-popup");
  const closeBtn = document.getElementById("close-hours-btn");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const springChartDiv = document.getElementById("spring-chart");
  const normalChartDiv = document.getElementById("normal-chart");

  // 切换 Tab 按钮事件
  tabBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      // 清除所有 tab 的 active 状态
      tabBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const target = this.getAttribute("data-target");
      if (target === "spring-chart") {
        springChartDiv.style.display = "block";
        normalChartDiv.style.display = "none";
        renderSpringChart();
      } else {
        springChartDiv.style.display = "none";
        normalChartDiv.style.display = "block";
        renderNormalChart();
      }
    });
  });

  // 点击弹出按钮，显示弹窗并默认显示春假营业时间图表
  toggleBtn.addEventListener("click", function () {
    hoursPopup.style.display = "block";
    springChartDiv.style.display = "block";
    normalChartDiv.style.display = "none";
    // 设置默认 Tab 样式
    document.querySelector('.tab-btn[data-target="spring-chart"]').classList.add("active");
    document.querySelector('.tab-btn[data-target="normal-chart"]').classList.remove("active");
    renderSpringChart();
  });

  // 点击关闭按钮，隐藏弹窗
  closeBtn.addEventListener("click", function () {
    hoursPopup.style.display = "none";
  });
});


// 构造正常营业时间数据（以一周 Monday～Sunday 顺序）
function getNormalHours(facility, day) {
  // day 为 Monday, Tuesday, …, Sunday
  if (facility === "west" || facility === "east") {
    switch(day) {
      case "Monday":
      case "Tuesday":
      case "Wednesday":
      case "Thursday":
      case "Friday":
        return [6, 23];
      case "Saturday":
        return [10, 21];
      case "Sunday":
        return [10, 22];
    }
  } else if (facility === "circle") {
    switch(day) {
      case "Monday":
      case "Tuesday":
      case "Wednesday":
      case "Thursday":
        return [9.5, 22]; // 09:30 -> 9.5
      case "Friday":
        return [9.5, 20];
      case "Saturday":
      case "Sunday":
        return [12, 17];
    }
  }
  return null;
}

// 固定横轴显示的时间标签（格式为 "HH:MM"），按升序排列
const fixedTimes = ["06:00", "10:00", "12:00", "17:00", "20:00", "21:00", "22:00", "23:00"];

const normalDays = ["Sun", "Mon", "Tues", "Wed", "Thur", "Fri", "Sat"];


// ──────────────────────────────────────────────
// 修改后的正常营业时间图表渲染
function renderNormalChart() {
  let chartDom = document.getElementById("normal-chart");
  let myChart = echarts.init(chartDom);
  // 正常营业图表按 Monday～Sunday 顺序显示
  const normalDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // 定义各设施及对应颜色与微调 offset
  const facilities = [
    { name: "West", key: "west", color: "#F2A2A2", offset: -0.2 },
    { name: "East", key: "east", color: "#C5AAFF", offset: 0 },
    { name: "Circle", key: "circle", color: "#B5E8BC", offset: 0.2 }
  ];

  let series = facilities.map(fac => {
    let data = normalDays.map((day, index) => {
      let hrs = getNormalHours(fac.key, day);
      return hrs ? [index + fac.offset, hrs[0], hrs[1]] : null;
    }).filter(d => d !== null);

    return {
      name: fac.name,
      type: "custom",
      renderItem: function (params, api) {
        let yPos = api.value(0);
        let start = api.coord([api.value(1), yPos]);
        let end = api.coord([api.value(2), yPos]);
        return {
          type: "line",
          shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] },
          style: { stroke: fac.color, lineWidth: 6 }
        };
      },
      encode: { x: [1, 2], y: 0 },
      data: data
    };
  });

  let option = {
    tooltip: { trigger: "item" },
    grid: { containLabel: true, // 避免文字被遮挡
      left: '5%', right: '5%', top: '5%', bottom: '1%' },
    xAxis: {
      type: "value",
      min: 6,
      max: 23,
      axisLine: { show: false },
      interval: 1,
      axisLabel: {
        rotate: 45,
        formatter: function(value) {
          let h = Math.floor(value);
          let m = Math.round((value - h) * 60);
          let label = (h < 10 ? "0" + h : h) + ":" + (m === 0 ? "00" : (m < 10 ? "0" + m : m));
          return fixedTimes.includes(label) ? label : "";
        }
      }
    },
    yAxis: {
      type: "value",
      min: -0.5,
      max: normalDays.length - 0.5,
      splitNumber: normalDays.length,
      axisLabel: {
        formatter: function(value) {
          if (Math.abs(value - Math.round(value)) < 0.001) {
            return normalDays[Math.round(value)] || "";
          }
          return "";
        }
      },
      splitLine: { show: false },
      axisTick: { show: true }
    },
    legend: { data: facilities.map(f => f.name) },
    color: facilities.map(f => f.color),
    series: series
  };

  myChart.setOption(option);
}


// ── 辅助函数 ─────────────────────────────

// 将时间字符串转换为小时（小数）
// 例如 "09:00:00" -> 9.0, "11:59:00" -> 11.9833（11 + 59/60）
function parseTimeToHour(timeStr) {
  let parts = timeStr.split(":").map(Number);
  if (parts.length < 2) return null;
  let h = parts[0],
      m = parts[1] || 0,
      s = parts[2] || 0;
  return h + m/60 + s/3600;
}

// 定义星期数组，采用 Monday=0,...,Sunday=6
const weekDays = ["Mon", "Tues", "Wed", "Thur", "Fri", "Sat", "Sun"];

// 计算一个 Date 对象对应的“工作制”星期索引：使 Monday 为 0, …, Sunday 为 6
function getWeekIndex(dateObj) {
  return (dateObj.getDay() + 6) % 7;
}

// ── 解析 SPRING_BREAK_SCHEDULES 的函数 ─────────────────────────────

/**
 * 根据 SPRING_BREAK_SCHEDULES 配置解析指定 facility 在指定 day（例如 "Monday"）的营业时间。
 * 如果配置中标记 closed，则返回 null；否则返回 [openHour, closeHour]（均为小数形式）。
 */
function getSpringHours(facility, day) {
  let requestedIndex = weekDays.indexOf(day);
  let schedules = SPRING_BREAK_SCHEDULES[facility];
  if (!schedules) return null;

  for (let schedule of schedules) {
    if (schedule.date) {
      // 单日配置
      let d = new Date(schedule.date + "T00:00:00");
      if (getWeekIndex(d) === requestedIndex) {
        if (schedule.closed) return null;
        return [ parseTimeToHour(schedule.start), parseTimeToHour(schedule.end) ];
      }
    } else if (schedule.startDate && schedule.endDate) {
      // 区间配置
      let s = new Date(schedule.startDate + "T00:00:00");
      let e = new Date(schedule.endDate + "T23:59:59");
      let startWeek = getWeekIndex(s);
      let endWeek = getWeekIndex(e);
      // 假定配置在同一周内（例如 Monday～Friday 或 Saturday～Sunday）
      if (requestedIndex >= startWeek && requestedIndex <= endWeek) {
        if (schedule.closed) return null;
        return [ parseTimeToHour(schedule.start), parseTimeToHour(schedule.end) ];
      }
    }
  }
  return null;
}

/**
 * 获取代表性日期，用于构造纵轴标签。
 * 对于 facility（例如 "west"），遍历 SPRING_BREAK_SCHEDULES[facility]，
 * 如果存在 startDate/endDate 区间且请求的 weekday（如 "Monday"）落在该区间内，
 * 则返回：new Date(startDate + offset)，其中 offset = requestedIndex - getWeekIndex(startDate)。
 * 如果配置中采用单日配置，则直接返回该日期。
 */
function getRepresentativeDate(facility, day) {
  let requestedIndex = weekDays.indexOf(day);
  let schedules = SPRING_BREAK_SCHEDULES[facility];
  if (!schedules) return null;

  for (let schedule of schedules) {
    if (schedule.date) {
      let d = new Date(schedule.date + "T00:00:00");
      if (getWeekIndex(d) === requestedIndex) {
        return d;
      }
    } else if (schedule.startDate && schedule.endDate) {
      let s = new Date(schedule.startDate + "T00:00:00");
      let e = new Date(schedule.endDate + "T23:59:59");
      let startWeek = getWeekIndex(s);
      let endWeek = getWeekIndex(e);
      if (requestedIndex >= startWeek && requestedIndex <= endWeek) {
        let offset = requestedIndex - startWeek;
        return new Date(s.getTime() + offset * 86400000);
      }
    }
  }
  return null;
}

// 计算代表性日期标签，基于 SPRING_BREAK_SCHEDULES 配置（以 "west" 为参考）
function getRepresentativeLabels() {
  const labels = [];
  // 对于 Monday～Sunday（下标 0～6）
  for (let i = 0; i < weekDays.length; i++) {
    let day = weekDays[i];
    let repDate = getRepresentativeDate("west", day);
    if (repDate) {
      let m = (repDate.getMonth() + 1).toString().padStart(2, '0');
      let d = repDate.getDate().toString().padStart(2, '0');
      labels.push(`${m}-${d} ${day}`);
    } else {
      labels.push(day);
    }
  }
  return labels;
}

// 定义春假图表专用的固定横轴时间刻度（按升序排列）
const springFixedTimes = ["06:00", "07:00", "09:00", "10:00", "12:00", "14:00", "16:30", "17:00", "18:00", "19:00", "20:00"];

// ──────────────────────────────────────────────
// 新增辅助函数：针对春/秋假，根据日期返回营业时段
function getSpringHoursForDate(facility, dateObj) {
  const schedules = SPRING_BREAK_SCHEDULES[facility];
  if (!schedules) return null;
  const yyyy = dateObj.getFullYear();
  const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const dd = dateObj.getDate().toString().padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  for (let schedule of schedules) {
    if (schedule.date) {
      if (schedule.date === dateStr) {
        if (schedule.closed) return null;
        return [parseTimeToHour(schedule.start), parseTimeToHour(schedule.end)];
      }
    } else if (schedule.startDate && schedule.endDate) {
      if (dateStr >= schedule.startDate && dateStr <= schedule.endDate) {
        if (schedule.closed) return null;
        return [parseTimeToHour(schedule.start), parseTimeToHour(schedule.end)];
      }
    }
  }
  return null;
}

// 新增辅助函数：提取指定设施所有春/秋假日期（以“west”为参考）
function getAllSpringDates(facility) {
  const schedules = SPRING_BREAK_SCHEDULES[facility];
  let dateSet = new Set();
  for (let schedule of schedules) {
    if (schedule.date) {
      dateSet.add(schedule.date);
    } else if (schedule.startDate && schedule.endDate) {
      let start = new Date(schedule.startDate + "T00:00:00");
      let end = new Date(schedule.endDate + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear();
        const mm = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd = d.getDate().toString().padStart(2, "0");
        dateSet.add(`${yyyy}-${mm}-${dd}`);
      }
    }
  }
  // 转换为数组并排序（按日期升序）
  let dates = Array.from(dateSet).sort();
  // 构造标签：格式 "MM-DD Weekday"
  return dates.map(dstr => {
    let d = new Date(dstr + "T00:00:00");
    let m = (d.getMonth() + 1).toString().padStart(2, "0");
    let dd = d.getDate().toString().padStart(2, "0");
    // 使用 getWeekIndex 函数转换为 Monday～Sunday 的索引，再映射到 weekDays 数组
    let dayName = weekDays[getWeekIndex(d)];
    return { dateStr: dstr, label: `${m}-${dd} ${dayName}`, dateObj: new Date(d) };
  });
}

// ──────────────────────────────────────────────
// 修改后的春/秋假营业时间图表渲染（弹出窗口内）
function renderSpringChart() {
  let chartDom = document.getElementById("spring-chart");
  let myChart = echarts.init(chartDom);

  // 自动从 SPRING_BREAK_SCHEDULES（以 "west" 为参考）中提取所有日期
  let dateItems = getAllSpringDates("west");
  // 构造纵轴标签，格式 "MM-DD Weekday"
  let yLabels = dateItems.map(item => item.label);

  // 定义各设施对应的颜色及微调 offset（使同一天内三条线分离）
  const facilities = [
    { name: "West", key: "west", color: "#F2A2A2", offset: -0.2 },
    { name: "East", key: "east", color: "#C5AAFF", offset: 0 },
    { name: "Circle", key: "circle", color: "#B5E8BC", offset: 0.2 }
  ];

  // 构造系列数据：遍历所有日期，使用 getSpringHoursForDate 自动解析营业时段
  let series = facilities.map(fac => {
    let data = dateItems.map((item, index) => {
      let hrs = getSpringHoursForDate(fac.key, item.dateObj);
      return hrs ? [index + fac.offset, hrs[0], hrs[1]] : null;
    }).filter(d => d !== null);
    return {
      name: fac.name,
      type: "custom",
      renderItem: function (params, api) {
        let yPos = api.value(0);
        let start = api.coord([api.value(1), yPos]);
        let end = api.coord([api.value(2), yPos]);
        return {
          type: "line",
          shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] },
          style: { stroke: fac.color, lineWidth: 6 } // 线宽可在此调整
        };
      },
      encode: { x: [1, 2], y: 0 },
      data: data
    };
  });

  // 固定横轴时间标签
  const springFixedTimes = ["06:00", "07:00", "09:00", "10:00", "12:00", "14:00", "16:30", "17:00", "18:00", "19:00", "20:00"];

  let option = {
    tooltip: { trigger: "item" },
    grid: {
      containLabel: true, // 避免文字被遮挡
      left: '5%', right: '5%', top: '5%', bottom: '1%' },
    xAxis: {
      type: "value",
      min: 6,
      max: 20,
      interval: 1,
      axisLine: { show: false },
      axisLabel: {
        rotate: 45,
        formatter: function(value) {
          let h = Math.floor(value);
          let m = Math.round((value - h) * 60);
          let label = (h < 10 ? "0" + h : h) + ":" + (m === 0 ? "00" : (m < 10 ? "0" + m : m));
          return springFixedTimes.includes(label) ? label : "";
        }
      }
    },
    yAxis: {
      type: "value",
      min: -0.5,
      max: yLabels.length - 0.5,
      splitNumber: yLabels.length,
      axisLabel: {
        formatter: function(value) {
          if (Math.abs(value - Math.round(value)) < 0.001) {
            return yLabels[Math.round(value)] || "";
          }
          return "";
        }
      },
      splitLine: { show: false },
      axisTick: { show: true }
    },
    legend: { data: facilities.map(f => f.name) },
    color: facilities.map(f => f.color),
    series: series
  };

  myChart.setOption(option);
}


/* =====================
   以下为烟花动画效果代码
   （原代码中，每隔100ms添加一个烟花，并通过 requestAnimationFrame 进行动画更新）
=====================*/

// 获取 canvas 元素及上下文
const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');

// 设置 canvas 尺寸
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let fireworks = [];

// 烟花类
class Firework {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = canvas.height;
    this.radius = 1;
    this.speed = 8;
    this.color = 'white';
    this.exploded = false;
    this.particles = [];
    this.explosionHeight = Math.random() * (canvas.height * 0.3) + (canvas.height * 0.05);
    this.initialAlpha = 1;
    this.currentAlpha = this.initialAlpha;
  }
  update() {
    if (!this.exploded) {
      this.y -= this.speed;
      this.currentAlpha -= 0.005;
      if (this.currentAlpha < 0) this.currentAlpha = 0;
      if (this.y <= this.explosionHeight) this.explode();
    } else {
      this.particles.forEach((particle, index) => {
        particle.update();
        if (particle.alpha <= 0) {
          this.particles.splice(index, 1);
        }
      });
    }
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.currentAlpha;
    ctx.fill();
    ctx.closePath();
    if (this.exploded) {
      this.particles.forEach(particle => particle.draw());
    }
  }
  explode() {
    this.exploded = true;
    for (let i = 0; i < 100; i++) {
      this.particles.push(new Particle(this.x, this.y));
    }
  }
}

// 粒子类
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 2;
    this.speedX = Math.random() * 5 - 2;
    this.speedY = Math.random() * 5 - 2;
    this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    this.alpha = 1.5;
    this.fade = Math.random() * 0.05 + 0.01;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.alpha -= this.fade;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.fill();
    ctx.closePath();
  }
}

// 动画函数
function animateFireworks() {
  // 使用半透明背景覆盖整个画布，实现拖影效果
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = prevComposite;

  fireworks.forEach((firework, index) => {
    firework.update();
    firework.draw();
    if (firework.exploded && firework.particles.length === 0) {
      fireworks.splice(index, 1);
    }
  });
  requestAnimationFrame(animateFireworks);
}

// 初始化烟花：每隔100ms添加一个烟花
function initFireworks() {
  setInterval(() => {
    fireworks.push(new Firework());
  }, 226 + 100);
  animateFireworks();
}
(function() {
  const now = getCurrentTime()
  if (now.getMonth() === 1 && now.getDate() === 26) {
    // 只有在2月26日才启动烟花效果
    initFireworks();
  } else {
    // 非2月26日时可以隐藏 canvas
    const canvas = document.getElementById('fireworksCanvas');
    if (canvas) canvas.style.display = 'none';
  }
})();

