import json
import os
import re
import copy

# --- 설정 ---
RAW_DATA_DIR = "data/er/raw"
MANUAL_SKILL_STATS_FILE = os.path.join("data", "er", "manual_skill_stats.json")

SKILL_X_TO_BASE_TYPE_MAP = {
    1: "P",
    2: "Q",
    3: "W",
    4: "E",
    5: "R",
    # L10N 데이터를 보고 다른 X 값이 있다면 추가
}

SKILL_Y_TO_SUFFIX_MAP = {
    0: "", # Y=0 이면 접미사 없음
    1: "2",
    2: "3",
    3: "4",
    # L10N 데이터를 보고 다른 Y 값이 있다면 추가
}

# L10N 텍스트에서 {n} 형태의 플레이스홀더를 찾는 정규 표현식
PLACEHOLDER_REGEX = re.compile(r"\{(\d+)\}")


# --- 데이터 로드 함수 (기존 코드 유지) ---
def load_json_data_raw(filepath):
    """
    JSON 파일에서 원본 데이터를 그대로 로드하는 함수.
    API 응답 구조인 경우 { "code": ..., "data": [...] } 전체를 반환합니다.
    L10N JSON인 경우 { "key": "value", ... } 전체를 반환합니다.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # print(f"Loaded raw data from {filepath}") # 자주 출력되어 주석 처리
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

# --- 수동 파일 로드 함수 (기존 코드 유지) ---
def load_manual_skill_stats_existing(filepath):
     """
     기존 manual_skill_stats.json 파일을 로드하는 함수.
     """
     print(f"Loading existing manual skill stats from {filepath}... ")
     try:
         with open(filepath, 'r', encoding='utf-8') as f:
             manual_stats = json.load(f)
         print("Existing manual skill stats loaded successfully.")
         return manual_stats
     except FileNotFoundError:
         print(f"Existing manual skill stats file not found: {filepath}. Returning empty dictionary for new skeleton.")
         return {}
     except json.JSONDecodeError:
         print(f"Error decoding JSON from existing manual skill stats file: {filepath}. Returning empty dictionary and NOT attempting merge.")
         return {}
     except IOError as e:
         print(f"Error reading existing manual skill stats file: {e}. Returning empty dictionary for new skeleton.")
         return {}
     except Exception as e:
         print(f"An unexpected error occurred loading existing manual skill stats from {filepath}: {e}. Returning empty dictionary.")
         return {}

# --- 딕셔너리 깊은 병합 함수 추가 ---
def deep_merge_dict(source, destination):
    """
    소스 딕셔너리를 대상 딕셔너리에 깊게 병합합니다.
    소스의 키와 값이 대상에 존재하면 덮어쓰지 않고, 대상에 없으면 추가합니다.
    리스트는 덮어씁니다 (깊은 병합 아님).
    """
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(destination.get(key), dict):
            # 키가 둘 다 딕셔너리이면 재귀적으로 깊은 병합
            # 주의: 이 버전에서는 소스 딕셔너리의 값이 대상 딕셔너리의 같은 키에 있는 값으로 덮어쓰지 않도록 수정함
            # 즉, 대상에 키가 이미 있으면 소스의 해당 키는 무시됨.
            # 만약 소스가 대상을 덮어쓰도록 하려면 아래 로직을 수정해야 함.
            # 현재 로직: 대상에 키가 없으면 추가. 있으면 기존 대상 값을 유지.
            if key not in destination:
                 destination[key] = value # 대상에 없으면 추가
            else:
                 # 대상에 키가 있으면 기존 값을 유지하며 내부 딕셔너리 병합 (이 부분은 복잡해지므로 신중하게 사용)
                 # 여기서는 플레이스홀더 병합에 사용할 것이므로, 뼈대 기본 구조에 기존 값을 얹는 방식이 더 적합함.
                 # 이 함수는 다른 일반적인 깊은 병합에 더 유용하며, 플레이스홀더 병합 로직은 별도로 구현하는 것이 좋겠음.
                 pass # 이 함수는 일단 일반적인 deep merge 예시로 남겨두고 실제 병합 로직은 generate 함수에서 구현

# --- 뼈대 생성 함수 ---

def generate_skill_skeleton(raw_l10n_data, raw_character_data, existing_manual_stats):
    """
    L10N 데이터를 기반으로 manual_skill_stats.json 파일의 뼈대를 생성하고 기존 데이터와 병합하는 함수.
    캐릭터 고유 스킬만 포함합니다.
    """
    print("Generating manual_skill_stats.json skeleton...")
    
    # 기존 데이터를 복사하여 시작합니다. L10N에 있는 스킬은 이 루프에서 업데이트되고,
    # L10N에 없는 기존 스킬은 마지막에 그대로 유지됩니다.
    final_skill_skeleton = copy.deepcopy(existing_manual_stats) 

    if not raw_l10n_data:
        print("Error: L10N raw data not loaded or empty. Cannot generate skeleton from L10N. Returning existing data.")
        return final_skill_skeleton # L10N 데이터 없으면 기존 데이터 그대로 반환

    # Character.json 데이터에서 유효한 캐릭터 코드 목록 추출 (유효성 검사용)
    if not raw_character_data or not raw_character_data.get('data'):
        print("Error: Character raw data not loaded or empty. Cannot validate character codes.")
        print("Proceeding without character code validation based on Character.json.")
        valid_char_codes = None # 유효성 검사 건너뜀을 표시
    else:
         valid_char_codes = {c.get('code') for c in raw_character_data.get('data', []) if c and c.get('code') is not None}
         print(f"Loaded {len(valid_char_codes)} valid character codes for validation.")

    # L10N 데이터에서 캐릭터 고유 스킬로 추정되는 키 찾기
    skill_name_keys = [key for key in raw_l10n_data.keys() if key.startswith("Skill/Group/Name/10")]

    print(f"Found {len(skill_name_keys)} potential character-specific skill name keys in L10N data.")

    processed_skill_codes_from_l10n = set() # L10N에서 찾아서 처리 완료된 스킬 코드 (병합 시 사용)

    for skill_name_key in skill_name_keys:
        skill_code_str = skill_name_key.split("/")[-1]

        # 이미 처리된 L10N 스킬 코드는 건너뛰기 (L10N에 중복 키가 있을 수 있으므로)
        if skill_code_str in processed_skill_codes_from_l10n:
             continue

        try:
            # 스킬 코드 패턴 분석: 10{char}XYZ
            if not skill_code_str.startswith("10") or len(skill_code_str) < 6:
                 # print(f"Skipping skill code key {skill_name_key}: Does not match expected '10{{char}}XYZ' pattern length.")
                 continue

            char_code_candidate_str = skill_code_str[2:-3]
            skill_variant_str = skill_code_str[-3:]

            char_code_candidate = int(char_code_candidate_str)
            skill_variant = int(skill_variant_str)

            # 캐릭터 코드 유효성 검사
            if valid_char_codes is not None and char_code_candidate not in valid_char_codes:
                 # print(f"Skipping skill code {skill_code_str}: Character code {char_code_candidate} not found in Character.json.")
                 continue

            # skillKey 결정 로직 (XYZ 분석)
            x_val = skill_variant // 100
            y_val = (skill_variant % 100) // 10
            # z_val = skill_variant % 10 # 현재 Z 값은 스킬 키 결정에 사용되지 않음

            base_skill_type = SKILL_X_TO_BASE_TYPE_MAP.get(x_val)
            suffix = SKILL_Y_TO_SUFFIX_MAP.get(y_val)

            # base_skill_type과 suffix가 모두 유효한 경우만 캐릭터 고유 스킬로 판단
            if base_skill_type is not None and suffix is not None:
                 skill_key = base_skill_type + suffix
            else:
                 # print(f"Skipping skill code {skill_code_str}: Variant {skill_variant} (X={x_val}, Y={y_val}) does not match known character skill key patterns.")
                 continue # 알려진 고유 스킬 패턴이 아니면 스킵

            # L10N에서 다른 텍스트 필드 조회
            l10n_coef_key = f"Skill/Group/Coef/{skill_code_str}"
            l10n_desc_key = f"Skill/Group/Desc/{skill_code_str}"
            l10n_lobby_desc_key = f"Skill/LobbyDesc/{skill_code_str}"
            l10n_expansion_tip_key = f"Skill/Group/ExpansionTip/{skill_code_str}"

            skill_name = raw_l10n_data.get(skill_name_key, f"Unknown Skill Name ({skill_code_str})")
            l10n_coef_text = raw_l10n_data.get(l10n_coef_key, "")
            l10n_desc_text = raw_l10n_data.get(l10n_desc_key, "")
            l10n_lobby_desc_text = raw_l10n_data.get(l10n_lobby_desc_key, "")
            l10n_expansion_tip_text = raw_l10n_data.get(l10n_expansion_tip_key, "")


            # --- placeholder: { coef: {}, desc: {} } 구조 생성 ---
            
            # l10nCoefText에서 플레이스홀더 추출하여 placeholder.coef 뼈대 생성
            coef_placeholders_str = PLACEHOLDER_REGEX.findall(l10n_coef_text)
            placeholder_coef_skeleton = { f"{{{i}}}": "" for i in sorted(list(set(int(p) for p in coef_placeholders_str))) }

            # l10nDescText에서 플레이스홀더 추출하여 placeholder.desc 뼈대 생성
            desc_placeholders_str = PLACEHOLDER_REGEX.findall(l10n_desc_text)
            placeholder_desc_skeleton = { f"{{{i}}}": "" for i in sorted(list(set(int(p) for p in desc_placeholders_str))) }
            # placeholder.desc의 초기값은 수동 입력을 나타내는 문자열이나 null로 할 수도 있음.
            # 예: placeholder_desc_skeleton = { f"{{{i}}}": "MANUAL_INPUT_REQUIRED" for i in sorted(list(set(int(p) for p in desc_placeholders_str))) }

            new_skill_entry_base_skeleton = {
                "code": int(skill_code_str), # 코드 필드를 추가 (필요시)
                "characterCode": char_code_candidate,
                "skillKey": skill_key,
                "skillName": skill_name,
                "l10nCoefText": l10n_coef_text,
                "l10nDescText": l10n_desc_text,
                "l10nLobbyDescText": l10n_lobby_desc_text,
                "l10nExpansionTipText": l10n_expansion_tip_text,

                # --- 수정: 새로운 placeholder 구조 반영 ---
                "placeholder": {
                    "coef": placeholder_coef_skeleton, # Coef 텍스트 기반 뼈대
                    "desc": placeholder_desc_skeleton  # Desc 텍스트 기반 뼈대
                },
                
                # --- 수정: coefficient 필드 자동 생성 제거 ---
                # coefficient 필드는 게임 로직에 사용되는 수치들을 수동으로 채우거나,
                # L10N의 다른 키에서 추출해야 할 수 있음. 여기서는 뼈대에 기본 필드로만 남겨둠.
                
                # <-- 사용자가 요청한 기본 정보 필드들 (빈 값 제공) -->
                # 이 필드들은 기존 데이터가 있다면 기존 값으로 유지됩니다.
                "cooldown": [],             # 게임 로직 쿨다운 배열
                "costType": "",             # 게임 로직 소모 타입 문자열
                "cost": [],                 # 게임 로직 소모 값 배열
                "range": []                 # 게임 로직 사거리 배열
                # 다른 수치 필드들은 사용자가 수동으로 추가하고 채움.
            }

            # --- 기존 데이터와 병합 ---
            skill_code_str_key = skill_code_str # 딕셔너리 키로 사용할 문자열 코드

            # L10N에서 찾은 스킬은 기존 데이터에 있든 없든 무조건 새로 생성된 뼈대를 기반으로 시작
            # 기존 데이터가 있다면, 뼈대에 기존 데이터를 병합하여 사용자 입력 보존
            merged_skill_entry = copy.deepcopy(new_skill_entry_base_skeleton) # 새 뼈대 복사

            if skill_code_str_key in final_skill_skeleton:
                 # 기존 파일에 해당 스킬 코드가 존재하는 경우
                 existing_data_for_merge = final_skill_skeleton[skill_code_str_key]

                 # 1. L10N 텍스트 및 기본 식별 정보는 새 뼈대 (L10N 데이터) 값으로 덮어씀 (already done by deepcopy of skeleton)
                 #    merged_skill_entry.update({ ... }) 형태 대신 deepcopy 후 병합하는 방식이 더 안전

                 # 2. placeholder 필드 병합 (기존 수동 입력 값 보존)
                 existing_placeholder = existing_data_for_merge.get("placeholder", {})
                 
                 # placeholder.coef 병합: 새 뼈대 뼈대 위에 기존 값 얹기
                 existing_coef_map = existing_placeholder.get("coef", {})
                 for ph_key, ph_value in existing_coef_map.items():
                      if ph_key in merged_skill_entry["placeholder"]["coef"]:
                           # 새 뼈대에도 있는 플레이스홀더면 기존 값 유지
                           merged_skill_entry["placeholder"]["coef"][ph_key] = ph_value
                      # else: # 새 뼈대에 없는 플레이스홀더 (L10N에서 사라짐)는 병합하지 않음 (데이터 손실)
                      #     pass # 원한다면 여기에 사라진 플레이스홀더도 유지하는 로직 추가 가능

                 # placeholder.desc 병합: 새 뼈대 뼈대 위에 기존 값 얹기
                 existing_desc_map = existing_placeholder.get("desc", {})
                 for ph_key, ph_value in existing_desc_map.items():
                     if ph_key in merged_skill_entry["placeholder"]["desc"]:
                          # 새 뼈대에도 있는 플레이스홀더면 기존 값 유지
                          merged_skill_entry["placeholder"]["desc"][ph_key] = ph_value
                     # else: # 새 뼈대에 없는 플레이스홀더는 병합하지 않음 (데이터 손실)
                     #     pass # 원한다면 여기에 사라진 플레이스홀더도 유지하는 로직 추가 가능


                 # 3. baseDamage, cooldown 등 기타 기본 필드 병합 (기존 값 보존)
                 #    새 뼈대에 있지만 기존 데이터에는 없던 필드는 뼈대의 기본값([])으로 채워짐 (deepcopy 결과).
                 #    기존 데이터에 이미 있는 필드는 기존 값으로 유지되어야 함.
                 #    아래 로직은 existing_data_for_merge에 있는 필드 중 merged_skill_entry에 없는 것만 추가.
                 #    하지만 우리는 merged_skill_entry가 이미 뼈대 구조를 다 가지고 시작하므로,
                 #    existing_data_for_merge의 값을 merged_skill_entry에 덮어쓰는 방식이 더 간단.
                 
                 # 기존 데이터의 모든 키를 순회하며 병합
                 for key, value in existing_data_for_merge.items():
                     # L10N 텍스트와 자동 생성되는 기본 정보는 새 뼈대 값으로 덮어썼으므로 건너뜁니다.
                     # placeholder는 위에서 별도로 병합했습니다.
                     if key not in [
                          "code", "characterCode", "skillKey", "skillName",
                          "l10nCoefText", "l10nDescText", "l10nLobbyDescText", "l10nExpansionTipText",
                          "placeholder" # placeholder는 위에서 내부를 병합했으므로 여기서 덮어쓰지 않음
                         ]:
                          # 그 외 필드 (baseDamage, cooldown, costType, cost, range, 그리고 사용자 추가 필드 등)는
                          # 기존 데이터의 값이 있다면 그 값으로 덮어씁니다.
                          merged_skill_entry[key] = value


                 # 최종적으로 병합된 스킬 항목
                 final_skill_item_for_dict = merged_skill_entry

            else:
                # 기존 파일에 해당 스킬 코드가 존재하지 않는 경우 (새로운 스킬)
                final_skill_item_for_dict = merged_skill_entry # 새로 생성된 뼈대 그대로 사용

            # 뼈대 딕셔너리에 추가/업데이트 (스킬 코드를 문자열 키로)
            final_skill_skeleton[skill_code_str_key] = final_skill_item_for_dict
            processed_skill_codes_from_l10n.add(skill_code_str_key) # L10N에서 찾아서 처리 완료된 스킬 코드 기록

        except ValueError:
            print(f"Warning: Could not convert skill code key '{skill_code_str}' to integer or analyze pattern. Skipping.")
        except Exception as e:
            print(f"Warning: An error occurred processing skill key '{skill_name_key}' ({skill_code_str}): {e}.")
            # import traceback # 너무 많이 출력될 수 있어서 주석 처리
            # traceback.print_exc() # 예외 발생 시 전체 트레이스백 출력 (디버그용)


    # 기존 파일에 있었으나 L10N에서 더 이상 찾을 수 없는 스킬 항목은 이미 final_skill_skeleton에 deepcopy되어 있으므로
    # 별도의 추가 로직 없이 그대로 유지됩니다. (이것이 deepcopy(existing_manual_stats)로 시작한 이유)
    # L10N에서 사라진 스킬 코드를 확인하고 싶다면 processed_skill_codes_from_l10n와 existing_manual_stats의 키를 비교하면 됩니다.
    existing_skill_codes = set(existing_manual_stats.keys())
    removed_skill_codes = existing_skill_codes - processed_skill_codes_from_l10n

    if removed_skill_codes:
         print(f"Info: The following skill codes from the existing manual stats were not found in the current L10N data and will be kept: {list(removed_skill_codes)}")


    print(f"Skeleton generation and merge complete. Final skeleton contains {len(final_skill_skeleton)} skills.")
    # 디버그: 최종 스킬 코드 목록 출력
    # print(f"Debug: Final skill codes in skeleton: {list(final_skill_skeleton.keys())}")

    return final_skill_skeleton

# --- 파일 저장 함수 (기존 코드 유지) ---

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


# --- 메인 실행 로직 (기존 코드 유지) ---

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
            # existing_manual_stats가 비어있고 L10N에서도 스킬을 못 찾은 경우
            print("No skill data found in L10N and existing manual stats were empty. manual_skill_stats.json will not be created/updated.")

    else:
        print(f"Required raw data files ({raw_l10n_filepath}, {raw_character_filepath}) not found or failed to load.")
        print("Please ensure these files exist and are valid JSON (generated by fetch_raw_data.py).")


    print("Skill skeleton generation script finished.")