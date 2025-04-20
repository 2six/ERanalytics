// script_tier_table.js (공통 모듈 사용 버전)
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    let tierConfigGlobal = null;

    // 공통 모듈 로드
    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        // parseINI: script_common.js
        const config = parseINI(iniString);
        tierConfigGlobal = config.tiers;

        // 드롭다운 초기화: script_common.js
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);
        // 원본 레이블 유지
        periodSelect.options[0].text = '전체';

        // 이벤트 연결
        versionSelect.addEventListener('change', () => triggerLoad(tierConfigGlobal));
        tierSelect.addEventListener('change', () => triggerLoad(tierConfigGlobal));
        periodSelect.addEventListener('change', () => triggerLoad(tierConfigGlobal));

        triggerLoad(tierConfigGlobal);
    });

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
                const history = json['통계'];
                const timestamps = Object.keys(history).sort();
                const latestKey = timestamps[timestamps.length - 1];
                const latestData = history[latestKey];
                let dataToUse = latestData;

                if (period !== 'latest') {
                    const days = period === '3day' ? 3 : 7;
                    const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(pastDate.getDate() - days);

                    const pastKey = timestamps.slice().reverse().find(ts => {
                        const d = new Date(ts.replace(/_/g, ':').replace(/-/g, '/'));
                        return d <= pastDate;
                    });

                    if (pastKey && history[pastKey]) {
                        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));
                        const delta = [];
                        for (const name in currMap) {
                            const curr = currMap[name];
                            const prev = prevMap[name];
                            if (!prev) continue;
                            const diffSample = curr['표본수'] - prev['표본수'];
                            if (diffSample <= 0) continue;
                            delta.push({
                                '실험체': name,
                                '표본수': diffSample,
                                'RP 획득': (curr['RP 획득'] * curr['표본수'] - prev['RP 획득'] * prev['표본수']) / diffSample,
                                '승률': (curr['승률'] * curr['표본수'] - prev['승률'] * prev['표본수']) / diffSample,
                                'TOP 3': (curr['TOP 3'] * curr['표본수'] - prev['TOP 3'] * prev['표본수']) / diffSample,
                                '평균 순위': (curr['평균 순위'] * curr['표본수'] - prev['평균 순위'] * prev['표본수']) / diffSample
                            });
                        }
                        dataToUse = delta;
                    }
                }

                const averageScore = calculateAverageScore(dataToUse);
                const stddev = calculateStandardDeviation(dataToUse, averageScore);
                const scoredData = calculateTiers(dataToUse, averageScore, stddev, tierConfigGlobal);
                displayTierTable(scoredData);
                setupTablePopup();
            })
            .catch(err => console.error('불러오기 실패:', err));
    }

    // RP 점수 계산: script_common.js 의 getRPScore 사용
    function calculateAverageScore(data) {
        const totalSample = data.reduce((sum, i) => sum + i['표본수'], 0);
        let sumRP = 0, sumWin = 0, sumTop3 = 0;
        data.forEach(i => {
            const w = i['표본수'] / totalSample;
            sumRP += i['RP 획득'] * w;
            sumWin += i['승률'] * w;
            sumTop3 += i['TOP 3'] * w;
        });
        return getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
    }

    function calculateStandardDeviation(data, avg) {
        const totalSample = data.reduce((sum, i) => sum + i['표본수'], 0);
        return Math.sqrt(data.reduce((sum, i) => {
            const score = getRPScore(i['RP 획득']) + i['승률'] * 9 + i['TOP 3'] * 3;
            return sum + Math.pow(score - avg, 2) * (i['표본수'] / totalSample);
        }, 0));
    }

    function calculateTiers(data, averageScore, stddev, config) {
        const totalSample = data.reduce((sum, i) => sum + i['표본수'], 0);
        const averagePickRate = data.length > 0
            ? data.reduce((sum, i) => sum + i['표본수'] / totalSample, 0) / data.length
            : 0;
        const k = 1.5;
        return data.map(item => {
            const pickRate = item['표본수'] / totalSample;
            const r = pickRate / averagePickRate;
            const origin = r <= 1/3
                ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)))
                : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k)));
            const mean = 1 - origin;
            let factor = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            if (r > 5) factor += 0.05 * (1 - Math.min((r - 5) / 5, 1));
            const rpScore = getRPScore(item['RP 획득']);
            let score = rpScore + item['승률'] * 9 + item['TOP 3'] * 3;
            if (item['표본수'] < totalSample * averagePickRate) {
                score = score * (origin + mean * Math.min(1, pickRate / averagePickRate))
                      + averageScore * mean * (1 - Math.min(1, pickRate / averagePickRate));
                score *= factor;
            } else {
                score *= factor;
            }
            const tier = calculateTier(score, averageScore, stddev, config);
            return { ...item, '점수': score, '티어': tier };
        });
    }

    function displayTierTable(data) {
        const tiers = ['S+','S','A','B','C','D','F'];
        const groups = {};
        tiers.forEach(t => groups[t] = []);
        data.forEach(d => groups[d.티어].push(d));
        const table = document.getElementById('tier-table');
        let html = '';
        const totalSample = data.reduce((sum, i) => sum + i['표본수'], 0);
        const perRow = 15;
        tiers.forEach((tier, idx) => {
            html += `<tr class="tier-row tier-${tier}"><th>${tier}</th><td><div>`;
            const entries = groups[tier].sort((a, b) => b.점수 - a.점수);
            if (entries.length === 0) {
                html += `<span class="tooltip-container"><img src="image/placeholder.png" style="opacity:0;" alt="빈 슬롯"></span>`;
            } else {
                entries.forEach((e,i) => {
                    const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
                    html += `<span class="tooltip-container"><img src="image/${imgName}.png" alt="${e.실험체}">` +
                            `<div class="tooltip-box">${e.실험체}<br>픽률: ${(e['표본수']/totalSample*100).toFixed(2)}%<br>` +
                            `RP: ${e['RP 획득'].toFixed(1)}<br>승률: ${(e['승률']*100).toFixed(1)}%</div></span>`;
                    if ((i+1)%perRow===0 && i!==entries.length-1) html += '</div><div>';
                });
            }
            html += '</div></td></tr>';
        });
        table.innerHTML = html;
    }

    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const img = document.getElementById('popup-image');
        document.getElementById('popup-table-button').addEventListener('click', () => {
            html2canvas(document.querySelector('.tier-table')).then(canvas => {
                popup.style.display = 'block';
                img.src = canvas.toDataURL();
            });
        });
        document.querySelector('.image-popup-close').addEventListener('click', () => popup.style.display = 'none');
        window.addEventListener('click', e => { if (e.target === popup) popup.style.display='none'; });
    }

    // 이름 -> 이미지 파일명 변환
    function convertExperimentNameToImageName(name) {
        // 기존 로직 유지
        if (name === "글러브 리 다이린") return "리다이린-글러브";
        if (name === "쌍절곤 리 다이린") return "리다이린-쌍절곤";
        if (name.startsWith("리 다이린 ")) {
            const parts = name.substring(7).split(" ");
            return `리다이린-${parts.join("-")}`;
        }
        if (name.startsWith("돌격 소총 ")) {
            const parts = name.substring(6).split(" ");
            return `${parts.join("-")}-돌격소총`;
        }
        if (name.includes(" ")) {
            const p = name.split(" ");
            if (p.length >= 2) return `${p[1]}-${p[0]}`;
        }
        return name;
    }
});
