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
    let currentSortColumn = '점수';      // 기본 정렬 컬럼 (단일 모드)
    let currentSortAsc    = false;       // 기본 정렬 방향 (내림차순)
    let currentSortMode   = 'value';     // 'value', 'delta' 정렬 모드 추가
    let lastData          = [];          // 마지막으로 렌더링된 데이터 (비교 모드에서는 병합된 데이터)
    let tierConfig        = null;        // INI 파일에서 로드된 티어 설정

    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    // 비교 모드 활성화 여부 확인
    const isCompareMode = params.get('compare') === '1';

    // 1) URL 파라미터 → 컨트롤에 반영
    function applyParamsToControls() {
        // 기본 데이터 선택
        if (params.has('version'))  versionSelect.value    = params.get('version');
        if (params.has('tier'))     tierSelect.value       = params.get('tier');
        if (params.has('period'))   periodSelect.value     = params.get('period');

        // 색상 강조 (기본 모드에서만 URL 적용, 비교 모드는 JS에서 강제 활성화 및 URL 미저장)
        if (!isCompareMode && params.has('gradient')) gradientCheckbox.checked = params.get('gradient') === '1';

        // 비교 모드일 경우, 비교 컨트롤의 파라미터도 반영
        if (isCompareMode) {
            // 기본값 설정 또는 URL 파라미터 반영
            // version2, tier2, period2 파라미터 사용
            versionSelectCompare.value = params.get('version2') || versionSelect.value;
            tierSelectCompare.value    = params.get('tier2')    || tierSelect.value;
            periodSelectCompare.value  = params.get('period2')  || periodSelect.value;

            // 비교 모드에서는 색상 강조 항상 켜짐 및 체크박스 비활성화
            gradientCheckbox.checked = true;
            gradientCheckbox.disabled = true;
            gradientCheckbox.parentElement.style.opacity = '0.5'; // 비활성 시 시각적 표시
        } else {
             // 비교 모드가 아닐 때는 비활성화 해제 및 투명도 복원
             gradientCheckbox.disabled = false;
             gradientCheckbox.parentElement.style.opacity = '1';
        }
    }

    // 2) 컨트롤 상태 → URL에 반영
    function updateURL() {
        // 기본 데이터 상태 저장
        params.set('version', versionSelect.value);
        params.set('tier',    tierSelect.value);
        params.set('period',  periodSelect.value);

        if (!isCompareMode) {
            // 기본 모드에서는 gradient 상태만 저장
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            // 비교 모드 파라미터 제거
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
        } else {
            // 비교 모드에서는 비교 컨트롤 상태도 저장
            params.set('version2', versionSelectCompare.value);
            params.set('tier2',    tierSelectCompare.value);
            params.set('period2',  periodSelectCompare.value);
            params.set('compare', '1'); // 비교 모드 파라미터 유지

            // gradient 파라미터는 비교 모드에서 사용되지 않으므로 제거
            params.delete('gradient');
        }

        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config = parseINI(iniText); // window.parseINI 대신 parseINI 사용
        tierConfig   = config.tiers; // 전역 변수에 저장

        // common.js 에 정의된 함수들로 드롭다운 채우기
        populateVersionDropdown(versionSelect, versionList); // window.populate... 대신 함수 이름만 사용
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // 비교 모드일 경우, 비교 드롭다운도 채우고 보이게 함
        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex'; // flex로 변경
            compareModeLabel.style.display = 'inline'; // 레이블 표시
            populateVersionDropdown(versionSelectCompare, versionList);
            populateTierDropdown(tierSelectCompare);
            populatePeriodDropdown(periodSelectCompare);

            // 비교 모드 기본 정렬 컬럼/모드 설정
            currentSortColumn = '점수 차이'; // 비교 모드에서는 기본을 점수 차이 기준 내림차순 정렬로 변경 제안
            currentSortAsc = false; // 내림차순
            currentSortMode = 'delta'; // 변화량 기준 정렬
        } else {
             // 단일 모드 기본 정렬 (기존과 동일)
             currentSortColumn = '점수';
             currentSortAsc = false;
             currentSortMode = 'value';
        }


        // URL 파라미터로부터 컨트롤 상태 복원
        applyParamsToControls();

        // 변경 시 URL 갱신 + 데이터 갱신
        // 모드에 따라 다른 로드 함수 호출
        const reloadData = isCompareMode ? loadAndDisplayComparison : loadAndDisplaySingle;

        versionSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        tierSelect.addEventListener('change',    () => { updateURL(); reloadData(); });
        periodSelect.addEventListener('change',  () => { updateURL(); reloadData(); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            // 기본 모드에서만 색상 강조 토글
            if (!isCompareMode && lastData && lastData.length > 0) renderTable(lastData);
        });

        // 비교 모드일 경우, 비교 드롭다운 이벤트 리스너 추가
        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change',    () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change',  () => { updateURL(); reloadData(); });
        }

        // 첫 로드 (모드에 따라 다른 함수 호출)
        reloadData();

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerText = '초기 설정 로드에 실패했습니다.';
    });

    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더 (기존 로직)
    function loadAndDisplaySingle() {
        dataContainer.innerHTML = '데이터 로딩 중...'; // 로딩 메시지
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
                // extractPeriodEntries 함수는 기간 동안의 '평균 스탯'을 계산하여 반환합니다.
                const entries = extractPeriodEntries(history, period); // window.extractPeriodEntries 대신 함수 이름만 사용

                const avgScore = calculateAverageScore(entries); // window 사용 대신 함수 이름만 사용
                const stddev   = calculateStandardDeviation(entries, avgScore); // window 사용 대신 함수 이름만 사용

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig); // window 사용 대신 함수 이름만 사용
                    // 단일 모드 정렬은 항상 'value' 모드
                    scored = sortData(scored, currentSortColumn, currentSortAsc); // window 사용 대신 함수 이름만 사용

                lastData = scored;
                renderTable(scored);
            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`; // innerText 대신 innerHTML 사용 (안전하다고 가정)
            });
    }

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더 (새 로직)
    function loadAndDisplayComparison() {
        dataContainer.innerHTML = '비교 데이터 로딩 중...'; // 로딩 메시지
        const version1 = versionSelect.value;
        const tier1    = tierSelect.value;
        const period1  = periodSelect.value; // 데이터 1의 기간

        const version2 = versionSelectCompare.value;
        const tier2    = tierSelectCompare.value;
        const period2  = periodSelectCompare.value; // 데이터 2의 기간

        // URL이 동일하면 데이터 1과 데이터 2가 같으므로 비교 의미 없음
        if (version1 === version2 && tier1 === tier2 && period1 === period2) {
             dataContainer.innerHTML = '데이터 1과 데이터 2가 동일합니다.';
             lastData = [];
             return;
        }


        const url1 = `/data/${version1}/${tier1}.json`;
        const url2 = `/data/${version2}/${tier2}.json`;

        Promise.all([
            fetch(url1).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url1}`);
                return res.json();
            }),
            fetch(url2).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url2}`);
                return res.json();
            })
        ])
        .then(([json1, json2]) => {
            const history1 = json1['통계'];
            const history2 = json2['통계'];

            // 각 데이터셋에 대해 선택된 기간의 데이터 추출
            const entries1 = extractPeriodEntries(history1, period1); // window 사용 대신 함수 이름만 사용
            const entries2 = extractPeriodEntries(history2, period2); // window 사용 대신 함수 이름만 사용

            // 각 데이터셋에 대해 점수/티어 계산
            const avgScore1 = calculateAverageScore(entries1); // window 사용 대신 함수 이름만 사용
            const stddev1   = calculateStandardDeviation(entries1, avgScore1); // window 사용 대신 함수 이름만 사용
            const scored1   = calculateTiers(entries1, avgScore1, stddev1, tierConfig); // window 사용 대신 함수 이름만 사용

            const avgScore2 = calculateAverageScore(entries2); // window 사용 대신 함수 이름만 사용
            const stddev2   = calculateStandardDeviation(entries2, avgScore2); // window 사용 대신 함수 이름만 사용
            const scored2   = calculateTiers(entries2, avgScore2, stddev2, tierConfig); // window 사용 대신 함수 이름만 사용


            // 두 데이터셋 병합 및 비교
            const comparisonData = mergeAndCalculateDifferences(scored1, scored2);

             // 정렬 (비교 모드에서는 병합된 데이터를 정렬)
             // 현재 정렬 기준(컬럼, 방향, 모드)에 따라 정렬
             // sortData는 common.js에 정의되어 있으므로 바로 사용
            const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc); // window 사용 대신 함수 이름만 사용


            lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장
            renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링
        })
        .catch(err => {
            console.error('비교 데이터 로드 실패:', err);
            dataContainer.innerHTML = `비교 데이터를 불러오는 데 실패했습니다: ${err.message}`; // innerText 대신 innerHTML 사용
        });
    }

    // 6) 두 데이터셋 병합 및 차이 계산 (새 함수 - 이전 코드와 동일)
     function mergeAndCalculateDifferences(data1, data2) {
        const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
        const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

        const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
        const comparisonResult = [];

        const numericCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위'];
        const otherCols = ['티어', '표본수'];

        // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다.
        const sortedData1 = [...data1].sort((a,b) => {
             if (b['점수'] !== a['점수']) return b['점수'] - a['점수'];
             return String(a['실험체']).localeCompare(String(b['실험체'])); // 동점 시 이름순
        });
         const sortedData2 = [...data2].sort((a,b) => {
             if (b['점수'] !== a['점수']) return b['점수'] - a['점수'];
             return String(a['실험체']).localeCompare(String(b['실험체'])); // 동점 시 이름순
        });

        const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1]));
        const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1]));


        allCharacters.forEach(charName => {
            const d1 = map1[charName];
            const d2 = map2[charName];

            const result = { '실험체': charName };

            numericCols.forEach(col => {
                const val1 = d1 ? d1[col] : null;
                const val2 = d2 ? d2[col] : null;

                result[`${col} (Ver1)`] = val1;
                result[`${col} (Ver2)`] = val2;

                if (typeof val1 === 'number' && typeof val2 === 'number') {
                    result[`${col} 차이`] = val2 - val1;
                } else {
                    result[`${col} 차이`] = null;
                }
            });

            otherCols.forEach(col => {
                const val1 = d1 ? d1[col] : null;
                const val2 = d2 ? d2[col] : null;

                result[`${col} (Ver1)`] = val1;
                result[`${col} (Ver2)`] = val2;
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
                result['순위 변화'] = rank2 - rank1; // 예: 10위 -> 8위 -> -2
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


     // 7) 비교 테이블 렌더링 (새 함수 - 이전 코드와 동일)
    function renderComparisonTable(data) {
         if (!isCompareMode) return;

        const cols = [
            '실험체',
            '점수 (Ver1)', '점수 (Ver2)', '점수 차이',
            '티어 변화',
            '순위 (Ver1)', '순위 (Ver2)', '순위 변화', // 순위 컬럼 및 순위 변화
            '픽률 (Ver1)', '픽률 (Ver2)', '픽률 차이',
            'RP 획득 (Ver1)', 'RP 획득 (Ver2)', 'RP 획득 차이',
            '승률 (Ver1)', '승률 (Ver2)', '승률 차이',
            'TOP 3 (Ver1)', 'TOP 3 (Ver2)', 'TOP 3 차이',
            '평균 순위 (Ver1)', '평균 순위 (Ver2)', '평균 순위 차이',
            '표본수 (Ver1)', '표본수 (Ver2)'
        ];

        let html = '<table><thead><tr>';
        cols.forEach(c => {
            // 정렬 가능 여부 판단 (실험체, 티어 변화 제외)
            const sortable = c !== '실험체' && c !== '티어 변화';
            html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let val = row[col];
                let displayVal = '-';
                let cellClasses = [];

                if (val !== undefined && val !== null) {
                    // 값 포맷팅 및 클래스 추가
                     if (col === '실험체') {
                        displayVal = val;
                     } else if (col === '티어 변화') {
                         displayVal = val;
                          // 티어 변화에 따른 클래스 추가 (색상 강조용) - applyGradientColorsComparison에서 색칠하므로 클래스는 옵션
                          if (val.includes('→')) {
                              const tiers = val.split('→').map(t => t.trim());
                              const tier1 = tiers[0];
                              const tier2 = tiers[1];
                               // '삭제'와 '신규'도 순서에 포함
                              const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F', '삭제'];
                              const index1 = tierOrder.indexOf(tier1);
                              const index2 = tierOrder.indexOf(tier2);

                               if (val.includes('신규 →')) {
                                   // cellClasses.push('tier-new');
                               } else if (index1 >= 0 && index2 >= 0) {
                                   if (index2 < index1) cellClasses.push('tier-up'); // 티어 개선
                                   else if (index2 > index1) cellClasses.push('tier-down'); // 티어 악화
                               }
                           }
                     } else if (col === '순위 변화') {
                         displayVal = (typeof val === 'number' && val !== 0) ? (val > 0 ? `+${val}` : `${val}`) : (val === 0 ? '0' : val);
                          // 순위 변화에 따른 클래스 추가 - applyGradientColorsComparison에서 색칠하므로 클래스는 옵션
                           if (typeof val === 'number') {
                               if (val < 0) cellClasses.push('rank-up'); // 숫자가 작아지면 순위 개선
                               else if (val > 0) cellClasses.push('rank-down'); // 숫자가 커지면 순위 악화
                           } else if (val.includes('신규 →')) {
                                // cellClasses.push('rank-new');
                           } else if (val.includes('→ 삭제')) {
                                // cellClasses.push('rank-removed');
                           }

                     } else if (col.endsWith(' 차이')) {
                        // 차이 값
                        const originalCol = col.replace(' 차이', '');
                        const isPercentage = ['픽률', '승률', 'TOP 3'].includes(originalCol);
                        const decimals = isPercentage ? 2 : 2; // 소수점 자리수
                         // 차이 값 포맷팅은 common.js의 applyGradientColorsComparison에서 이미 숫자 파싱 시 수행됨.
                         // 여기서는 단순히 toFixed만 적용하고 기호/클래스는 CSS/색상함수에서 담당하도록 변경
                        const formattedVal = typeof val === 'number' ? val.toFixed(decimals) : '-'; // 숫자가 아니면 하이픈
                         // 기호 표시 로직은 여기서 추가 (색상 함수와 분리)
                         if (typeof val === 'number') {
                             if (val > 0) displayVal = `▲+${formattedVal}`;
                             else if (val < 0) displayVal = `▼${formattedVal.replace('-','')}`; // 음수 부호 제거 후 ▼ 붙임
                             else displayVal = formattedVal; // 0인 경우 0.00 또는 0.00%
                         } else {
                              displayVal = formattedVal;
                         }

                     } else if (col.includes('(Ver1)') || col.includes('(Ver2)')) {
                         // 원본 데이터 값
                         const originalCol = col.replace(' (Ver1)', '').replace(' (Ver2)', '');
                         if (originalCol === '픽률' || originalCol === '승률' || originalCol === 'TOP 3') {
                             displayVal = parseFloat(val).toFixed(2) + '%';
                         } else if (originalCol === '점수' || originalCol === 'RP 획득' || originalCol === '평균 순위') {
                              displayVal = parseFloat(val).toFixed(2);
                         } else if (originalCol === '표본수') {
                             displayVal = val !== null && val !== undefined ? val.toString() : '-'; // 표본수는 null/undefined 대비
                         } else if (originalCol === '티어') {
                              displayVal = val;
                         } else if (originalCol === '순위') {
                              displayVal = val !== null && val !== undefined ? val.toString() : '-'; // 순위 표시
                         }
                         else { // 기타 (예: 순위) - 이 경우 사용하지 않을 수 있음
                              displayVal = val;
                         }
                     } else {
                         // 예상치 못한 컬럼 (발생하지 않아야 함)
                          displayVal = val;
                     }
                }

                // 셀에 클래스 적용
                // 클래스는 applyGradientColorsComparison에서 배경색을 칠할 때 사용하도록 변경했으므로, 여기서는 주석 처리하거나 제거합니다.
                // const classString = cellClasses.length > 0 ? ` class="${cellClasses.join(' ')}"` : '';
                 html += `<td>${displayVal}</td>`; // classString 제거

            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 비교 테이블용 정렬 이벤트 부착 (차이 컬럼도 포함)
        attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
        // 비교 모드 색상 강조 (차이 값, 티어/순위 변화에 적용)
        applyGradientColorsComparison(dataContainer.querySelector('table')); // window 사용 대신 함수 이름만 사용
    }

    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용)
    function renderTable(data) {
         if (isCompareMode) return;

        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위', '표본수'];
        let html = '<table><thead><tr>';
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
                 } else if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                     val = parseFloat(val).toFixed(2) + '%';
                 } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위') {
                     val = parseFloat(val).toFixed(2);
                 } else if (col === '표본수') {
                     val = val !== null && val !== undefined ? val.toString() : '-'; // 표본수 null/undefined 대비
                 } else {
                     val = val;
                 }

                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 단일 모드용 정렬 이벤트 부착
        attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
        // 색상 강조
        if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table')); // window 사용 대신 함수 이름만 사용
    }

    // 9) 단일 모드용 정렬 이벤트 리스너 부착 (이전 코드와 동일)
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            th.setAttribute('data-arrow', '');

            if (currentSortColumn === col && currentSortMode === 'value') {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            th.onclick = () => {
                if (currentSortColumn === col) {
                     currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    currentSortAsc = false;
                    currentSortMode = 'value';
                }

                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc); // window 사용 대신 함수 이름만 사용
                renderFunc(sortedData);
            };
        });
    }

    // 10) 비교 모드용 정렬 이벤트 리스너 부착 (순환 로직 포함) - 이전 코드와 거의 동일, 함수 호출 방식만 변경
     function attachComparisonSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
             const col = th.dataset.col;

             th.setAttribute('data-arrow', '');

             if (currentSortColumn === col) {
                 let arrow = '';
                 if (currentSortMode === 'value') {
                     arrow = currentSortAsc ? '▲' : '▼';
                 } else if (currentSortMode === 'delta') {
                     arrow = currentSortAsc ? '△' : '▽';
                 }
                 th.setAttribute('data-arrow', arrow);
             }

             th.onclick = () => {
                 const isDeltaColumnCandidate = col.endsWith(' 차이') || col === '순위 변화'; // 변화량 관련 컬럼 후보

                 if (currentSortColumn === col) {
                     // 같은 컬럼 다시 클릭 시 순환 로직
                     if (currentSortMode === 'value' && !currentSortAsc) { // ▼ -> ▲
                         currentSortAsc = true;
                     } else if (currentSortMode === 'value' && currentSortAsc && isDeltaColumnCandidate) { // ▲ -> ▽ (변화량 내림차)
                          // value 오름차순 상태에서 변화량 컬럼 후보를 클릭하면 delta 정렬로 전환
                         currentSortMode = 'delta';
                         // 변화량 내림차순 (좋아지는 변화가 위로)
                         // 순위 변화는 숫자가 작아지는 것이 좋아지는 변화이므로 순위 변화일 때만 오름차순
                         currentSortAsc = (col === '순위 변화');

                     } else if (currentSortMode === 'delta' && !currentSortAsc && isDeltaColumnCandidate) { // ▽ -> △ (변화량 오름차)
                          // delta 내림차순에서 오름차순으로
                         currentSortAsc = true;

                     }
                     else { // 그 외 (△ -> ▼ 또는 value 오름차순 상태에서 변화량 컬럼이 아닐 때) -> value 내림차순 (초기 상태로 회귀)
                          currentSortMode = 'value';
                          currentSortAsc = false;
                     }
                 } else {
                     // 다른 컬럼 클릭 시
                     currentSortColumn = col; // 컬럼 변경
                     currentSortMode = 'value'; // 기본은 value 모드
                     currentSortAsc = false; // 기본은 내림차순 (점수, 픽률 등)

                     // 실험체 이름은 기본 오름차순
                     if (col === '실험체') {
                          currentSortAsc = true;
                     }
                      // 순위 변화는 기본 내림차순 (숫자가 커지는게 아래로)
                     if (col === '순위 변화') {
                          currentSortAsc = false; // 예: +5, +2, 0, -1, -3 순서 (내림차순)
                     }

                 }

                 // 데이터 정렬
                 let sortedData;
                 let sortByKey = currentSortColumn; // 기본적으로 현재 선택된 컬럼 키 사용

                 if (currentSortMode === 'value') {
                      // Value 모드 정렬 시, xxx (Ver1) 또는 xxx (Ver2) 컬럼을 기준으로 삼을 수 있습니다.
                      // 요구사항: 기본은 첫 번째 드롭다운 데이터 표시
                      // 따라서 'value' 모드일 때는 Ver1 컬럼을 기준으로 정렬하도록 합니다.
                      // 실험체 이름, 티어 변화, 순위 변화는 Ver1/Ver2 구분이 없으므로 그대로 사용
                      if (!['실험체', '티어 변화', '순위 변화'].includes(currentSortColumn) && !currentSortColumn.includes('(Ver1)') && !currentSortColumn.includes('(Ver2)')) {
                           sortByKey = currentSortColumn + ' (Ver1)'; // Ver1 컬럼 이름 강제
                      } else if (currentSortColumn.includes('(Ver2)')) {
                           // 혹시 모를 Ver2 컬럼 선택 시 Ver2 기준으로 정렬
                           sortByKey = currentSortColumn;
                      } else {
                           // 실험체, 티어 변화, 순위 변화 등은 키 이름 그대로 사용
                           sortByKey = currentSortColumn;
                      }

                 } else { // currentSortMode === 'delta'
                      // Delta 모드 정렬 시, xxx 차이 또는 순위 변화 컬럼을 기준으로 삼습니다.
                      // currentSortColumn은 이미 '점수 차이', '순위 변화' 등을 가리킬 것이므로 그대로 사용
                      sortByKey = currentSortColumn;
                 }

                // console.log(`Sorting by: ${sortByKey}, Mode: ${currentSortMode}, Asc: ${currentSortAsc}`); // 디버그용

                sortedData = sortData(lastData, sortByKey, currentSortAsc); // window 사용 대신 함수 이름만 사용
                renderFunc(sortedData); // 렌더링 함수 호출 (renderComparisonTable)
             };
         });
     }
});