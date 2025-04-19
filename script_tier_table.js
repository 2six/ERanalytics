document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const tierContainer = document.getElementById('tier-container');

    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const tierConfig = parseINI(iniString).tiers;
        initDropdowns(versionList);
        versionSelect.addEventListener('change', triggerLoad);
        tierSelect.addEventListener('change', triggerLoad);
        periodSelect.addEventListener('change', triggerLoad);
        triggerLoad();
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
        Object.keys(tierMap).forEach(tier => {
            tierSelect.innerHTML += `<option value="${tier}">${tierMap[tier]}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">버전 전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;
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
                renderTierTable(latestData, tier);
            });
    }

    function renderTierTable(data, tierKey) {
        const tiers = { S: [], A: [], B: [], C: [], D: [], F: [] };

        const config = {
            S: 0.15,
            A: 0.05,
            B: -0.05,
            C: -0.15,
            D: -0.25
        };

        const avgScore = data.reduce((a, b) => a + b["점수"] ?? 0, 0) / data.length;

        data.forEach(entry => {
            const score = entry["점수"] ?? 0;
            const diff = score - avgScore;
            let group = 'F';
            if (diff > avgScore * config.S) group = 'S';
            else if (diff > avgScore * config.A) group = 'A';
            else if (diff > avgScore * config.B) group = 'B';
            else if (diff > avgScore * config.C) group = 'C';
            else if (diff > avgScore * config.D) group = 'D';
            tiers[group].push(entry);
        });

        tierContainer.innerHTML = '';
        Object.entries(tiers).forEach(([tier, list]) => {
            let html = `<div class="tier-section"><h2 class="tier-title">${tier}</h2><div class="tier-list">`;
            list.forEach(item => {
                const name = item["실험체"];
                const imgSrc = `https://cdn.dak.gg/er/characters/${encodeURIComponent(name)}.webp`;
                html += `<div class="character"><img src="${imgSrc}" alt="${name}" title="${name}"/></div>`;
            });
            html += '</div></div>';
            tierContainer.innerHTML += html;
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
});
