import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import interp1d  # <-- Add this line
import scipy.stats as stats
import matplotlib.patches as patches

# Define the intervals along with the attendance percentages and corresponding colors.
# Each tuple contains: (start_time, end_time, attendance_fraction, label, color)
intervals = [
    (5, 9, 0.38, "5-9 AM (38%)", "lightblue"),
    (9, 12, 0.29, "9-12 AM (29%)", "lightgreen"),
    (12, 14, 0.25, "12-2 PM (25%)", "lightcoral"),
    (14, 17, 0.20, "2-5 PM (20%)", "plum"),
    (17, 20, 0.25, "5-8 PM (25%)", "khaki"),
    (20, 23, 0.16, "8-11 PM (16%)", "lightsalmon")
]

# Compute midpoints for interpolation.
time_midpoints = np.array([ (start + end) / 2 for start, end, att, lab, col in intervals ])
attendance = np.array([ att for start, end, att, lab, col in intervals ])

# Create a cubic interpolation function based on the data points.
interp_func = interp1d(time_midpoints, attendance, kind='cubic')

# Generate a dense array for the time axis for smooth curve plotting.
time_dense = np.linspace(time_midpoints.min(), time_midpoints.max(), 300)
attendance_dense = interp_func(time_dense)

# Set up the plot.
plt.figure(figsize=(12, 6))
ax = plt.gca()

# Plot the interpolated curve and original data points.
plt.plot(time_dense, attendance_dense, label='Cubic Spline Interpolation', color='blue')
plt.scatter(time_midpoints, attendance, color='red', label='Data Points', zorder=5)

# Draw a rectangle for each time interval, with height proportional to attendance.
for start, end, att, label, color in intervals:
    width = end - start
    rect = patches.Rectangle((start, 0), width, att, facecolor=color, alpha=0.3, label=label)
    ax.add_patch(rect)

plt.title("Interpolated Gym Attendance with Time Intervals (Height Reflects Attendance)")
plt.xlabel("Time of Day (Hour)")
plt.ylabel("Attendance Fraction")
plt.xticks(np.arange(5, 24, 1))
plt.grid(True)

# To avoid duplicate legend entries, create a unique dictionary of handles.
handles, labels = plt.gca().get_legend_handles_labels()
from collections import OrderedDict
unique = OrderedDict(zip(labels, handles))
plt.legend(unique.values(), unique.keys(), loc='upper right')

plt.savefig('workout_time_intervals.png', dpi=300)
plt.show()
