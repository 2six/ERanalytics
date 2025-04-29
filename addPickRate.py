import os
import json

# 이 스크립트는 기존 JSON 파일들을 수정합니다. 실행 전에 백업을 권장합니다.

def add_pick_rate_to_json_file(file_path: str):
    """
    주어진 JSON 파일에 저장된 각 타임스탬프별 통계 데이터에 픽률을 계산하여 추가합니다.

    Args:
        file_path: 픽률을 추가할 JSON 파일의 경로
    """
    if not os.path.exists(file_path):
        print(f"경고: 파일이 존재하지 않습니다 - {file_path}")
        return

    print(f"처리 중: {file_path}")

    data = None
    try:
        # 파일 읽기
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 데이터 구조 유효성 간단 체크
        if not isinstance(data, dict) or "통계" not in data or not isinstance(data["통계"], dict):
            print(f"경고: 파일 구조가 예상과 다릅니다. 스킵합니다 - {file_path}")
            return

        statistics_by_time = data.get("통계", {}) # '통계' 키가 없으면 빈 딕셔너리 사용

        # 각 타임스탬프(시간대)별 통계 데이터 처리
        for timestamp, char_list in statistics_by_time.items():
            if not isinstance(char_list, list):
                print(f"경고: '{timestamp}'의 데이터가 리스트 형식이 아닙니다. 스킵합니다 - {file_path}")
                continue

            # 해당 타임스탬프의 총 표본수 계산
            total_sample = sum(item.get("표본수", 0) for item in char_list if isinstance(item, dict) and "표본수" in item)

            # 각 실험체/무기 조합에 픽률 추가
            for item in char_list:
                if not isinstance(item, dict):
                    print(f"경고: '{timestamp}'의 항목 중 딕셔너리가 아닌 항목이 있습니다. 스킵합니다 - {item} in {file_path}")
                    continue

                sample_size = item.get("표본수", 0) # 표본수 가져오기 (없으면 0)

                # 픽률 계산 (총 표본수가 0이 아니면 계산, 아니면 0)
                pick_rate = (sample_size / total_sample) if total_sample > 0 else 0.0

                # 픽률 추가 또는 업데이트 (소수점 넷째 자리까지 반올림)
                item["픽률"] = round(pick_rate, 4)

        # 수정된 데이터를 기존 파일에 덮어쓰기
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"성공적으로 픽률 추가 완료: {file_path}")

    except json.JSONDecodeError:
        print(f"오류: JSON 디코딩 실패 - {file_path}")
    except Exception as e:
        print(f"오류 처리 중 예외 발생: {e} - {file_path}")


# 스크립트 실행 부분
if __name__ == "__main__":
    # JSON 파일들이 저장된 베이스 디렉토리
    # 이전에 요청하신대로 'stats' 폴더를 사용합니다.
    base_directory = "stats" # 또는 "data" (기존 파일들이 어디에 있는지 확인 필요)

    if not os.path.isdir(base_directory):
        print(f"오류: 베이스 디렉토리 '{base_directory}'가 존재하지 않습니다.")
        print("스크립트를 실행하기 전에 JSON 파일들이 이 폴더 아래에 있는지 확인해주세요.")
    else:
        print(f"'{base_directory}' 디렉토리 및 하위 폴더의 JSON 파일들을 탐색합니다...")
        processed_count = 0
        skipped_count = 0

        # 디렉토리 트리 순회하며 모든 JSON 파일 찾기
        for root, dirs, files in os.walk(base_directory):
            for file_name in files:
                if file_name.endswith(".json"):
                    full_file_path = os.path.join(root, file_name)

                    # 이미 픽률이 추가된 파일인지 확인 (선택 사항이지만 안전함)
                    # 첫 번째 데이터 항목에 '픽률' 키가 있는지 확인하는 간단한 방법 사용
                    try:
                        with open(full_file_path, "r", encoding="utf-8") as f_check:
                            check_data = json.load(f_check)
                            # '통계' 키가 있고, 그 안에 어떤 타임스탬프라도 있고, 그 데이터가 리스트이고, 그 리스트에 항목이 있고, 그 항목이 딕셔너리이고, '픽률' 키가 이미 있다면 스킵
                            if (isinstance(check_data, dict) and "통계" in check_data and
                                isinstance(check_data["통계"], dict) and check_data["통계"] and
                                isinstance(list(check_data["통계"].values())[0], list) and list(check_data["통계"].values())[0] and
                                isinstance(list(check_data["통계"].values())[0][0], dict) and "픽률" in list(check_data["통계"].values())[0][0]):
                                print(f"스킵됨 (이미 픽률 포함): {full_file_path}")
                                skipped_count += 1
                                continue
                    except (json.JSONDecodeError, Exception):
                        # 파일 읽기나 구조 체크 중 오류가 나면 그냥 처리 시도 (손상된 파일일 수 있으므로)
                        pass # 오류 무시하고 아래에서 실제 처리 로직 실행

                    # 픽률 추가 함수 호출
                    add_pick_rate_to_json_file(full_file_path)
                    processed_count += 1

        print("-" * 30)
        print("JSON 파일 픽률 추가 작업 완료.")
        print(f"처리된 파일 수: {processed_count}")
        print(f"스킵된 파일 수: {skipped_count}")