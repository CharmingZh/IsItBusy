import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from scipy.stats import norm

# ------------------------------
# Global settings: Use Times New Roman font and Seaborn theme
# ------------------------------
sns.set_theme(style="whitegrid")  # Use Seaborn's whitegrid theme
plt.rcParams['font.family'] = 'Times New Roman'
plt.rcParams['axes.titlesize'] = 16
plt.rcParams['axes.labelsize'] = 14
plt.rcParams['xtick.labelsize'] = 12
plt.rcParams['ytick.labelsize'] = 12
plt.rcParams['legend.fontsize'] = 12

y_limit = 500

# Create output directory for images
output_dir = "../docs/output_images"
os.makedirs(output_dir, exist_ok=True)

# ------------------------------
# 1. Data reading and preprocessing
# ------------------------------
data = pd.read_csv("../docs/data/history_data/West.csv", header=0)
data['date'] = pd.to_datetime(data['Date'], format="%Y-%m-%d")
data.drop(columns='Date', inplace=True)

# Get time slot labels (all columns except 'date')
time_slots = list(data.columns)
time_slots.remove('date')

# Convert all time slot columns to numeric
for col in time_slots:
    print(f"Column {col} shape: {data[col].shape}")
    data[col] = pd.to_numeric(data[col], errors='coerce')

# Calculate daily total attendance (sum across time slots)
data['total'] = data[time_slots].sum(axis=1)

# Filter valid data: days with total > 10
valid_data = data[data['total'] > 10].copy()
valid_data['weekday'] = valid_data['date'].dt.day_name()

# ------------------------------
# 2. Visualization of raw data
# ------------------------------
# (01) Daily Gym Attendance Trend
plt.figure(figsize=(12,6))
plt.plot(valid_data['date'], valid_data['total'], marker='o', color='dodgerblue', linewidth=1.5)
plt.title(f"Daily Gym Attendance Trend (n = {len(valid_data)} days)")
plt.xlabel("Date")
plt.ylabel("Total Count")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "01_daily_attendance_trend.png"))
plt.close()

# (02) Gym Attendance Distribution by Weekday (Boxplot)
sns.set_palette("Set2")
plt.figure(figsize=(10,6))
sns.boxplot(x='weekday', y='total', data=valid_data,
            order=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
plt.title("Gym Attendance Distribution by Weekday")
plt.xlabel("Weekday")
plt.ylabel("Total Count")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "02_attendance_distribution_by_weekday.png"))
plt.close()

# ------------------------------
# 3. Estimation of In-Gym Count Considering Decay
# ------------------------------
mu = 1       # mean = 1 hour
sigma = 0.92 # std = 0.92 hour

def remaining_probability(time_diff):
    return 1 - norm.cdf(time_diff, loc=mu, scale=sigma)

presence_rows = []
for idx, row in valid_data.iterrows():
    daily_presence = []
    for j in range(len(time_slots)):
        presence = 0
        for i in range(j+1):
            time_diff = j - i
            presence += row[time_slots[i]] * remaining_probability(time_diff)
        daily_presence.append(presence)
    row_data = {'date': row['date']}
    row_data.update({slot: val for slot, val in zip(time_slots, daily_presence)})
    presence_rows.append(row_data)

presence_estimates = pd.DataFrame(presence_rows)
presence_estimates['date'] = pd.to_datetime(presence_estimates['date'])
presence_estimates['weekday'] = valid_data['weekday'].values
presence_estimates['year'] = presence_estimates['date'].dt.year

# ------------------------------
# 4. Visualization of Estimated In-Gym Count
# ------------------------------
# (03) Heatmap of Estimated In-Gym Count
heatmap_data = presence_estimates.copy()
heatmap_data['sum'] = heatmap_data[time_slots].sum(axis=1)
heatmap_data = heatmap_data[heatmap_data['sum'] > 0]
heatmap_data = heatmap_data.drop(columns='sum')
plt.figure(figsize=(12,8))
ax = sns.heatmap(heatmap_data[time_slots].astype(float), cmap="YlGnBu", cbar_kws={'label': 'Estimated Count'})
plt.title(f"Heatmap of Estimated In-Gym Count (n = {len(heatmap_data)} days)")
plt.xlabel("Time Slot")
plt.ylabel("Date")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "03_estimated_in_gym_count_heatmap.png"))
plt.close()

# (04) Average Estimated In-Gym Count by Weekday - Weekdays
for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
    subset = presence_estimates[presence_estimates['weekday'] == day]
    if subset.empty:
        continue
    plt.figure(figsize=(12,6))
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=day)
    plt.title(f"{day}: Average Estimated In-Gym Count (n = {len(subset)} days)")
    plt.xlabel("Time Slot")
    plt.ylabel("Estimated Count")
    plt.xticks(rotation=45)
    plt.ylim(0, y_limit)
    plt.legend()
    plt.tight_layout()
    filename = f"04_average_estimated_in_gym_{day.lower()}.png"
    plt.savefig(os.path.join(output_dir, filename))
    plt.close()

