document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            fetch('config.ini')
                .then(response => response.text())
                .then(iniString => {
                    const tierConfig = parseINI(iniString).tiers;
                    const averageScore = calculateAverageScore(data);
                    const scoredData = calculateTiers(data, averageScore, tierConfig);
                    displayTierTable(scoredData);
                    setupTablePopup(); // 표 팝업 기능 설정
                })
                .catch(error => {
                    console.error('config.ini 파일을 불러오는 중 오류 발생:', error);
                    const averageScore = calculateAverageScore(data);
                    const scoredData = calculateTiers(data, averageScore, {});
                    displayTierTable(scoredData);
                    setupTablePopup(); // 표 팝업 기능 설정
                });
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('tier-table-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    function parseINI(iniString) {
        const config = {};
        let currentSection = null;
        const lines = iniString.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) continue;
            const sectionMatch = trimmedLine.match(/^\[(.*)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                config[currentSection] = {};
                continue;
            }
            const keyValueMatch = trimmedLine.match(/^([^=]+)=(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                const value = keyValueMatch[2].trim();
                if (currentSection) config[currentSection][key] = value;
            }
        }
        return config;
    }

    function calculateAverageScore(data) {
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        let weightedSumRP = 0;
        let weightedSumWinRate = 0;
        let weightedSumTop3 = 0;
        data.forEach(item => {
            weightedSumRP += item["RP 획득"] * (item["표본수"] / totalSampleCount);
            weightedSumWinRate += item["승률"] * (item["표본수"] / totalSampleCount);
            weightedSumTop3 += item["TOP 3"] * (item["표본수"] / totalSampleCount);
        });
        const averageRP = weightedSumRP;
        const averageWinRate = weightedSumWinRate;
        const averageTop3 = weightedSumTop3;
        return (Math.log(averageRP + 1) * 3) + (averageWinRate * 9) + (averageTop3 * 3);
    }

    function calculateTiers(data, averageScore, config) {
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        const averagePickRate = totalSampleCount > 0 ? (data.reduce((sum, item) => sum + item["표본수"] / totalSampleCount, 0) / data.length) : 0;
        const k = 1.5;
        return data.map(item => {
            const pickRate = (item["표본수"] / totalSampleCount);
            const r = pickRate / averagePickRate;
            const 원점반영 = r <= 1/3 ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))) : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k)));
            const 평균반영 = 1 - 원점반영;
            const 픽률보정계수 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            let 보정점수;
            if (item["표본수"] < totalSampleCount * averagePickRate) {
                보정점수 = ((Math.log(item["RP 획득"] + 1) * 3) + (item["승률"] * 9) + (item["TOP 3"] * 3)) * (원점반영 + 평균반영 * Math.min(1, pickRate / averagePickRate)) + averageScore * 평균반영 * (1 - Math.min(1, pickRate / averagePickRate));
                보정점수 *= 픽률보정계수;
            } else {
                보정점수 = ((Math.log(item["RP 획득"] + 1) * 3) + (item["승률"] * 9) + (item["TOP 3"] * 3)) * 픽률보정계수;
            }
            const tier = calculateTier(보정점수, averageScore, config);
            return { ...item, "티어": tier };
        });
    }

    function calculateTier(score, averageScore, config) {
        const diff = score - averageScore;
        if (diff > averageScore * parseFloat(config["S+"])) return "S+";
        if (diff > averageScore * parseFloat(config["S"])) return "S";
        if (diff > averageScore * parseFloat(config["A"])) return "A";
        if (diff > averageScore * parseFloat(config["B"])) return "B";
        if (diff > averageScore * parseFloat(config["C"])) return "C";
        if (diff > averageScore * parseFloat(config["D"])) return "D";
        return "F";
    }

    function displayTierTable(scoredData) {
        const tierGroups = {};
        const orderedTiers = ["S+", "S", "A", "B", "C", "D", "F"];
        const imagesPerRow = 15;

        scoredData.forEach(item => {
            const tier = item["티어"];
            if (!tierGroups[tier]) {
                tierGroups[tier] = [];
            }
            tierGroups[tier].push(item["실험체"]);
        });

        const container = document.getElementById('tier-table-container');
        let html = '<table class="tier-table">';

        orderedTiers.forEach(tier => {
            html += '<tr class="tier-row">';
            html += `<th>${tier}</th>`;
            html += '<td><div>';
            if (tierGroups[tier]) {
                tierGroups[tier].forEach((experiment, index) => {
                    const imageName = convertExperimentNameToImageName(experiment);
                    const imageSrc = `image/${imageName}.png`;
                    html += `<img src="${imageSrc}" alt="${experiment}">`;
                    if ((index + 1) % imagesPerRow === 0 && index !== 0 && index !== tierGroups[tier].length - 1) {
                        html += '</div><div>';
                    }
                });
            }
            html += '</div></td>';
            html += '</tr>';
        });

        html += '</table>';
        container.innerHTML = html;
    }

    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        const closeButton = document.querySelector('.image-popup-close');
        const tableContainer = document.getElementById('tier-table-container');
        const popupTableButton = document.getElementById('popup-table-button');
        const tierTable = tableContainer.querySelector('.tier-table'); // 실제 표 요소 선택
    
        if (popupTableButton && tierTable && popup && popupImage && closeButton) {
            popupTableButton.addEventListener('click', function() {
                html2canvas(tierTable, { // 캡처 대상을 실제 표 요소로 변경
                    width: tierTable.offsetWidth, // 표의 실제 너비 사용
                    scrollX: 0,
                    scrollY: 0, // 스크롤 보정 제거
                    windowWidth: tierTable.offsetWidth, // 뷰포트 너비도 표 너비로 제한
                    windowHeight: tierTable.offsetHeight // 뷰포트 높이도 표 높이로 제한 (선택 사항)
                }).then(canvas => {
                    popup.style.display = 'block';
                    popupImage.src = canvas.toDataURL();
                    popupImage.alt = '티어표 이미지';
                });
            });
    
            closeButton.addEventListener('click', function() {
                popup.style.display = 'none';
            });
    
            window.addEventListener('click', function(event) {
                if (event.target === popup) {
                    popup.style.display = 'none';
                }
            });
        }
    }

    function convertExperimentNameToImageName(experimentName) {
        if (experimentName === "글러브 리 다이린") {
            return "리다이린-글러브";
        } else if (experimentName === "쌍절곤 리 다이린") {
            return "리다이린-쌍절곤";
        } else if (experimentName.startsWith("리 다이린 ")) {
            const parts = experimentName.substring("리 다이린 ".length).split(" ");
            if (parts.length > 0) {
                return `리다이린-${parts.join("-")}`;
            } else {
                return "리다이린";
            }
        } else if (experimentName.startsWith("돌격 소총 ")) {
            const parts = experimentName.substring("돌격 소총 ".length).split(" ");
            return `${parts.join("-")}-돌격소총`;
        } else if (experimentName.includes(" ")) {
            const parts = experimentName.split(" ");
            if (parts.length >= 2) {
                return `${parts[1]}-${parts[0]}`;
            }
        }
        return experimentName;
    }
});