// script_statistics.js

document.addEventListener('DOMContentLoaded', () => { const versionSelect = document.getElementById('version-select'); const tierSelect = document.getElementById('tier-select'); const periodSelect = document.getElementById('period-select'); const gradientCheckbox = document.getElementById('gradient-checkbox');

let currentData = [];
let currentSort = { key: '점수', order: 'desc' };
let tierConfig = {};

Promise.all([
    fetch('config.ini').then(r => r.text()),
    fetch('versions.json').then(r => r.json())
]).then(([iniString, versions]) => {
    tierConfig = parseINI(iniString).tiers;
    initDropdowns(versions);

    [versionSelect, tierSelect, periodSelect].forEach(select => {
        select.addEventListener('change', loadAndRender);
    });

    gradientCheckbox.addEventListener('change', () => renderTable(currentData));

    loadAndRender();
});

function initDropdowns(versions) {
    versionSelect.innerHTML = versions.reverse().map(v => `<option value="${v}">${v}</option>`).join('');
    tierSelect.innerHTML = ["platinum_plus", "diamond_plus", "meteorite_plus", "mithril_plus", "in1000"]
        .map(t => `<option value="${t}">${t}</option>`).join('');
}

function loadAndRender() {
    const version = versionSelect.value;
    const tier = tierSelect.value;
    const period = periodSelect.value;

    fetch(`data/${version}/${tier}.json`)
        .then(r => r.json())
        .then(json => {
            const history = json["통계"];
            const entries = getEntriesFromPeriod(history, period);
            currentData = calculateAndSortScores(entries, tierConfig);
            renderTable(currentData);
        })
        .catch(e => {
            console.error('불러오기 실패:', e);
            document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });
}

function getEntriesFromPeriod(history, period) {
    if (period === 'latest') return history[history.length - 1]["데이터"];
    const now = history[history.length - 1];
    const prev = history[history.length - (period === '3days' ? 2 : 4)];
    if (!prev) return now["데이터"];

    const nowMap = Object.fromEntries(now["데이터"].map(d => [d.실험체, d]));
    const prevMap = Object.fromEntries(prev["데이터"].map(d => [d.실험체, d]));
    const result = [];
    for (const name in nowMap) {
        if (!prevMap[name]) continue;
        const c = nowMap[name], p = prevMap[name];
        const ds = c["표본수"] - p["표본수"];
        if (ds <= 0) continue;
        result.push({
            "실험체": name,
            "표본수": ds,
            "RP 획득": (c["RP 획득"] * c["표본수"] - p["RP 획득"] * p["표본수"]) / ds,
            "승률": (c["승률"] * c["표본수"] - p["승률"] * p["표본수"]) / ds,
            "TOP 3": (c["TOP 3"] * c["표본수"] - p["TOP 3"] * p["표본수"]) / ds,
            "평균 순위": (c["평균 순위"] * c["표본수"] - p["평균 순위"] * p["표본수"]) / ds
        });
    }
    return result;
}

function getRPScore(rp) {
    return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2;
}

function calculateAndSortScores(data, tierConfig) {
    const total = data.reduce((sum, d) => sum + d["표본수"], 0);
    const avgPick = data.reduce((sum, d) => sum + d["표본수"] / total, 0) / data.length;

    const wRP = data.reduce((s, d) => s + d["RP 획득"] * (d["표본수"] / total), 0);
    const wWin = data.reduce((s, d) => s + d["승률"] * (d["표본수"] / total), 0);
    const wTop = data.reduce((s, d) => s + d["TOP 3"] * (d["표본수"] / total), 0);

    const avgScore = getRPScore(wRP) + wWin * 9 + wTop * 3;
    const k = 1.5;

    return data.map(d => {
        const r = (d["표본수"] / total) / avgPick;
        const base = getRPScore(d["RP 획득"]) + d["승률"] * 9 + d["TOP 3"] * 3;
        const 원점 = r <= 1 / 3
            ? (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)))
            : (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1 / 3))) / (1 - Math.exp(-k)));
        const 평균 = 1 - 원점;
        const 보정계수 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));

        let 점수 = base;
        if (d["표본수"] < total * avgPick) {
            점수 = base * (원점 + 평균 * Math.min(1, r)) + avgScore * 평균 * (1 - Math.min(1, r));
        }
        점수 *= 보정계수;

        const 티어 = calculateTier(점수, avgScore, tierConfig);
        return { ...d, 점수, 티어 };
    }).sort((a, b) => b[currentSort.key] - a[currentSort.key]);
}

function calculateTier(score, avg, cfg) {
    const d = score - avg;
    if (d > avg * parseFloat(cfg["S+"])) return 'S+';
    if (d > avg * parseFloat(cfg["S"])) return 'S';
    if (d > avg * parseFloat(cfg["A"])) return 'A';
    if (d > avg * parseFloat(cfg["B"])) return 'B';
    if (d > avg * parseFloat(cfg["C"])) return 'C';
    if (d > avg * parseFloat(cfg["D"])) return 'D';
    return 'F';
}

function renderTable(data) {
    const container = document.getElementById('data-container');
    const useGradient = gradientCheckbox.checked;

    const columns = ["실험체", "점수", "티어", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];
    const numericCols = ["점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];

    const ranges = {};
    if (useGradient) {
        numericCols.forEach(col => {
            const vals = data.map(d => parseFloat(d[col]));
            ranges[col] = { min: Math.min(...vals), max: Math.max(...vals) };
        });
    }

    let html = '<table><thead><tr>';
    columns.forEach(col => {
        html += `<th class="sortable" data-key="${col}">${col} ${col === currentSort.key ? (currentSort.order === 'asc' ? '▲' : '▼') : ''}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            let value = row[col];
            let style = '';
            if (useGradient && numericCols.includes(col)) {
                const v = parseFloat(value);
                const { min, max } = ranges[col];
                const percent = (v - min) / (max - min);
                const red = Math.round(255 * (1 - percent));
                const blue = Math.round(255 * percent);
                style = ` style="background-color: rgb(${red}, 0, ${blue}, 0.2);"`;
            }
            html += `<td${style}>${value}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;

    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.key;
            if (currentSort.key === key) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort = { key, order: 'desc' };
            }
            currentData.sort((a, b) => {
                return currentSort.order === 'asc' ? a[key] - b[key] : b[key] - a[key];
            });
            renderTable(currentData);
        });
    });
}

function parseINI(str) {
    const cfg = {}, lines = str.split('\n');
    let section = null;
    for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith(';') || t.startsWith('#')) continue;
        const s = t.match(/^(.*)$/);
        if (s) { section = s[1]; cfg[section] = {}; continue; }
        const kv = t.match(/^([^=]+)=(.*)$/);
        if (kv && section) cfg[section][kv[1].trim()] = kv[2].trim();
    }
    return cfg;
}

});
