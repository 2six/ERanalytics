import os
import json
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

# 한국 표준시 (UTC+9) 적용
KST = timezone(timedelta(hours=9))

def parse_percentage(value: str) -> float:
    if '-' in value:
        return 0.0
    # 원본 코드와 동일하게 '%' 제거 후 숫자로 변환
    return float(value.strip().replace('%', '').split()[0]) / 100

# 실험체 이름에서 "무기군"을 제거하고 이름을 기준으로 정렬
def clean_and_sort_name(name: str) -> str:
    # "카메라" 등 무기 이름을 제거하고 실험체 이름만 남김
    weapon_prefixes = [
        "카메라", "방망이", "석궁", "저격총", "투척", "아르카나", "양손검", "권총", "단검", "레이피어", "글러브", "톤파",
        "망치", "쌍절곤", "창", "채찍", "기타", "도끼", "암기", "VF의수"
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
        browser = None # 초기화
        try:
            browser = p.chromium.launch() # headless=False for debugging
            page = browser.new_page()

            url = f"https://dak.gg/er/statistics?period=currentPatch&tier={tier_key}"

            page.goto(url, timeout=60000) # 페이지 로드 타임아웃 (60초)

            # 1. 고정 대기 시간 대신, 특정 요소가 나타날 때까지 기다리도록 수정 (이전 수정 유지)
            page.wait_for_selector("table.w-full.text-\\[12px\\] tbody tr", timeout=30000)

            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            version_elem = soup.select_one("details:nth-of-type(1) summary span")
            version = version_elem.get_text(strip=True) if version_elem else "unknown"
            if version == "unknown":
                print(f"[{tier_key}] 버전 정보를 찾을 수 없습니다.")
                # 버전 정보를 찾지 못했으면 이 티어의 크롤링을 건너뛰거나 오류 처리 (여기서는 계속 진행)

            # 현재 시각을 한국 표준시(KST)로 가져오기
            now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

            rows = soup.select("table.w-full.text-\\[12px\\] tbody tr")
            if not rows:
                 print(f"[{tier_key}] 통계 테이블 로우를 찾을 수 없습니다. 페이지 구조가 변경되었거나 데이터가 없습니다.")
                 browser.close()
                 return

            data = []
            for row in rows:
                cols = row.select("td")
                if len(cols) < 8:
                    continue
                try:
                    name = cols[1].select_one("a").get_text(strip=True)

                    # --- RP 획득량 파싱 로직 수정 시작 (최소화) ---
                    rp_col = cols[3] # RP 획득량 셀 선택

                    # 원본 코드와 동일하게 셀의 텍스트 콘텐츠를 가져오고 쉼표 제거
                    # 이렇게 하면 이미지의 alt 텍스트는 포함되지 않고 순수 텍스트(숫자)만 가져와집니다.
                    rp_text_numeric = rp_col.get_text(strip=True).replace(",", "")

                    # 아래 화살표 이미지가 있는지 확인 (alt 속성 사용)
                    down_arrow_img = rp_col.find('img', alt='down-arrow')

                    try:
                         # 원본 코드와 동일하게 float으로 변환
                         rp_value = float(rp_text_numeric)

                         # 아래 화살표 이미지 존재 여부에 따라 부호 결정
                         if down_arrow_img:
                             rp = -rp_value
                         else:
                             rp = rp_value # 위 화살표나 화살표 없으면 양수 또는 0

                    except ValueError:
                         # 숫자로 변환할 수 없는 경우 오류 처리
                         print(f"[{tier_key}] RP 값 파싱 오류: '{rp_text_numeric}'를 숫자로 변환할 수 없습니다.")
                         rp = 0.0 # 오류 발생 시 기본값 설정
                    # --- RP 획득량 파싱 로직 수정 끝 ---


                    sample = int(cols[4].select_one("span").get_text(strip=True).replace(",", ""))
                    win = round(parse_percentage(cols[5].get_text()), 4)
                    top3 = round(parse_percentage(cols[6].get_text()), 4)
                    rank = float(cols[7].get_text(strip=True).replace("#", ""))

                    data.append({
                        "실험체": name,
                        "RP 획득": rp, # 수정된 rp 값 사용
                        "표본수": sample,
                        "승률": win,
                        "TOP 3": top3,
                        "평균 순위": rank
                    })
                except Exception as e:
                    # 특정 로우 파싱 중 발생한 일반적인 오류
                    # 오류 메시지에 어떤 로우에서 문제가 났는지 좀 더 자세한 정보를 출력
                    print(f"[{tier_key}] 로우 파싱 오류 발생: {e} - 실험체: {cols[1].get_text(strip=True) if len(cols)>1 else 'unknown'}, RP raw: {cols[3].get_text(strip=True) if len(cols)>3 else 'unknown'}")
                    continue # 해당 로우만 건너뛰고 다음 로우 처리

            # 실험체명 기준으로 정렬 (1단계: 실험체명, 2단계: 무기명)
            data.sort(key=lambda x: (clean_and_sort_name(x["실험체"]), x["실험체"]))

            # 파일 경로 생성
            # >>> 수정 시작: 'data' 폴더를 'stats' 폴더로 변경
            os.makedirs(f"stats/{version}", exist_ok=True)
            file_path = f"stats/{version}/{tier_key}.json"
            # >>> 수정 끝

            # 기존 파일 불러오기
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                        # 기존 데이터 구조가 예상과 다르면 초기화
                        if not isinstance(existing, dict) or "통계" not in existing or not isinstance(existing["통계"], dict):
                            print(f"경고: {file_path} 파일 구조가 예상과 다릅니다. 초기화합니다.")
                            existing = {
                                "버전": version,
                                "티어": display_name,
                                "통계": {}
                            }
                    except json.JSONDecodeError:
                        print(f"경고: {file_path} 파일이 손상되어 초기화합니다.")
                        existing = {
                            "버전": version,
                            "티어": display_name,
                            "통계": {}
                        }
            else:
                existing = {
                    "버전": version,
                    "티어": display_name,
                    "통계": {}
                }

            # 2. 현재 시각 데이터 추가 - 같은 시각에 실행되면 최신 데이터로 덮어쓰도록 수정 (이전 수정 유지)
            existing["통계"][now] = data

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False, indent=2)

            # versions.json 자동 갱신
            update_versions_json(version)

            print(f"[{tier_key}] {len(data)}개 실험체 데이터 저장 완료.")

        except Exception as e:
            # Playwright나 페이지 로딩/대기 중 발생한 치명적인 오류 처리
            print(f"[{tier_key}] 크롤링 중 치명적인 오류 발생: {e}")
        finally:
            # 오류 발생 여부와 상관없이 브라우저 닫기
            if browser:
                browser.close()
    with sync_playwright() as p:
        browser = None # 초기화
        try:
            browser = p.chromium.launch() # headless=False for debugging
            page = browser.new_page()

            url = f"https://dak.gg/er/statistics?period=currentPatch&tier={tier_key}"

            page.goto(url, timeout=60000) # 페이지 로드 타임아웃 (60초)

            # 1. 고정 대기 시간 대신, 특정 요소가 나타날 때까지 기다리도록 수정 (이전 수정 유지)
            page.wait_for_selector("table.w-full.text-\\[12px\\] tbody tr", timeout=30000)

            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            version_elem = soup.select_one("details:nth-of-type(1) summary span")
            version = version_elem.get_text(strip=True) if version_elem else "unknown"
            if version == "unknown":
                print(f"[{tier_key}] 버전 정보를 찾을 수 없습니다.")
                # 버전 정보를 찾지 못했으면 이 티어의 크롤링을 건너뛰거나 오류 처리 (여기서는 계속 진행)

            # 현재 시각을 한국 표준시(KST)로 가져오기
            now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

            rows = soup.select("table.w-full.text-\\[12px\\] tbody tr")
            if not rows:
                 print(f"[{tier_key}] 통계 테이블 로우를 찾을 수 없습니다. 페이지 구조가 변경되었거나 데이터가 없습니다.")
                 browser.close()
                 return

            data = []
            for row in rows:
                cols = row.select("td")
                if len(cols) < 8:
                    continue
                try:
                    name = cols[1].select_one("a").get_text(strip=True)

                    # --- RP 획득량 파싱 로직 수정 시작 (최소화) ---
                    rp_col = cols[3] # RP 획득량 셀 선택

                    # 원본 코드와 동일하게 셀의 텍스트 콘텐츠를 가져오고 쉼표 제거
                    # 이렇게 하면 이미지의 alt 텍스트는 포함되지 않고 순수 텍스트(숫자)만 가져와집니다.
                    rp_text_numeric = rp_col.get_text(strip=True).replace(",", "")

                    # 아래 화살표 이미지가 있는지 확인 (alt 속성 사용)
                    down_arrow_img = rp_col.find('img', alt='down-arrow')

                    try:
                         # 원본 코드와 동일하게 float으로 변환
                         rp_value = float(rp_text_numeric)

                         # 아래 화살표 이미지 존재 여부에 따라 부호 결정
                         if down_arrow_img:
                             rp = -rp_value
                         else:
                             rp = rp_value # 위 화살표나 화살표 없으면 양수 또는 0

                    except ValueError:
                         # 숫자로 변환할 수 없는 경우 오류 처리
                         print(f"[{tier_key}] RP 값 파싱 오류: '{rp_text_numeric}'를 숫자로 변환할 수 없습니다.")
                         rp = 0.0 # 오류 발생 시 기본값 설정
                    # --- RP 획득량 파싱 로직 수정 끝 ---


                    sample = int(cols[4].select_one("span").get_text(strip=True).replace(",", ""))
                    win = round(parse_percentage(cols[5].get_text()), 4)
                    top3 = round(parse_percentage(cols[6].get_text()), 4)
                    rank = float(cols[7].get_text(strip=True).replace("#", ""))

                    data.append({
                        "실험체": name,
                        "RP 획득": rp, # 수정된 rp 값 사용
                        "표본수": sample,
                        "승률": win,
                        "TOP 3": top3,
                        "평균 순위": rank
                    })
                except Exception as e:
                    # 특정 로우 파싱 중 발생한 일반적인 오류
                    # 오류 메시지에 어떤 로우에서 문제가 났는지 좀 더 자세한 정보를 출력
                    print(f"[{tier_key}] 로우 파싱 오류 발생: {e} - 실험체: {cols[1].get_text(strip=True) if len(cols)>1 else 'unknown'}, RP raw: {cols[3].get_text(strip=True) if len(cols)>3 else 'unknown'}")
                    continue # 해당 로우만 건너뛰고 다음 로우 처리

            # 실험체명 기준으로 정렬 (1단계: 실험체명, 2단계: 무기명)
            data.sort(key=lambda x: (clean_and_sort_name(x["실험체"]), x["실험체"]))

            # 파일 경로 생성
            os.makedirs(f"data/{version}", exist_ok=True)
            file_path = f"data/{version}/{tier_key}.json"

            # 기존 파일 불러오기
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                        # 기존 데이터 구조가 예상과 다르면 초기화
                        if not isinstance(existing, dict) or "통계" not in existing or not isinstance(existing["통계"], dict):
                            print(f"경고: {file_path} 파일 구조가 예상과 다릅니다. 초기화합니다.")
                            existing = {
                                "버전": version,
                                "티어": display_name,
                                "통계": {}
                            }
                    except json.JSONDecodeError:
                        print(f"경고: {file_path} 파일이 손상되어 초기화합니다.")
                        existing = {
                            "버전": version,
                            "티어": display_name,
                            "통계": {}
                        }
            else:
                existing = {
                    "버전": version,
                    "티어": display_name,
                    "통계": {}
                }

            # 2. 현재 시각 데이터 추가 - 같은 시각에 실행되면 최신 데이터로 덮어쓰도록 수정 (이전 수정 유지)
            existing["통계"][now] = data

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False, indent=2)

            # versions.json 자동 갱신
            update_versions_json(version)

            print(f"[{tier_key}] {len(data)}개 실험체 데이터 저장 완료.")

        except Exception as e:
            # Playwright나 페이지 로딩/대기 중 발생한 치명적인 오류 처리
            print(f"[{tier_key}] 크롤링 중 치명적인 오류 발생: {e}")
        finally:
            # 오류 발생 여부와 상관없이 브라우저 닫기
            if browser:
                browser.close()


