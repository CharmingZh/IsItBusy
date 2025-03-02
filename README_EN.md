# 🏋️‍♂️ MSU Sweat Scheduler 🌊

<div style="display: flex; justify-content: space-between; align-items: center;">
   <img src="docs/output_images/09_integration_by_year_2025.png" alt="Image 1" style="width: 73%; margin-right: 0%;"> 
   <img src="docs/pic/demo.png" alt="Image 2" style="width: 22%; margin-right: 0%;">
</div>

<center>Visualization of 2025 Data and Runtime Demo.</center>

This project collects real-time incremental data of gym occupancy at MSU from the server (time granularity: 5 minutes, too frequent may overload Aliyun). Based on this data, we predict the real-time number of people in the gym. For modeling the decay in gym occupancy, we assume individual workout durations follow a normal distribution.

Specifically, we refer to the **"Statistical Analysis of Gym Training Duration for U.S. Adults"**, and fit a probability density function (PDF) accordingly to improve prediction accuracy ([Reference](https://charmingzh.github.io/IsItBusy/about.html)).

---

## 📌 Table of Contents
- [1. How to Use](#1-how-to-use)
- [2. Statistical Analysis of Gym Workout Durations in the U.S.](#2-statistical-analysis-of-gym-workout-durations-in-the-us)
- [3. Most Popular Gym Workout Hours in the U.S.](#3-most-popular-gym-workout-hours-in-the-us)
- [4. Real-Time Gym Crowd Forecast for MSU](#4-real-time-gym-crowd-forecast-for-msu)
- [☕ Buy Me a Coffee](#-buy-me-a-coffee)
- [📚 References](#references)

---

# 1. How to Use

1. First, open the application in your browser ([🌧Sweat Scheduler | MSU 健身房人浪预报🌊](https://charmingzh.github.io/IsItBusy/)).  
2. Then, follow the steps below to add it to your home screen for quick access.

<div style="display: flex; justify-content: space-between; align-items: center;">
  <img src="docs/pic/1.jpg" alt="Step 1" style="width: 32%; margin-right: 1%;">
  <img src="docs/pic/2.jpg" alt="Step 2" style="width: 32%; margin-right: 1%;">
  <img src="docs/pic/3.jpg" alt="Step 3" style="width: 32%;">
</div>

<div style="text-align: center;">
(Best experienced on mobile devices.)
</div>

---

# 2. Statistical Analysis of Gym Workout Durations in the U.S.

> According to **Statista (2021)<sup>[1]</sup>**:
>
> - Young adults aged **18-34** (31%) and adults aged **35-54** (31%) make up the largest gym-goer population.
> - On average, women spend **0.3 hours** per day on physical activities, while men spend **0.44 hours**.
>
> - **21%** of gym-goers train for **0.5 ~ 1 hour** per session.
> - **35%** train for **1 ~ 2 hours** per session.

<div style="text-align: center;">
<img src="docs/pic/normal_distribution.png" alt="Normal Distribution of Workout Duration" style="width:100%;" />
</div>

<center><sup>[2]</sup> Visualization of the most favorite workout duration.</center>

Through numerical analysis, we estimate the normal distribution parameters as:  
$N(\mu=1, \sigma=0.92^2)$

Based on this model:
- $P(0.5 \le X \le 1) \approx 20.7\%$ (slightly lower than 21%).
- $P(1 \le X \le 2) \approx 36.1\%$ (slightly higher than 35%).

Considering the continuity and symmetry of the normal distribution, our estimation closely approximates the actual data proportions.

---

# 3. Most Popular Gym Workout Hours in the U.S.

> According to **Statista (2021)<sup>[1]</sup>**, the most popular gym hours are **5 AM - 9 AM**, when 38% of gym members work out.
>
> - **29%** prefer the **9 AM - noon** period.
> - **25%** go between **noon - 2 PM**.
> - **20%** train from **2 PM - 5 PM**.
> - **25%** visit the gym during **5 PM - 8 PM**.
> - **16%** train between **8 PM - 11 PM**.

<div style="text-align: center;">
<img src="docs/pic/workout_time_intervals.png" alt="Favorite Gym Workout Time" style="width:100%;" />
</div>

<center><sup>[3]</sup> Visualization of the most favorite workout hours.</center>

---

# 4. Real-Time Gym Crowd Forecast for MSU

## 4.1 Weekly Gym Occupancy by Year

<div style="display: flex; justify-content: space-between; align-items: center;">
  <img src="docs/output_images/09_integration_by_year_2024.png" alt="2024 Data" style="width: 49%; margin-right: 1%;">
  <img src="docs/output_images/09_integration_by_year_2025.png" alt="2025 Data" style="width: 49%; margin-right: 1%;">
</div>

## 4.2 Real-Time Gym Crowd Distribution on Specific Days

<div style="display: flex; justify-content: space-between; align-items: center;">
  <img src="docs/output_images/10_mondays_by_year.png" alt="Mondays" style="width: 49%; margin-right: 1%;">
  <img src="docs/output_images/11_tuesdays_by_year.png" alt="Tuesdays" style="width: 49%; margin-right: 1%;">
</div>

<div style="display: flex; justify-content: space-between; align-items: center;">
  <img src="docs/output_images/12_wednesdays_by_year.png" alt="Wednesdays" style="width: 49%; margin-right: 1%;">
  <img src="docs/output_images/13_thursdays_by_year.png" alt="Thursdays" style="width: 49%; margin-right: 1%;">
</div>

---

## ✅ TODO List

- [x] Real-time data collection and deployment on Aliyun 🎉 (2025-02-20 Feasibility Verified)
- [x] `index.html`, `about.html` pages launched 🎉 (2025-02-22)
- [x] Data storage separation, preventing GitHub Action overload!
- [x] Opening and closing hours visualization 🈺
- [x] Improved interval segmentation 🎉 (2025-02-24)
- [x] Multi-device responsive layout for an optimal user experience
- [x] Spring/Fall holiday and normal hours pop-up visualization ✅ (2025-03-01)
- [ ] More improvements...

---

## ☕ Buy Me a Coffee

If this project helps you, consider buying me a coffee! ☕😊  
Your support keeps this project going! ❤️

<div style="text-align: center;">
<img src="docs/pic/img.png" alt="微信收款码" style="width:50%;" />
</div>

**Scan the WeChat QR Code to support me! 🙏**

---

## 📚 References

- [Website] **101 Gym Membership Statistics to Know** [Ref$^{[1]}$](https://gymdesk.com/blog/gym-membership-statistics/)
- [Source Code] **Normal Distribution of Training Duration** [Ref$^{[2]}$](https://github.com/CharmingZh/IsItBusy/blob/master/analysis/normal_distribution.py)
- [Source Code] **Most Popular Workout Time Visualization** [Ref$^{[3]}$](https://github.com/CharmingZh/IsItBusy/blob/master/analysis/workout_time.py)
