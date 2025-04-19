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

        versionSelect.addEventListener('change', triggerLoad);
        tierSelect.addEventListener('change', triggerLoad);
        periodSelect.addEventListener('change', triggerLoad);
    }

    function triggerLoad() {
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

                drawTierTable(dataToUse);
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
            if (parts.length >= 2) {
                return `${parts[1]}-${parts[0]}`;
            }
        }
        return experimentName;
    }

    function drawTierTable(data) {
        const tiers = ["S+", "S", "A", "B", "C", "D", "F"];
        const tierGroups = {};
        tiers.forEach(t => tierGroups[t] = []);

        data.forEach(entry => {
            const match = entry.실험체.match(/^(.*?) (.+)$/);
            if (!match) return;
            const [, weapon, name] = match;
            const tier = entry.티어 || "F";
            tierGroups[tier].push({ name, weapon, full: entry.실험체, score: entry.점수 });
        });

        const table = document.getElementById('tier-table');
        let html = '';

        tiers.forEach(tier => {
            html += `<tr class="tier-row"><th>${tier}</th><td><div>`;
            const sorted = tierGroups[tier].sort((a, b) => b.score - a.score);
            sorted.forEach((e, i) => {
                const imgName = convertExperimentNameToImageName(e.full).replace(/ /g, '_');
                html += `<img src="image/${imgName}.png" alt="${e.full}" title="${e.full}">`;
                if ((i + 1) % 10 === 0 && i !== sorted.length - 1) html += '</div><div>';
            });
            html += '</div></td></tr>';
        });

        table.innerHTML = html;
    }
});
