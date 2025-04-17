// script_statistics.js

// 전역 변수 선언
let versionList = [];
let selectedVersion = null;
let selectedTier = "diamond_plus";
let selectedRange = "전체";

const tierOptions = [
    { name: "플래티넘+", key: "platinum_plus" },
    { name: "다이아몬드+", key: "diamond_plus" },
    { name: "메테오라이트+", key: "meteorite_plus" },
    { name: "미스릴+", key: "mithril_plus" },
    { name: "in 1000", key: "in1000" }
];

const rangeOptions = ["전체", "최근 3일", "최근 7일"];

document.addEventListener('DOMContentLoaded', async function () {
    versionList = await fetchVersions();
    if (!versionList.length) return;

    selectedVersion = versionList[0];
    renderControls();
    loadAndDisplayData();
});

async function fetchVersions() {
    try {
        const res = await fetch('data/');
        const text = await res.text();
        const matches = [...text.matchAll(/href=\"([^"]+)\//g)].map(m => m[1]).filter(name => /^v\d/.test(name));
        return matches.reverse();
    } catch (e) {
        console.error("버전 목록을 가져오는 데 실패했습니다.", e);
        return [];
    }
}

function renderControls() {
    const container = document.querySelector('main');
    const controlBox = document.createElement('div');
    controlBox.style.marginBottom = '20px';

    // 버전 드롭다운
    const versionSelect = createSelect(versionList, selectedVersion, v => {
        selectedVersion = v;
        loadAndDisplayData();
    });

    // 티어 드롭다운
    const tierSelect = createSelect(tierOptions.map(t => t.name), "다이아몬드+", name => {
        selectedTier = tierOptions.find(t => t.name === name).key;
        loadAndDisplayData();
    });

    // 구간 드롭다운
    const rangeSelect = createSelect(rangeOptions, selectedRange, range => {
        selectedRange = range;
        loadAndDisplayData();
    });

    controlBox.append("버전 ", versionSelect, " / 티어 ", tierSelect, " / 구간 ", rangeSelect);
    container.prepend(controlBox);
}

function createSelect(options, selected, onChange) {
    const select = document.createElement('select');
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = typeof opt === 'string' ? opt : opt;
        option.textContent = typeof opt === 'string' ? opt : opt;
        if (option.value === selected) option.selected = true;
        select.appendChild(option);
    });
    select.addEventListener('change', () => onChange(select.value));
    return select;
}

async function loadAndDisplayData() {
    const path = `data/${selectedVersion}/${selectedTier}.json`;
    try {
        const res = await fetch(path);
        const json = await res.json();
        const latest = Object.keys(json).sort().at(-1);

        let entries = json[latest];

        if (selectedRange === "최근 3일" || selectedRange === "최근 7일") {
            const keys = Object.keys(json).sort();
            const nowIndex = keys.indexOf(latest);
            const offset = selectedRange === "최근 3일" ? 3 : 7;
            if (nowIndex - offset >= 0) {
                const before = json[keys[nowIndex - offset]];
                entries = subtractStats(json[latest], before);
            } else {
                console.warn("해당 날짜 이전 데이터가 부족합니다.");
            }
        }

        const iniRes = await fetch('config.ini');
        const config = parseINI(await iniRes.text()).tiers;
        const scored = calculateAndSortScores(entries, config);
        displaySelectedData(scored);

    } catch (err) {
        console.error("데이터 불러오기 실패:", err);
    }
}

function subtractStats(current, prev) {
    const result = [];
    for (const cur of current) {
        const past = prev.find(p => p["실험체"] === cur["실험체"]);
        if (!past) continue;
        const 표본차 = cur["표본수"] - past["표본수"];
        if (표본차 <= 0) continue;
        result.push({
            "실험체": cur["실험체"],
            "표본수": 표본차,
            "RP 획득": (cur["RP 획득"] * cur["표본수"] - past["RP 획득"] * past["표본수"]) / 표본차,
            "승률": (cur["승률"] * cur["표본수"] - past["승률"] * past["표본수"]) / 표본차,
            "TOP 3": (cur["TOP 3"] * cur["표본수"] - past["TOP 3"] * past["표본수"]) / 표본차,
            "평균 순위": (cur["평균 순위"] * cur["표본수"] - past["평균 순위"] * past["표본수"]) / 표본차
        });
    }
    return result;
}

// parseINI, calculateAndSortScores, calculateTier, getRPScore, displaySelectedData 함수는 기존과 동일 (생략 가능)
