/*********************************************
 * main.js
 * 集成营业时间可视化 + 原有功能优化
 *********************************************/

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
  let [_, hhmmss] = parts; // 只要时分秒部分
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
 * 判断 IM West/East 是否在给定时间营业
 *  - Mon-Fri: 6am - 11pm
 *  - Saturday: 10am - 9pm
 *  - Sunday: 10am - 10pm
 */
function isOpenWestEast(dateObj) {
  const day = dateObj.getDay();   // 0=Sun,1=Mon,...,6=Sat
  const hour = dateObj.getHours();

  // Sunday (day=0): 10:00 - 22:00
  if (day === 0) {
    return hour >= 10 && hour < 22;
  }
  // Saturday (day=6): 10:00 - 21:00
  if (day === 6) {
    return hour >= 10 && hour < 21;
  }
  // Mon-Fri (day=1..5): 6:00 - 23:00
  return hour >= 6 && hour < 23;
}

/**
 * 判断 IM Circle 是否在给定时间营业
 *  - Monday-Thursday: 7:00 - 10pm，但设备区 9:30am 才开 (你可以只从9:30算起)
 *  - Friday:          7:00 - 8pm，但设备区 9:30am 才开
 *  - Sat & Sun:       12pm - 5pm
 *
 * 如果你确实只想在 9:30 后才显示“OPEN”，可在 M-F 的判断中加分钟限制。
 */
function isOpenCircle(dateObj) {
  const day = dateObj.getDay();     // 0=Sun,6=Sat
  const hour = dateObj.getHours();  // 若要更精确到分钟，可再获取 dateObj.getMinutes()

  // Mon-Thu
  if (day >= 1 && day <= 4) {
    // 若想从 7:00 开门，但设备9:30才可用 → 这里到底从何时标记为 open？
    // 如果你要 9:30 以后才显示OPEN，就可改： if(hour < 9 || (hour === 9 && dateObj.getMinutes() < 30)) return false
    if (hour < 7) return false;
    if (hour >= 22) return false;
    return true;
  }

  // Friday
  if (day === 5) {
    // 7:00 - 20:00 (8pm)，同理看你要不要 9:30
    if (hour < 7) return false;
    if (hour >= 20) return false;
    return true;
  }

  // Sat & Sun
  if (day === 6 || day === 0) {
    // 12:00 - 17:00 (5pm)
    return hour >= 12 && hour < 17;
  }

  return false;
}


// 全局变量：保存实时人数数据 (时间序列)，用于更新液晶显示
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
    if (!response.ok) {
      throw new Error("Failed to fetch CSV: " + response.statusText);
    }
    const text = await response.text();
    processCSV(text);

    // 更新 "last-update" 显示
    const now = new Date();
    document.getElementById('last-update').innerText =
      formatTime(now); // 比如 "17:05"
  } catch (err) {
    console.error("Error fetching data:", err);
    document.getElementById("chart").innerHTML =
      "<p style='color: red;'>Failed to load data.</p>";
  }
}

/**
 * 解析并处理 CSV 文本
 */
