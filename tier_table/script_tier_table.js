// script_tier_table.js (공통 모듈 사용 + 페이지 특화 헬퍼 포함)
document.addEventListener('DOMContentLoaded', function() {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
  
    // 1) URL‑param 읽어서 초기값 세팅
    const params = new URLSearchParams(window.location.search);
    function applyParams() {
      if (params.get('version')) versionSelect.value = params.get('version');
      if (params.get('tier'))    tierSelect.value    = params.get('tier');
      if (params.get('period'))  periodSelect.value  = params.get('period');
    }
  
    // 2) URL 갱신
    function updateURL() {
      const p = new URLSearchParams();
      p.set('version', versionSelect.value);
      p.set('tier',    tierSelect.value);
      p.set('period',  periodSelect.value);
      history.replaceState(null, '', `${location.pathname}?${p}`);
    }
  
    // 3) init: config 읽고 드롭다운 채우고, 파라미터 반영 → URL 갱신 → 로드
    Promise.all([
      fetch('/config.ini').then(r => r.text()),
      fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
      const tierConfig = parseINI(iniText).tiers;
      populateVersionDropdown(versionSelect, versionList);
      populateTierDropdown(tierSelect);
      populatePeriodDropdown(periodSelect);
  
      applyParams();
      updateURL();
      loadAndRender();
  
      [versionSelect, tierSelect, periodSelect].forEach(el =>
        el.addEventListener('change', () => {
          updateURL();
          loadAndRender();
        })
      );
    });

    // 데이터 로드 및 렌더링
    function loadAndRender() {
        const version = versionSelect.value;
        const tier    = tierSelect.value;
        const period  = periodSelect.value;

        fetch(`/data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json['통계'];
                const entries = extractPeriodEntries(history, period);

                const avgScore = calculateAverageScore(entries);
                const stddev = calculateStandardDeviation(entries, avgScore);
                const scored = calculateTiers(entries, avgScore, stddev, tierConfig);

                renderTierTable(scored);
            })
            .catch(err => console.error('데이터 로드 실패:', err));
    }

    // 기간별 데이터 추출
    function extractPeriodEntries(history, period) {
        const keys = Object.keys(history).sort();
        const latest = history[keys[keys.length - 1]];
        if (period === 'latest') return latest;

        const days = period === '3day' ? 3 : 7;
        const latestDate = new Date(keys[keys.length - 1].replace(/_/g, ':').replace(/-/g, '/'));
        const cutoff = new Date(latestDate);
        cutoff.setDate(cutoff.getDate() - days);

        const pastKey = keys.slice().reverse().find(k => {
            const d = new Date(k.replace(/_/g, ':').replace(/-/g, '/'));
            return d <= cutoff;
        });
        if (!pastKey) return latest;

        const prev = history[pastKey];
        const currMap = Object.fromEntries(latest.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(prev.map(d => [d.실험체, d]));
        const delta = [];

        for (const name in currMap) {
            const c = currMap[name];
            const p = prevMap[name];
            if (!p) continue;
            const diff = c['표본수'] - p['표본수'];
            if (diff <= 0) continue;
            delta.push({
                '실험체': name,
                '표본수': diff,
                'RP 획득': (c['RP 획득'] * c['표본수'] - p['RP 획득'] * p['표본수']) / diff,
                '승률': (c['승률'] * c['표본수'] - p['승률'] * p['표본수']) / diff,
                'TOP 3': (c['TOP 3'] * c['표본수'] - p['TOP 3'] * p['표본수']) / diff,
                '평균 순위': (c['평균 순위'] * c['표본수'] - p['평균 순위'] * p['표본수']) / diff
            });
        }
        return delta;
    }

    // 티어별 테이블 렌더링
    function renderTierTable(data) {
        const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
        const groups = tiers.reduce((obj, t) => (obj[t] = [], obj), {});
        data.forEach(item => groups[item.티어].push(item));

        const table = document.getElementById('tier-table');
        const totalSample = data.reduce((sum, i) => sum + i['표본수'], 0);
        const perRow = 15;
        let html = '';

        tiers.forEach(tier => {
            html += `<tr class="tier-row tier-${tier}"><th>${tier}</th><td><div>`;
            const entries = groups[tier].sort((a, b) => b.점수 - a.점수);

            if (entries.length === 0) {
                html += `<span class="tooltip-container"><img src="image/placeholder.png" alt="빈 슬롯" style="opacity:0"></span>`;
            } else {
                entries.forEach((e, i) => {
                    const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g, '_');
                    const tooltip = `<div class="tooltip-box">${e.실험체}<br>` +
                                    `픽률: ${(e['표본수'] / totalSample * 100).toFixed(2)}%<br>` +
                                    `RP: ${e['RP 획득'].toFixed(1)}<br>` +
                                    `승률: ${(e['승률'] * 100).toFixed(1)}%</div>`;
                    html += `<span class="tooltip-container"><img src="/image/${imgName}.png" alt="${e.실험체}">${tooltip}</span>`;
                    if ((i + 1) % perRow === 0 && i !== entries.length - 1) html += '</div><div>';
                });
            }

            html += '</div></td></tr>';
        });
        table.innerHTML = html;
    }

    // 팝업 표시
    function showPopup() {
        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        html2canvas(document.querySelector('.tier-table')).then(canvas => {
            popup.style.display = 'block';
            popupImage.src = canvas.toDataURL();
        });
    }
    document.querySelector('.image-popup-close').addEventListener('click', () => {
        document.getElementById('image-popup').style.display = 'none';
    });

    // 페이지 특화 헬퍼: 실험체 이름 → 이미지 파일명 변환
    function convertExperimentNameToImageName(name) {
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
            const parts = name.split(" ");
            if (parts.length >= 2) return `${parts[1]}-${parts[0]}`;
        }
        return name;
    }
});
