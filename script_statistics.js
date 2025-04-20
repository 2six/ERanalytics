// script_statistics.js (공통 모듈 사용 + 그라디언트 수정 버전)
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');

    let currentSortColumn = "점수";
    let currentSortAsc = false;
    let lastSortedData = [];

    // 공통 모듈 로드
    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const tierConfig = parseINI(iniString).tiers;
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        versionSelect.addEventListener('change', () => triggerLoad(tierConfig));
        tierSelect.addEventListener('change', () => triggerLoad(tierConfig));
        periodSelect.addEventListener('change', () => triggerLoad(tierConfig));
        gradientCheckbox.addEventListener('change', () => displaySelectedData(lastSortedData));

        triggerLoad(tierConfig);
    });

    function triggerLoad(tierConfig) {
        loadAndRender(versionSelect.value, tierSelect.value, periodSelect.value, tierConfig);
    }

    function loadAndRender(version, tier, period, tierConfig) {
        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const entries = getEntriesFromPeriod(json['통계'], period);
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

        const pastKey = timestamps.slice().reverse().find(ts => {
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
            const diff = curr['표본수'] - prev['표본수'];
            if (diff <= 0) continue;
            delta.push({
                '실험체': name,
                '표본수': diff,
                'RP 획득': (curr['RP 획득'] * curr['표본수'] - prev['RP 획득'] * prev['표본수']) / diff,
                '승률': (curr['승률'] * curr['표본수'] - prev['승률'] * prev['표본수']) / diff,
                'TOP 3': (curr['TOP 3'] * curr['표본수'] - prev['TOP 3'] * prev['표본수']) / diff,
                '평균 순위': (curr['평균 순위'] * curr['표본수'] - prev['평균 순위'] * prev['표본수']) / diff
            });
        }
        return delta;
    }

    function calculateAndSortScores(data, tierConfig) {
        const totalSample = data.reduce((sum, i) => sum + i['표본수'], 0);
        const avgPickRate = data.reduce((sum, i) => sum + i['표본수'] / totalSample, 0) / data.length;

        let sumRP=0, sumWin=0, sumTop3=0;
        data.forEach(i => {
            const w = i['표본수'] / totalSample;
            sumRP += i['RP 획득'] * w;
            sumWin += i['승률'] * w;
            sumTop3 += i['TOP 3'] * w;
        });

        const avgScore = getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
        const stddev = Math.sqrt(data.reduce((acc, i) => {
            const s = getRPScore(i['RP 획득']) + i['승률'] * 9 + i['TOP 3'] * 3;
            return acc + Math.pow(s - avgScore, 2) * (i['표본수'] / totalSample);
        }, 0));

        const k = 1.5;
        return data.map(item => {
            const pickRate = item['표본수'] / totalSample;
            const r = pickRate / avgPickRate;
            const fromOrigin = r <= 1/3
                ? (0.6 + 0.2 * (1 - Math.exp(-k*3*r)) / (1 - Math.exp(-k)))
                : (0.8 + 0.2 * (1 - Math.exp(-k*1.5*(r-1/3))) / (1 - Math.exp(-k)));
            const fromMean = 1 - fromOrigin;

            let factor = 0.85 + 0.15 * (1 - Math.exp(-k*r)) / (1 - Math.exp(-k));
            if (r > 5) factor += 0.05 * (1 - Math.min((r-5)/5,1));

            const rpScore = getRPScore(item['RP 획득']);
            let score;
            if (item['표본수'] < totalSample * avgPickRate) {
                score = (rpScore + item['승률']*9 + item['TOP 3']*3)
                      * (fromOrigin + fromMean * Math.min(1, pickRate/avgPickRate))
                      + avgScore * fromMean * (1 - Math.min(1, pickRate/avgPickRate));
                score *= factor;
            } else {
                score = (rpScore + item['승률']*9 + item['TOP 3']*3) * factor;
            }
            const tier = calculateTier(score, avgScore, stddev, tierConfig);
            return {
                '실험체': item['실험체'],
                '점수': parseFloat(score.toFixed(2)),
                '티어': tier,
                '픽률': parseFloat((pickRate*100).toFixed(2)),
                'RP 획득': parseFloat(item['RP 획득'].toFixed(1)),
                '승률': parseFloat((item['승률']*100).toFixed(2)),
                'TOP 3': parseFloat((item['TOP 3']*100).toFixed(2)),
                '평균 순위': parseFloat(item['평균 순위'].toFixed(1))
            };
        });
    }

    const columns = [
        '실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'
    ];

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
                const val = row[col];
                const disp = ['픽률','승률','TOP 3'].includes(col) ? val.toFixed(2)+'%' : val;
                html += `<td>${disp}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        document.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.column;
                if (currentSortColumn === col) currentSortAsc = !currentSortAsc;
                else { currentSortColumn = col; currentSortAsc = false; }
                displaySelectedData(sortData(lastSortedData, currentSortColumn, currentSortAsc));
            });
        });

        if (gradientCheckbox.checked) applyGradientColors();
    }

    // 그라디언트 컬러 적용 (파랑-하양-빨강)
    function applyGradientColors() {
        const table = document.querySelector('#data-container table');
        if (!table) return;
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const headers = Array.from(table.querySelectorAll('thead th'));
        const goodCols = ['점수','픽률','RP 획득','승률','TOP 3'];
        const badCols = ['평균 순위'];

        headers.forEach((th, i) => {
            const col = th.dataset.column;
            if (![...goodCols, ...badCols].includes(col)) return;

            const values = rows.map(r => parseFloat(r.children[i].textContent.replace('%','')));
            const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach((r, idx) => {
                const v = values[idx];
                let diff = v - avg;
                let ratio, color;

                // 좋은 컬럼: 높을수록 빨강, 낮을수록 파랑
                if (goodCols.includes(col)) {
                    if (diff >= 0) {
                        ratio = max === avg ? 0 : diff / (max - avg);
                        color = interpolateColor([255,255,255], [230,124,115], ratio);
                    } else {
                        ratio = min === avg ? 0 : (avg - v) / (avg - min);
                        color = interpolateColor([255,255,255], [164,194,244], ratio);
                    }
                }
                // 나쁜 컬럼: 낮을수록 빨강, 높을수록 파랑
                else {
                    if (diff <= 0) {
                        ratio = min === avg ? 0 : (avg - v) / (avg - min);
                        color = interpolateColor([255,255,255], [230,124,115], ratio);
                    } else {
                        ratio = max === avg ? 0 : diff / (max - avg);
                        color = interpolateColor([255,255,255], [164,194,244], ratio);
                    }
                }

                r.children[i].style.backgroundColor = color;
            });
        });
    }

    // RGB 보간 함수 (0: start, 1: end)
    function interpolateColor(start, end, ratio) {
        const t = Math.max(0, Math.min(1, ratio));
        const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
        return `rgb(${rgb.join(',')})`;
    }
});