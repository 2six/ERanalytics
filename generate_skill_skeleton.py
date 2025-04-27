import json
import os
import re # 정규 표현식 사용을 위해 re 모듈 import
import copy # 딕셔너리를 복사하기 위해 copy 모듈 import

# --- 설정 ---
RAW_DATA_DIR = "data/er/raw"
# manual_skill_stats.json 파일은 raw 디렉토리와 같은 레벨인 data/er/에 있다고 가정합니다.
MANUAL_SKILL_STATS_FILE = os.path.join("data", "er", "manual_skill_stats.json")

# 대상 캐릭터 코드는 Character.json에서 가져온 전체 캐릭터 코드를 사용하거나,
# 특정 캐릭터만 필요하다면 여기에 리스트로 정의할 수 있습니다.
# 여기서는 모든 캐릭터의 고유 스킬 뼈대를 생성합니다.
# 특정 캐릭터만 필요하다면 아래 필터링 로직을 추가하세요.
# TARGET_CHARACTER_CODES = [76, 23] 

# 스킬 코드 뒷 3자리 XYZ 패턴 분석을 위한 기본 스킬 타입 매핑 (X 값 기준)
# L10N 데이터에 존재하는 모든 고유 스킬 패턴을 포함하도록 필요에 따라 업데이트해야 합니다.
SKILL_X_TO_BASE_TYPE_MAP = {
    1: "P",
    2: "Q",
    3: "W",
    4: "E",
    5: "R",
    # TODO: L10N 데이터를 보고 다른 X 값이 있다면 추가
}

# Y 값에 따른 접미사 매핑
# L10N 데이터에 존재하는 모든 고유 스킬 패턴을 포함하도록 필요에 따라 업데이트해야 합니다.
SKILL_Y_TO_SUFFIX_MAP = {
    0: "", # Y=0 이면 접미사 없음
    1: "2",
    2: "3",
    3: "4",
    # TODO: L10N 데이터를 보고 다른 Y 값이 있다면 추가
}

# L10N Coef 텍스트에서 {n} 형태의 플레이스홀더를 찾는 정규 표현식
PLACEHOLDER_REGEX = re.compile(r"\{(\d+)\}")


# --- 데이터 로드 함수 ---

