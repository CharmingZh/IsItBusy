import requests
from bs4 import BeautifulSoup
import csv
from datetime import date, timedelta, datetime

DATE_START = date(2010, 2, 1)

def date_range(start_date, end_date):
    """生成从 start_date 到 end_date (包含) 的所有日期。"""
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def get_hourly_data_for_date(session, base_url, query_date_str):
    """
    给定某个日期字符串 (YYYY-MM-DD)，向 hourly.php 提交表单，获取该日期的小时人数表格数据。
    返回一个 dict，结构示例：
    {
      "hours": [6, 7, 8, 9, ..., 23],  # 实际出现的小时顺序
      "West": [164, 105, 166, 139, ...],  # 与 hours 对应
      "East": [...],
      "Circle": [...]
    }
    """
    # 发起 POST 请求，提交表单数据
    post_data = {"searchDate": query_date_str}
    r = session.post(base_url, data=post_data)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", {"class": "table"})
    if not table:
        return None

    rows = table.find("tbody").find_all("tr")

    # 存放结果的容器
    hours = []
    west_counts = []
    east_counts = []
    circle_counts = []

    for row in rows:
        cols = row.find_all("td")
        # 如果不是正常的小时行（一般会有 3 个td），则可能是 Total 行或者表头/异常行，需做判断
        if len(cols) == 3:
            # 先找到第一列 hour 的内容
            hour_th = row.find("th")
            if not hour_th:
                continue
            hour_text = hour_th.get_text(strip=True)

            # 跳过 "Total" 行
            if hour_text.lower() == "total.data":
                continue

            # hour_text 一般是 "6", "7", ...  将其转为 int
            try:
                hour_val = int(hour_text)
            except ValueError:
                # 如果无法转为 int，则可能不是小时数据，跳过
                continue

            west_text = cols[0].get_text(strip=True)
            east_text = cols[1].get_text(strip=True)
            circle_text = cols[2].get_text(strip=True)

            # 转换为整数，如果为空或异常，设为 0 或自行处理
            west_num = int(west_text) if west_text.isdigit() else 0
            east_num = int(east_text) if east_text.isdigit() else 0
            circle_num = int(circle_text) if circle_text.isdigit() else 0

            hours.append(hour_val)
            west_counts.append(west_num)
            east_counts.append(east_num)
            circle_counts.append(circle_num)

    # 按小时从小到大排序（因为网页不一定总是从小到大，但一般是按顺序，这里可以以防万一）
    # 将 hours, west_counts, east_counts, circle_counts 一起排序
    combined = sorted(zip(hours, west_counts, east_counts, circle_counts), key=lambda x: x[0])
    sorted_hours = [x[0] for x in combined]
    sorted_west = [x[1] for x in combined]
    sorted_east = [x[2] for x in combined]
    sorted_circle = [x[3] for x in combined]

    return {
        "hours": sorted_hours,
        "West": sorted_west,
        "East": sorted_east,
        "Circle": sorted_circle
    }


def main():
    # 目标 URL，假设为 https://apps.recsports.msu.edu/volume/hourly.php
    base_url = "https://apps.recsports.msu.edu/volume/hourly.php"

    # 设定需要爬取的日期范围
    start_date = DATE_START
    end_date = date.today()  # 或者手动指定到某天，如 date(2025, 2, 19)

    # 用于存储三大场馆的所有数据
    # 键：日期字符串(YYYY-MM-DD)，值：该日期对应的 [hour1, hour2, ...]
    # 注意：不一定每个日期都有相同的小时数，如出现闭馆或者数据缺失，需要处理对齐
    west_data = {}
    east_data = {}
    circle_data = {}

    # 为了记录各天都出现了哪些 hour，便于最后写 CSV 时对齐列
    # 不同日期可能 hour 范围不完全一致，最后写 CSV 要统一列(如 0~23 或最小~最大)
    all_hours_set = set()

    with requests.Session() as s:
        for single_date in date_range(start_date, end_date):
            query_date_str = single_date.strftime("%Y-%m-%d")
            print(f"正在获取 {query_date_str} 数据...")
            result = get_hourly_data_for_date(s, base_url, query_date_str)

            if not result:
                # 没拿到数据，可能网站无返回或表格为空
                continue

            hours = result["hours"]  # [6,7,8,9,...]
            west_counts = result["West"]  # [164, 105, ...]
            east_counts = result["East"]  # [...]
            circle_counts = result["Circle"]

            # 存入对应的 dict，方便后续统一写 CSV
            # 形式：{ query_date_str: {hour0: x, hour1: x, ...} }
            west_data[query_date_str] = dict(zip(hours, west_counts))
            east_data[query_date_str] = dict(zip(hours, east_counts))
            circle_data[query_date_str] = dict(zip(hours, circle_counts))

            # 记录所有出现过的 hour
            for h in hours:
                all_hours_set.add(h)

    # 将所有出现过的小时，按升序排列
    all_hours_sorted = sorted(list(all_hours_set))

    # ============ 写出 CSV ============ #
    # 需求：每个场馆一个 CSV；每行代表一天，第一列是日期，后续列依次是每个 hour 的人数

    # West
    with open("West.csv", "w", newline="", encoding="utf-8") as f_west:
        writer_west = csv.writer(f_west)
        # 先写表头：["Date", "hour1", "hour2", ...]
        header = ["Date"] + [str(h) for h in all_hours_sorted]
        writer_west.writerow(header)

        for d_str in sorted(west_data.keys()):
            row = [d_str]
            # 依照 all_hours_sorted 的顺序，将没有数据的小时补 0
            for h in all_hours_sorted:
                row.append(west_data[d_str].get(h, 0))
            writer_west.writerow(row)

    # East
    with open("East.csv", "w", newline="", encoding="utf-8") as f_east:
        writer_east = csv.writer(f_east)
        header = ["Date"] + [str(h) for h in all_hours_sorted]
        writer_east.writerow(header)

        for d_str in sorted(east_data.keys()):
            row = [d_str]
            for h in all_hours_sorted:
                row.append(east_data[d_str].get(h, 0))
            writer_east.writerow(row)

    # Circle
    with open("Circle.csv", "w", newline="", encoding="utf-8") as f_circle:
        writer_circle = csv.writer(f_circle)
        header = ["Date"] + [str(h) for h in all_hours_sorted]
        writer_circle.writerow(header)

        for d_str in sorted(circle_data.keys()):
            row = [d_str]
            for h in all_hours_sorted:
                row.append(circle_data[d_str].get(h, 0))
            writer_circle.writerow(row)

    print("数据抓取并保存完毕！")


if __name__ == "__main__":
    main()
