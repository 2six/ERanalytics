// script_tier_table.js (공통 모듈 사용 + 점수/티어 로직 공통화)
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    let tierConfig = null;

    // 1) 공통 모듈 로드
    Promise.all([
        fetch('config.ini').then(res => res.text()),
        fetch('versions.json').then(res => res.json())
    ]).then(([iniString, versionList]) => {
        const config = parseINI(iniString);
        tierConfig = config.tiers;

        // 2) 드롭다운 초기화 (공통)
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);
        // tier_table html 에서 첫 옵션 텍스트만 유지
        periodSelect.options[0].text = '전체';

        // 3) 이벤트 바인딩
        versionSelect.addEventListener('change', loadAndRender);
        tierSelect.addEventListener('change', loadAndRender);
        periodSelect.addEventListener('change', loadAndRender);

        // 초기 호출
        loadAndRender();
    });

    // 데이터 로드 및 렌더링
    function loadAndRender() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json['통계'];
                const entries = extractPeriodEntries(history, period);

                // 4) 공통 점수/티어 계산
                const avgScore = calculateAverageScore(entries);
                const stddev = calculateStandardDeviation(entries, avgScore);
                const scored = calculateTiers(entries, avgScore, stddev, tierConfig);

                // 5) 테이블 렌더링
                renderTierTable(scored);
            })
            .catch(console.error);
    }

    // 기간별 엔트리 추출 (기존 로직)
    function extractPeriodEntries(history, period) {
        const keys = Object.keys(history).sort();
        const latest = history[keys[keys.length - 1]];
        if (period === 'latest' || period === '전체') return latest;

        const days = period === '3day' ? 3 : 7;
        const latestDate = new Date(keys[keys.length - 1].replace(/_/g, ':').replace(/-/g, '/'));
        const cutoff = new Date(latestDate);
        cutoff.setDate(cutoff.getDate() - days);

        const pastKey = keys.slice().reverse().find(k => new Date(k.replace(/_/g, ':').replace(/-/g, '/')) <= cutoff);
        if (!pastKey) return latest;

        const prev = history[pastKey];
        const currMap = Object.fromEntries(latest.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(prev.map(d => [d.실험체, d]));
        const delta = [];

        for (const name in currMap) {
            const c = currMap[name], p = prevMap[name];
            if (!p) continue;
            const diff = c['표본수'] - p['표본수'];
            if (diff <= 0) continue;
            delta.push({
                실험체: name,
                표본수: diff,
                'RP 획득': (c['RP 획득'] * c['표본수'] - p['RP 획득'] * p['표본수']) / diff,
                승률: (c['승률'] * c['표본수'] - p['승률'] * p['표본수']) / diff,
                'TOP 3': (c['TOP 3'] * c['표본수'] - p['TOP 3'] * p['표본수']) / diff,
                '평균 순위': (c['평균 순위'] * c['표본수'] - p['평균 순위'] * p['표본수']) / diff
            });
        }
        return delta;
    }

    // 티어 테이블 렌더링 (기존 로직 유지)
    function renderTierTable(data) {
        const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
        const groups = tiers.reduce((obj, t) => (obj[t] = [], obj), {});
        data.forEach(d => groups[d.티어].push(d));

        const table = document.getElementById('tier-table');
        const total = data.reduce((sum, i) => sum + i['표본수'], 0);
        const perRow = 15;
        let html = '';

        tiers.forEach((t, idx) => {
            html += `<tr class="tier-row tier-${t}"><th>${t}</th><td><div>`;
            const entries = groups[t].sort((a,b) => b.점수 - a.점수);

            if (entries.length === 0) {
                html += `<span class="tooltip-container"><img src="image/placeholder.png" alt="빈" style="opacity:0"></span>`;
            } else {
                entries.forEach((e,i) => {
                    const img = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
                    html += `<span class="tooltip-container"><img src="image/${img}.png" alt="${e.실험체}">` +
                            `<div class="tooltip-box">${e.실험체}<br>` +
                            `픽률: ${(e['표본수']/total*100).toFixed(2)}%<br>` +
                            `RP: ${e['RP 획득'].toFixed(1)}<br>` +
                            `승률: ${(e['승률']*100).toFixed(1)}%</div></span>`;
                    if (((i+1)%perRow)===0 && i!==entries.length-1) html += '</div><div>';
                });
            }

            html += '</div></td></tr>';
        });
        table.innerHTML = html;
    }

    // 이미지 팝업 (기존 함수 그대로)
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
});