def load_json_data_raw(filepath):
    """
    JSON 파일에서 원본 데이터를 그대로 로드하는 함수.
    API 응답 구조인 경우 { "code": ..., "data": [...] } 전체를 반환합니다.
    L10N JSON인 경우 { "key": "value", ... } 전체를 반환합니다.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"Loaded raw data from {filepath}")
        return data
    except FileNotFoundError:
        print(f"Raw data file not found: {filepath}. Returning None.")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON from raw data file: {filepath}. Returning None.")
        return None
    except IOError as e:
        print(f"Error reading raw data file {filepath}: {e}. Returning None.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred loading raw data from {filepath}: {e}. Returning None.")
        return None

# --- 수동 파일 로드 함수 ---
def load_manual_skill_stats_existing(filepath):
     """
     기존 manual_skill_stats.json 파일을 로드하는 함수.
     """
     print(f"Loading existing manual skill stats from {filepath}... ") # 공백 추가
     try:
         with open(filepath, 'r', encoding='utf-8') as f:
             manual_stats = json.load(f)
         print("Existing manual skill stats loaded successfully.")
         return manual_stats
     except FileNotFoundError:
         print(f"Existing manual skill stats file not found: {filepath}. Returning empty dictionary for new skeleton.")
         return {} # 파일 없으면 빈 딕셔너리 반환
     except json.JSONDecodeError:
         print(f"Error decoding JSON from existing manual skill stats file: {filepath}. Returning empty dictionary and NOT attempting merge.")
         return {} # JSON 오류 시 병합 시도하지 않고 빈 딕셔너리 반환
     except IOError as e:
         print(f"Error reading existing manual skill stats file: {e}. Returning empty dictionary for new skeleton.")
         return {}
     except Exception as e:
         print(f"An unexpected error occurred loading existing manual skill stats from {filepath}: {e}. Returning empty dictionary.")
         return {}


# --- 뼈대 생성 함수 ---

def generate_skill_skeleton(raw_l10n_data, raw_character_data, existing_manual_stats):
    """
    L10N 데이터를 기반으로 manual_skill_stats.json 파일의 뼈대를 생성하고 기존 데이터와 병합하는 함수.
    캐릭터 고유 스킬만 포함합니다.
    """
    print("Generating manual_skill_stats.json skeleton...")
    # 기존 데이터를 복사하여 시작합니다. 새로 생성/업데이트된 스킬 정보로 덮어쓰거나 추가합니다.
    final_skill_skeleton = copy.deepcopy(existing_manual_stats) 

    if not raw_l10n_data:
        print("Error: L10N raw data not loaded or empty. Cannot generate skeleton.")
        # L10N 데이터 없으면 기존 데이터 그대로 반환 (또는 빈 딕셔너리)
        return final_skill_skeleton 
        
    # Character.json 데이터에서 유효한 캐릭터 코드 목록 추출 (유효성 검사용)
    if not raw_character_data or not raw_character_data.get('data'):
        print("Error: Character raw data not loaded or empty. Cannot validate character codes.")
        print("Proceeding without character code validation based on Character.json.")
        valid_char_codes = None # 유효성 검사 건너뜀을 표시
    else:
         # Character.json의 'data' 리스트에서 코드 추출
         valid_char_codes = {c.get('code') for c in raw_character_data.get('data', []) if c and c.get('code') is not None}
         print(f"Loaded {len(valid_char_codes)} valid character codes for validation.")

    # L10N 데이터에서 "Skill/Group/Name/10"으로 시작하는 키 찾기 (캐릭터 고유 스킬 패턴 추정)
    # 이 패턴이 모든 캐릭터 고유 스킬을 포함하는지 확인 필요.
    skill_name_keys = [key for key in raw_l10n_data.keys() if key.startswith("Skill/Group/Name/10")]

    print(f"Found {len(skill_name_keys)} potential character-specific skill name keys in L10N data based on '10' prefix.")

    # 디버그: L10N에서 찾은 스킬 코드의 뒷 3자리(variant) 값들을 수집 (오류 원인 파악용)
    # found_skill_variants = set()

    processed_skill_codes = set() # 이미 처리된 스킬 코드 (중복 방지)

    for skill_name_key in skill_name_keys:
        try:
            # 스킬 코드 문자열 추출 (Skill/Group/Name/ 접두사 제거)
            skill_code_str = skill_name_key.split("/")[-1]

            # 이미 처리된 스킬 코드는 건너뛰기 (L10N에 중복 키가 있을 수 있으므로)
            if skill_code_str in processed_skill_codes:
                # print(f"Skipping duplicate skill code key: {skill_name_key}")
                continue
            processed_skill_codes.add(skill_code_str)
            
            # 스킬 코드 패턴 분석: 10{char}XYZ
            if not skill_code_str.startswith("10") or len(skill_code_str) < 6:
                 # print(f"Skipping skill code key {skill_name_key}: Does not match expected '10{{char}}XYZ' pattern length.")
                 continue # 패턴 길이 확인

            char_code_candidate_str = skill_code_str[2:-3] # '10' 제거, 뒤 3자리 제거하여 캐릭터 코드 후보 문자열 추출
            skill_variant_str = skill_code_str[-3:]     # 뒷 3자리 XYZ 문자열 추출

            # --- 오류 수정 부분: skill_code 변수를 여기서 정의하고 사용합니다. ---
            # skill_code_int = int(skill_code_str) # 정수로 변환한 값 (필요시 사용)
            char_code_candidate = int(char_code_candidate_str)
            skill_variant = int(skill_variant_str)


            # 디버그: 현재 스킬의 variant 값과 char_code 후보 출력 (오류 원인 파악용)
            # print(f"Processing skill {skill_code_str}: Variant={skill_variant}, CharCandidate={char_code_candidate}")
            # found_skill_variants.add(skill_variant) # variant 값 수집


            # 캐릭터 코드 유효성 검사 (Character.json 데이터 사용)
            if valid_char_codes is not None and char_code_candidate not in valid_char_codes:
                 # print(f"Skipping skill code {skill_code_str}: Character code {char_code_candidate} not found in Character.json.")
                 continue # Character.json에 없는 캐릭터의 스킬은 스킵


            # skillKey 결정 로직 (사용자 최종 규칙 반영 - XYZ 분석)
            x_val = skill_variant // 100
            y_val = (skill_variant % 100) // 10
            # z_val = skill_variant % 10 # Z 값은 사용되지 않음

            base_skill_type = SKILL_X_TO_BASE_TYPE_MAP.get(x_val)
            suffix = SKILL_Y_TO_SUFFIX_MAP.get(y_val)

            # base_skill_type과 suffix가 모두 유효한 경우만 캐릭터 고유 스킬로 판단하고 skillKey 생성
            # Y=0 패턴은 suffix="" 이므로 suffix is not None 체크가 필요.
            if base_skill_type is not None and suffix is not None:
                 skill_key = base_skill_type + suffix
                 # TODO: Z=0 인지 추가로 확인하는 것이 더 정확할 수 있습니다. (현재는 Y 매핑만 확인)
                 # if z_val != 0:
                 #     print(f"Warning: Skill code {skill_code_str} has Z value {z_val} != 0. Check if this is expected.")

            else:
                 # print(f"Skipping skill code {skill_code_str}: Variant {skill_variant} (X={x_val}, Y={y_val}) does not match known character skill key patterns.")
                 continue # 알려진 고유 스킬 패턴이 아니면 스킵


            # L10N에서 다른 텍스트 필드 조회
            l10n_coef_key = f"Skill/Group/Coef/{skill_code_str}" 
            l10n_desc_key = f"Skill/Group/Desc/{skill_code_str}"
            l10n_lobby_desc_key = f"Skill/LobbyDesc/{skill_code_str}"
            l10n_expansion_tip_key = f"Skill/Group/ExpansionTip/{skill_code_str}" # 확장팁 키

            skill_name = raw_l10n_data.get(skill_name_key, f"Unknown Skill Name ({skill_code_str})")
            l10n_coef_text = raw_l10n_data.get(l10n_coef_key, "") # 없으면 빈 문자열
            l10n_desc_text = raw_l10n_data.get(l10n_desc_key, "") # 없으면 빈 문자열
            l10n_lobby_desc_text = raw_l10n_data.get(l10n_lobby_desc_key, "") # 없으면 빈 문자열
            l10n_expansion_tip_text = raw_l10n_data.get(l10n_expansion_tip_key, "") # 확장팁 텍스트 (없으면 빈 문자열)

            # --- Placeholder 및 Coefficient 구조 자동 생성/채움 ---
            # L10N Coef 텍스트에서 {n} 플레이스홀더 찾기
            found_placeholders_str = PLACEHOLDER_REGEX.findall(l10n_coef_text)
            # 문자열 플레이스홀더 인덱스들을 정수로 변환하여 정렬
            sorted_placeholder_indices = sorted(list(set(int(p) for p in found_placeholders_str)))

            placeholder_mapping_structure = {} # placeholder 객체 (키는 "{n}" 형태)
            coefficient_structure = {} # coefficient 객체 (키는 "{n}" 형태)
            
            # placeholderMapping 및 coefficient 구조 생성
            for i in sorted_placeholder_indices:
                 placeholder_str = f"{{{i}}}" # 예: "{0}", "{1}"

                 # placeholderMapping에 "{n}": "" 형태로 추가
                 # 초기값은 빈 문자열. 사용자가 채움.
                 placeholder_mapping_structure[placeholder_str] = ""

                 # coefficient에 해당 "{n}" 키와 빈 리스트 추가
                 coefficient_structure[placeholder_str] = []


            # --- 새로 생성될 스킬 뼈대의 기본 구조 정의 ---
            new_skill_entry_base_skeleton = {
                "characterCode": char_code_candidate,
                "skillKey": skill_key, # Variant XYZ 분석 결과
                "skillName": skill_name,
                "l10nCoefText": l10n_coef_text,
                "l10nDescText": l10n_desc_text,
                "l10nLobbyDescText": l10n_lobby_desc_text,
                "l10nExpansionTipText": l10n_expansion_tip_text, # 확장팁 텍스트 추가

                "placeholder": placeholder_mapping_structure, # 자동 생성된 placeholder Mapping 객체
                "coefficient": coefficient_structure, # 자동 생성된 coefficient 구조
                
                # <-- placeholder나 coefficient에 포함되지 않는 기본 정보 필드들 (빈 값 제공)
                "baseDamage": [], # 사용자 요청 반영: 기본 피해량 필드 (빈 리스트 제공)
                "cooldown": [],             # 사용자 요청 반영: 쿨다운 필드 (빈 리스트 제공)
                "costType": "",             # 사용자 요청 반영: 소모 타입 필드 (빈 문자열 제공)
                "cost": [],                 # 사용자 요청 반영: 소모 값 필드 (빈 리스트 제공)
                "range": []                 # 사용자 요청 반영: 사거리 필드 (빈 리스트 제공)
                # 다른 수치 필드들은 사용자가 l10nCoefText를 보고 직접 추가하고 채움.
            }

            # --- 기존 데이터와 병합 ---
            skill_code_str_key = skill_code_str # 딕셔너리 키로 사용할 문자열 코드
            
            if skill_code_str_key in existing_manual_stats:
                # 기존 파일에 해당 스킬 코드가 존재하는 경우
                existing_data = existing_manual_stats[skill_code_str_key]
                merged_skill_entry = copy.deepcopy(existing_data) # 기존 데이터를 복사하여 시작

                # 새로 생성된 뼈대 정보로 특정 필드를 업데이트 (L10N 텍스트, auto-generated structure)
                merged_skill_entry.update({
                    "characterCode": new_skill_entry_base_skeleton["characterCode"],
                    "skillKey": new_skill_entry_base_skeleton["skillKey"],
                    "skillName": new_skill_entry_base_skeleton["skillName"],
                    "l10nCoefText": new_skill_entry_base_skeleton["l10nCoefText"],
                    "l10nDescText": new_skill_entry_base_skeleton["l10nDescText"],
                    "l10nLobbyDescText": new_skill_entry_base_skeleton["l10nLobbyDescText"],
                    "l10nExpansionTipText": new_skill_entry_base_skeleton["l10nExpansionTipText"],
                    # placeholder와 coefficient 구조는 새로 생성된 것으로 업데이트 (수동 채운 값은 유지)
                    "placeholder": new_skill_entry_base_skeleton["placeholder"], # placeholder Mapping 객체로 덮어씀
                    "coefficient": new_skill_entry_base_skeleton["coefficient"], # coefficient 객체로 덮어씀
                    # baseDamage, cooldown, costType, cost, range 등은 기존 데이터에 값이 있다면 그대로 사용
                    # (update는 기존 키가 있으면 덮어쓰므로, 위에서 update하지 않은 필드는 기존 값이 유지됨)
                })

                # 사용자 정의 필드 (baseDamage 등)는 existing_data에 있다면 이미 복사되어 merged_skill_entry에 있고,
                # 위 update에서 덮어쓰지 않았으므로 기존 값이 유지됩니다. (주의: baseDamage는 이제 기본 필드임)

                # 만약 기존 데이터에 없던 새로운 기본 필드 (cooldown 등)가 뼈대에 추가되었다면,
                # 뼈대 정의 시 기본값([])으로 추가된 필드가 merged_skill_entry에 없을 수 있습니다.
                # 뼈대 기본값으로 최종 merged_skill_entry에 추가되지 않은 기본 필드 채우기
                # placeholder와 coefficient는 위에서 이미 업데이트되었으므로 여기서는 건너뜀.
                skeleton_base_and_auto_fields = [
                    "characterCode", "skillKey", "skillName",
                    "l10nCoefText", "l10nDescText", "l10nLobbyDescText", "l10nExpansionTipText",
                    "placeholder", "coefficient", # 이 두 필드도 뼈대 필드임
                    "baseDamage", "cooldown", "costType", "cost", "range"
                ]
                for key, default_value in new_skill_entry_base_skeleton.items():
                    if key not in merged_skill_entry:
                         # 기존 데이터에 없던 필드는 뼈대의 기본값으로 채움
                         merged_skill_entry[key] = default_value 
                    # elif key == "coefficient" and isinstance(default_value, dict) and isinstance(merged_skill_entry.get(key), dict):
                        # coefficient 내부의 {n} 리스트에 대한 기존 값 병합 로직 (필요시 추가)
                        # 현재는 coefficient 구조 자체가 뼈대로 덮어쓰이고, 내부의 빈 리스트는 유지됨.

                # 최종 병합된 스킬 항목
                final_skill_entry = merged_skill_entry

            else:
                # 기존 파일에 해당 스킬 코드가 존재하지 않는 경우 (새로운 스킬)
                final_skill_entry = new_skill_entry_base_skeleton # 새로 생성된 뼈대 그대로 사용

            # 뼈대 딕셔너리에 추가 (스킬 코드를 문자열 키로)
            final_skill_skeleton[skill_code_str_key] = final_skill_entry

        except ValueError:
            print(f"Warning: Could not convert skill code key '{skill_code_str}' to integer or analyze pattern. Skipping.")
        except Exception as e:
            print(f"Warning: An error occurred processing skill key '{skill_name_key}': {e}. Skipping.")
            import traceback
            traceback.print_exc() # 예외 발생 시 전체 트레이스백 출력 (디버그용)


    # TODO: 기존 파일에 있었으나 L10N에서 더 이상 찾을 수 없는 스킬 항목 처리
    # (예: is_deprecated 플래그 추가 또는 그대로 유지)
    # 현재 로직으로는 L10N에 있는 스킬만 최종 파일에 포함합니다.
    # existing_manual_stats에만 있는 스킬들을 final_skill_skeleton에 추가하는 로직이 필요합니다.
    for skill_code_str_key, existing_data in existing_manual_stats.items():
         if skill_code_str_key not in final_skill_skeleton:
              # L10N에서는 찾을 수 없지만 기존 파일에 있는 스킬 항목
              # 이 항목을 그대로 유지하거나, is_deprecated 플래그 등을 추가하여 final_skill_skeleton에 추가
              print(f"Info: Keeping skill code {skill_code_str_key} from existing manual stats (not found in current L10N).")
              final_skill_skeleton[skill_code_str_key] = existing_data # 기존 데이터를 그대로 유지


    print(f"Skeleton generation complete. Generated skeleton for {len(final_skill_skeleton)} skills (including existing).")
    # 디버그: 최종 스킬 코드 목록 출력
    print(f"Debug: Final skill codes in skeleton: {list(final_skill_skeleton.keys())}")

    return final_skill_skeleton

# --- 파일 저장 함수 ---

def save_json_data(data, filepath):
    """
    딕셔너리 데이터를 JSON 파일로 저장하는 함수.
    """
    # 저장될 디렉토리 경로 확인 및 생성
    output_dir = os.path.dirname(filepath)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Saving data to {filepath}...")
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print("Data saved successfully.")
    except IOError as e:
        print(f"Error saving data to {filepath}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred saving data to {filepath}: {e}")


# --- 메인 실행 로직 ---

if __name__ == "__main__":
    print("Starting skill skeleton generation script...")

    # 1. 필요한 원본 데이터 로드
    raw_l10n_filepath = os.path.join(RAW_DATA_DIR, "l10n_korean.json")
    raw_character_filepath = os.path.join(RAW_DATA_DIR, "Character.json")
    
    # 기존 manual_skill_stats.json 파일 로드
    existing_manual_stats = load_manual_skill_stats_existing(MANUAL_SKILL_STATS_FILE)

    # 원본 데이터는 load_json_data_raw로 로드
    raw_l10n_data = load_json_data_raw(raw_l10n_filepath)
    raw_character_data = load_json_data_raw(raw_character_filepath)


    if raw_l10n_data is not None and raw_character_data is not None:
        # 2. 스킬 뼈대 생성 및 기존 데이터와 병합
        skill_skeleton_data = generate_skill_skeleton(raw_l10n_data, raw_character_data, existing_manual_stats)

        # 3. 뼈대 데이터 저장
        if skill_skeleton_data:
            save_json_data(skill_skeleton_data, MANUAL_SKILL_STATS_FILE)
        else:
            print("No skill skeleton data generated (empty after processing). manual_skill_stats.json will not be created/updated.")

    else:
        print(f"Required raw data files ({raw_l10n_filepath}, {raw_character_filepath}) not found or failed to load.")
        print("Please ensure these files exist and are valid JSON (generated by fetch_raw_data.py).")


    print("Skill skeleton generation script finished.")