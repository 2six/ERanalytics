// script_statistics.js
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
    // --- 수정: compareCheckbox 변수 선언 추가 (ReferenceError 해결) ---
    const compareCheckbox = document.getElementById('compare-checkbox');
    // ---------------------------------------------

    // 상태
    let currentSortColumn = '점수';
    let currentSortAsc = false;
    let currentSortMode = 'value'; // 'value' (단일), 'value1', 'value2', 'delta'
    let lastData = []; // 로드된 원본 데이터 또는 병합된 비교 데이터
    let tierConfig = null; // config.ini에서 로드된 티어 설정
    let versionList = []; // versions.json에서 로드된 버전 목록 (Promise.all 내부에서 할당)


    // --- 수정 제안: attachSingleSortEventListeners 함수 정의를 이 위치로 이동 ---
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

                    // --- 확인: 티어 컬럼의 기본 정렬 방향 ---
                    // 티어 컬럼은 점수 기준으로 정렬되며, 점수는 클수록 좋음으로 처리합니다.
                    // common.js sortData에서 '티어' Value 정렬 시 '점수' 키를 사용하고, 점수는 클수록 좋음으로 처리합니다.
                    // 따라서 '점수' 기준 내림차순 (asc=false)일 때 S+가 위로 옵니다.
                    // 그래서 '티어' 컬럼 클릭 시 내림차순으로 시작하는 것이 맞습니다.
                    if (col === '티어') currentSortAsc = false;
                    // ------------------------------------

                    currentSortMode = 'value'; // 단일 모드는 value 고정
                }
                //console.log(`Single Sort: column=${currentSortColumn}, asc=${currentSortAsc}, mode=${currentSortMode}`); // 디버그
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode);
                renderFunc(sortedData); // renderTable 호출
            };
        });
    }

    // --- 수정 제안: attachComparisonSortEventListeners 함수 정의를 이 위치로 이동 ---
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
                // --- 정렬 순환: Value1 ▼ -> Value1 ▲ -> Value2 ▼ -> Value2 ▲ -> Delta ▼ -> Delta ▲ -> Value1 ▼ ... ---
                // 사용자 요청: 내림차순 -> 오름차순 순환
                // 현재 코드의 modes와 directions 배열은 이미 내림차순(false) -> 오름차순(true) 순환을 구현하고 있습니다.
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

                //console.log(`Compare Sort: column=${currentSortColumn}, asc=${currentSortAsc}, mode=${currentSortMode}`); // 디버그

                // 업데이트된 정렬 상태를 바탕으로 데이터 정렬 및 테이블 다시 렌더링
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // common.js의 sortData 함수 호출
                renderFunc(sortedData); // 테이블 렌더링 함수 호출 (renderComparisonTable)

                // URL 업데이트 (정렬 상태 포함)
                updateURL();

                // 화살표 및 델타 표시자는 renderFunc 호출 시 applyGradientColorsComparison 함수에 의해 업데이트됨
            };
        });
    }
    // ------------------------------------------------------------


    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    let isCompareMode = params.get('compare') === '1'; // isCompareMode 변수를 let으로 선언하여 변경 가능하게 함

    // --- 추가: 현재 모드에 따라 body 클래스 추가/제거 ---
    if (isCompareMode) {
        document.body.classList.add('is-compare-mode');
    } else {
        document.body.classList.remove('is-compare-mode');
    }
    // -------------------------------------------------


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
                currentSortMode = 'value1';
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
        const config = parseINI(iniText);
        tierConfig = config.tiers;

        // common.js 에 정의된 함수들로 드롭다운 채우기
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // 비교 모드일 때 비교 드롭다운 채우기 (UI 표시 여부는 아래에서 제어)
        populateVersionDropdown(versionSelectCompare, versionList);
        populateTierDropdown(tierSelectCompare);
        populatePeriodDropdown(periodSelectCompare);


        // URL 파라미터로부터 컨트롤 상태 복원 (versionList 로드 후 호출)
        applyParamsToControls();

        // --- 수정: 드롭다운 변경 시 현재 모드에 따라 데이터 갱신 ---
        // reloadData 변수 사용 대신, isCompareMode에 따라 직접 함수 호출
        versionSelect.addEventListener('change', () => { updateURL(); isCompareMode ? loadAndDisplayComparison() : loadAndDisplaySingle(); });
        tierSelect.addEventListener('change', () => { updateURL(); isCompareMode ? loadAndDisplayComparison() : loadAndDisplaySingle(); });
        periodSelect.addEventListener('change', () => { updateURL(); isCompareMode ? loadAndDisplayComparison() : loadAndDisplaySingle(); });

        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            // 단일 모드에서만 색상 강조 적용/해제
            if (!isCompareMode && lastData && lastData.length > 0) applyGradientColorsSingle(dataContainer.querySelector('table'));
            // 비교 모드는 renderComparisonTable에서 항상 색상 적용하므로 여기서는 단일 모드만 처리
        });

        // 비교 모드 드롭다운 이벤트 리스너 (비교 모드일 때만 실제 데이터 로드 함수 호출)
        versionSelectCompare.addEventListener('change', () => { updateURL(); loadAndDisplayComparison(); });
        tierSelectCompare.addEventListener('change', () => { updateURL(); loadAndDisplayComparison(); });
        periodSelectCompare.addEventListener('change', () => { updateURL(); loadAndDisplayComparison(); });
        // ------------------------------------------------------


        // 첫 로드 (초기 isCompareMode 값에 따라 호출)
        if (isCompareMode) {
             loadAndDisplayComparison();
        } else {
             loadAndDisplaySingle();
        }

        // setupTablePopup은 render 함수들 안에서 호출되므로 여기서 호출할 필요 없음.

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
        // --- 추가: 팝업 기능도 설정하여 에러 메시지 캡처 가능하도록 함 ---
        setupTablePopup(); // 에러 메시지 캡처를 위해 에러 시에도 호출
        // ------------------------------------------------------
        // --- 수정: compareCheckbox 이벤트 리스너를 이 catch 블록 밖으로 이동 ---
    }); // Promise.all 체인의 끝


    // --- 추가: 비교 모드 체크박스 이벤트 리스너 (Promise.all 체인 밖으로 이동) ---
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
             currentSortMode = 'value1';
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
    // --------------------------------------------


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
                let entries;

                // --- 수정 시작: 기간에 따라 common.js의 함수 호출 ---
                if (period === 'latest') {
                    // 'latest' 기간은 스냅샷 사용 (common.js의 extractPeriodEntries)
                    entries = extractPeriodEntries(history, period);
                } else {
                    // '3day' 또는 '7day' 기간은 델타 통계 사용 (common.js의 extractDeltaEntries)
                    entries = extractDeltaEntries(history, period);
                }
                // --- 수정 끝

                // --- 수정 시작: calculateAverageScore 반환값 및 calculateTiers/calculateStandardDeviation 호출 인자 변경 ---
                const { avgScore, averageRP } = calculateAverageScore(entries); // avgScore와 averageRP 함께 받음
                const stddev = calculateStandardDeviation(entries, avgScore, averageRP); // calculateStandardDeviation 인자 추가
                let scored = calculateTiers(entries, avgScore, stddev, tierConfig, averageRP); // calculateTiers 인자 추가
                // --- 수정 끝

                currentSortMode = 'value'; // 단일 모드는 value 고정
                scored = sortData(scored, currentSortColumn, currentSortAsc, currentSortMode);

                lastData = scored;
                renderTable(scored); // 단일 모드 렌더링

                // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
                    setupTablePopup();
                // --------------------------------------------

            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
                    // 에러 시에도 팝업 버튼이 동작하도록 설정
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
            // 동일 데이터인 경우에도 팝업 버튼이 동작하도록 설정
            setupTablePopup();
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
            if (!json1 && !json2) {
                 dataContainer.innerHTML = '두 데이터 모두 불러오는 데 실패했습니다.';
                 lastData = [];
                 // 에러 시에도 팝업 버튼이 동작하도록 설정
                 setupTablePopup();
                 return;
            }

            const history1 = json1 ? json1['통계'] : {};
            const history2 = json2 ? json2['통계'] : {};

            let entries1, entries2;

            // --- 수정 시작: 기간에 따라 extractPeriodEntries 또는 extractDeltaEntries 호출 ---
            if (period1 === 'latest') {
                // 데이터 1 기간이 'latest'이면 스냅샷 사용
                entries1 = extractPeriodEntries(history1, period1); // common.js의 extractPeriodEntries
            } else {
                // 데이터 1 기간이 '3day' 또는 '7day'이면 델타 통계 사용
                entries1 = extractDeltaEntries(history1, period1); // common.js의 extractDeltaEntries
            }

            if (period2 === 'latest') {
                 // 데이터 2 기간이 'latest'이면 스냅샷 사용
                 entries2 = extractPeriodEntries(history2, period2); // common.js의 extractPeriodEntries
            } else {
                 // 데이터 2 기간이 '3day' 또는 '7day'이면 델타 통계 사용
                 entries2 = extractDeltaEntries(history2, period2); // common.js의 extractDeltaEntries
            }
            // --- 수정 끝

            // 데이터가 하나라도 없으면 비교 불가
            // mergeDataForComparison 결과가 비어있는지로 판단합니다.
            // mergeDataForComparison는 한쪽에만 데이터가 있어도 결과를 반환하므로,
            // 최소한 한쪽 데이터는 calculateTiers를 거쳐 유효해야 테이블을 그릴 수 있습니다.

            // 각 데이터셋 별도로 가공 (점수, 티어, 픽률 계산)
            // calculateTiers는 entries 배열을 받아서 점수, 티어, 픽률을 계산하여 새 객체를 반환합니다.
            // entries1/entries2가 델타 데이터인 경우, calculateTiers는 해당 델타 데이터의 특성을 반영한 점수/티어를 계산합니다.
            // --- 수정 시작: calculateAverageScore 반환값 및 calculateTiers/calculateStandardDeviation 호출 인자 변경 ---
            const { avgScore: avgScore1, averageRP: averageRP1 } = calculateAverageScore(entries1); // avgScore와 averageRP 함께 받음
            const stddev1 = calculateStandardDeviation(entries1, avgScore1, averageRP1); // calculateStandardDeviation 인자 추가
            const scored1 = calculateTiers(entries1, avgScore1, stddev1, tierConfig, averageRP1); // calculateTiers 인자 추가

            const { avgScore: avgScore2, averageRP: averageRP2 } = calculateAverageScore(entries2); // avgScore와 averageRP 함께 받음
            const stddev2 = calculateStandardDeviation(entries2, avgScore2, averageRP2); // calculateStandardDeviation 인자 추가
            const scored2 = calculateTiers(entries2, avgScore2, stddev2, tierConfig, averageRP2); // calculateTiers 인자 추가
            // --- 수정 끝


            // 두 데이터셋 병합 및 차이 계산
            // mergeDataForComparison 함수는 scored1과 scored2 객체 배열을 받아서
            // 각 캐릭터별 '값1', '값2', '변화량', '티어 변화', '순위 변화' 등을 계산합니다.
            const comparisonData = mergeDataForComparison(scored1, scored2);

            // 정렬 (비교 모드에서는 병합된 데이터를 정렬)
            const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc, currentSortMode);

            lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장

             if (lastData.length === 0) {
                 dataContainer.innerHTML = '선택한 조건에 해당하는 비교 데이터가 없습니다.';
             } else {
                renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링
             }

            // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
            setupTablePopup();
            // --------------------------------------------

        })
        .catch(err => {
            // Promise.all 내부에서 catch 했으므로 여기는 거의 오지 않음
            console.error('비교 데이터 처리 실패:', err);
            dataContainer.innerHTML = `데이터 처리 중 오류가 발생했습니다: ${err.message}`;
            // 에러 시에도 팝업 버튼이 동작하도록 설정
            setupTablePopup();
        });
    }