function processCSV(csvText) {
  const MEAN_HOURS = 1.0;
  const STD_HOURS  = 0.4;
  let lines = csvText.trim().split("\n");

  // 解析每行，得到时间 + (west,east,circle)
  let rawData = lines.map(line => {
    let [timeStr, w, e, c] = line.split(/,\s*/);
    if (!timeStr || w === undefined || e === undefined || c === undefined) {
      return null;
    }
    let t = fixDateToToday(timeStr);
    if (!t || isNaN(t.getTime())) return null;
    return {
      time: t,
      west: Number(w),
      east: Number(e),
      circle: Number(c)
    };
  }).filter(Boolean);

  // 若无有效数据
  if (!rawData.length) {
    document.getElementById("chart").innerHTML =
      "<p style='color:red;'>No valid data available.</p>";
    return;
  }

  // 按时间升序
  rawData.sort((a, b) => a.time - b.time);

  // 只保留 6:00 ~ 23:00 的数据（如果你只想显示这一段）
  let dataPoints = rawData.filter(dp => {
    let h = dp.time.getHours();
    return h >= 6 && h <= 23;
  });
  if (!dataPoints.length) {
    document.getElementById("chart").innerHTML =
      "<p style='color:red;'>No data in 6:00-23:00.</p>";
    return;
  }

  // 用于构建在场人数的时间序列
  let xAxis = [];
  let timeData = [];
  let westOcc = [];
  let eastOcc = [];
  let circleOcc = [];

  // 用来跟踪“在场人员”的数组(随机生成离场时间)
  let peopleWest = [];
  let peopleEast = [];
  let peopleCircle = [];
  let prev = null;

  dataPoints.forEach(dp => {
    let currTime = dp.time;
    if (!prev) prev = dp; // 第一个点作为参照

    // 移除已离场人员
    peopleWest   = peopleWest.filter(p => p.exitTime > currTime);
    peopleEast   = peopleEast.filter(p => p.exitTime > currTime);
    peopleCircle = peopleCircle.filter(p => p.exitTime > currTime);

    // 计算新进场人数 = max(当前累积 - 前一时刻累积, 0)
    let dWest   = Math.max(dp.west   - prev.west,   0);
    let dEast   = Math.max(dp.east   - prev.east,   0);
    let dCircle = Math.max(dp.circle - prev.circle, 0);

    // 根据正态随机分布，给这些新进场的“离场时间”
    for (let i = 0; i < dWest; i++) {
      let duration = randNormal(MEAN_HOURS, STD_HOURS); // hour
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

    // 当前时刻对应的在场人数
    xAxis.push(formatTime(currTime));
    timeData.push(currTime);
    westOcc.push(peopleWest.length);
    eastOcc.push(peopleEast.length);
    circleOcc.push(peopleCircle.length);

    prev = dp;
  });

  // =========== 将结果存到全局对象，以更新实时显示等 ===========
  globalOccupancies.timeData  = timeData;
  globalOccupancies.westOcc   = westOcc;
  globalOccupancies.eastOcc   = eastOcc;
  globalOccupancies.circleOcc = circleOcc;

  // 更新顶部三个“液晶数值”的实时显示
  updateRealtimeDisplay();

  // =========== 在可视化前，根据营业时间设置“关门时段”数据为 null ===========
  for (let i = 0; i < timeData.length; i++) {
    let t = timeData[i];
    // West/East
    if (!isOpenWestEast(t)) {
      westOcc[i] = null;
      eastOcc[i] = null;
    }
    // Circle
    if (!isOpenCircle(t)) {
      circleOcc[i] = null;
    }
  }

  // =========== 进一步做 SG 平滑处理 ===========
  // 固定卷积核：窗口长度 7，三次多项式拟合
  const sgKernel = [-2, 3, 6, 7, 6, 3, -2].map(x => x / 21);
  const smoothWestOcc   = sgSmooth(westOcc,   sgKernel).map(v => Math.max(0, Math.floor(v || 0)));
  const smoothEastOcc   = sgSmooth(eastOcc,   sgKernel).map(v => Math.max(0, Math.floor(v || 0)));
  const smoothCircleOcc = sgSmooth(circleOcc, sgKernel).map(v => Math.max(0, Math.floor(v || 0)));

  // 绘图
  renderChart(xAxis, smoothWestOcc, smoothEastOcc, smoothCircleOcc);
}

/**
 * 更新实时显示：比较当前时刻人数 & 若干分钟前的差异
 */
function updateRealtimeDisplay() {
  const timeData = globalOccupancies.timeData;
  if (!timeData.length) return;

  const currentIndex = timeData.length - 1;
  // 当前时间点
  // const currentTime = timeData[currentIndex];
  const currentTime = new Date();  // 直接取系统时间

  // 计算与 5 分钟前的差值（你已有的逻辑）
  function computeDiff(arr) {
    const currentVal = arr[currentIndex];
    const targetTime = new Date(currentTime.getTime() - 5 * 60000);
    let prevIndex = 0;
    for (let i = 0; i < timeData.length; i++) {
      if (timeData[i] <= targetTime) {
        prevIndex = i;
      }
    }
    const prevVal = arr[prevIndex];
    return (currentVal || 0) - (prevVal || 0);
  }

  const diffWest   = computeDiff(globalOccupancies.westOcc);
  const diffEast   = computeDiff(globalOccupancies.eastOcc);
  const diffCircle = computeDiff(globalOccupancies.circleOcc);

  // 根据 ID 更新展示
  function updateElement(id, value, diff) {
    let container = document.getElementById(id);
    if (!container) return;

    // 1. 判断开放/关闭状态
    let isOpen = false;
    if (id.includes('west') || id.includes('east')) {
      // West or East
      isOpen = isOpenWestEast(currentTime);
    } else if (id.includes('circle')) {
      // Circle
      isOpen = isOpenCircle(currentTime);
    }

    // 2. 准备一个 badge
    let badgeHTML = '';
    if (isOpen) {
      badgeHTML = `<span class="realtime-status-badge realtime-open">OPEN</span>`;
    } else {
      badgeHTML = `<span class="realtime-status-badge realtime-closed">CLOSED</span>`;
    }

    // 3. 处理▲▼图标
    let trendHTML = '';
    if (diff > 0) {
      trendHTML = `<span class="realtime-indicator-up">▲${diff}</span>`;
    } else if (diff < 0) {
      trendHTML = `<span class="realtime-indicator-down">▼${Math.abs(diff)}</span>`;
    } else {
      trendHTML = `<span>-</span>`;
    }

    // 4. 把上述内容插到 .realtime-count 里
    container.innerHTML = `
      <span class="realtime-label">${id.split('-')[1]}${badgeHTML}</span><br>
      <span class="realtime-count">
        ${value || 0}${trendHTML}
      </span>
    `;
  }

  // 分别更新 West/East/Circle
  updateElement("realtime-west",   globalOccupancies.westOcc[currentIndex],   diffWest);
  updateElement("realtime-east",   globalOccupancies.eastOcc[currentIndex],   diffEast);
  updateElement("realtime-circle", globalOccupancies.circleOcc[currentIndex], diffCircle);
}


/**
 * 用 ECharts 进行可视化
 * 在同一个图表展示 West/East/Circle 三条线
 */
function renderChart(xAxis, wData, eData, cData) {
  if (!xAxis.length) {
    document.getElementById("chart").innerHTML =
      "<p style='color:red;'>No data to display.</p>";
    return;
  }
  let chartDom = document.getElementById('chart');
  chartDom.innerHTML = ''; // 清空再绘制
  let myChart = echarts.init(chartDom);

  // 当前时间（如 "17:02"）
  const now = formatTime(new Date());

  // 如果 xAxis 里还没有当前时间，则插入（可选）
  if (!xAxis.includes(now)) {
    xAxis.push(now);
    // 未必需要排序；若要严格按时间顺序，则需一起对 wData/eData/cData 插入点或重排
  }

  // 只显示部分标签
  const showTimes = ['06:00','09:00','12:00','15:00','18:00','21:00','22:00','23:00'];

  let option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['West', 'East', 'Circle']
    },
    xAxis: {
      type: 'category',
      data: xAxis,
      axisLabel: {
        fontSize: 10,  // 这里调整 X 轴刻度字体大小
        rotate: 30,
        formatter: function(value) {
          // 只在 showTimes 列表中才显示
          return showTimes.includes(value) ? value : '';
        }
      }
    },
    yAxis: { type: 'value' },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    series: [
      {
        name: 'West',
        type: 'line',
        smooth: true,
        data: wData,
        itemStyle: { color: '#F2A2A2' },    // 柔和粉
        lineStyle: { color: '#F2A2A2' }
      },
      {
        name: 'East',
        type: 'line',
        smooth: true,
        data: eData,
        itemStyle: { color: '#C5AAFF' },    // 淡紫
        lineStyle: { color: '#C5AAFF' }
      },
      {
        name: 'Circle',
        type: 'line',
        smooth: true,
        data: cData,
        itemStyle: { color: '#B5E8BC' },    // 浅绿
        lineStyle: { color: '#B5E8BC' },
        // 在最后一个系列中加垂直虚线 markLine
        markLine: {
          symbol: 'none',
          lineStyle: {
            type: 'dashed',
            color: '#f68181'
          },
          data: [
            { xAxis: now } // 用 xAxis 属性指定竖线的位置
          ]
        }
      }
    ]
  };

  myChart.setOption(option);
}



// 页面加载后立即执行
window.addEventListener('DOMContentLoaded', loadData);
