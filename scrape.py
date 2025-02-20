# scrape.py
import requests
from bs4 import BeautifulSoup
import datetime


def scrape_and_update_csv():
    # 1. 访问目标网页(示例：健身房人数网站)
    url = "https://apps.recsports.msu.edu/volume/hourly.php"
    # 此示例直接get；若需要POST + searchDate,自己改requests.post(...)即可
    resp = requests.get(url)
    resp.raise_for_status()

    # 2. 解析HTML，示例仅示范获取某处数字
    soup = BeautifulSoup(resp.text, 'html.parser')
    table = soup.find("table", {"class": "table"})
    if not table:
        return None

    # 仅示范获取 "Total" 行
    total_tr = table.find("th", string="Total")
    if not total_tr:
        return None
    total_row = total_tr.parent
    cols = total_row.find_all("td")
    if len(cols) < 3:
        return None
    west_total = cols[0].get_text(strip=True)
    east_total = cols[1].get_text(strip=True)
    circle_total = cols[2].get_text(strip=True)

    # 3. 拼接成 CSV 的一行
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{now},{west_total},{east_total},{circle_total}\n"

    # 4. 写入 data.csv （追加模式）
    with open("data.csv", "a", encoding="utf-8") as f:
        f.write(line)


def main():
    scrape_and_update_csv()


if __name__ == "__main__":
    main()
