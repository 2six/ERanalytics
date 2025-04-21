// script_tier_table.js

document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const popupBtn      = document.getElementById('popup-table-button');
    const popupMask     = document.getElementById('image-popup');
    const popupImage    = document.getElementById('popup-image');
    const popupClose    = document.querySelector('.image-popup-close');
  
    let tierConfigGlobal = null;
    let lastData         = [];
  
    // --- URL 파라미터 헬퍼 -----------------------------------------------
    function getParam(key, def) {
      const p = new URLSearchParams(location.search).get(key);
      return p !== null ? p : def;
    }
    function setParam(key, val) {
      const params = new URLSearchParams(location.search);
      params.set(key, val);
      history.replaceState(null, '', '?' + params.toString());
    }
  
    // --- INI 파싱 -------------------------------------------------------
    function parseINI(text) {
      const cfg = {}, sectionRE = /^\s*\[(.+)\]\s*$/, kvRE = /^\s*([^=]+?)\s*=\s*(.*?)\s*$/;
      let current = null;
      text.split(/\r?\n/).forEach(line => {
        if (/^\s*(;|#|$)/.test(line)) return;
        const mS = line.match(sectionRE);
        if (mS) {
          current = mS[1];
          cfg[current] = {};
        } else {
          const mK = line.match(kvRE);
          if (mK && current) cfg[current][mK[1]] = mK[2];
        }
      });
      return cfg;
    }
  
    // --- 드롭다운 초기화 -----------------------------------------------
    function initDropdowns(versions) {
      // 버전
      versionSelect.innerHTML = '';
      versions.sort().reverse().forEach(v => {
        versionSelect.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
      });
      // 티어
      const tierMap = {
        platinum_plus:  "플래티넘+",
        diamond_plus:   "다이아몬드+",
        meteorite_plus: "메테오라이트+",
        mithril_plus:   "미스릴+",
        in1000:         "in1000"
      };
      tierSelect.innerHTML = '';
      Object.entries(tierMap).forEach(([val, label]) => {
        tierSelect.insertAdjacentHTML('beforeend', `<option value="${val}">${label}</option>`);
      });
      // 구간
      periodSelect.innerHTML = `
        <option value="latest">전체</option>
        <option value="3day">최근 3일</option>
        <option value="7day">최근 7일</option>
      `;
  
      // URL → 드롭다운 초기값 싱크
      versionSelect.value = getParam('version', versions[0]);
      tierSelect.value    = getParam('tier', 'diamond_plus');
      periodSelect.value  = getParam('period', 'latest');
  
      // 변경 시 URL 업데이트 + 재렌더
      [versionSelect, tierSelect, periodSelect].forEach(el => {
        el.addEventListener('change', () => {
          setParam(el.id.replace('-select',''), el.value);
          loadAndRender();
        });
      });
    }
  
    // --- 데이터 로드 & 렌더 ---------------------------------------------
    function loadAndRender() {
      const version = versionSelect.value;
      const tier    = tierSelect.value;
      const period  = periodSelect.value;
  
      // 설정 & 버전 로드 (INI → tierConfigGlobal, versions.json)
      Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
      ])
      .then(([iniText, versions]) => {
        tierConfigGlobal = parseINI(iniText).tiers;
        initDropdowns(versions);
        return fetch(`/data/${version}/${tier}.json`);
      })
      .then(r => r.json())
      .then(json => {
        const history = json['통계'];
        const entries = extractPeriodEntries(history, period);
        const avgScore = calculateAverageScore(entries);
        const stddev   = calculateStandardDeviation(entries, avgScore);
        lastData = calculateTiers(entries, avgScore, stddev, tierConfigGlobal);
        displayTierTable(lastData);
        setupTablePopup();
      })
      .catch(err => {
        console.error('데이터 로드 실패:', err);
        document.getElementById('tier-table').innerHTML =
          `<tr><td colspan="15">데이터를 불러오는 데 실패했습니다.</td></tr>`;
      });
    }
  
    // --- 기간별 데이터 추출 ---------------------------------------------
    function extractPeriodEntries(history, period) {
      const keys = Object.keys(history).sort();
      const latest = history[keys[keys.length - 1]];
      if (period === 'latest') return latest;
  
      const days = period === '3day' ? 3 : 7;
      const lt = new Date(keys[keys.length - 1].replace(/_/g,':').replace(/-/g,'/'));
      const cutoff = new Date(lt); cutoff.setDate(cutoff.getDate() - days);
  
      const pastKey = keys.slice().reverse().find(k => {
        const d = new Date(k.replace(/_/g,':').replace(/-/g,'/'));
        return d <= cutoff;
      });
      if (!pastKey) return latest;
  
      const prev = history[pastKey];
      const mapL = Object.fromEntries(latest.map(d=>[d.실험체,d]));
      const mapP = Object.fromEntries(prev  .map(d=>[d.실험체,d]));
      const delta = [];
      for (let name in mapL) {
        const c = mapL[name], p = mapP[name];
        if (!p) continue;
        const diff = c['표본수'] - p['표본수'];
        if (diff <= 0) continue;
        delta.push({
          '실험체': name,
          '표본수': diff,
          'RP 획득': (c['RP 획득']*c['표본수'] - p['RP 획득']*p['표본수'])/diff,
          '승률':      (c['승률']*c['표본수']      - p['승률']*p['표본수'])      /diff,
          'TOP 3':    (c['TOP 3']*c['표본수']      - p['TOP 3']*p['표본수'])    /diff,
          '평균 순위':(c['평균 순위']*c['표본수']  - p['평균 순위']*p['표본수']) /diff
        });
      }
      return delta;
    }
  
    // --- 점수·티어 계산 유틸 ---------------------------------------------
    function getRPScore(rp){ return rp>=0?Math.log(rp+1)*3:-Math.log(-rp+1)*2; }
    function calculateTier(score, avg, std, cfg){
      const d = score-avg;
      if (d > std*parseFloat(cfg['S+'])) return 'S+';
      if (d > std*parseFloat(cfg['S']))  return 'S';
      if (d > std*parseFloat(cfg['A']))  return 'A';
      if (d > std*parseFloat(cfg['B']))  return 'B';
      if (d > std*parseFloat(cfg['C']))  return 'C';
      if (d > std*parseFloat(cfg['D']))  return 'D';
      return 'F';
    }
    function calculateAverageScore(data){
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      let sumRP=0,sumW=0,sumT3=0;
      data.forEach(i=>{
        const w=i['표본수']/total;
        sumRP+=i['RP 획득']*w;
        sumW +=i['승률']   *w;
        sumT3+=i['TOP 3'] *w;
      });
      return getRPScore(sumRP)+sumW*9+sumT3*3;
    }
    function calculateStandardDeviation(data, avg){
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      return Math.sqrt(data.reduce((s,i)=>{
        const sc = getRPScore(i['RP 획득']) + i['승률']*9 + i['TOP 3']*3;
        return s + Math.pow(sc-avg,2)*(i['표본수']/total);
      },0));
    }
    function calculateTiers(data, avg, std, cfg){
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      const avgPick = data.length
        ? data.reduce((s,i)=>s + (i['표본수']/total),0) / data.length
        : 1;
      return data.map(i=>{
        const pr = i['표본수']/total;
        const r  = avgPick ? pr/avgPick : 1;
        const k  = 1.5;
        const w0 = r<=1/3
          ? 0.6 + 0.2*(1-Math.exp(-k*3*r))/(1-Math.exp(-k))
          : 0.8 + 0.2*(1-Math.exp(-k*1.5*(r-1/3)))/(1-Math.exp(-k));
        const w1 = 1 - w0;
        let f = 0.85 + 0.15*(1-Math.exp(-k*r))/(1-Math.exp(-k));
        if (r>5) f += 0.05*(1-Math.min((r-5)/5,1));
        const base = getRPScore(i['RP 획득']) + i['승률']*9 + i['TOP 3']*3;
        let score;
        if (i['표본수'] < total*avgPick) {
          score = base*(w0 + w1*Math.min(1,pr/avgPick))
                + avg*w1*(1-Math.min(1,pr/avgPick));
          score *= f;
        } else {
          score = base * f;
        }
        return {
          ...i,
          '점수': parseFloat(score.toFixed(2)),
          '티어': calculateTier(score,avg,std,cfg),
          '픽률': parseFloat((pr*100).toFixed(2))
        };
      });
    }
  
    // --- 티어표 렌더링 ----------------------------------------------------
    function displayTierTable(data) {
      const tiers = ['S+','S','A','B','C','D','F'];
      const groups = tiers.reduce((o,t)=>(o[t]=[],o),{});
      data.forEach(i=>groups[i.티어].push(i));
  
      const table = document.getElementById('tier-table');
      const totalSample = data.reduce((s,i)=>s+i['표본수'],0);
      const perRow = 15;
      let html = '';
  
      tiers.forEach(tier=>{
        html += `<tr class="tier-row tier-${tier}"><th>${tier}</th><td><div>`;
        const list = groups[tier].sort((a,b)=>b.점수 - a.점수);
        if (list.length===0) {
          html += `<span class="tooltip-container">
                     <img src="/image/placeholder.png" style="opacity:0">
                     <div class="tooltip-box">빈 슬롯</div>
                   </span>`;
        } else {
          list.forEach((e,i)=>{
            const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
            html += `<span class="tooltip-container">
                       <img src="/image/${imgName}.png" alt="${e.실험체}">
                       <div class="tooltip-box">
                         ${e.실험체}<br>
                         픽률: ${(e['표본수']/totalSample*100).toFixed(2)}%<br>
                         RP: ${e['RP 획득'].toFixed(1)}<br>
                         승률: ${(e['승률']*100).toFixed(1)}%
                       </div>
                     </span>`;
            if ((i+1)%perRow===0 && i!==list.length-1) html += '</div><div>';
          });
        }
        html += '</div></td></tr>';
      });
  
      table.innerHTML = html;
    }
  
    // --- 팝업 설정 --------------------------------------------------------
    function setupTablePopup() {
      popupBtn.addEventListener('click', ()=>{
        html2canvas(document.querySelector('.tier-table')).then(canvas=>{
          popupMask.style.display = 'block';
          popupImage.src = canvas.toDataURL();
        });
      });
      popupClose.addEventListener('click', ()=>popupMask.style.display='none');
      popupMask.addEventListener('click', e=>{
        if (e.target===popupMask) popupMask.style.display='none';
      });
    }
  
    // --- 실험체명 → 이미지 파일명 ------------------------------------------
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
        const [a,b] = name.split(" ");
        return `${b}-${a}`;
      }
      return name;
    }
  
    // 최초 실행
    loadAndRender();
  });
  