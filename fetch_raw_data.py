import requests
import json
import os
import time

# --- 설정 ---
# 이터널 리턴 API 키
# NOTE: 보안을 위해 실제 운영 시에는 환경 변수 등으로 관리하는 것을 권장합니다.
API_KEY = "BpfAUSJdkt66sXuIPSVaU142jXiLNRNI6tEVUco7"
API_BASE_URL = "https://open-api.bser.io"
OUTPUT_RAW_DIR = "data/er/raw"

# API 요청 간 지연 시간 (개인용 키 제한: 1초에 1개 요청)
REQUEST_DELAY = 1.1 # 1초보다 약간 길게 설정하여 안정성 확보

# --- API 데이터 가져오기 함수 ---

def fetch_api_data(endpoint, params=None):
    """
    지정된 엔드포인트에서 API 데이터를 가져오는 함수.
    요청 간 지연 시간을 적용하며, 성공 시 응답 JSON 객체 전체를 반환합니다.
    """
    url = f"{API_BASE_URL}{endpoint}"
    headers = {
        "x-api-key": API_KEY,
        "accept": "application/json"
    }
    
    print(f"Fetching data from {url}...")
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status() # 200 이외의 상태 코드에 대해 예외 발생
        data = response.json()
        
        if data.get('code') == 200:
            print("Fetch successful.")
            # 성공 시 응답 JSON 객체 전체를 반환
            return data 
        else:
            # API 응답은 받았지만 code가 200이 아닌 경우
            print(f"API returned non-200 code {data.get('code')}: {data.get('message')} for {url}")
            return None
            
    except requests.exceptions.RequestException as e:
        # API 요청 중 네트워크 오류 등 발생
        print(f"API request failed for {url}: {e}")
        return None
    except json.JSONDecodeError:
         # 유효한 JSON 응답이 아닌 경우
        print(f"Failed to decode JSON response from {url}")
        return None
    except Exception as e:
         # 기타 예상치 못한 오류
         print(f"An unexpected error occurred fetching from {url}: {e}")
         return None
    finally:
        # API 요청 후 지연 시간 적용
        print(f"Waiting for {REQUEST_DELAY} seconds...")
        time.sleep(REQUEST_DELAY)

def download_text_from_url(url):
    """
    지정된 URL에서 텍스트 파일 내용을 다운로드하는 함수.
    """
    print(f"Downloading text from {url}...")
    try:
        # L10N URL 요청 시에도 API 키 필요 여부는 불확실하지만, 안전하게 헤더 포함 시도
        headers = {"x-api-key": API_KEY}
        response = requests.get(url, headers=headers)
        response.raise_for_status() # HTTP 에러 발생 시 예외 throw
        # 인코딩 추정 또는 명시 (L10N 파일이 UTF-8이라고 가정)
        response.encoding = 'utf-8'
        print("Download successful.")
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Failed to download text from url {url}: {e}")
        return None
    except Exception as e:
         # 기타 예상치 못한 오류
         print(f"An unexpected error occurred downloading from {url}: {e}")
         return None
    finally:
        # 다운로드 후에도 지연 시간 적용 (안전하게)
        print(f"Waiting for {REQUEST_DELAY} seconds...")
        time.sleep(REQUEST_DELAY)


def parse_l10n_text(text_content):
    """
    L10N 텍스트 내용을 파싱하여 Key-Value 딕셔너리로 반환하는 함수.
    """
    l10n_data = {}
    if not text_content:
        return l10n_data

    print("Parsing L10N text...")
    lines = text_content.splitlines()
    for line in lines:
        if '┃' in line:
            key, value = line.split('┃', 1) # 첫 번째 '┃' 기준으로 분리
            # 모든 Key-Value 쌍을 저장 (후처리 스크립트에서 필터링)
            l10n_data[key] = value

    print(f"L10N parsing complete. Extracted {len(l10n_data)} entries.")
    return l10n_data

def save_raw_data(data, filename):
    """
    가져온 원본 데이터를 JSON 파일로 저장하는 함수.
    """
    # 저장될 디렉토리 경로 확인 및 생성
    if not os.path.exists(OUTPUT_RAW_DIR):
        os.makedirs(OUTPUT_RAW_DIR)

    # 파일 전체 경로
    filepath = os.path.join(OUTPUT_RAW_DIR, filename)

    print(f"Saving raw data to {filepath}...")
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print("Data saved successfully.")
    except IOError as e:
        print(f"Error saving data to file {filepath}: {e}")
    except Exception as e:
         print(f"An unexpected error occurred saving data to {filepath}: {e}")


