// 이 코드는 브라우저 환경(index.html 파일의 <script> 태그)에서 실행됩니다.
// defer 속성으로 인해 HTML 문서 로드 후 실행됩니다.

// --- 설정 ---
// process_data.py 스크립트가 생성한 JSON 파일들의 경로 (GitHub Pages의 루트 기준으로 가정)
const DATA_FILES = {
    characters: '/data/er/processed/characters.json',
    items: '/data/er/processed/items.json',
    weaponTypeInfo: '/data/er/processed/weapon_type_info.json',
    masteryStats: '/data/er/processed/mastery_stats.json', // masteryStats.json 파일도 필요하다면 로드
    l10n: '/data/er/processed/l10n_subset.json',
    // manualSkillStats: 'data/er/manual_skill_stats.json' // 수동 스킬 스탯 파일 (process_data.py에서 이미 합쳐 사용)
};

// 현재 페이지의 캐릭터 코드 (URL에서 추출하거나 기본값 설정)
let currentCharacterCode = 76; // 예시: 기본값 가넷 (76)

// 로드된 데이터 (전역 변수로 관리)
let gameData = {};
let l10nData = {};
let manualSkillStatsData = {}; // process_data.py에서 합쳐졌다면 characters data 내부에 있을 것임.

// 현재 선택된 입력 값 (사용자 입력에 따라 업데이트될 객체)
let currentInput = {
    characterLevel: 1, // 기본 레벨
    weaponType: null,
    masteryLevels: { // 각 숙련도 레벨
        Weapon: 1,
        Defense: 1,
        Move: 1,
        // 기타 필요한 숙련도 (Craft, Search 등)
    },
    skillLevels: { // 각 스킬 레벨
        P: 1, Q: 1, W: 1, E: 1, R: 1
    },
    equippedItems: { // 장착 아이템 코드 (초기값 null)
        Weapon: null, Armor: null, Head: null, Arm: null, Leg: null, Accessory: null // Accessory는 제거되었지만 혹시 모를 필드
    },
    enemyStats: { // 적 캐릭터 스탯
        hp: 0, defense: 0, defenseMastery: 0 // 체력, 방어력, 방어 숙련도 등
    },
    skillCombo: "" // 스킬 콤보 문자열
};

// --- 데이터 로드 함수 ---

