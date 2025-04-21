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
    let chartData    = [];
    let filteredData = [];
    let myChart      = null;
    let currentTab   = 'pick-rp';

    // 1) 초기화: 버전/티어/구간 불러오고, 드롭다운 & 탭 & 필터 셋업
    fetch('/versions.json')
      .then(r => r.json())
      .then(versions => {
        // 드롭다운 채우기 (common.js 함수 사용)
        populateVersionDropdown(versionSelect, versions);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // URL → 드롭다운 초기값
        versionSelect.value = getParam('version', versions.sort().reverse()[0]);
        tierSelect.value    = getParam('tier',    'diamond_plus');
        periodSelect.value  = getParam('period',  'latest');

        // 드롭다운 변경 시 URL 갱신 + 재로드
        versionSelect.addEventListener('change', () => {
          setParam('version', versionSelect.value);
          loadData();
        });
        tierSelect.addEventListener('change', () => {
          setParam('tier', tierSelect.value);
          loadData();
        });
        periodSelect.addEventListener('change', () => {
          setParam('period', periodSelect.value);
          loadData();
        });

        // 탭 및 필터 셋업
        setupGraphTabs();
        setupFilterListeners();

        // 팝업 버튼 & 닫기 셋업
        popupButton.addEventListener('click', () => {
          html2canvas(canvas).then(c => {
            popup.style.display = 'block';
            popupImage.src = c.toDataURL();
          });
        });
        popupClose.addEventListener('click', () => {
          popup.style.display = 'none';
        });

        // 최초 데이터 로드
        loadData();
      })
      .catch(err => console.error('초기화 실패:', err));

    // 2) 탭 이벤트 바인딩
    function setupGraphTabs() {
      document.querySelectorAll('.graph-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.dataset.type;
          applyFilters();
          createGraph(currentTab);
        });
      });
    }

    // 3) 필터(체크박스) 리스너
    function setupFilterListeners() {
      lowPickrateCheckbox.addEventListener('change', () => {
        applyFilters();
        createGraph(currentTab);
      });
      highPickrateCheckbox.addEventListener('change', () => {
        applyFilters();
        createGraph(currentTab);
      });
    }

    // 4) 데이터 로드 → 필터 적용 → 그래프 생성
    function loadData() {
      const version = versionSelect.value;
      const tier    = tierSelect.value;
      const period  = periodSelect.value;

      fetch(`/data/${version}/${tier}.json`)
        .then(r => r.json())
        .then(json => {
          chartData = extractPeriodEntries(json['통계'], period);
          applyFilters();
          createGraph(currentTab);
        })
        .catch(err => console.error('데이터 로드 실패:', err));
    }

    // 5) 체크박스 필터 적용
    function applyFilters() {
      const totalSample = chartData.reduce((s, d) => s + d['표본수'], 0);
      const avgPickRate = chartData.reduce((s, d) => s + d['표본수'] / totalSample, 0) / chartData.length;
      filteredData = chartData.filter(d => {
        const pr = d['표본수'] / totalSample;
        if (lowPickrateCheckbox.checked  && pr < avgPickRate / 4) return false;
        if (highPickrateCheckbox.checked && pr > avgPickRate * 5) return false;
        return true;
      });
    }

    // 6) 그래프 생성
    function createGraph(type) {
      const maps = {
        'pick-rp': { xKey:'픽률',    yKey:'RP 획득', radiusKey:'승률',    title:'픽률 / RP 획득' },
        'pick-win':{ xKey:'픽률',    yKey:'승률',    radiusKey:'RP 획득',title:'픽률 / 승률' },
        'rp-win':  { xKey:'RP 획득', yKey:'승률',    radiusKey:'픽률',   title:'RP 획득 / 승률' }
      };
      const { xKey,yKey,radiusKey,title } = maps[type];

      const totalSample = chartData.reduce((s, d) => s + d['표본수'], 0);
      const avgPickRate = chartData.reduce((s, d) => s + d['표본수'] / totalSample, 0) / chartData.length;
      const wRP  = chartData.reduce((s, d) => s + d['RP 획득'] * (d['표본수']/totalSample), 0);
      const wWin = chartData.reduce((s, d) => s + d['승률']    * (d['표본수']/totalSample), 0);

      const labels  = filteredData.map(d => d['실험체']);
      const xValues = filteredData.map(d => xKey==='픽률' ? d['표본수']/totalSample : d[xKey]);
      const yValues = filteredData.map(d => yKey==='픽률' ? d['표본수']/totalSample : d[yKey]);
      const rValues = filteredData.map(d => radiusKey==='픽률' ? d['표본수']/totalSample : d[radiusKey]);

      if (myChart) myChart.destroy();
      const ctx = canvas.getContext('2d');
      Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);

      myChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          labels,
          datasets: [{
            data: filteredData.map((d,i)=>({x:xValues[i],y:yValues[i],label:d['실험체']})),
            backgroundColor: ctx => {
              const hue = (ctx.dataIndex * 360 / filteredData.length) % 360;
              return `hsl(${hue},60%,70%,0.8)`;
            },
            pointRadius: ctx => {
              const v = rValues[ctx.dataIndex], min = Math.min(...rValues), max = Math.max(...rValues);
              return min===max ? 15 : 6 + ((v-min)/(max-min))*24;
            },
            pointHoverRadius: ctx => {
              const v = rValues[ctx.dataIndex], min = Math.min(...rValues), max = Math.max(...rValues);
              return min===max ? 15 : 6 + ((v-min)/(max-min))*24;
            }
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend:{ display:false },
            tooltip:{
              callbacks:{
                title:()=>'', 
                label:ctx=>{
                  const d = filteredData[ctx.dataIndex];
                  return [
                    d['실험체'],
                    `픽률: ${(d['표본수']/totalSample*100).toFixed(2)}%`,
                    `RP 획득: ${d['RP 획득'].toFixed(2)}`,
                    `승률: ${(d['승률']*100).toFixed(2)}%`
                  ];
                }
              }
            },
            annotation:{
              annotations:[
                { type:'line', scaleID:'x', value: xKey==='픽률'?avgPickRate: xKey==='승률'?wWin:wRP,
                  borderColor:'#FFEB3B', borderWidth:2, borderDash:[5,5] },
                { type:'line', scaleID:'y', value: yKey==='픽률'?avgPickRate: yKey==='승률'?wWin:wRP,
                  borderColor:'#FFEB3B', borderWidth:2, borderDash:[5,5] }
              ]
            }
          },
          scales:{
            x:{
              title:{ display:true, text:xKey },
              min: xKey==='픽률'?0:undefined,
              max: xKey==='픽률'? Math.ceil(Math.max(...xValues)*500)/500:undefined,
              ticks:{ callback:v=> xKey==='픽률'? (v*100).toFixed(1)+'%': v, stepSize: xKey==='픽률'?0.002:undefined }
            },
            y:{
              title:{ display:true, text:yKey },
              min: yKey==='픽률'?0:undefined,
              max: yKey==='픽률'? Math.ceil(Math.max(...yValues)*500)/500:undefined,
              ticks:{ callback:v=> yKey==='픽률'? (v*100).toFixed(1)+'%': v, stepSize: yKey==='픽률'?0.002:undefined }
            }
          }
        }
      });

      // 메타 정보
      myChart.config._제목        = title;
      myChart.config._평균픽률    = avgPickRate;
      myChart.config._가중평균RP  = wRP;
      myChart.config._가중평균승률 = wWin;
    }

    // 7) 기간별 delta 계산
    function extractPeriodEntries(history, period) {
      const keys = Object.keys(history).sort();
      const latestKey = keys[keys.length-1];
      const latest = history[latestKey];
      if (period==='latest') return latest;

      const days = period==='3day'?3:7;
      const latestDate = new Date(latestKey.replace(/_/g,':').replace(/-/g,'/'));
      const cutoff = new Date(latestDate);
      cutoff.setDate(cutoff.getDate()-days);

      const pastKey = keys.slice().reverse()
        .find(k=> new Date(k.replace(/_/g,':').replace(/-/g,'/')) <= cutoff);
      if (!pastKey) return latest;

      const prev = history[pastKey];
      const currMap = Object.fromEntries(latest.map(d=>[d.실험체,d]));
      const prevMap = Object.fromEntries(prev.map(d=>[d.실험체,d]));
      const delta = [];
      for (const name in currMap) {
        const c=currMap[name], p=prevMap[name];
        if (!p) continue;
        const diff = c['표본수']-p['표본수'];
        if (diff<=0) continue;
        delta.push({
          '실험체': name,
          '표본수': diff,
          'RP 획득': (c['RP 획득']*c['표본수'] - p['RP 획득']*p['표본수'])/diff,
          '승률':    (c['승률']   *c['표본수'] - p['승률']   *p['표본수'])/diff,
          'TOP 3':   (c['TOP 3']  *c['표본수'] - p['TOP 3']  *p['표본수'])/diff,
          '평균 순위': (c['평균 순위']*c['표본수'] - p['평균 순위']*p['표본수'])/diff
        });
      }
      return delta;
    }

    // 8) 레이블 플러그인
    const labelPlugin = {
      id: 'labelPlugin',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        chart.getDatasetMeta(0).data.forEach((pt,i) => {
          const x=pt.x, y=pt.y, lbl=chart.data.labels[i];
          ctx.save();
          ctx.font='10px sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.lineWidth=2; ctx.strokeStyle='white';
          ctx.strokeText(lbl, x, y);
          ctx.fillStyle='black'; ctx.fillText(lbl, x, y);
          ctx.restore();
        });
      }
    };

    // 9) 코너 텍스트 플러그인
    const cornerTextPlugin = {
      id: 'cornerTextPlugin',
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.font='14px sans-serif'; ctx.fillStyle='black';
        ctx.textAlign='left';
        ctx.fillText(chart.config._제목||'', chartArea.left+10, chartArea.top+20);
        ctx.textAlign='right';
        ctx.fillText(`평균 픽률: ${(chart.config._평균픽률*100).toFixed(2)}%`, chartArea.right-10, chartArea.top+20);
        ctx.fillText(`평균 RP: ${chart.config._가중평균RP.toFixed(1)}`, chartArea.right-10, chartArea.top+40);
        ctx.fillText(`평균 승률: ${(chart.config._가중평균승률*100).toFixed(2)}%`, chartArea.right-10, chartArea.top+60);
        ctx.restore();
      }
    };
});
