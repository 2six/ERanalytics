// script_statistics.js
document.addEventListener('DOMContentLoaded', function() {
    // common.js에 정의된 함수/변수들은 이제 전역 스코프에 있으므로 바로 사용 가능합니다.
    // 예: parseINI, populateVersionDropdown, calculateTiers, sortData 등

    // DOM 요소
    const versionSelect         = document.getElementById('version-select');
    const tierSelect            = document.getElementById('tier-select');
    const periodSelect          = document.getElementById('period-select');
    const gradientCheckbox      = document.getElementById('gradient-checkbox');
    const dataContainer         = document.getElementById('data-container');
    const compareModeLabel      = document.getElementById('compare-mode-label'); // 비교 모드 레이블

    // 비교 모드 관련 요소
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare  = document.getElementById('version-select-compare');
    const tierSelectCompare     = document.getElementById('tier-select-compare');
    const periodSelectCompare   = document.getElementById('period-select-compare');

    // 상태
    let currentSortColumn = '점수';      // 기본 정렬 컬럼
    let currentSortAsc    = false;       // 기본 정렬 방향 (내림차순)
    let currentSortMode   = 'value';     // 'value', 'delta' 정렬 모드
    let lastData          = [];          // 마지막으로 렌더링된 데이터 (비교 모드에서는 병합된 데이터)
    let tierConfig        = null;        // INI 파일에서 로드된 티어 설정

    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    // 비교 모드 활성화 여부 확인
    const isCompareMode = params.get('compare') === '1';

    // 1) URL 파라미터 → 컨트롤에 반영 (이전과 동일)
    function applyParamsToControls() {
        if (params.has('version'))  versionSelect.value    = params.get('version');
        if (params.has('tier'))     tierSelect.value       = params.get('tier');
        if (params.has('period'))   periodSelect.value     = params.get('period');

        if (!isCompareMode && params.has('gradient')) gradientCheckbox.checked = params.get('gradient') === '1';

        if (isCompareMode) {
            versionSelectCompare.value = params.get('version2') || versionSelect.value;
            tierSelectCompare.value    = params.get('tier2')    || tierSelect.value;
            periodSelectCompare.value  = params.get('period2')  || periodSelect.value;

            gradientCheckbox.checked = true;
            gradientCheckbox.disabled = true;
            gradientCheckbox.parentElement.style.opacity = '0.5';
        } else {
             gradientCheckbox.disabled = false;
             gradientCheckbox.parentElement.style.opacity = '1';
        }
    }

    // 2) 컨트롤 상태 → URL에 반영 (이전과 동일)
    function updateURL() {
        params.set('version', versionSelect.value);
        params.set('tier',    tierSelect.value);
        params.set('period',  periodSelect.value);

        if (!isCompareMode) {
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
        } else {
            params.set('version2', versionSelectCompare.value);
            params.set('tier2',    tierSelectCompare.value);
            params.set('period2',  periodSelectCompare.value);
            params.set('compare', '1');
            params.delete('gradient');
        }

        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직 (이전과 동일, 정렬 기본값 재조정)
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config = parseINI(iniText); // common.js 함수 사용
        tierConfig   = config.tiers;

        populateVersionDropdown(versionSelect, versionList); // common.js 함수 사용
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex';
            compareModeLabel.style.display = 'inline';
            populateVersionDropdown(versionSelectCompare, versionList);
            populateTierDropdown(tierSelectCompare);
            populatePeriodDropdown(periodSelectCompare);

            // 비교 모드 기본 정렬: 점수 변화량 내림차순
            currentSortColumn = '점수'; // 점수 컬럼 헤더 클릭 시 변화량 정렬
            currentSortAsc = false; // 변화량 내림차순 (좋아지는 방향)
            currentSortMode = 'delta';
        } else {
             // 단일 모드 기본 정렬: 점수 내림차순
             currentSortColumn = '점수';
             currentSortAsc = false;
             currentSortMode = 'value';
        }

        applyParamsToControls();

        const reloadData = isCompareMode ? loadAndDisplayComparison : loadAndDisplaySingle;

        versionSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        tierSelect.addEventListener('change',    () => { updateURL(); reloadData(); });
        periodSelect.addEventListener('change',  () => { updateURL(); reloadData(); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            if (!isCompareMode && lastData && lastData.length > 0) renderTable(lastData);
        });

        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change',    () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change',  () => { updateURL(); reloadData(); });
        }

        reloadData();

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
    });

    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더 (이전과 동일)
    function loadAndDisplaySingle() {
        dataContainer.innerHTML = '데이터 로딩 중...';
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
                const entries = extractPeriodEntries(history, period);

                const avgScore = calculateAverageScore(entries);
                const stddev   = calculateStandardDeviation(entries, avgScore);

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig);
                // 단일 모드 정렬은 항상 'value' 모드
                currentSortMode = 'value'; // 단일 모드임을 명시적으로 설정
                scored = sortData(scored, currentSortColumn, currentSortAsc, currentSortMode); // common.js 함수 사용, mode 인자 전달

                lastData = scored;
                renderTable(scored);
            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
            });
    }

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더 (이전과 동일)
    function loadAndDisplayComparison() {
        dataContainer.innerHTML = '비교 데이터 로딩 중...';
        const version1 = versionSelect.value;
        const tier1    = tierSelect.value;
        const period1  = periodSelect.value;

        const version2 = versionSelectCompare.value;
        const tier2    = tierSelectCompare.value;
        const period2  = periodSelectCompare.value;

        if (version1 === version2 && tier1 === tier2 && period1 === period2) {
             dataContainer.innerHTML = '데이터 1과 데이터 2가 동일합니다.';
             lastData = [];
             return;
        }

        const url1 = `/data/${version1}/${tier1}.json`;
        const url2 = `/data/${version2}/${tier2}.json`;

        Promise.all([
            fetch(url1).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            }),
            fetch(url2).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
        ])
        .then(([json1, json2]) => {
            const history1 = json1['통계'];
            const history2 = json2['통계'];

            const entries1 = extractPeriodEntries(history1, period1);
            const entries2 = extractPeriodEntries(history2, period2);

            const avgScore1 = calculateAverageScore(entries1);
            const stddev1   = calculateStandardDeviation(entries1, avgScore1);
            const scored1   = calculateTiers(entries1, avgScore1, stddev1, tierConfig);

            const avgScore2 = calculateAverageScore(entries2);
            const stddev2   = calculateStandardDeviation(entries2, avgScore2);
            const scored2   = calculateTiers(entries2, avgScore2, stddev2, tierConfig);

            // 두 데이터셋 병합 및 차이 계산
            const comparisonData = mergeDataForComparison(scored1, scored2); // 새로운 병합 함수 호출

             // 정렬 (비교 모드에서는 병합된 데이터를 정렬)
            const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc, currentSortMode);


            lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장
            renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링
        })
        .catch(err => {
            console.error('비교 데이터 로드 실패:', err);
            dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
        });
    }

    // 6) 두 데이터셋 병합 및 변화량 계산 (이전 코드와 동일)
     function mergeDataForComparison(data1, data2) {
        const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
        const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

        const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
        const comparisonResult = [];

        const statsCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'];

        // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다.
        const sortedData1 = [...data1].sort((a,b) => {
             if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0); // null/undefined 대비
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });
         const sortedData2 = [...data2].sort((a,b) => {
             if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0); // null/undefined 대비
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });

        const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1]));
        const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1]));


        allCharacters.forEach(charName => {
            const d1 = map1[charName];
            const d2 = map2[charName];

            const result = { '실험체': charName };

            statsCols.forEach(col => {
                 const val1 = d1 ? d1[col] : null;
                 const val2 = d2 ? d2[col] : null;

                 result[`${col} (Ver1)`] = val1;
                 result[`${col} (Ver2)`] = val2;

                 if (typeof val1 === 'number' && typeof val2 === 'number') {
                      result[`${col} 변화량`] = val2 - val1;
                 } else {
                      result[`${col} 변화량`] = null;
                 }
            });

            // 티어 변화 계산
             const tier1 = d1 ? d1['티어'] : '삭제';
             const tier2 = d2 ? d2['티어'] : '삭제';

             if (!d1 && d2) {
                 result['티어 변화'] = `신규 → ${tier2}`;
             } else if (d1 && !d2) {
                 result['티어 변화'] = `${tier1} → 삭제`;
             } else if (d1 && d2) {
                 if (tier1 === tier2) {
                      result['티어 변화'] = tier1;
                 } else {
                      result['티어 변화'] = `${tier1} → ${tier2}`;
                 }
             } else {
                 result['티어 변화'] = '-';
             }

            // 순위 변화 계산 (점수 기준)
            const rank1 = rankMap1[charName];
            const rank2 = rankMap2[charName];

            result['순위 (Ver1)'] = rank1;
            result['순위 (Ver2)'] = rank2;

            if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                result['순위 변화'] = rank2 - rank1;
            } else if (typeof rank1 === 'number') {
                 result['순위 변화'] = `→ 삭제`;
            } else if (typeof rank2 === 'number') {
                 result['순위 변화'] = `신규 → `;
            } else {
                 result['순위 변화'] = '-';
            }

            comparisonResult.push(result);
        });

        return comparisonResult;
    }

     // 7) 비교 테이블 렌더링 (수정)
    function renderComparisonTable(data) {
         if (!isCompareMode) return;

        // 단일 모드와 동일한 컬럼 목록 사용
        // 원본 코드의 컬럼 순서를 따릅니다. (표본수 없음)
        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

        // *** 변수 이름 변경: html -> comparisonTableHtml ***
        let comparisonTableHtml = '<table><thead><tr>';
        cols.forEach(c => {
            const sortable = c !== '티어'; // 티어 컬럼은 정렬 제외
            comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        comparisonTableHtml += '</tr></thead><tbody>';

        data.forEach(row => {
            comparisonTableHtml += '<tr>'; // 행 시작
            cols.forEach(col => {
                let displayVal = '-';
                let dataAttributes = '';

                 if (col === '실험체') {
                     const charName = row['실험체'] || '-';
                     const rank1 = row['순위 (Ver1)'];
                     const rankChange = row['순위 변화'];

                     let rankText = '';
                      if (typeof rank1 === 'number') {
                          rankText = `${rank1}위`;
                           if (typeof rankChange === 'number' && rankChange !== 0) {
                               const rankChangeFormatted = Math.abs(rankChange);
                                rankText += rankChange < 0 ? ` ▼${rankChangeFormatted}` : ` ▲+${rankChangeFormatted}`;
                           } else if (rankChange === '→ 삭제') {
                                rankText += ` (삭제)`;
                           }
                      } else if (rankChange === '신규 → ') {
                           rankText = `(신규)`;
                      } else {
                           rankText = '';
                      }
                     displayVal = `${charName} ${rankText ? `<span class="rank-info">(${rankText})</span>` : ''}`;

                      if (typeof rankChange === 'number') {
                          dataAttributes += ` data-rankdelta="${rankChange}"`;
                      } else if (rankChange === '신규 → ') {
                          dataAttributes += ` data-rankdelta="new"`;
                      } else if (rankChange === '→ 삭제') {
                          dataAttributes += ` data-rankdelta="removed"`;
                      } else {
                          dataAttributes += ` data-rankdelta="none"`;
                      }

                 } else if (col === '티어') {
                     // 티어 컬럼에는 티어 변화 정보 표시
                     displayVal = row['티어 변화'] || '-';
                     // 티어 변화 색상 강조를 위한 data 속성
                     const tierChange = row['티어 변화'];
                      if (tierChange.includes('→')) {
                           const tiers = tierChange.split('→').map(t => t.trim());
                           const tier1 = tiers[0];
                           const tier2 = tiers[1];
                           const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F', '삭제'];
                           const index1 = tierOrder.indexOf(tier1);
                           const index2 = tierOrder.indexOf(tier2);

                           if (tierChange.includes('신규 →')) {
                               dataAttributes += ` data-tierchange="new"`;
                           } else if (index1 >= 0 && index2 >= 0) {
                               if (index2 < index1) dataAttributes += ` data-tierchange="up"`;
                               else if (index2 > index1) dataAttributes += ` data-tierchange="down"`;
                               else dataAttributes += ` data-tierchange="same"`;
                           } else if (tierChange === '→ 삭제') {
                                dataAttributes += ` data-tierchange="removed"`;
                           }
                       } else if (tierChange === '-') {
                             dataAttributes += ` data-tierchange="none"`;
                       } else { // 티어 변화 없는 경우 (S+ 등)
                             // 단일 모드 티어 색상 사용을 위해 원본 티어 값 저장
                             // common.js의 TIER_COLORS_SINGLE은 전역에 있으므로 직접 접근 가능
                            const color = TIER_COLORS_SINGLE[tierChange];
                             if (color) dataAttributes += ` style="background-color: ${color}"`; // 직접 스타일 추가 (data-tier는 색상 함수에서만 읽도록)
                             // 아니면 data-tier를 사용하고 applyGradientColorsComparison에서 읽도록 일관성 유지
                             dataAttributes += ` data-tier="${tierChange}"`; // 원본 티어 값 저장
                       }

                 } else if (col === '표본수') {
                      // 표본수는 Ver1 값과 Ver2 값을 나란히 표시
                      const val1 = row['표본수 (Ver1)'] !== null && row['표본수 (Ver1)'] !== undefined ? row['표본수 (Ver1)'] : '-';
                      const val2 = row['표본수 (Ver2)'] !== null && row['표본수 (Ver2)'] !== undefined ? row['표본수 (Ver2)'] : '-';
                      displayVal = `${val1} / ${val2}`; // 예: 100 / 120
                      // 표본수 변화량 색상 강조는 현재 미적용 (필요하면 data-delta 추가)
                 } else { // 그 외 숫자 스탯 컬럼 (점수, 픽률 등)
                      const val1 = row[`${col} (Ver1)`];
                      const val2 = row[`${col} (Ver2)`];
                      const delta = row[`${col} 변화량`];

                      // 데이터 1 값이 기본 표시값
                      let valueText = (typeof val1 === 'number') ? val1.toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2) : '-';
                      if (['픽률', '승률', 'TOP 3'].includes(col) && typeof val1 === 'number') valueText += '%';

                       // 변화량 텍스트
                      let deltaText = '';
                      if (typeof delta === 'number') {
                          const deltaFormatted = Math.abs(delta).toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2);
                           if (delta > 0) deltaText = `▲+${deltaFormatted}`;
                           else if (delta < 0) deltaText = `▼${deltaFormatted.replace('-','')}`;
                           else deltaText = '0.00';
                      } else {
                           if (val1 === null && val2 !== null) deltaText = '(신규)';
                           else if (val1 !== null && val2 === null) deltaText = '(삭제)';
                           else deltaText = '';
                      }

                       // 최종 표시될 내용 조합
                       if (valueText === '-' && deltaText === '' && (val1 === null || val1 === undefined) && (val2 === null || val2 === undefined)) {
                            displayVal = '-';
                       } else if (deltaText === '(신규)' || deltaText === '(삭제)') {
                            displayVal = `${valueText} ${deltaText}`;
                       }
                       else {
                            displayVal = `${valueText} <span class="delta-info">${deltaText}</span>`; // 변화량 텍스트에 span 태그 추가
                       }

                      // 색상 강조를 위해 변화량 값 또는 상태를 data-delta 속성으로 저장
                      if (typeof delta === 'number') {
                           dataAttributes += ` data-delta="${delta}"`;
                      } else if (deltaText === '(신규)') {
                           dataAttributes += ` data-delta="new"`;
                      } else if (deltaText === '(삭제)') {
                            dataAttributes += ` data-delta="removed"`;
                      } else {
                           dataAttributes += ` data-delta="none"`;
                      }
                 }

                 comparisonTableHtml += `<td data-col="${col}"${dataAttributes}>${displayVal}</td>`;
            });
            comparisonTableHtml += '</tr>';
        });
        comparisonTableHtml += '</tbody></table>';

        dataContainer.innerHTML = comparisonTableHtml; // 변경된 변수 이름 사용

        attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
        applyGradientColorsComparison(dataContainer.querySelector('table'));
    }


    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용) - 표본수 컬럼 제거 및 승률/TOP3 형식 복구
    function renderTable(data) {
         if (isCompareMode) return;

        // '표본수' 컬럼 제거
        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

        let html = '<table><thead><tr>'; // 기존 변수 이름 유지
        cols.forEach(c => {
            const sortable = c !== '티어';
            html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let val = row[col];
                 if (val === undefined || val === null) {
                     val = '-';
                 } else if (col === '승률' || col === 'TOP 3') {
                     // 승률, TOP3 형식 복구: 0.xx -> xx.xx%
                     val = typeof val === 'number' ? (val * 100).toFixed(2) + '%' : '-';
                 } else if (col === '픽률') {
                      // 픽률 형식 복구: xx.xx% (calculateTiers에서 이미 100 곱해져 옴)
                     val = typeof val === 'number' ? val.toFixed(2) + '%' : '-';

                 } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위') {
                     val = typeof val === 'number' ? parseFloat(val).toFixed(2) : '-';
                 } else { // 실험체, 티어 등
                     val = val;
                 }

                html += `<td data-col="${col}">${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 단일 모드용 정렬 이벤트 부착
        attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
        // 색상 강조
        if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table'));
    }

    // 9) 단일 모드용 정렬 이벤트 리스너 부착 (이전 코드와 동일, 함수 호출 방식만 변경)
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            th.setAttribute('data-arrow', '');

            // 단일 모드 정렬은 항상 'value' 모드 기준
            if (currentSortColumn === col && currentSortMode === 'value') {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            th.onclick = () => {
                if (currentSortColumn === col) {
                     currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    currentSortAsc = false;
                    currentSortMode = 'value'; // 단일 모드는 value 고정
                }

                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // mode 인자 전달
                renderFunc(sortedData);
            };
        });
    }

    // 10) 비교 모드용 정렬 이벤트 리스너 부착 (수정)
     function attachComparisonSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
             const col = th.dataset.col;

             if (col === '티어') { // 티어 컬럼은 정렬 제외
                  th.style.cursor = 'default';
                  th.setAttribute('data-arrow', '');
                  return;
             }
              th.style.cursor = 'pointer';

             th.setAttribute('data-arrow', '');

             // 현재 정렬 기준과 일치하면 화살표 표시
             if (currentSortColumn === col) {
                 let arrow = '';
                 if (currentSortMode === 'value') {
                     arrow = currentSortAsc ? '▲' : '▼';
                 } else if (currentSortMode === 'delta') {
                     // 변화량 정렬 시 화살표 (common.js의 sortData 로직과 일치해야 함)
                     // 순위 변화 (평균 순위 컬럼)는 값이 작을수록 좋음
                     const isRankRelated = col === '평균 순위';
                      if (isRankRelated) {
                          // common.js에서 순위 변화는 asc=true 일 때 작은 값(좋아짐)이 위로 정렬됨 -> ▼ 기호
                          // asc=false 일 때 큰 값(나빠짐)이 위로 정렬됨 -> ▲ 기호
                          // 화살표는 정렬 방향(asc)에 따라 결정되는 것이 일반적
                           arrow = currentSortAsc ? '▲' : '▼'; // 일반적인 오름/내림차 기호
                      } else { // 그 외 숫자 스탯 변화량
                          // common.js에서 그 외 스탯 변화량은 asc=true 일 때 작은 값(나빠짐)이 위로 -> ▲ 기호
                          // asc=false 일 때 큰 값(좋아짐)이 위로 -> ▼ 기호
                           arrow = currentSortAsc ? '▲' : '▼'; // 일반적인 오름/내림차 기호
                      }

                 }
                 th.setAttribute('data-arrow', arrow);
             }

             // 클릭 이벤트 리스너 추가
             th.onclick = () => {
                 const isNumericStatColumn = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'].includes(col);

                 if (currentSortColumn === col) {
                     // 같은 컬럼 다시 클릭 시 순환 로직
                     if (currentSortMode === 'value' && !currentSortAsc) { // value ▼ -> value ▲
                         currentSortAsc = true;
                     } else if (currentSortMode === 'value' && currentSortAsc && isNumericStatColumn) { // value ▲ & 숫자 스탯 컬럼 -> delta 정렬 시작
                         currentSortMode = 'delta';
                          // common.js의 sortData 로직을 따릅니다.
                          // 순위 변화 (평균 순위)는 asc=true가 좋아지는 순, asc=false가 나빠지는 순
                          // 그 외 변화량은 asc=true가 나빠지는 순, asc=false가 좋아지는 순
                          // 초기 정렬 방향 설정: delta 내림차순 (좋아지는 순)을 기본으로 하고, 평균 순위는 오름차순으로 조정
                          if (col === '평균 순위') currentSortAsc = true; // 평균 순위는 오름차순 (숫자 작아짐)이 좋아지는 순
                          else currentSortAsc = false; // 그 외 스탯은 내림차순 (숫자 커짐)이 좋아지는 순


                     } else if (currentSortMode === 'delta' && !currentSortAsc && isNumericStatColumn) { // delta 내림차 -> delta 오름차
                          // delta 모드에서 오름차순으로 전환
                         currentSortAsc = true;
                     }
                     else { // 그 외 (delta 오름차 또는 숫자 스탯 아닐 때) -> value 내림차순 (초기 상태로 회귀)
                          currentSortMode = 'value';
                          currentSortAsc = false;
                     }
                 } else {
                     // 다른 컬럼 클릭 시
                     currentSortColumn = col; // 컬럼 변경
                     currentSortMode = 'value'; // 기본은 value 모드
                     currentSortAsc = false; // 기본은 내림차순

                     // 실험체 이름은 기본 오름차순
                     if (col === '실험체') {
                          currentSortAsc = true;
                     }
                     // 평균 순위는 숫자가 작을수록 좋으므로 기본 오름차순?
                     // -> common.js의 sortData가 value 정렬 시 평균 순위는 오름차순으로 정렬하므로, 여기서는 asc=true를 유지해도 될 것 같습니다.
                     // 일단 value 모드 기본은 내림차순으로 통일하고, sortData에서 뒤집도록 처리합니다.
                     // if (col === '평균 순위') currentSortAsc = false; // value 모드 평균 순위는 내림차순 시작 (큰값 위로)
                 }

                 const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // common.js 함수 사용, mode 인자 전달
                 renderFunc(sortedData);
             };
         });
     }
});