// --- 추가: 표 이미지 팝업 기능 설정 함수 --- - 기존 유지
function setupTablePopup() {
    const popup = document.getElementById('image-popup');
    const popupImg = document.getElementById('popup-image');
    const popupTableButton = document.getElementById('popup-table-button');
    const targetTable = dataContainer.querySelector('table'); // dataContainer 내의 테이블 탐색

    // 요소가 모두 존재하는지 확인
    if (!popupTableButton || !popup || !popupImg) {
         // console.error("Popup elements or target table not found."); // 디버깅 로그
         // 테이블이 로드되기 전이나 에러 시에는 targetTable이 없을 수 있습니다.
         // 버튼만이라도 존재하면 이벤트 리스너를 붙입니다.
         if (popupTableButton) {
              // 에러 메시지 등이 표시된 상태에서도 캡처 시도 가능
              setupButtonListener(popupTableButton, popup, popupImg, dataContainer);
         }
         return;
    }

    // targetTable이 로드된 경우에만 테이블 캡처 리스너를 붙입니다.
     setupButtonListener(popupTableButton, popup, popupImg, targetTable);

    // 팝업 닫기 버튼 이벤트 리스너 (한 번만 설정)
     const closeButton = popup.querySelector('.image-popup-close');
     if (closeButton && !closeButton.onclick) { // 이미 리스너가 없으면 추가
          closeButton.onclick = () => { popup.style.display = 'none'; };
     }

    // 팝업 외부 클릭 시 닫기 (선택 사항)
    // popup.onclick = (event) => {
    //     if (event.target === popup) {
    //         popup.style.display = 'none';
    //     }
    // };
    setupPartialTablePopup(); 
}

