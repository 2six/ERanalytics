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
        if (!mastery || Object.keys(mastery).length === 0) {
             const option = document.createElement('option');
             option.value = '';
             option.textContent = '사용 가능 무기 없음';
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
        // Determine unique skill keys (P, Q, W, E, R) from the character's skills
        const skillKeys = new Set();
        Object.values(character.skills).forEach(skill => {
             skillKeys.add(skill.skillKey.replace(/\d+/g, '')); // Add base key (P, Q, W, E, R)
        });
        const sortedSkillKeys = Array.from(skillKeys).sort((a, b) => {
             const order = ['P', 'Q', 'W', 'E', 'R'];
             return order.indexOf(a) - order.indexOf(b);
        });


        const skillMaxLevels = { 'Q': 5, 'W': 5, 'E': 5, 'R': 3, 'P': 3 }; // Max levels based on rules

        sortedSkillKeys.forEach(key => {
             // Find a skill with this base key to get its name (e.g., Q for Q and Q2)
             const skill = Object.values(character.skills).find(s => s.skillKey.replace(/\d+/g, '') === key);
             const skillName = skill ? skill.skillName.replace(/&꿰뚫기|&처형식/g, '').trim() : key; // Use key if name not found, basic cleaning


            const div = document.createElement('div');
            div.classList.add('input-group');
            div.innerHTML = `
                <label for="skill-${key.toLowerCase()}-level">${skillName} (${key}) 레벨:</label>
                <input type="number" id="skill-${key.toLowerCase()}-level" value="1" min="1" max="${skillMaxLevels[key] || 1}">
            `;
            skillLevelInputsDiv.appendChild(div);
        });
         // Add event listeners to new skill level inputs
         sortedSkillKeys.forEach(key => {
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
        // Ensure level is within bounds (1-20)
        const clampedCharLevel = Math.max(1, Math.min(20, charLevel));
        charLevelInput.value = clampedCharLevel; // Update input field if it was out of bounds

        const weaponMasteryLevel = parseInt(weaponMasteryLevelInput.value, 10) || 1;
        const defenseMasteryLevel = parseInt(defenseMasteryLevelInput.value, 10) || 1;
        const moveMasteryLevel = parseInt(moveMasteryLevelInput.value, 10) || 1;

        const skillLevels = {};
        const skillKeys = ['P', 'Q', 'W', 'E', 'R']; // Base keys
        const skillMaxLevels = { 'Q': 5, 'W': 5, 'E': 5, 'R': 3, 'P': 3 };

        skillKeys.forEach(key => {
            const input = document.getElementById(`skill-${key.toLowerCase()}-level`);
            if (input) {
                 const level = parseInt(input.value, 10) || 1;
                 // Ensure skill level is within bounds (1-max)
                 const clampedLevel = Math.max(1, Math.min(skillMaxLevels[key] || 1, level));
                 skillLevels[key] = clampedLevel;
                 input.value = clampedLevel; // Update input field
             } else {
                 skillLevels[key] = 1; // Default to 1 if input not found
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
            charLevel: clampedCharLevel, // Use clamped level
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
        // Start with a deep copy of baseStats to avoid modifying the original data
        const rawStats = JSON.parse(JSON.stringify(character.baseStats));

        if (charLevel > 0 && character.levelUpStats) {
            Object.keys(character.levelUpStats).forEach(statKey => {
                if (rawStats[statKey] !== undefined) { // Only update stats that exist in baseStats
                     // --- MODIFICATION 1: Change level calculation ---
                     rawStats[statKey] += character.levelUpStats[statKey] * charLevel;
                }
            });
        }

        // Ensure ratio stats and moveSpeed exist in rawStats, initialize to 0 if not
        // These might not be in baseStats but added by masteries
        const statsToAddIfMissing = ['attackSpeedRatio', 'skillAmpRatio', 'increaseBasicAttackDamageRatio', 'preventBasicAttackDamagedRatio', 'preventSkillDamagedRatio', 'moveSpeed'];
         statsToAddIfMissing.forEach(statKey => {
             if (rawStats[statKey] === undefined) {
                 rawStats[statKey] = 0;
             }
         });


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
        // Start with a deep copy of rawStats
        const finalStats = JSON.parse(JSON.stringify(rawStats));

        // Special calculations for skillAmp and attackSpeed
        finalStats.skillAmp = rawStats.skillAmp * (1 + rawStats.skillAmpRatio);
        // weaponType.attackSpeed comes from weapon_type_info.json
        finalStats.attackSpeed = (rawStats.attackSpeed + (weaponType ? weaponType.attackSpeed : 0)) * (1 + rawStats.attackSpeedRatio);

        // itemStats are zero, so most finalStats are just rawStats at this point.
        // Ensure all baseStats are present, even if they weren't in levelUpStats and were 0 in rawStats initially
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
        if (typeof expression !== 'string' || expression.trim() === "") {
            // If the placeholder value is not a string, is null/undefined, or empty, return it directly
            return expression;
        }

        // Define the variables available in the expression context
        // Use explicit names like finalStats.skillAmp, enemyStats.MaxHp etc.
        // Ensure all potential variables used in expressions are defined here
        const variables = {
            skillLevel: context.skillLevel,
            finalStats: context.finalStats,
            enemyStats: context.enemyStats,
            currentHp: context.currentHp, // Character's current HP (assumed max/2)
            enemyCurrentHp: context.enemyStats.MaxHp / 2, // Assume enemy current HP is also max/2 for calculations if needed
            // Add other potential variables directly from finalStats if needed
            // e.g., attackPower: context.finalStats.attackPower, defense: context.finalStats.defense, etc.
            // Accessing via finalStats.statName is supported by Function.
        };

        let executableExpression = expression;

        // Basic replacement for percentage strings like "40%" -> 0.4
        // This assumes percentages are only used as raw values in coef or desc, not within complex expressions
        // A more robust parser would handle percentages within expressions
         try {
             if (typeof expression === 'string' && expression.endsWith('%')) {
                 // Treat simple percentage strings like "40%" as the number 0.4
                 executableExpression = parseFloat(expression) / 100;
                 // If it was just a percentage string, return the number directly
                 if (String(parseFloat(expression) + '%') === expression) {
                      return executableExpression;
                 }
                  // Otherwise, it's a percentage within a larger expression, proceed with Function
             }
         } catch (e) {
             console.warn(`Could not parse potential percentage string: ${expression}`, e);
             // Continue trying to evaluate as a full expression
         }


        try {
             // Create a function that takes the context variables as arguments and returns the expression result
             // The expression string becomes the function body.
             // Accessing nested properties like finalStats.skillAmp works directly.
             const evaluator = new Function(...Object.keys(variables), `"use strict"; return (${executableExpression});`);
             return evaluator(...Object.values(variables));

         } catch (e) {
             console.error(`Error evaluating expression: "${expression}" with context`, context, e);
             return `ERROR: ${expression}`; // Indicate calculation failure
         }
    }

     // Format skill description text with calculated values
    function formatSkillText(text, placeholderData, calculationContext) {
        if (typeof text !== 'string' || !placeholderData) return text || ''; // Handle null/undefined text

        let formattedText = text;
        // --- MODIFICATION 3: Revised placeholder replacement logic ---
        // Iterate through defined placeholders and replace them in the text.
        // Sort keys by descending index to replace e.g., {10} before {1}.
        const placeholderKeys = Object.keys(placeholderData).sort((a, b) => {
            const indexA = parseInt(a.replace(/[{}]/g, ''), 10);
            const indexB = parseInt(b.replace(/[{}]/g, ''), 10);
            return indexB - indexA; // Descending sort
        });


        placeholderKeys.forEach(placeholderKey => {
            const expression = placeholderData[placeholderKey]; // e.g., "{0}" -> "4" or "{1}" -> "finalStats.skillAmp*0.2"

             // Only attempt evaluation/replacement if the expression exists and is not null/undefined
             // Empty string expressions "" might be valid data, so check specifically against undefined/null
             if (expression !== undefined && expression !== null) {
                 let displayValue;

                 // Check if this placeholderData object is the 'coef' object for the skill
                 // Need to find the actual skill object using the base skill key from context
                 const baseSkillKey = calculationContext.skillKeyBase;
                 const skillForContext = Object.values(calculationContext.character.skills).find(s => s.skillKey.replace(/\d+/g, '') === baseSkillKey);


                 if (skillForContext && placeholderData === skillForContext.placeholder.coef) {
                     // If this is coef text, just use the expression value (string or number) as the display value
                     displayValue = expression;
                 } else {
                     // If this is desc text, evaluate the expression
                     const calculatedValue = evaluateExpression(expression, calculationContext);

                      // Format the calculated value
                      if (typeof calculatedValue === 'number') {
                          // Round to 2 decimal places for numbers
                          displayValue = Math.round(calculatedValue * 100) / 100;
                      } else {
                          // Use the raw value or error string
                          displayValue = calculatedValue;
                      }
                 }


                // Replace the placeholder in the text globally
                // Ensure the placeholder key itself is treated as a literal string for replacement
                const regex = new RegExp(placeholderKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                formattedText = formattedText.replace(regex, displayValue);

            } else if (text.includes(placeholderKey)) {
                 // If placeholder exists in text but data is missing or empty, replace with a marker
                 const regex = new RegExp(placeholderKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                 formattedText = formattedText.replace(regex, `[${placeholderKey} 데이터 없음]`);
            }
        });

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
             // --- MODIFICATION 2: Define stats to hide ---
             const statsToHide = [
                 'strLearnStartSkill',
                 'strUsePointLearnStartSkill',
                 'initExtraPoint',
                 'maxExtraPoint',
                 'attackSpeedLimit',
                 'attackSpeedMin',
                 'radius', // 충돌 반경
                 'pathingRadius', // 경로 탐색 반경
                 'uiHeight', // UI 높이
                 'initStateDisplayIndex',
                 // Add any other keys from baseStats/levelUpStats that should be hidden
             ];

            Object.keys(finalStats).forEach(statKey => {
                 // --- MODIFICATION 2: Skip hidden stats ---
                 if (statsToHide.includes(statKey)) {
                     return; // Skip this iteration
                 }

                let displayValue = finalStats[statKey];
                // Apply basic formatting/rounding for common stats
                if (typeof displayValue === 'number') {
                     // Round to 2 decimal places
                     displayValue = Math.round(displayValue * 100) / 100;
                     // Optional: Add percentage sign for ratio stats?
                     // if (statKey.toLowerCase().includes('ratio') || statKey.toLowerCase().includes('chance')) {
                     //      displayValue = (displayValue * 100).toFixed(1) + '%'; // Display as percentage
                     // }
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
                    attackSpeed: '공격 속도', // This is final calculated AS
                    attackSpeedRatio: '공격 속도 비율 (합산)', // This is the final ratio
                    increaseBasicAttackDamageRatio: '기본 공격 증폭 (합산)',
                    skillAmpRatio: '스킬 증폭 비율 (합산)',
                    preventBasicAttackDamagedRatio: '기본 공격 피해 감소 (합산)',
                    preventSkillDamagedRatio: '스킬 피해 감소 (합산)',
                    moveSpeed: '이동 속도',
                    sightRange: '시야 범위',
                     // Removed radius, pathingRadius, uiHeight etc.
                };
                 const displayName = statNameMap[statKey] || statKey;

                calculatedStatsDiv.innerHTML += `<div><strong>${displayName}:</strong> ${displayValue}</div>`;
            });
             // --- MODIFICATION 2: Hide current HP display ---
             // calculatedStatsDiv.innerHTML += `<div><strong>현재 체력 (가정: 최대체력의 절반):</strong> ${Math.round(currentHp * 100) / 100}</div>`;

        } else {
            calculatedStatsDiv.innerHTML += '<p>스탯 계산 오류.</p>';
        }

        // Display Skill Info
        skillInfoDiv.innerHTML = '<h3>스킬 목록</h3>';
        if (character && character.skills) {
            // Sort skills by code (ascending) or key (P, Q, W, E, R, then Q2, R2 etc.)
            // Sorting by key family then number is better for display order
            const sortedSkillCodes = Object.keys(character.skills).sort((a, b) => {
                 const skillA = character.skills[a];
                 const skillB = character.skills[b];
                 const keyOrder = ['P', 'Q', 'W', 'E', 'R'];
                 const keyA = skillA.skillKey.replace(/\d+/g, ''); // Remove numbers for sorting base keys
                 const keyB = skillB.skillKey.replace(/\d+/g, '');
                 const indexA = keyOrder.indexOf(keyA);
                 const indexB = keyOrder.indexOf(keyB);
                 if (indexA !== indexB) return indexA - indexB;
                 // Handle P, Q, W, E, R vs P2, Q2, etc.
                 const numA = parseInt(skillA.skillKey.substring(1)) || 1; // Get number part, default to 1 for keys like P, Q, R etc.
                 const numB = parseInt(skillB.skillKey.substring(1)) || 1;
                 return numA - numB; // Secondary sort by number (Q before Q2)
            });


            sortedSkillCodes.forEach(skillCode => {
                const skill = character.skills[skillCode];
                // Get level based on the base skill key (Q level applies to Q, Q2)
                 const skillKeyBase = skill.skillKey.replace(/\d+/g, '');
                const skillLevel = skillLevels[skillKeyBase];

                // Context for skill text calculation
                 const calculationContext = {
                     skillLevel: skillLevel, // Level for this specific skill key family (e.g., Q level for Q and Q2)
                     finalStats: finalStats,
                     enemyStats: enemyStats,
                     currentHp: currentHp, // Character's current HP
                     enemyCurrentHp: enemyStats.MaxHp / 2, // Enemy current HP (assumed max/2)
                     skillKeyBase: skillKeyBase, // Pass the base skill key for context
                     character: character // Pass the character object for context
                     // Add any other context variables needed for expressions here
                 };

                 // --- MODIFICATION 3: Pass correct placeholder data and context ---
                const formattedCoefText = formatSkillText(skill.l10nCoefText, skill.placeholder.coef, calculationContext);
                const formattedDescText = formatSkillText(skill.l10nDescText, skill.placeholder.desc, calculationContext);


                skillInfoDiv.innerHTML += `
                    <div class="skill">
                        <h3>${skill.skillName} (${skill.skillKey})</h3>
                        <h4>${skill.l10nCoefText ? '계수 정보 (Coef Text)' : ''}</h4>
                        <p class="coef-text">${formattedCoefText || '정보 없음'}</p>
                        <h4>${skill.l10nDescText ? '계산된 정보 (Desc Text)' : ''}</h4>
                        <p class="desc-text">${formattedDescText || '정보 없음'}</p>
                         ${skill.l10nExpansionTipText ? `<p class="expansion-tip">${skill.l10nExpansionTipText}</p>` : ''}
                    </div>
                `;
            });
        }
    }

    // Handle character selection change
    function handleCharacterChange() {
        const inputs = getInputs(); // Use getInputs to get the character and other current values
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