# (05) Average Estimated In-Gym Count by Weekday - Weekends
for day in ["Saturday", "Sunday"]:
    subset = presence_estimates[presence_estimates['weekday'] == day]
    if subset.empty:
        continue
    plt.figure(figsize=(12,6))
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=day)
    plt.title(f"{day}: Average Estimated In-Gym Count (n = {len(subset)} days)")
    plt.xlabel("Time Slot")
    plt.ylabel("Estimated Count")
    plt.xticks(rotation=45)
    plt.ylim(0, y_limit)
    plt.legend()
    plt.tight_layout()
    filename = f"05_average_estimated_in_gym_{day.lower()}.png"
    plt.savefig(os.path.join(output_dir, filename))
    plt.close()

# (06) Combined plot for all weekdays (Monday to Sunday)
plt.figure(figsize=(12,6))
for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
    subset = presence_estimates[presence_estimates['weekday'] == day]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=day)
plt.title("Average Estimated In-Gym Count by Weekday")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "06_combined_average_estimated_in_gym_by_weekday.png"))
plt.close()

# (07) Plot for a specific target date
target_date = pd.to_datetime("2024-03-01")
subset_raw = valid_data[valid_data['date'] == target_date]
if not subset_raw.empty:
    plt.figure(figsize=(10,5))
    plt.plot(time_slots, subset_raw[time_slots].values.flatten(), marker='o', color='dodgerblue', linewidth=2)
    plt.title(f"{target_date.date()} - Gym Attendance by Time Slot")
    plt.xlabel("Time Slot")
    plt.ylabel("Attendance Count")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"07_attendance_{target_date.date()}.png"))
    plt.close()
else:
    print(f"{target_date.date()} has no valid attendance data.")

subset_presence = presence_estimates[presence_estimates['date'] == target_date]
if not subset_presence.empty:
    plt.figure(figsize=(10,5))
    plt.plot(time_slots, subset_presence[time_slots].values.flatten(), marker='o', color='tomato', linewidth=2)
    plt.title(f"{target_date.date()} - Estimated In-Gym Count by Time Slot")
    plt.xlabel("Time Slot")
    plt.ylabel("Estimated In-Gym Count")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"08_estimated_in_gym_{target_date.date()}.png"))
    plt.close()
else:
    print(f"{target_date.date()} has no valid estimated in-gym data.")

# ------------------------------
# 6. Combined data by year: Plot integrated data for Monday to Sunday by year
# ------------------------------
years = sorted(presence_estimates['year'].unique())
weekdays_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
for yr in years:
    plt.figure(figsize=(12,6))
    for day in weekdays_order:
        subset = presence_estimates[(presence_estimates['year'] == yr) &
                                    (presence_estimates['weekday'] == day)]
        if subset.empty:
            continue
        avg_profile = subset[time_slots].mean()
        plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=day)
    plt.title(f"{yr} - Average Estimated In-Gym Count by Weekday")
    plt.xlabel("Time Slot")
    plt.ylabel("Estimated Count")
    plt.xticks(rotation=45)
    plt.ylim(0, y_limit)
    plt.legend(title="Weekday")
    plt.tight_layout()
    filename = f"09_integration_by_year_{yr}.png"
    plt.savefig(os.path.join(output_dir, filename))
    plt.close()

# ------------------------------
# 7. Different years: Plot Monday data for each year
# ------------------------------
plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Monday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Mondays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "10_mondays_by_year.png"))
plt.close()

# ------------------------------
# Additional: Different years for other weekdays if needed
# ------------------------------
# For example, for Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Tuesday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Tuesdays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "11_tuesdays_by_year.png"))
plt.close()

plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Wednesday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Wednesdays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "12_wednesdays_by_year.png"))
plt.close()

plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Thursday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Thursdays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "13_thursdays_by_year.png"))
plt.close()

plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Friday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Fridays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "14_fridays_by_year.png"))
plt.close()

plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Saturday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Saturdays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "15_saturdays_by_year.png"))
plt.close()

plt.figure(figsize=(12,6))
for yr in years:
    subset = presence_estimates[(presence_estimates['year'] == yr) &
                                (presence_estimates['weekday'] == "Sunday")]
    if subset.empty:
        continue
    avg_profile = subset[time_slots].mean()
    plt.plot(time_slots, avg_profile, marker='o', linewidth=2, label=str(yr))
plt.title("Average Estimated In-Gym Count on Sundays by Year")
plt.xlabel("Time Slot")
plt.ylabel("Estimated Count")
plt.xticks(rotation=45)
plt.ylim(0, y_limit)
plt.legend(title="Year")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "16_sundays_by_year.png"))
plt.close()
