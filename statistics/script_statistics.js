//START OF FILE script_statistics.js
document.addEventListener('DOMContentLoaded', function() {
    // common.js에 정의된 함수/변수들은 전역 스코프에 있으므로 바로 사용 가능합니다.

    // DOM 요소
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');
    const dataContainer = document.getElementById('data-container');
    const compareModeLabel = document.getElementById('compare-mode-label');

    // 비교 모드 관련 요소
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare = document.getElementById('version-select-compare');
    const tierSelectCompare = document.getElementById('tier-select-compare');
    const periodSelectCompare = document.getElementById('period-select-compare');
    // compareCheckbox 변수 선언 (ReferenceError 해결)
    const compareCheckbox = document.getElementById('compare-checkbox');

    // 상태
    let currentSortColumn = '점수';
    let currentSortAsc = false;
    let currentSortMode = 'value'; // 'value' (단일), 'value1', 'value2', 'delta'
    let lastData = []; // 로드된 원본 데이터 또는 병합된 비교 데이터 (getProcessedStatsForPeriod 또는 mergeDataForComparison 결과)
    let tierConfig = null; // config.ini에서 로드된 티어 설정
    let versionList = []; // versions.json에서 로드된 버전 목록 (Promise.all 내부에서 할당)


    // 9) 단일 모드용 정렬 이벤트 리스너 부착
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            // data-nosort 속성이 있다면 정렬 제외 (실험체 컬럼)
            if (th.hasAttribute('data-nosort')) {
                 th.style.cursor = 'default';
                 th.setAttribute('data-arrow', '');
                 th.classList.remove('delta-sort-indicator');
                 th.onclick = null; // 기존 클릭 이벤트 제거
                 return; // 정렬 제외 컬럼
            }

            th.style.cursor = 'pointer'; // 정렬 가능 컬럼

            // 기존 이벤트 리스너가 있다면 제거 (중복 부착 방지)
            if (th.onclick) {
                 th.onclick = null;
            }

            th.setAttribute('data-arrow', ''); // 기존 화살표 리셋
            th.classList.remove('delta-sort-indicator'); // 델타 정렬 표시자 클래스 리셋

            // 현재 정렬 기준과 일치하면 화살표 표시
            if (currentSortColumn === col && currentSortMode === 'value') {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            th.onclick = () => {
                // 단일 모드는 value 오름/내림차 순환만
                if (currentSortColumn === col) {
                     currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    // 기본 정렬 방향 설정 (평균 순위는 오름차순, 나머지는 내림차순)
                    const isBetterWhenLower = (col === '평균 순위');
                    currentSortAsc = isBetterWhenLower ? true : false; // 평균 순위는 오름차순(작은 값 위로), 나머지는 내림차순(큰 값 위로)

                    // 티어 컬럼의 기본 정렬 방향: 점수 기준으로 정렬되며, 점수는 클수록 좋으므로 기본 내림차순(false)이 맞습니다.
                    if (col === '티어') currentSortAsc = false;

                    currentSortMode = 'value'; // 단일 모드는 value 고정
                }
                // sortData 함수는 common.js에 정의되어 있습니다.
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode);
                renderFunc(sortedData); // renderTable 호출
            };
        });
    }

    // 10) 비교 모드 테이블 헤더에 정렬 이벤트 리스너 부착
    function attachComparisonSortEventListeners(ths, renderFunc) {
        ths.forEach(th => {
            const col = th.dataset.col;

            // 실험체 컬럼은 비교 모드에서 정렬 제외
            if (col === '실험체') {
                th.style.cursor = 'default';
                th.setAttribute('data-arrow', '');
                th.classList.remove('delta-sort-indicator'); // 혹시 모를 클래스 제거
                th.setAttribute('data-nosort', 'true'); // 정렬 불가 명시
                th.onclick = null; // 기존 클릭 이벤트 제거
                return;
            }
             th.style.cursor = 'pointer';

            // 기존 이벤트 리스너가 있다면 제거 (중복 부착 방지)
            if (th.onclick) {
                 th.onclick = null;
            }

            th.setAttribute('data-arrow', ''); // 기존 화살표 리셋
            th.classList.remove('delta-sort-indicator'); // 델타 정렬 표시자 클래스 리셋


            // 현재 정렬 기준과 일치하면 화살표 및 기호 표시
            if (currentSortColumn === col) {
                let arrow = '';
                if (currentSortMode === 'value1') {
                    arrow = currentSortAsc ? '1▲' : '1▼'; // Ver1 기준 오름/내림차순 기호
                } else if (currentSortMode === 'value2') {
                    arrow = currentSortAsc ? '2▲' : '2▼'; // Ver2 기준 오름/내림차순 기호
                } else if (currentSortMode === 'delta') {
                      arrow = currentSortAsc ? 'Δ▲' : 'Δ▼';
                      // 델타 정렬일 경우 헤더에 델타 표시 클래스 추가
                      th.classList.add('delta-sort-indicator');
                }
                th.setAttribute('data-arrow', arrow); // 헤더의 data-arrow 속성에 설정
            }

            // 클릭 이벤트 리스너 추가
            th.onclick = () => {
                // 정렬 순환: Value1 ▼ -> Value1 ▲ -> Value2 ▼ -> Value2 ▲ -> Delta ▼ -> Delta ▲ -> Value1 ▼ ...
                const modes = ['value1', 'value1', 'value2', 'value2', 'delta', 'delta']; // 6단계 순환 모드
                const directions = [false, true, false, true, false, true]; // 각 단계의 오름차순 여부 (false: 내림차순, true: 오름차순)

                let currentCycleIndex = -1;
                // 현재 상태에 해당하는 순환 단계 찾기
                for(let i = 0; i < modes.length; i++) {
                    // 현재 컬럼이 정렬 기준 컬럼이고, 현재 모드와 방향이 순환 단계와 일치하는 경우
                    if(currentSortColumn === col && currentSortMode === modes[i] && currentSortAsc === directions[i]) {
                        currentCycleIndex = i;
                        break;
                    }
                }

                let nextMode, nextAsc;

                if (currentCycleIndex !== -1) {
                    // 같은 컬럼을 다시 클릭한 경우, 순환의 다음 단계로 이동
                    let nextCycleIndex = (currentCycleIndex + 1) % modes.length;
                    nextMode = modes[nextCycleIndex];
                    nextAsc = directions[nextCycleIndex];

                } else {
                    // 다른 컬럼을 처음 클릭한 경우, 해당 컬럼의 Value1 내림차순 정렬로 시작
                    currentSortColumn = col; // 정렬 기준 컬럼을 클릭된 컬럼으로 변경
                    nextMode = 'value1'; // 다음 모드는 Value1
                    // 기본 정렬 방향 설정 (평균 순위는 오름차순, 나머지는 내림차순)
                    const isBetterWhenLower = (col === '평균 순위');
                    nextAsc = isBetterWhenLower ? true : false; // 평균 순위는 오름차순(작은 값 위로), 나머지는 내림차순(큰 값 위로)

                    // 예외 처리: 티어는 Value1 내림차순 시작 (S+ 위로)
                    // common.js sortData에서 '티어' Value1/Value2 정렬 시 '점수 (VerX)' 키를 사용하고, 점수는 클수록 좋음으로 처리합니다.
                    // 따라서 '점수 (VerX)' 기준 내림차순 (asc=false)일 때 S+가 위로 옵니다.
                    // 그래서 '티어' 컬럼 클릭 시 Value1 내림차순으로 시작하는 것이 맞습니다.
                    if (col === '티어') nextAsc = false;
                }

                currentSortMode = nextMode; // 현재 정렬 모드 업데이트
                currentSortAsc = nextAsc; // 현재 정렬 방향 업데이트

                // 업데이트된 정렬 상태를 바탕으로 데이터 정렬 및 테이블 다시 렌더링
                // sortData 함수는 common.js에 정의되어 있습니다.
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // common.js의 sortData 함수 호출
                renderFunc(sortedData); // 테이블 렌더링 함수 호출 (renderComparisonTable)

                // URL 업데이트 (정렬 상태 포함)
                updateURL();

                // 화살표 및 델타 표시자는 renderFunc 호출 시 applyGradientColorsComparison 함수에 의해 업데이트됨
            };
        });
    }


    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    let isCompareMode = params.get('compare') === '1'; // isCompareMode 변수를 let으로 선언하여 변경 가능하게 함

    // 현재 모드에 따라 body 클래스 추가/제거
    if (isCompareMode) {
        document.body.classList.add('is-compare-mode');
    } else {
        document.body.classList.remove('is-compare-mode');
    }


    // 1) URL 파라미터 → 컨트롤에 반영
    // 이 함수는 versionList가 로드된 후에 호출되어야 합니다.
    function applyParamsToControls() {
        if (params.has('version')) versionSelect.value = params.get('version');
        if (params.has('tier')) tierSelect.value = params.get('tier');
        if (params.has('period')) periodSelect.value = params.get('period');

        // 색상 강조 체크박스 상태 로드 (비교 모드가 아닐 때만)
        if (!isCompareMode) {
            if (params.has('gradient')) {
                 gradientCheckbox.checked = params.get('gradient') === '1';
            } else {
                 // 단일 모드 기본값: 색상 강조 켜짐
                 gradientCheckbox.checked = true;
            }
            gradientCheckbox.disabled = false;
            gradientCheckbox.parentElement.style.opacity = '1';
        } else {
             // 비교 모드에서는 색상 강조 항상 켜짐 및 비활성화
             gradientCheckbox.checked = true;
             gradientCheckbox.disabled = true;
             gradientCheckbox.parentElement.style.opacity = '0.5';
        }

        // 비교 모드 체크박스 상태 설정
        compareCheckbox.checked = isCompareMode;

        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex';
            compareModeLabel.style.display = 'inline';

            // 비교 드롭다운 값 설정
            if (params.has('version2')) versionSelectCompare.value = params.get('version2');
            if (params.has('tier2')) tierSelectCompare.value = params.get('tier2');
            if (params.has('period2')) periodSelectCompare.value = params.get('period2');


            // URL에서 정렬 상태 복원 시도 (비교 모드에서만)
            if (params.has('sortCol') && params.has('sortAsc') && params.has('sortMode')) {
                 currentSortColumn = params.get('sortCol');
                 currentSortAsc = params.get('sortAsc') === 'true';
                 currentSortMode = params.get('sortMode');
            } else {
                // URL 파라미터 없으면 비교 모드 기본 정렬 (점수 Ver1 내림차순)
                currentSortColumn = '점수';
                currentSortAsc = false;
                currentSortMode = 'value1'; // 기본은 value1 (데이터 1 기준)
            }

        } else {
            // 단일 모드 기본 정렬 (점수 내림차순)
            currentSortColumn = '점수';
            currentSortAsc = false;
            currentSortMode = 'value';
        }
    }

    // 2) 컨트롤 상태 → URL에 반영 (정렬 상태 저장 추가)
    function updateURL() {
        params.set('version', versionSelect.value);
        params.set('tier', tierSelect.value);
        params.set('period', periodSelect.value);

        if (!isCompareMode) {
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            // 비교 모드 관련 파라미터 제거
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
            // 정렬 상태 파라미터도 제거 (단일 모드는 URL에 저장 안 함)
            params.delete('sortCol');
            params.delete('sortAsc');
            params.delete('sortMode');

        } else {
            // 비교 모드 관련 파라미터 저장
            params.set('version2', versionSelectCompare.value);
            params.set('tier2', tierSelectCompare.value);
            params.set('period2', periodSelectCompare.value);
            params.set('compare', '1');
            // gradient 파라미터 제거
            params.delete('gradient');

            // 비교 모드에서는 정렬 상태 URL 저장
            params.set('sortCol', currentSortColumn);
            params.set('sortAsc', currentSortAsc);
            params.set('sortMode', currentSortMode);
        }

        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, loadedVersionList]) => {
        // 데이터 로드 성공 후 versionList와 tierConfig 설정
        versionList = loadedVersionList; // 전역 versionList에 할당
        const config = parseINI(iniText); // parseINI는 common.js에 정의됨
        tierConfig = config.tiers;

        // common.js 에 정의된 함수들로 드롭다운 채우기
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // 비교 모드일 때 비교 드롭다운 채우기
        populateVersionDropdown(versionSelectCompare, versionList);
        populateTierDropdown(tierSelectCompare);
        populatePeriodDropdown(periodSelectCompare);


        // URL 파라미터로부터 컨트롤 상태 복원 (versionList 로드 후 호출)
        applyParamsToControls();

        // 드롭다운 변경 시 현재 모드에 따라 데이터 갱신
        versionSelect.addEventListener('change', () => { updateURL(); isCompareMode ? loadAndDisplayComparison() : loadAndDisplaySingle(); });
        tierSelect.addEventListener('change', () => { updateURL(); isCompareMode ? loadAndDisplayComparison() : loadAndDisplaySingle(); });
        periodSelect.addEventListener('change', () => { updateURL(); isCompareMode ? loadAndDisplayComparison() : loadAndDisplaySingle(); });

        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            // 단일 모드에서만 색상 강조 적용/해제
            if (!isCompareMode && lastData && lastData.length > 0) {
                // applyGradientColorsSingle 함수는 common.js에 정의됨
                 applyGradientColorsSingle(dataContainer.querySelector('table'));
            }
            // 비교 모드는 renderComparisonTable에서 항상 색상 적용하므로 여기서는 단일 모드만 처리
        });

        // 비교 모드 드롭다운 이벤트 리스너 (비교 모드일 때만 실제 데이터 로드 함수 호출)
        versionSelectCompare.addEventListener('change', () => { updateURL(); loadAndDisplayComparison(); });
        tierSelectCompare.addEventListener('change', () => { updateURL(); loadAndDisplayComparison(); });
        periodSelectCompare.addEventListener('change', () => { updateURL(); loadAndDisplayComparison(); });


        // 최초 로드 (초기 isCompareMode 값에 따라 호출)
        if (isCompareMode) {
             loadAndDisplayComparison();
        } else {
             loadAndDisplaySingle();
        }

        // setupTablePopup은 render 함수들 안에서 호출되므로 여기서 호출할 필요 없음.

    }).catch(err => {
        console.error('초기 설정 로드 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
        // 팝업 기능도 설정하여 에러 메시지 캡처 가능하도록 함 (빈 테이블 상태에서도 버튼은 표시되므로)
        setupTablePopup();
    }); // Promise.all 체인의 끝


    // 비교 모드 체크박스 이벤트 리스너 (Promise.all 체인 밖으로 이동)
    compareCheckbox.addEventListener('change', function() {
        isCompareMode = this.checked; // isCompareMode 변수 업데이트

        // 비교 모드 UI 표시/숨김
        comparisonControlsDiv.style.display = isCompareMode ? 'flex' : 'none';
        compareModeLabel.style.display = isCompareMode ? 'inline' : 'none';

        // body 클래스 추가/제거 (CSS 제어용)
        if (isCompareMode) {
            document.body.classList.add('is-compare-mode');
        } else {
            document.body.classList.remove('is-compare-mode');
        }

        // 색상 강조 체크박스 상태 제어
        if (isCompareMode) {
            gradientCheckbox.checked = true; // 비교 모드는 항상 색상 강조 켜짐
            gradientCheckbox.disabled = true;
            gradientCheckbox.parentElement.style.opacity = '0.5';
        } else {
            // 단일 모드로 돌아갈 때, URL 파라미터 또는 기본값으로 복원
            const params = new URLSearchParams(location.search); // URL 상태를 다시 읽어옴
            if (params.has('gradient')) {
                 gradientCheckbox.checked = params.get('gradient') === '1';
            } else {
                 // 단일 모드 기본값: 색상 강조 켜짐 (applyParamsToControls와 일관성 유지)
                 gradientCheckbox.checked = true;
            }
            gradientCheckbox.disabled = false;
            gradientCheckbox.parentElement.style.opacity = '1';
        }

        // 정렬 상태 초기화 (모드에 따른 기본 정렬)
        if (isCompareMode) {
             // 비교 모드 기본 정렬: 점수 (Ver1) 내림차순
             currentSortColumn = '점수';
             currentSortAsc = false;
             currentSortMode = 'value1'; // 기본은 value1 (데이터 1 기준)
        } else {
             // 단일 모드 기본 정렬: 점수 내림차순
             currentSortColumn = '점수';
             currentSortAsc = false;
             currentSortMode = 'value';
        }

        // URL 갱신 (데이터 로드 전에 호출하여 정확한 상태 반영)
        updateURL();

        // 모드에 따라 적절한 데이터 로드/표시 함수 호출
        if (isCompareMode) {
            loadAndDisplayComparison();
        } else {
            loadAndDisplaySingle();
        }
    });


    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더
        function loadAndDisplaySingle() {
            if (isCompareMode) return; // 비교 모드에서는 실행되지 않음

            dataContainer.innerHTML = '데이터 로딩 중...';
            const version = versionSelect.value;
            const tier = tierSelect.value;
            const period = periodSelect.value;

            // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
            fetch(`/stats/${version}/${tier}.json`)
            // >>> 수정 끝
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const history = json['통계'];

                    // common.js에서 getProcessedStatsForPeriod 함수를 사용하여 최종 데이터셋 계산
                    // 이 함수가 period에 따라 누적 스냅샷 또는 기간 역산 데이터를 가져와 calculateTiers까지 수행합니다.
                    // tierConfig는 초기화 시 로드된 것을 사용합니다.
                    // getProcessedStatsForPeriod 결과의 승률/TOP3/픽률은 0-1 스케일입니다.
                    const processedData = getProcessedStatsForPeriod(history, period, tierConfig); // common.js 함수

                    // 데이터가 없는 경우 (getProcessedStatsForPeriod 결과 빈 배열) 메시지 표시
                    if (!processedData || processedData.length === 0) {
                         dataContainer.innerHTML = '선택한 기간에 해당하는 데이터가 부족하거나 없습니다.';
                         lastData = []; // lastData 비워주기
                         setupTablePopup(); // 팝업 설정
                         return;
                    }

                    // 최종 계산된 데이터에 대해 정렬만 수행
                    currentSortMode = 'value'; // 단일 모드는 value 고정
                    const sortedData = sortData(processedData, currentSortColumn, currentSortAsc, currentSortMode);

                    lastData = sortedData; // 정렬된 데이터를 lastData에 저장
                    renderTable(sortedData); // 단일 모드 렌더링

                    // 팝업 설정 함수 호출 (렌더링 완료 후)
                    setupTablePopup();

                })
                .catch(err => {
                    console.error('데이터 로드 실패:', err);
                    dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
                    // 팝업 설정 (에러 메시지 표시 후에도 이미지 캡처 버튼이 있다면 작동하도록)
                    setupTablePopup();
                });
        }

        // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더
        function loadAndDisplayComparison() {
            if (!isCompareMode) return; // 단일 모드에서는 실행되지 않음

            dataContainer.innerHTML = '비교 데이터 로딩 중...';
            const version1 = versionSelect.value;
            const tier1 = tierSelect.value;
            const period1 = periodSelect.value;

            const version2 = versionSelectCompare.value;
            const tier2 = tierSelectCompare.value;
            const period2 = periodSelectCompare.value;

            if (version1 === version2 && tier1 === tier2 && period1 === period2) {
                dataContainer.innerHTML = '데이터 1과 데이터 2가 동일합니다.';
                lastData = [];
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
                // fetch 실패 시 json1/json2가 null일 수 있습니다.
                const history1 = json1 ? json1['통계'] : null;
                const history2 = json2 ? json2['통계'] : null;

                if (!history1 && !history2) {
                     dataContainer.innerHTML = '두 데이터 모두 불러오는 데 실패했습니다.';
                     lastData = [];
                     setupTablePopup(); // 팝업 설정
                     return;
                }

                // common.js의 getProcessedStatsForPeriod 함수를 사용하여 각 데이터셋의 최종 통계 계산
                // 이 함수가 period에 따라 누적 스냅샷 또는 기간 역산 데이터를 가져와 calculateTiers까지 수행합니다.
                // tierConfig는 공통으로 사용합니다.
                // getProcessedStatsForPeriod 결과의 승률/TOP3/픽률은 0-1 스케일입니다.
                // history가 null이면 빈 배열을 전달하여 getProcessedStatsForPeriod가 빈 결과를 반환하도록 합니다.
                const processedData1 = getProcessedStatsForPeriod(history1, period1, tierConfig); // common.js 함수
                const processedData2 = getProcessedStatsForPeriod(history2, period2, tierConfig); // common.js 함수


                // 두 최종 데이터셋을 병합 및 차이 계산 (common.js 함수 사용)
                // mergeDataForComparison는 이제 getProcessedStatsForPeriod의 결과 두 개를 입력받습니다.
                // mergeDataForComparison 결과의 승률/TOP3/픽률은 0-1 스케일입니다.
                const comparisonData = mergeDataForComparison(processedData1, processedData2); // common.js 함수

                // 병합 결과가 없으면 표시할 데이터가 없는 것임 (어떤 캐릭터도 양쪽 또는 한쪽에 존재하지 않음)
                if (!comparisonData || comparisonData.length === 0) {
                    dataContainer.innerHTML = '선택한 조건에 해당하는 비교 데이터가 없습니다.';
                    lastData = [];
                    setupTablePopup(); // 팝업 설정
                    return;
                }

                // 정렬 (비교 모드에서는 병합된 데이터를 정렬)
                const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc, currentSortMode); // common.js 함수

                lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장
                renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링

                // 팝업 설정 함수 호출 (렌더링 완료 후)
                setupTablePopup();

            })
            .catch(err => {
                // Promise.all 내부에서 catch 했으므로 여기는 거의 오지 않음
                console.error('비교 데이터 처리 실패:', err);
                dataContainer.innerHTML = `데이터 처리 중 오류가 발생했습니다: ${err.message}`;
                setupTablePopup(); // 팝업 설정
            });
        }

    // 표 이미지 팝업 기능 설정 함수
    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImg = document.getElementById('popup-image');
        const popupTableButton = document.getElementById('popup-table-button');
        const targetTable = dataContainer.querySelector('table'); // dataContainer 내의 테이블 탐색

        // 요소가 모두 존재하는지 확인
        if (!popupTableButton || !popup || !popupImg) {
             // 팝업 관련 기본 요소 없으면 버튼 비활성화
             if (popupTableButton) popupTableButton.style.display = 'none';
             return;
        }

        // 테이블이 로드되었는지 확인
        if (!targetTable) {
             // 테이블 없으면 버튼 숨김 (CSS로 제어될 수도 있지만 JS로 안전하게)
             popupTableButton.style.display = 'none';
             return;
        }

        // 기존 클릭 이벤트 리스너가 있다면 제거 (중복 부착 방지)
         if (popupTableButton.onclick) {
              popupTableButton.onclick = null;
         }

        // 버튼 활성화
        popupTableButton.style.display = 'block';


        popupTableButton.onclick = () => {
             // 통계 페이지의 테이블 (#data-container 내의 table)을 캡처 대상으로 지정
             html2canvas(targetTable, {
                  backgroundColor: null // 배경 투명하게 캡처 (필요시)
             })
               .then(canvas => {
                 popup.style.display = 'block';
                 popupImg.src = canvas.toDataURL();
               })
               .catch(err => {
                   console.error("테이블 이미지 캡처 실패:", err);
                   // 캡처 실패 시 사용자에게 알림 가능
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
    }

// 7) 비교 테이블 렌더링
// data: 정렬된 비교 데이터 배열 (mergeDataForComparison 결과)
function renderComparisonTable(data) {
    if (!isCompareMode) return;

    // 기존 테이블 컬럼 목록 (UI에 표시되는 순서 및 컬럼)
    const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위']; // 표본수 제거된 UI 컬럼 목록

    let comparisonTableHtml = '<table id="stats-table"><thead><tr>'; // 테이블 ID 추가
    cols.forEach(c => {
        // 실험체 컬럼은 비교 모드에서 정렬 제외 유지
        const sortable = c !== '실험체';

        // data-col 속성은 그대로 사용
        comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
    });
    comparisonTableHtml += '</tr></thead><tbody>';

    // data는 mergeDataForComparison 결과입니다.
    // mergeDataForComparison 결과의 '승률', 'TOP 3', '픽률'은 0-1 스케일, 나머지는 값 그대로입니다.
    data.forEach(row => {
        comparisonTableHtml += '<tr>';
        cols.forEach(col => {
            let displayVal = '-';
            let dataAttributes = ''; // data-delta, data-rankdelta 등을 저장할 문자열

            if (col === '실험체') {
                displayVal = row['실험체'] || '-';

                // 순위 변화 색상 강조를 위한 data 속성은 실험체 열에 붙입니다.
                    const rankChangeValue = row['순위 변화값']; // number 또는 string (mergeDataForComparison 결과)
                    if (typeof rankChangeValue === 'number') {
                        dataAttributes += ` data-rankdelta="${rankChangeValue}"`;
                    } else if (rankChangeValue === '신규 → ') {
                        dataAttributes += ` data-rankdelta="new"`;
                    } else if (rankChangeValue === '→ 삭제') {
                        dataAttributes += ` data-rankdelta="removed"`;
                    } else {
                        dataAttributes += ` data-rankdelta="none"`;
                    }

            } else if (col === '티어') {
                // 티어 컬럼에는 티어 변화 정보와 순위 정보 표시
                // row['티어 변화']는 이미 mergeDataForComparison에서 'A → B', '신규 → S', '→ 삭제' 등으로 계산됨
                const tierChangeText = row['티어 변화'] || '-'; // string (예: "A → B", "신규 → S+", "→ 삭제", "S", "-")
                const rank1 = row['순위 (Ver1)'] !== null && row['순위 (Ver1)'] !== undefined ? row['순위 (Ver1)'] : '-'; // number 또는 null -> 표시용 '-'
                const rank2 = row['순위 (Ver2)'] !== null && row['순위 (Ver2)'] !== undefined ? row['순위 (Ver2)'] : '-'; // number 또는 null -> 표시용 '-'
                const rankChangeValue = row['순위 변화값']; // number or string (from mergeDataForComparison)

                let rankInfoText = '';
                    // 순위 정보 텍스트 생성
                    if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                         // 순위 변화값은 number이므로 그대로 사용
                         const rankChangeAbs = Math.abs(rankChangeValue);
                         // 순위 숫자가 작아지면 개선 (▲), 커지면 악화 (▼)
                         rankInfoText = `${rank1}위 → ${rank2}위 ${rankChangeValue < 0 ? `▲${rankChangeAbs}` : (rankChangeValue > 0 ? `▼${rankChangeAbs}` : '')}`;
                     } else if (rankChangeValue === '신규 → ') { // Ver2에만 있음
                         rankInfoText = `(신규)`;
                     } else if (rankChangeValue === '→ 삭제') { // Ver1에만 있음
                         rankInfoText = `(삭제)`;
                     } else if (rank1 !== '-') { // Ver1에만 데이터 있고 Ver2에 명시적으로 없음 (null/undefined)
                         rankInfoText = `${rank1}위 → -`;
                     } else if (rank2 !== '-') { // Ver2에만 데이터 있고 Ver1에 명시적으로 없음 (null/undefined)
                         rankInfoText = `- → ${rank2}위`;
                     } else { // 둘 다 없음
                         rankInfoText = '-';
                     }


                // Construct the final cell HTML with spans wrapped in a div
                let innerContentHtml = '';

                // Tier Change / Tier Value
                if (tierChangeText !== '-') {
                     innerContentHtml += `<span class="tier-value-or-change">${tierChangeText}</span>`;
                } else {
                     // 티어 변화 정보가 없으면 빈 스팬 또는 '-' 표시 스팬 추가 (레이아웃 유지를 위해)
                     innerContentHtml += `<span class="tier-value-or-change">-</span>`;
                }

                // Rank Info
                if (rankInfoText !== '-') { // Only add rank info span if there's rank info
                     innerContentHtml += `<span class="rank-info">${rankInfoText}</span>`;
                }

                // Wrap the content in a div, but only if there's actual content
                if (tierChangeText === '-' && rankInfoText === '-') {
                     displayVal = '-'; // No content at all
                } else {
                     displayVal = `<div class="cell-content-wrapper">${innerContentHtml}</div>`;
                }


                // 티어 변화 색상 강조를 위한 data 속성 (CSS에서 사용되지 않더라도 JS에서 필요할 수 있음)
                // 이 속성들은 이전 상태 그대로 유지합니다.
                // JS의 applyGradientColorsComparison는 티어 컬럼의 배경색을 순위 변화값(number) 기준으로 칠합니다.
                // data-tierchange 속성은 CSS에서 특정 문자열 상태 (신규/삭제/상승/하락/동일)에 따라 색칠하는 데 사용될 수 있습니다.
                const tier1 = row['티어 (Ver1)'] !== undefined && row['티어 (Ver1)'] !== null ? row['티어 (Ver1)'] : '없음'; // null/undefined 대신 '없음' 상태 구분
                const tier2 = row['티어 (Ver2)'] !== undefined && row['티어 (Ver2)'] !== null ? row['티어 (Ver2)'] : '없음'; // null/undefined 대신 '없음' 상태 구분
                const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];

                if (tier1 === '없음' && tier2 !== '없음') { // 신규
                    dataAttributes += ` data-tierchange="new"`;
                } else if (tier1 !== '없음' && tier2 === '없음') { // 삭제
                    dataAttributes += ` data-tierchange="removed"`;
                } else if (tier1 !== '없음' && tier2 !== '없음') {
                    const index1 = tierOrder.indexOf(tier1);
                    const index2 = tierOrder.indexOf(tier2);
                    if (index1 >= 0 && index2 >= 0) {
                         if (index2 < index1) dataAttributes += ` data-tierchange="up"`; // 개선 (티어 숫자가 작아짐)
                         else if (index2 > index1) dataAttributes += ` data-tierchange="down"`; // 악화 (티어 숫자가 커짐)
                         else dataAttributes += ` data-tierchange="same"`; // 동일
                    } else { // 예상치 못한 티어 문자열이 있는 경우
                         dataAttributes += ` data-tierchange="unknown"`;
                    }
                } else { // 둘 다 없음
                    dataAttributes += ` data-tierchange="none"`;
                }

            } else { // Other numeric stat columns
                    const val1 = row[`${col} (Ver1)`]; // getProcessedStatsForPeriod 결과의 해당 값 (승률/TOP3/픽률 0-1, 나머지는 값 그대로)
                    const val2 = row[`${col} (Ver2)`]; // getProcessedStatsForPeriod 결과의 해당 값 (승률/TOP3/픽률 0-1, 나머지는 값 그대로)
                    const delta = row[`${col} 변화량`]; // Numeric delta value from mergeDataForComparison

                    // Display Ver1 value → Ver2 value Delta format
                    let valueText1;
                    if (typeof val1 === 'number') {
                        // 승률, TOP 3, 픽률은 0-1 스케일이므로 100을 곱하고 % 추가하여 표시
                        if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                            valueText1 = (val1 * 100).toFixed(2) + '%';
                        } else { // 점수, RP 획득, 평균 순위, 표본수 (값 그대로)
                            valueText1 = val1.toFixed(2); // 소수점 둘째 자리까지
                        }
                    } else {
                        valueText1 = '-';
                    }

                    let valueText2;
                    if (typeof val2 === 'number') {
                         // 승률, TOP 3, 픽률은 0-1 스케일이므로 100을 곱하고 % 추가하여 표시
                         if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                             valueText2 = (val2 * 100).toFixed(2) + '%';
                         } else { // 점수, RP 획득, 평균 순위, 표본수 (값 그대로)
                             valueText2 = val2.toFixed(2); // 소수점 둘째 자리까지
                         }
                    } else {
                        valueText2 = '-';
                    }


                    let verValuesHtml;
                    let deltaHtml = '';

                    // 값 변화 텍스트 (Value1 → Value2)
                    if (typeof val1 === 'number' || typeof val2 === 'number') { // 둘 중 하나라도 숫자가 있는 경우
                         verValuesHtml = `${valueText1} → ${valueText2}`;
                    } else { // 둘 다 숫자가 아닌 경우
                         verValuesHtml = '-';
                    }

                    // 변화량 텍스트
                    if (typeof delta === 'number') {
                         // 승률, TOP 3, 픽률 변화량은 0-1 스케일이므로 100을 곱하고 %는 붙이지 않음
                         let deltaValueForFormatting = delta;
                         if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                             deltaValueForFormatting = delta * 100; // 100 곱함
                         }
                         const deltaFormatted = deltaValueForFormatting.toFixed(2); // 소수점 둘째 자리까지 표시 (부호 포함)
                         // 부호가 있으면 ▲/▼ 기호와 함께, 없으면 빈 문자열. 0인 경우 '-' 표시.
                         deltaHtml = `${parseFloat(deltaFormatted) > 0 ? `▲${Math.abs(parseFloat(deltaFormatted))}` : (parseFloat(deltaFormatted) < 0 ? `▼${Math.abs(parseFloat(deltaFormatted))}` : '-')}`;
                    } else if (verValuesHtml.includes('신규 →') || verValuesHtml.includes('→ 삭제')) {
                         // 신규/삭제 상태는 델타 값 대신 상태 표시 (UI 상으로는 델타 자리에 표시)
                         if (verValuesHtml.includes('신규 →')) deltaHtml = '신규';
                         else if (verValuesHtml.includes('→ 삭제')) deltaHtml = '삭제';
                    }
                    // else deltaHtml remains ''


                // Construct the final cell HTML with spans wrapped in a div
                let innerContentHtml = `<span class="ver-values">${verValuesHtml}</span>`;
                if (deltaHtml && deltaHtml !== '-') { // Only add delta span if there's a non-empty/non-' -' delta text
                        innerContentHtml += `<span class="delta-value">${deltaHtml}</span>`;
                } else if (deltaHtml === '-') {
                     // 델타가 '-'인 경우에도 레이아웃 유지를 위해 빈 델타 스팬을 추가할 수 있습니다.
                     // 현재 CSS는 delta-value 스팬 존재 여부로 레이아웃을 제어하지는 않는 것으로 보입니다.
                }
                // Wrap the content in a div
                displayVal = `<div class="cell-content-wrapper">${innerContentHtml}</div>`;


                    // Store delta value for color grading (numeric delta or status string)
                    // applyGradientColorsComparison uses this data-delta attribute
                    if (typeof delta === 'number') {
                        dataAttributes += ` data-delta="${delta}"`;
                    } else if ((val1 === null || val1 === undefined) && (val2 !== null && val2 !== undefined)) { // New
                        dataAttributes += ` data-delta="new"`; // Used for CSS if any
                    } else if ((val1 !== null && val1 !== undefined) && (val2 === null || val2 === undefined)) { // Removed
                        dataAttributes += ` data-delta="removed"`; // Used for CSS if any
                    } else {
                        dataAttributes += ` data-delta="none"`; // Used for CSS if any
                    }

                    // Add data-delta-category for numeric delta colors if needed by CSS
                    // Currently, gradient colors are applied via inline style in JS based on the numeric delta range.
                    // If CSS classes are needed for specific delta value ranges, calculate category here.
                    // Example: if (typeof delta === 'number') { ... calculate category ... dataAttributes += ` data-delta-category="great-up"` }
            }

            comparisonTableHtml += `<td data-col="${col}"${dataAttributes}>${displayVal}</td>`;
        });
        comparisonTableHtml += '</tr>';
    });
    comparisonTableHtml += '</tbody></table>';

    dataContainer.innerHTML = comparisonTableHtml;

    // Attach sort event listeners to headers (excluding '실험체')
    // attachComparisonSortEventListeners 함수는 common.js에 정의되지 않았으므로 이 파일에 있습니다.
    attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
    // Apply gradient colors if checkbox is checked
    // applyGradientColorsComparison 함수는 common.js에 정의되었습니다.
    // applyGradientColorsComparison에 mergeDataForComparison 결과를 전달합니다.
    if (gradientCheckbox.checked) applyGradientColorsComparison(dataContainer.querySelector('table'), data, currentSortMode, currentSortColumn);
    // 팝업 설정 함수 호출 (렌더링 완료 후)
    setupTablePopup();
}