# --- 메인 실행 로직 ---

if __name__ == "__main__":
    print("Starting raw data fetching script...")

    # 1. /v2/data 엔드포인트에서 JSON 데이터 가져와 저장
    v2_data_meta_types = [
        "Character",
        "CharacterLevelUpStat",
        "CharacterMastery",
        "MasteryStat",
        "WeaponTypeInfo",
        "ItemWeapon",
        "ItemArmor",
    ]

    for meta_type in v2_data_meta_types:
        raw_response = fetch_api_data(f"/v2/data/{meta_type}")
        if raw_response:
            # 원본 응답 전체를 저장 (code, message, data 등을 포함)
            save_raw_data(raw_response, f"{meta_type}.json")


    # 2. /v1/l10n/Korean 데이터 가져와 링크에서 텍스트 다운로드 후 파싱하여 JSON 저장
    print("\n--- Fetching L10N Data ---")
    l10n_response = fetch_api_data("/v1/l10n/Korean") # /v1 엔드포인트 호출

    # L10N URL 확인 및 다운로드/파싱/저장 로직 (딕셔너리 직접 접근 방식으로 수정 및 디버그 추가)
    l10n_url = None
    data_content = None

    print(f"Debug 1: l10n_response is {type(l10n_response)} and is it None? {l10n_response is None}")
    if isinstance(l10n_response, dict):
        data_content = l10n_response.get("data")
        print(f"Debug 3: Data content extracted: {data_content}. Type: {type(data_content)}. Is it None? {data_content is None}")
        if isinstance(data_content, dict):
            # --- 디버그: data_content 딕셔너리의 실제 키 목록 출력 ---
            print(f"Debug: Keys found in data_content dictionary: {list(data_content.keys())}")
            
            # --- 수정된 부분: 'l10nPath' 대신 'l10Path' 키에 접근 ---
            try:
                l10n_url = data_content["l10Path"] # <-- 여기를 수정했습니다!
                print(f"Debug 5 (Modified): l10Path extracted: {l10n_url}. Type: {type(l10n_url)}. Is it None? {l10n_url is None}")
            except KeyError:
                print("Debug 5 (Modified): KeyError: 'l10Path' key not found in data_content dictionary.") # <-- 메시지도 l10Path로 수정
                l10n_url = None # 키가 없으면 None으로 설정
            except Exception as e:
                 print(f"Debug 5 (Modified): An unexpected error occurred accessing 'l10Path': {e}") # <-- 메시지도 l10Path로 수정
                 l10n_url = None


    # Final check before proceeding
    if l10n_url and isinstance(l10n_url, str): # URL이 유효한 문자열인 경우
        print(f"L10n download URL obtained and validated: {l10n_url}") # This should now print if conditions are met

        text_content = download_text_from_url(l10n_url) # 텍스트 파일 다운로드

        if text_content is not None: # 다운로드 실패 시 None 반환 가능성 있음
            print(f"L10n text content downloaded (first 100 chars): {text_content[:100]}...")

            # 텍스트 내용을 파싱하여 JSON으로 저장 (요청 사항 반영)
            l10n_parsed_data = parse_l10n_text(text_content)

            if l10n_parsed_data:
                 print(f"L10n text parsed successfully. Number of entries: {len(l10n_parsed_data)}")
                 # 파싱된 L10N 데이터를 JSON으로 저장
                 save_raw_data(l10n_parsed_data, "l10n_korean.json")
            else:
                 print("Warning: L10n text parsed result is empty. l10n_korean.json will not be saved.")
                 print("Check if the downloaded text file contains '┃' separated key-value pairs.")
        else:
             print("Warning: Failed to download L10n text content.")

    else:
        # l10n_url을 얻지 못한 경우
        print("Warning: Failed to get L10n text URL from API or response structure unexpected.")
        # Print original response for debugging
        print(f"L10n API raw response received: {l10n_response}") 
        # Print extracted components for debugging (updated based on new extraction)
        print(f"Debug final check: l10n_url={l10n_url}, isinstance(l10n_url, str)={isinstance(l10n_url, str)}, bool(l10n_url)={bool(l10n_url)}")


    print("\nRaw data fetching script finished.")