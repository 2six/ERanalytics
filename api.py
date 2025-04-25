import requests
import json
import os

# 이터널 리턴 API 키
# NOTE: 보안을 위해 실제 운영 시에는 환경 변수 등으로 관리하는 것을 권장합니다.
API_KEY = "BpfAUSJdkt66sXuIPSVaU142jXiLNRNI6tEVUco7"
API_BASE_URL = "https://open-api.bser.io"

def get_characters_data():
    """
    이터널 리턴 API에서 캐릭터 목록 데이터를 가져오는 함수.
    """
    endpoint = f"{API_BASE_URL}/v1/characters"
    headers = {
        "x-api-key": API_KEY
    }

    try:
        response = requests.get(endpoint, headers=headers)
        response.raise_for_status()  # HTTP 에러 발생 시 예외 throw

        data = response.json()

        # API 응답 구조 확인 및 캐릭터 리스트 추출
        if data and data.get('code') == 200 and 'characters' in data:
            return data['characters']
        else:
            print(f"API 응답 형식이 예상과 다릅니다: {data}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"API 요청 중 오류 발생: {e}")
        return None
    except json.JSONDecodeError:
        print("API 응답 JSON 디코딩 오류.")
        return None

def save_data_to_json(data, filename):
    """
    데이터를 JSON 파일로 저장하는 함수.
    """
    # 저장될 디렉토리 경로
    output_dir = "data/er"
    # 디렉토리가 없으면 생성
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 파일 전체 경로
    filepath = os.path.join(output_dir, filename)

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"데이터를 {filepath}에 성공적으로 저장했습니다.")
    except IOError as e:
        print(f"파일 저장 중 오류 발생: {e}")

# 스크립트 실행 부분
if __name__ == "__main__":
    print("이터널 리턴 캐릭터 목록 데이터를 가져오는 중...")
    characters_list = get_characters_data()

    if characters_list is not None:
        save_data_to_json(characters_list, "characters.json")
    else:
        print("캐릭터 목록 데이터를 가져오는데 실패했습니다.")