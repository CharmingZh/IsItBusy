import numpy as np
import matplotlib.pyplot as plt
import scipy.stats as stats

# Based on the numerical solution result
mu = 1.0       # Mean: 1 hour
sigma = 0.92   # Standard deviation: approximately 0.92 hours

# Generate x-axis data
x = np.linspace(0, 4, 1000)
pdf = stats.norm.pdf(x, mu, sigma)

# Compute key quantiles
q25 = stats.norm.ppf(0.25, mu, sigma)   # 25th percentile
median = stats.norm.ppf(0.5, mu, sigma)   # Median
q75 = stats.norm.ppf(0.75, mu, sigma)     # 75th percentile
q95 = stats.norm.ppf(0.95, mu, sigma)     # 95th percentile

plt.figure(figsize=(8, 5))
plt.plot(x, pdf, label=f'N({mu:.2f}, {sigma:.2f}²)', color='black')

# Plot vertical dashed lines for the mean and quantiles
plt.axvline(mu, color='red', linestyle='--', label=f'Mean = {mu:.2f}h')
plt.axvline(q25, color='green', linestyle='--', label=f'25th Percentile = {q25:.2f}h')
plt.axvline(median, color='blue', linestyle='--', label=f'Median = {median:.2f}h')
plt.axvline(q75, color='purple', linestyle='--', label=f'75th Percentile = {q75:.2f}h')
plt.axvline(q95, color='orange', linestyle='--', label=f'95th Percentile = {q95:.2f}h')

# Highlight the target intervals
plt.fill_between(x, pdf, where=(x>=0.5) & (x<=1), color='yellow', alpha=0.3, label='Interval: 0.5-1h')
plt.fill_between(x, pdf, where=(x>=1) & (x<=2), color='cyan', alpha=0.3, label='Interval: 1-2h')

plt.title("Estimated Normal Distribution of Training Time")
plt.xlabel("Training Time (hours)")
plt.ylabel("Probability Density")
plt.legend()
plt.grid(True)
plt.savefig("normal_distribution.png")
plt.show()
