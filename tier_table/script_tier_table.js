// script_tier_table.js
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const table         = document.getElementById('tier-table');
    const container     = document.getElementById('tier-table-container');

    // --- 수정: 비교 모드 관련 DOM 요소 ---
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare = document.getElementById('version-select-compare');
    const tierSelectCompare = document.getElementById('tier-select-compare');
    const periodSelectCompare = document.getElementById('period-select-compare');
    const compareModeLabel = document.getElementById('compare-mode-label');
    const compareCheckbox = document.getElementById('compare-checkbox'); // 비교 모드 체크박스 ID 변경
    // ------------------------------------


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

    // --- 수정: 비교 모드 상태 변수 (초기 로드 시 URL 파라미터로 설정) ---
    let isCompareMode = params.get('compare') === '1';
    // ---------------------------------

    // --- 수정: 현재 모드에 따라 body 클래스 추가/제거 (initDropdowns에서 처리) ---
    // 초기 body 클래스 설정은 initDropdowns 내부로 이동
    // -------------------------------------------------


    // 1) 설정 로드 & 드롭다운 초기화
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const config = parseINI(iniString);
        tierConfigGlobal = config.tiers;

        // --- 수정: initDropdowns에 versionList 전달 ---
        initDropdowns(versionList);
        // ------------------------------------------
        loadAndRender();
    }).catch(err => console.error('설정 로드 실패:', err));

    // 2) 드롭다운 초기화
    // --- 수정: versionList 인자 추가 ---
    function initDropdowns(versionList) {
        // 현재 비교 모드 상태에 따라 body 클래스 업데이트
        if (isCompareMode) {
            document.body.classList.add('is-compare-mode');
        } else {
            document.body.classList.remove('is-compare-mode');
        }


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

        // --- 수정: 비교 드롭다운 및 UI 초기화 ---
        // 비교 모드 체크박스 초기 상태 설정
        compareCheckbox.checked = isCompareMode;

        if (isCompareMode) {
             // 비교 드롭다운도 채우기
             versionSelectCompare.innerHTML = ''; // Clear before populating
             versionList.sort().reverse().forEach(v => {
                 versionSelectCompare.insertAdjacentHTML(
                   'beforeend',
                   `<option value="${v}">${v}</option>`
                 );
             });
             tierSelectCompare.innerHTML = ''; // Clear before populating
             Object.entries(tierMap).forEach(([key,name]) => {
                 tierSelectCompare.insertAdjacentHTML(
                   'beforeend',
                   `<option value="${key}">${name}</option>`
                 );
             });
             periodSelectCompare.innerHTML = `
               <option value="latest">전체</option>
               <option value="3day">최근 3일</option>
               <option value="7day">최근 7일</option>
             `;

             // 비교 모드 UI 표시
             comparisonControlsDiv.style.display = 'table-row'; // tr에 적용되므로 table-row
             compareModeLabel.style.display = 'inline';

             // 색상 강조 체크박스 관련 로직 제거

        } else {
             // 단일 모드 UI 숨김
             comparisonControlsDiv.style.display = 'none';
             compareModeLabel.style.display = 'none';

             // 색상 강조 체크박스 관련 로직 제거
        }
        // ------------------------------------


        // URL → 드롭다운 값 복원
        versionSelect.value = getParam('version', versionList[0]);
        tierSelect.value    = getParam('tier',    'diamond_plus');
        periodSelect.value  = getParam('period',  'latest');

        // --- 추가: 비교 드롭다운 URL 값 복원 ---
        if (isCompareMode) {
             versionSelectCompare.value = getParam('version2', versionList[0]);
             tierSelectCompare.value    = getParam('tier2',    'diamond_plus');
             periodSelectCompare.value  = getParam('period2',  'latest');
        }
        // ------------------------------------


        // 변경 시 URL 갱신 + 재렌더
        versionSelect.addEventListener('change', () => {
            // --- 수정: 비교 모드 여부에 따라 비교 파라미터 삭제 ---
            if (!compareCheckbox.checked) { // 체크박스가 꺼져있으면 (단일 모드 상태로 변경됐으면)
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            // ------------------------------------
            setParam('version', versionSelect.value);
            loadAndRender();
        });
        tierSelect.addEventListener('change', () => {
            // --- 수정: 비교 모드 여부에 따라 비교 파라미터 삭제 ---
            if (!compareCheckbox.checked) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            // ------------------------------------
            setParam('tier', tierSelect.value);
            loadAndRender();
        });
        periodSelect.addEventListener('change', () => {
            // --- 수정: 비교 모드 여부에 따라 비교 파라미터 삭제 ---
            if (!compareCheckbox.checked) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            // ------------------------------------
            setParam('period', periodSelect.value);
            loadAndRender();
        });

        // --- 추가: 비교 드롭다운 변경 이벤트 리스너 ---
        if (isCompareMode) {
             versionSelectCompare.addEventListener('change', () => {
                 setParam('version2', versionSelectCompare.value);
                 loadAndRender();
             });
             tierSelectCompare.addEventListener('change', () => {
                 setParam('tier2', tierSelectCompare.value);
                 loadAndRender();
             });
             periodSelectCompare.addEventListener('change', () => {
                 setParam('period2', periodSelectCompare.value);
                 loadAndRender();
             });
        }
        // ----------------------------------------------------

        // --- 추가: 비교 모드 체크박스 이벤트 리스너 ---
        compareCheckbox.addEventListener('change', () => {
             isCompareMode = compareCheckbox.checked; // 상태 업데이트
             setParam('compare', isCompareMode ? '1' : '0'); // URL 업데이트

             // 비교 모드가 꺼지면 비교 관련 파라미터 삭제
             if (!isCompareMode) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
             }
             history.replaceState(null, '', '?' + params.toString()); // URL 바로 반영

             // UI 다시 초기화 및 데이터 재로드
             initDropdowns(versionList); // 비교 드롭다운 표시/숨김, body 클래스 등 업데이트
             loadAndRender(); // 데이터 재로드
        });
        // ---------------------------------------------
    }

    // 3) 데이터 로드 & 렌더
    function loadAndRender() {
        // --- 수정: 비교 모드 로직 추가 ---
        // isCompareMode 변수는 initDropdowns에서 업데이트된 최신 상태를 사용
        if (isCompareMode) {
            const version1 = versionSelect.value;
            const tier1 = tierSelect.value;
            const period1 = periodSelect.value;

            const version2 = versionSelectCompare.value;
            const tier2 = tierSelectCompare.value;
            const period2 = periodSelectCompare.value;

            if (version1 === version2 && tier1 === tier2 && period1 === period2) {
                 table.innerHTML = '<tr><td colspan="15">데이터 1과 데이터 2가 동일합니다.</td></tr>'; // colspan 조정 필요
                 return;
            }

            const url1 = `/data/${version1}/${tier1}.json`;
            const url2 = `/data/${version2}/${tier2}.json`;

            Promise.all([
                fetch(url1).then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url1}`);
                    return res.json();
                }).catch(err => { console.error(`Failed to fetch ${url1}:`, err); return null; }), // 에러 발생 시 null 반환
                fetch(url2).then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url2}`);
                    return res.json();
                }).catch(err => { console.error(`Failed to fetch ${url2}:`, err); return null; }) // 에러 발생 시 null 반환
            ])
            .then(([json1, json2]) => {
                if (!json1 && !json2) {
                     table.innerHTML = '<tr><td colspan="15">두 데이터 모두 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                     // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출하지 않음 ---
                     // setupTooltipPositioning(); // 데이터가 없으므로 호출하지 않음
                     // -------------------------------------------------
                     return;
                }

                // common.js의 extractPeriodEntries 사용 (기간별 스냅샷 추출)
                // 티어 테이블 비교 모드에서는 기간별 변화량이 아닌, 각 기간의 스냅샷 데이터가 필요함
                // json1 또는 json2가 null이면 history1 또는 history2는 빈 객체가 됩니다.
                const history1 = json1 ? json1['통계'] : {};
                const history2 = json2 ? json2['통계'] : {};

                const entries1 = commonExtractPeriodEntries(history1, period1); // common.js의 함수 사용
                const entries2 = commonExtractPeriodEntries(history2, period2); // common.js의 함수 사용

                // 데이터가 하나라도 없으면 비교 불가 (혹은 해당 기간 데이터가 없으면)
                // mergeDataForComparison 결과가 비어있는지로 판단합니다.
                // mergeDataForComparison는 한쪽에만 데이터가 있어도 결과를 반환하므로,
                // 최소한 한쪽 데이터는 있어야 테이블을 그릴 수 있습니다.

                // 각 데이터셋 별도로 가공 (점수, 티어, 픽률 계산)
                const avgScore1 = calculateAverageScore(entries1);
                const stddev1 = calculateStandardDeviation(entries1, avgScore1);
                const scored1 = calculateTiers(entries1, avgScore1, stddev1, tierConfigGlobal);

                const avgScore2 = calculateAverageScore(entries2);
                const stddev2 = calculateStandardDeviation(entries2, avgScore2);
                const scored2 = calculateTiers(entries2, avgScore2, stddev2, tierConfigGlobal);


                // 두 데이터셋 병합 및 차이 계산 (common.js 함수 사용)
                const comparisonData = mergeDataForComparison(scored1, scored2);

                // 병합 결과가 없으면 표시할 데이터가 없는 것임
                if (comparisonData.length === 0) {
                    table.innerHTML = '<tr><td colspan="15">선택한 조건에 해당하는 비교 데이터가 없습니다.</td></tr>'; // colspan 조정 필요
                    // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출하지 않음 ---
                    // setupTooltipPositioning(); // 데이터가 없으므로 호출하지 않음
                    // -------------------------------------------------
                    return;
                }


                // displayTierTable에 병합된 데이터와 비교 모드 플래그 전달
                displayTierTable(comparisonData, isCompareMode);
                setupTablePopup();
                // --- 추가: 툴팁 위치 설정 함수 호출 (데이터를 인자로 전달) ---
                setupTooltipPositioning(comparisonData, isCompareMode);
                // --------------------------------------------------

            })
            .catch(err => {
                console.error('비교 데이터 처리 실패:', err);
                table.innerHTML = `<tr><td colspan="15">데이터 처리 중 오류가 발생했습니다: ${err.message}</td></tr>`; // colspan 조정 필요
                // --- 수정: 에러 발생 시 툴팁 위치 설정 호출하지 않음 ---
                // setupTooltipPositioning(); // 에러 발생 시 호출하지 않음
                // -------------------------------------------------
            });

        } else {
            // --- 기존 단일 모드 로직 ---
            const version = versionSelect.value;
            const tier    = tierSelect.value;
            const period  = periodSelect.value;

            fetch(`/data/${version}/${tier}.json`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const history = json['통계'];
                    // 로컬 extractPeriodEntries 함수 호출 (기간별 변화량 계산)
                    const entries = extractPeriodEntries(history, period);

                    if (entries.length === 0) { // 데이터가 없으면
                         table.innerHTML = '<tr><td colspan="15">선택한 기간에 해당하는 데이터가 부족합니다.</td></tr>'; // colspan 조정 필요
                         // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출하지 않음 ---
                         // setupTooltipPositioning(); // 데이터가 없으므로 호출하지 않음
                         // -------------------------------------------------
                         return;
                    }

                    const avgScore = calculateAverageScore(entries);
                    const stddev   = calculateStandardDeviation(entries, avgScore);
                    const scored   = calculateTiers(entries, avgScore, stddev, tierConfigGlobal);

                    // displayTierTable에 단일 데이터와 비교 모드 플래그 전달
                    displayTierTable(scored, isCompareMode);
                    setupTablePopup();
                    // --- 추가: 툴팁 위치 설정 함수 호출 (데이터를 인자로 전달) ---
                    setupTooltipPositioning(scored, isCompareMode);
                    // --------------------------------------------------
                })
                .catch(err => {
                    console.error('데이터 로드 실패:', err);
                    table.innerHTML = '<tr><td colspan="15">데이터를 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                     // --- 수정: 에러 발생 시 툴팁 위치 설정 호출하지 않음 ---
                    // setupTooltipPositioning(); // 에러 발생 시 호출하지 않음
                    // -------------------------------------------------
                });
            // --------------------------
        }
        // ---------------------------------
    }
