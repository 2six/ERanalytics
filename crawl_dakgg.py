import os
import json
from datetime import datetime
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def parse_percentage(value: str) -> float:
    # '-'가 포함되어 있으면 0.0으로 처리
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

        버전_요소 = soup.select_one("details:nth-of-type(1) summary span")
        버전 = 버전_요소.get_text(strip=True) if 버전_요소 else "unknown"

        now = datetime.now().strftime("%Y-%m-%d_%H-%M")

        data = []
        for row in rows:
            cols = row.select("td")
            if len(cols) < 8:
                continue
            try:
                실험체 = cols[1].select_one("a").get_text(strip=True)
                rp = float(cols[3].get_text(strip=True).replace(",", ""))
                표본수 = int(cols[4].select_one("span").get_text(strip=True).replace(",", ""))
                승률 = round(parse_percentage(cols[5].get_text()), 4)
                top3 = round(parse_percentage(cols[6].get_text()), 4)
                평균순위 = float(cols[7].get_text(strip=True).replace("#", ""))
                data.append({
                    "실험체": 실험체,
                    "RP 획득": rp,
                    "표본수": 표본수,
                    "승률": 승률,
                    "TOP 3": top3,
                    "평균 순위": 평균순위
                })
            except Exception as e:
                print(f"[{tier_key}] 오류 발생: {e}")
                continue

        result = {
            "버전": 버전,
            "티어": display_name,
            "날짜": now,
            "데이터": data
        }

        os.makedirs(f"data/{버전}", exist_ok=True)
        with open(f"data/{버전}/{tier_key}.json", "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

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
    for tier_key, display_name in tier_map.items():
        crawl_tier_data(tier_key, display_name)

if __name__ == "__main__":
    main()
