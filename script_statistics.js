document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');

    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniString, versionsData]) => {
        const tierConfig = parseINI(iniString).tiers;
        initDropdowns(versionsData);

        document.getElementById('load-button').addEventListener('click', () => {
            const version = versionSelect.value;
            const tier = tierSelect.value;
            const period = periodSelect.value;
            loadAndRender(version, tier, period, tierConfig);
        });
    });

    function initDropdowns(versionsData) {
        const sortedVersions = Object.keys(versionsData).sort().reverse();
        sortedVersions.forEach(v => versionSelect.innerHTML += `<option value="${v}">${v}</option>`);

        ['platinum_plus', 'diamond_plus', 'meteorite_plus', 'mithril_plus', 'in1000'].forEach(tier => {
            tierSelect.innerHTML += `<option value="${tier}">${tier}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">버전 전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;
    }

    function loadAndRender(version, tier, period, tierConfig) {
        fetch(`data/${version}/${tier}.json`)
            .then(r => r.json())
            .then(json => {
                const entries = getEntriesFromPeriod(json["히스토리"], period);
                const sorted = calculateAndSortScores(entries, tierConfig);
                displaySelectedData(sorted);
            })
            .catch(err => {
                console.error('불러오기 실패:', err);
                document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.';
            });
    }

    function getEntriesFromPeriod(history, period) {
        if (period === 'latest') return history[history.length - 1].데이터;

        const days = period === '3day' ? 3 : 7;
        const now = new Date(history[history.length - 1].날짜);
        const past = new Date(now);
        past.setDate(past.getDate() - days);

        const prev = history.find(h => new Date(h.날짜) >= past);
        if (!prev) return history[history.length - 1].데이터;

        const currMap = Object.fromEntries(history[history.length - 1].데이터.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(prev.데이터.map(d => [d.실험체, d]));

        const delta = [];
        for (const name in currMap) {
            const curr = currMap[name];
            const prev = prevMap[name];
            if (!prev) continue;
            const deltaSample = curr["표본수"] - prev["표본수"];
            if (deltaSample <= 0) continue;
            delta.push({
                "실험체": name,
                "표본수": deltaSample,
                "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / deltaSample,
                "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / deltaSample,
                "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / deltaSample,
                "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / deltaSample,
            });
        }
        return delta;
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

    function getRPScore(rp) {
        return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2;
    }

    function calculateAndSortScores(data, tierConfig) {
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        const averagePickRate = data.reduce((sum, item) => sum + item["표본수"] / totalSampleCount, 0) / data.length;

        let weightedSumRP = 0, weightedSumWin = 0, weightedSumTop3 = 0;
        data.forEach(item => {
            const w = item["표본수"] / totalSampleCount;
            weightedSumRP += item["RP 획득"] * w;
            weightedSumWin += item["승률"] * w;
            weightedSumTop3 += item["TOP 3"] * w;
        });

        const averageScore = getRPScore(weightedSumRP) + weightedSumWin * 9 + weightedSumTop3 * 3;
        const k = 1.5;

        const scoredData = data.map(item => {
            const pickRate = item["표본수"] / totalSampleCount;
            const r = pickRate / averagePickRate;
            const 원점반영 = r <= 1 / 3
                ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)))
                : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1 / 3))) / (1 - Math.exp(-k)));

            const 평균반영 = 1 - 원점반영;
            const 픽률보정계수 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            const rpScore = getRPScore(item["RP 획득"]);

            let 보정점수;
            if (item["표본수"] < totalSampleCount * averagePickRate) {
                보정점수 = (
                    rpScore + item["승률"] * 9 + item["TOP 3"] * 3
                ) * (원점반영 + 평균반영 * Math.min(1, pickRate / averagePickRate)) +
                    averageScore * 평균반영 * (1 - Math.min(1, pickRate / averagePickRate));
                보정점수 *= 픽률보정계수;
            } else {
                보정점수 = (rpScore + item["승률"] * 9 + item["TOP 3"] * 3) * 픽률보정계수;
            }

            const tier = calculateTier(보정점수, averageScore, tierConfig);

            return {
                "실험체": item["실험체"],
                "점수": 보정점수.toFixed(2),
                "티어": tier,
                "픽률": (pickRate * 100).toFixed(2) + '%',
                "RP 획득": item["RP 획득"].toFixed(1),
                "승률": (item["승률"] * 100).toFixed(2) + '%',
                "TOP 3": (item["TOP 3"] * 100).toFixed(2) + '%',
                "평균 순위": item["평균 순위"].toFixed(1)
            };
        });

        scoredData.sort((a, b) => b.점수 - a.점수);
        return scoredData;
    }

    function calculateTier(score, averageScore, config) {
        const diff = score - averageScore;
        if (diff > averageScore * parseFloat(config["S+"])) return "S+";
        if (diff > averageScore * parseFloat(config["S"])) return "S";
        if (diff > averageScore * parseFloat(config["A"])) return "A";
        if (diff > averageScore * parseFloat(config["B"])) return "B";
        if (diff > averageScore * parseFloat(config["C"])) return "C";
        if (diff > averageScore * parseFloat(config["D"])) return "D";
        return "F";
    }

    function displaySelectedData(data) {
        const container = document.getElementById('data-container');
        const columnsToShow = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

        let html = '<table><thead><tr>';
        columnsToShow.forEach(col => html += `<th>${col}</th>`);
        html += '</tr></thead><tbody>';

        data.forEach(item => {
            html += '<tr>';
            columnsToShow.forEach(col => html += `<td>${item[col]}</td>`);
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }
});
