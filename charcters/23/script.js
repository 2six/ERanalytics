document.addEventListener('DOMContentLoaded', async () => {
    const charactersUrl = '/data/er/processed/characters.json';
    const weaponTypesUrl = '/data/er/processed/weapon_type_info.json';

    let charactersData = [];
    let weaponTypeData = {};
    let selectedCharacter = null;
    let selectedWeaponType = null;

    const characterSelect = document.getElementById('character-select');
    const weaponSelect = document.getElementById('weapon-select');
    const charLevelInput = document.getElementById('char-level');
    const weaponMasteryLevelInput = document.getElementById('weapon-mastery-level');
    const defenseMasteryLevelInput = document.getElementById('defense-mastery-level');
    const moveMasteryLevelInput = document.getElementById('move-mastery-level');
    const skillLevelInputsDiv = document.getElementById('skill-level-inputs');
    const calculatedStatsDiv = document.getElementById('calculated-stats');
    const skillInfoDiv = document.getElementById('skill-info');

    const enemyMaxHpInput = document.getElementById('enemy-max-hp');
    const enemyDefenseInput = document.getElementById('enemy-defense');
    const enemyDefenseMasteryInput = document.getElementById('enemy-defense-mastery');


    // Data Loading
    async function loadData() {
        try {
            const charactersResponse = await fetch(charactersUrl);
            charactersData = await charactersResponse.json();

            const weaponTypesResponse = await fetch(weaponTypesUrl);
            weaponTypeData = await weaponTypesResponse.json();

            populateCharacterSelect();
            // Initial update after loading data and populating selects
            handleCharacterChange();

        } catch (error) {
            console.error('Failed to load data:', error);
            calculatedStatsDiv.innerHTML = '<p style="color: red;">데이터 로드 실패.</p>';
            skillInfoDiv.innerHTML = '<p style="color: red;">데이터 로드 실패.</p>';
        }
    }

    // Populate Character Select
    function populateCharacterSelect() {
        characterSelect.innerHTML = '';
        charactersData.forEach(char => {
            const option = document.createElement('option');
            option.value = char.code;
            option.textContent = char.name;
            characterSelect.appendChild(option);
        });
    }

     // Populate Weapon Select based on selected character
    function populateWeaponSelect(character) {
        weaponSelect.innerHTML = '';
        const mastery = character.weaponMastery;
        if (!mastery) {
             const option = document.createElement('option');
             option.value = '';
             option.textContent = '무기 없음';
             weaponSelect.appendChild(option);
             weaponSelect.disabled = true;
             return;
        }

        weaponSelect.disabled = false;
        Object.keys(mastery).forEach(weaponType => {
             // Check if weaponType exists in weaponTypeData
             if(weaponTypeData[weaponType]) {
                const option = document.createElement('option');
                option.value = weaponType;
                option.textContent = weaponType; // Display weapon type name
                weaponSelect.appendChild(option);
             } else {
                 console.warn(`Weapon type "${weaponType}" for character ${character.name} not found in weapon_type_info.json`);
             }
        });
         // Automatically select the first weapon if available
        if (weaponSelect.options.length > 0) {
             weaponSelect.value = weaponSelect.options[0].value;
        } else {
             // Handle case with no valid weapons
             const option = document.createElement('option');
             option.value = '';
             option.textContent = '사용 가능 무기 없음';
             weaponSelect.appendChild(option);
             weaponSelect.disabled = true;
        }
    }

    // Generate Skill Level Inputs
    function generateSkillLevelInputs(character) {
        skillLevelInputsDiv.innerHTML = '';
        const skillKeys = ['P', 'Q', 'W', 'E', 'R'];
        const skillMaxLevels = { 'Q': 5, 'W': 5, 'E': 5, 'R': 3, 'P': 3 }; // Max levels based on rules

        skillKeys.forEach(key => {
             // Find a skill with this key to get its name
             const skill = Object.values(character.skills).find(s => s.skillKey.startsWith(key));
             const skillName = skill ? skill.skillName : key; // Use key if name not found

            const div = document.createElement('div');
            div.classList.add('input-group');
            div.innerHTML = `
                <label for="skill-${key.toLowerCase()}-level">${skillName} 레벨:</label>
                <input type="number" id="skill-${key.toLowerCase()}-level" value="1" min="1" max="${skillMaxLevels[key] || 1}">
            `;
            skillLevelInputsDiv.appendChild(div);
        });
         // Add event listeners to new skill level inputs
         skillKeys.forEach(key => {
             const input = document.getElementById(`skill-${key.toLowerCase()}-level`);
             if (input) {
                 input.addEventListener('change', updateUI);
                 input.addEventListener('input', updateUI); // Also update on input
             }
         });
    }


    // Get all input values
    function getInputs() {
        const charCode = parseInt(characterSelect.value, 10);
        selectedCharacter = charactersData.find(char => char.code === charCode);

        const weaponType = weaponSelect.value;
        selectedWeaponType = weaponTypeData[weaponType]; // Get weapon type data from the second JSON

        const charLevel = parseInt(charLevelInput.value, 10) || 1;
        const weaponMasteryLevel = parseInt(weaponMasteryLevelInput.value, 10) || 1;
        const defenseMasteryLevel = parseInt(defenseMasteryLevelInput.value, 10) || 1;
        const moveMasteryLevel = parseInt(moveMasteryLevelInput.value, 10) || 1;

        const skillLevels = {};
        const skillKeys = ['P', 'Q', 'W', 'E', 'R'];
        skillKeys.forEach(key => {
            const input = document.getElementById(`skill-${key.toLowerCase()}-level`);
            if (input) {
                 skillLevels[key] = parseInt(input.value, 10) || 1;
             } else {
                 skillLevels[key] = 1; // Default to 1 if input not found (shouldn't happen after generation)
             }
        });

        const enemyStats = {
            MaxHp: parseInt(enemyMaxHpInput.value, 10) || 1000,
            Defense: parseInt(enemyDefenseInput.value, 10) || 50,
            DefenseMastery: parseInt(enemyDefenseMasteryInput.value, 10) || 1
        };


        return {
            character: selectedCharacter,
            weaponType: selectedWeaponType, // Pass the weapon type data object
            charLevel,
            weaponMasteryLevel,
            defenseMasteryLevel,
            moveMasteryLevel,
            skillLevels,
            enemyStats
        };
    }

    // Calculate character stats
    function calculateStats(inputs) {
        const { character, weaponType, charLevel, weaponMasteryLevel, defenseMasteryLevel, moveMasteryLevel } = inputs;

        if (!character) return null;

        // 1. Calculate rawStats based on baseStats and levelUpStats
        const rawStats = { ...character.baseStats };
        if (charLevel > 1 && character.levelUpStats) {
            Object.keys(character.levelUpStats).forEach(statKey => {
                if (rawStats[statKey] !== undefined) { // Only update stats that exist in baseStats
                     rawStats[statKey] += character.levelUpStats[statKey] * (charLevel - 1);
                }
            });
        }

        // Ensure ratio stats exist in rawStats, initialize to 0 if not
        const ratioStats = ['attackSpeedRatio', 'skillAmpRatio', 'increaseBasicAttackDamageRatio', 'preventBasicAttackDamagedRatio', 'preventSkillDamagedRatio'];
         ratioStats.forEach(statKey => {
             if (rawStats[statKey] === undefined) {
                 rawStats[statKey] = 0;
             }
         });
         if (rawStats.moveSpeed === undefined) rawStats.moveSpeed = character.baseStats.moveSpeed; // Ensure moveSpeed exists


        // 2. Apply Masteries to rawStats (ratios and moveSpeed)
        if (weaponType && character.weaponMastery && character.weaponMastery[weaponType.type]) { // Check weaponType.type
            const wm = character.weaponMastery[weaponType.type];
            if (wm.AttackSpeedRatio !== undefined) rawStats.attackSpeedRatio += wm.AttackSpeedRatio * weaponMasteryLevel;
            if (wm.SkillAmpRatio !== undefined) rawStats.skillAmpRatio += wm.SkillAmpRatio * weaponMasteryLevel;
            if (wm.IncreaseBasicAttackDamageRatio !== undefined) rawStats.increaseBasicAttackDamageRatio += wm.IncreaseBasicAttackDamageRatio * weaponMasteryLevel;
            // Assume other weapon mastery stats also add to rawStats if they exist in the data
        }

        // Apply Defense Mastery
        rawStats.preventBasicAttackDamagedRatio += 0.01 * defenseMasteryLevel;
        rawStats.preventSkillDamagedRatio += 0.008 * defenseMasteryLevel;

        // Apply Move Mastery
        rawStats.moveSpeed += 0.01 * moveMasteryLevel;


        // 3. Calculate finalStats from rawStats (itemStats = 0)
        const finalStats = { ...rawStats };

        // Special calculations for skillAmp and attackSpeed
        finalStats.skillAmp = rawStats.skillAmp * (1 + rawStats.skillAmpRatio);
        // weaponType.attackSpeed comes from weapon_type_info.json
        finalStats.attackSpeed = (rawStats.attackSpeed + (weaponType ? weaponType.attackSpeed : 0)) * (1 + rawStats.attackSpeedRatio);

        // itemStats are zero, so most finalStats are just rawStats
        // However, ensure all baseStats are present, even if not in levelUpStats
         Object.keys(character.baseStats).forEach(statKey => {
             if (finalStats[statKey] === undefined) {
                 finalStats[statKey] = character.baseStats[statKey];
             }
         });


        // Calculate currentHp (assumed to be maxHp / 2)
        const currentHp = finalStats.maxHp / 2;

        return { rawStats, finalStats, currentHp };
    }


    // Evaluate a mathematical expression string
    // This is a simplified evaluator assuming only basic arithmetic and specific variable names
    function evaluateExpression(expression, context) {
        if (typeof expression !== 'string') {
            // If the placeholder value is not a string (e.g., a number directly), return it
            return expression;
        }

        // Define the variables available in the expression context
        // Use explicit names like finalStats.skillAmp, enemyStats.MaxHp etc.
        const variables = {
            skillLevel: context.skillLevel,
            finalStats: context.finalStats,
            enemyStats: context.enemyStats,
            currentHp: context.currentHp, // Character's current HP (assumed max/2)
            enemyCurrentHp: context.enemyStats.MaxHp / 2 // Assume enemy current HP is also max/2 for calculations if needed
             // Add other potential variables like attackPower, defense, etc. directly from finalStats if needed
             // Or allow accessing them via finalStats.statName
        };

        let executableExpression = expression;

        // Basic variable replacement (be careful with variable names that are substrings of others)
        // This approach is fragile for complex expressions or unexpected variable names
        // A safer approach would involve tokenizing and parsing the expression tree
        // But for the specified format, simple replacement *might* work for demonstration
        // Let's use the Function constructor approach which is safer than eval()
         const paramNames = Object.keys(variables);
         const paramValues = Object.values(variables);

         try {
             // Create a function that takes the context variables as arguments and returns the expression result
             const evaluator = new Function(...paramNames, `"use strict"; return (${executableExpression});`);
             return evaluator(...paramValues);

         } catch (e) {
             console.error(`Error evaluating expression: "${expression}" with context`, context, e);
             return `ERROR: ${expression}`; // Indicate calculation failure
         }
    }

     // Format skill description text with calculated values
    function formatSkillText(text, placeholderData, calculationContext) {
        if (!text || !placeholderData) return text;

        let formattedText = text;
        const placeholders = formattedText.match(/\{(\d+)\}/g); // Find all {n} placeholders

        if (placeholders) {
            placeholders.forEach(placeholder => {
                const index = parseInt(placeholder.replace(/[{}]/g, ''), 10);
                const placeholderKey = `{${index}}`;
                const expression = placeholderData[placeholderKey]; // Get the expression string

                if (expression !== undefined) {
                    const calculatedValue = evaluateExpression(expression, calculationContext);

                    // Format the calculated value (e.g., round numbers)
                    let displayValue;
                    if (typeof calculatedValue === 'number') {
                        // Simple rounding for display
                        displayValue = Math.round(calculatedValue * 100) / 100; // Round to 2 decimal places
                    } else {
                        displayValue = calculatedValue; // Display as is if not a number (e.g., ERROR)
                    }

                    // Replace the placeholder in the text
                    // Use a regex with global flag to replace all occurrences
                    const regex = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                    formattedText = formattedText.replace(regex, displayValue);

                } else {
                    // If placeholder key is not found in data
                    formattedText = formattedText.replace(placeholder, `[${placeholder} 데이터 없음]`);
                }
            });
        }

        return formattedText;
    }

    // Update UI with calculated stats and skill info
    function updateUI() {
        const inputs = getInputs();
        const { character, skillLevels, enemyStats } = inputs;

        if (!character) {
            calculatedStatsDiv.innerHTML = '<p>캐릭터를 선택해주세요.</p>';
            skillInfoDiv.innerHTML = '';
            return;
        }

        const calculationResults = calculateStats(inputs);
        const { finalStats, currentHp } = calculationResults;

        // Display Calculated Stats
        calculatedStatsDiv.innerHTML = '<h3>최종 스탯</h3>';
        if (finalStats) {
            Object.keys(finalStats).forEach(statKey => {
                let displayValue = finalStats[statKey];
                // Apply basic formatting/rounding for common stats
                if (typeof displayValue === 'number') {
                     // Round percentages, speeds, regens differently? Basic rounding for now.
                     displayValue = Math.round(displayValue * 100) / 100; // Round to 2 decimal places
                }

                // Map internal keys to display names (optional but good for UI)
                const statNameMap = {
                    maxHp: '최대 체력',
                    maxSp: '최대 SP',
                    attackPower: '공격력',
                    defense: '방어력',
                    skillAmp: '스킬 증폭',
                    adaptiveForce: '적응형 능력치',
                    criticalStrikeChance: '치명타 확률',
                    hpRegen: '체력 재생',
                    spRegen: 'SP 재생',
                    attackSpeed: '공격 속도',
                    attackSpeedRatio: '공격 속도 비율',
                    increaseBasicAttackDamageRatio: '기본 공격 증폭',
                    skillAmpRatio: '스킬 증폭 비율',
                    preventBasicAttackDamagedRatio: '기본 공격 피해 감소',
                    preventSkillDamagedRatio: '스킬 피해 감소',
                    moveSpeed: '이동 속도',
                    sightRange: '시야 범위',
                    radius: '충돌 반경',
                    pathingRadius: '경로 탐색 반경',
                    uiHeight: 'UI 높이'
                     // Add more mappings as needed
                };
                 const displayName = statNameMap[statKey] || statKey;


                calculatedStatsDiv.innerHTML += `<div><strong>${displayName}:</strong> ${displayValue}</div>`;
            });
             // Add current HP
             calculatedStatsDiv.innerHTML += `<div><strong>현재 체력 (가정: 최대체력의 절반):</strong> ${Math.round(currentHp * 100) / 100}</div>`;

        } else {
            calculatedStatsDiv.innerHTML += '<p>스탯 계산 오류.</p>';
        }

        // Display Skill Info
        skillInfoDiv.innerHTML = '<h3>스킬 목록</h3>';
        if (character && character.skills) {
            // Sort skills by key P, Q, W, E, R, then Q2, R2 etc.
            const sortedSkillCodes = Object.keys(character.skills).sort((a, b) => {
                 const skillA = character.skills[a];
                 const skillB = character.skills[b];
                 const keyOrder = ['P', 'Q', 'W', 'E', 'R'];
                 const keyA = skillA.skillKey.replace(/\d+/g, ''); // Remove numbers for sorting base keys
                 const keyB = skillB.skillKey.replace(/\d+/g, '');
                 const indexA = keyOrder.indexOf(keyA);
                 const indexB = keyOrder.indexOf(keyB);
                 if (indexA !== indexB) return indexA - indexB;
                 return skillA.skillKey.localeCompare(skillB.skillKey); // Secondary sort by full key
            });


            sortedSkillCodes.forEach(skillCode => {
                const skill = character.skills[skillCode];
                const skillLevel = skillLevels[skill.skillKey.replace(/\d+/g, '')]; // Get level based on base key (Q level applies to Q, Q2)

                // Context for skill text calculation
                 const calculationContext = {
                     skillLevel: skillLevel, // Level for this specific skill key family (e.g., Q level for Q and Q2)
                     finalStats: finalStats,
                     enemyStats: enemyStats,
                     currentHp: currentHp, // Character's current HP
                     enemyCurrentHp: enemyStats.MaxHp / 2 // Enemy current HP (assumed max/2)
                     // Add any other context variables needed for expressions here
                 };


                const formattedCoefText = formatSkillText(skill.l10nCoefText, skill.placeholder.coef, calculationContext);
                const formattedDescText = formatSkillText(skill.l10nDescText, skill.placeholder.desc, calculationContext);


                skillInfoDiv.innerHTML += `
                    <div class="skill">
                        <h3>${skill.skillName} (${skill.skillKey})</h3>
                        <p class="coef-text">${formattedCoefText}</p>
                        <p class="desc-text">${formattedDescText}</p>
                         ${skill.l10nExpansionTipText ? `<p class="expansion-tip">${skill.l10nExpansionTipText}</p>` : ''}
                    </div>
                `;
            });
        }
    }

    // Handle character selection change
    function handleCharacterChange() {
        const inputs = getInputs();
        const character = inputs.character;
        if (character) {
            populateWeaponSelect(character);
            generateSkillLevelInputs(character);
            // Set character level max based on data (assuming max 20 if not specified, but usually 20)
            charLevelInput.max = 20; // Assuming max char level is 20

            // Trigger initial UI update after selects/inputs are populated/generated
            updateUI();
        } else {
            // Clear UI if no character is selected
            weaponSelect.innerHTML = '<option value="">--</option>';
            weaponSelect.disabled = true;
            skillLevelInputsDiv.innerHTML = '';
            calculatedStatsDiv.innerHTML = '<p>캐릭터를 선택해주세요.</p>';
            skillInfoDiv.innerHTML = '';
        }
    }


    // Add Event Listeners for inputs
    characterSelect.addEventListener('change', handleCharacterChange);
    weaponSelect.addEventListener('change', updateUI);
    charLevelInput.addEventListener('change', updateUI);
    charLevelInput.addEventListener('input', updateUI); // Also update on input as user types
    weaponMasteryLevelInput.addEventListener('change', updateUI);
     weaponMasteryLevelInput.addEventListener('input', updateUI);
    defenseMasteryLevelInput.addEventListener('change', updateUI);
     defenseMasteryLevelInput.addEventListener('input', updateUI);
    moveMasteryLevelInput.addEventListener('change', updateUI);
     moveMasteryLevelInput.addEventListener('input', updateUI);

     enemyMaxHpInput.addEventListener('change', updateUI);
     enemyMaxHpInput.addEventListener('input', updateUI);
     enemyDefenseInput.addEventListener('change', updateUI);
     enemyDefenseInput.addEventListener('input', updateUI);
     enemyDefenseMasteryInput.addEventListener('change', updateUI);
     enemyDefenseMasteryInput.addEventListener('input', updateUI);


    // Initial Data Load
    loadData();

});