// 부분 이미지 캡처 버튼 설정
function setupPartialTablePopup() {
    const popup = document.getElementById('image-popup');
    const popupImg = document.getElementById('popup-image');
    const partialButton = document.getElementById('popup-partial-button');
    const dataContainer = document.getElementById('data-container'); // dataContainer 참조

    if (!partialButton || !popup || !popupImg) return;

    // async/await를 사용하여 비동기 코드를 더 명확하게 작성
    partialButton.onclick = async () => {
        const targetTable = dataContainer.querySelector('table');
        if (!targetTable) {
            alert("테이블이 로드되지 않았습니다.");
            return;
        }

        const tbody = targetTable.querySelector('tbody');
        if (!tbody || tbody.rows.length === 0) {
            alert("캡처할 데이터가 테이블에 없습니다.");
            return;
        }

        const allRows = Array.from(tbody.rows);
        
        // 상위 10개와 하위 10개 사이에 있는 행들만 선택
        // 총 행 수가 20개 이하이면 숨길 행이 없으므로 빈 배열이 됨
        const rowsToHide = allRows.length > 20 ? allRows.slice(10, -10) : [];
        
        // 행들을 숨김 처리
        rowsToHide.forEach(row => row.style.display = 'none');

        try {
            // 스타일이 유지된 원본 테이블을 직접 캡처
            const canvas = await html2canvas(targetTable, { backgroundColor: null });
            popup.style.display = 'block';
            popupImg.src = canvas.toDataURL();
        } catch (err) {
            console.error("부분 이미지 캡처 실패:", err);
            alert("부분 이미지 캡처 중 오류가 발생했습니다.");
            popup.style.display = 'none';
        } finally {
            // 이미지 캡처의 성공/실패 여부와 관계없이, 숨겼던 모든 행을 다시 표시
            rowsToHide.forEach(row => row.style.display = ''); // 인라인 display 스타일을 제거하여 원래 상태로 복원
        }
    };    
}

