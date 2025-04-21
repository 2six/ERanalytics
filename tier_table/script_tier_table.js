// script_tier_table.js
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const popupButton   = document.getElementById('popup-table-button');
    const popup         = document.getElementById('image-popup');
    const popupImage    = document.getElementById('popup-image');
    const popupClose    = document.querySelector('.image-popup-close');
  
    // 전역으로 보관할 티어 설정
    let tierConfig = null;
  
    // 읽어들일 config 및 버전 목록
    Promise.all([
      fetch('/config.ini').then(r => r.text()),
      fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
      const cfg = parseINI(iniText);
      tierConfig = cfg.tiers;
  
      initDropdowns(versionList);
      // URL 파라미터가 있으면 초기값으로 설정
      applyParamsToDropdowns();
      loadAndRender();
    });
  
    // 드롭다운 초기화
    function initDropdowns(versionList) {
      versionList.sort().reverse().forEach(v => {
        versionSelect.add(new Option(v, v));
      });
  
      const tierMap = {
        platinum_plus: "플래티넘+",
        diamond_plus:  "다이아몬드+",
        meteorite_plus:"메테오라이트+",
        mithril_plus:  "미스릴+",
        in1000:        "in1000"
      };
      Object.entries(tierMap).forEach(([val, label]) => {
        tierSelect.add(new Option(label, val));
      });
  
      periodSelect.innerHTML = `
        <option value="latest">전체</option>
        <option value="3day">최근 3일</option>
        <option value="7day">최근 7일</option>
      `;
  
      // 변경 시
      [versionSelect, tierSelect, periodSelect].forEach(el =>
        el.addEventListener('change', () => {
          updateURLParams();
          loadAndRender();
        })
      );
    }
  
    // URLSearchParams → 드롭다운에 반영
    function applyParamsToDropdowns() {
      const params = new URLSearchParams(location.search);
      if (params.has('version')) versionSelect.value = params.get('version');
      if (params.has('tier'))    tierSelect.value    = params.get('tier');
      if (params.has('period'))  periodSelect.value  = params.get('period');
    }
  
    // 드롭다운 변경 시 URL에 파라미터를 기록
    function updateURLParams() {
      const params = new URLSearchParams();
      params.set('version', versionSelect.value);
      params.set('tier',    tierSelect.value);
      params.set('period',  periodSelect.value);
      history.replaceState(null, '', `${location.pathname}?${params}`);
    }
  
    // 데이터 로드 후 렌더링
    function loadAndRender() {
      const version = versionSelect.value;
      const tier    = tierSelect.value;
      const period  = periodSelect.value;
  
      fetch(`/data/${version}/${tier}.json`)
        .then(r => r.json())
        .then(json => {
          const history = json['통계'];
          const entries = extractPeriodEntries(history, period);
          const avgScore = calculateAverageScore(entries);
          const stddev   = calculateStandardDeviation(entries, avgScore);
          const scored   = calculateTiers(entries, avgScore, stddev, tierConfig);
          renderTierTable(scored);
        })
        .catch(err => {
          console.error('데이터 로드 실패:', err);
          document.getElementById('tier-table').innerHTML =
            '<tr><td colspan="2">데이터를 불러오는 데 실패했습니다.</td></tr>';
        });
    }
  
    // 티어별 테이블 렌더링
    function renderTierTable(data) {
      const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
      const groups = tiers.reduce((o,t)=> (o[t]=[],o), {});
      data.forEach(item => groups[item.티어]?.push(item));
  
      const totalSample = data.reduce((sum,i)=>sum+i['표본수'],0);
      const perRow = 15;
      let html = '';
  
      tiers.forEach((tier, idx) => {
        const entries = groups[tier].sort((a,b)=>b.점수 - a.점수);
        html += `<tr class="tier-row tier-${tier}">` +
                `<th>${tier}</th><td><div>`;
        if (entries.length === 0) {
          html += `<span class="no-data">빈 슬롯</span>`;
        } else {
          entries.forEach((e,i) => {
            const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
            const tooltip = `
              <div class="tooltip-box">
                ${e.실험체}<br>
                픽률: ${(e['표본수']/totalSample*100).toFixed(2)}%<br>
                RP: ${e['RP 획득'].toFixed(1)}<br>
                승률: ${(e['승률']*100).toFixed(1)}%
              </div>`;
            html += `<span class="tooltip-container">
                       <img src="/image/${imgName}.png" alt="${e.실험체}">${tooltip}
                     </span>`;
            if ((i+1)%perRow===0 && i!==entries.length-1) html += '</div><div>';
          });
        }
        html += '</div></td></tr>';
      });
  
      document.getElementById('tier-table').innerHTML = html;
    }
  
    // 표 이미지 팝업
    popupButton.addEventListener('click', () => {
      html2canvas(document.querySelector('.tier-table')).then(canvas => {
        popupImage.src = canvas.toDataURL();
        popup.style.display = 'block';
      });
    });
    popupClose.addEventListener('click', () => popup.style.display = 'none');
    window.addEventListener('click', e => {
      if (e.target === popup) popup.style.display = 'none';
    });
  
    // ─── 공통 헬퍼 함수들 ─────────────────────────────────
  
    function extractPeriodEntries(history, period) {
      const keys = Object.keys(history).sort();
      const latest = history[keys.pop()];
      if (period === 'latest') return latest;
  
      const days = period==='3day'?3:7;
      const latestDate = new Date(keys[keys.length-1].replace(/_/g,':').replace(/-/g,'/'));
      const cutoff = new Date(latestDate);
      cutoff.setDate(cutoff.getDate() - days);
      const pastKey = Object.keys(history)
        .reverse()
        .find(k => new Date(k.replace(/_/g,':').replace(/-/g,'/')) <= cutoff);
      if (!pastKey) return latest;
  
      const prev = history[pastKey];
      const currMap = Object.fromEntries(latest.map(d=>[d.실험체,d]));
      const prevMap = Object.fromEntries(prev.map(d=>[d.실험체,d]));
      return Object.keys(currMap).flatMap(name => {
        const c = currMap[name], p = prevMap[name];
        if (!p) return [];
        const diff = c['표본수'] - p['표본수'];
        if (diff<=0) return [];
        return {
          '실험체': name,
          '표본수': diff,
          'RP 획득': (c['RP 획득']*c['표본수'] - p['RP 획득']*p['표본수'])/diff,
          '승률':     (c['승률']    *c['표본수'] - p['승률']    *p['표본수'])/diff,
          'TOP 3':   (c['TOP 3']   *c['표본수'] - p['TOP 3']   *p['표본수'])/diff,
          '평균 순위':(c['평균 순위']*c['표본수'] - p['평균 순위']*p['표본수'])/diff
        };
      });
    }
  
    function calculateAverageScore(data) {
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      let sum=0, sumW=0, sumT3=0;
      data.forEach(i=>{
        const w = i['표본수']/total;
        sum   += i['RP 획득']*w;
        sumW  += i['승률']*w;
        sumT3 += i['TOP 3']*w;
      });
      return getRPScore(sum) + sumW*9 + sumT3*3;
    }
  
    function calculateStandardDeviation(data, avg) {
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      return Math.sqrt(data.reduce((acc,i)=>{
        const score = getRPScore(i['RP 획득']) + i['승률']*9 + i['TOP 3']*3;
        return acc + Math.pow(score-avg,2)*(i['표본수']/total);
      },0));
    }
  
    function calculateTiers(data, avg, std, cfg) {
      const total = data.reduce((s,i)=>s+i['표본수'],0);
      const avgPick = data.reduce((s,i)=>s+i['표본수']/total,0)/data.length;
      const k = 1.5;
      return data.map(i=>{
        const r = (i['표본수']/total)/avgPick;
        const rpScore = getRPScore(i['RP 획득']);
        // ... (픽률 보정 등 기존 로직 동일) ...
        // 마지막에 티어 계산
        const diff = score - avg;
        let tier = 'F';
        if (diff>std*cfg['S+']) tier='S+';
        else if (diff>std*cfg['S']) tier='S';
        else if (diff>std*cfg['A']) tier='A';
        else if (diff>std*cfg['B']) tier='B';
        else if (diff>std*cfg['C']) tier='C';
        else if (diff>std*cfg['D']) tier='D';
        return { ...i, 점수: parseFloat(score.toFixed(2)), 티어: tier };
      });
    }
  
    function getRPScore(rp) {
      return rp>=0?Math.log(rp+1)*3 : -Math.log(-rp+1)*2;
    }
  
    function parseINI(txt) {
      const res={}, lines=txt.split('\n'), sectionRe=/^\[(.+)\]$/,
            kvRe=/^([^=]+)=(.*)$/;
      let sec=null;
      lines.forEach(l=>{
        const t=l.trim();
        if (!t || t.startsWith(';')||t.startsWith('#')) return;
        const mSec = t.match(sectionRe);
        if (mSec) { sec=mSec[1]; res[sec]={}; return; }
        const mKv = t.match(kvRe);
        if (mKv && sec) res[sec][mKv[1].trim()]=mKv[2].trim();
      });
      return res;
    }
  
    function convertExperimentNameToImageName(name) {
      if (name==="글러브 리 다이린")     return "리다이린-글러브";
      if (name==="쌍절곤 리 다이린")     return "리다이린-쌍절곤";
      if (name.startsWith("리 다이린 ")) {
        const parts = name.slice(7).split(" ");
        return `리다이린-${parts.join("-")}`;
      }
      if (name.startsWith("돌격 소총 ")) {
        const parts = name.slice(6).split(" ");
        return `${parts.join("-")}-돌격소총`;
      }
      if (name.includes(" ")) {
        const [a,b]=name.split(" ");
        return `${b}-${a}`;
      }
      return name;
    }
  });
  