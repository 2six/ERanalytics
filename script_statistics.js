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

        versionSelect.addEventListener('change', triggerLoad);
        tierSelect.addEventListener('change', triggerLoad);
        periodSelect.addEventListener('change', triggerLoad);
        gradientCheckbox.addEventListener('change', () => {
            if (lastSortedData.length > 0) {
                const sorted = sortData(lastSortedData, currentSortColumn, currentSortAsc);
                displaySelectedData(sorted);
            }
        });

        triggerLoad();

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
        if (!column) return [...data];
        const numericCols = ["점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];
        const sorted = [...data].sort((a, b) => {
            const aVal = numericCols.includes(column) ? parseFloat(a[column]) : a[column];
            const bVal = numericCols.includes(column) ? parseFloat(b[column]) : b[column];
            return asc ? aVal - bVal : bVal - aVal;
        });
        lastSortedData = [...sorted];
        return sorted;
    }

    function displaySelectedData(data) {
        const container = document.getElementById('data-container');
        const columns = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

        let html = '<table><thead><tr>';
        columns.forEach(col => {
            html += `<th style="cursor:pointer;" data-column="${col}">${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(item => {
            html += '<tr>';
            columns.forEach(col => {
                let val = item[col];
                if (["점수", "RP 획득", "승률", "TOP 3", "평균 순위", "픽률"].includes(col)) {
                    val = parseFloat(val).toFixed(2);
                    if (["승률", "TOP 3", "픽률"].includes(col)) val += "%";
                }
                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        container.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.column;
                if (currentSortColumn === column) {
                    currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = column;
                    currentSortAsc = true;
                }
                const sorted = sortData(lastSortedData, currentSortColumn, currentSortAsc);
                displaySelectedData(sorted);
                if (gradientCheckbox.checked) applyGradientColors();
            });
        });

        lastSortedData = [...data];
        if (gradientCheckbox.checked) applyGradientColors();
    }

    function applyGradientColors() {
        const rows = document.querySelectorAll('#data-container tbody tr');
        const headers = document.querySelectorAll('#data-container thead th');

        const getNumeric = str => parseFloat(str.replace('%', ''));

        headers.forEach((th, index) => {
            const col = th.dataset.column;
            if (!["점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"].includes(col)) return;

            const values = Array.from(rows).map(row => getNumeric(row.children[index].textContent));
            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach(row => {
                const cell = row.children[index];
                const val = getNumeric(cell.textContent);
                const ratio = (val - min) / (max - min);

                let r, g, b;
                if (col === "평균 순위") ratio = 1 - ratio;

                const white = [255, 255, 255];
                const good = [230, 124, 115];
                const bad = [164, 194, 244];
                const mid = white;

                const mix = ratio < 0.5
                    ? interpolateColor(bad, mid, ratio * 2)
                    : interpolateColor(mid, good, (ratio - 0.5) * 2);

                cell.style.backgroundColor = `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
            });
        });
    }

    function interpolateColor(c1, c2, t) {
        return c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
    }
});
