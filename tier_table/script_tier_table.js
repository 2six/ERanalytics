// script_tier_table.js
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const table         = document.getElementById('tier-table');
    const container     = document.getElementById('tier-table-container');

    // --- 추가: 비교 모드 관련 DOM 요소 ---
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare = document.getElementById('version-select-compare');
    const tierSelectCompare = document.getElementById('tier-select-compare');
    const periodSelectCompare = document.getElementById('period-select-compare');
    const compareModeLabel = document.getElementById('compare-mode-label');
    const gradientCheckbox = document.getElementById('gradient-checkbox'); // 색상 강조 체크박스
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

    // --- 추가: 비교 모드 상태 변수 ---
    const isCompareMode = params.get('compare') === '1';
    // ---------------------------------

    // --- 추가: 현재 모드에 따라 body 클래스 추가/제거 ---
    if (isCompareMode) {
        document.body.classList.add('is-compare-mode');
    } else {
        document.body.classList.remove('is-compare-mode');
    }
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

        // --- 추가: 비교 드롭다운 초기화 ---
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

             // 비교 모드에서는 색상 강조 항상 켜짐 및 비활성화
             gradientCheckbox.checked = true;
             gradientCheckbox.disabled = true;
             gradientCheckbox.parentElement.style.opacity = '0.5';

        } else {
             // 단일 모드에서는 비활성화 해제 및 투명도 복원
             gradientCheckbox.disabled = false;
             gradientCheckbox.parentElement.style.opacity = '1';
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
            setParam('version', versionSelect.value);
            // --- 추가: 비교 모드 URL 파라미터 제거 ---
            if (!isCompareMode) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            // ------------------------------------
            loadAndRender();
        });
        tierSelect.addEventListener('change', () => {
            setParam('tier', tierSelect.value);
             // --- 추가: 비교 모드 URL 파라미터 제거 ---
            if (!isCompareMode) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            // ------------------------------------
            loadAndRender();
        });
        periodSelect.addEventListener('change', () => {
            setParam('period', periodSelect.value);
             // --- 추가: 비교 모드 URL 파라미터 제거 ---
            if (!isCompareMode) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            // ------------------------------------
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
             // 색상 강조 체크박스는 비교 모드에서 비활성화되므로 이벤트 리스너 불필요
        } else {
             // 단일 모드 색상 강조 체크박스 이벤트 리스너
             gradientCheckbox.addEventListener('change', () => {
                 // 단일 모드에서는 색상 강조 상태만 URL에 저장
                 setParam('gradient', gradientCheckbox.checked ? '1' : '0');
                 // 단일 모드 색상 적용 함수 호출 (필요하다면)
                 // 현재 displayTierTable에서 색상 적용 로직이 없으므로 불필요
                 // displayTierTable(lastData); // lastData 변수가 없으므로 직접 호출 불가
                 // 대신 loadAndRender를 다시 호출하여 전체 렌더링
                 loadAndRender(); // 색상 강조 상태 변경 시 재렌더링
             });
             // --- 추가: 단일 모드 색상 강조 URL 파라미터 복원 ---
             if (params.has('gradient')) {
                  gradientCheckbox.checked = params.get('gradient') === '1';
             } else {
                  // 단일 모드 기본값: 색상 강조 켜짐
                  gradientCheckbox.checked = true;
             }
             // -------------------------------------------------
        }
        // ----------------------------------------------------
    }

    // 3) 데이터 로드 & 렌더
    function loadAndRender() {
        // --- 수정: 비교 모드 로직 추가 ---
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
                     return;
                }

                const history1 = json1 ? json1['통계'] : {};
                const history2 = json2 ? json2['통계'] : {};

                // common.js의 extractPeriodEntries 사용 (기간별 스냅샷 추출)
                const entries1 = extractPeriodEntries(history1, period1);
                const entries2 = extractPeriodEntries(history2, period2);

                // 데이터가 하나라도 없으면 비교 불가
                if (entries1.length === 0 || entries2.length === 0) {
                     table.innerHTML = '<tr><td colspan="15">선택한 기간에 해당하는 데이터가 부족합니다.</td></tr>'; // colspan 조정 필요
                     return;
                }

                // 각 데이터셋 별도로 가공 (점수, 티어, 픽률 계산)
                const avgScore1 = calculateAverageScore(entries1);
                const stddev1 = calculateStandardDeviation(entries1, avgScore1);
                const scored1 = calculateTiers(entries1, avgScore1, stddev1, tierConfigGlobal);

                const avgScore2 = calculateAverageScore(entries2);
                const stddev2 = calculateStandardDeviation(entries2, avgScore2);
                const scored2 = calculateTiers(entries2, avgScore2, stddev2, tierConfigGlobal);

                // 두 데이터셋 병합 및 차이 계산 (common.js 함수 사용)
                const comparisonData = mergeDataForComparison(scored1, scored2);

                // displayTierTable에 병합된 데이터와 비교 모드 플래그 전달
                displayTierTable(comparisonData, isCompareMode);
                setupTablePopup();

            })
            .catch(err => {
                console.error('비교 데이터 처리 실패:', err);
                table.innerHTML = `<tr><td colspan="15">데이터 처리 중 오류가 발생했습니다: ${err.message}</td></tr>`; // colspan 조정 필요
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
        // ---------------------------------
    }

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
    // --- 수정: isCompareMode 인자 추가 ---
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
        // --- 수정: data[item.티어] 대신 groups[item.티어] 사용 ---
        data.forEach(item => {
            // 비교 모드일 때는 '티어 (Ver1)' 기준으로 그룹화 (데이터 1 기준 표)
            const itemTier = isCompareMode ? item['티어 (Ver1)'] : item.티어;
            if (itemTier && groups[itemTier]) { // Check if tier exists in groups
                 groups[itemTier].push(item);
            } else if (itemTier) {
                 // 데이터 1에만 있고 데이터 2에는 없는 경우 (티어 삭제)는 그룹화하지 않음
                 // 또는 신규 캐릭터 (데이터 2에만 있고 데이터 1에 없는 경우)도 그룹화하지 않음
                 // 이들은 티어 테이블에 표시되지 않음 (기존 동작 유지)
                 // console.warn(`Character '${item.실험체}' has unexpected tier '${itemTier}' or is new/removed in Ver1. Skipping.`);
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
          // 비교 모드일 때는 '점수 (Ver1)' 기준으로 정렬
          const sortKey = isCompareMode ? '점수 (Ver1)' : '점수';
          const entries = sortData(groups[tier], sortKey, false, isCompareMode ? 'value1' : 'value'); // mode='value'는 단일 모드 정렬
          // -----------------------------

          if (entries.length === 0) {
            html += `<span class="tooltip-container">
                       <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0">
                     </span>`;
          } else {
            entries.forEach((e, i) => {
              const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
              // --- 수정: 툴팁 내용 조정 (비교 모드일 때 Ver1/Ver2 정보 포함) ---
              let tooltipContent;
              if (isCompareMode) {
                   const pr1 = e['픽률 (Ver1)'] !== null && e['픽률 (Ver1)'] !== undefined ? e['픽률 (Ver1)'].toFixed(2) + '%' : '-';
                   const pr2 = e['픽률 (Ver2)'] !== null && e['픽률 (Ver2)'] !== undefined ? e['픽률 (Ver2)'].toFixed(2) + '%' : '-';
                   const rp1 = e['RP 획득 (Ver1)'] !== null && e['RP 획득 (Ver1)'] !== undefined ? e['RP 획득 (Ver1)'].toFixed(1) : '-';
                   const rp2 = e['RP 획득 (Ver2)'] !== null && e['RP 획득 (Ver2)'] !== undefined ? e['RP 획득 (Ver2)'].toFixed(1) : '-';
                   const win1 = e['승률 (Ver1)'] !== null && e['승률 (Ver1)'] !== undefined ? (e['승률 (Ver1)'] * 100).toFixed(1) + '%' : '-';
                   const win2 = e['승률 (Ver2)'] !== null && e['승률 (Ver2)'] !== undefined ? (e['승률 (Ver2)'] * 100).toFixed(1) + '%' : '-';
                   const top3_1 = e['TOP 3 (Ver1)'] !== null && e['TOP 3 (Ver1)'] !== undefined ? (e['TOP 3 (Ver1)'] * 100).toFixed(1) + '%' : '-';
                   const top3_2 = e['TOP 3 (Ver2)'] !== null && e['TOP 3 (Ver2)'] !== undefined ? (e['TOP 3 (Ver2)'] * 100).toFixed(1) + '%' : '-';
                   const rank1 = e['순위 (Ver1)'] !== null && e['순위 (Ver1)'] !== undefined ? e['순위 (Ver1)'] + '위' : '-';
                   const rank2 = e['순위 (Ver2)'] !== null && e['순위 (Ver2)'] !== undefined ? e['순위 (Ver2)'] + '위' : '-';


                   tooltipContent = `
                       ${e.실험체}<br>
                       Ver1: 픽률 ${pr1}, RP ${rp1}, 승률 ${win1}, TOP 3 ${top3_1}, 순위 ${rank1}<br>
                       Ver2: 픽률 ${pr2}, RP ${rp2}, 승률 ${win2}, TOP 3 ${top3_2}, 순위 ${rank2}
                   `;
              } else {
                   // 단일 모드 툴팁 내용
                   tooltipContent = `
                       ${e.실험체}<br>
                       픽률: ${(e['표본수']/totalSample*100).toFixed(2)}%<br>
                       RP: ${e['RP 획득'].toFixed(1)}<br>
                       승률: ${(e['승률']*100).toFixed(1)}%
                   `;
              }
              const tooltip = `<div class="tooltip-box">${tooltipContent}</div>`;
              // -------------------------------------------------------------

              // --- 추가: 순위 변동 표시 요소 ---
              let rankChangeOverlayHtml = '';
              if (isCompareMode) {
                   const rankChangeValue = e['순위 변화값']; // 숫자 또는 string
                   let rankChangeText = '';
                   let rankChangeClass = '';

                   if (typeof rankChangeValue === 'number') {
                        const absChange = Math.abs(rankChangeValue);
                        if (rankChangeValue < 0) { // 순위 숫자 감소 (좋아짐)
                             rankChangeText = `▲${absChange}`;
                             rankChangeClass = 'rank-change-up';
                        } else if (rankChangeValue > 0) { // 순위 숫자 증가 (나빠짐)
                             rankChangeText = `▼${absChange}`;
                             rankChangeClass = 'rank-change-down';
                        } else { // 순위 변동 없음 (숫자 0)
                             rankChangeText = `-`;
                             rankChangeClass = 'rank-change-same';
                        }
                   } else { // 비숫자 순위 변화 (신규, 삭제, -)
                        // 티어 테이블에서는 신규/삭제/없는 캐릭터는 해당 티어에 표시되지 않으므로 이 경우는 발생하지 않음
                        // 하지만 혹시 모를 경우를 대비하여 처리
                        rankChangeText = `-`;
                        rankChangeClass = 'rank-change-same';
                   }

                   if (rankChangeText !== '') {
                        rankChangeOverlayHtml = `<div class="rank-change-overlay ${rankChangeClass}">${rankChangeText}</div>`;
                   }
              }
              // -----------------------------------


              html += `<span class="tooltip-container">
                         <img src="/image/${imgName}.png" alt="${e.실험체}">
                         ${tooltip}
                         ${rankChangeOverlayHtml} <!-- 순위 변동 표시 요소 추가 -->
                       </span>`;
              if ((i+1)%perRow===0 && i!==entries.length-1) html += '</div><div>';
            });
          }
      
          // 닫기 태그
          html += `</div></td></tr>`;
        });
      
        table.innerHTML = html;

        // --- 추가: 색상 강조 적용 (단일 모드에서만) ---
        if (!isCompareMode && gradientCheckbox.checked) {
             // 단일 모드 색상 강조 로직 (common.js 함수 사용)
             // displayTierTable은 common.js의 applyGradientColorsSingle/Comparison을 사용하지 않음
             // 티어별 배경색은 CSS로 처리되고 있으므로, 여기서는 추가적인 색상 강조 로직이 필요 없음
             // 만약 이미지 자체에 어떤 색상 효과를 주고 싶다면 여기에 로직 추가
        }
        // ---------------------------------------------
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
            html2canvas(document.getElementById('tier-table'), { // Use getElementById for clarity
                 backgroundColor: null // 배경 투명하게 캡처 (필요시)
            })
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