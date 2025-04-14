document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            fetch('config.ini')
                .then(response => response.text())
                .then(iniString => {
                    const parsedConfig = parseINI(iniString);
                    const tierConfig = parsedConfig.tiers;
                    const sortedData = calculateAndSortScores(data, tierConfig);
                    displaySelectedData(sortedData);
                })
                .catch(error => {
                    console.error('config.ini 파일을 불러오는 중 오류 발생:', error);
                    const sortedData = calculateAndSortScores(data, {});
                    displaySelectedData(sortedData);
                });
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    function parseINI(iniString) {
        const config = {};
        let currentSection = null;

        const lines = iniString.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) {
                continue;
            }

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
                if (currentSection) {
                    config[currentSection][key] = value;
                } else {
                    config[key] = value;
                }
            }
        }
        return config;
    }

    function calculateAndSortScores(data, tierConfig) {
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        const averagePickRate = totalSampleCount > 0
            ? (data.reduce((sum, item) => sum + item["표본수"] / totalSampleCount, 0) / data.length)
            : 0;

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

        const averageScore = (Math.log(averageRP + 1) * 3) + (averageWinRate * 9) + (averageTop3 * 3);
        const k = 1.5;

        const scoredData = data.map(item => {
            const pickRate = (item["표본수"] / totalSampleCount);
            const r = pickRate / averagePickRate;

            const 원점반영 = r <= 1/3 ?
                (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))) :
                (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k)));

            const 평균반영 = 1 - 원점반영;

            const 픽률보정계수 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));

            let 보정점수;
            if (item["표본수"] < totalSampleCount * averagePickRate) {
                보정점수 = (
                    (Math.log(item["RP 획득"] + 1) * 3) + (item["승률"] * 9) + (item["TOP 3"] * 3)
                ) * (원점반영 + 평균반영 * Math.min(1, pickRate / averagePickRate)) +
                averageScore * 평균반영 * (1 - Math.min(1, pickRate / averagePickRate));
                보정점수 *= 픽률보정계수;
            } else {
                보정점수 = ((Math.log(item["RP 획득"] + 1) * 3) + (item["승률"] * 9) + (item["TOP 3"] * 3)) * 픽률보정계수;
            }

            const tier = calculateTier(보정점수, averageScore, tierConfig);

            return {
                "실험체": item["실험체"],
                "점수": 보정점수,
                "티어": tier,
                "픽률": (pickRate * 100).toFixed(2) + '%',
                "RP 획득": item["RP 획득"].toFixed(1), // ✅ 소숫점 1자리까지
                "승률": (item["승률"] * 100).toFixed(2) + '%', // ✅ 퍼센트 변환
                "TOP 3": (item["TOP 3"] * 100).toFixed(2) + '%', // ✅ 퍼센트 변환
                "평균 순위": item["평균 순위"].toFixed(1)
            };
        });

        scoredData.sort((a, b) => b.점수 - a.점수);
        return scoredData;
    }

    function calculateTier(score, averageScore, config) {
        const diff = score - averageScore;
        if (diff > averageScore * parseFloat(config["S+"])) {
            return "S+";
        } else if (diff > averageScore * parseFloat(config["S"])) {
            return "S";
        } else if (diff > averageScore * parseFloat(config["A"])) {
            return "A";
        } else if (diff > averageScore * parseFloat(config["B"])) {
            return "B";
        } else if (diff > averageScore * parseFloat(config["C"])) {
            return "C";
        } else if (diff > averageScore * parseFloat(config["D"])) {
            return "D";
        } else {
            return "F";
        }
    }

    function displaySelectedData(data) {
        const container = document.getElementById('data-container');
        const columnsToShow = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

        let html = '<table><thead><tr>';
        columnsToShow.forEach(column => {
            html += `<th>${column}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(item => {
            html += '<tr>';
            columnsToShow.forEach(column => {
                html += `<td>${item[column]}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }
});
