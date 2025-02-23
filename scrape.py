# scrape.py
import requests
from bs4 import BeautifulSoup
import datetime
import os


def scrape_and_update_csv():
    # 1. 访问目标网页（示例：健身房人数网站）
    url = "https://apps.recsports.msu.edu/volume/hourly.php"
    resp = requests.get(url)
    resp.raise_for_status()

    # 2. 解析HTML，示例仅演示获取“Total”行数据
    soup = BeautifulSoup(resp.text, 'html.parser')
    table = soup.find("table", {"class": "table"})
    if not table:
        return

    total_tr = table.find("th", string="Total")
    if not total_tr:
        return
    total_row = total_tr.parent
    cols = total_row.find_all("td")
    if len(cols) < 3:
        return
    west_total = cols[0].get_text(strip=True)
    east_total = cols[1].get_text(strip=True)
    circle_total = cols[2].get_text(strip=True)

    # 3. 获取当前采集时间，构造新的一行 CSV 数据
    scrape_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    current_date = scrape_time.split(" ")[0]
    new_line = f"{scrape_time},{west_total},{east_total},{circle_total}\n"

    data_file = "docs/data/today_data.csv"
    old_data_file = "docs/data/total_detailed_data.csv"

    # 4. 检查 today_data.csv 是否已有数据，并判断最后一行的日期
    lines = []
    if os.path.exists(data_file):
        with open(data_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

    if lines:
        # 假设 CSV 的第一列为采集时间，格式为 "YYYY-MM-DD HH:MM:SS"
        last_line = lines[-1]
        last_date = last_line.split(",")[0].split(" ")[0]
        if last_date != current_date:
            # 如果最后一行数据的日期不是今天，则将 today_data.csv 中所有数据视为昨天的数据，
            # 将这些数据追加写入 total_detailed_data.csv，并清空 today_data.csv
            with open(old_data_file, "a", encoding="utf-8") as old_f:
                old_f.writelines(lines)
            with open(data_file, "w", encoding="utf-8") as f:
                f.write("")

    # 5. 写入最新数据到 today_data.csv
    with open(data_file, "a", encoding="utf-8") as f:
        f.write(new_line)


def main():
    scrape_and_update_csv()


if __name__ == "__main__":
    main()

