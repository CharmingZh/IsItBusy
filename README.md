
根据 **（Statista，2021）$^[1]$** 的数据显示：

18-34 岁的年轻人（31%）和 35-54 岁的成年人（31%）是健身房的最大客群。 
其中，女性平均每天花 0.3 小时进行体育、娱乐和锻炼，而男性平均每天花 0.44 小时。

> - 约 **21%** of gym-goers stay in the gym between half an hour and an hour each session.
> - 约 **35%** of gym-goers stay in the gym between an hour and two hours each session.

```python
from scipy.stats import norm

# 估算正态分布参数（假设符合正态分布）
mu = weighted_avg_time  # 均值使用加权平均
sigma = 0.4  # 设定一个合理的标准差（基于一般健身时长的变动范围）

# 生成x轴范围
x = np.linspace(0, 2.5, 1000)  # 运动时长范围 0 - 2.5 小时
pdf = norm.pdf(x, mu, sigma)  # 计算概率密度函数

# 绘制概率密度曲线
plt.figure(figsize=(8, 5))
plt.plot(x, pdf, label=f'Normal Distribution\nμ={round(mu, 2)}, σ={round(sigma, 2)}', color='blue')

# 标注实际数据点
plt.scatter(midpoints, probabilities, color='red', label="Observed Data", zorder=3)

# 添加均值线
plt.axvline(mu, color='red', linestyle='--', label=f"Mean: {round(mu, 2)}h")

plt.xlabel("Gym Session Duration (hours)")
plt.ylabel("Probability Density")
plt.title("Estimated Normal Distribution of Gym Session Duration")
plt.legend()
plt.grid()

# 显示图表
plt.show()

```

[//]: # (![img.png]&#40;img.png&#41;)

最受欢迎的健身时间是清晨 5 点至 9 点，38% 的健身房会员在这个时间段健身。

> - 约 **29%** of gym members attend in the late morning between 9 a.m. and noon.
> 
> - 约 **25%** of gym members attend during lunchtime between noon and 2 p.m.
> 
> - 约 **20%** of gym members attend in the afternoon between 2 p.m. and 5 p.m.
> 
> - 约 **25%** of gym members attend in the early evening between 5 p.m. and 8 p.m.
> 
> - 约 **16%** of gym members attend in the late evening between 8 p.m. and 11 p.m.

```python
# 统计数据（Statista 2021）
time_slots = ["9 AM - 12 PM", "12 PM - 2 PM", "2 PM - 5 PM", "5 PM - 8 PM", "8 PM - 11 PM"]
probabilities = [0.29, 0.25, 0.20, 0.25, 0.16]  # 各时间段的概率

# 估算正态分布参数（假设符合正态分布）
time_midpoints = [10.5, 13, 15.5, 18, 21]  # 取各时间段的中点（小时制）
mu_time = np.sum(np.array(probabilities) * np.array(time_midpoints)) / np.sum(probabilities)  # 加权均值
sigma_time = 2.5  # 设定一个合理的标准差

# 生成x轴范围
x_time = np.linspace(8, 23, 1000)  # 时间范围 8 AM - 11 PM
pdf_time = norm.pdf(x_time, mu_time, sigma_time)  # 计算概率密度函数

# 绘制概率密度曲线
plt.figure(figsize=(8, 5))
plt.plot(x_time, pdf_time, label=f'Normal Distribution\nμ={round(mu_time, 2)}h, σ={round(sigma_time, 2)}h', color='blue')

# 标注实际数据点
plt.scatter(time_midpoints, probabilities, color='red', label="Observed Data", zorder=3)

# 添加均值线
plt.axvline(mu_time, color='red', linestyle='--', label=f"Mean: {round(mu_time, 2)}h")

plt.xlabel("Time of Gym Attendance (Hour)")
plt.ylabel("Probability Density")
plt.title("Estimated Normal Distribution of Gym Attendance Time")
plt.legend()
plt.grid()

# 显示图表
plt.show()

```







### References

- [Ref$^{[1]}$](https://gymdesk.com/blog/gym-membership-statistics/)