document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');

    let tierConfigGlobal = null;

    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const config = parseINI(iniString);
        tierConfigGlobal = config.tiers;
        initDropdowns(versionList);
        triggerLoad(tierConfigGlobal);
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

    function initDropdowns(versionList) {
        versionList.sort().reverse().forEach(v => {
            versionSelect.innerHTML += `<option value="${v}">${v}</option>`;
        });

        const tierMap = {
            "platinum_plus": "플래티넘+",
            "diamond_plus": "다이아몬드+",
            "meteorite_plus": "메테오라이트+",
            "mithril_plus": "미스릴+",
            "in1000": "in1000"
        };

        Object.entries(tierMap).forEach(([key, val]) => {
            tierSelect.innerHTML += `<option value="${key}">${val}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;

        versionSelect.addEventListener('change', () => triggerLoad(tierConfigGlobal));
        tierSelect.addEventListener('change', () => triggerLoad(tierConfigGlobal));
        periodSelect.addEventListener('change', () => triggerLoad(tierConfigGlobal));
    }

    function triggerLoad(tierConfig) {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json["통계"];
                const timestamps = Object.keys(history).sort();
                const latestKey = timestamps[timestamps.length - 1];
                const latestData = history[latestKey];

                let dataToUse = latestData;

                if (period !== 'latest') {
                    const days = period === '3day' ? 3 : 7;
                    const latestDate = new Date(latestKey);
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(pastDate.getDate() - days);

                    const pastKey = timestamps.reverse().find(ts => new Date(ts) <= pastDate);

                    if (pastKey && history[pastKey]) {
                        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));

                        const delta = [];
                        for (const name in currMap) {
                            const curr = currMap[name];
                            const prev = prevMap[name];
                            if (!prev) continue;
                            const diffSample = curr["표본수"] - prev["표본수"];
                            if (diffSample <= 0) continue;

                            delta.push({
                                "실험체": name,
                                "표본수": diffSample,
                                "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diffSample,
                                "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diffSample,
                                "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diffSample,
                                "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diffSample
                            });
                        }

                        dataToUse = delta;
                    }
                }

                const averageScore = calculateAverageScore(dataToUse);
                const stddev = calculateStandardDeviation(dataToUse, averageScore);
                const scoredData = calculateTiers(dataToUse, averageScore, stddev, tierConfig);
                displayTierTable(scoredData);
                setupTablePopup();
            });
    }

    function getRPScore(rp) {
        return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2;
    }

    function calculateAverageScore(data) {
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        let weightedSumRP = 0;
        let weightedSumWinRate = 0;
        let weightedSumTop3 = 0;
        data.forEach(item => {
            const weight = item["표본수"] / totalSampleCount;
            weightedSumRP += item["RP 획득"] * weight;
            weightedSumWinRate += item["승률"] * weight;
            weightedSumTop3 += item["TOP 3"] * weight;
        });
        return getRPScore(weightedSumRP) + weightedSumWinRate * 9 + weightedSumTop3 * 3;
    }

    function calculateStandardDeviation(data, avg) {
        const totalSample = data.reduce((sum, item) => sum + item["표본수"], 0);
        return Math.sqrt(data.reduce((sum, item) => {
            const score = getRPScore(item["RP 획득"]) + item["승률"] * 9 + item["TOP 3"] * 3;
            return sum + Math.pow(score - avg, 2) * (item["표본수"] / totalSample);
        }, 0));
    }

    function calculateTiers(data, averageScore, stddev, config) {
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        const averagePickRate = totalSampleCount > 0
            ? (data.reduce((sum, item) => sum + item["표본수"] / totalSampleCount, 0) / data.length)
            : 0;
        const k = 1.5;

        return data.map(item => {
            const pickRate = (item["표본수"] / totalSampleCount);
            const r = pickRate / averagePickRate;

            const 원점반영 = r <= 1/3
                ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)))
                : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k)));
            const 평균반영 = 1 - 원점반영;

            let 픽률보정계수 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            if (r > 5) {
                픽률보정계수 += 0.05 * (1 - Math.min((r - 5) / 5, 1));
            }

            const rpScore = getRPScore(item["RP 획득"]);
            let 보정점수;

            if (item["표본수"] < totalSampleCount * averagePickRate) {
                보정점수 = (rpScore + (item["승률"] * 9) + (item["TOP 3"] * 3)) *
                    (원점반영 + 평균반영 * Math.min(1, pickRate / averagePickRate)) +
                    averageScore * 평균반영 * (1 - Math.min(1, pickRate / averagePickRate));
                보정점수 *= 픽률보정계수;
            } else {
                보정점수 = (rpScore + (item["승률"] * 9) + (item["TOP 3"] * 3)) * 픽률보정계수;
            }

            const tier = calculateTier(보정점수, averageScore, stddev, config);
            return { ...item, "티어": tier, "점수": 보정점수 };
        });
    }

    function calculateTier(score, avg, std, config) {
        const diff = score - avg;
        if (diff > std * parseFloat(config["S+"])) return "S+";
        if (diff > std * parseFloat(config["S"])) return "S";
        if (diff > std * parseFloat(config["A"])) return "A";
        if (diff > std * parseFloat(config["B"])) return "B";
        if (diff > std * parseFloat(config["C"])) return "C";
        if (diff > std * parseFloat(config["D"])) return "D";
        return "F";
    }

    function displayTierTable(data) {
        const tiers = ["S+", "S", "A", "B", "C", "D", "F"];
        const tierGroups = {};
        tiers.forEach(t => tierGroups[t] = []);

        data.forEach(entry => {
            const tier = entry.티어;
            tierGroups[tier].push(entry);
        });

        const table = document.getElementById('tier-table');
        let html = '';

        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        const imagesPerRow = 15;

        tiers.forEach(tier => {
            html += `<tr class="tier-row tier-${tier}"><th>${tier}</th><td><div>`;
            tierGroups[tier]
                .sort((a, b) => b.점수 - a.점수)
                .forEach((entry, i) => {
                    const imgName = convertExperimentNameToImageName(entry.실험체).replace(/ /g, '_');
                    const tooltipHTML = `
                        <div class="tooltip-box">
                            ${entry.실험체}<br>
                            픽률: ${(entry["표본수"] / totalSampleCount * 100).toFixed(2)}%<br>
                            RP: ${entry["RP 획득"].toFixed(1)}<br>
                            승률: ${(entry["승률"] * 100).toFixed(1)}%
                        </div>
                    `;
                    html += `
                        <span class="tooltip-container">
                            <img src="image/${imgName}.png" alt="${entry.실험체}">
                            ${tooltipHTML}
                        </span>
                    `;
                    if ((i + 1) % imagesPerRow === 0 && i !== tierGroups[tier].length - 1) html += '</div><div>';
                });
            html += '</div></td></tr>';
        });

        table.innerHTML = html;
    }

    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        const closeButton = document.querySelector('.image-popup-close');
        const tableContainer = document.getElementById('tier-table-container');
        const popupTableButton = document.getElementById('popup-table-button');
        const tierTable = tableContainer.querySelector('.tier-table');

        if (popupTableButton && tierTable && popup && popupImage && closeButton) {
            popupTableButton.addEventListener('click', function () {
                html2canvas(tierTable, {
                    width: tierTable.offsetWidth,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: tierTable.offsetWidth,
                    windowHeight: tierTable.offsetHeight
                }).then(canvas => {
                    const version = document.getElementById('version-select').value;
                    const tier = document.getElementById('tier-select').value;
                    const period = document.getElementById('period-select').value;
                    const now = new Date();
                    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
                    const filename = `${version}_${tier}_${period}_${timestamp}.png`;

                    popup.style.display = 'block';
                    popupImage.src = canvas.toDataURL();
                    popupImage.alt = filename;
                });
            });

            closeButton.addEventListener('click', function () {
                popup.style.display = 'none';
            });

            window.addEventListener('click', function (event) {
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
            return `리다이린-${parts.join("-")}`;
        } else if (experimentName.startsWith("돌격 소총 ")) {
            const parts = experimentName.substring("돌격 소총 ".length).split(" ");
            return `${parts.join("-")}-돌격소총`;
        } else if (experimentName.includes(" ")) {
            const parts = experimentName.split(" ");
            if (parts.length >= 2) return `${parts[1]}-${parts[0]}`;
        }
        return experimentName;
    }
});
