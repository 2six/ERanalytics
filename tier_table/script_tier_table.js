// script_statistics.js

document.addEventListener('DOMContentLoaded', function() {
    const versionSelect    = document.getElementById('version-select');
    const tierSelect       = document.getElementById('tier-select');
    const periodSelect     = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');
  
    let lastData = [];
    let currentSortColumn = '점수';
    let currentSortAsc    = false;
  
    // --- URL 파라미터 읽어서 컨트롤 초기화 ---
    function applyParamsToControls() {
      const params = new URLSearchParams(location.search);
      if (params.has('version'))    versionSelect.value    = params.get('version');
      if (params.has('tier'))       tierSelect.value       = params.get('tier');
      if (params.has('period'))     periodSelect.value     = params.get('period');
      if (params.get('gradient')==='1') gradientCheckbox.checked = true;
    }
  
    // --- 컨트롤 상태를 URL 파라미터로 반영 ---
    function updateUrlParams() {
      const params = new URLSearchParams();
      params.set('version', versionSelect.value);
      params.set('tier',    tierSelect.value);
      params.set('period',  periodSelect.value);
      if (gradientCheckbox.checked) params.set('gradient','1');
      history.replaceState(null, '', location.pathname + '?' + params.toString());
    }
  
    // --- 공통 모듈 로드 & 드롭다운 초기화 ---
    Promise.all([
      fetch('/config.ini').then(r => r.text()),
      fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
      const config     = parseINI(iniText);
      const tierConfig = config.tiers;
  
      populateVersionDropdown(versionSelect, versionList);
      populateTierDropdown(tierSelect);
      populatePeriodDropdown(periodSelect);
  
      applyParamsToControls();
  
      // 컨트롤 변경 시 URL 갱신 + 화면 갱신
      [versionSelect, tierSelect, periodSelect].forEach(el =>
        el.addEventListener('change', () => {
          updateUrlParams();
          loadAndDisplay(tierConfig);
        })
      );
      gradientCheckbox.addEventListener('change', () => {
        updateUrlParams();
        renderTable(lastData);
      });
  
      // 최초 로드
      loadAndDisplay(tierConfig);
    });
  
    // --- 데이터 로드 & 렌더링 ---
    function loadAndDisplay(tierConfig) {
      const version = versionSelect.value;
      const tier    = tierSelect.value;
      const period  = periodSelect.value;
  
      fetch(`/data/${version}/${tier}.json`)
        .then(res => res.json())
        .then(json => {
          const history = json['통계'];
          const entries = extractPeriodEntries(history, period);
  
          const avgScore = calculateAverageScore(entries);
          const stddev   = calculateStandardDeviation(entries, avgScore);
  
          let scored = calculateTiers(entries, avgScore, stddev, tierConfig);
          scored = sortData(scored, currentSortColumn, currentSortAsc);
  
          lastData = scored;
          renderTable(scored);
        })
        .catch(err => {
          console.error('데이터 로드 실패:', err);
          document.getElementById('data-container').innerText = '데이터를 불러오는데 실패했습니다.';
        });
    }
  
    // --- 기간별 데이터 추출 ---
    function extractPeriodEntries(history, period) {
      const keys = Object.keys(history).sort();
      const latest = history[keys.pop()];
      if (period === 'latest') return latest;
  
      const days = period==='3day'?3:7;
      const latestDate = new Date(keys[keys.length-1].replace(/_/g,':').replace(/-/g,'/'));
      const cutoff = new Date(latestDate);
      cutoff.setDate(cutoff.getDate() - days);
  
      const pastKey = Object.keys(history).reverse().find(k =>
        new Date(k.replace(/_/g,':').replace(/-/g,'/')) <= cutoff
      );
      if (!pastKey) return latest;
  
      const prev = history[pastKey];
      const currMap = Object.fromEntries(latest.map(d=>[d.실험체,d]));
      const prevMap = Object.fromEntries(prev.map(d=>[d.실험체,d]));
      const delta = [];
      for (const name in currMap) {
        const c = currMap[name], p = prevMap[name];
        if (!p) continue;
        const diff = c['표본수'] - p['표본수'];
        if (diff<=0) continue;
        delta.push({
          '실험체': name,
          '표본수': diff,
          'RP 획득': (c['RP 획득']*c['표본수'] - p['RP 획득']*p['표본수'])/diff,
          '승률':    (c['승률']*c['표본수']    - p['승률']*p['표본수'])/diff,
          'TOP 3':  (c['TOP 3']*c['표본수']    - p['TOP 3']*p['표본수'])/diff,
          '평균 순위': (c['평균 순위']*c['표본수'] - p['평균 순위']*p['표본수'])/diff
        });
      }
      return delta;
    }
  
    // --- 가중 평균 점수 계산 ---
    function calculateAverageScore(data) {
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      const wRP  = data.reduce((s,i)=>s + i['RP 획득']*(i['표본수']/total),0);
      const wWin = data.reduce((s,i)=>s + i['승률']   *(i['표본수']/total),0);
      const wT3  = data.reduce((s,i)=>s + i['TOP 3'] *(i['표본수']/total),0);
      return getRPScore(wRP) + wWin*9 + wT3*3;
    }
  
    // --- 표준편차 계산 ---
    function calculateStandardDeviation(data, avg) {
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      return Math.sqrt(data.reduce((sum,i)=>{
        const score = getRPScore(i['RP 획득']) + i['승률']*9 + i['TOP 3']*3;
        return sum + Math.pow(score-avg,2)*(i['표본수']/total);
      },0));
    }
  
    // --- RP 점수 변환 ---
    function getRPScore(rp) {
      return rp>=0? Math.log(rp+1)*3 : -Math.log(-rp+1)*2;
    }
  
    // --- 티어 계산 & 정렬용 데이터 생성 ---
    function calculateTiers(data, avg, std, cfg) {
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      const avgPick = data.reduce((s,i)=>s + (i['표본수']/total),0)/data.length;
      const k = 1.5;
      return data.map(i => {
        const pickRate = i['표본수']/total;
        const r = pickRate/avgPick;
        const originReflect = r<=1/3
          ? 0.6 + 0.2*(1 - Math.exp(-k*3*r))/(1-Math.exp(-k))
          : 0.8 + 0.2*(1 - Math.exp(-k*1.5*(r-1/3)))/(1-Math.exp(-k));
        const avgReflect = 1-originReflect;
        let coef = 0.85 + 0.15*(1-Math.exp(-k*r))/(1-Math.exp(-k));
        if (r>5) coef += 0.05*(1-Math.min((r-5)/5,1));
        const rpS = getRPScore(i['RP 획득']);
        let score = (rpS + i['승률']*9 + i['TOP 3']*3) * coef;
        if (i['표본수'] < total*avgPick) {
          score = (rpS + i['승률']*9 + i['TOP 3']*3) *
                   (originReflect + avgReflect*Math.min(1,pickRate/avgPick))
                + avg*avgReflect*(1-Math.min(1,pickRate/avgPick));
          score *= coef;
        }
        const diff = score - avg;
        let tier = 'F';
        if (diff> std*parseFloat(cfg['S+'])) tier='S+';
        else if (diff> std*parseFloat(cfg['S'])) tier='S';
        else if (diff> std*parseFloat(cfg['A'])) tier='A';
        else if (diff> std*parseFloat(cfg['B'])) tier='B';
        else if (diff> std*parseFloat(cfg['C'])) tier='C';
        else if (diff> std*parseFloat(cfg['D'])) tier='D';
        return {
          '실험체':  i['실험체'],
          '점수':     parseFloat(score.toFixed(2)),
          '티어':     tier,
          '픽률':     parseFloat((pickRate*100).toFixed(2)),
          'RP 획득': parseFloat(i['RP 획득'].toFixed(1)),
          '승률':     parseFloat((i['승률']*100).toFixed(2)),
          'TOP 3':   parseFloat((i['TOP 3']*100).toFixed(2)),
          '평균 순위':parseFloat(i['평균 순위'].toFixed(1))
        };
      });
    }
  
    // --- 데이터 정렬 ---
    function sortData(arr, col, asc) {
      return [...arr].sort((a,b) => {
        const va = a[col], vb = b[col];
        return (typeof va==='number' ? (asc? va-vb : vb-va)
                                   : (asc? va.localeCompare(vb) : vb.localeCompare(va)));
      });
    }
  
    // --- 테이블 렌더링 ---
    function renderTable(data) {
      const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];
      let html = '<table><thead><tr>';
      cols.forEach(c => html += `<th data-col="${c}" style="cursor:pointer">${c}</th>`);
      html += '</tr></thead><tbody>';
  
      data.forEach(r => {
        html += '<tr>';
        cols.forEach(c => {
          let v = r[c];
          if (['픽률','승률','TOP 3'].includes(c)) v = v.toFixed(2)+'%';
          html += `<td>${v}</td>`;
        });
        html += '</tr>';
      });
  
      html += '</tbody></table>';
      const container = document.getElementById('data-container');
      container.innerHTML = html;
  
      // 헤더 클릭 이벤트 & 표시
      container.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.col;
          if (currentSortColumn===col) currentSortAsc=!currentSortAsc;
          else { currentSortColumn=col; currentSortAsc=false; }
          lastData = sortData(lastData, currentSortColumn, currentSortAsc);
          renderTable(lastData);
        });
      });
  
      if (gradientCheckbox.checked) applyGradientColors();
    }
  
    // --- 그라디언트 컬러 ---
    function applyGradientColors() {
      const table   = document.querySelector('#data-container table');
      if (!table) return;
      const rows    = [...table.querySelectorAll('tbody tr')];
      const headers = [...table.querySelectorAll('thead th')];
      const goodCols = ['점수','픽률','RP 획득','승률','TOP 3'];
      const badCols  = ['평균 순위'];
  
      headers.forEach((th,i) => {
        const col = th.dataset.col;
        if (![...goodCols,...badCols].includes(col)) return;
        const vals = rows.map(r => parseFloat(r.children[i].textContent.replace('%','')));
        const avg  = vals.reduce((s,v)=>s+v,0)/vals.length;
        const min  = Math.min(...vals), max = Math.max(...vals);
  
        rows.forEach((r,idx) => {
          const v = vals[idx];
          let ratio, color;
          const isBad = badCols.includes(col);
          if (!isBad) {
            if (v>=avg) {
              ratio = max===avg?0:(v-avg)/(max-avg);
              color = interpolateColor([255,255,255],[230,124,115],ratio);
            } else {
              ratio = avg===min?0:(avg-v)/(avg-min);
              color = interpolateColor([255,255,255],[164,194,244],ratio);
            }
          } else {
            if (v<=avg) {
              ratio = avg===min?0:(avg-v)/(avg-min);
              color = interpolateColor([255,255,255],[230,124,115],ratio);
            } else {
              ratio = max===avg?0:(v-avg)/(max-avg);
              color = interpolateColor([255,255,255],[164,194,244],ratio);
            }
          }
          r.children[i].style.backgroundColor = color;
        });
      });
    }
  
    // --- 색상 보간 헬퍼 ---
    function interpolateColor(start, end, ratio) {
      const t = Math.max(0,Math.min(1,ratio));
      return 'rgb(' + start.map((s,i)=>Math.round(s + (end[i]-s)*t)).join(',') + ')';
    }
  
  });
  