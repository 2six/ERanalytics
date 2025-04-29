import json
import os
import copy # 딕셔너리를 복사하기 위해 copy 모듈 import

# --- 설정 ---
RAW_DATA_DIR = "data/er/raw"
PROCESSED_DATA_DIR = "data/er/processed"
# manual_skill_stats.json 파일은 raw 디렉토리와 같은 레벨인 data/er/에 있다고 가정합니다.
MANUAL_SKILL_STATS_FILE = os.path.join("data", "er", "manual_skill_stats.json") 


# 초기 테스트에 포함할 캐릭터 코드 목록
TARGET_CHARACTER_CODES = [76, 23]

# --- 데이터 로드 함수 ---

def load_json_data(filepath):
    """
    JSON 파일에서 데이터를 로드하고, API 응답 구조인 경우 'data' 키의 값을 반환합니다.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"Loaded data from {filepath}")
        
        # raw API 응답은 { "code": ..., "data": [...] } 구조이므로, 실제 데이터 부분만 반환
        # L10N JSON은 { "key": "value", ... } 구조이므로 그대로 반환
        # 다른 단순 JSON 파일인 경우도 그대로 반환
        if isinstance(data, dict) and ("code" in data and "data" in data):
             # /v2/data 형태의 응답인 경우 'data' 키의 값을 반환 (or 'result' for v1)
             return data.get('data') or data.get('result')
        else:
            # L10N JSON 또는 다른 단순 JSON 파일인 경우 그대로 반환
            return data

    except FileNotFoundError:
        print(f"File not found: {filepath}. Returning None.")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON from file: {filepath}. Returning None.")
        return None
    except IOError as e:
        print(f"Error reading file {filepath}: {e}. Returning None.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred loading {filepath}: {e}. Returning None.")
        return None


def load_manual_skill_stats(filepath):
     """
     수동 스킬 스탯 JSON 파일을 로드하는 함수.
     """
     print(f"Loading manual skill stats from {filepath}... ") # 공백 추가
     try:
         with open(filepath, 'r', encoding='utf-8') as f:
             manual_stats = json.load(f)
         print("Manual skill stats loaded successfully.")
         return manual_stats
     except FileNotFoundError:
         print(f"Manual skill stats file not found: {filepath}. Returning empty dictionary.")
         print("Please create this file with your custom skill data if needed for full functionality.")
         return {} # 파일 없으면 빈 딕셔너리 반환
     except json.JSONDecodeError:
         print(f"Error decoding JSON from manual skill stats file: {filepath}.")
         return {} # JSON 오류 시 병합 시도하지 않고 빈 딕셔너리 반환
     except IOError as e:
         print(f"Error reading manual skill stats file: {e}")
         return {}
     except Exception as e:
         print(f"An unexpected error occurred loading {filepath}: {e}. Returning empty dictionary.")
         return {}


# --- 데이터 조합 및 필터링 함수 ---

def process_and_combine_data(raw_data, manual_skill_stats, target_char_codes):
    """
    읽어온 원본 데이터와 수동 데이터를 조합하고 지정된 캐릭터로 필터링하는 함수.
    """
    print("Processing and combining data...")

    # 결과 데이터 구조 초기화
    processed_data = {
        "characters": [], # 대상 캐릭터 목록 (리스트 형태)
        "items": { # 모든 아이템 데이터를 무기/방어구 딕셔너리로 저장
            "weapons": {},
            "armors": {},
        },
        "masteryStats": {}, # 대상 캐릭터가 사용하는 무기 타입의 MasteryStat 항목만 type을 키로 저장
        "weaponTypeInfo": {}, # 전체 WeaponTypeInfo를 type을 키로 저장
        "l10n_subset": {} # 조합에 사용된 L10N 키-값 쌍만 포함
    }

    # --- 룩업(Lookup) 딕셔너리 생성 (조합 및 필터링에 사용될 임시 데이터 구조) ---
    # 원본 데이터 딕셔너리에서 필요한 목록 추출 (raw_data 딕셔너리에 파일 이름이 키로 저장됨)
    raw_characters = raw_data.get("Character", [])
    raw_levelup_stats = raw_data.get("CharacterLevelUpStat", [])
    raw_char_mastery = raw_data.get("CharacterMastery", [])
    raw_mastery_stats = raw_data.get("MasteryStat", [])
    raw_weapon_type_info = raw_data.get("WeaponTypeInfo", [])
    raw_item_weapons = raw_data.get("ItemWeapon", [])
    raw_item_armors = raw_data.get("ItemArmor", [])
    # L10N 데이터 변수명 수정: raw_l10 -> raw_l10n
    raw_l10n = raw_data.get("l10n_korean", {}) # L10N 데이터는 이미 파싱된 JSON 형태


    char_base_stats_lookup = {c.get('code'): c for c in raw_characters if c and c.get('code') is not None}
    char_levelup_stats_lookup = {c.get('code'): c for c in raw_levelup_stats if c and c.get('code') is not None}
    char_mastery_lookup = {c.get('code'): c for c in raw_char_mastery if c and c.get('code') is not None} # CharacterMastery 원본 객체 저장

    # MasteryStat을 (characterCode, type)을 키로 하는 룩업으로 재구성
    mastery_stats_by_char_type = {}
    relevant_mastery_codes_for_subset = set() # mastery_stats.json에 포함할 MasteryStat 코드 집합
    for ms in raw_mastery_stats:
        # 데이터가 유효하고 필수 키가 있는지 확인
        if ms and ms.get("characterCode") is not None and ms.get("type") is not None:
             char_code = ms["characterCode"]
             mastery_type = ms["type"]
             ms_code = ms.get("code") # MasteryStat 고유 코드
             
             if char_code not in mastery_stats_by_char_type:
                  mastery_stats_by_char_type[char_code] = {}
             # 해당 캐릭터-무기 타입의 MasteryStat 항목 전체를 리스트로 저장 (레벨별)
             if mastery_type not in mastery_stats_by_char_type[char_code]:
                 mastery_stats_by_char_type[char_code][mastery_type] = []
             mastery_stats_by_char_type[char_code][mastery_type].append(ms)

             # 대상 캐릭터의 MasteryStat 코드만 추적 (mastery_stats.json 필터링용)
             if char_code in target_char_codes and ms_code is not None:
                  relevant_mastery_codes_for_subset.add(ms_code)


    # MasteryStat 레벨 순으로 미리 정렬 (mastery_stats_by_char_type 내부)
    for char_code in mastery_stats_by_char_type:
         for mastery_type in mastery_stats_by_char_type[char_code]:
              # level 필드가 있다고 가정하고 정렬. 없을 경우를 대비하여 0으로 기본값 설정.
              mastery_stats_by_char_type[char_code][mastery_type].sort(key=lambda x: x.get("level", 0))


    # WeaponTypeInfo를 type을 키로 하는 룩업으로 재구성
    weapon_type_info_lookup = {wt.get('type'): wt for wt in raw_weapon_type_info if wt and wt.get('type') is not None}
    # WeaponTypeInfo는 전체를 processed_data에 저장
    processed_data["weaponTypeInfo"] = weapon_type_info_lookup


    # 아이템 데이터를 코드를 문자열 키로 하는 룩업으로 재구성
    item_weapons_lookup = {str(item.get('code')): item for item in raw_item_weapons if item and item.get('code') is not None}
    item_armors_lookup = {str(item.get('code')): item for item in raw_item_armors if item and item.get('code') is not None}
    # 아이템은 전체를 processed_data에 저장
    processed_data["items"]["weapons"] = list(item_weapons_lookup.values())
    processed_data["items"]["armors"] = list(item_armors_lookup.values())


    # L10N 데이터를 임시로 raw_l10n에 저장하고, 조합 중 사용된 키만 l10n_subset에 추가


    # --- 대상 캐릭터 데이터 조합 및 필터링 ---
    print(f"Processing target characters: {target_char_codes}...")
    processed_char_count = 0
    for char_code in target_char_codes:
        char_code_str = str(char_code)

        base_stat_original = char_base_stats_lookup.get(char_code)
        levelup_stat_original = char_levelup_stats_lookup.get(char_code)
        char_mastery_entry = char_mastery_lookup.get(char_code) # CharacterMastery 원본 항목

        if not base_stat_original:
            print(f"Warning: Base stats not found for character code {char_code}. Skipping.")
            continue
        # 레벨업 스탯이 없을 수 있으므로 None 체크는 조합 시 로직에서 수행

        # CharacterMastery에서 사용 가능한 무기 목록 추출 (조합 과정에서만 사용)
        available_weapons = []
        if char_mastery_entry:
             for i in range(1, 5): # weapon1 부터 weapon4 까지 순회
                 weapon_key = f'weapon{i}'
                 weapon_name = char_mastery_entry.get(weapon_key)
                 # 무기 이름이 None이 아니고 "None" 문자열이 아닌 경우에만 추가
                 if weapon_name and weapon_name != "None": 
                     available_weapons.append(weapon_name)
             if not available_weapons:
                 print(f"Warning: No available weapons found in CharacterMastery for character code {char_code}.")
        else:
             print(f"Warning: CharacterMastery entry not found for character code {char_code}. Cannot determine available weapons.")

        # --- 캐릭터 데이터 조합 (최종 확정 구조 반영) ---
        # baseStats에서 불필요한 필드 제거 및 일부 필드 이동
        base_stat = copy.deepcopy(base_stat_original) # 원본 훼손 방지
        char_archetype1 = base_stat.pop("charArcheType1", None) # 제거하고 값 가져오기
        char_archetype2 = base_stat.pop("charArcheType2", None)
        base_stat.pop("code", None)
        base_stat.pop("name", None)
        base_stat.pop("localScaleInCutscene", None)
        base_stat.pop("localScaleInVictoryScene", None)
        base_stat.pop("resource", None)
        base_stat.pop("lobbySubObject", None)


        # levelUpStats에서 불필요한 필드 제거
        levelup_stat = copy.deepcopy(levelup_stat_original) if levelup_stat_original else None # 원본 훼손 방지
        if levelup_stat:
             levelup_stat.pop("code", None)
             levelup_stat.pop("name", None)


        # 캐릭터 이름 가져오기 (L10N 사용)
        l10n_char_name_key = f"Character/Name/{char_code}"
        char_name = raw_l10n.get(l10n_char_name_key, f"Unknown Character ({char_code})") 
        # 사용된 L10N 키는 최종본에 포함 (원본 L10N 값이 None이 아니면 저장)
        if raw_l10n.get(l10n_char_name_key) is not None:
             processed_data["l10n_subset"][l10n_char_name_key] = raw_l10n.get(l10n_char_name_key)

        character_data = {
            "code": char_code,
            "name": char_name, # L10N에서 가져온 이름 사용
            "charArcheType1": char_archetype1, # 이동된 필드
            "charArcheType2": char_archetype2, # 이동된 필드
            "baseStats": base_stat, # 수정된 baseStats 객체
            "levelUpStats": levelup_stat, # 수정된 levelUpStats 객체 (없으면 None)
            # availableWeapons 리스트 필드는 제거 (weaponMastery 객체의 키를 사용)
            # weaponTypesDetail 객체 필드는 제거 (weapon_type_info.json 파일 참조)
            "weaponMastery": {}, # <-- 최종 확정된 구조: 무기 타입 이름을 키로 하는 객체 (MasteryStat Level 1 보너스)
            "skills": {}, # 스킬 데이터 (캐릭터 고유 스킬만 포함)
        }

        # --- weaponMastery 객체 구성 ---
        # available_weapons 목록을 순회하며 해당 MasteryStat 항목을 찾아 Level 1 보너스 추출
        for weapon_type_name in available_weapons:
             # 해당 캐릭터-무기 타입의 MasteryStat 항목 리스트 가져옴
             mastery_stats_list = mastery_stats_by_char_type.get(char_code, {}).get(weapon_type_name)

             if mastery_stats_list:
                  # MasteryStat 리스트는 level 순으로 정렬되어 있다고 가정. 첫 번째 항목이 Level 1
                  ms_level1 = mastery_stats_list[0] # Level 1 MasteryStat 항목

                  # Level 1 보너스 스탯 추출
                  level1_bonus = {}
                  first_option = ms_level1.get("firstOption")
                  first_value = ms_level1.get("firstOptionSection1Value") # Level 1 값 사용
                  if first_option and first_option != "None" and first_value is not None:
                      # 옵션 이름을 키로, Level 1 값을 값으로 추가
                      level1_bonus[first_option] = first_value

                  second_option = ms_level1.get("secondOption")
                  second_value = ms_level1.get("secondOptionSection1Value") # Level 1 값 사용
                  if second_option and second_option != "None" and second_value is not None:
                      # 옵션 이름을 키로, Level 1 값을 값으로 추가
                      level1_bonus[second_option] = second_value

                  # thirdOption은 중요하지 않으므로 포함시키지 않음.

                  # weaponMastery 객체에 추가 (무기 타입 이름을 키로)
                  # 유효한 보너스 스탯이 있는 경우에만 추가
                  if level1_bonus: 
                       character_data["weaponMastery"][weapon_type_name] = level1_bonus
                  else:
                       # MasteryStat 항목은 있지만 Level 1 보너스 스탯이 없는 경우 (warning)
                       # print(f"Warning: Found MasteryStat entry for {weapon_type_name} (char {char_code}), but no valid Level 1 bonus stats extracted.")
                       pass # 경고 출력 대신 pass (해당 무기 타입에 대한 보너스 없음)
             else:
                 # CharacterMastery에는 있지만 MasteryStat에 아예 항목이 없는 경우
                 # 해당 무기 타입에 대한 보너스는 없음을 명시 (빈 객체 추가)
                 character_data["weaponMastery"][weapon_type_name] = {}


        # --- 스킬 데이터 합치기 (캐릭터 고유 스킬만 포함) ---
        # Manual Skill Stats 파일에 해당 캐릭터의 고유 스킬 정보만 있다고 가정
        if manual_skill_stats:
             # manual_skill_stats의 키들은 문자열 스킬 코드
             for skill_code_str, manual_stat_original in manual_skill_stats.items():
                 # 데이터가 유효하고 characterCode 필드가 있으며 대상 캐릭터 코드와 일치하는 경우
                 if manual_stat_original and manual_stat_original.get("characterCode") == char_code:
                     try:
                         # Manual Skill Stats 파일의 스킬 코드는 캐릭터 고유 스킬 코드 패턴이어야 함
                         # Character.json 에서 가져온 characterCode와 manual_stat_original 의 characterCode 일치 확인 필요
                         # (process_and_combine_data 함수의 target_char_codes 필터링과는 별개)
                         manual_stat_char_code = manual_stat_original.get("characterCode")
                         if manual_stat_char_code != char_code:
                              # print(f"Warning: Skipping skill code {skill_code_str} from manual stats: characterCode mismatch ({manual_stat_char_code} vs {char_code}).")
                              continue # 캐릭터 코드가 일치하지 않으면 스킵


                         if not skill_code_str.startswith("10"):
                              # print(f"Skipping skill code key '{skill_code_str}': Does not start with '10'. Assuming it's not a character-specific skill.")
                              continue # '10'으로 시작하지 않는 스킬은 스킵 (무기 스킬 등)

                         skill_code_int = int(skill_code_str) # 정수 스킬 코드
                         skill_key = manual_stat_original.get("skillKey", "Unknown")

                         # L10N에서 필요한 텍스트 필드 키 생성 (스킬 이름, 설명/계수 템플릿, 확장팁)
                         l10n_skill_name_key = f"Skill/Group/Name/{skill_code_str}"
                         l10n_desc_key = f"Skill/Group/Desc/{skill_code_str}"
                         l10n_coef_key = f"Skill/Group/Coef/{skill_code_str}"
                         l10n_lobby_desc_key = f"Skill/LobbyDesc/{skill_code_str}"
                         l10n_expansion_tip_key = f"Skill/Group/ExpansionTip/{skill_code_str}" # 확장팁 키

                         # L10N 데이터에서 값 가져오기
                         skill_name = raw_l10n.get(l10n_skill_name_key, manual_stat_original.get("skillName", f"Unknown Skill ({skill_code_str})")) # L10N 없으면 manual stats 이름 사용
                         l10n_desc_text = raw_l10n.get(l10n_desc_key, "") # 없으면 빈 문자열
                         l10n_coef_text = raw_l10n.get(l10n_coef_key, "") # 없으면 빈 문자열
                         l10n_lobby_desc_text = raw_l10n.get(l10n_lobby_desc_key, "") # 없으면 빈 문자열
                         l10n_expansion_tip_text = raw_l10n.get(l10n_expansion_tip_key, "") # 확장팁 텍스트 (없으면 빈 문자열)


                         # --- 조합된 스킬 객체 생성 (사용자 최종 확정 구조 반영) ---
                         # 딕셔너리 정의를 먼저 하고, 그 다음에 업데이트 수행
                         combined_skill_data = {
                             "code": skill_code_int, # 스킬 코드 (정수)
                            "skillKey": skill_key,
                             # skillKey, weaponType 필드 제거 (캐릭터 고유 스킬이므로)
                             # name 대신 skillName 사용 (요청 반영)
                             "skillName": skill_name, # L10N 또는 manual stats에서 가져온 이름 사용
                             "l10nCoefText": l10n_coef_text, # L10N Coef 텍스트 값 자체 저장
                             "l10nDescText": l10n_desc_text, # L10N Desc 텍스트 값 자체 저장 (키 대신)
                             "l10nLobbyDescText": l10n_lobby_desc_text, # L10N Lobby Desc 텍스트 값 자체 저장
                             "l10nExpansionTipText": l10n_expansion_tip_text, # L10N Expansion Tip 텍스트 값 추가
                         }
                         
                         # manualStats 하위 필드들을 스킬 객체 루트로 이동 (Manual Stats 딕셔너리 복사 후 제거)
                         skill_manual_data_to_merge = copy.deepcopy(manual_stat_original)
                         # ManualStats 뼈대에서 제거하기로 한 필드들을 여기서 pop (manual_skill_stats.json 구조를 따라야 함)
                         # manual_skill_stats.json 뼈대 생성 시 포함되는 필드들:
                         # characterCode, skillKey, skillName, l10nCoefText, l10nDescText, l10nLobbyDescText, l10nExpansionTipText,
                         # placeholder, coefficient, baseDamage, cooldown, costType, cost, range

                         # 뼈대 스크립트에서 자동 생성/포함시키는 필드 목록 (이 필드들은 뼈대 스크립트가 최신 상태로 관리)
                         # 따라서 manual_skill_stats.json의 해당 필드는 무시하거나 (update 시 덮어써짐)
                         # 여기서는 수동 입력한 값들을 가져와야 하므로 뼈대 자동 생성 필드와 수동 입력 필드를 구분하여 처리해야 함.

                         # 사용자 수동으로 채우는 필드 목록 (뼈대 스크립트가 빈 값으로 만들지만, 사용자가 채움)
                         # placeholder, coefficient, baseDamage, cooldown, costType, cost, range, 그리고 사용자가 추가한 다른 수치 필드들
                         
                         # 기존 manual_stat_original에서 placeholder, coefficient, baseDamage, cooldown, costType, cost, range 필드를 가져와 합침.
                         # 나머지 사용자가 추가한 필드들도 합침.
                         
                         # 안전하게 필요한 필드만 manual_stat_original에서 가져와 업데이트
                         fields_to_merge_from_manual = [
                            "placeholder", "coefficient", "baseDamage",
                            "cooldown", "costType", "cost", "range"
                         ]

                         for field in fields_to_merge_from_manual:
                             if field in manual_stat_original:
                                  combined_skill_data[field] = manual_stat_original[field]
                             # 필드가 없는 경우는 스킵 (combined_skill_data는 이미 기본값으로 초기화됨)

                         # manual_stat_original에 placeholder, coefficient, baseDamage, cooldown, costType, cost, range 외에
                         # 사용자가 추가한 다른 수치 필드들을 combined_skill_data에 합침.
                         fields_already_handled = fields_to_merge_from_manual + [
                             "characterCode", "skillKey", "skillName", # 이들은 캐릭터 정보와 중복되거나 필드명 변경됨
                             # L10N 텍스트 관련 필드 (l10nCoefText 등)는 L10N 원본에서 가져옴
                             "l10nCoefText", "l10nDescText", "l10nLobbyDescText", "l10nExpansionTipText",
                             "weaponType" # 무기 스킬인 경우 필요하지만, 현재 고유 스킬만 처리하므로 manual stats에 있더라도 무시.
                         ]

                         for key, value in manual_stat_original.items():
                             if key not in fields_already_handled:
                                  # 사용자가 추가한 다른 수치 필드는 그대로 combined_skill_data에 추가
                                  combined_skill_data[key] = value


                         # 사용된 L10N 키는 최종본에 포함
                         if l10n_skill_name_key in raw_l10n: processed_data["l10n_subset"][l10n_skill_name_key] = raw_l10n[l10n_skill_name_key]
                         if l10n_desc_key in raw_l10n: processed_data["l10n_subset"][l10n_desc_key] = raw_l10n[l10n_desc_key]
                         if l10n_coef_key in raw_l10n: processed_data["l10n_subset"][l10n_coef_key] = raw_l10n[l10n_coef_key]
                         if l10n_lobby_desc_key in raw_l10n: processed_data["l10n_subset"][l10n_lobby_desc_key] = raw_l10n[l10n_lobby_desc_key]
                         if l10n_expansion_tip_key in raw_l10n: processed_data["l10n_subset"][l10n_expansion_tip_key] = raw_l10n[l10n_expansion_tip_key]


                         # 캐릭터 데이터의 skills 객체에 추가 (스킬 코드를 문자열 키로 사용)
                         character_data["skills"][skill_code_str] = combined_skill_data

                     except ValueError:
                          print(f"Warning: Could not convert skill code key '{skill_code_str}' to integer. Skipping skill.")
                     except Exception as e:
                         print(f"Warning: An error occurred processing skill '{skill_code_str}' for character {char_code}: {e}. Skipping skill.")
                         import traceback
                         traceback.print_exc() # 예외 발생 시 전체 트레이스백 출력 (디버그용)


             # 스킬 데이터가 하나도 추가되지 않았다면 경고 메시지 출력
             if not character_data.get('skills'):
                  print(f"Warning: No skill data added for character code {char_code}. Manual skill stats file might be missing or incomplete, or no character-specific skills found starting with '10'.")

             print(f"Added skill data for character code {char_code}. Total skills: {len(character_data.get('skills', {}))}")
        else:
             print(f"Warning: manual_skill_stats.json not loaded or empty. Skill data for character {char_code} may be incomplete.")


        # 최종 조합된 캐릭터 데이터를 결과 리스트에 추가
        processed_data["characters"].append(character_data)
        processed_char_count += 1


    print(f"Finished processing characters. Processed {processed_char_count}/{len(target_char_codes)} target characters.")

    # --- 기타 데이터 추가 (전체 포함) ---
    # items, weaponTypeInfo는 이미 룩업에서 processed_data로 옮겨졌음.

    # MasteryStat 데이터 추가 (대상 캐릭터가 사용하는 무기 타입 관련만)
    # relevant_mastery_codes_for_subset 집합을 사용하여 원본 MasteryStat 목록에서 필터링
    print("Filtering relevant MasteryStat entries...")
    filtered_mastery_stats = [ms for ms in raw_mastery_stats if ms and ms.get("code") in relevant_mastery_codes_for_subset]
    processed_data["masteryStats"] = filtered_mastery_stats
    print(f"Filtered {len(processed_data['masteryStats'])} relevant MasteryStat entries.")


    # l10n_subset 데이터는 이미 캐릭터/스킬 처리 과정에서 채워졌음.

    print("Data processing and combining complete.")
    return processed_data


# --- 파일 저장 함수 ---

def save_processed_data(data, directory):
    """
    조합 및 필터링된 데이터를 유형별 JSON 파일로 저장하는 함수.
    """
    # 저장될 디렉토리 경로 확인 및 생성
    if not os.path.exists(directory):
        os.makedirs(directory)

    print(f"\nSaving processed data to {directory}...")

    # 캐릭터 데이터 저장
    char_filepath = os.path.join(directory, "characters.json")
    try:
        with open(char_filepath, 'w', encoding='utf-8') as f:
            json.dump(data.get("characters", []), f, ensure_ascii=False, indent=4)
        print(f"Characters data saved to {char_filepath}")
    except IOError as e:
        print(f"Error saving characters data to {char_filepath}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred saving characters data to {char_filepath}: {e}")


    # 아이템 데이터 저장
    item_filepath = os.path.join(directory, "items.json")
    try:
        # items 딕셔너리 전체를 저장
        with open(item_filepath, 'w', encoding='utf-8') as f:
            json.dump(data.get("items", {}), f, ensure_ascii=False, indent=4)
        print(f"Items data saved to {item_filepath}")
    except IOError as e:
         print(f"Error saving items data to {item_filepath}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred saving items data to {item_filepath}: {e}")


    # MasteryStat 데이터 저장 (대상 캐릭터 관련만)
    mastery_filepath = os.path.join(directory, "mastery_stats.json")
    try:
        # MasteryStat 리스트를 저장
        with open(mastery_filepath, 'w', encoding='utf-8') as f:
            json.dump(data.get("masteryStats", []), f, ensure_ascii=False, indent=4)
        print(f"Mastery stats data saved to {mastery_filepath}")
    except IOError as e:
         print(f"Error saving mastery stats data to {mastery_filepath}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred saving mastery stats data to {mastery_filepath}: {e}")


    # WeaponTypeInfo 데이터 저장 (전체)
    wt_info_filepath = os.path.join(directory, "weapon_type_info.json")
    try:
        # WeaponTypeInfo 딕셔너리 (type을 키로 함)를 저장
        with open(wt_info_filepath, 'w', encoding='utf-8') as f:
            json.dump(data.get("weaponTypeInfo", {}), f, ensure_ascii=False, indent=4)
        print(f"Weapon type info data saved to {wt_info_filepath}")
    except IOError as e:
         print(f"Error saving weapon type info data to {wt_info_filepath}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred saving weapon type info data to {wt_info_filepath}: {e}")


    # L10N Subset 데이터 저장
    l10n_subset_filepath = os.path.join(directory, "l10n_subset.json")
    try:
        # L10N 키-값 딕셔너리를 저장
        with open(l10n_subset_filepath, 'w', encoding='utf-8') as f:
            json.dump(data.get("l10n_subset", {}), f, ensure_ascii=False, indent=4)
        print(f"L10N subset data saved to {l10n_subset_filepath}")
    except IOError as e:
         print(f"Error saving L10n subset data to {l10n_subset_filepath}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred saving L10n subset data to {l10n_subset_filepath}: {e}")


    print("All processed data files saved.")


# --- 메인 실행 로직 ---

if __name__ == "__main__":
    print("Starting data processing script...")

    # 1. 원본 API 데이터 파일 로드
    raw_data = {}
    raw_data_filenames = [
        "Character.json",
        "CharacterLevelUpStat.json",
        "CharacterMastery.json",
        "MasteryStat.json",
        "WeaponTypeInfo.json",
        "ItemWeapon.json",
        "ItemArmor.json",
        "l10n_korean.json", # L10N 데이터는 이미 파싱된 JSON 형태
    ]

    print(f"Loading raw data files from {RAW_DATA_DIR}...")
    for filename in raw_data_filenames:
        filepath = os.path.join(RAW_DATA_DIR, filename)
        # 파일 이름(확장자 제외)을 키로 사용하여 raw_data 딕셔너리에 저장
        key_name = os.path.splitext(filename)[0]
        # load_json_data는 실제 데이터 부분만 반환하거나 L10N JSON/기타 JSON 그대로 반환
        data = load_json_data(filepath) 
        if data is not None: # 파일이 없거나 로드 실패 시 None 반환
             raw_data[key_name] = data
        else:
             print(f"Warning: Failed to load raw data from {filepath}. Processing may be incomplete.")


    # 2. 수동 스킬 스탯 로드
    manual_skill_stats = load_manual_skill_stats(MANUAL_SKILL_STATS_FILE)
    # 수동 스킬 스탯 파일이 없다면 {} 빈 딕셔너리가 반환됨.


    # 3. 데이터 조합 및 필터링
    # target_char_codes 리스트를 넘겨주어 해당 캐릭터들만 처리하도록 함
    processed_combined_data = process_and_combine_data(raw_data, manual_skill_stats, TARGET_CHARACTER_CODES)


    # 4. 결과 저장 (유형별 파일로 분리)
    if processed_combined_data:
        save_processed_data(processed_combined_data, PROCESSED_DATA_DIR)
    else:
        print("No processed data generated.")

    print("Data processing script finished.")