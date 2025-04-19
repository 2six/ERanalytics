// script_tier_table.js (원본 존중 + 요구사항 반영)

// JSON 구조 및 버전/티어/기간 선택 드롭다운 연동 + 기존 기능 유지

// === 데이터 불러오기 ===
document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
  
    Promise.all([
      fetch('config.ini').then(r => r.text()),
      fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
      const tierConfig = parseINI(iniString).tiers;
      initDropdowns(versionList);
      triggerLoad(tierConfig);
    });
  
    function initDropdowns(versionList) {
      versionList.sort().reverse().forEach(v => {
        versionSelect.innerHTML += `<option value="${v}">${v}</option>`;
      });
  
      const tierMap = {
        "platinum_plus": "플래티넘+",
        "diamond_plus": "다이아몬드+",
        "meteorite_plus": "메테오라이트+",
        "mithril_plus": "미스릴+",
        "in1000": "in1000"
      };
  
      Object.entries(tierMap).forEach(([key, val]) => {
        tierSelect.innerHTML += `<option value="${key}">${val}</option>`;
      });
  
      periodSelect.innerHTML = `
        <option value="latest">전체</option>
        <option value="3day">최근 3일</option>
        <option value="7day">최근 7일</option>
      `;
  
      versionSelect.addEventListener('change', () => triggerLoad());
      tierSelect.addEventListener('change', () => triggerLoad());
      periodSelect.addEventListener('change', () => triggerLoad());
    }
  
    function triggerLoad(tierConfig) {
      const version = versionSelect.value;
      const tier = tierSelect.value;
      const period = periodSelect.value;
  
      fetch(`data/${version}/${tier}.json`)
        .then(res => res.json())
        .then(json => {
          const history = json["통계"];
          const timestamps = Object.keys(history).sort();
          const latestKey = timestamps[timestamps.length - 1];
          const latestData = history[latestKey];
  
          let dataToUse = latestData;
  
          if (period !== 'latest') {
            const days = period === '3day' ? 3 : 7;
            const latestDate = new Date(latestKey);
            const pastDate = new Date(latestDate);
            pastDate.setDate(pastDate.getDate() - days);
  
            const pastKey = timestamps.reverse().find(ts => new Date(ts) <= pastDate);
  
            if (pastKey && history[pastKey]) {
              const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
              const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));
  
              const delta = [];
              for (const name in currMap) {
                const curr = currMap[name];
                const prev = prevMap[name];
                if (!prev) continue;
                const diffSample = curr["표본수"] - prev["표본수"];
                if (diffSample <= 0) continue;
  
                delta.push({
                  "실험체": name,
                  "표본수": diffSample,
                  "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diffSample,
                  "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diffSample,
                  "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diffSample,
                  "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diffSample
                });
              }
  
              dataToUse = delta;
            }
          }
  
          const avgScore = calculateAverageScore(dataToUse);
          const scored = calculateTiers(dataToUse, avgScore, tierConfig);
          displayTierTable(scored);
        });
    }
  
    function parseINI(iniString) {
      const config = {};
      let currentSection = null;
      iniString.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;
        const section = trimmed.match(/^\[(.*)\]$/);
        if (section) {
          currentSection = section[1];
          config[currentSection] = {};
          return;
        }
        const kv = trimmed.match(/^([^=]+)=(.*)$/);
        if (kv) config[currentSection][kv[1].trim()] = kv[2].trim();
      });
      return config;
    }
  
    function calculateAverageScore(data) {
      const totalSample = data.reduce((sum, i) => sum + i["표본수"], 0);
      const avgRP = data.reduce((s, i) => s + i["RP 획득"] * i["표본수"], 0) / totalSample;
      const avgWin = data.reduce((s, i) => s + i["승률"] * i["표본수"], 0) / totalSample;
      const avgTop3 = data.reduce((s, i) => s + i["TOP 3"] * i["표본수"], 0) / totalSample;
      return getRPScore(avgRP) + avgWin * 9 + avgTop3 * 3;
    }
  
    function getRPScore(rp) {
      return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2;
    }
  
    function calculateTiers(data, avgScore, config) {
      return data.map(item => {
        const score = getRPScore(item["RP 획득"]) + item["승률"] * 9 + item["TOP 3"] * 3;
        const tier = calculateTier(score, avgScore, config);
        return { ...item, 티어: tier, 점수: score };
      });
    }
  
    function calculateTier(score, avgScore, config) {
      const diff = score - avgScore;
      if (diff > avgScore * parseFloat(config["S+"])) return "S+";
      if (diff > avgScore * parseFloat(config["S"])) return "S";
      if (diff > avgScore * parseFloat(config["A"])) return "A";
      if (diff > avgScore * parseFloat(config["B"])) return "B";
      if (diff > avgScore * parseFloat(config["C"])) return "C";
      if (diff > avgScore * parseFloat(config["D"])) return "D";
      return "F";
    }
  
    function convertExperimentNameToImageName(experimentName) {
      if (experimentName === "글러브 리 다이린") {
        return "리다이린-글러브";
      } else if (experimentName === "쌍절곤 리 다이린") {
        return "리다이린-쌍절곤";
      } else if (experimentName.startsWith("리 다이린 ")) {
        const parts = experimentName.substring("리 다이린 ".length).split(" ");
        return `리다이린-${parts.join("-")}`;
      } else if (experimentName.startsWith("돌격 소총 ")) {
        const parts = experimentName.substring("돌격 소총 ".length).split(" ");
        return `${parts.join("-")}-돌격소총`;
      } else if (experimentName.includes(" ")) {
        const parts = experimentName.split(" ");
        if (parts.length >= 2) return `${parts[1]}-${parts[0]}`;
      }
      return experimentName;
    }
  
    function displayTierTable(data) {
      const tiers = ["S+", "S", "A", "B", "C", "D", "F"];
      const tierGroups = {};
      tiers.forEach(t => tierGroups[t] = []);
  
      data.forEach(entry => {
        const tier = entry.티어;
        tierGroups[tier].push(entry);
      });
  
      const table = document.getElementById('tier-table');
      let html = '';
  
      tiers.forEach((tier, index) => {
        html += `<tr class="tier-row tier-${tier}"><th>${tier}</th><td><div>`;
        tierGroups[tier].forEach((entry, i) => {
          const imgName = convertExperimentNameToImageName(entry.실험체).replace(/ /g, '_');
          html += `<img src="image/${imgName}.png" alt="${entry.실험체}" title="${entry.실험체}">`;
          if ((i + 1) % 10 === 0 && i !== tierGroups[tier].length - 1) html += '</div><div>';
        });
        html += '</div></td></tr>';
      });
  
      table.innerHTML = html;
    }
});  