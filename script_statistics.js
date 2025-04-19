document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');

    let currentSortColumn = "점수";
    let currentSortAsc = false;
    let lastSortedData = [];

    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const tierConfig = parseINI(iniString).tiers;
        initDropdowns(versionList);

        versionSelect.addEventListener('change', () => triggerLoad(tierConfig));
        tierSelect.addEventListener('change', () => triggerLoad(tierConfig));
        periodSelect.addEventListener('change', () => triggerLoad(tierConfig));
        gradientCheckbox.addEventListener('change', () => displaySelectedData(lastSortedData));

        triggerLoad(tierConfig);
    });

    function initDropdowns(versionList) {
        versionList.sort().reverse().forEach(v => {
            versionSelect.innerHTML += `<option value="${v}">${v}</option>`;
        });

        ['platinum_plus', 'diamond_plus', 'meteorite_plus', 'mithril_plus', 'in1000'].forEach(tier => {
            tierSelect.innerHTML += `<option value="${tier}">${tier}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">버전 전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;
    }

    function triggerLoad(tierConfig) {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;
        loadAndRender(version, tier, period, tierConfig);
    }

    function loadAndRender(version, tier, period, tierConfig) {
        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json["통계"];
                const entries = getEntriesFromPeriod(history, period);
                const scored = calculateAndSortScores(entries, tierConfig);
                const sorted = sortData(scored, currentSortColumn, currentSortAsc);
                displaySelectedData(sorted);
            })
            .catch(err => {
                console.error('불러오기 실패:', err);
                document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.';
            });
    }

    function getEntriesFromPeriod(historyObj, period) {
        const timestamps = Object.keys(historyObj).sort();
        const latestKey = timestamps[timestamps.length - 1];
        const latestData = historyObj[latestKey];

        if (period === 'latest') return latestData;

        const days = period === '3day' ? 3 : 7;
        const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
        const pastDate = new Date(latestDate);
        pastDate.setDate(pastDate.getDate() - days);

        const pastKey = timestamps.reverse().find(ts => {
            const d = new Date(ts.replace(/_/g, ':').replace(/-/g, '/'));
            return d <= pastDate;
        });

        if (!pastKey || !historyObj[pastKey]) return latestData;

        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(historyObj[pastKey].map(d => [d.실험체, d]));

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
                "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diffSample,
            });
        }

        return delta;
    }

    function parseINI(iniString) {
        const config = {};
        let currentSection = null;
        iniString.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;
            const section = trimmed.match(/^\[(.*)\]$/);
            if (section) {
                currentSection = section[1];
                config[currentSection] = {};
                return;
            }
            const kv = trimmed.match(/^([^=]+)=(.*)$/);
            if (kv) config[currentSection][kv[1].trim()] = kv[2].trim();
        });
        return config;
    }

    function getRPScore(rp) {
        return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2;
    }

    function calculateAndSortScores(data, tierConfig) {
        const totalSample = data.reduce((sum, item) => sum + item["표본수"], 0);
        const avgPickRate = data.reduce((sum, i) => sum + i["표본수"] / totalSample, 0) / data.length;

        let sumRP = 0, sumWin = 0, sumTop3 = 0;
        data.forEach(i => {
            const w = i["표본수"] / totalSample;
            sumRP += i["RP 획득"] * w;
            sumWin += i["승률"] * w;
            sumTop3 += i["TOP 3"] * w;
        });

        const avgScore = getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
        const k = 1.5;

        return data.map(item => {
            const pickRate = item["표본수"] / totalSample;
            const r = pickRate / avgPickRate;
            const 원점반영 = r <= 1 / 3
                ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)))
                : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1 / 3))) / (1 - Math.exp(-k)));
            const 평균반영 = 1 - 원점반영;
            const 픽률보정 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            const rpScore = getRPScore(item["RP 획득"]);

            let score;
            if (item["표본수"] < totalSample * avgPickRate) {
                score = (
                    rpScore + item["승률"] * 9 + item["TOP 3"] * 3
                ) * (원점반영 + 평균반영 * Math.min(1, pickRate / avgPickRate)) +
                    avgScore * 평균반영 * (1 - Math.min(1, pickRate / avgPickRate));
                score *= 픽률보정;
            } else {
                score = (rpScore + item["승률"] * 9 + item["TOP 3"] * 3) * 픽률보정;
            }

            const tier = calculateTier(score, avgScore, tierConfig);
            return {
                "실험체": item["실험체"],
                "점수": parseFloat(score.toFixed(2)),
                "티어": tier,
                "픽률": parseFloat((pickRate * 100).toFixed(2)),
                "RP 획득": parseFloat(item["RP 획득"].toFixed(1)),
                "승률": parseFloat((item["승률"] * 100).toFixed(2)),
                "TOP 3": parseFloat((item["TOP 3"] * 100).toFixed(2)),
                "평균 순위": parseFloat(item["평균 순위"].toFixed(1))
            };
        });
    }

    function calculateTier(score, avgScore, config) {
        const diff = score - avgScore;
        if (diff > avgScore * parseFloat(config["S+"])) return "S+";
        if (diff > avgScore * parseFloat(config["S"])) return "S";
        if (diff > avgScore * parseFloat(config["A"])) return "A";
        if (diff > avgScore * parseFloat(config["B"])) return "B";
        if (diff > avgScore * parseFloat(config["C"])) return "C";
        if (diff > avgScore * parseFloat(config["D"])) return "D";
        return "F";
    }

    function sortData(data, column, asc) {
        const sorted = [...data].sort((a, b) => {
            if (typeof a[column] === 'number') {
                return asc ? a[column] - b[column] : b[column] - a[column];
            } else {
                return asc ? a[column].localeCompare(b[column]) : b[column].localeCompare(a[column]);
            }
        });
        return sorted;
    }
    
    const columns = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

    function displaySelectedData(data) {
        lastSortedData = data;
        const container = document.getElementById('data-container');

        let html = '<table><thead><tr>';
        columns.forEach(col => {
            html += `<th style="cursor:pointer;" data-column="${col}">${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                const value = row[col];
                const display = (["픽률", "승률", "TOP 3"].includes(col)) ? value.toFixed(2) + '%' : value;
                html += `<td>${display}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        document.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.column;
                if (currentSortColumn === col) {
                    currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    currentSortAsc = false;
                }
                const sorted = sortData(lastSortedData, currentSortColumn, currentSortAsc);
                displaySelectedData(sorted);
            });
        });

        if (gradientCheckbox.checked) {
            applyGradientColors();
        }
    }

    function applyGradientColors() {
        const container = document.querySelector('#data-container');
        const table = container.querySelector('table');
        if (!table) return;

        const rows = [...table.querySelectorAll('tbody tr')];
        const headers = [...table.querySelectorAll('thead th')];

        const goodCols = ["점수", "픽률", "RP 획득", "승률", "TOP 3"];
        const badCols = ["평균 순위"];

        headers.forEach((th, i) => {
            const col = th.dataset.column;
            if (![...goodCols, ...badCols].includes(col)) return;

            const values = rows.map(row => parseFloat(row.children[i].textContent.replace('%', '')));
            const weights = rows.map(row => parseFloat(row.children[columns.indexOf("픽률")].textContent.replace('%', '')));
            const isGood = goodCols.includes(col);

            const average = (col === "점수" || col === "픽률")
                ? values.reduce((a, b) => a + b, 0) / values.length
                : values.reduce((a, b, idx) => a + b * weights[idx], 0) / weights.reduce((a, b) => a + b, 0);

            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach((row, idx) => {
                const val = values[idx];
                const cell = row.children[i];
                let ratio;
                if (isGood) {
                    ratio = val < average ? (val - min) / (average - min) : (val - average) / (max - average);
                } else {
                    ratio = val > average ? (val - average) / (max - average) : (average - val) / (average - min);
                }
                ratio = Math.max(0, Math.min(1, ratio));
                const color = getGradientColor(ratio, val < average);
                cell.style.backgroundColor = color;
            });
        });
    }

    function getGradientColor(ratio, isLowerHalf) {
        const start = isLowerHalf ? [164, 194, 244] : [255, 255, 255];
        const end = isLowerHalf ? [255, 255, 255] : [230, 124, 115];
        const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * ratio));
        return `rgb(${rgb.join(',')})`;
    }
});
