document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');

    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const tierConfig = parseINI(iniString).tiers;
        initDropdowns(versionList);

        versionSelect.addEventListener('change', triggerLoad);
        tierSelect.addEventListener('change', triggerLoad);
        periodSelect.addEventListener('change', triggerLoad);
        gradientCheckbox.addEventListener('change', () => {
            triggerLoad();
        });

        triggerLoad(); // 초기 로딩
        function triggerLoad() {
            const version = versionSelect.value;
            const tier = tierSelect.value;
            const period = periodSelect.value;
            loadAndRender(version, tier, period, tierConfig);
        }
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

    function loadAndRender(version, tier, period, tierConfig) {
        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json["통계"];
                const entries = getEntriesFromPeriod(history, period);
                const scored = calculateAndSortScores(entries, tierConfig);
                displaySelectedData(scored);
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
        const avgPickRate = totalSample > 0 ? data.reduce((sum, i) => sum + i["표본수"] / totalSample, 0) / data.length : 0;

        let sumRP = 0, sumWin = 0, sumTop3 = 0;
        data.forEach(i => {
            const w = i["표본수"] / totalSample;
            sumRP += i["RP 획득"] * w;
            sumWin += i["승률"] * w;
            sumTop3 += i["TOP 3"] * w;
        });

        const avgScore = getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
        const k = 1.5;

        const scored = data.map(item => {
            const pickRate = item["표본수"] / totalSample;
            const r = pickRate / avgPickRate;
            const 원점반영 = r <= 1 / 3
                ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)))
                : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1 / 3))) / (1 - Math.exp(-k)));
            const 평균반영 = 1 - 원점반영;
            const 픽률보정 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            const rpScore = getRPScore(item["RP 획득"]);

            let 보정점수;
            if (item["표본수"] < totalSample * avgPickRate) {
                보정점수 = (
                    rpScore + item["승률"] * 9 + item["TOP 3"] * 3
                ) * (원점반영 + 평균반영 * Math.min(1, pickRate / avgPickRate)) +
                    avgScore * 평균반영 * (1 - Math.min(1, pickRate / avgPickRate));
                보정점수 *= 픽률보정;
            } else {
                보정점수 = (rpScore + item["승률"] * 9 + item["TOP 3"] * 3) * 픽률보정;
            }

            const tier = calculateTier(보정점수, avgScore, tierConfig);

            return {
                "실험체": item["실험체"],
                "점수": 보정점수,
                "티어": tier,
                "픽률": pickRate * 100,
                "RP 획득": item["RP 획득"],
                "승률": item["승률"] * 100,
                "TOP 3": item["TOP 3"] * 100,
                "평균 순위": item["평균 순위"]
            };
        });

        return scored;
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

    let currentSortColumn = null;
    let currentSortAsc = true;
    let lastSortedData = [];

    function displaySelectedData(data) {
        const container = document.getElementById('data-container');
        const columns = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

        // 테이블 헤더 (정렬 가능)
        let html = '<table><thead><tr>';
        columns.forEach(col => {
            html += `<th style="cursor:pointer;" data-column="${col}">${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 테이블 본문
        data.forEach(item => {
            html += '<tr>';
            columns.forEach(col => {
                html += `<td>${item[col]}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // 헤더 클릭 이벤트 등록
        container.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.column;
                if (currentSortColumn === column) {
                    currentSortAsc = !currentSortAsc; // 방향 토글
                } else {
                    currentSortColumn = column;
                    currentSortAsc = true;
                }
                const sorted = sortData(lastSortedData, currentSortColumn, currentSortAsc);
                displaySelectedData(sorted);
                if (document.getElementById('gradient-checkbox').checked) {
                    applyGradientColors();
                }
            });
        });

        lastSortedData = [...data]; // 현재 데이터 저장

        if (document.getElementById('gradient-checkbox').checked) {
            applyGradientColors();
        }
    }

    function sortData(data, column, asc) {
        const numericCols = ["점수", "RP 획득", "승률", "TOP 3", "평균 순위"];
        const sorted = [...data].sort((a, b) => {
            const aVal = numericCols.includes(column) ? parseFloat(a[column]) : a[column];
            const bVal = numericCols.includes(column) ? parseFloat(b[column]) : b[column];
            return asc ? aVal - bVal : bVal - aVal;
        });
        return sorted;
    }

    function applyGradientColors() {
        const rows = document.querySelectorAll('#data-container tbody tr');
        const cells = document.querySelectorAll('#data-container thead th');

        const getNumeric = str => parseFloat(str.replace('%', ''));

        cells.forEach((th, index) => {
            const colName = th.dataset.column;
            if (!["점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"].includes(colName)) return;

            const values = Array.from(rows).map(row => getNumeric(row.children[index].textContent));
            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach(row => {
                const cell = row.children[index];
                const val = getNumeric(cell.textContent);
                const ratio = (val - min) / (max - min);
                const red = Math.round(255 * (1 - ratio));
                const blue = Math.round(255 * ratio);
                cell.style.backgroundColor = `rgb(${red}, ${red}, ${blue})`;
            });
        });
    }

    // 색상 강조 체크 시 다시 반영 (정렬 유지)
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('gradient-checkbox').addEventListener('change', () => {
            if (lastSortedData.length > 0) {
                const sorted = sortData(lastSortedData, currentSortColumn, currentSortAsc);
                displaySelectedData(sorted);
            }
        });
    });
});
