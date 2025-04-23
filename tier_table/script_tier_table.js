// script_tier_table.js
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const table         = document.getElementById('tier-table');
    const container     = document.getElementById('tier-table-container');

    // URL 파라미터 헬퍼
    const params = new URLSearchParams(window.location.search);
    function getParam(key, def) {
      return params.has(key) ? params.get(key) : def;
    }
    function setParam(key, val) {
      params.set(key, val);
      history.replaceState(null, '', '?' + params.toString());
    }

    let tierConfigGlobal = null;

    // 1) 설정 로드 & 드롭다운 초기화
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const config = parseINI(iniString);
        tierConfigGlobal = config.tiers;

        initDropdowns(versionList);
        loadAndRender();
    }).catch(err => console.error('설정 로드 실패:', err));

    // 2) 드롭다운 초기화
    function initDropdowns(versionList) {
        // 버전
        versionSelect.innerHTML = '';
        versionList.sort().reverse().forEach(v => {
            versionSelect.insertAdjacentHTML(
              'beforeend',
              `<option value="${v}">${v}</option>`
            );
        });
        // 티어
        const tierMap = {
            platinum_plus: "플래티넘+",
            diamond_plus:  "다이아몬드+",
            meteorite_plus:"메테오라이트+",
            mithril_plus:  "미스릴+",
            in1000:        "in1000"
        };
        tierSelect.innerHTML = '';
        Object.entries(tierMap).forEach(([key,name]) => {
            tierSelect.insertAdjacentHTML(
              'beforeend',
              `<option value="${key}">${name}</option>`
            );
        });
        // 구간
        periodSelect.innerHTML = `
          <option value="latest">전체</option>
          <option value="3day">최근 3일</option>
          <option value="7day">최근 7일</option>
        `;

        // URL → 드롭다운 값 복원
        versionSelect.value = getParam('version', versionList[0]);
        tierSelect.value    = getParam('tier',    'diamond_plus');
        periodSelect.value  = getParam('period',  'latest');

        // 변경 시 URL 갱신 + 재렌더
        versionSelect.addEventListener('change', () => {
            setParam('version', versionSelect.value);
            loadAndRender();
        });
        tierSelect.addEventListener('change', () => {
            setParam('tier', tierSelect.value);
            loadAndRender();
        });
        periodSelect.addEventListener('change', () => {
            setParam('period', periodSelect.value);
            loadAndRender();
        });
    }

    // 3) 데이터 로드 & 렌더
    function loadAndRender() {
        const version = versionSelect.value;
        const tier    = tierSelect.value;
        const period  = periodSelect.value;

        fetch(`/data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json['통계'];
                // --- 수정: 로컬 extractPeriodEntries 함수 호출 ---
                const entries = extractPeriodEntries(history, period);
                // ---------------------------------------------
                const avgScore = calculateAverageScore(entries);
                const stddev   = calculateStandardDeviation(entries, avgScore);
                const scored   = calculateTiers(entries, avgScore, stddev, tierConfigGlobal);
                displayTierTable(scored);
                setupTablePopup();
            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                table.innerHTML = '<tr><td colspan="15">데이터를 불러오는 데 실패했습니다.</td></tr>';
            });
    }

    // --- 추가: 티어 테이블 페이지 전용 extractPeriodEntries 함수 ---
    // 4) 기간별 데이터 추출 (티어 테이블 페이지 전용 - 변화량 계산 포함)
    function extractPeriodEntries(history, period) {
        const keys = Object.keys(history).sort();
        if (keys.length === 0) return []; // Add check for empty history

        const latestKey = keys[keys.length - 1];
        const latestData = history[latestKey];
        if (period === 'latest') return latestData;

        const days = period === '3day' ? 3 : 7;
        // Use robust date parsing similar to common.js
        let latestDate = new Date(latestKey.replace('_', 'T'));
        if (isNaN(latestDate.getTime())) {
             const parts = latestKey.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
             if (parts) {
                  latestDate = new Date(Date.UTC(parts[1], parts[2]-1, parts[3], parts[4], parts[5]));
             } else {
                  console.error("Unsupported date format in tier_table:", latestKey);
                  return latestData; // Fallback to latest if date format is bad
             }
        }
        latestDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC

        const cutoff = new Date(latestDate.getTime());
        cutoff.setUTCDate(cutoff.getUTCDate() - days);

        // Find the latest key *before or on* the cutoff date
        const pastKey = keys.slice().reverse().find(k => {
            let kDate;
            const kParts = k.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
             if (kParts) {
                  kDate = new Date(Date.UTC(kParts[1], kParts[2]-1, kParts[3], kParts[4], kParts[5]));
             } else {
                  kDate = new Date(k.replace('_', 'T'));
             }
            if (isNaN(kDate.getTime())) return false;

            kDate.setUTCHours(0,0,0,0); // Normalize to start of day UTC
            return kDate <= cutoff;
        });

        if (!pastKey) {
            console.warn(`No data found before cutoff date ${cutoff.toISOString()} for period '${period}' in tier_table. Returning latest data.`);
            return latestData; // Return latest data if no past data found
        }

        const prevData = history[pastKey];
        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(prevData.map(d => [d.실험체, d]));
        const delta = [];

        // Iterate through characters present in the latest data
        for (const name in currMap) {
            const c = currMap[name];
            const p = prevMap[name];

            // Only calculate delta for characters present in both periods
            if (!p) continue;

            const diff = (c['표본수'] || 0) - (p['표본수'] || 0); // Handle potential null/undefined sample size
            // Only include entries with increased sample size in the delta calculation
            if (diff <= 0) continue;

            // Calculate weighted average of stats for the *new* sample (diff)
            // (Total stat sum in current data - Total stat sum in previous data) / difference in sample size
            const rpDiff = ((c['RP 획득'] || 0) * (c['표본수'] || 0)) - ((p['RP 획득'] || 0) * (p['표본수'] || 0));
            const winDiff = ((c['승률'] || 0) * (c['표본수'] || 0)) - ((p['승률'] || 0) * (p['표본수'] || 0));
            const top3Diff = ((c['TOP 3'] || 0) * (c['표본수'] || 0)) - ((p['TOP 3'] || 0) * (p['표본수'] || 0));
            const rankDiff = ((c['평균 순위'] || 0) * (c['표본수'] || 0)) - ((p['평균 순위'] || 0) * (p['표본수'] || 0));


            delta.push({
                '실험체': name,
                '표본수': diff, // Sample size is the *difference*
                'RP 획득': rpDiff / diff,
                '승률':    winDiff / diff,
                'TOP 3':   top3Diff / diff,
                '평균 순위': rankDiff / diff // Average rank for the new sample
                // Note: '점수' and '티어' will be calculated later by calculateTiers based on these delta stats
            });
        }
        return delta;
    }
    // -----------------------------------------------------------------


    // 5) 티어별 테이블 렌더링 (+우측 상단 버전·티어 표시)
    function displayTierTable(data) {
        const tierLabels = {
          platinum_plus:  "플래티넘+",
          diamond_plus:   "다이아몬드+",
          meteorite_plus: "메테오라이트+",
          mithril_plus:  "미스릴+",
          in1000:         "in1000"
        };
      
        const versionLabel = versionSelect.value;
        const tierLabel    = tierLabels[tierSelect.value];
      
        const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
        const groups = tiers.reduce((o, t) => (o[t] = [], o), {});
        // --- 수정: data[item.티어] 대신 groups[item.티어] 사용 ---
        data.forEach(item => {
            if (groups[item.티어]) { // Check if tier exists in groups
                 groups[item.티어].push(item);
            } else {
                 console.warn(`Unknown tier '${item.티어}' for character '${item.실험체}'. Skipping.`);
            }
        });
        // ----------------------------------------------------
      
        const totalSample = data.reduce((sum, i) => sum + (i['표본수'] || 0), 0); // Handle potential null/undefined sample size
        const perRow      = 15;
        let html = '';
      
        tiers.forEach(tier => {
          // 시작 태그: <tr><th>...
          html += `<tr class="tier-row tier-${tier}"><th>${tier}</th>`;
      
          // <td> 시작(첫 행이면 position:relative)
          if (tier === 'S+') {
            html += `<td style="position: relative;"><div class="tier-info" style="
                         position: absolute;
                         top: 4px;
                         right: 4px;
                         padding: 2px 6px;
                         background: rgba(255,255,255,0.8);
                         border-radius: 4px;
                         font-size: 0.85em;
                         font-weight: bold;
                      ">${versionLabel} | ${tierLabel}</div><div>`;
          } else {
            html += `<td><div>`;
          }
      
          // 슬롯들 렌더링
          // --- 수정: sortData 함수 사용 ---
          // 기존: entries.sort((a, b) => b.점수 - a.점수);
          // common.js의 sortData 함수를 사용하여 '점수' 기준으로 내림차순 정렬
          const entries = sortData(groups[tier], '점수', false, 'value'); // mode='value'는 단일 모드 정렬
          // -----------------------------

          if (entries.length === 0) {
            html += `<span class="tooltip-container">
                       <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0">
                     </span>`;
          } else {
            entries.forEach((e, i) => {
              const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
              const tooltip = `<div class="tooltip-box">
                                 ${e.실험체}<br>
                                 픽률: ${(e['표본수']/totalSample*100).toFixed(2)}%<br>
                                 RP: ${e['RP 획득'].toFixed(1)}<br>
                                 승률: ${(e['승률']*100).toFixed(1)}%
                               </div>`;
              html += `<span class="tooltip-container">
                         <img src="/image/${imgName}.png" alt="${e.실험체}">
                         ${tooltip}
                       </span>`;
              if ((i+1)%perRow===0 && i!==entries.length-1) html += '</div><div>';
            });
          }
      
          // 닫기 태그
          html += `</div></td></tr>`;
        });
      
        table.innerHTML = html;
    }      

    // 6) 팝업 초기화
    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImg = document.getElementById('popup-image');
        document.getElementById('popup-table-button')
          .onclick = () => {
            // --- 수정: html2canvas 대상 클래스 변경 ---
            // 기존: document.querySelector('.tier-table')
            // 변경: document.getElementById('tier-table-container') 또는 특정 영역
            // tier-table-container는 section 태그이므로, table 자체를 캡처하는 것이 더 정확할 수 있습니다.
            // 여기서는 id로 직접 선택하도록 유지합니다.
            html2canvas(document.getElementById('tier-table')) // Use getElementById for clarity
              .then(canvas => {
                popup.style.display = 'block';
                popupImg.src = canvas.toDataURL();
              });
          };
        document.querySelector('.image-popup-close')
          .onclick = () => { popup.style.display = 'none'; };
    }

    // 7) 페이지 특화 헬퍼: 이름→이미지 변환
    function convertExperimentNameToImageName(name) {
        if (name==="글러브 리 다이린") return "리다이린-글러브";
        if (name==="쌍절곤 리 다이린") return "리다이린-쌍절곤";
        if (name.startsWith("리 다이린 ")) {
            const parts = name.slice(7).split(" ");
            return `리다이린-${parts.join("-")}`;
        }
        if (name.startsWith("돌격 소총 ")) {
            const parts = name.slice(6).split(" ");
            return `${parts.join("-")}-돌격소총`;
        }
        if (name.includes(" ")) {
            const parts = name.split(" ");
            if (parts.length>=2) return `${parts[1]}-${parts[0]}`;
        }
        return name;
    }
});