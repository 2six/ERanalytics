// script_graph.js
document.addEventListener('DOMContentLoaded', function () {
  // DOM 요소
  const canvas               = document.getElementById('graph-canvas');
  const versionSelect        = document.getElementById('version-select');
  const tierSelect           = document.getElementById('tier-select');
  const periodSelect         = document.getElementById('period-select');
  const lowPickrateCheckbox  = document.getElementById('filter-low-pickrate');
  const highPickrateCheckbox = document.getElementById('filter-high-pickrate');
  const popupButton          = document.getElementById('popup-graph-button');
  const popup                = document.getElementById('image-popup');
  const popupImage           = document.getElementById('popup-image');
  const popupClose           = document.querySelector('.image-popup-close');

  // URL 파라미터 헬퍼
  const params = new URLSearchParams(window.location.search);
  function getParam(key, def) {
    return params.has(key) ? params.get(key) : def;
  }
  function setParam(key, val) {
    params.set(key, val);
    history.replaceState(null, '', '?' + params.toString());
  }

  // 상태
  let chartData    = []; // Result from calculateFinalStatsForPeriod (unfiltered)
  let filteredData = []; // chartData after applying pick rate filters
  let myChart      = null;
  let tierConfig   = null; // config.iniからロードされるティア設定
  let versionList  = []; // versions.jsonからロードされるバージョンリスト

  // 탭 파라미터로 초기화
  let currentTab   = getParam('tab', 'pick-rp');

  // Chart.js 플러그인 등록 (DOMContentLoaded 시점에 한 번만)
  Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);


  // 초기화
  Promise.all([
      fetch('/config.ini').then(r => r.text()),
      fetch('/versions.json').then(r => r.json())
  ]).then(([iniText, loadedVersionList]) => {
      // データロード成功後、versionListとtierConfigを設定
      versionList = loadedVersionList;
      const config = parseINI(iniText); // parseINIはcommon.jsに定義
      tierConfig = config.tiers; // tierConfigを設定

      // 드롭다운 채우기
      populateVersionDropdown(versionSelect, versionList); // common.js
      populateTierDropdown(tierSelect);                   // common.js
      populatePeriodDropdown(periodSelect);               // common.js

      // URL → 초기 상태
      versionSelect.value = getParam('version', versionList.sort().reverse()[0]);
      tierSelect.value    = getParam('tier', 'diamond_plus');
      periodSelect.value  = getParam('period', 'latest');
      lowPickrateCheckbox.checked  = getParam('lowPickrate', 'false') === 'true';
      highPickrateCheckbox.checked = getParam('highPickrate', 'false') === 'true';

      // 드롭다운 변경
      versionSelect.addEventListener('change', () => {
        setParam('version', versionSelect.value);
        loadData(); // 데이터 로드 및 그래프 재생성
      });
      tierSelect.addEventListener('change', () => {
        setParam('tier', tierSelect.value);
        loadData(); // 데이터 로드 및 그래프 재생성
      });
      periodSelect.addEventListener('change', () => {
        setParam('period', periodSelect.value);
        loadData(); // 데이터 로드 및 그래프 재생성
      });

      // 체크박스 변경
      lowPickrateCheckbox.addEventListener('change', () => {
        setParam('lowPickrate', lowPickrateCheckbox.checked);
        applyFilters(); // 필터만 적용
        createGraph(currentTab); // 그래프 재생성
      });
      highPickrateCheckbox.addEventListener('change', () => {
        setParam('highPickrate', highPickrateCheckbox.checked);
        applyFilters(); // 필터만 적용
        createGraph(currentTab); // 그래프 재생성
      });

      // 탭 및 팝업 셋업
      setupGraphTabs();
      popupButton.addEventListener('click', () => {
        html2canvas(canvas).then(c => {
          popup.style.display = 'block';
          popupImage.src = c.toDataURL();
        });
      });
      popupClose.addEventListener('click', () => {
        popup.style.display = 'none';
      });

      // 최초 로드
      loadData(); // 데이터 로드 및 초기 그래프 생성

    })
    .catch(err => console.error('초기화 실패:', err));

  // 탭 클릭 처리 & URL 반영
  function setupGraphTabs() {
    document.querySelectorAll('.graph-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        // 모든 탭 버튼에서 active 클래스 제거
        document.querySelectorAll('.graph-tab').forEach(b => b.classList.remove('active'));
        // 클릭된 버튼에 active 클래스 추가
        btn.classList.add('active');

        currentTab = btn.dataset.type;
        setParam('tab', currentTab);
        applyFilters(); // 필터만 적용
        createGraph(currentTab); // 그래프 재생성
      });
    });
  }

  // 데이터 로드 → 필터 → 차트
  function loadData() {
    const version = versionSelect.value;
    const tier    = tierSelect.value;
    const period  = periodSelect.value;

    // 데이터 로딩 중 메시지 (캔버스 크기 유지)
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#333';
    ctx.fillText('데이터 로딩 중...', canvas.width / 2, canvas.height / 2);


    // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
    fetch(`/stats/${version}/${tier}.json`)
    // >>> 수정 끝
      .then(r => {
          if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
          return r.json();
      })
      .then(json => {
          const history = json['통계'];

          // common.js의 calculateFinalStatsForPeriod 함수를 사용하여 최종 데이터셋 계산
          // 이 함수가 period에 따라 누적 스냅샷 또는 기간 역산 데이터를 가져와 calculateTiers까지 수행합니다.
          // tierConfig는 로드 시점에 설정되었습니다.
          const finalScoredData = calculateFinalStatsForPeriod(history, period, tierConfig);

          // 데이터가 없는 경우 메시지 표시 및 처리
          if (!finalScoredData || finalScoredData.length === 0) {
               console.warn("No data available for the selected period.");
               chartData = []; // 데이터 비워주기
               filteredData = []; // 필터된 데이터도 비워주기
               if (myChart) myChart.destroy(); // 기존 차트 파괴
               ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 클리어
               ctx.font = '20px sans-serif';
               ctx.textAlign = 'center';
               ctx.fillStyle = '#333';
               ctx.fillText('선택한 기간에 해당하는 데이터가 부족하거나 없습니다.', canvas.width / 2, canvas.height / 2);
               return; // 데이터 없으므로 함수 종료
          }


        chartData = finalScoredData; // 계산된 최종 데이터셋을 chartData에 저장
        applyFilters(); // 필터 적용

        // URL 파라미터에 있는 탭 클릭 (그래프 재생성 포함)
        // ensure the button corresponding to currentTab gets the 'active' class
        const initialBtn = document.querySelector(`.graph-tab[data-type="${currentTab}"]`);
        if (initialBtn) {
          initialBtn.click(); // This will also call applyFilters and createGraph
        } else {
          // 기본 탭 클릭
          document.querySelector('.graph-tab[data-type="pick-rp"]').click(); // This will also call applyFilters and createGraph
        }
      })
      .catch(err => {
          console.error('데이터 로드 실패:', err);
          if (myChart) myChart.destroy(); // 기존 차트 파괴
          ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 클리어
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#333';
          ctx.fillText(`데이터를 불러오는 데 실패했습니다: ${err.message}`, canvas.width / 2, canvas.height / 2);
      });
  }

  // 체크박스 필터 적용
  function applyFilters() {
      // 필터링은 calculateFinalStatsForPeriod 결과 (chartData)를 기반으로 합니다.
      // calculateFinalStatsForPeriod 결과에는 '픽률' 필드가 이미 포함되어 있습니다 (백분율 형태).

      if (!chartData || chartData.length === 0) {
          filteredData = [];
          return;
      }

      // chartData 내 캐릭터들의 픽률 평균을 계산합니다.
      const pickRates = chartData.map(d => d['픽률']).filter(pr => typeof pr === 'number' && pr >= 0); // 픽률 값들만 모음
      const avgPickRate = pickRates.length === 0 ? 0 : pickRates.reduce((sum, pr) => sum + pr, 0) / pickRates.length; // 픽률의 단순 평균

      filteredData = chartData.filter(d => {
          const pr = d['픽률']; // 이미 계산된 픽률 사용 (백분율)
          if (typeof pr !== 'number' || pr < 0) return true; // 픽률이 없거나 음수면 필터 적용 안 함 (그대로 표시)

          // 필터 기준은 평균 픽률의 1/4 미만 또는 5배 초과입니다.
          if (lowPickrateCheckbox.checked && pr < avgPickRate / 4) return false; // 낮은 픽률 제외
          if (highPickrateCheckbox.checked && pr > avgPickRate * 5) return false; // 높은 픽률 제외

          return true; // 필터 통과
      });
      // console.log(`Filters applied. Original: ${chartData.length}, Filtered: ${filteredData.length}`); // Debug
  }

  // 그래프 생성
  function createGraph(type) {
    const maps = {
      'pick-rp': { xKey:'픽률',    yKey:'RP 획득', radiusKey:'승률',    title:'픽률 / RP 획득' },
      'pick-win':{ xKey:'픽률',    yKey:'승률',    radiusKey:'RP 획득',title:'픽률 / 승률' },
      'rp-win':  { xKey:'RP 획득', yKey:'승률',    radiusKey:'픽률',   title:'RP 획득 / 승률' }
    };
    const { xKey,yKey,radiusKey,title } = maps[type];

    if (!filteredData || filteredData.length === 0) {
         if (myChart) myChart.destroy();
         const ctx = canvas.getContext('2d');
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.font = '20px sans-serif';
         ctx.textAlign = 'center';
         ctx.fillStyle = '#333';
         ctx.fillText('필터링된 데이터가 없습니다.', canvas.width / 2, canvas.height / 2);
         return;
    }

    // 그래프 축 스케일링 및 annotation을 위한 전체 데이터셋의 평균값 계산 (필터링 전 데이터 기준)
    // calculateFinalStatsForPeriod 결과인 chartData를 사용합니다.
    const overallPickRates = chartData.map(d => d['픽률']).filter(pr => typeof pr === 'number' && pr >= 0);
    const overallAvgPickRate = overallPickRates.length === 0 ? 0 : overallPickRates.reduce((sum, pr) => sum + pr, 0) / overallPickRates.length; // 백분율 형태의 평균 픽률

    const overallRPs = chartData.map(d => d['RP 획득']).filter(v => typeof v === 'number' && v !== null);
    const overallWinRates = chartData.map(d => d['승률']).filter(v => typeof v === 'number' && v !== null); // 승률은 비율 (0~1) 형태일 것으로 예상

    // calculateAverageScore는 calculateFinalStatsForPeriod에서 이미 호출되었습니다.
    // calculateAverageScore는 weighted average score를 반환합니다.
    // 여기서 필요한 평균값은 각 스탯의 가중 평균입니다.
    // common.js의 calculateAverageScore 내부 로직은 각 캐릭터의 스탯에 해당 캐릭터의 표본수 비율을 곱해서 합산했습니다.
    // 이는 '점수'의 가중 평균을 계산하는 것이므로, 개별 스탯의 가중 평균과는 다릅니다.
    // 개별 스탯의 가중 평균은 (Σ 캐릭터 스탯 * 캐릭터 표본수) / 총 표본수 입니다.
    // calculateAverageScore와 calculateStandardDeviation는 '점수' 기준이므로, annotation line에 직접 사용하기는 어렵습니다.
    // annotation line은 해당 스탯(픽률, RP, 승률)의 가중 평균으로 표시하는 것이 일반적입니다.

    const totalOverallSamples = chartData.reduce((sum, d) => sum + (d['표본수'] || 0), 0);
    let overallWeightedAvgRP = 0;
    let overallWeightedAvgWinRate = 0; // 승률은 비율 (0~1)
    // overallWeightedAvgPickRate? 픽률의 가중 평균은 크게 의미 없을 수 있습니다. 단순 평균 또는 총 표본수로 계산하는 것이 일반적입니다.
    // 이전 코드에서 annotation line은 픽률의 단순 평균을 사용했습니다.

    if (totalOverallSamples > 0) {
         overallWeightedAvgRP = chartData.reduce((sum, d) => sum + (d['RP 획득'] || 0) * (d['표본수'] || 0), 0) / totalOverallSamples;
         overallWeightedAvgWinRate = chartData.reduce((sum, d) => sum + (d['승률'] || 0) * (d['표본수'] || 0), 0) / totalOverallSamples;
    }
     // 픽률의 경우, chartData 내 '픽률' 필드가 이미 전체 기간/스냅샷 기준 백분율일 가능성이 높습니다.
     // 그 경우 전체 평균 픽률은 totalOverallSamples / (전체 캐릭터 수) 로 계산되거나,
     // 또는 단순히 chartData 내 '픽률' 값들의 평균을 사용하는 것 (applyFilters에서 사용한 overallAvgPickRate)이 맞을 수 있습니다.
     // 이전 코드의 annotation 픽률 값은 avgPickRate (which was 1/N)였습니다. 이 로직은 잘못된 것 같습니다.
     // Annotation line for Pick Rate should represent the average Pick Rate of the characters displayed (or all characters for the period).
     // Let's use the `overallAvgPickRate` calculated earlier from `chartData`.


    const labels  = filteredData.map(d => d['실험체']);
    // X, Y, Radius 값 추출 (calculateFinalStatsForPeriod 결과 사용)
    const xValues = filteredData.map(d => d[xKey]);
    const yValues = filteredData.map(d => d[yKey]);
    const rValues = filteredData.map(d => d[radiusKey]); // calculateFinalStatsForPeriod 결과에 radiusKey에 해당하는 스탯 값이 있을 것입니다.

    if (myChart) myChart.destroy();
    const ctx = canvas.getContext('2d');
    // Chart.register는 DOMContentLoaded 시점에 이미 호출됨

    myChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        labels,
        datasets: [{
          data: filteredData.map((d,i)=>({x:xValues[i],y:yValues[i],label:d['실험체']})),
          backgroundColor: ctx => {
            // 색상 계산 로직 (기존 유지)
            const hue = (ctx.dataIndex*360/filteredData.length)%360;
            return `hsl(${hue},60%,70%,0.8)`;
          },
          pointRadius:  ctx => {
            // Radius 값 스케일링 (기존 유지)
            const v=rValues[ctx.dataIndex];
            // Filter out non-numeric values before calculating min/max
            const numericRValues = rValues.filter(val => typeof val === 'number' && val !== null);
            const mn=Math.min(...numericRValues), mx=Math.max(...numericRValues);

            if (numericRValues.length === 0 || mn === mx) return 15; // Default size if no numeric data or all same
            if (typeof v !== 'number' || v === null) return 6; // Small default for non-numeric radius value

            return 6 + ((v-mn)/(mx-mn))*24; // Scale radius between 6 and 30
          },
          pointHoverRadius: ctx => {
            // Hover Radius 값 스케일링 (pointRadius와 동일)
             const v=rValues[ctx.dataIndex];
             const numericRValues = rValues.filter(val => typeof val === 'number' && val !== null);
             const mn=Math.min(...numericRValues), mx=Math.max(...numericRValues);

            if (numericRValues.length === 0 || mn === mx) return 15;
            if (typeof v !== 'number' || v === null) return 6;

            return 6 + ((v-mn)/(mx-mn))*24;
          }
        }]
      },
      options: {
        responsive:false, // 기존 유지
        maintainAspectRatio:false, // 기존 유지
        plugins:{
          legend:{display:false}, // 기존 유지
          tooltip:{
            callbacks:{
              title:()=>'', // 기존 유지
              label:ctx=>{
                const d=filteredData[ctx.dataIndex];
                // 툴팁 내용은 calculateFinalStatsForPeriod 결과의 필드를 직접 사용합니다.
                // 승률, TOP 3, 픽률은 백분율로 표시 (toFixed(2) 사용)
                // RP 획득, 점수, 평균 순위는 toFixed(2) 사용
                return [
                  d['실험체'],
                  `픽률: ${(d['픽률'] || 0).toFixed(2)}%`, // 픽률은 이미 백분율
                  `RP 획득: ${(d['RP 획득'] || 0).toFixed(2)}`,
                  `승률: ${((d['승률'] || 0) * 100).toFixed(2)}%`, // 승률은 비율이므로 * 100
                  `TOP 3: ${((d['TOP 3'] || 0) * 100).toFixed(2)}%`, // TOP 3는 비율이므로 * 100
                  `평균 순위: ${(d['평균 순위'] || 0).toFixed(2)}`,
                  `점수: ${(d['점수'] || 0).toFixed(2)}`,
                  `표본수: ${(d['표본수'] || 0).toFixed(0)}` // 표본수는 정수로 표시
                ].filter(line => !line.includes('NaN') && !line.includes('undefined')); // 유효한 값만 표시
              }
            }
          },
          annotation:{ // Annotation lines (평균선)
            annotations:[
              {
                type:'line', scaleID:'x',
                // X축 평균 값: xKey에 따라 overallAvgPickRate, overallWeightedAvgRP, overallWeightedAvgWinRate 사용
                value: xKey==='픽률'?(overallAvgPickRate / 100): (xKey==='승률'?overallWeightedAvgWinRate:overallWeightedAvgRP), // 픽률은 UI 표시와 달리 스케일에서는 비율(0~1)로 사용될 가능성
                borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5],
                label: { // 라벨 추가 (어떤 평균선인지 표시)
                    content: `${xKey} 평균`,
                    enabled: true,
                    position: 'start', // 좌측 끝에 표시
                    backgroundColor: 'rgba(255,172,43,0.8)',
                    color: 'white',
                    font: { size: 12, weight: 'bold' }
                }
              },
              {
                type:'line', scaleID:'y',
                // Y축 평균 값: yKey에 따라 overallAvgPickRate, overallWeightedAvgRP, overallWeightedAvgWinRate 사용
                value: yKey==='픽률'?(overallAvgPickRate / 100) : (yKey==='승률'?overallWeightedAvgWinRate:overallWeightedAvgRP), // 픽률은 UI 표시와 달리 스케일에서는 비율(0~1)로 사용될 가능성
                borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5],
                 label: { // 라벨 추가
                     content: `${yKey} 평균`,
                     enabled: true,
                     position: 'end', // 상단 끝에 표시
                     backgroundColor: 'rgba(255,172,43,0.8)',
                     color: 'white',
                     font: { size: 12, weight: 'bold' }
                 }
              }
            ]
          }
        },
        scales:{ // 축 설정
          x:{
            title:{display:true,text:xKey}, // X축 제목
            // --- 수정: 축 값 범위와 콜백 함수 ---
            // 픽률과 승률은 비율로, RP 획득은 실수 값으로 처리합니다.
            // X축 데이터의 min/max를 계산하여 적절한 범위 설정
            min: 0, // 대부분의 스탯은 0 이상 (RP 획득은 음수 가능하지만 픽률/승률이 많으므로 min=0으로 기본 설정)
            // X축 데이터의 최대값을 기준으로 최대값 설정
            max: Math.max(...xValues.filter(v => typeof v === 'number' && v !== null), (xKey==='픽률'?(overallAvgPickRate/100): (xKey==='승률'?overallWeightedAvgWinRate:overallWeightedAvgRP)) * 1.5) * 1.1, // 데이터 최대값 또는 평균의 1.5배 중 큰 값의 1.1배까지 표시

            ticks:{
              callback: v => {
                // 픽률과 승률 축은 백분율로 표시
                if (xKey === '픽률' || xKey === '승률') {
                  return `${(v*100).toFixed(1)}%`; // 소수점 첫째 자리까지
                }
                // RP 획득 축은 소수점 첫째 자리까지 표시
                if (xKey === 'RP 획득') {
                    return v.toFixed(1);
                }
                 // 평균 순위 축은 소수점 첫째 자리까지 표시하고 '위' 붙임
                if (xKey === '평균 순위') {
                     return v.toFixed(1) + '위';
                }
                // 그 외 (점수, 표본수)는 toFixed(0) 또는 toFixed(1) 등 필요에 따라 조정
                 if (xKey === '점수' || xKey === '표本수') {
                      return v.toFixed(1); // 예시: 소수점 첫째 자리
                 }

                return v; // 기본값 (원본 값 그대로)
              },
               // 단계 설정은 데이터 범위에 따라 Chart.js가 자동으로 계산하도록 맡기거나, 특정 값을 지정할 수 있습니다.
               // 이전 코드의 stepSize는 특정 값으로 고정되어 있어 유연성이 떨어졌습니다.
               // stepSize: xKey === 'RP 획득' ? 1 : (xKey === '픽률' ? 0.002 : undefined) // 이전 코드 유지 시
               // 자동 계산을 위해 undefined (또는 제거)
            }
          },
          y:{
            title:{display:true,text:yKey}, // Y축 제목
            // --- 수정: 축 값 범위와 콜백 함수 ---
            // Y축 데이터의 min/max를 계산하여 적절한 범위 설정
            min: yKey==='RP 획득' ? undefined : 0, // RP 획득은 음수 가능
            max: Math.max(...yValues.filter(v => typeof v === 'number' && v !== null), (yKey==='픽률'?(overallAvgPickRate/100) : (yKey==='승률'?overallWeightedAvgWinRate:overallWeightedAvgRP)) * 1.5) * 1.1, // 데이터 최대값 또는 평균의 1.5배 중 큰 값의 1.1배까지 표시

            ticks:{
              callback: v => {
                 // 픽률과 승률 축은 백분율로 표시
                 if (yKey === '픽률' || yKey === '승률') {
                  return `${(v*100).toFixed(1)}%`; // 소수점 첫째 자리까지
                 }
                 // RP 획득 축은 소수점 첫째 자리까지 표시
                 if (yKey === 'RP 획득') {
                     return v.toFixed(1);
                 }
                 // 평균 순위 축은 소수점 첫째 자리까지 표시하고 '위' 붙임
                if (yKey === '평균 순위') {
                     return v.toFixed(1) + '위';
                }
                // 그 외 (점수, 표본수)는 toFixed(0) 또는 toFixed(1) 등 필요에 따라 조정
                 if (yKey === '점수' || yKey === '표本수') {
                      return v.toFixed(1); // 예시: 소수점 첫째 자리
                 }
                 return v; // 기본값 (원본 값 그대로)
               },
               // stepSize: yKey === 'RP 획득' ? 1 : (yKey === '픽률' ? 0.002 : undefined) // 이전 코드 유지 시
               // 자동 계산을 위해 undefined (또는 제거)
            }
          }
        }
      }
    });

    // 메타데이터 (cornerTextPlugin에서 사용)
    myChart.config._제목        = title;
    // overallAvgPickRate는 백분율 형태로 저장 (applyFilters에서 계산)
    myChart.config._평균픽률    = overallAvgPickRate;
    myChart.config._가중평균RP  = overallWeightedAvgRP;
    myChart.config._가중평균승률 = overallWeightedAvgWinRate * 100; // 승률은 백분율로 변환하여 저장

    // ensure the initially selected tab button gets the 'active' class
    const activeBtn = document.querySelector(`.graph-tab[data-type="${type}"]`);
    if(activeBtn) activeBtn.classList.add('active');

  }

  // 기간 delta 계산 (이 함수는 common.js의 calculatePeriodStatsForNewSamples 및 calculateFinalStatsForPeriod로 대체됩니다)
  // 로컬 extractPeriodEntries 함수 정의를 제거합니다.
  // function extractPeriodEntries(history, period) { ... } // REMOVED

  // 레이블 플러그인 (기존 유지)
  const labelPlugin = {
    id:'labelPlugin',
    afterDatasetsDraw(chart){
      const ctx=chart.ctx;
      // ensure chart.getDatasetMeta(0).data and chart.data.labels exist
      if (!chart.getDatasetMeta(0) || !chart.getDatasetMeta(0).data || !chart.data || !chart.data.labels) {
           console.warn("Chart data or labels missing for labelPlugin.");
           return;
      }
      chart.getDatasetMeta(0).data.forEach((pt,i)=>{
        // ensure pt and label exist for this index
        if (!pt || !chart.data.labels[i]) return;

        const x=pt.x,y=pt.y,l=chart.data.labels[i];
        ctx.save();
        ctx.font='10px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.lineWidth=2;ctx.strokeStyle='white';
        ctx.strokeText(l,x,y);
        ctx.fillStyle='black';ctx.fillText(l,x,y);
        ctx.restore();
      });
    }
  };

  // 코너 텍스트 플러그인
  // 티어 코드 → 한글 레이블 맵 (common.js의 tierMap 사용)
  // common.js에서 tierMap을 직접 사용하거나, tierLabels를 추가했다면 그것을 사용합니다.
  // common.js에 tierLabels 객체를 추가했으므로 그것을 사용합니다.

  const cornerTextPlugin = {
      id: 'cornerTextPlugin',
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        // Ensure chartArea exists
        if (!chartArea) {
             console.warn("ChartArea missing for cornerTextPlugin.");
             return;
        }
        const centerX = (chartArea.left + chartArea.right) / 2;

        ctx.save(); // save context state

        // 중앙 상단 2줄
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = 'black';

        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(chart.config._제목 || '', centerX, chartArea.top + 8);

        ctx.font = '14px sans-serif';
        // common.js의 tierMap 또는 tierLabels 사용
        // tierSelect.value는 tierMap의 키 (platinum_plus 등)
        const humanTier    = tierMap[tierSelect.value] || tierSelect.value; // common.js의 tierMap 사용
        const versionTier  = `${chart.config._version || versionSelect.value} | ${humanTier}`; // chart.config에서 버전 가져오기, 없으면 드롭다운 값 사용
        ctx.fillText(versionTier, centerX, chartArea.top + 28);

        // 우측 상단 평균데이터 (값이 있을 때만)
        const avgPick = chart.config._평균픽률; // calculateFinalStatsForPeriod 결과 기반 평균 픽률 (%)
        const avgRP   = chart.config._가중평균RP; // calculateFinalStatsForPeriod 결과 기반 가중 평균 RP
        const avgWin  = chart.config._가중평균승률; // calculateFinalStatsForPeriod 결과 기반 가중 평균 승률 (%)

        ctx.textAlign = 'right';
        ctx.font      = '14px sans-serif';

        // 값이 숫자일 경우에만 표시하고, 소수점 포맷팅 적용
        if (typeof avgPick === 'number' && avgPick !== null && !isNaN(avgPick)) {
          ctx.fillText(
            `평균 픽률: ${avgPick.toFixed(2)}%`, // 이미 백분율
            chartArea.right - 10,
            chartArea.top + 8
          );
        }
        if (typeof avgRP === 'number' && avgRP !== null && !isNaN(avgRP)) {
          ctx.fillText(
            `평균 RP: ${avgRP.toFixed(1)}`,
            chartArea.right - 10,
            chartArea.top + 28
          );
        }
        if (typeof avgWin === 'number' && avgWin !== null && !isNaN(avgWin)) {
          ctx.fillText(
            `평균 승률: ${avgWin.toFixed(2)}%`, // 이미 백분율
            chartArea.right - 10,
            chartArea.top + 48
          );
        }

        ctx.restore(); // restore context state
      }
  };
});