/*********************************************
 * main.js
 * 集成营业时间可视化 + 原有功能优化
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
 * 判断 IM West/East 是否在给定时间营业
 *  - Mon-Fri: 6am - 11pm
 *  - Saturday: 10am - 9pm
 *  - Sunday: 10am - 10pm
 */
function isOpenWestEast(dateObj) {
  const day = dateObj.getDay();
  const hour = dateObj.getHours();
  if (day === 0) return hour >= 10 && hour < 22;
  if (day === 6) return hour >= 10 && hour < 21;
  return hour >= 6 && hour < 23;
}

/**
 * 判断 IM Circle 是否在给定时间营业
 *  - Monday-Thursday: 7:00 - 10pm（设备区 9:30 才开）
 *  - Friday:          7:00 - 8pm（设备区 9:30 才开）
 *  - Sat & Sun:       12pm - 5pm
 */
function isOpenCircle(dateObj) {
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
    if (!isOpenWestEast(t)) { westOcc[i] = null; eastOcc[i] = null; }
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
    let isOpen = id.includes('west') || id.includes('east')
      ? isOpenWestEast(currentTime)
      : isOpenCircle(currentTime);
    let labelColor = isOpen ? "#00ffc4" : "#767676";
    container.style.boxShadow = isOpen ? "" : "none";
    let badgeHTML = isOpen
      ? `<span class="realtime-status-badge realtime-open">OPEN</span>`
      : `<span class="realtime-status-badge realtime-closed">CLOSED</span>`;
    let displayHTML = isOpen
      ? `<span class="realtime-label" style="color:${labelColor}">${id.split('-')[1]}${badgeHTML}</span><br>
         <span class="realtime-count">${value || 0}${diff > 0 ? `<span class="realtime-indicator-up">▲${diff}</span>` : diff < 0 ? `<span class="realtime-indicator-down">▼${Math.abs(diff)}</span>` : `<span class="realtime-indicator-none">┉</span>`}</span>`
      : `<span class="realtime-label" style="color:${labelColor}">${id.split('-')[1]}</span><br>
         <span class="realtime-count" style="color: red;">CLOSED</span>`;
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
  const showTimes = ['06:00','09:00','12:00','15:00','18:00','21:00','22:00','23:00'];
  let option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['West', 'East', 'Circle'] },
    xAxis: {
      type: 'category',
      data: xAxis,
      axisLabel: {
        rotate: 45,
        formatter: function(value) { return showTimes.includes(value) ? value : ''; }
      }
    },
    yAxis: { type: 'value' },
    grid: { left: '10%', right: '10%', bottom: '15%' },
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
// 保存当前的复合操作
const prevComposite = ctx.globalCompositeOperation;
// 使用 'destination-out' 模式，在目标像素中减去alpha值
ctx.globalCompositeOperation = 'destination-out';
// 使用较低的不透明度来擦除旧的图像
ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
ctx.fillRect(0, 0, canvas.width, canvas.height);
// 恢复原先的复合操作
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
  const now = new Date();
  if (now.getMonth() === 1 && now.getDate() === 26) {
    // 只有在2月26日才启动烟花效果
    initFireworks();
  } else {
    // 非2月26日时可以隐藏 canvas
    const canvas = document.getElementById('fireworksCanvas');
    if (canvas) canvas.style.display = 'none';
  }
})();

