// script_tier_table.js
document.addEventListener('DOMContentLoaded', function () {
    // common.js에 정의된 함수/변수들은 전역 스코프에 있으므로 바로 사용 가능합니다.

    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const table         = document.getElementById('tier-table');
    const container     = document.getElementById('tier-table-container');

    // 비교 모드 관련 DOM 요소
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare = document.getElementById('version-select-compare');
    const tierSelectCompare = document.getElementById('tier-select-compare');
    const periodSelectCompare = document.getElementById('period-select-compare');
    const compareModeLabel = document.getElementById('compare-mode-label');
    const compareCheckbox = document.getElementById('compare-checkbox'); // 비교 모드 체크박스 ID 변경


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
    // 툴팁에 표시할 전체 캐릭터 데이터 (setupTooltipPositioning에서 사용)
    // loadAndRender에서 로드된 데이터를 여기에 저장합니다.
    let currentCharacterData = [];
    let currentIsCompareMode = false;


    // 비교 모드 상태 변수 (초기 로드 시 URL 파라미터로 설정)
    let isCompareMode = params.get('compare') === '1';


    // 1) 설정 로드 & 드롭다운 초기화
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const config = parseINI(iniString); // parseINI는 common.js에서 가져옴
        tierConfigGlobal = config.tiers;

        // initDropdowns에 versionList 전달
        initDropdowns(versionList);
        loadAndRender();
    }).catch(err => {
        console.error('설정 로드 실패:', err);
        // 에러 시에도 팝업 버튼은 표시될 수 있으므로 팝업 설정 함수 호출
        setupTablePopup();
    });

    // 2) 드롭다운 초기화
    function initDropdowns(versionList) {
        // 현재 비교 모드 상태에 따라 body 클래스 업데이트
        if (isCompareMode) {
            document.body.classList.add('is-compare-mode');
        } else {
            document.body.classList.remove('is-compare-mode');
        }

        // 버전 (common.js 함수 사용)
        populateVersionDropdown(versionSelect, versionList);
        // 티어 (common.js 함수 사용)
        populateTierDropdown(tierSelect);
        // 구간 (common.js 함수 사용)
        populatePeriodDropdown(periodSelect);


        // 비교 드롭다운 및 UI 초기화
        // 비교 모드 체크박스 초기 상태 설정
        compareCheckbox.checked = isCompareMode;

        if (isCompareMode) {
             // 비교 드롭다운도 채우기 (common.js 함수 사용)
             populateVersionDropdown(versionSelectCompare, versionList);
             populateTierDropdown(tierSelectCompare);
             populatePeriodDropdown(periodSelectCompare);

             // 비교 모드 UI 표시
             comparisonControlsDiv.style.display = 'flex'; // 'table-row' 대신 'flex' 사용
             compareModeLabel.style.display = 'inline';

             // 색상 강조 체크박스 관련 로직 제거 (tier_table에는 해당 기능이 UI에 없음)

        } else {
             // 단일 모드 UI 숨김
             comparisonControlsDiv.style.display = 'none';
             compareModeLabel.style.display = 'none';

             // 색상 강조 체크박스 관련 로직 제거
        }


        // URL → 드롭다운 값 복원
        versionSelect.value = getParam('version', versionList.length > 0 ? versionList[0] : ''); // versionList가 비어있을 경우 대비
        tierSelect.value    = getParam('tier',    'diamond_plus');
        periodSelect.value  = getParam('period',  'latest');

        // 비교 드롭다운 URL 값 복원
        if (isCompareMode) {
             versionSelectCompare.value = getParam('version2', versionList.length > 0 ? versionList[0] : ''); // versionList가 비어있을 경우 대비
             tierSelectCompare.value    = getParam('tier2',    'diamond_plus');
             periodSelectCompare.value  = getParam('period2',  'latest');
        }


        // 변경 시 URL 갱신 + 재렌더
        versionSelect.addEventListener('change', () => {
            // 비교 모드 체크박스가 꺼져있으면 (단일 모드 상태로 변경됐으면) 비교 관련 파라미터 삭제
            if (!compareCheckbox.checked) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            setParam('version', versionSelect.value);
            loadAndRender();
        });
        tierSelect.addEventListener('change', () => {
            // 비교 모드 체크박스가 꺼져있으면 비교 관련 파라미터 삭제
            if (!compareCheckbox.checked) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            setParam('tier', tierSelect.value);
            loadAndRender();
        });
        periodSelect.addEventListener('change', () => {
            // 비교 모드 체크박스가 꺼져있으면 비교 관련 파라미터 삭제
            if (!compareCheckbox.checked) {
                 params.delete('version2');
                 params.delete('tier2');
                 params.delete('period2');
                 params.delete('compare');
            }
            setParam('period', periodSelect.value);
            loadAndRender();
        });

        // 비교 드롭다운 변경 이벤트 리스너
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

        // 비교 모드 체크박스 이벤트 리스너
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
    }

    // 3) 데이터 로드 & 렌더
    function loadAndRender() {
        // currentIsCompareMode 업데이트
        currentIsCompareMode = isCompareMode;

        if (isCompareMode) {
            const version1 = versionSelect.value;
            const tier1 = tierSelect.value;
            const period1 = periodSelect.value;

            const version2 = versionSelectCompare.value;
            const tier2 = tierSelectCompare.value;
            const period2 = periodSelectCompare.value;

            // 데이터 1과 데이터 2가 동일한 경우
            if (version1 === version2 && tier1 === tier2 && period1 === period2) {
                 table.innerHTML = '<tr><td colspan="15">데이터 1과 데이터 2가 동일합니다.</td></tr>'; // colspan 조정 필요
                 // 데이터 없을 시 툴팁 위치 설정 호출 (빈 데이터 전달)
                 currentCharacterData = []; // 데이터 비어있음
                 setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                 setupTablePopup(); // 팝업 설정
                 return;
            }

            // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
            const url1 = `/stats/${version1}/${tier1}.json`;
            const url2 = `/stats/${version2}/${tier2}.json`;
            // >>> 수정 끝

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
                const history1 = json1 ? json1['통계'] : null;
                const history2 = json2 ? json2['통계'] : null;

                // history1 또는 history2가 null이면 해당 데이터를 불러오지 못한 것임
                if (!history1 && !history2) {
                     table.innerHTML = '<tr><td colspan="15">두 데이터 모두 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                     currentCharacterData = [];
                     setupTooltipPositioning(currentCharacterData, currentIsCompareMode);
                     setupTablePopup();
                     return;
                }

                // common.js의 calculateFinalStatsForPeriod 함수를 사용하여 각 데이터셋의 최종 통계 계산
                // 이 함수가 period에 따라 누적 스냅샷 또는 기간 역산 데이터를 가져와 calculateTiers까지 수행합니다.
                // tierConfigGlobal는 초기화 시 로드된 것을 사용합니다.
                // history가 null이면 빈 배열을 전달하여 calculateFinalStatsForPeriod가 빈 결과를 반환하도록 합니다.
                const finalScoredData1 = history1 ? calculateFinalStatsForPeriod(history1, period1, tierConfigGlobal) : [];
                const finalScoredData2 = history2 ? calculateFinalStatsForPeriod(history2, period2, tierConfigGlobal) : [];

                // 두 최종 데이터셋을 병합 및 차이 계산 (common.js 함수 사용)
                // mergeDataForComparison는 이제 calculateFinalStatsForPeriod의 결과 두 개를 입력받습니다.
                const comparisonData = mergeDataForComparison(finalScoredData1, finalScoredData2);

                // currentCharacterData 업데이트 (툴팁에 사용될 데이터)
                currentCharacterData = comparisonData;

                // 병합 결과가 없으면 표시할 데이터가 없는 것임
                if (!comparisonData || comparisonData.length === 0) {
                    table.innerHTML = '<tr><td colspan="15">선택한 조건에 해당하는 비교 데이터가 없습니다.</td></tr>'; // colspan 조정 필요
                    setupTooltipPositioning(currentCharacterData, currentIsCompareMode);
                    setupTablePopup();
                    return;
                }

                // displayTierTable에 병합된 데이터와 비교 모드 플래그 전달
                displayTierTable(comparisonData, isCompareMode);
                setupTablePopup();
                // 툴팁 위치 설정 함수 호출 (데이터와 모드를 인자로 전달)
                setupTooltipPositioning(currentCharacterData, currentIsCompareMode);

            })
            .catch(err => {
                // Promise.all 내부에서 catch 했으므로 여기는 거의 오지 않음
                console.error('비교 데이터 처리 실패:', err);
                table.innerHTML = `<tr><td colspan="15">데이터 처리 중 오류가 발생했습니다: ${err.message}</td></tr>`; // colspan 조정 필요
                currentCharacterData = [];
                setupTooltipPositioning(currentCharacterData, currentIsCompareMode);
                setupTablePopup();
            });

        } else {
            // --- 단일 모드 로직 ---
            const version = versionSelect.value;
            const tier    = tierSelect.value;
            const period  = periodSelect.value;

            // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
            fetch(`/stats/${version}/${tier}.json`)
            // >>> 수정 끝
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const history = json['통계'];

                    // common.js에서 calculateFinalStatsForPeriod 함수를 사용하여 최종 데이터셋 계산
                    // 이 함수가 period에 따라 누적 스냅샷 또는 기간 역산 데이터를 가져와 calculateTiers까지 수행합니다.
                    // tierConfigGlobal는 초기화 시 로드된 것을 사용합니다.
                    const finalScoredData = calculateFinalStatsForPeriod(history, period, tierConfigGlobal);

                    // currentCharacterData 업데이트 (툴팁에 사용될 데이터)
                    currentCharacterData = finalScoredData;


                    // 데이터가 없는 경우 (calculateFinalStatsForPeriod 결과 빈 배열) 메시지 표시
                    if (!finalScoredData || finalScoredData.length === 0) {
                         table.innerHTML = '<tr><td colspan="15">선택한 기간에 해당하는 데이터가 부족하거나 없습니다.</td></tr>'; // colspan 조정 필요
                         setupTooltipPositioning(currentCharacterData, currentIsCompareMode);
                         setupTablePopup();
                         return;
                    }


                    // displayTierTable에 단일 데이터와 비교 모드 플래그 전달
                    displayTierTable(finalScoredData, isCompareMode);
                    setupTablePopup();
                    // ツールチップ位置 설정 함수 호출 (データとモードを引数で渡す)
                    setupTooltipPositioning(currentCharacterData, currentIsCompareMode);
                })
                .catch(err => {
                    console.error('데이터 로드 실패:', err);
                    table.innerHTML = '<tr><td colspan="15">데이터를 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                    currentCharacterData = [];
                    setupTooltipPositioning(currentCharacterData, currentIsCompareMode);
                    setupTablePopup();
                });
            // --------------------------
        }
    }

    // NOTE: 로컬 extractPeriodEntries 함수는 calculateFinalStatsForPeriod 등의 함수로 대체되어 제거되었습니다.


    // 5) 티어별 테이블 렌더링
    // data: calculateFinalStatsForPeriod 결과 (단일) 또는 mergeDataForComparison 결과 (비교)
    // isCompareMode: 현재 비교 모드 여부 플래그
    function displayTierTable(data, isCompareMode) {
        // common.js의 tierMap 사용
        const tierLabelsMapping = tierMap; // tierMap은 common.js에서 가져옴

        const versionLabel = versionSelect.value;
        const tierLabel    = tierLabelsMapping[tierSelect.value]; // common.js의 tierMap 사용

        const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
        const groups = tiers.reduce((o, t) => (o[t] = [], o), {});

        // 데이터 그룹화 로직 (비교 모드 고려)
        // data는 이미 calculateFinalStatsForPeriod 또는 mergeDataForComparison 결과입니다.
        // 단일 모드에서는 data[i].티어, 비교 모드에서는 data[i]['티어 (Ver1)']를 사용합니다.
        data.forEach(item => {
            const itemTier = isCompareMode ? item['티어 (Ver1)'] : item.티어;
            // 단일 모드 또는 비교 모드에서 Ver1 티어가 유효한 경우에만 그룹에 추가
            // Ver1에 없는 캐릭터 (신규, 티어 (Ver1)이 null/undefined)는 티어 테이블에 표시되지 않음 (기존 동작 유지)
            if (itemTier && groups[itemTier]) { // itemTier가 null/undefined가 아니고 해당 티어 그룹이 있는 경우
                 groups[itemTier].push(item);
            }
        });

        // 단일 모드: 현재 데이터의 표본수 합계 (주석 처리됨)
        // 비교 모드: 픽률은 개별 픽률 사용, 총 표본수는 필요 없음.

        const perRow      = 15;
        let html = '';

        tiers.forEach(tier => {
          // 시작 태그: <tr><th>...
          // 티어 라벨 색상은 CSS에서 nth-child로 처리됩니다.
          html += `<tr class="tier-row tier-${tier}"><th>${tier}</th>`;

          // <td> 시작 (첫 행이면 position:relative)
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
                         z-index: 5; /* 이미지보다 위에 */
                      ">${versionLabel} | ${tierLabel}</div><div>`; // white-space: nowrap 추가, z-index 추가
          } else {
            html += `<td><div>`;
          }

          // 슬롯들 렌더링
          // common.js의 sortData 함수 사용 (비교 모드 고려)
          // 단일 모드일 때는 '점수' 기준으로, 비교 모드일 때는 '점수 (Ver1)' 기준으로 내림차순 정렬
          const sortKey = isCompareMode ? '점수 (Ver1)' : '점수';
          const sortMode = isCompareMode ? 'value1' : 'value'; // 비교 모드일 때는 value1 모드로 정렬
          const entries = sortData(groups[tier], sortKey, false, sortMode); // false: 내림차순 (좋은 것 위로)


          if (entries.length === 0) {
            // 빈 슬롯 표시 (기존 이미지 사용)
            // 15개 모두 채워서 레이아웃 유지
             for (let i = 0; i < perRow; i++) {
                html += `<span class="tooltip-container">
                           <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0;">
                         </span>`;
             }

          } else {
            entries.forEach((e) => {
              const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');

              // 순위 변동 표시 요소
              let rankChangeOverlayHtml = '';
              if (isCompareMode) {
                   const rankChangeValue = e['순위 변화값']; // number 또는 string (mergeDataForComparison 결과)
                   let rankChangeText = '';
                   let rankChangeClass = '';

                   if (typeof rankChangeValue === 'number') {
                        const absChange = Math.abs(rankChangeValue);
                        if (rankChangeValue < 0) { rankChangeText = `▲${absChange}`; rankChangeClass = 'rank-change-up'; } // 순위 숫자 감소 (좋아짐)
                        else if (rankChangeValue > 0) { rankChangeText = `▼${absChange}`; rankChangeClass = 'rank-change-down'; } // 순위 숫자 증가 (나빠짐)
                        else { rankChangeText = `=`; rankChangeClass = 'rank-change-same'; }
                   } else { // string ('신규 → ', '→ 삭제', '-')
                       rankChangeText = rankChangeValue || '-';
                       if (rankChangeValue === '신규 → ') rankChangeClass = 'rank-change-up';
                       else if (rankChangeValue === '→ 삭제') rankChangeClass = 'rank-change-down';
                       else rankChangeClass = 'rank-change-same';
                   }

                   // rankChangeText가 빈 문자열이 아닌 경우에만 오버레이 HTML 생성
                   if (rankChangeText && rankChangeText !== '-') {
                       rankChangeOverlayHtml = `<div class="rank-change-overlay ${rankChangeClass}" data-text="${rankChangeText}">${rankChangeText}</div>`;
                   }
              }


              // 툴팁 컨테이너에 data-character-name 속성만 추가
              // 툴팁 내용은 JS에서 데이터를 찾아 동적으로 생성합니다.
              // 이미지 alt 속성은 그대로 사용합니다.
              html += `<span class="tooltip-container" data-character-name="${e.실험체}">
                         <img src="/image/tier_table/${imgName}.png" alt="${e.실험체}">
                         ${rankChangeOverlayHtml}
                       </span>`;
            });

            // perRow 개수 채우기 (기존 유지)
            const remainingSlots = perRow - (entries.length % perRow);
            if (remainingSlots > 0 && remainingSlots < perRow) {
                 for (let i = 0; i < remainingSlots; i++) {
                      html += `<span class="tooltip-container">
                                 <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0;">
                               </span>`;
                 }
            }
          }

          html += `</div></td></tr>`; // 유지
        });

        table.innerHTML = html; // 유지

        // 색상 강조 적용 로직 제거 (기존 유지)
    }

    // --- 추가: 툴팁 위치를 동적으로 계산하여 설정하는 함수 ---
    // 이 함수는 테이블이 렌더링된 후에 호출되며, 로드된 데이터와 비교 모드 상태를 인자로 받습니다.
    // characterData: calculateFinalStatsForPeriod 결과 (단일) 또는 mergeDataForComparison 결과 (비교)
    // isCompareMode: 현재 비교 모드 여부 플래그
    function setupTooltipPositioning(characterData, isCompareMode) {
        // 단 하나의 툴팁 요소를 관리합니다.
        let tooltipBox = document.getElementById('global-tooltip-box');
        if (!tooltipBox) {
            tooltipBox = document.createElement('div');
            tooltipBox.id = 'global-tooltip-box';
            tooltipBox.className = 'tooltip-box'; // 기존 CSS 스타일 재활용
            document.body.appendChild(tooltipBox);
        }

        // 툴팁 내용을 동적으로 찾기 위한 데이터 맵 생성
        // characterData가 빈 배열일 수도 있습니다.
        const characterDataMap = new Map((characterData || []).map(item => [item['실험체'], item]));

        // data-character-name 속성이 있는 컨테이너만 선택 (placeholder 제외)
        const tooltipContainers = table.querySelectorAll('.tooltip-container[data-character-name]');

        tooltipContainers.forEach(container => {
            // 기존 이벤트 리스너가 있다면 제거하고 다시 붙입니다 (재렌더링 시 필요)
             // 이 부분은 성능 최적화를 위해 이벤트 위임을 사용하는 것이 좋지만, 현재 구조 유지
             const oldHandler = container._tooltipHandler; // 이전에 저장된 핸들러
             if (oldHandler) {
                  container.removeEventListener('mouseover', oldHandler.over);
                  container.removeEventListener('mouseout', oldHandler.out);
             }

             const mouseoverHandler = () => {
                const characterName = container.dataset.characterName;
                const character = characterDataMap.get(characterName); // 캐릭터 데이터 찾기

                if (!character) {
                    // 데이터가 없으면 툴팁 표시 안함
                    tooltipBox.style.visibility = 'hidden';
                    tooltipBox.style.opacity = '0';
                    // ensure transitionend handler is not pending if it wasn't fully visible
                    tooltipBox.style.transition = 'none'; // Disable transition temporarily
                    tooltipBox.style.top = ''; tooltipBox.style.left = ''; tooltipBox.style.bottom = ''; tooltipBox.style.right = ''; tooltipBox.style.transform = ''; // Clear styles
                    // Re-enable transition after a brief moment
                    setTimeout(() => { tooltipBox.style.transition = ''; }, 10);
                    return;
                }

                // 툴팁 내용 동적 생성 (단일/비교 모드에 따라 다르게)
                let tooltipContent;
                // common.js의 calculateFinalStatsForPeriod 결과 또는 mergeDataForComparison 결과에서 값을 가져옵니다.
                // 이 값들은 이미 포맷팅되기 전의 숫자 또는 null/undefined입니다.
                // 여기서는 UI 표시용 포맷팅을 합니다.
                if (isCompareMode) {
                     // mergeDataForComparison 결과의 필드 사용
                     const pr1 = character['픽률 (Ver1)'];
                     const pr2 = character['픽률 (Ver2)'];
                     const rp1 = character['RP 획득 (Ver1)'];
                     const rp2 = character['RP 획득 (Ver2)'];
                     const win1 = character['승률 (Ver1)']; // 0-1 비율
                     const win2 = character['승률 (Ver2)']; // 0-1 비율

                     // 포맷팅
                     const pr1Text = typeof pr1 === 'number' ? pr1.toFixed(2) + '%' : '-';
                     const pr2Text = typeof pr2 === 'number' ? pr2.toFixed(2) + '%' : '-';
                     const rp1Text = typeof rp1 === 'number' ? rp1.toFixed(1) : '-';
                     const rp2Text = typeof rp2 === 'number' ? rp2.toFixed(1) : '-';
                     const win1Text = typeof win1 === 'number' ? (win1 * 100).toFixed(1) + '%' : '-'; // 0-1 비율을 %로
                     const win2Text = typeof win2 === 'number' ? (win2 * 100).toFixed(1) + '%' : '-'; // 0-1 비율을 %로

                     // 비교 모드 툴팁 내용 형식 (요청대로)
                     tooltipContent = `
                         <b>${character.실험체}</b><br>
                         픽률: ${pr2Text} → ${pr1Text}<br>
                         RP 획득: ${rp2Text} → ${rp1Text}<br>
                         승률: ${win2Text} → ${win1Text}
                     `;
                     // 픽률은 Data 2 → Data 1 (새로운 것 → 이전 것) 순서로 표시하는 것으로 보임.
                     // RP 획득, 승률도 마찬가지.
                     // Ver2 (최근) → Ver1 (이전) 형식으로 수정합니다.
                     tooltipContent = `
                         <b>${character.실험체}</b><br>
                         픽률: ${pr1Text} → ${pr2Text}<br>
                         RP 획득: ${rp1Text} → ${rp2Text}<br>
                         승률: ${win1Text} → ${win2Text}
                     `;

                } else {
                     // 단일 모드 툴팁 내용 형식 (요청대로)
                     // calculateFinalStatsForPeriod 결과의 필드 사용
                     const pickRate = character['픽률']; // 0-100%
                     const rp = character['RP 획득'];
                     const winRate = character['승률']; // 0-1 비율

                     // 포맷팅
                     const pickRateText = typeof pickRate === 'number' ? pickRate.toFixed(2) + '%' : '-';
                     const rpText = typeof rp === 'number' ? rp.toFixed(1) : '-';
                     const winRateText = typeof winRate === 'number' ? (winRate * 100).toFixed(1) + '%' : '-'; // 0-1 비율을 %로

                     tooltipContent = `
                         <b>${character.실험체}</b><br>
                         픽률: ${pickRateText}<br>
                         RP: ${rpText}<br>
                         승률: ${winRateText}
                     `;
                }

                tooltipBox.innerHTML = tooltipContent; // 툴팁 내용 설정

                // 툴팁을 보이게 하여 정확한 크기 계산 가능하도록 함
                tooltipBox.style.visibility = 'visible';
                tooltipBox.style.opacity = '1';
                 // 애니메이션을 위해 transition 속성이 있는지 확인 후 제거 (혹시 CSS에 기본값 있다면)
                 tooltipBox.style.transitionProperty = 'opacity'; // Only transition opacity


                // 툴팁의 현재 크기를 가져옴
                const tooltipRect = tooltipBox.getBoundingClientRect();


                // 툴팁이 이미지 위에 나타나도록 위치 계산 (position: fixed 기준)
                const containerRect = container.getBoundingClientRect();

                // 툴팁 하단이 컨테이너 상단에서 5px 위로 떨어지도록 계산
                // window.scrollY/scrollX를 더하여 페이지 스크롤 위치를 반영해야 정확한 fixed 위치 계산이 됩니다.
                const desiredTooltipTop = containerRect.top + window.scrollY - tooltipRect.height - 5;
                // 툴팁 중앙이 컨테이너 중앙에 오도록 위치 계산
                const desiredTooltipLeft = containerRect.left + window.scrollX + containerRect.width / 2 - tooltipRect.width / 2;


                // 계산된 위치를 툴팁 요소의 인라인 스타일로 적용
                tooltipBox.style.top = `${desiredTooltipTop}px`;
                tooltipBox.style.left = `${desiredTooltipLeft}px`;

                // 기존 CSS에서 bottom, right, transform은 제거했으므로 여기서 설정하지 않아도 됩니다.
                tooltipBox.style.bottom = 'auto';
                tooltipBox.style.right = 'auto';
                tooltipBox.style.transform = 'none'; // translateX(-50%) 무시


                // 툴팁이 뷰포트 좌우 상단 경계를 벗어나지 않도록 조정 (선택 사항)
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // 좌측 경계 조정
                if (parseFloat(tooltipBox.style.left) < window.scrollX + 5) { // 뷰포트 좌측에서 5px 이내로 붙으면
                    tooltipBox.style.left = `${window.scrollX + 5}px`;
                     // transform 리셋은 이미 위에서 함
                }
                // 우측 경계 조정
                if (parseFloat(tooltipBox.style.left) + tooltipRect.width > window.scrollX + viewportWidth - 5) { // 뷰포트 우측에서 5px 이내로 붙으면
                    tooltipBox.style.left = `${window.scrollX + viewportWidth - tooltipRect.width - 5}px`;
                     // transform 리셋은 이미 위에서 함
                }
                 // 상단 경계 조정 (툴팁이 뷰포트 맨 위에 붙는 경우 방지)
                 if (parseFloat(tooltipBox.style.top) < window.scrollY + 5) {
                      tooltipBox.style.top = `${window.scrollY + 5}px`;
                 }

            };

            const mouseoutHandler = () => {
                // 툴팁 숨김
                tooltipBox.style.opacity = '0';
                // CSS transition 시간(0.3s) 후에 완전히 숨기도록 visibility를 변경합니다.
                // transitionend 이벤트는 opacity가 0으로 되었을 때 발생합니다.
                // 이벤트 리스너를 한 번만 실행되도록 설정합니다.
                tooltipBox.addEventListener('transitionend', function handler() {
                     if (tooltipBox.style.opacity === '0') {
                          tooltipBox.style.visibility = 'hidden';
                          // 이벤트 리스너 제거는 once: true 옵션이 처리
                          // 위치 스타일 초기화는 mouseout 시작 시 바로 하는 것이 다음 mouseover 시 계산에 방해 안 됨.
                     }
                }, { once: true }); // once: true 옵션을 사용하여 한 번만 실행 후 자동 제거

                // 마우스 아웃 시 동적으로 설정된 위치 스타일을 제거하여 다음 마우스 오버 시 정확히 다시 계산되도록 합니다.
                 tooltipBox.style.top = '';
                 tooltipBox.style.left = '';
                 tooltipBox.style.bottom = ''; // 기본값 auto
                 tooltipBox.style.right = '';   // 기본값 auto
                 tooltipBox.style.transform = ''; // 기본값 none
            };

            container.addEventListener('mouseover', mouseoverHandler);
            container.addEventListener('mouseout', mouseoutHandler);

            // 핸들러를 요소에 저장하여 나중에 제거할 수 있도록 함
            container._tooltipHandler = { over: mouseoverHandler, out: mouseoutHandler };
        });

        // 테이블 내 툴팁 컨테이너가 아닌 다른 곳에 마우스 오버 시 툴팁 숨김
        // document.body에 마우스 오버 이벤트 리스너를 추가하고, target이 툴팁 컨테이너 내부인지 체크
        // 또는 테이블 컨테이너 자체에 leave 이벤트를 붙여서 테이블 밖으로 나가면 숨김
        // 현재는 mouseout 이벤트가 각 이미지에서 발생하여 툴팁을 숨기므로 추가적인 전역 리스너는 필요 없을 수 있습니다.
    }
    // -----------------------------------------------------


    // 6) 팝업 초기화 (기존 함수 유지)
    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImg = document.getElementById('popup-image');
        const popupTableButton = document.getElementById('popup-table-button');
        const targetTable = document.getElementById('tier-table'); // Use getElementById for clarity

        // 요소가 모두 존재하는지 확인
        if (!popupTableButton || !popup || !popupImg || !targetTable) {
             // console.error("Popup elements or target table not found."); // 디버그용
             // 버튼 자체는 DOMContentLoaded 시점에 존재하므로, 버튼에만 이벤트 리스너를 붙이는 것은 가능합니다.
             // 여기서는 테이블이 있는 경우에만 캡처 기능이 작동하도록 targetTable 체크를 유지합니다.
             // 버튼만 미리 활성화하려면 이 if문 밖으로 빼서 버튼 이벤트 리스너만 붙여야 합니다.
             // 현재 로직은 테이블이 있어야만 캡처가 의미있으므로 이대로 유지합니다.
             return;
        }

        // 기존 클릭 이벤트 리스너가 있다면 제거 (중복 부착 방지)
         if (popupTableButton.onclick) {
              popupTableButton.onclick = null;
         }

        // 버튼 활성화
        popupTableButton.style.display = 'block';


        popupTableButton.onclick = () => {
            // html2canvas는 head.html에서 로드됨
            html2canvas(targetTable, { // Use getElementById for clarity
                 backgroundColor: null // 배경 투명하게 캡처 (필요시)
            })
              .then(canvas => {
                popup.style.display = 'block';
                popupImg.src = canvas.toDataURL();
              });
          };

        // 팝업 닫기 버튼 이벤트 리스너
        const closeButton = popup.querySelector('.image-popup-close');
        if (closeButton) {
             // 기존 이벤트 리스너가 있다면 제거
             if (closeButton.onclick) {
                  closeButton.onclick = null;
             }
             closeButton.onclick = () => { popup.style.display = 'none'; };
        }

        // 팝업 외부 클릭 시 닫기 (선택 사항)
        // popup.onclick = (event) => {
        //     if (event.target === popup) {
        //         popup.style.display = 'none';
        //     }
        // };
    }

    // 7) 페이지 특화 헬퍼: 이름→이미지 변환 (기존 함수 유지)
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

    // NOTE: commonExtractPeriodEntries 변수 선언은 필요 없어 제거되었습니다.
    // 이제 script_common.js의 calculateFinalStatsForPeriod 등의 함수를 직접 사용합니다.

}); // DOMContentLoaded 끝