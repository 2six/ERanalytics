document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const periodSelect = document.getElementById('period-select');
    const tierSelect = document.getElementById('tier-select');

    const versionList = ['v1.44']; // 필요시 자동화 가능
    versionList.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        versionSelect.appendChild(opt);
    });

    async function loadAndRender() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        try {
            const response = await fetch(`data/${version}/${tier}.json`);
            const json = await response.json();

            const keys = Object.keys(json).filter(k => /^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/.test(k)).sort();
            const latestKey = keys.at(-1);

            let entries = [];

            if (period === "latest") {
                entries = json[latestKey];
            } else {
                const days = parseInt(period.replace("days", ""));
                const startKey = keys.filter(k => {
                    const d = new Date(k.replace(/-/g, ":").replace(/:(?=[^:]*$)/, " "));
                    return d >= new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                })[0];
                if (!startKey) return alert("충분한 데이터가 없습니다.");
                const delta = subtractData(json[latestKey], json[startKey]);
                entries = delta;
            }

            const configText = await fetch('config.ini').then(res => res.text());
            const tierConfig = parseINI(configText).tiers;

            const sorted = calculateAndSortScores(entries, tierConfig);
            displaySelectedData(sorted);
        } catch (e) {
            console.error("불러오기 실패:", e);
            document.getElementById('data-container').textContent = '데이터를 불러오는 데 실패했습니다.';
        }
    }

    versionSelect.addEventListener('change', loadAndRender);
    tierSelect.addEventListener('change', loadAndRender);
    periodSelect.addEventListener('change', loadAndRender);

    versionSelect.value = versionList[0];
    loadAndRender();

    function parseINI(iniString) {
        const config = {};
        let section = null;
        for (const line of iniString.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
            const sec = trimmed.match(/^\[(.*)\]$/);
            if (sec) {
                section = sec[1];
                config[section] = {};
                continue;
            }
            const kv = trimmed.match(/^([^=]+)=(.*)$/);
            if (kv) {
                const key = kv[1].trim(), val = kv[2].trim();
                if (section) config[section][key] = val;
            }
        }
        return config;
    }

    function getRPScore(rp) {
        return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2;
    }

    function subtractData(newData, oldData) {
        const map = {};
        oldData.forEach(i => map[i["실험체"]] = i);
        return newData.map(item => {
            const old = map[item["실험체"]];
            if (!old) return item;
            const deltaSample = item["표본수"] - old["표본수"];
            if (deltaSample <= 0) return null;
            return {
                "실험체": item["실험체"],
                "표본수": deltaSample,
                "RP 획득": ((item["RP 획득"] * item["표본수"]) - (old["RP 획득"] * old["표본수"])) / deltaSample,
                "승률": ((item["승률"] * item["표본수"]) - (old["승률"] * old["표본수"])) / deltaSample,
                "TOP 3": ((item["TOP 3"] * item["표본수"]) - (old["TOP 3"] * old["표본수"])) / deltaSample,
                "평균 순위": ((item["평균 순위"] * item["표본수"]) - (old["평균 순위"] * old["표본수"])) / deltaSample
            };
        }).filter(Boolean);
    }

    function calculateAndSortScores(data, tierConfig) {
        const totalSamples = data.reduce((sum, d) => sum + d["표본수"], 0);
        const avgPickRate = totalSamples > 0 ? data.reduce((sum, d) => sum + d["표본수"] / totalSamples, 0) / data.length : 0;
        let sumRP = 0, sumWin = 0, sumTop3 = 0;
        data.forEach(d => {
            const w = d["표본수"] / totalSamples;
            sumRP += d["RP 획득"] * w;
            sumWin += d["승률"] * w;
            sumTop3 += d["TOP 3"] * w;
        });

        const avgScore = (Math.log(sumRP + 1) * 3) + (sumWin * 9) + (sumTop3 * 3);
        const k = 1.5;

        const result = data.map(d => {
            const pickRate = d["표본수"] / totalSamples;
            const r = pickRate / avgPickRate;
            const a = r <= 1 / 3 ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))) : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1 / 3))) / (1 - Math.exp(-k)));
            const avg = 1 - a;
            const factor = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
            const rpScore = getRPScore(d["RP 획득"]);
            let score;

            if (d["표본수"] < totalSamples * avgPickRate) {
                const m = Math.min(1, pickRate / avgPickRate);
                score = ((rpScore + d["승률"] * 9 + d["TOP 3"] * 3) * (a + avg * m) + avgScore * avg * (1 - m)) * factor;
            } else {
                score = (rpScore + d["승률"] * 9 + d["TOP 3"] * 3) * factor;
            }

            return {
                "실험체": d["실험체"],
                "점수": score.toFixed(2),
                "티어": assignTier(score, avgScore, tierConfig),
                "픽률": (pickRate * 100).toFixed(2) + '%',
                "RP 획득": d["RP 획득"].toFixed(1),
                "승률": (d["승률"] * 100).toFixed(2) + '%',
                "TOP 3": (d["TOP 3"] * 100).toFixed(2) + '%',
                "평균 순위": d["평균 순위"].toFixed(1)
            };
        });

        result.sort((a, b) => b["점수"] - a["점수"]);
        return result;
    }

    function assignTier(score, avg, cfg) {
        const diff = score - avg;
        if (diff > avg * parseFloat(cfg["S+"])) return "S+";
        if (diff > avg * parseFloat(cfg["S"])) return "S";
        if (diff > avg * parseFloat(cfg["A"])) return "A";
        if (diff > avg * parseFloat(cfg["B"])) return "B";
        if (diff > avg * parseFloat(cfg["C"])) return "C";
        if (diff > avg * parseFloat(cfg["D"])) return "D";
        return "F";
    }

    function displaySelectedData(data) {
        const container = document.getElementById('data-container');
        const headers = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

        let html = '<table><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => html += `<td>${row[h]}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }
});
