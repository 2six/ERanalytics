import json
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def parse_percentage(value: str) -> float:
    # '15.98%9871' → '15.98%' → 0.1598
    return float(value.strip().split()[0].replace('%', '')) / 100

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        url = "https://dak.gg/er/statistics?period=currentPatch&tier=diamond_plus"
        page.goto(url, timeout=60000)
        page.wait_for_timeout(5000)  # JS 렌더링 대기

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")
        rows = soup.select("table.w-full.text-\\[12px\\] tbody tr")

        # 버전 정보 추출
        버전_요소 = soup.select_one("details:nth-of-type(1) summary span")
        버전 = 버전_요소.get_text(strip=True) if 버전_요소 else "알 수 없음"

        # 티어 정보 추출
        티어_요소 = soup.select_one("details:nth-of-type(2) summary img")
        티어 = 티어_요소.get("alt", "알 수 없음") if 티어_요소 else "알 수 없음"

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
                print(f"오류 발생: {e}")
                continue

        result = {
            "버전": 버전,
            "티어": 티어,
            "데이터": data
        }

        with open("temp.json", "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"{len(data)}개 실험체 데이터가 temp.json에 저장되었습니다.")
        browser.close()

if __name__ == "__main__":
    main()
