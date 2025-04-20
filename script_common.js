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
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return; // 주석 및 빈 라인 무시
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
// 2-1. 버전 드롭다운
function populateVersionDropdown(selectElem, versionList) {
    selectElem.innerHTML = ''; // 기존 옵션 제거
    versionList.sort().reverse().forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        selectElem.appendChild(option);
    });
}

// 2-2. 티어 드롭다운
const tierMap = {
    "platinum_plus": "플래티넘+",
    "diamond_plus": "다이아몬드+",
    "meteorite_plus": "메테오라이트+",
    "mithril_plus": "미스릴+",
    "in1000": "in1000"
};
function populateTierDropdown(selectElem) {
    selectElem.innerHTML = ''; // 기존 옵션 제거
    Object.entries(tierMap).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        selectElem.appendChild(option);
    });
}

// 2-3. 기간 드롭다운
const periodOptions = [
    { value: 'latest', label: '버전 전체' },
    { value: '3day', label: '최근 3일' },
    { value: '7day', label: '최근 7일' }
];
function populatePeriodDropdown(selectElem) {
    selectElem.innerHTML = ''; // 기존 옵션 제거
    periodOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        selectElem.appendChild(option);
    });
}

// 3. RP 점수 계산
function getRPScore(rp) {
    return rp >= 0 ? Math.log(rp + 1) * 3 : -Math.log(-rp + 1) * 2; // 음수 RP는 -log(-rp+1)*2
}

// 4. 티어 계산
function calculateTier(score, avgScore, stddev, config) {
    const diff = score - avgScore;
    if (diff > stddev * parseFloat(config["S+"])) return "S+";
    if (diff > stddev * parseFloat(config["S"])) return "S";
    if (diff > stddev * parseFloat(config["A"])) return "A";
    if (diff > stddev * parseFloat(config["B"])) return "B";
    if (diff > stddev * parseFloat(config["C"])) return "C";
    if (diff > stddev * parseFloat(config["D"])) return "D";
    return "F";
}

// 5. 데이터 정렬
function sortData(data, column, asc) {
    return [...data].sort((a, b) => {
        if (typeof a[column] === 'number') {
            return asc ? a[column] - b[column] : b[column] - a[column];
        } else {
            return asc ? a[column].localeCompare(b[column]) : b[column].localeCompare(a[column]);
        }
    });
}