# 버전 목록 갱신 함수 (이전 수정 유지)
def update_versions_json(version):
    versions_file_path = "versions.json"  # 루트 폴더에 위치한 versions.json 파일 경로로 수정

    # 기존 versions.json 로드
    if os.path.exists(versions_file_path):
        try:
            with open(versions_file_path, "r", encoding="utf-8") as f:
                versions = json.load(f)
            # 로드된 데이터가 리스트가 아니면 초기화 (오류 방지)
            if not isinstance(versions, list):
                 print(f"경고: {versions_file_path} 파일 구조가 예상과 다릅니다. 초기화합니다.")
                 versions = []
        except json.JSONDecodeError:
            # JSON 파싱 오류 발생 시 초기화
            print(f"경고: {versions_file_path} 파일이 손상되어 초기화합니다.")
            versions = []
    else:
        versions = []

    # 새로운 버전 추가 (중복 체크)
    if version != "unknown" and version not in versions: # 'unknown' 버전은 추가하지 않음
        versions.append(version)

    # 최신 버전 순으로 정렬 (내림차순)
    try:
        # 버전 번호를 기준으로 정렬 시도 (예: 0.90.0, 0.89.0)
        # 간단하게 문자열 내림차순 정렬도 대부분의 경우 작동
        versions.sort(reverse=True)
    except Exception as e:
        print(f"경고: 버전 목록 정렬 중 오류 발생: {e}")
        # 정렬 실패 시 정렬 없이 저장 (최악의 경우)


    # versions.json 파일에 저장
    try:
        with open(versions_file_path, "w", encoding="utf-8") as f:
            json.dump(versions, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"오류: {versions_file_path} 파일 저장 실패: {e}")


# 크롤링 실행 (원본과 동일)
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