document.addEventListener('DOMContentLoaded', () => {
    const optionSelect = document.getElementById('disassembleOptionSelect');
    const countInput = document.getElementById('simulationCountInput');
    const calculateButton = document.getElementById('calculateButton');
    const resultsArea = document.getElementById('resultsArea');
    const resultList = document.getElementById('resultList');
    const errorMessageDiv = document.getElementById('errorMessage');

    let probabilityData = null;

    // JSON 파일 로드 및 드롭다운 초기화
    fetch('Disassemble_Probability.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            probabilityData = data;
            populateDropdown(data.disassembleOptions);
        })
        .catch(error => {
            console.error('Error loading probability data:', error);
            errorMessageDiv.textContent = '확률 데이터를 불러오는 데 실패했습니다: ' + error.message;
        });

    function populateDropdown(options) {
        for (const key in options) {
            if (options.hasOwnProperty(key)) {
                const optionElement = document.createElement('option');
                optionElement.value = key;
                optionElement.textContent = options[key].displayName;
                optionSelect.appendChild(optionElement);
            }
        }
    }

    calculateButton.addEventListener('click', () => {
        if (!probabilityData) {
            errorMessageDiv.textContent = '확률 데이터가 아직 로드되지 않았습니다.';
            return;
        }

        const selectedOptionKey = optionSelect.value;
        const simulationCount = parseInt(countInput.value, 10);

        errorMessageDiv.textContent = ''; // 이전 오류 메시지 초기화
        resultsArea.style.display = 'none';
        resultList.innerHTML = '';


        if (!selectedOptionKey) {
            errorMessageDiv.textContent = '분해할 아이템 등급을 선택해주세요.';
            return;
        }
        if (isNaN(simulationCount) || simulationCount < 1) {
            errorMessageDiv.textContent = '분해 횟수는 1 이상의 숫자를 입력해주세요.';
            return;
        }

        const selectedOptionData = probabilityData.disassembleOptions[selectedOptionKey];
        if (!selectedOptionData) {
            errorMessageDiv.textContent = '선택된 등급에 대한 데이터를 찾을 수 없습니다.';
            return;
        }

        const expectedValues = calculateExpectedValues(selectedOptionData, simulationCount);
        displayResults(expectedValues);
    });

    function calculateExpectedValues(optionData, N) {
        const expectedRewards = {}; // { displayName: totalExpectedAmount }

        // 각 additionalRewards 그룹이 실제로 활성화될 확률 계산
        const activationProbabilities = {}; // { additionalRewardsOne: 0, additionalRewardsTwo: 0, ... }
        const eventProbs = optionData.eventProbabilities;

        // Initialize activation probabilities for existing additional reward groups
        for (const groupKey in optionData.rewardGroups) {
            if (groupKey.startsWith("additionalRewards")) {
                activationProbabilities[groupKey] = 0;
            }
        }
        
        if (eventProbs.triggersAdditionalGroup1Only) {
            activationProbabilities.additionalRewardsOne += eventProbs.triggersAdditionalGroup1Only;
        }
        if (eventProbs.triggersAdditionalGroup1And2Only) {
            activationProbabilities.additionalRewardsOne += eventProbs.triggersAdditionalGroup1And2Only;
            if (activationProbabilities.hasOwnProperty('additionalRewardsTwo')) {
                 activationProbabilities.additionalRewardsTwo += eventProbs.triggersAdditionalGroup1And2Only;
            }
        }
        if (eventProbs.triggersAdditionalGroup1And2And3) {
            activationProbabilities.additionalRewardsOne += eventProbs.triggersAdditionalGroup1And2And3;
            if (activationProbabilities.hasOwnProperty('additionalRewardsTwo')) {
                activationProbabilities.additionalRewardsTwo += eventProbs.triggersAdditionalGroup1And2And3;
            }
            if (activationProbabilities.hasOwnProperty('additionalRewardsThree')) {
                activationProbabilities.additionalRewardsThree += eventProbs.triggersAdditionalGroup1And2And3;
            }
        }
        // Add more eventProb keys if new ones are introduced (e.g., triggersAdditionalGroup2Only)

        // 1. 기본 보상 (baseRewards) 처리
        if (optionData.rewardGroups.baseRewards && Array.isArray(optionData.rewardGroups.baseRewards)) {
            optionData.rewardGroups.baseRewards.forEach(baseGroup => {
                baseGroup.items.forEach(item => {
                    const expectedAmount = N * 1.0 * item.amount * item.probability;
                    expectedRewards[item.displayName] = (expectedRewards[item.displayName] || 0) + expectedAmount;
                });
            });
        }

        // 2. 추가 보상 (additionalRewardsOne, additionalRewardsTwo, etc.) 처리
        for (const groupKey in optionData.rewardGroups) {
            if (groupKey.startsWith("additionalRewards")) {
                const additionalGroup = optionData.rewardGroups[groupKey];
                const activationProb = activationProbabilities[groupKey] || 0; // 해당 그룹 활성화 확률

                if (activationProb > 0 && additionalGroup.items) {
                    additionalGroup.items.forEach(item => {
                        let itemAmountInGroup = 0;
                        let itemProbInGroup = 0;

                        if (item.type === "multiple_unique_items_summed_probability") {
                            itemAmountInGroup = (item.amountPerItem || 1) * (item.itemCountIfAny || 1);
                            itemProbInGroup = item.totalProbabilityForAny || 0;
                        } else {
                            itemAmountInGroup = item.amount || 0;
                            itemProbInGroup = item.probability || 0;
                        }
                        
                        const expectedAmount = N * activationProb * itemAmountInGroup * itemProbInGroup;
                        expectedRewards[item.displayName] = (expectedRewards[item.displayName] || 0) + expectedAmount;
                    });
                }
            }
        }
        return expectedRewards;
    }

    function displayResults(expectedValues) {
        if (Object.keys(expectedValues).length === 0) {
            resultList.innerHTML = '<li>계산된 결과가 없습니다.</li>';
        } else {
            for (const itemName in expectedValues) {
                if (expectedValues.hasOwnProperty(itemName)) {
                    const listItem = document.createElement('li');
                    // 소수점 둘째자리까지 표시 (필요시 반올림)
                    listItem.textContent = `${itemName}: ${parseFloat(expectedValues[itemName].toFixed(4))} 개`;
                    resultList.appendChild(listItem);
                }
            }
        }
        resultsArea.style.display = 'block';
    }
});