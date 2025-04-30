document.addEventListener('DOMContentLoaded', async () => {
    const charactersUrl = '/data/er/processed/characters.json';
    const weaponTypesUrl = '/data/er/processed/weapon_type_info.json';
    const itemsUrl = '/data/er/processed/items.json'; // Added items URL

    let charactersData = [];
    let weaponTypeData = {};
    let itemsData = { weapons: [], armors: [] }; // Store all raw item data
    let completedItems = {}; // Store completed items categorized by type/slot { Weapon: [...], Head: [...], Chest: [...], Arm: [...], Leg: [...] }

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

    // Item select elements
    const itemSelectWeapon = document.getElementById('item-select-weapon');
    const itemSelectHead = document.getElementById('item-select-head');
    const itemSelectChest = document.getElementById('item-select-chest');
    const itemSelectArm = document.getElementById('item-select-arm');
    const itemSelectLeg = document.getElementById('item-select-leg');


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

            // Load item data
            const itemsResponse = await fetch(itemsUrl);
            itemsData = await itemsResponse.json();
            processItemsData(); // Process items after loading

            populateCharacterSelect();
            // Initial update after loading data and populating selects
            handleCharacterChange();

        } catch (error) {
            console.error('Failed to load data:', error);
            calculatedStatsDiv.innerHTML = '<p style="color: red;">데이터 로드 실패.</p>';
            skillInfoDiv.innerHTML = '<p style="color: red;">데이터 로드 실패.</p>';
        }
    }

     // Process and categorize completed items
    function processItemsData() {
        completedItems = {
            Weapon: [],
            Head: [],
            Chest: [],
            Arm: [],
            Leg: []
        };

        // Process weapons
        if (itemsData.weapons) {
            itemsData.weapons.forEach(item => {
                if (item.isCompletedItem && item.weaponType) {
                     completedItems.Weapon.push(item);
                }
            });
        }

        // Process armors
        if (itemsData.armors) {
            itemsData.armors.forEach(item => {
                // item.armorType can be "Head", "Chest", "Arm", "Leg"
                if (item.isCompletedItem && item.armorType && completedItems[item.armorType]) {
                     completedItems[item.armorType].push(item);
                } else if (item.isCompletedItem && !completedItems[item.armorType]) {
                    console.warn(`Unknown armorType: ${item.armorType} for completed item ${item.name} (${item.code}). Check items.json structure.`);
                }
            });
        }

        // Sort items alphabetically by name within each category
        Object.keys(completedItems).forEach(type => {
            completedItems[type].sort((a, b) => a.name.localeCompare(b.name));
        });

        console.log("Processed completed items:", completedItems); // Log processed items for debugging
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

     // Populate Item Selects based on character (for weapon) and item type (for armor)
    function populateItemSelects(character) {
        // Populate Weapon Select: Filter by character's allowed weapon types
        const allowedWeaponTypes = character.weaponMastery ? Object.keys(character.weaponMastery) : [];
        populateSlotSelect(itemSelectWeapon, completedItems.Weapon, 'weaponType', allowedWeaponTypes);

        // Populate Armor Selects (no character restriction needed for armor type itself)
        populateSlotSelect(itemSelectHead, completedItems.Head, 'armorType', ['Head']);
        populateSlotSelect(itemSelectChest, completedItems.Chest, 'armorType', ['Chest']);
        populateSlotSelect(itemSelectArm, completedItems.Arm, 'armorType', ['Arm']);
        populateSlotSelect(itemSelectLeg, completedItems.Leg, 'armorType', ['Leg']);
    }

    // Helper function to populate a single slot select
    function populateSlotSelect(selectElement, itemsForSlot, typeKey, allowedTypes) {
         selectElement.innerHTML = '<option value="">-- 아이템 없음 --</option>'; // Default option

         const filteredItems = itemsForSlot.filter(item => {
             if (!allowedTypes || allowedTypes.length === 0) return true; // No restriction based on allowedTypes (should not happen with current armor logic)
             // For weapons: check if the item's weaponType is in the character's allowed weapon types
             // For armor: check if the item's armorType is in the allowedTypes array (which should just contain the slot's type e.g., ['Head'])
             return allowedTypes.includes(item[typeKey]);
         });

         filteredItems.forEach(item => {
             const option = document.createElement('option');
             option.value = item.code;
             option.textContent = `${item.name} (${item.itemGrade})`; // Display item name and grade
             selectElement.appendChild(option);
         });
         // Enable/disable the select if there are actual items to choose from (beyond the default "None")
         selectElement.disabled = filteredItems.length === 0; // If no items match filter, disable except for "None"
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
             const skillName = skill ? skill.skillName.replace(/&짓뭉개기|&꿰뚫기|&처형식/g, '').trim() : key; // Use key if name not found, basic cleaning


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

        // Get selected item codes and find item data objects
        const selectedItemCodes = {
            weapon: parseInt(itemSelectWeapon.value, 10),
            head: parseInt(itemSelectHead.value, 10),
            chest: parseInt(itemSelectChest.value, 10),
            arm: parseInt(itemSelectArm.value, 10),
            leg: parseInt(itemSelectLeg.value, 10),
        };

        const selectedItems = {
             weapon: completedItems.Weapon.find(item => item.code === selectedItemCodes.weapon),
             head: completedItems.Head.find(item => item.code === selectedItemCodes.head),
             chest: completedItems.Chest.find(item => item.code === selectedItemCodes.chest),
             arm: completedItems.Arm.find(item => item.code === selectedItemCodes.arm),
             leg: completedItems.Leg.find(item => item.code === selectedItemCodes.leg),
        };


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
            selectedItems, // Add selected items
            enemyStats
        };
    }

     // Sum item stats considering ByLv/ByLevel stats
    function sumItemStats(items, charLevel) {
         const itemStats = {};
         // List of relevant stat keys (derived from JSON snippets and common knowledge)
         const statKeys = [
             'attackPower', 'defense', 'skillAmp', 'skillAmpRatio', 'adaptiveForce',
             'maxHp', 'maxSp', 'hpRegen', 'hpRegenRatio', 'spRegen', 'spRegenRatio',
             'attackSpeedRatio', 'criticalStrikeChance', 'criticalStrikeDamage', 'cooldownReduction',
             'preventCriticalStrikeDamaged', 'cooldownLimit', 'lifeSteal', 'normalLifeSteal',
             'skillLifeSteal', 'moveSpeed', 'moveSpeedRatio', 'moveSpeedOutOfCombat',
             'sightRange', 'attackRange', 'increaseBasicAttackDamage', 'increaseBasicAttackDamageRatio',
             'preventBasicAttackDamaged', 'preventBasicAttackDamagedRatio', 'preventSkillDamaged',
             'preventSkillDamagedRatio', 'penetrationDefense', 'penetrationDefenseRatio',
             'trapDamageReduce', 'trapDamageReduceRatio', 'slowResistRatio', 'hpHealedIncreaseRatio',
             'healerGiveHpHealRatio',
             // Unique stats (assume they add directly for now)
             'uniqueAttackRange', 'uniqueHpHealedIncreaseRatio', 'uniqueCooldownLimit',
             'uniqueTenacity', 'uniqueMoveSpeed', 'uniquePenetrationDefense',
             'uniquePenetrationDefenseRatio', 'uniqueLifeSteal', 'uniqueSkillAmpRatio'
         ];

         // Initialize all potential item stats to 0
         statKeys.forEach(key => {
             itemStats[key] = 0;
         });

         Object.values(items).forEach(item => {
             if (item) { // Ensure an item was selected for this slot
                 statKeys.forEach(key => {
                     // Add base stat value if it exists and is a number
                     if (item[key] !== undefined && typeof item[key] === 'number') {
                         itemStats[key] += item[key];
                     }
                     // Add ByLv/ByLevel stat * charLevel if it exists and is a number
                     const byLvKey = key + 'ByLv';
                     const byLevelKey = key + 'ByLevel';
                     if (item[byLvKey] !== undefined && typeof item[byLvKey] === 'number') {
                         itemStats[key] += item[byLvKey] * charLevel;
                     } else if (item[byLevelKey] !== undefined && typeof item[byLevelKey] === 'number') {
                          itemStats[key] += item[byLevelKey] * charLevel;
                     }
                 });
                 // Note: This simplified approach assumes ByLv/ByLevel stats always correspond
                 // to a base stat name without the suffix. This might need refinement
                 // if the actual JSON has different patterns.
             }
         });
         return itemStats;
    }


    // Calculate character stats
    function calculateStats(inputs) {
        const { character, weaponType, charLevel, weaponMasteryLevel, defenseMasteryLevel, moveMasteryLevel, selectedItems } = inputs;

        if (!character) return null;

        // 1. Calculate rawStats based on baseStats and levelUpStats
        // Start with a deep copy of baseStats to avoid modifying the original data
        const rawStats = JSON.parse(JSON.stringify(character.baseStats));

        if (charLevel > 0 && character.levelUpStats) {
            Object.keys(character.levelUpStats).forEach(statKey => {
                if (rawStats[statKey] !== undefined) { // Only update stats that exist in baseStats
                     // --- MODIFICATION 1: Change level calculation ---
                     rawStats[statKey] += character.levelUpStats[statKey] * charLevel;
                } else {
                     // If levelUpStats has a stat not in baseStats, initialize it in rawStats
                      rawStats[statKey] = character.levelUpStats[statKey] * charLevel;
                }
            });
        }

        // Ensure ratio stats and moveSpeed exist in rawStats, initialize to 0 if not
        // These might not be in baseStats but added by masteries or level ups
        const statsToAddIfMissing = ['attackSpeedRatio', 'skillAmpRatio', 'increaseBasicAttackDamageRatio', 'preventBasicAttackDamagedRatio', 'preventSkillDamagedRatio', 'moveSpeed'];
         statsToAddIfMissing.forEach(statKey => {
             if (rawStats[statKey] === undefined || rawStats[statKey] === null) { // Check for undefined or null
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
        rawStats.preventBasicAttackDamagedRatio = (rawStats.preventBasicAttackDamagedRatio || 0) + (0.01 * defenseMasteryLevel);
        rawStats.preventSkillDamagedRatio = (rawStats.preventSkillDamagedRatio || 0) + (0.008 * defenseMasteryLevel);

        // Apply Move Mastery
        rawStats.moveSpeed = (rawStats.moveSpeed || 0) + (0.01 * moveMasteryLevel);


        // 3. Calculate itemStats
        const itemStats = sumItemStats(selectedItems, charLevel);

        // 4. Calculate finalStats from rawStats and itemStats
        const finalStats = {};

        // Combine all potential stat keys from base, levelUp, masteries (added to raw), and items
        const allStatKeys = new Set([
             ...Object.keys(rawStats),
             ...Object.keys(itemStats)
             // Include weaponType stats that are added directly, if any (like attackSpeed)
             // For attackSpeed, the weaponType.attackSpeed is added after summing raw and item flat AS
        ]);

        allStatKeys.forEach(statKey => {
             // Default sum: rawStat + itemStat
             // Use || 0 to handle cases where a stat might be missing in one object
             finalStats[statKey] = (rawStats[statKey] || 0) + (itemStats[statKey] || 0);
        });


        // Special calculations for skillAmp and attackSpeed using combined ratios
        // The formula for skillAmpRatio and attackSpeedRatio should combine raw and item ratios
        finalStats.skillAmp = ((rawStats.skillAmp || 0) + (itemStats.skillAmp || 0)) * (1 + (rawStats.skillAmpRatio || 0) + (itemStats.skillAmpRatio || 0));

        // attackSpeed calculation: (Raw AS + Weapon Base AS + Item Flat AS) * (1 + Raw AS Ratio + Item AS Ratio)
        finalStats.attackSpeed = ((rawStats.attackSpeed || 0) + (weaponType ? weaponType.attackSpeed : 0) + (itemStats.attackSpeed || 0)) * (1 + (rawStats.attackSpeedRatio || 0) + (itemStats.attackSpeedRatio || 0));

        // Ensure all baseStats are present in finalStats even if calculated to 0 initially
        Object.keys(character.baseStats).forEach(statKey => {
            if (finalStats[statKey] === undefined) {
                finalStats[statKey] = character.baseStats[statKey];
            }
        });

         // Re-add any unique stats from items that might not have mapped to base stats
         // This is a fallback in case unique stats don't simply add to base stat keys
         const uniqueStatKeys = [
             'uniqueAttackRange', 'uniqueHpHealedIncreaseRatio', 'uniqueCooldownLimit',
             'uniqueTenacity', 'uniqueMoveSpeed', 'uniquePenetrationDefense',
             'uniquePenetrationDefenseRatio', 'uniqueLifeSteal', 'uniqueSkillAmpRatio'
         ];
         uniqueStatKeys.forEach(key => {
             if (itemStats[key] !== undefined && itemStats[key] !== 0) {
                  // Add unique stats directly to finalStats if they exist in itemStats
                  // Note: this assumes the unique stat name is the final stat name.
                  // If uniquePenetrationDefense adds to 'penetrationDefense', the earlier loop handles it.
                  // This part is more for unique stats that *don't* have a corresponding base stat name.
                  // For safety, let's assume they are just added.
                  finalStats[key] = (finalStats[key] || 0) + itemStats[key];
             }
         });


        // Calculate currentHp (assumed to be maxHp / 2)
        const currentHp = (finalStats.maxHp || 0) / 2; // Use calculated maxHp

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

        // --- MODIFICATION 3 (Refinement): Handle simple percentage strings specifically for display ---
        // If the expression is *only* a percentage string like "40%", return it directly without evaluating as math.
        // This is for cases where the JSON might use percentages directly in desc/coef that aren't meant for math evaluation.
         if (/^\d+(\.\d+)?%$/.test(expression.trim())) {
             return expression.trim(); // Return the percentage string as is
         }


        try {
             // Create a function that takes the context variables as arguments and returns the expression result
             // The expression string becomes the function body.
             // Accessing nested properties like finalStats.skillAmp works directly.
             // Using 'with' is an alternative for simpler access but is discouraged ('use strict' disallows it).
             // Function constructor is generally safer than eval().
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
                 // Iterate through all skills of the character to find the specific skill code
                 // This is necessary because placeholder data is tied to the specific skill code (e.g., 1076200 vs 1076210)
                 const skillForContext = Object.values(calculationContext.character.skills).find(s => s.code === calculationContext.skillCode);


                 // Determine if we are processing coef or desc based on the placeholderData object reference
                 const isCoefText = skillForContext && skillForContext.placeholder && placeholderData === skillForContext.placeholder.coef;


                 if (isCoefText) {
                     // If this is coef text, just use the expression value (string or number) as the display value
                     // Handle array values for coefs like "50/100/150" - pick the one for the current skill level
                     if (Array.isArray(expression)) {
                         // The level to use here should probably be the skill level for this skill code, NOT the base skill key level.
                         // However, the prompt says Q level applies to Q/Q2 etc. Let's stick to base skill level for now.
                         // If skill level is 1-based index into array, use skillLevel-1.
                         // Need to confirm if coef arrays are 0-indexed or 1-indexed from data. Assuming 1-indexed for now.
                         const skillLevelForCoef = calculationContext.skillLevel; // Using base skill level as per prompt
                         displayValue = expression[skillLevelForCoef - 1] !== undefined ? expression[skillLevelForCoef - 1] : `[수치 ${skillLevelForCoef} 레벨 데이터 없음]`;
                         // If the value is still an array (e.g. from a complex range), maybe join it? Or handle ranges differently?
                         if (Array.isArray(displayValue)) {
                             displayValue = displayValue.join('/'); // Simple join for ranges like "3m ~ 6.5m"
                         }

                     } else {
                        // Not an array, just use the value directly
                        displayValue = expression;
                     }

                 } else {
                     // If this is desc text, evaluate the expression
                     const calculatedValue = evaluateExpression(expression, calculationContext);

                      // Format the calculated value
                      if (typeof calculatedValue === 'number') {
                          // Round to 2 decimal places for numbers
                          displayValue = Math.round(calculatedValue * 100) / 100;
                          // Optional: Add percentage sign for ratio results?
                          // Need a way to know *if* the calculated value represents a percentage. Not easily inferrable from expression.
                          // Skipping percentage formatting for now.
                      } else {
                          // Use the raw value or error string
                          displayValue = calculatedValue;
                      }
                 }


                // Replace the placeholder in the text globally
                // Ensure the placeholder key itself is treated as a literal string for replacement
                // Using a function in replace() handles multiple occurrences correctly
                formattedText = formattedText.replace(new RegExp(placeholderKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), String(displayValue)); // Convert displayValue to string


            } else if (text.includes(placeholderKey)) {
                 // If placeholder exists in text but data is missing or empty, replace with a marker
                 // Check again if the placeholder is still in the text after potential replacements by other placeholders (less common but safer)
                 const regex = new RegExp(placeholderKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                 if (regex.test(formattedText)) {
                      console.warn(`Placeholder ${placeholderKey} found in text but missing from placeholderData.`, {text, placeholderData});
                      formattedText = formattedText.replace(regex, `[${placeholderKey} 데이터 없음]`);
                 }
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
            // Clear item selects and disable them
             itemSelectWeapon.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectWeapon.disabled = true;
             itemSelectHead.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectHead.disabled = true;
             itemSelectChest.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectChest.disabled = true;
             itemSelectArm.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectArm.disabled = true;
             itemSelectLeg.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectLeg.disabled = true;

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
                 'uniqueAttackRange', 'uniqueHpHealedIncreaseRatio', 'uniqueCooldownLimit', // Hide unique stats if they were added directly to finalStats
                 'uniqueTenacity', 'uniqueMoveSpeed', 'uniquePenetrationDefense',
                 'uniquePenetrationDefenseRatio', 'uniqueLifeSteal', 'uniqueSkillAmpRatio',
                 'normalLifeSteal', 'skillLifeSteal' // Often combined into Life Steal
                 // Add any other keys from baseStats/levelUpStats/items that should be hidden
             ];

             // Mapping for combined stats or better display names
             const statNameMap = {
                 maxHp: '최대 체력',
                 maxSp: '최대 SP',
                 attackPower: '공격력',
                 defense: '방어력',
                 skillAmp: '스킬 증폭',
                 adaptiveForce: '적응형 능력치',
                 criticalStrikeChance: '치명타 확률',
                 criticalStrikeDamage: '치명타 피해량',
                 hpRegen: '체력 재생 (수치)',
                 hpRegenRatio: '체력 재생 (비율)',
                 spRegen: 'SP 재생 (수치)',
                 spRegenRatio: 'SP 재생 (비율)',
                 attackSpeed: '공격 속도', // This is final calculated AS
                 attackSpeedRatio: '공격 속도 비율 (합산)', // This is the final ratio
                 increaseBasicAttackDamage: '기본 공격 추가 피해', // Flat
                 increaseBasicAttackDamageRatio: '기본 공격 증폭 (합산)', // Ratio
                 preventBasicAttackDamaged: '기본 공격 피해 감소 (수치)', // Flat
                 preventBasicAttackDamagedRatio: '기본 공격 피해 감소 (비율)', // Ratio
                 preventSkillDamaged: '스킬 피해 감소 (수치)', // Flat
                 preventSkillDamagedRatio: '스킬 피해 감소 (비율)', // Ratio
                 cooldownReduction: '쿨다운 감소',
                 cooldownLimit: '쿨다운 상한',
                 lifeSteal: '모든 피해 흡혈', // Might combine normal/skill if they exist
                 moveSpeed: '이동 속도',
                 moveSpeedRatio: '이동 속도 비율',
                 moveSpeedOutOfCombat: '비전투 이동 속도',
                 sightRange: '시야 범위',
                 penetrationDefense: '방어력 관통 (수치)',
                 penetrationDefenseRatio: '방어력 관통 (비율)',
                 trapDamageReduce: '트랩 피해 감소 (수치)',
                 trapDamageReduceRatio: '트랩 피해 감소 (비율)',
                 slowResistRatio: '둔화 저항',
                 hpHealedIncreaseRatio: '받는 회복량 증가',
                 healerGiveHpHealRatio: '주는 회복량 증가',
                 preventCriticalStrikeDamaged: '치명타 피해 감소', // Often a flat percentage or number
                 uniqueTenacity: '강인함' // Example mapping for a unique stat
                  // Add more mappings as needed
             };

             // Sort stats alphabetically by display name for cleaner output
             const sortedStatKeys = Object.keys(finalStats).sort((a, b) => {
                 const nameA = statNameMap[a] || a;
                 const nameB = statNameMap[b] || b;
                 return nameA.localeCompare(nameB);
             });


            sortedStatKeys.forEach(statKey => {
                 // --- MODIFICATION 2: Skip hidden stats ---
                 if (statsToHide.includes(statKey)) {
                     return; // Skip this iteration
                 }

                let displayValue = finalStats[statKey];
                // Apply basic formatting/rounding for common stats
                if (typeof displayValue === 'number') {
                     // Round to 2 decimal places
                     displayValue = Math.round(displayValue * 100) / 100;
                     // Optional: Add percentage sign heuristic (can be inaccurate)
                     // if ((statKey.toLowerCase().includes('ratio') || statKey.toLowerCase().includes('chance') || statKey.toLowerCase().includes('reduction') || statKey.toLowerCase().includes('resist')) && displayValue <= 1 && displayValue > 0) {
                     //      displayValue = (displayValue * 100).toFixed(1) + '%';
                     // } else if (statKey.toLowerCase().includes('damage') && statKey.toLowerCase().includes('critical') && displayValue > 1) {
                     //      displayValue = (displayValue * 100).toFixed(1) + '%'; // Critical Damage is multiplier
                     // }
                }

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
            // Sort skills by key family (P, Q, W, E, R) then by code number (Q before Q2)
            const sortedSkillCodes = Object.keys(character.skills).sort((a, b) => {
                 const skillA = character.skills[a];
                 const skillB = character.skills[b];
                 const keyOrder = ['P', 'Q', 'W', 'E', 'R'];
                 const keyA = skillA.skillKey.replace(/\d+/g, ''); // Remove numbers for sorting base keys
                 const keyB = skillB.skillKey.replace(/\d+/g, '');
                 const indexA = keyOrder.indexOf(keyA);
                 const indexB = keyOrder.indexOf(keyB);
                 if (indexA !== indexB) return indexA - indexB;
                 // Handle P, Q, W, E, R vs P2, Q2, etc. by code number
                 return parseInt(a) - parseInt(b); // Sort by skill code ascending
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
                     skillCode: skillCode, // Pass the specific skill code for context
                     character: character // Pass the character object for context
                     // Add any other context variables needed for expressions here
                 };

                 // --- MODIFICATION 3: Pass correct placeholder data and context ---
                 // Use skill.placeholder.coef and skill.placeholder.desc for placeholder data
                const formattedCoefText = formatSkillText(skill.l10nCoefText, skill.placeholder.coef, calculationContext);
                const formattedDescText = formatSkillText(skill.l10nDescText, skill.placeholder.desc, calculationContext);


                skillInfoDiv.innerHTML += `
                    <div class="skill">
                        <h3>${skill.skillName} (${skill.skillKey})</h3>
                         ${skill.l10nCoefText ? `<h4>계수 정보 (Coef Text)</h4><p class="coef-text">${formattedCoefText || '정보 없음'}</p>` : ''}
                         ${skill.l10nDescText ? `<h4>계산된 정보 (Desc Text)</h4><p class="desc-text">${formattedDescText || '정보 없음'}</p>` : ''}
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
            populateItemSelects(character); // Populate items after character is selected
            generateSkillLevelInputs(character);
            // Set character level max based on data (assuming max 20)
            charLevelInput.max = 20; // Assuming max char level is 20

            // Trigger initial UI update after selects/inputs are populated/generated
            updateUI();
        } else {
            // Clear UI if no character is selected
            weaponSelect.innerHTML = '<option value="">--</option>';
            weaponSelect.disabled = true;
            // Clear item selects and disable them
             itemSelectWeapon.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectWeapon.disabled = true;
             itemSelectHead.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectHead.disabled = true;
             itemSelectChest.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectChest.disabled = true;
             itemSelectArm.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectArm.disabled = true;
             itemSelectLeg.innerHTML = '<option value="">-- 아이템 없음 --</option>'; itemSelectLeg.disabled = true;

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

    // Add Event Listeners for item inputs
    itemSelectWeapon.addEventListener('change', updateUI);
    itemSelectHead.addEventListener('change', updateUI);
    itemSelectChest.addEventListener('change', updateUI);
    itemSelectArm.addEventListener('change', updateUI);
    itemSelectLeg.addEventListener('change', updateUI);


     enemyMaxHpInput.addEventListener('change', updateUI);
     enemyMaxHpInput.addEventListener('input', updateUI);
     enemyDefenseInput.addEventListener('change', updateUI);
     enemyDefenseInput.addEventListener('input', updateUI);
     enemyDefenseMasteryInput.addEventListener('change', updateUI);
     enemyDefenseMasteryInput.addEventListener('input', updateUI);


    // Initial Data Load
    loadData();

});