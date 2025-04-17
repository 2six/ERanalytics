import json
import os
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup


def parse_percentage(value: str) -> float:
    return float(value.strip().split()[0].replace('%', '')) / 100


def extract_version(soup):
    version_tag = soup.select_one("details:nth-of-type(1) summary span")
    return version_tag.get_text(strip=True) if version_tag else "알 수 없음"


def extract_character_data(soup):
    rows = soup.select("table.w-full.text-\\[12px\\] tbody tr")
    character_data = []

    for row in rows:
        cols = row.select("td")
        if len(cols) < 8:
            continue

        try:
            name = cols[1].select_one("a").get_text(strip=True)
            rp = float(cols[3].get_text(strip=True).replace(",", ""))
            sample_count = int(cols[4].select_one("span").get_text(strip=True).replace(",", ""))
            win_rate = round(parse_percentage(cols[5].get_text()), 4)
            top3 = round(parse_percentage(cols[6].get_text()), 4)
            avg_rank = float(cols[7].get_text(strip=True).replace("#", ""))

            character_data.append({
                "실험체": name,
                "RP 획득": rp,
                "표본수": sample_count,
                "승률": win_rate,
                "TOP 3": top3,
                "평균 순위": avg_rank
            })
        except Exception as e:
            print(f"[오류] 행 처리 중 예외 발생: {e}")
            continue

    return character_data


def save_to_json(version, tier_label, timestamp, new_data):
    folder = Path(f"data/{version}")
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f"{tier_label}.json"

    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    else:
        existing = {"버전": version, "티어": tier_label, "통계": {}}

    existing["통계"][timestamp] = new_data

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"{file_path}에 저장 완료 ({len(new_data)}개 항목)")


def main():
    tier_targets = {
        "platinum_plus": "플래티넘+",
        "diamond_plus": "다이아몬드+",
        "meteorite_plus": "메테오라이트+",
        "mithril_plus": "미스릴+",
        "in1000": "in1000"
    }

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for tier_param, tier_label in tier_targets.items():
            url = f"https://dak.gg/er/statistics?period=currentPatch&tier={tier_param}"
            print(f"크롤링 중: {tier_label} → {url}")
            try:
                page.goto(url, timeout=60000)
                page.wait_for_timeout(5000)
                soup = BeautifulSoup(page.content(), "html.parser")

                version = extract_version(soup)
                character_data = extract_character_data(soup)
                save_to_json(version, tier_label, timestamp, character_data)

            except Exception as e:
                print(f"[오류] {tier_label} 처리 중 문제 발생: {e}")
                continue

        browser.close()


if __name__ == "__main__":
    main()
