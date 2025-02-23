import requests
import time
import pandas as pd
from bs4 import BeautifulSoup
from datetime import datetime

# ANSI 颜色定义
COLOR_MAIN = "\033[94m"  # 蓝色
COLOR_FETCH = "\033[92m"  # 绿色
COLOR_UPDATE = "\033[93m"  # 黄色
COLOR_RESET = "\033[0m"  # 重置

# 📌 目标 URL
URL = "https://apps.recsports.msu.edu/volume/vol-table.php"

# 📌 存储 CSV 文件（west、east、circle 均捕获）
CSV_FILES = {
    "west": "west.csv",
    "east": "east.csv",
    "circle": "circle.csv",
}

# 📌 记录时间范围（6:00 - 23:00，每 5 分钟，每小时 12 个数据）
TIME_INTERVALS = [f"{h:02d}:{m:02d}" for h in range(6, 24) for m in range(0, 60, 5)]
EXPECTED_LENGTH = 1 + len(TIME_INTERVALS)  # 第一列为日期


def fetch_data():
    """从网页抓取表格数据"""
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_prefix = f"{COLOR_FETCH}[{now_str}] [FETCH]{COLOR_RESET}"
    print(f"{log_prefix} \t开始抓取数据……")

    try:
        response = requests.get(URL)
    except Exception as e:
        print(f"{log_prefix} \t请求异常: {e}")
        return None

    if response.status_code != 200:
        print(f"{log_prefix} \t请求失败, 状态码: {response.status_code}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")
    if not table:
        print(f"{log_prefix} \t未在页面中找到表格")
        return None

    rows = table.find_all("tr")
    data = {}

    # 解析数据并捕获目标区域数据
    for row in rows[1:]:  # 跳过表头
        cols = row.find_all(["th", "td"])
        if len(cols) < 2:
            continue

        location = cols[0].text.strip().lower()
        inside_value = cols[1].text.strip().split(" ")[0]  # 取第一个数字
        if location in CSV_FILES:
            data[location] = inside_value

    print(f"{log_prefix} \t数据抓取完毕, 获取数据: {data}")
    return data


def print_hourly_data(location, row):
    """
    按 3 小时分组格式化输出当天数据：
      - row[0] 为日期，其余数据为当天各时间点的数据（每小时 12 个，共18小时）
      - 每组 3 个小时（36 个数据）一行显示
    """
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_prefix = f"{COLOR_UPDATE}[{now_str}] [UPDATE]{COLOR_RESET}"
    print(f"{log_prefix} {location.upper()} {row[0]} 数据如下：")
    # 小时从 6 到 23，共 18 个小时，按每3小时分组输出，共6行
    for group in range(0, 18, 3):
        start_hour = 6 + group
        end_hour = start_hour + 2  # 包含该小时
        start_idx = (start_hour - 6) * 12 + 1  # row[0]为日期
        group_data = row[start_idx:start_idx + 36]  # 3小时 * 12个数据/小时
        timeslot = f"{start_hour:02d}-{end_hour:02d}:"
        print(f"  {timeslot:<8} " + ", ".join(group_data))


def get_valid_days_count(filename):
    """
    统计 CSV 中有效天数：
    有效天数定义为除日期外所有数据转为 int 后求和 > 0 的行数
    """
    try:
        df = pd.read_csv(filename, dtype=str)
    except Exception:
        return 0
    count = 0
    for _, row in df.iterrows():
        try:
            values = [int(x) for x in row[1:] if x.strip() != ""]
            if sum(values) > 0:
                count += 1
        except Exception:
            continue
    return count


def update_csv(data):
    """更新 CSV 文件，并格式化输出当天数据（按3小时分组显示），同时显示有效天数统计"""
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M")
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')
    log_prefix = f"{COLOR_UPDATE}[{now_str}] [UPDATE]{COLOR_RESET}"

    print(f"{log_prefix} \t当前时间: {time_str}")

    if time_str not in TIME_INTERVALS:
        print(f"{log_prefix} \t当前时间 {time_str} 不在记录范围内（6:00-23:00 每5分钟），跳过更新。")
        return

    for location, filename in CSV_FILES.items():
        row = [date_str] + ["0"] * len(TIME_INTERVALS)
        try:
            df = pd.read_csv(filename, dtype=str)
            if date_str in df["Date"].values:
                row_index = df[df["Date"] == date_str].index[0]
                row = df.iloc[row_index].tolist()
                if len(row) < EXPECTED_LENGTH:
                    row.extend(["0"] * (EXPECTED_LENGTH - len(row)))
        except FileNotFoundError:
            df = pd.DataFrame(columns=["Date"] + TIME_INTERVALS)
            print(f"{log_prefix} \t文件 {filename} 未找到，已创建新文件。")

        new_value = data.get(location, "0")
        time_index = TIME_INTERVALS.index(time_str) + 1
        row[time_index] = new_value

        if date_str in df["Date"].values:
            df.iloc[row_index] = row
            print(f"{log_prefix} \t更新 {location.upper()} 数据成功。")
        else:
            df.loc[len(df)] = row
            print(f"{log_prefix} \t追加 {location.upper()} 新记录成功。")

        df.to_csv(filename, index=False)
        print_hourly_data(location, row)
        valid_days = get_valid_days_count(filename)
        print(f"{log_prefix} \t{location.upper()} CSV 有效数据天数：{valid_days}")


def main():
    """主循环：在每个需要记录的时间点（秒数为00且时间为TIME_INTERVALS中的时间）请求数据"""
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_prefix = f"{COLOR_MAIN}[{now_str}] [MAIN]{COLOR_RESET}"
    print(f"{log_prefix} \t程序启动，等待每个记录时点（秒数为00）开始抓取数据……")

    while True:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        # 当秒数为00且当前时间在记录列表中，则触发抓取更新
        if now.second == 0 and current_time in TIME_INTERVALS:
            data = fetch_data()
            if data:
                update_csv(data)
            else:
                print(f"{log_prefix} \t抓取数据失败，跳过当前更新。")
            # 为避免在同一分钟内多次触发，等待至少60秒
            time.sleep(60)
        else:
            # 每0.5秒检查一次
            time.sleep(0.5)


if __name__ == "__main__":
    main()