// 단일 테이블 렌더링
// data: getProcessedStatsForPeriod 결과
function renderTable(data) {
    if (isCompareMode) return; // 비교 모드에서는 실행되지 않음

   const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위']; // UI 컬럼 목록

   let html = '<table id="stats-table"><thead><tr>'; // 테이블 ID 추가
   cols.forEach(c => {
        // 단일 모드에서는 실험체 정렬 제외, 티어 정렬 포함
       const sortable = c !== '실험체';
       // data-col 속성은 그대로 사용
       html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
   });
   html += '</tr></thead><tbody>';

   // data는 getProcessedStatsForPeriod의 결과입니다.
   // getProcessedStatsForPeriod 결과의 '승률', 'TOP 3', '픽률'은 0-1 스케일, 나머지는 값 그대로입니다.
   data.forEach(row => {
       html += '<tr>';
       cols.forEach(col => {
           let val = row[col]; // getProcessedStatsForPeriod 결과의 해당 값
            if (val === undefined || val === null) {
                val = '-';
            } else if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                // getProcessedStatsForPeriod 결과에서 승률, TOP 3, 픽률은 0-1 스케일로 저장됩니다.
                // UI 표시 시에만 100을 곱하고 %를 붙입니다.
                val = typeof val === 'number' ? (val * 100).toFixed(2) + '%' : '-';
            } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위' || col === '표본수') { // 표본수 컬럼 추가
                // getProcessedStatsForPeriod 결과에서 표본수, 점수, RP획득, 평균순위도 숫자로 가져옴
                val = typeof val === 'number' ? parseFloat(val).toFixed(2) : '-'; // 소수점 둘째 자리까지 표시 유지
            } else { // 실험체, 티어 등 (문자열)
                val = val; // 문자열 값 그대로 사용
            }

           // data-col 속성은 그대로 사용
           html += `<td data-col="${col}">${val}</td>`;
       });
       html += '</tr>';
   });
   html += '</tbody></table>';

   dataContainer.innerHTML = html;

   // Attach sort event listeners to headers (excluding '실험체')
   // attachSingleSortEventListeners 함수는 common.js에 정의되지 않았으므로 이 파일에 있습니다.
   attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
   // Apply gradient colors if checkbox is checked
   // applyGradientColorsSingle 함수는 common.js에 정의되었습니다.
   // applyGradientColorsSingle에 getProcessedStatsForPeriod 결과를 전달할 필요는 없습니다.
   // 이미 renderTable에서 테이블에 표시된 텍스트를 기준으로 색칠합니다.
   if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table'));
    // 팝업 설정 함수 호출 (렌더링 완료 후)
   setupTablePopup();
}

}); // DOMContentLoaded 끝