async function loadData() {
    console.log("Loading game data files...");
    try {
        const loadPromises = Object.keys(DATA_FILES).map(key =>
            fetch(DATA_FILES[key]).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${DATA_FILES[key]}`);
                }
                return response.json();
            }).then(data => {
                gameData[key] = data; // 키 이름으로 데이터 저장
                console.log(`Loaded ${key} data.`);
            })
        );

        // 모든 파일 로드가 완료될 때까지 기다림
        await Promise.all(loadPromises);

        // L10N 데이터는 별도의 변수로 접근하기 편하게 함
        l10nData = gameData.l10n;

        console.log("All data files loaded successfully.");
        console.log("Loaded Game Data:", gameData); // 디버깅용 출력

        // 데이터 로드 완료 후 초기 설정 및 UI 구성 시작
        initializePage();

    } catch (error) {
        console.error("Failed to load game data:", error);
        document.body.innerHTML = "<p>데이터 로드 실패. 페이지를 표시할 수 없습니다.</p>";
    }
}

// --- 페이지 초기화 및 UI 구성 함수 ---

function initializePage() {
    console.log("Initializing page...");

    // URL에서 캐릭터 코드 추출 (예: my-site.com/damageCal/76)
    const pathSegments = window.location.pathname.split('/');
    const charCodeFromUrl = parseInt(pathSegments[pathSegments.length - 1], 10); // 마지막 세그먼트 파싱

    if (!isNaN(charCodeFromUrl) && charCodeFromUrl > 0) { // 유효한 숫자인 경우
        currentCharacterCode = charCodeFromUrl;
        console.log(`Character code from URL: ${currentCharacterCode}`);
    } else {
        console.log(`No valid character code in URL. Using default: ${currentCharacterCode}`);
    }

    // 현재 캐릭터 데이터 찾기
    const characterData = gameData.characters.find(char => char.code === currentCharacterCode);

    if (!characterData) {
        console.error(`Character data not found for code: ${currentCharacterCode}`);
        document.body.innerHTML = "<p>캐릭터 데이터를 찾을 수 없습니다.</p>";
        return;
    }

    console.log("Current Character Data:", characterData); // 디버깅용 출력

    // --- UI 구성 시작 ---

    // 1. 캐릭터 스탯 입력 섹션 구성
    setupCharacterInput(characterData);

    // 2. 스킬 콤보 입력 섹션 구성 (단순 입력 필드)
    setupSkillComboInput();

    // 3. 아이템 정보 섹션 구성 (자리만 마련, 선택 UI는 나중에 추가)
    setupItemInput(characterData); // 캐릭터가 사용 가능한 무기 등을 참고하여 아이템 선택 UI 구성 필요

    // 4. 적 캐릭터 정보 섹션 구성 (단순 입력 필드)
    setupEnemyInput();

    // 초기 계산 및 결과 표시
    calculateAndDisplayResults();

    console.log("Page initialization complete.");
}


// --- 각 섹션별 UI 구성 상세 함수 (Placeholder 구현) ---

function setupCharacterInput(characterData) {
    const charInputSection = document.getElementById('character-input-section');
    if (!charInputSection) return;

    let htmlContent = '<h2>캐릭터 스탯 입력</h2>';
    htmlContent += `<p>선택된 캐릭터: ${characterData.name} (${characterData.code})</p>`;

    // 레벨 입력 (단순 드롭다운 예시)
    htmlContent += '<label for="level-select">레벨:</label>';
    htmlContent += '<select id="level-select">';
    for(let i = 1; i <= 20; i++) {
        htmlContent += `<option value="${i}"${i === currentInput.characterLevel ? ' selected' : ''}>${i}</option>`;
    }
    htmlContent += '</select><br>';

    // 무기 선택 (캐릭터가 사용 가능한 무기 목록에서)
    htmlContent += '<label for="weapon-select">무기:</label>';
    htmlContent += '<select id="weapon-select">';
     // characterData.weaponMastery 객체의 키 목록이 사용 가능한 무기 타입 이름입니다.
    const availableWeapons = Object.keys(characterData.weaponMastery); 
    if (availableWeapons.length > 0 && !currentInput.weaponType) {
        currentInput.weaponType = availableWeapons[0]; // 기본값으로 첫 번째 무기 선택
    }
    availableWeapons.forEach(weaponType => {
        // L10N 데이터에서 무기 타입 이름 가져오기 (WeaponTypeInfo에서도 이름 확인 가능)
        // WeaponTypeInfo 데이터를 참조하여 이름 가져오는 것이 더 정확할 수 있음.
        // 여기서는 일단 weaponType 자체 이름을 사용합니다.
         const weaponTypeName = weaponType; // 또는 L10N lookup 필요
        htmlContent += `<option value="${weaponType}"${weaponType === currentInput.weaponType ? ' selected' : ''}>${weaponTypeName}</option>`;
    });
    htmlContent += '</select><br>';


    // 숙련도 레벨 입력 (무기, 방어, 이동)
    // MasteryStat 데이터는 characterData.weaponMastery에 포함되어 있습니다.
    // 방어/이동 숙련도 보너스는 별도 데이터 소스나 수동 관리 필요 (현재 API 없음)
    // 여기서는 입력 필드만 구성
    htmlContent += '<label for="weapon-mastery-level">무기 숙련도 레벨:</label><input type="number" id="weapon-mastery-level" min="1" max="20" value="1"><br>';
    htmlContent += '<label for="defense-mastery-level">방어 숙련도 레벨:</label><input type="number" id="defense-mastery-level" min="1" max="20" value="1"><br>';
    htmlContent += '<label for="move-mastery-level">이동 숙련도 레벨:</label><input type="number" id="move-mastery-level" min="1" max="20" value="1"><br>';
    // TODO: 다른 숙련도 입력 필드 추가

    // 스킬 레벨 입력 (Q,W,E=5, RP=3)
    // characterData.skills 데이터를 보고 각 스킬의 레벨 범위 파악 가능
     htmlContent += '<p>스킬 레벨:</p>';
     // TODO: characterData.skills 순회하며 각 스킬의 level 입력 필드 동적 생성
     // 일단 하드코딩 예시
     const skillKeys = ['P', 'Q', 'W', 'E', 'R']; // 캐릭터 고유 스킬 키 목록 (예상)
     skillKeys.forEach(skillKey => {
         const maxLevel = (skillKey === 'P' || skillKey === 'R') ? 3 : 5;
         htmlContent += `<label for="${skillKey.toLowerCase()}-skill-level">${skillKey}:</label>`;
         htmlContent += `<input type="number" id="${skillKey.toLowerCase()}-skill-level" min="1" max="${maxLevel}" value="1"><br>`;
         currentInput.skillLevels[skillKey] = 1; // 초기값 설정
     });


    charInputSection.innerHTML = htmlContent;

    // 입력 필드 변경 시 calculateAndDisplayResults 함수 호출 이벤트 리스너 등록 (나중에 구현)
    // charInputSection.querySelectorAll('select, input[type="number"]').forEach(input => {
    //     input.addEventListener('change', calculateAndDisplayResults);
    // });
}


function setupSkillComboInput() {
    const comboSection = document.getElementById('skill-combo-section');
     if (!comboSection) return;

     let htmlContent = '<h2>스킬 콤보 입력</h2>';
     htmlContent += '<input type="text" id="combo-text" placeholder="예: QWEQWR평평" value=""><br>';
     htmlContent += '<button id="calculate-combo-button">콤보 계산</button>';

     comboSection.innerHTML = htmlContent;

     // 콤보 계산 버튼 클릭 시 이벤트 리스너 등록 (나중에 구현)
     // document.getElementById('calculate-combo-button').addEventListener('click', calculateAndDisplayCombo);
}

function setupItemInput(characterData) {
     const itemSection = document.getElementById('item-info-section');
     if (!itemSection) return;

     let htmlContent = '<h2>아이템 정보</h2>';
     htmlContent += '<p>아이템 선택 UI가 여기에 추가될 예정입니다.</p>';
     htmlContent += '<div id="equipped-items-output">장착 아이템 목록 출력</div>';

     // TODO: gameData.items 데이터를 사용하여 아이템 선택 드롭다운 또는 목록 구성
     // TODO: 선택된 아이템 이미지 표시 로직 구현

     itemSection.innerHTML = htmlContent;
}

function setupEnemyInput() {
     const enemySection = document.getElementById('enemy-info-section');
     if (!enemySection) return;

     let htmlContent = '<h2>적 캐릭터 정보</h2>';
     htmlContent += '<label for="enemy-hp">적 체력:</label><input type="number" id="enemy-hp" min="0" value="1000"><br>';
     htmlContent += '<label for="enemy-defense">적 방어력:</label><input type="number" id="enemy-defense" min="0" value="50"><br>';
     htmlContent += '<label for="enemy-defense-mastery">적 방어 숙련도:</label><input type="number" id="enemy-defense-mastery" min="1" max="20" value="1"><br>';

     enemySection.innerHTML = htmlContent;

     // 입력 필드 변경 시 calculateAndDisplayResults 함수 호출 이벤트 리스너 등록 (나중에 구현)
     // enemySection.querySelectorAll('input[type="number"]').forEach(input => {
     //     input.addEventListener('change', calculateAndDisplayResults);
     // });
}


// --- 계산 및 결과 표시 함수 (Placeholder 구현) ---

function calculateAndDisplayResults() {
    console.log("Calculating and displaying results...");

    // 현재 입력 값 가져오기 (UI에서 최신 값 읽어와 currentInput 객체 업데이트)
    // TODO: UI 요소에서 값을 읽어와 currentInput 객체 업데이트 로직 구현

    const characterData = gameData.characters.find(char => char.code === currentCharacterCode);
    if (!characterData) return; // 캐릭터 데이터 없으면 종료

    // --- 캐릭터 최종 스탯 계산 ---
    // 사용자 입력 (레벨, 무기, 숙련도, 아이템) 및 확보된 JSON 데이터를 기반으로 계산
    const finalStats = calculateFinalCharacterStats(characterData, currentInput, gameData);

    // --- 스킬 정보 계산 (각 스킬별) ---
    const skillResults = calculateSkillDetails(characterData, currentInput, gameData, finalStats);

    // --- 최종 계산 결과 (스킬 콤보 등) 계산 ---
    // TODO: calculateFinalDamage 함수 구현 (스킬 콤보, 적 스탯, 최종 스탯 활용)


    // --- 결과 HTML에 표시 ---

    // 계산된 캐릭터 정보 표시
    displayCharacterStats(finalStats);

    // 아이템 정보 표시 (선택 UI 구현 후 채워넣을 예정)
    displayEquippedItems(currentInput.equippedItems, gameData.items); // gameData.items 활용

    // 최종 계산 결과 표시
    displayFinalCalculation(null); // TODO: 최종 계산 결과 함수 호출 후 값 전달

    // 스킬 정보 표 표시
    displaySkillTable(skillResults, l10nData); // calculateSkillDetails 결과 활용

    console.log("Calculation and display complete.");
}

// --- 실제 계산 로직 함수 (Placeholder 또는 개념 코드) ---

function calculateFinalCharacterStats(characterData, input, allGameData) {
    console.log("Calculating final character stats...");
    const baseStats = characterData.baseStats;
    const levelUpStats = characterData.levelUpStats; // 레벨업 스탯 (없으면 None)

    // 예시: 레벨에 따른 기본 스탯 계산 (단순 덧셈)
    const level = input.characterLevel;
    const finalStats = { ...baseStats }; // 기본 스탯 복사

    if (level > 1 && levelUpStats) {
        for (const stat in levelUpStats) {
            if (finalStats.hasOwnProperty(stat) && levelUpStats.hasOwnProperty(stat)) {
                // 기본 스탯과 레벨업 스탯 모두에 해당 필드가 있는 경우에만 계산
                 // 문자열 필드 제외 (charArcheType1 등)
                 if (typeof finalStats[stat] === 'number' && typeof levelUpStats[stat] === 'number') {
                    finalStats[stat] += levelUpStats[stat] * (level - 1);
                 }
            }
        }
    }

    // TODO: 아이템 스탯 합산 로직 구현
    // input.equippedItems, allGameData.items 활용
    // 각 아이템이 부여하는 스탯을 finalStats에 더함 (고정값, 비율 등 고려)

    // TODO: 무기 타입 기본 스탯 적용 로직 구현
    // input.weaponType, allGameData.weaponTypeInfo 활용
    // WeaponTypeInfo에서 해당 무기 타입의 기본 공속, 사거리 등을 가져와 finalStats에 반영

    // TODO: 무기 숙련도 스탯 적용 로직 구현
    // input.weaponType, input.masteryLevels.Weapon, characterData.weaponMastery 활용
    // characterData.weaponMastery[input.weaponType]에서 Level 1당 보너스를 가져와
    // 무기 숙련도 레벨을 곱한 후 finalStats에 적용 (공식 고려)

    // TODO: 방어/이동 숙련도 스탯 적용 로직 구현 (별도 데이터 소스 필요)
    // input.masteryLevels.Defense, input.masteryLevels.Move 활용

    // TODO: 적응형 능력치 적용 로직 구현 (공식 고려)

    console.log("Final Calculated Stats (partial):", finalStats);
    return finalStats; // 계산된 최종 스탯 객체
}


function calculateSkillDetails(characterData, input, allGameData, finalStats) {
    console.log("Calculating skill details...");
    const skills = characterData.skills; // 캐릭터의 모든 스킬 데이터 (manual_skill_stats에서 조합됨)
    const l10nData = allGameData.l10n; // L10N 데이터

    const skillResults = [];

    // 각 캐릭터 고유 스킬에 대해 반복
    for (const skillCodeStr in skills) {
        const skill = skills[skillCodeStr];
        const skillKey = skill.skillKey; // 스킬 키 (P, Q, W, E, R)
        const skillLevel = input.skillLevels[skillKey]; // 사용자 입력 스킬 레벨

        if (skillLevel === undefined || skillLevel < 1) {
             // 해당 스킬 레벨 입력 값이 없거나 유효하지 않으면 계산 스킵
             continue;
        }

        // --- 스킬별 결과값 (데미지, 회복량 등) 계산 ---
        let resultValue = "계산 필요"; // 초기값 또는 Placeholder

        // L10N Coef 텍스트와 manualStats를 활용하여 플레이스홀더 값 계산
        const coefTemplate = skill.l10nCoefText;
        const placeholderMapping = skill.placeholder; // "{n}": "statName" 객체
        const coefficientStats = skill.coefficient; // "{n}": [] 객체

        if (coefTemplate && placeholderMapping && coefficientStats) {
            let calculatedValuesForPlaceholder = {}; // 각 {n}에 들어갈 최종 계산 값
            let totalDamage = 0; // 스킬 데미지 총합 (예시)

            // placeholderMapping 순회하며 각 {n}에 해당하는 값 계산
            for (const placeholderStr in placeholderMapping) {
                 const statName = placeholderMapping[placeholderStr]; // 예: "baseDamage1"

                 // {n}에 해당하는 수치 배열 가져오기
                 const levelValues = coefficientStats[placeholderStr]; // 예: [40, 60, ...]

                 let value = 0; // 계산된 최종 값 초기화

                 if (levelValues && levelValues.length >= skillLevel) {
                     const baseValueForLevel = levelValues[skillLevel - 1]; // 해당 레벨의 기본 수치

                     // --- 실제 스킬 데미지/효과 계산 로직 ---
                     // 여기서는 placeholder 이름(statName)에 따라 어떤 계산을 할지 정의합니다.
                     // 이 로직은 사용자님의 2-2 스킬 데미지 계산 공식에 기반해야 합니다.
                     // 예시: baseDamage는 그대로 사용, 계수는 캐릭터 스탯과 곱함
                     
                     if (statName.startsWith("baseDamage")) { // 이름이 "baseDamage"로 시작하면 기본 피해량
                          value = baseValueForLevel;
                     } else if (statName.startsWith("skillAmpRatio")) { // 이름이 "skillAmpRatio"로 시작하면 스증 계수
                          // 최종 스킬 증폭 = (캐릭터 최종 스킬 증폭) * (무기 숙련도 퍼스증 + 아이템 퍼스증) (공식 2-1)
                          // L10N 텍스트에서 "(+스킬 증폭의 {n})" 패턴의 {n}에 해당하는 값은 보통 계수 자체 (0.50)
                          // 실제 계산 시에는 (캐릭터 최종 스킬 증폭 수치) * 계수 를 해야 함.
                          // characterData.weaponMastery[input.weaponType] 에서 무기 숙련도 퍼스증 가져옴.
                          // 아이템 퍼스증은 allGameData.items 에서 가져와 계산.
                          // 최종 스킬 증폭 수치 (finalStats.skillAmp)도 필요

                          // TODO: 정확한 스증 계수 적용 계산 로직 구현
                          // 예시 (단순 곱셈): value = finalStats.skillAmp * baseValueForLevel;

                          // L10N 텍스트에 표시되는 {n} 값 자체는 계수일 수도, 기여도일 수도 있음.
                          // 가넷 Q 예시에서는 {1}이 스증 계수(50%), {2}가 최체 계수(4%)였습니다.
                          // {0}은 기본 피해량(40/60...).
                          // 복잡한 R 스킬에서는 각 placeholder가 나타내는 의미가 더 다양함.
                          // 사용자님의 2-2 캐시 E 스킬 예시처럼, placeholder.{n} 의 두 번째 값("skillDamage_1")이
                          // 최종 데미지를 의미하고, 이를 계산하기 위해 여러 placeholder 값 조합 필요.
                          // 이 로직은 상당히 복잡하며, 스킬마다 다를 수 있습니다.

                          // Placeholder의 두 번째 값 ("skillDamage_1", "ccDuration" 등) 파악
                          // 이 정보는 manual_skill_stats.json 의 placeholderMapping 값(오른쪽)에
                          // 사용자가 직접 입력해야 할 것입니다.
                          // 예: "placeholderMapping": { "{0}": ["baseDamage_1", "skillDamage_1"], "{6}": ["skillAmp_1", "skillDamage_1"], ... }

                          // 현재 뼈대 구조는 placeholderMapping의 값이 단순 문자열 ("baseDamage", "") 형태입니다.
                          // 구조 변경 필요: "placeholderMapping": { "{0}": "baseDamage_1", "{6}": "skillAmp_1", ... }
                          // 그리고 coefficient 객체 안에는 "baseDamage_1": [], "skillAmp_1": [], ... 형태의 키-값 쌍
                          // JavaScript 계산 시: L10N Coef에서 {0}, {6} 찾음 -> placeholderMapping에서 "baseDamage_1", "skillAmp_1" 찾음
                          // -> coefficient에서 "baseDamage_1": [수치], "skillAmp_1": [수치] 가져옴 -> 계산
                          // 이 구조로 다시 논의해야 할 것 같습니다. (이전 답변에서 이 구조로 가려다 사용자님이 다른 의견을 주셨음)

                           // 일단 현재 뼈대 구조 (placeholder는 객체, coefficient는 {n} 키)를 바탕으로
                           // placeholder의 값(오른쪽 문자열)이 계수 이름이라고 가정하고 계산 로직을 구현해야 합니다.
                           // 예시 (placeholder 값이 스탯 이름이라고 가정):
                           const statNameInPlaceholder = placeholderMapping[placeholderStr]; // 예: "skillAmpRatio1"
                           if(statNameInPlaceholder.endsWith("Ratio")) { // 이름이 "Ratio"로 끝나면 계수라고 가정
                               // TODO: 어떤 스탯(skillAmp, maxHp 등)의 계수인지 파악하고 해당 캐릭터 최종 스탯과 곱함
                               // 예: if(statNameInPlaceholder.startsWith("skillAmp")) value = finalStats.skillAmp * baseValueForLevel;
                           } else { // 계수가 아니면 기본값 그대로 사용 (예: baseDamage1, slowDuration1)
                                value = baseValueForLevel;
                           }

                     } else {
                          // 해당 레벨의 수치가 없는 경우
                          value = 0; // 또는 "?"
                          console.warn(`Data missing for ${statName} in skill ${skillCodeStr}, level ${skillLevel}`);
                     }
                     calculatedValuesForPlaceholder[placeholderStr] = value; // 계산된 값을 {n} 키에 저장
                     // TODO: 필요시 totalDamage 등 최종 결과 계산에 합산
                }
            }


            // --- L10N 텍스트에 계산된 값 채워넣기 ---
            let formattedText = coefTemplate;
            for (const placeholderStr in calculatedValuesForPlaceholder) {
                 const value = calculatedValuesForPlaceholder[placeholderStr];
                 const regex = new RegExp(placeholderStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'); // {n} 형태 정규식
                 formattedText = formattedText.replace(regex, value.toFixed(2)); // 소수점 둘째 자리까지 표시
            }
             resultValue = formattedText;

             // TODO: 최종 데미지 계산 로직 구현 (스킬 콤보 전체 등)
             // 이는 calculateFinalDamage 함수에서 수행될 것임.
        }


        // 스킬 정보 표에 표시할 결과 객체 생성
        skillResults.push({
            code: skill.code, // 스킬 코드
            skillKey: skill.skillKey, // P, Q, W, E, R
            name: skill.name, // 스킬 이름
            level: skillLevel, // 현재 스킬 레벨
            cost: skill.cost ? skill.cost[skillLevel - 1] : 'N/A', // 소모값 (레벨별)
            costType: skill.costType || 'N/A', // 소모 타입
            cooldown: skill.cooldown ? skill.cooldown[skillLevel - 1] : 'N/A', // 쿨다운 (레벨별)
            range: skill.range ? skill.range[skillLevel - 1] : 'N/A', // 사거리 (레벨별)
            resultValue: resultValue, // L10N 텍스트에 수치 채워넣은 결과
            l10nDescText: skill.l10nDescText, // 원래 Desc 텍스트
            l10nLobbyDescText: skill.l10nLobbyDescText, // 원래 LobbyDesc 텍스트
            l10nExpansionTipText: skill.l10nExpansionTipText // 확장팁 텍스트
             // TODO: 이미지 경로는 여기서 바로 사용 가능
        });

    } // for skill

    return skillResults; // 계산된 각 스킬 정보 객체들의 리스트
}


function calculateFinalDamage(skillCombo, enemyStats, finalCharacterStats, skillDetails) {
    console.log("Calculating final combo damage...");
    // TODO: 스킬 콤보 문자열(QWE평R 등) 파싱
    // TODO: 각 스킬/평타 사용 시 최종 스탯, 적 스탯, 스킬 상세 정보 활용하여 데미지 계산
    // TODO: 버프/디버프, 쿨다운, 스태미나 소모 등 시뮬레이션 로직 구현
    // TODO: 최종 데미지 합산

    return "총 데미지: [계산된 값]"; // 예시 결과
}


// --- 결과 HTML에 표시 상세 함수 ---

function displayCharacterStats(finalStats) {
    const statsOutputElement = document.getElementById('character-stats-output');
     if (!statsOutputElement) return;

     let htmlContent = '<h3>최종 스탯</h3><ul>';
     // TODO: finalStats 객체의 모든 스탯 항목을 순회하며 HTML 리스트로 표시
     // 사용자님께서 요청하신 순서대로 표시하는 것이 좋음
     const statOrder = [
         'maxHp', 'hpRegen', 'maxSp', 'spRegen',
         'increaseBasicAttackDamageRatio', 'skillAmpRatio', // 기공증, 퍼스증
         'attackPower', 'attackSpeed', 'skillAmp', 'cooldownReduction', // 공격력, 공속, 스증, 쿨감
         'criticalStrikeChance', 'criticalStrikeDamage', 'penetrationDefense', 'penetrationDefenseRatio', // 치확, 치피, 방관, 퍼방관
         'defense', 'moveSpeed', 'preventBasicAttackDamagedRatio', 'preventSkillDamagedRatio', // 방어력, 이속, 기피감, 스피감 (Ratio 필드 이름을 가정)
         'lifeSteal', 'normalLifeSteal', // 모피흡 (모피흡 필드명이 lifeSteal 인지 확인 필요), 생흡 (normalLifeSteal 인지 확인 필요)
         'sightRange', 'attackRange' // 시야, 사거리
         // TODO: 다른 필요한 스탯 필드명 추가
     ];

     statOrder.forEach(statKey => {
          if (finalStats.hasOwnProperty(statKey)) {
               // L10N 데이터에서 스탯 이름 가져오기 (예: L10N "Stats/Name/maxHp")
               // 이 정보가 API에 있다면 l10n_subset에 포함되어 있어야 함.
               // 현재 l10n_subset에는 캐릭터/스킬/아이템 텍스트만 있으므로, 스탯 이름 텍스트는 별도 처리 필요.
               // 일단 statKey 자체를 이름으로 사용하거나, 수동 매핑 텍스트 사용.
               const statName = statKey; // 또는 L10N lookup
               const statValue = typeof finalStats[statKey] === 'number' ? finalStats[statKey].toFixed(2) : finalStats[statKey]; // 숫자면 소수점 표시

               htmlContent += `<li>${statName}: ${statValue}</li>`;
          }
     });
     htmlContent += '</ul>';

    // 각 능력치에 대한 설명 텍스트 표시 (사용자 제공 텍스트 활용)
    // TODO: 사용자 제공 텍스트를 여기에 표시하는 로직 구현
    htmlContent += '<h3>능력치 설명</h3>';
    htmlContent += '<div id="stats-description">능력치 설명 텍스트</div>'; // 설명 텍스트를 담을 영역 ID

     statsOutputElement.innerHTML = htmlContent;

     // TODO: #stats-description 영역에 사용자 제공 능력치 설명 텍스트 채워넣기
     // const statsDescriptionElement = document.getElementById('stats-description');
     // if(statsDescriptionElement) { statsDescriptionElement.innerHTML = "..."; } // 사용자 제공 텍스트로 채움
}

function displayEquippedItems(equippedItems, itemData) {
    const itemsOutputElement = document.getElementById('equipped-items-output');
     if (!itemsOutputElement) return;

     let htmlContent = '<h3>장착 아이템</h3><ul>';
     // TODO: equippedItems 객체 순회하며 각 슬롯의 아이템 정보 표시
     // itemData.weapons, itemData.armors 등에서 아이템 코드(키)로 아이템 상세 정보 조회
     // 이미지 경로 규칙 (image/item/{itemCode}.png) 사용하여 이미지 표시

     htmlContent += '<li>무기: (선택된 아이템 이미지/이름)</li>';
     htmlContent += '<li>옷: (선택된 아이템 이미지/이름)</li>';
     // ... 다른 슬롯

     htmlContent += '</ul>';
     itemsOutputElement.innerHTML = htmlContent;
}

function displayFinalCalculation(result) {
    const outputElement = document.getElementById('calculation-output');
     if (!outputElement) return;

     let htmlContent = '<h3>최종 계산 결과</h3>';
     if (result !== null) {
          htmlContent += `<p>${result}</p>`; // calculateFinalDamage 결과 표시
     } else {
          htmlContent += '<p>계산 결과가 없습니다.</p>';
     }

     outputElement.innerHTML = htmlContent;
}


function displaySkillTable(skillResults, l10nData) {
    const skillTableOutputElement = document.getElementById('skill-table-output');
     if (!skillTableOutputElement) return;

     let htmlContent = '<h3>스킬 정보</h3>';
     htmlContent += '<table border="1"><thead><tr>';
     htmlContent += '<th>이미지</th><th>스킬 키</th><th>스킬 이름</th><th>스킬 레벨</th><th>소모값</th><th>쿨다운</th><th>결과값</th>';
     htmlContent += '</tr></thead><tbody>';

     // 각 스킬 결과에 대해 행 생성
     skillResults.forEach(skill => {
         htmlContent += '<tr>';
         // 이미지 표시 (Placeholder 또는 실제 이미지)
         // 이미지 경로 규칙 (image/skill/{skillCode}.png) 사용
         const imageUrl = `/image/skill/${skill.code}.png`; // 실제 이미지 경로
         const placeholderImageUrl = '/image/placeholder.png'; // Placeholder 이미지 경로
         // TODO: 실제 이미지가 없을 경우 Placeholder 사용 로직 구현
         htmlContent += `<td><img src="${placeholderImageUrl}" alt="${skill.name}" width="50"></td>`;

         htmlContent += `<td>${skill.skillKey}</td>`; // 스킬 키 (QWE R P)
         htmlContent += `<td>${skill.name}</td>`; // 스킬 이름
         htmlContent += `<td>${skill.level}</td>`; // 스킬 레벨
         htmlContent += `<td>${skill.cost} (${skill.costType})</td>`; // 소모값 (예: 70 (SP))
         htmlContent += `<td>${skill.cooldown}</td>`; // 쿨다운
         htmlContent += `<td>${skill.resultValue}</td>`; // 계산 결과값 (L10N + 수치 채워넣은 텍스트)
         htmlContent += '</tr>';

         // 스킬 설명 행 추가 (왼쪽 병합)
         htmlContent += '<tr>';
         htmlContent += `<td colspan="7"><strong>설명:</strong> ${skill.l10nDescText}</td>`; // Desc 텍스트 표시
         htmlContent += '</tr>';
          // Coef 텍스트 (복잡한 계산 결과 포함)는 resultValue에 이미 포함되어 표시됨

         // 확장팁 설명 행 추가 (왼쪽 병합)
         if (skill.l10nExpansionTipText) {
              htmlContent += '<tr>';
              htmlContent += `<td colspan="7"><strong>팁:</strong> ${skill.l10nExpansionTipText}</td>`; // ExpansionTip 텍스트 표시
              htmlContent += '</tr>';
         }

     });

     htmlContent += '</tbody></table>';
     skillTableOutputElement.innerHTML = htmlContent;

     // TODO: L10N 텍스트에 포함된 <color=...> HTML 태그를 실제 HTML/CSS 스타일로 변환하는 로직 구현
     // 이는 복잡할 수 있으며, 별도의 파싱 및 스타일 적용 함수가 필요할 수 있습니다.
}


// --- 페이지 로드 시 초기 데이터 로드 ---
document.addEventListener('DOMContentLoaded', loadData);

// --- 이벤트 리스너 (나중에 구현) ---
// 캐릭터 입력 변경, 콤보 계산 버튼 클릭 등 이벤트 발생 시
// calculateAndDisplayResults 함수를 호출하여 결과 업데이트