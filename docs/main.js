// 固定随机种子，确保快速刷新时随机数序列一致
Math.seedrandom('fixed-seed');

// 自定义时间格式化函数，格式化为 "HH:mm"
function formatTime(date) {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// 生成正态随机数 (Box-Muller)
function randNormal(mean, stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

// 将 CSV 中的日期映射到今天（只保留时分秒）
function fixDateToToday(dateStr) {
  let parts = dateStr.split(/\s+/);
  if (parts.length < 2) return null;
  let [yyyy_mm_dd, hhmmss] = parts;
  let [hh, mm, ss] = hhmmss.split(":").map(Number);
  let now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss);
}

// SG 平滑函数：使用给定卷积核对数据进行平滑处理
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

// 全局变量保存实时人数数据，用于更新液晶显示
let globalOccupancies = {
  timeData: [],
  westOcc: [],
  eastOcc: [],
  circleOcc: []
};

// 主流程：读取 CSV -> 解析 -> 处理 -> 可视化
async function loadData() {
  try {
    const response = await fetch("https://raw.githubusercontent.com/CharmingZh/gym_data_repo/refs/heads/main/data/today_data.csv");
    if (!response.ok) {
      throw new Error("Failed to fetch CSV: " + response.statusText);
    }
    const text = await response.text();
    processCSV(text);
  } catch (err) {
    console.error("Error fetching data:", err);
    document.getElementById("chart").innerHTML =
      "<p style='color: red;'>Failed to load data.</p>";
  }
}

// 处理 CSV 文本
function processCSV(csvText) {
  const MEAN_HOURS = 1.00;
  const STD_HOURS  = 0.4;
  let lines = csvText.trim().split("\n");
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

  if (!rawData.length) {
    document.getElementById("chart").innerHTML =
      "<p style='color:red;'>No valid data available.</p>";
    return;
  }

  // 按时间升序排列
  rawData.sort((a, b) => a.time - b.time);

  // 只保留 6:00 ~ 23:00 的数据
  let dataPoints = rawData.filter(dp => {
    let h = dp.time.getHours();
    return h >= 6 && h <= 23;
  });
  if (!dataPoints.length) {
    document.getElementById("chart").innerHTML =
      "<p style='color:red;'>No data in 6:00-23:00.</p>";
    return;
  }

  // 用于可视化的时间轴和在场人数数据
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
    if (!prev) {
      prev = dp;
    }
    // 移除已离场人员（衰减）
    peopleWest   = peopleWest.filter(p => p.exitTime > currTime);
    peopleEast   = peopleEast.filter(p => p.exitTime > currTime);
    peopleCircle = peopleCircle.filter(p => p.exitTime > currTime);

    // 计算新进场人数（增量）
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

  // 保存全局数据用于实时显示
  globalOccupancies.timeData = timeData;
  globalOccupancies.westOcc = westOcc;
  globalOccupancies.eastOcc = eastOcc;
  globalOccupancies.circleOcc = circleOcc;

  // 更新液晶显示
  updateRealtimeDisplay();

  // 固定卷积核：窗口长度 7，三次多项式拟合
  const sgKernel = [-2, 3, 6, 7, 6, 3, -2].map(x => x / 21);
  const smoothWestOcc   = sgSmooth(westOcc,   sgKernel).map(v => Math.max(0, Math.floor(v)));
  const smoothEastOcc   = sgSmooth(eastOcc,   sgKernel).map(v => Math.max(0, Math.floor(v)));
  const smoothCircleOcc = sgSmooth(circleOcc, sgKernel).map(v => Math.max(0, Math.floor(v)));

  renderChart(xAxis, smoothWestOcc, smoothEastOcc, smoothCircleOcc);
}

// 更新实时显示：分别计算 West, East, Circle 与15分钟前的差异
function updateRealtimeDisplay() {
  const timeData = globalOccupancies.timeData;
  if (!timeData.length) return;
  const currentIndex = timeData.length - 1;
  const currentTime = timeData[currentIndex];

  function computeDiff(arr) {
    const currentVal = arr[currentIndex];
    const targetTime = new Date(currentTime.getTime() - 15 * 60000);
    let prevIndex = 0;
    for (let i = 0; i < timeData.length; i++) {
      if (timeData[i] <= targetTime) {
        prevIndex = i;
      }
    }
    const prevVal = arr[prevIndex];
    return currentVal - prevVal;
  }
  const diffWest = computeDiff(globalOccupancies.westOcc);
  const diffEast = computeDiff(globalOccupancies.eastOcc);
  const diffCircle = computeDiff(globalOccupancies.circleOcc);

  function updateElement(id, value, diff) {
    let trendHTML = "";
    if (diff > 0) {
      trendHTML = `<span style="color: #32CD32;">▲ ${diff}</span>`;
    } else if (diff < 0) {
      trendHTML = `<span style="color: #d9534f;">▼ ${Math.abs(diff)}</span>`;
    } else {
      trendHTML = `<span>—</span>`;
    }
    document.getElementById(id).innerHTML =
      `<span class="realtime-label">${id.split('-')[1]}</span><br>
       <span class="realtime-count">${value}</span> ${trendHTML}`;
  }
  updateElement("realtime-west", globalOccupancies.westOcc[currentIndex], diffWest);
  updateElement("realtime-east", globalOccupancies.eastOcc[currentIndex], diffEast);
  updateElement("realtime-circle", globalOccupancies.circleOcc[currentIndex], diffCircle);
}

// 用 ECharts 进行可视化
function renderChart(xAxis, wData, eData, cData) {
  if (!xAxis.length) {
    document.getElementById("chart").innerHTML =
      "<p style='color:red;'>No data to display.</p>";
    return;
  }
  let chartDom = document.getElementById('chart');
  chartDom.innerHTML = '';
  let myChart = echarts.init(chartDom);
  let option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['West', 'East', 'Circle']
    },
    xAxis: {
      type: 'category',
      data: xAxis,
      axisLabel: {
        rotate: 45,
        formatter: function(value) {
          const parts = value.split(":");
          return (parts.length === 2 && parts[1] === "00") ? value : "";
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
      { name: 'West',   type: 'line', smooth: true, data: wData },
      { name: 'East',   type: 'line', smooth: true, data: eData },
      { name: 'Circle', type: 'line', smooth: true, data: cData }
    ]
  };
  myChart.setOption(option);
}

// 页面加载后立即执行数据加载函数
loadData();