// -------------------------------------------------------------


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
            const rankDiff = ((c['평균 순위'] || 0) * (c['표본수'] || 0)) - ((p['평균 순위'] || 0) * (p['평균 순위'] || 0));


            delta.push({
                '실험체': name,
                '표본수': diff, // Sample size is the *difference*
                'RP 획득': rpDiff / diff,
                '승률':    winDiff / diff,
                'TOP 3':   top3Diff / diff,
                '평균 순위': rankDiff / diff
                // Note: '점수' and '티어' will be calculated later by calculateTiers based on these delta stats
            });
        }
        return delta;
    }
    // -----------------------------------------------------------------


    // 5) 티어별 테이블 렌더링 (기존 함수 유지하되 툴팁 생성 로직 제거)
    // --- 수정: isCompareMode 인자 추가 및 비교 모드 처리 로직 추가 ---
    function displayTierTable(data, isCompareMode) {
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

        // --- 수정: 데이터 그룹화 로직 (비교 모드 고려) ---
        data.forEach(item => {
            // 비교 모드일 때는 '티어 (Ver1)' 기준으로 그룹화 (데이터 1 기준 표)
            const itemTier = isCompareMode ? item['티어 (Ver1)'] : item.티어;
            // 단일 모드 또는 비교 모드에서 Ver1 티어가 유효한 경우에만 그룹에 추가
            // Ver1에 없는 캐릭터 (신규)는 티어 테이블에 표시되지 않음 (기존 동작 유지)
            if (itemTier && groups[itemTier]) {
                 groups[itemTier].push(item);
            }
        });
        // ----------------------------------------------------

        // --- 수정: totalSample 계산 (단일 모드에서만 사용) ---
        // 단일 모드: 현재 데이터의 표본수 합계
        // 비교 모드: 픽률은 개별 픽률 사용, 총 표본수는 필요 없음.
        const totalSample = isCompareMode
            ? 0 // 비교 모드에서는 총 표본수 합계 사용하지 않음
            : data.reduce((sum, i) => sum + (i['표본수'] || 0), 0);
        // ---------------------------------------------

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
                         white-space: nowrap;
                      ">${versionLabel} | ${tierLabel}</div><div>`; // white-space: nowrap 추가
          } else {
            html += `<td><div>`;
          }

          // 슬롯들 렌더링
          // --- 수정: sortData 함수 사용 (비교 모드 고려) ---
          // common.js의 sortData 함수를 사용하여 '점수' 기준으로 내림차순 정렬
          // 비교 모드일 때는 '점수 (Ver1)' 기준으로 정렬
          const sortKey = isCompareMode ? '점수 (Ver1)' : '점수';
          const sortMode = isCompareMode ? 'value1' : 'value'; // 비교 모드일 때는 value1 모드로 정렬
          const entries = sortData(groups[tier], sortKey, false, sortMode); // false: 내림차순 (좋은 것 위로)
          // -----------------------------

          if (entries.length === 0) {
            // 빈 슬롯 표시 (기존 이미지 사용)
            // 15개 모두 채워서 레이아웃 유지
             for (let i = 0; i < perRow; i++) {
                // --- 수정: placeholder 이미지에는 툴팁 관련 요소 생성 안함 (기존 유지) ---
                html += `<span class="tooltip-container">
                           <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0;">
                         </span>`;
                // ---------------------------------------------------------------------
             }

          } else {
            entries.forEach((e) => { // i 변수 사용되지 않아 제거
              const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
              // --- 수정: 툴팁 내용 조정 (기존 수정된 내용 유지) ---
              // 툴팁 내용을 문자열로 미리 만들어둡니다.
              let tooltipContent;
              if (isCompareMode) {
                   const pr1 = e['픽률 (Ver1)'] !== null && e['픽률 (Ver1)'] !== undefined ? (e['픽률 (Ver1)'] || 0).toFixed(2) + '%' : '-';
                   const pr2 = e['픽률 (Ver2)'] !== null && e['픽률 (Ver2)'] !== undefined ? (e['픽률 (Ver2)'] || 0).toFixed(2) + '%' : '-';
                   const rp1 = e['RP 획득 (Ver1)'] !== null && e['RP 획득 (Ver1)'] !== undefined ? (e['RP 획득 (Ver1)'] || 0).toFixed(1) : '-';
                   const rp2 = e['RP 획득 (Ver2)'] !== null && e['RP 획득 (Ver2)'] !== undefined ? (e['RP 획득 (Ver2)'] || 0).toFixed(1) : '-';
                   const win1 = e['승률 (Ver1)'] !== null && e['승률 (Ver1)'] !== undefined ? ((e['승률 (Ver1)'] || 0) * 100).toFixed(1) + '%' : '-';
                   const win2 = e['승률 (Ver2)'] !== null && e['승률 (Ver2)'] !== undefined ? ((e['승률 (Ver2)'] || 0) * 100).toFixed(1) + '%' : '-';
                   // --- 비교 모드 툴팁 내용 형식 (기존 수정된 내용 유지) ---
                   tooltipContent = `
                       ${e.실험체}<br>
                       픽률: ${pr1} → ${pr2}<br>
                       RP 획득: ${rp1} → ${rp2}<br>
                       승률: ${win1} → ${win2}
                   `;
                   // ----------------------------------------------------
              } else {
                   // --- 단일 모드 툴팁 내용 (기존 수정된 내용 유지) ---
                   tooltipContent = `
                       ${e.실험체}<br>
                       픽률: ${totalSample > 0 ? ((e['표본수'] || 0)/totalSample*100).toFixed(2) : (e['픽률'] || 0).toFixed(2)}%<br> <!-- 단일 모드 픽률 계산 방식 복원 -->
                       RP: ${(e['RP 획득'] || 0).toFixed(1)}<br>
                       승률: ${((e['승률'] || 0)*100).toFixed(1)}%
                   `;
                   // ---------------------------------------------
              }
              // --- 수정: 툴팁 박스 div 생성 코드 제거. 툴팁 내용은 data 속성에 저장 ---
              // const tooltip = `<div class="tooltip-box">${tooltipContent}</div>`; // 이 줄 제거
              // -------------------------------------------------------------------

              // --- 순위 변동 표시 요소 (기존 수정된 내용 유지) ---
              let rankChangeOverlayHtml = '';
              if (isCompareMode) { /* ... 순위 변동 로직 ... */
                   const rankChangeValue = e['순위 변화값'];
                   let rankChangeText = '';
                   let rankChangeClass = '';
                   if (typeof rankChangeValue === 'number') {
                        const absChange = Math.abs(rankChangeValue);
                        if (rankChangeValue < 0) { rankChangeText = `▼${absChange}`; rankChangeClass = 'rank-change-down'; } // 순위 숫자 감소 (좋아짐)
                        else if (rankChangeValue > 0) { rankChangeText = `▲${absChange}`; rankChangeClass = 'rank-change-up'; } // 순위 숫자 증가 (나빠짐)
                        else { rankChangeText = `=`; rankChangeClass = 'rank-change-same'; }
                   } else { rankChangeText = rankChangeValue || '-'; if (rankChangeValue === '신규 → ') rankChangeClass = 'rank-change-up'; else if (rankChangeValue === '→ 삭제') rankChangeClass = 'rank-change-down'; else rankChangeClass = 'rank-change-same'; }
                   if (rankChangeText !== '') { rankChangeOverlayHtml = `<div class="rank-change-overlay ${rankChangeClass}" data-text="${rankChangeText}">${rankChangeText}</div>`; }
              }
              // -------------------------------------------------

              // --- 수정: 툴팁 컨테이너에 data 속성 추가 (툴팁 내용 저장) ---
              // 툴팁 내용은 HTML 엔티티로 인코딩하여 저장
              const encodedTooltipContent = tooltipContent
                  .replace(/&/g, '&')
                  .replace(/</g, '<')
                  .replace(/>/g, '>')
                  .replace(/"/g, '"')
                  .replace(/'/g, '&#039;');

              html += `<span class="tooltip-container" data-tooltip="${encodedTooltipContent}">
                         <img src="/image/${imgName}.png" alt="${e.실험체}">
                         ${rankChangeOverlayHtml}
                       </span>`;
              // -----------------------------------------------------------
            });

            // perRow 개수 채우기 (기존 유지)
            const remainingSlots = perRow - (entries.length % perRow);
            if (remainingSlots > 0 && remainingSlots < perRow) {
                 for (let i = 0; i < remainingSlots; i++) {
                      // --- 수정: placeholder 이미지에는 툴팁 관련 요소 생성 안함 (기존 유지) ---
                      html += `<span class="tooltip-container">
                                 <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0;">
                               </span>`;
                      // ---------------------------------------------------------------------
                 }
            }
          }

          html += `</div></td></tr>`; // 유지
        });

        table.innerHTML = html; // 유지

        // --- 색상 강조 적용 로직 제거 (기존 유지) ---
    }

    // --- 추가: 툴팁 위치를 동적으로 계산하여 설정하는 함수 ---
    // 이 함수는 테이블이 렌더링된 후에 호출됩니다.
    function setupTooltipPositioning(allCharacterData, isCompareMode) {
        // 단 하나의 툴팁 요소를 관리합니다.
        let tooltipBox = document.getElementById('global-tooltip-box');
        if (!tooltipBox) {
            tooltipBox = document.createElement('div');
            tooltipBox.id = 'global-tooltip-box';
            tooltipBox.className = 'tooltip-box'; // 기존 CSS 스타일 재활용
            document.body.appendChild(tooltipBox);
        }

        const tooltipContainers = table.querySelectorAll('.tooltip-container[data-tooltip]'); // data-tooltip 속성이 있는 컨테이너만 선택 (placeholder 제외)

        tooltipContainers.forEach(container => {
            // 이벤트 리스너를 추가합니다.
            container.addEventListener('mouseover', () => {
                // 툴팁 내용 설정 (data 속성에서 가져옴)
                const tooltipContent = container.dataset.tooltip;
                tooltipBox.innerHTML = tooltipContent; // HTML 엔티티 디코딩은 브라우저가 자동으로 처리

                // 툴팁을 잠시 보이게 하여 정확한 크기 계산 가능하도록 함
                tooltipBox.style.visibility = 'visible';
                tooltipBox.style.opacity = '1';
                // position: fixed; z-index: 9999; 는 CSS에 정의되어 있습니다.

                const containerRect = container.getBoundingClientRect();
                const tooltipRect = tooltipBox.getBoundingClientRect(); // 툴팁의 현재 크기 및 뷰포트 위치 가져옴

                // 툴팁이 이미지 위에 나타나도록 위치 계산
                // 툴팁 하단이 컨테이너 상단에서 5px 위로 떨어지도록 계산
                const desiredTooltipTop = containerRect.top - tooltipRect.height - 5;
                // 툴팁 중앙이 컨테이너 중앙에 오도록 위치 계산
                const desiredTooltipLeft = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;

                // 계산된 위치를 툴팁 요소의 인라인 스타일로 적용 (position: fixed 기준)
                tooltipBox.style.top = `${desiredTooltipTop}px`;
                tooltipBox.style.left = `${desiredTooltipLeft}px`;

                // 기존 CSS에서 bottom, right, transform은 제거했으므로 여기서 설정하지 않아도 됩니다.
                // 만약 CSS에 남아있다면 여기서 'auto' 또는 'none'으로 설정하여 무시하도록 할 수 있습니다.
                tooltipBox.style.bottom = 'auto';
                tooltipBox.style.right = 'auto';
                tooltipBox.style.transform = 'none';

                // 툴팁이 뷰포트 좌우 경계를 벗어나지 않도록 조정 (선택 사항)
                const viewportWidth = window.innerWidth;
                // 좌측 경계 조정
                if (parseFloat(tooltipBox.style.left) < 5) {
                    tooltipBox.style.left = '5px';
                     tooltipBox.style.transform = 'none'; // 재계산 시 transform 해제
                }
                // 우측 경계 조정
                if (parseFloat(tooltipBox.style.left) + tooltipRect.width > viewportWidth - 5) {
                    tooltipBox.style.left = `${viewportWidth - tooltipRect.width - 5}px`;
                     tooltipBox.style.transform = 'none'; // 재계산 시 transform 해제
                }
                 // 상단 경계 조정 (툴팁이 뷰포트 맨 위에 붙는 경우 방지)
                 if (parseFloat(tooltipBox.style.top) < 5) {
                      tooltipBox.style.top = '5px';
                 }

            });

            container.addEventListener('mouseout', () => {
                // 툴팁 숨김
                tooltipBox.style.opacity = '0';
                // CSS transition 시간(0.3s) 후에 완전히 숨기도록 visibility를 변경합니다.
                tooltipBox.addEventListener('transitionend', function handler() {
                     if (tooltipBox.style.opacity === '0') {
                          tooltipBox.style.visibility = 'hidden';
                          // 이벤트 리스너 제거 (중복 호출 방지)
                          tooltipBox.removeEventListener('transitionend', handler);
                     }
                });

                 // 마우스 아웃 시 위치 스타일을 제거하여 다음 마우스 오버 시 정확히 다시 계산되도록 합니다.
                 tooltipBox.style.top = '';
                 tooltipBox.style.left = '';
                 tooltipBox.style.bottom = '';
                 tooltipBox.style.right = '';
                 tooltipBox.style.transform = ''; // transform: none 또는 translateX(-50%) 등으로 돌아감
            });
        });
    }
    // -----------------------------------------------------


    // 6) 팝업 초기화 (기존 함수 유지)
    function setupTablePopup() { /* ... 기존 함수 내용 유지 ... */
        const popup = document.getElementById('image-popup');
        const popupImg = document.getElementById('popup-image');
        const popupTableButton = document.getElementById('popup-table-button');
        if (popupTableButton) {
             popupTableButton.onclick = () => {
                html2canvas(document.getElementById('tier-table'), {
                     backgroundColor: null
                })
                  .then(canvas => {
                    popup.style.display = 'block';
                    popupImg.src = canvas.toDataURL();
                  });
              };
        } else {
             console.error("Popup table button not found.");
        }
        document.querySelector('.image-popup-close')
          .onclick = () => { popup.style.display = 'none'; };
    }

    // 7) 페이지 특화 헬퍼: 이름→이미지 변환 (기존 함수 유지)
    function convertExperimentNameToImageName(name) { /* ... 기존 함수 내용 유지 ... */
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

    // --- 추가: common.js의 extractPeriodEntries 함수를 로컬 변수로 저장 (기존 유지) ---
    const commonExtractPeriodEntries = window.extractPeriodEntries;
    // -------------------------------------------------------------------

// --- 수정: loadAndRender 함수 끝에 setupTooltipPositioning 호출 추가 ---
    function loadAndRender() {
        // --- 기존 loadAndRender 로직 유지 (데이터 로드 및 displayTierTable 호출) ---
        // ... (데이터 로드 및 displayTierTable 호출 로직) ...
        if (isCompareMode) {
             // ... 비교 모드 데이터 로드 및 처리 ...
             Promise.all([ /* ... */ ])
             .then(([json1, json2]) => {
                 // ... 데이터 가공 및 mergeDataForComparison 호출 ...
                 const comparisonData = mergeDataForComparison(/*...*/);
                 if (comparisonData.length > 0) {
                      displayTierTable(comparisonData, isCompareMode);
                      setupTablePopup();
                      // --- 추가: 툴팁 위치 설정 함수 호출 (데이터와 모드를 인자로 전달) ---
                      setupTooltipPositioning(comparisonData, isCompareMode); // 데이터와 모드를 인자로 전달
                      // --------------------------------------------------
                 } else { /* ... 데이터 없음 처리 ... */ table.innerHTML = '<tr><td colspan="15">선택한 조건에 해당하는 비교 데이터가 없습니다.</td></tr>'; }
             })
             .catch(err => {
                console.error('비교 데이터 처리 실패:', err);
                table.innerHTML = `<tr><td colspan="15">데이터 처리 중 오류가 발생했습니다: ${err.message}</td></tr>`;
             });
        } else {
            // --- 기존 단일 모드 로직 ---
            const version = versionSelect.value;
            const tier    = tierSelect.value;
            const period  = periodSelect.value;

            fetch(`/data/${version}/${tier}.json`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const history = json['통계'];
                    // 로컬 extractPeriodEntries 함수 호출 (기간별 변화량 계산)
                    const entries = extractPeriodEntries(history, period);

                    if (entries.length === 0 && period !== 'latest') {
                         table.innerHTML = '<tr><td colspan="15">선택한 기간에 해당하는 데이터가 부족합니다.</td></tr>'; // colspan 조정 필요
                         return;
                    } else if (entries.length === 0 && period === 'latest') {
                         table.innerHTML = '<tr><td colspan="15">데이터가 없습니다.</td></tr>'; // colspan 조정 필요
                         return;
                    }


                    const avgScore = calculateAverageScore(entries);
                    const stddev   = calculateStandardDeviation(entries, avgScore);
                    const scored   = calculateTiers(entries, avgScore, stddev, tierConfigGlobal);
                    // displayTierTable에 단일 데이터와 비교 모드 플래그 전달
                    displayTierTable(scored, isCompareMode);
                    setupTablePopup();
                })
                .catch(err => {
                    console.error('데이터 로드 실패:', err);
                    table.innerHTML = '<tr><td colspan="15">데이터를 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                });
            // --------------------------
        }
        // ---------------------------------------------------------------
    }
// -------------------------------------------------------------

}); // DOMContentLoaded 끝