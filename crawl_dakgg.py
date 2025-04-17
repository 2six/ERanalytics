import os
import json
from datetime import datetime
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def parse_percentage(value: str) -> float:
    if '-' in value:
        return 0.0
    return float(value.strip().replace('%', '').split()[0]) / 100

def crawl_tier_data(tier_key: str, display_name: str):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        url = f"https://dak.gg/er/statistics?period=currentPatch&tier={tier_key}"
        page.goto(url, timeout=60000)
        page.wait_for_timeout(5000)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")
        rows = soup.select("table.w-full.text-\\[12px\\] tbody tr")

        version_elem = soup.select_one("details:nth-of-type(1) summary span")
        version = version_elem.get_text(strip=True) if version_elem else "unknown"

        now = datetime.now().strftime("%Y-%m-%d %H:%M")

        data = []
        for row in rows:
            cols = row.select("td")
            if len(cols) < 8:
                continue
            try:
                name = cols[1].select_one("a").get_text(strip=True)
                rp = float(cols[3].get_text(strip=True).replace(",", ""))
                sample = int(cols[4].select_one("span").get_text(strip=True).replace(",", ""))
                win = round(parse_percentage(cols[5].get_text()), 4)
                top3 = round(parse_percentage(cols[6].get_text()), 4)
                rank = float(cols[7].get_text(strip=True).replace("#", ""))

                data.append({
                    "실험체": name,
                    "RP 획득": rp,
                    "표본수": sample,
                    "승률": win,
                    "TOP 3": top3,
                    "평균 순위": rank
                })
            except Exception as e:
                print(f"[{tier_key}] 오류 발생: {e}")
                continue

        # 파일 경로 생성
        os.makedirs(f"data/{version}", exist_ok=True)
        file_path = f"data/{version}/{tier_key}.json"

        # 기존 파일 불러오기
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        else:
            existing = {
                "버전": version,
                "티어": display_name,
                "통계": {}
            }

        # 현재 시각 데이터 추가
        existing["통계"][now] = data

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        print(f"[{tier_key}] {len(data)}개 실험체 데이터 저장 완료.")
        browser.close()

def main():
    tier_map = {
        "platinum_plus": "플래티넘+",
        "diamond_plus": "다이아몬드+",
        "meteorite_plus": "메테오라이트+",
        "mithril_plus": "미스릴+",
        "in1000": "in1000"
    }
    for key, name in tier_map.items():
        crawl_tier_data(key, name)

if __name__ == "__main__":
    main()
