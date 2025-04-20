/**
 * script_common.js
 * 공통 기능 모듈
 */

// 1. INI 파싱 함수
function parseINI(iniString) {
    const config = {};
    let currentSection = null;
    iniString.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;
        const sectionMatch = trimmed.match(/^\[(.*)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            config[currentSection] = {};
            return;
        }
        const kv = trimmed.match(/^([^=]+)=(.*)$/);
        if (kv && currentSection) {
            config[currentSection][kv[1].trim()] = kv[2].trim();
        }
    });
    return config;
}

// 2. 드롭다운 초기화
function populateVersionDropdown(selectElem, versionList) {
    selectElem.innerHTML = '';
    versionList.sort().reverse().forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        selectElem.appendChild(opt);
    });
}

const tierMap = {
    "platinum_plus": "플래티넘+",
    "diamond_plus": "다이아몬드+",
    "meteorite_plus": "메테오라이트+",
    "mithril_plus": "미스릴+",
    "in1000": "in1000"
};
function populateTierDropdown(selectElem) {
    selectElem.innerHTML = '';
    Object.entries(tierMap).forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        selectElem.appendChild(opt);
    });
}

const periodOptions = [
    { value: 'latest', label: '버전 전체' },
    { value: '3day', label: '최근 3일' },
    { value: '7day', label: '최근 7일' }
];
function populatePeriodDropdown(selectElem) {
    selectElem.innerHTML = '';
    periodOptions.forEach(optDef => {
        const opt = document.createElement('option');
        opt.value = optDef.value;
        opt.textContent = optDef.label;
        selectElem.appendChild(opt);
    });
}

// 3. RP 점수 계산
function getRPScore(rp) {
    return rp >= 0
        ? Math.log(rp + 1) * 3
        : -Math.log(-rp + 1) * 2;
}

// 4. 티어 계산
function calculateTier(score, avgScore, stddev, config) {
    const diff = score - avgScore;
    if (diff > stddev * parseFloat(config['S+'])) return 'S+';
    if (diff > stddev * parseFloat(config['S'])) return 'S';
    if (diff > stddev * parseFloat(config['A'])) return 'A';
    if (diff > stddev * parseFloat(config['B'])) return 'B';
    if (diff > stddev * parseFloat(config['C'])) return 'C';
    if (diff > stddev * parseFloat(config['D'])) return 'D';
    return 'F';
}

// 5. 평균 점수 계산
function calculateAverageScore(data) {
    const total = data.reduce((sum, item) => sum + item['표본수'], 0);
    let sumRP = 0, sumWin = 0, sumTop3 = 0;
    data.forEach(i => {
        const w = i['표본수'] / total;
        sumRP += i['RP 획득'] * w;
        sumWin += i['승률'] * w;
        sumTop3 += i['TOP 3'] * w;
    });
    return getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
}

// 6. 표준 편차 계산
function calculateStandardDeviation(data, avgScore) {
    const total = data.reduce((sum, item) => sum + item['표본수'], 0);
    return Math.sqrt(
        data.reduce((sum, item) => {
            const s = getRPScore(item['RP 획득']) + item['승률'] * 9 + item['TOP 3'] * 3;
            return sum + Math.pow(s - avgScore, 2) * (item['표본수'] / total);
        }, 0)
    );
}

// 7. 점수 및 티어, 픽률 계산
function calculateTiers(data, avgScore, stddev, config) {
    const total = data.reduce((sum, item) => sum + item['표본수'], 0);
    const avgPickRate = data.length
        ? data.reduce((sum, i) => sum + i['표본수'] / total, 0) / data.length
        : 0;
    const k = 1.5;
    return data.map(item => {
        const pickRate = item['표본수'] / total;
        const r = avgPickRate ? pickRate / avgPickRate : 1;
        const originWeight =
            r <= 1/3
                ? 0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))
                : 0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k));
        const meanWeight = 1 - originWeight;
        let factor = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));
        if (r > 5) {
            factor += 0.05 * (1 - Math.min((r - 5) / 5, 1));
        }
        const baseScore = getRPScore(item['RP 획득']) + item['승률'] * 9 + item['TOP 3'] * 3;
        let score;
        if (item['표본수'] < total * avgPickRate) {
            score =
                baseScore * (originWeight + meanWeight * Math.min(1, pickRate / avgPickRate)) +
                avgScore * meanWeight * (1 - Math.min(1, pickRate / avgPickRate));
            score *= factor;
        } else {
            score = baseScore * factor;
        }
        const tierLabel = calculateTier(score, avgScore, stddev, config);
        return {
            ...item,
            '점수': parseFloat(score.toFixed(2)),
            '티어': tierLabel,
            '픽률': parseFloat((pickRate * 100).toFixed(2))
        };
    });
}

// 8. 데이터 정렬
function sortData(data, column, asc) {
    return [...data].sort((a, b) => {
        const x = a[column];
        const y = b[column];
        if (typeof x === 'number' && typeof y === 'number') {
            return asc ? x - y : y - x;
        }
        return asc
            ? String(x).localeCompare(String(y))
            : String(y).localeCompare(String(x));
    });
}