// 팝업 버튼 리스너 설정 헬퍼 함수 (targetElement를 캡처)
 function setupButtonListener(button, popup, popupImg, targetElement) {
      // 기존 클릭 이벤트 리스너가 있다면 제거 (중복 부착 방지)
      if (button.onclick) {
           button.onclick = null;
      }

      button.onclick = () => {
           // dataContainer 자체 또는 그 안의 테이블을 캡처 대상으로 지정
           html2canvas(targetElement, {
                backgroundColor: null, // 배경 투명하게 캡처 (필요시)
                // scale: 2 // 고해상도 캡처를 원하면 주석 해제
           })
             .then(canvas => {
               popup.style.display = 'block';
               popupImg.src = canvas.toDataURL();
             })
             .catch(err => {
                  console.error("Error capturing element:", err);
                  alert("이미지 캡처 중 오류가 발생했습니다.");
                  popup.style.display = 'none'; // 팝업 숨김
             });
      };
 }
// ------------------------------------------


// 7) 비교 테이블 렌더링
function renderComparisonTable(data) { // data 인자는 정렬된 데이터 배열입니다.
    if (!isCompareMode) return;

    // 기존 테이블 컬럼 목록
    const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위', '표본수'];

    let comparisonTableHtml = '<table id="stats-table"><thead><tr>'; // 테이블 ID 추가
    cols.forEach(c => {
        // 실험체 컬럼은 비교 모드에서 정렬 제외 유지
        const sortable = c !== '실험체';

        comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`; // 닫는 태그 </th> 추가
    });
    comparisonTableHtml += '</tr></thead><tbody>';

    data.forEach(row => {
        comparisonTableHtml += '<tr>';
        cols.forEach(col => {
            let displayVal = '-';
            let dataAttributes = ''; // data-delta, data-rankdelta 등을 저장할 문자열

            if (col === '실험체') {
                displayVal = row['실험체'] || '-';

                // 순위 변화 색상 강조를 위한 data 속성은 실험체 열에 붙입니다.
                    const rankChangeValue = row['순위 변화값']; // 숫자 또는 string
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
                // 티어 컬럼에는 티어 변화 정보와 순위 변화 정보만 표시
                const tierChange = row['티어 변화'] || '-'; // string
                const rank1 = row['순위 (Ver1)'] !== null && row['순위 (Ver1)'] !== undefined ? row['순위 (Ver1)'] : '-'; // number 또는 '-' (최신 순위)
                const rank2 = row['순위 (Ver2)'] !== null && row['순위 (Ver2)'] !== undefined ? row['순위 (Ver2)'] : '-'; // number 또는 '-' (과거 순위)
                const rankChangeValue = row['순위 변화값']; // number or string (latest - past)

                let rankInfoText = '';
                    if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                         // 순위 변화값이 숫자인 경우에만 화살표 및 변화량 표시
                        if (typeof rankChangeValue === 'number') {
                            const rankChangeFormatted = Math.abs(rankChangeValue);
                            // --- 수정 시작: 순위 표시 순서를 과거 → 최신으로 변경 ---
                            // rankChangeValue가 음수이면 ▲, 양수이면 ▼ (latest - past 기준)
                             rankInfoText = `${rank2}위 → ${rank1}위 ${rankChangeValue < 0 ? `▲${rankChangeFormatted}` : (rankChangeValue > 0 ? `▼${rankChangeFormatted}` : '')}`;
                            // --- 수정 끝
                         } else { // 순위 변화값이 신규/삭제인 경우
                             // --- 수정 시작: 순위 표시 순서를 과거 → 최신으로 변경 ---
                             rankInfoText = `${rank2}위 → ${rank1}위`;
                             // --- 수정 끝
                         }
                    } else if (rankChangeValue === '신규 → ') {
                        rankInfoText = `(신규)`;
                    } else if (rankChangeValue === '→ 삭제') {
                        rankInfoText = `(삭제)`;
                    } else if (rank1 !== '-') { // Ver1에만 데이터 있고 Ver2에 없는 경우 (병합 로직 상 신규 → 케이스에 포함될 확률 높음)
                        // 이 경우는 순위 변화값 문자열이 '신규 → ' 일 때입니다.
                        // 따라서 이 분기는 거의 실행되지 않지만, 안전 장치로 유지합니다.
                        // 표시 형식은 '과거(-) → 최신' 형태가 됩니다.
                        rankInfoText = `- → ${rank1}위`;
                    } else if (rank2 !== '-') { // Ver2에만 데이터 있고 Ver1에 없는 경우 (병합 로직 상 → 삭제 케이스에 포함될 확률 높음)
                        // 이 경우는 순위 변화값 문자열이 '→ 삭제' 일 때입니다.
                        // 따라서 이 분기는 거의 실행되지 않지만, 안전 장치로 유지합니다.
                        // 표시 형식은 '과거 → 최신(-)' 형태가 됩니다.
                        rankInfoText = `${rank2}위 → -`;
                    } else {
                        rankInfoText = '-';
                    }


                // Construct the final cell HTML with spans wrapped in a div
                let innerContentHtml = '';
                // 티어 변화가 '-'가 아니거나 (S+, S 등) '→' 포함 문자열인 경우 표시
                if (tierChange !== '-') { // '-'가 아니면 표시
                     innerContentHtml += `<span class="tier-value-or-change">${tierChange}</span>`;
                } else {
                     // 티어 변화 정보가 없으면 빈 스팬 또는 '-' 표시 스팬 추가 (레이아웃 유지를 위해)
                      innerContentHtml += `<span class="tier-value-or-change">-</span>`;
                }

                if (rankInfoText !== '-') { // Only add rank info span if there's rank info
                        innerContentHtml += `<span class="rank-info">${rankInfoText}</span>`;
                }

                // Wrap the content in a div, but only if there's actual content
                 // '티어 변화'가 '-' 이고 'rankInfoText'도 '-' 이면 전체를 '-'로 표시
                if (tierChange === '-' && rankInfoText === '-') {
                        displayVal = '-'; // No content at all
                } else {
                        displayVal = `<div class="cell-content-wrapper">${innerContentHtml}</div>`;
                }


                // 티어 변화 색상 강조를 위한 data 속성 (CSS에서 사용하지 않더라도 JS에서 필요할 수 있음)
                // 이 속성들은 이전 상태 그대로 유지합니다.
                    if (tierChange.includes('→')) {
                        const tiers = tierChange.split('→').map(t => t.trim());
                        const tier1Value = tiers[1]; // 최신 티어 (Ver1) 값
                        const tier2Value = tiers[0]; // 과거 티어 (Ver2) 값
                        const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F', '삭제', '신규']; // '신규' 추가
                        const index1 = tierOrder.indexOf(tier1Value); // 최신 티어 인덱스
                        const index2 = tierOrder.indexOf(tier2Value); // 과거 티어 인덱스

                        if (tierChange.includes('신규 →')) {
                            dataAttributes += ` data-tierchange="new"`; // 신규는 항상 'up'으로 간주
                        } else if (index1 >= 0 && index2 >= 0) {
                             // 순서 값이 작을수록 좋은 티어이므로, index1 < index2 이 개선임
                            if (index1 < index2) dataAttributes += ` data-tierchange="up"`; // 개선 (최신 티어 인덱스가 과거 티어 인덱스보다 작음)
                            else if (index1 > index2) dataAttributes += ` data-tierchange="down"`; // 악화 (최신 티어 인덱스가 과거 티어 인덱스보다 큼)
                            else dataAttributes += ` data-tierchange="same"`; // 동일
                        } else if (tierChange === '→ 삭제') {
                            dataAttributes += ` data-tierchange="removed"`; // 삭제는 항상 'down'으로 간주
                        } else { // 예상치 못한 변화 형태
                             dataAttributes += ` data-tierchange="none"`;
                        }
                    } else if (tierChange === '-') {
                        dataAttributes += ` data-tierchange="none"`;
                    } else { // 티어 변화 없는 경우 (S+ 등)
                            dataAttributes += ` data-tierchange="same"`; // 변화가 없으므로 same으로 처리
                    }

            } else { // Other numeric stat columns (점수, 픽률, RP 획득, 승률, TOP 3, 평균 순위, 표본수)
                    const val1 = row[`${col} (Ver1)`]; // 최신 값
                    const val2 = row[`${col} (Ver2)`]; // 과거 값
                    const delta = row[`${col} 변화량`]; // Numeric delta value (latest - past)

                    // Display Ver2 value → Ver1 value Delta format
                    let valueText1;
                    if (typeof val1 === 'number') {
                        if (col === '승률' || col === 'TOP 3') {
                            valueText1 = (val1 * 100).toFixed(2) + '%'; // 100 곱하고 % 추가
                        } else if (col === '픽률') {
                            valueText1 = val1.toFixed(2) + '%'; // 픽률은 이미 %
                        } else if (col === '평균 순위') {
                            valueText1 = val1.toFixed(2) + '위'; // 평균 순위는 '위' 추가
                        } else if (col === '표본수') {
                             valueText1 = val1.toFixed(0); // 표본수는 정수
                        }
                        else { // 점수, RP 획득
                            valueText1 = val1.toFixed(2); // 소수점 둘째 자리까지
                        }
                    } else {
                        valueText1 = '-';
                    }

                    let valueText2;
                    if (typeof val2 === 'number') {
                        if (col === '승률' || col === 'TOP 3') {
                            valueText2 = (val2 * 100).toFixed(2) + '%'; // 100 곱하고 % 추가
                        } else if (col === '픽률') {
                            valueText2 = val2.toFixed(2) + '%'; // 픽률은 이미 %
                        } else if (col === '평균 순위') {
                            valueText2 = val2.toFixed(2) + '위'; // 평균 순위는 '위' 추가
                        } else if (col === '표본수') {
                            valueText2 = val2.toFixed(0); // 표본수는 정수
                        }
                        else { // 점수, RP 획득
                            valueText2 = val2.toFixed(2); // 소수점 둘째 자리까지
                        }
                    } else {
                        valueText2 = '-';
                    }


                    let verValuesHtml;
                    let deltaHtml = '';

                    // --- 수정 시작: 순서 그대로 valueText2 → valueText1 유지 ---
                    if (typeof val1 === 'number' && typeof val2 === 'number') {
                        verValuesHtml = `${valueText2} → ${valueText1}`; // 과거 → 최신
                        if (typeof delta === 'number') {
                             // 델타 값 포맷팅 및 ▲▼ 기호는 delta (latest - past) 부호에 따라 결정
                             let deltaValueForFormatting = delta;
                             let deltaSuffix = ''; // 단위
                             if (col === '승률' || col === 'TOP 3') {
                                 deltaValueForFormatting = delta * 100;
                             }
                             const deltaFormatted = col === '표본수' ? Math.abs(deltaValueForFormatting).toFixed(0) : Math.abs(deltaValueForFormatting).toFixed(2);

                             // delta가 양수이면 ▲, 음수이면 ▼ (latest - past 기준)
                             deltaHtml = `${delta > 0 ? `▲${deltaFormatted}` : (delta < 0 ? `▼${deltaFormatted}` : '')}${deltaSuffix}`;
                        }
                    } else if (typeof val2 === 'number' && (val1 === null || val1 === undefined)) { // Ver2에 있고 Ver1에만 없음 (삭제)
                        verValuesHtml = `${valueText2} → 삭제`; // 과거 → 삭제
                    } else if ((val2 === null || val2 === undefined) && typeof val1 === 'number') { // Ver2에 없고 Ver1에만 있음 (신규)
                        verValuesHtml = `신규 → ${valueText1}`; // 신규 → 최신
                    } else { // Neither has data
                        verValuesHtml = '-';
                    }
                    // --- 수정 끝


                // Construct the final cell HTML with spans wrapped in a div
                let innerContentHtml = `<span class="ver-values">${verValuesHtml}</span>`;
                if (deltaHtml) { // Only add delta span if there's a numeric delta
                        innerContentHtml += `<span class="delta-value">${deltaHtml}</span>`;
                }
                // Wrap the content in a div
                displayVal = `<div class="cell-content-wrapper">${innerContentHtml}</div>`;


                    // Store delta value for color grading (numeric delta or status string)
                    // data-delta 속성 값은 delta (latest - past) 값 또는 상태 문자열 그대로 유지
                    if (typeof delta === 'number') {
                        dataAttributes += ` data-delta="${delta}"`;
                    } else if ((val2 !== null && val2 !== undefined) && (val1 === null || val1 === undefined)) { // Removed (과거에 있고 최신에 없음)
                        dataAttributes += ` data-delta="removed"`;
                    } else if ((val2 === null || val2 === undefined) && (val1 !== null && val1 !== undefined)) { // New (과거에 없고 최신에 있음)
                        dataAttributes += ` data-delta="new"`;
                    } else {
                        dataAttributes += ` data-delta="none"`;
                    }
            }

            comparisonTableHtml += `<td data-col="${col}"${dataAttributes}>${displayVal}</td>`;
        });
        comparisonTableHtml += '</tr>';
    });
    comparisonTableHtml += '</tbody></table>';

    dataContainer.innerHTML = comparisonTableHtml;

    // Attach sort event listeners to headers (excluding '실험체')
    attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
    // Apply gradient colors if checkbox is checked
    // applyGradientColorsComparison 함수는 data, currentSortMode, currentSortColumn 인자를 사용
    if (gradientCheckbox.checked) applyGradientColorsComparison(dataContainer.querySelector('table'), data, currentSortMode, currentSortColumn);
    // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
    setupTablePopup();
    // --------------------------------------------
}

function renderTable(data) {
if (isCompareMode) return; // 비교 모드에서는 실행되지 않음

const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위','표본수']; // 표본수 다시 추가

let html = '<table><thead><tr>';
cols.forEach(c => {
    // 단일 모드에서는 실험체 정렬 제외, 티어 정렬 포함
   const sortable = c !== '실험체';
   html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`; // 닫는 태그 </th> 추가
});
html += '</tr></thead><tbody>';

data.forEach(row => {
   html += '<tr>';
   cols.forEach(col => {
       let val = row[col];
        if (val === undefined || val === null) {
            val = '-';
        } else if (col === '승률' || col === 'TOP 3') {
            val = typeof val === 'number' ? (val * 100).toFixed(2) + '%' : '-';
        } else if (col === '픽률') {
            val = typeof val === 'number' ? val.toFixed(2) + '%' : '-';
        } else if (col === '평균 순위') {
             val = typeof val === 'number' ? parseFloat(val).toFixed(2) + '위' : '-'; // '위' 추가
        } else if (col === '표본수') {
             val = typeof val === 'number' ? val.toFixed(0) : '-'; // 정수
        }
        else if (col === '점수' || col === 'RP 획득') {
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

// Attach sort event listeners to headers (excluding '실험체')
attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
// Apply gradient colors if checkbox is checked
if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table'));
// --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
setupTablePopup();
// --------------------------------------------
}

}); // DOMContentLoaded 끝