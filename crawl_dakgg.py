# 실험체 이름에서 "무기군"을 제거하고 이름을 기준으로 정렬
def clean_and_sort_name(name: str) -> str:
    # "카메라" 등 무기 이름을 제거하고 실험체 이름만 남김
    weapon_prefixes = [
        "카메라", "방망이", "석궁", "저격총", "투척", "아르카나", "양손검", "권총", "단검", "레이피어", "글러브", "톤파", 
        "망치", "쌍절곤", "창", "채찍", "기타", "도끼", "암기", "VF 의수", "쌍검", "돌격 소총", "활"
    ]
    
    # 무기 이름이 실험체 앞에 있다면 이를 제외하고 실험체 이름만 남기기
    for prefix in weapon_prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
            break
    
    return name

# 실험체 데이터를 정렬하는 함수
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

        # 현재 시각을 한국 표준시(KST)로 가져오기
        now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

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

        # 실험체 이름을 기준으로 정렬 (무기명 제거 후)
        data.sort(key=lambda x: clean_and_sort_name(x["실험체"]))

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

        # 현재 시각 데이터 추가 (중복되는 타임스탬프 처리)
        if now not in existing["통계"]:
            existing["통계"][now] = data
        else:
            # 데이터가 이미 있으면 병합
            existing["통계"][now].extend(data)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        # versions.json 자동 갱신
        update_versions_json(version)

        print(f"[{tier_key}] {len(data)}개 실험체 데이터 저장 완료.")
        browser.close()
