// script_common.js
// 필요한 함수들을 전역 스코프에 둡니다.

// --- 추가: RP 보정 기준 상수 ---
const RP_REFERENCE_AVG = 10; // 기준 평균 RP 획득량 (다이아 티어 기준 등)
// -------------------------------

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
    selectElem.value = 'diamond_plus';
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

function getRPScore(rp) {
    return rp >= 0
        ? Math.log(rp + 1) * 3
        : -Math.log(-rp + 1) * 2;
}

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

// --- 수정: calculateAverageScore 함수가 RP 보정 계수를 적용하여 평균 점수 계산 및 평균 RP 반환 ---
function calculateAverageScore(data) {
    const validData = data.filter(item => (item['표본수'] || 0) > 0);
    const total = validData.reduce((sum, item) => sum + item['표본수'], 0);

    if (total === 0) return { avgScore: 0, averageRP: 0 }; // 데이터 없으면 0 반환

    // 데이터셋의 가중 평균 RP 획득량 계산
    const weightedAverageRP = validData.reduce((sum, i) => sum + (i['RP 획득'] || 0) * (i['표본수'] || 0), 0) / total;

     // --- RP 보정 계수 계산 (데이터셋 전체 평균에 기반) ---
    let rpCorrectionFactor = 1;
    if (weightedAverageRP !== 0 && RP_REFERENCE_AVG !== 0) {
        rpCorrectionFactor = RP_REFERENCE_AVG / weightedAverageRP;
        // 극단적인 보정 계수 방지 (예시: 0.5배 ~ 2배)
        rpCorrectionFactor = Math.max(0.5, Math.min(2.0, rpCorrectionFactor));
    }
    // ------------------------------------------------------

    let sumScores = 0;
    validData.forEach(item => {
        // --- 수정: 개별 캐릭터의 RP 보정된 점수를 사용하여 평균 계산 ---
        const rpScore = getRPScore(item['RP 획득'] || 0) * rpCorrectionFactor;
        const itemBaseScore = rpScore + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3;
        // Note: calculateTiers의 픽률 보정은 평균 계산에는 적용하지 않습니다.
        //       평균은 기본적인 스탯 조합 점수의 평균을 계산합니다.
        sumScores += itemBaseScore * ((item['표본수'] || 0) / total);
        // -------------------------------------------------------------
    });

    const avgScore = sumScores; // sumScores 자체가 가중 평균 점수입니다.

    return { avgScore: avgScore, averageRP: weightedAverageRP }; // 보정된 평균 점수와 가중 평균 RP 획득량 반환
}
// -------------------------------------------------------------

// --- 수정: calculateStandardDeviation 함수가 평균 RP 인자를 받아 RP 보정 계수 적용 ---
function calculateStandardDeviation(data, avgScore, datasetAverageRP) {
    const validData = data.filter(item => (item['표본수'] || 0) > 0);
    const total = validData.reduce((sum, item) => sum + item['표본수'], 0);

    if (total === 0) return 0;

     // --- RP 보정 계수 계산 (표준편차 계산 시에도 동일하게 적용) ---
    let rpCorrectionFactor = 1;
    if (datasetAverageRP !== 0 && RP_REFERENCE_AVG !== 0) {
        rpCorrectionFactor = RP_REFERENCE_AVG / datasetAverageRP;
        rpCorrectionFactor = Math.max(0.5, Math.min(2.0, rpCorrectionFactor)); // 동일 제한 적용
    }
    // ----------------------------------------------------------

    const variance = validData.reduce((sum, item) => {
        // --- 수정: 표준편차 계산 시에도 RP 보정 계수 적용된 점수 사용 ---
        const rpScore = getRPScore(item['RP 획득'] || 0) * rpCorrectionFactor;
        const s = rpScore + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3; // 보정된 개별 기본 점수
        // ----------------------------------------------------
        return sum + Math.pow(s - avgScore, 2) * ((item['표본수'] || 0) / total); // 보정된 점수와 보정된 평균 점수 사용
    }, 0);
    return Math.sqrt(variance);
}
// -------------------------------------------------------------

// --- 수정: calculateTiers 함수에 datasetAverageRP 인자 추가 및 RP 보정 로직 적용 ---
function calculateTiers(data, avgScore, stddev, config, datasetAverageRP) {
    const total = data.reduce((sum, item) => sum + (item['표본수'] || 0), 0); // 표본수 null/undefined 방지
    const avgPickRate = total === 0 ? 0 : data.reduce((sum, i) => sum + (i['표본수'] || 0), 0) / total / (data.length || 1); // 표본수 null/undefined 방지

    const k = 1.5;

    // --- RP 보정 계수 계산 (calculateAverageScore에서 계산된 averageRP 사용) ---
    let rpCorrectionFactor = 1;
    if (datasetAverageRP !== 0 && RP_REFERENCE_AVG !== 0) {
        rpCorrectionFactor = RP_REFERENCE_AVG / datasetAverageRP;
        rpCorrectionFactor = Math.max(0.5, Math.min(2.0, rpCorrectionFactor)); // 극단적인 보정 계수 방지
    }
    // ------------------------------------------------------------------------

    return data.map(item => {
        if ((item['표본수'] || 0) === 0) { // null/undefined 대비 및 표본수 0인 경우
             return {
                 ...item,
                 '점수': 0.00,
                 '티어': 'F',
                 '픽률': 0.00
             };
        }

        const pickRate = total === 0 ? 0 : (item['표본수'] || 0) / total; // null/undefined 대비
        const r = avgPickRate ? pickRate / avgPickRate : 1;
        const originWeight =
            r <= 1/3
                ? 0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k)) / (1 - Math.exp(-k)) // 분모 수정
                : 0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k)); // 분모 수정
        const meanWeight = 1 - originWeight;
        let factor = avgPickRate === 0 ? 1 : (0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k)));
        if (r > 5) {
            factor += 0.05 * (1 - Math.min((r - 5) / 5, 1));
        }

        // --- 수정: 개별 캐릭터의 RP 획득 점수에 보정 계수 적용 ---
        const rpScore = getRPScore(item['RP 획득'] || 0) * rpCorrectionFactor;
        const baseScore = rpScore + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3; // null/undefined 방지
        // -----------------------------------------

        let score;

        // NOTE: 픽률 보정 로직은 그대로 유지됩니다.
        if (avgPickRate !== 0 && (item['표본수'] || 0) < total * avgPickRate) { // null/undefined 방지
            score =
                baseScore * (originWeight + meanWeight * Math.min(1, pickRate / avgPickRate)) +
                avgScore * meanWeight * (1 - Math.min(1, pickRate / avgPickRate));
            score *= factor;
        } else {
            score = baseScore * factor;
        }

        // --- 수정: 티어 결정 시 보정된 avgScore와 stddev 사용 ---
        // calculateTier 함수는 인자로 받은 avgScore와 stddev를 사용하므로,
        // calculateAverageScore와 calculateStandardDeviation에서 이미 보정된 값을
        // calculateTiers 호출 시 전달해야 합니다. (이 부분은 script_tier_table.js에서 수정)
        const tierLabel = calculateTier(score, avgScore, stddev, config);
        // -----------------------------------------------------

        return {
            ...item,
            '점수': parseFloat(score.toFixed(2)),
            '티어': tierLabel,
            '픽률': parseFloat((pickRate * 100).toFixed(2)) // 픽률은 전체 표본 중 해당 캐릭터 표본 비율
        };
    });
}
// -------------------------------------------------------------


// 8. 데이터 정렬 (mode 인자 추가 및 로직 수정) - 기존 유지
function sortData(data, column, asc, mode = 'value') {
    if (!data || data.length === 0) return [];

   let sortKey;
   // 정렬 기준 키를 결정합니다.
   // column: 헤더의 data-col 값 ('점수', '티어' 등)
   // mode: 'value' (단일), 'value1', 'value2', 'delta'
   if (mode === 'value') { // 단일 모드
        // 단일 모드 티어 정렬 시 점수 기준 (이전 요구사항 반영 유지)
        if (column === '티어') sortKey = '점수';
        else sortKey = column; // 단일 모드에서는 컬럼 이름 자체가 키
   } else if (mode === 'value1') { // 비교 모드, Ver1 값 기준
        if (column === '실험체') sortKey = '실험체';
        // 비교 모드 Ver1 티어 정렬 시 점수 (Ver1) 기준 (이전 요구사항 반영 유지)
        else if (column === '티어') sortKey = '점수 (Ver1)';
        else if (column === '표본수') sortKey = '표본수 (Ver1)';
        else if (column === '평균 순위') sortKey = '평균 순위 (Ver1)'; // 평균 순위 값 기준 정렬 (Ver1)
        else { // 점수, 픽률 등 숫자 스탯
             sortKey = `${column} (Ver1)`; // Ver1 값 기준 정렬
        }
   } else if (mode === 'value2') { // 비교 모드, Ver2 값 기준
        if (column === '실험체') sortKey = '실험체';
        // 비교 모드 Ver2 티어 정렬 시 점수 (Ver2) 기준 (이전 요구사항 반영 유지)
        else if (column === '티어') sortKey = '점수 (Ver2)';
        else if (column === '표본수') sortKey = '표본수 (Ver2)';
        else if (column === '평균 순위') sortKey = '평균 순위 (Ver2)'; // 평균 순위 값 기준 정렬 (Ver2)
        else {
            sortKey = `${column} (Ver2)`; // Ver2 값 기준 정렬
        }
   }
    else { // mode === 'delta' (비교 모드, 변화량 기준)
        // '티어' 열 델타 정렬 시 '순위 변화값'으로 정렬 (이전 요구사항 반영 유지)
        if (column === '티어') sortKey = '순위 변화값';
        else if (column === '실험체') sortKey = '순위 변화값'; // 실험체 컬럼 델타 정렬 시 순위 변화값 기준 (이전 요구사항 반영 유지)
        else if (column === '표본수') sortKey = '표본수 변화량'; // 표본수 변화량 기준 정렬 (이전 요구사항 반영 유지)
        // 사용자 요구사항 반영: '평균 순위' 컬럼 델타 정렬 시 '평균 순위 변화량'으로 정렬
        else if (column === '평균 순위') sortKey = '평균 순위 변화량';
        else {
            sortKey = `${column} 변화량`; // 점수, 픽률 등 숫자 스탯의 변화량 기준 정렬 (이전 요구사항 반영 유지)
        }
   }


    // console.log(`sortData: column=${column}, asc=${asc}, mode=${mode}, sortKey=${sortKey}`); // 디버그

   return [...data].sort((a, b) => {
       const x = a[sortKey];
       const y = b[sortKey];

       const xIsNull = (x === undefined || x === null);
       const yIsNull = (y === undefined || y === null);

       // null/undefined 값을 처리 (asc에 따라 맨 끝 또는 맨 앞으로)
       // '더 좋은' 값이 위로 오는 정렬 (asc=false) 시 null은 맨 뒤로
       // '더 나쁜' 값이 위로 오는 정렬 (asc=true) 시 null은 맨 앞으로
       if (xIsNull && yIsNull) return 0;
       if (xIsNull) return asc ? -1 : 1; // asc=true(나쁜 위로)이면 null이 앞으로(-1); asc=false(좋은 위로)이면 null이 뒤로(1)
       if (yIsNull) return asc ? 1 : -1; // asc=true(나쁜 위로)이면 null이 뒤로(1); asc=false(좋은 위로)이면 null이 앞으로(-1)


       // --- 데이터 타입별 비교 로직 ---

       // 1. 기본 문자열 비교 (실험체 이름)
       if (sortKey === '실험체') {
            // 실험체 이름은 항상 가나다순 오름차순 / 역순 내림차순
            return asc
               ? String(x).localeCompare(String(y)) // asc=true: 오름차순
               : String(y).localeCompare(String(x)); // asc=false: 내림차순
       }

       // 2. 순서가 정의된 문자열 비교 (티어 변화 상태, 순위 변화값 문자열, 표본수 변화량 문자열)
       // '신규 → ' > '-' > '→ 삭제' 순서로 정렬 (좋은 것 -> 나쁜 것)
       const order = {'신규 → ': 2, '-': 1, '→ 삭제': 0}; // 순위 변화값 문자열 순서 (높을수록 좋음)
       const sampleOrder = {'new': 2, 'none': 1, 'removed': 0}; // 표본수 변화량 문자열 순서 (높을수록 좋음)

       let orderX, orderY;
       let isStringOrderComparison = false;

       if (sortKey === '순위 변화값' && typeof x !== 'number' && typeof y !== 'number') {
           orderX = order[x] !== undefined ? order[x] : -1;
           orderY = order[y] !== undefined ? order[y] : -1;
           isStringOrderComparison = true;
       } else if (sortKey === '표본수 변화량' && typeof x !== 'number' && typeof y !== 'number') {
            orderX = sampleOrder[x] !== undefined ? sampleOrder[x] : -1;
            orderY = sampleOrder[y] !== undefined ? sampleOrder[y] : -1;
            isStringOrderComparison = true;
       }
       // Note: '티어 변화' sortKey는 현재 사용되지 않음 (순위 변화값으로 정렬)

       if (isStringOrderComparison) {
            // order 값이 높을수록 좋음 -> 숫자 비교와 동일하게 처리
            const xOrder = orderX;
            const yOrder = orderY;

            // --- 수정: 정렬 방향 로직 변경 ---
            // asc=false (좋은 것 위로): order 값이 큰 것이 위로 -> 내림차순 (yOrder - xOrder)
            // asc=true (나쁜 것 위로): order 값이 작은 것이 위로 -> 오름차순 (xOrder - yOrder)
            return asc ? (xOrder - yOrder) : (yOrder - xOrder);
            // ---------------------------------
       }


       // 3. 숫자 비교 (value 또는 delta)
       // 순위 관련 값 (평균 순위 값, 순위 변화값, 평균 순위 변화량)은 작을수록 좋음
       // 그 외 숫자 값 (점수, 픽률, RP 획득, 승률, TOP 3, 해당 변화량, 표본수 값/변화량)은 클수록 좋음

       // 정렬 키에 따라 값이 작을수록 좋은지 판단
       const isBetterWhenLower = (
           sortKey === '평균 순위' || sortKey === '평균 순위 (Ver1)' || sortKey === '평균 순위 (Ver2)' || // 평균 순위 값
           sortKey === '순위 변화값' || // 순위 변화값 (음수가 좋음)
           sortKey === '평균 순위 변화량' // 평균 순위 변화량 (음수가 좋음)
       );


       const xNum = typeof x === 'number' ? x : parseFloat(String(x).replace(/[+%▲▼]/g, ''))||0;
       const yNum = typeof y === 'number' ? y : parseFloat(String(y).replace(/[+%▲▼]/g, ''))||0;


       // --- 수정: 정렬 방향 로직 변경 ---
       let comparison;
       if (isBetterWhenLower) { // 값이 작을수록 좋음 (평균 순위, 순위 변화값, 평균 순위 변화량)
           // asc=false (좋은 것 위로): 작은 값(좋은)이 위로 -> 오름차순 (xNum - yNum)
           // asc=true (나쁜 것 위로): 큰 값(나쁜)이 위로 -> 내림차순 (yNum - xNum)
           comparison = asc ? (yNum - xNum) : (xNum - yNum);
       } else { // 값이 클수록 좋음 (점수 등)
           // asc=false (좋은 것 위로): 큰 값(좋은)이 위로 -> 내림차순 (yNum - xNum)
           // asc=true (나쁜 것 위로): 작은 값(나쁜)이 위로 -> 오름차순 (xNum - yNum)
           comparison = asc ? (xNum - yNum) : (yNum - xNum);
       }
       return comparison;
       // ---------------------------------
   });
}

// 9. 기간별 데이터 추출 함수 (스냅샷 반환) - 기존 유지
function extractPeriodEntries(history, period) {
    const keys = Object.keys(history).sort();
    if (keys.length === 0) return [];

    const latestKey = keys[keys.length - 1];
    const latest = history[latestKey];

    if (period === 'latest') return latest;

    const days = period === '3day' ? 3 : 7;
    let latestDate = new Date(latestKey.replace('_', 'T'));
    if (isNaN(latestDate.getTime())) {
         const parts = latestKey.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (parts) {
              latestDate = new Date(Date.UTC(parts[1], parts[2]-1, parts[3], parts[4], parts[5]));
         } else {
              console.error("Unsupported date format:", latestKey);
              return latest; // Fallback to latest if date format is bad
         }
    }
    latestDate.setUTCHours(0, 0, 0, 0);

    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

    // Find the latest key *before or on* the cutoff date
    const pastKey = keys.slice().reverse().find(k => {
        let kDate;
        const kParts = k.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (kParts) {
              kDate = new Date(Date.UTC(kParts[1], kParts[2]-1, kParts[3], kParts[4], kParts[5]));
         } else {
              kDate = new Date(k.replace('_', 'T'));
         }
        if (isNaN(kDate.getTime())) return false;

        kDate.setUTCHours(0,0,0,0); // Normalize to start of day UTC
        return kDate <= cutoff;
    });

    if (!pastKey) {
        console.warn(`No data found before cutoff date ${cutoff.toISOString()} for period '${period}'. Returning empty array.`);
        return []; // Return empty array if no past data found
    }

    return history[pastKey]; // Return the data for the found past key
}


// 10. 기간 동안 추가된 표본의 통계 추출 (델타 계산) - 신규 함수
function extractDeltaEntries(history, period) {
    const keys = Object.keys(history).sort();
    if (keys.length === 0) return [];

    const latestKey = keys[keys.length - 1];
    const latestData = history[latestKey];

    // latest 기간은 델타 계산이 의미 없으므로 스냅샷을 반환하거나 빈 배열 반환
    // 사용자 요청: '최근 N일'만 델타를 사용하므로, latest는 여기서 처리하지 않고 호출하는 쪽에서 스냅샷을 가져오도록 함
    // 따라서 period가 'latest'이면 이 함수를 호출하지 않도록 설계합니다.
    if (period === 'latest') {
         console.error("extractDeltaEntries should not be called with 'latest' period.");
         return []; // 잘못된 호출 방지
    }

    const days = period === '3day' ? 3 : 7;
    let latestDate = new Date(latestKey.replace('_', 'T'));
    if (isNaN(latestDate.getTime())) {
         const parts = latestKey.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (parts) {
              latestDate = new Date(Date.UTC(parts[1], parts[2]-1, parts[3], parts[4], parts[5]));
         } else {
              console.error("Unsupported date format in extractDeltaEntries:", latestKey);
              return [];
         }
    }
    latestDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC

    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

    // Find the latest key *before or on* the cutoff date
    const pastKey = keys.slice().reverse().find(k => {
        let kDate;
        const kParts = k.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (kParts) {
              kDate = new Date(Date.UTC(kParts[1], kParts[2]-1, kParts[3], kParts[4], kParts[5]));
         } else {
              kDate = new Date(k.replace('_', 'T'));
         }
        if (isNaN(kDate.getTime())) return false;

        kDate.setUTCHours(0,0,0,0); // Normalize to start of day UTC
        return kDate <= cutoff;
    });

    // 과거 데이터가 없으면 델타 계산 불가
    if (!pastKey) {
        console.warn(`No past data found before cutoff date ${cutoff.toISOString()} for period '${period}' in extractDeltaEntries. Cannot calculate delta.`);
        return [];
    }

    const prevData = history[pastKey];
    const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
    const prevMap = Object.fromEntries(prevData.map(d => [d.실험체, d]));
    const delta = [];

    // Iterate through characters present in the latest data to calculate delta
    for (const name in currMap) {
        const c = currMap[name];
        const p = prevMap[name];

        // Only calculate delta for characters present in both periods and with increased sample size
        const currSample = c['표본수'] || 0;
        const prevSample = p ? (p['표본수'] || 0) : 0; // 과거 데이터에 없는 경우 표본수 0으로 간주

        const diff = currSample - prevSample;

        // 표본수가 증가한 경우에만 델타 계산
        if (diff > 0) {
             // Calculate weighted average of stats for the *new* sample (diff)
             const rpDiff = ((c['RP 획득'] || 0) * currSample) - ((p ? (p['RP 획득'] || 0) : 0) * prevSample); // 과거 데이터 없으면 0 처리
             const winDiff = ((c['승률'] || 0) * currSample) - ((p ? (p['승률'] || 0) : 0) * prevSample); // 과거 데이터 없으면 0 처리
             const top3Diff = ((c['TOP 3'] || 0) * currSample) - ((p ? (p['TOP 3'] || 0) : 0) * prevSample); // 과거 데이터 없으면 0 처리
             const rankDiff = ((c['평균 순위'] || 0) * currSample) - ((p ? (p['평균 순위'] || 0) : 0) * prevSample); // 과거 데이터 없으면 0 처리


            delta.push({
                '실험체': name,
                '표본수': diff, // Sample size is the *difference*
                'RP 획득': rpDiff / diff,
                '승률':    winDiff / diff,
                'TOP 3':   top3Diff / diff,
                '평균 순위': rankDiff / diff
                // '점수', '티어', '픽률'은 calculateTiers에서 이 델타 스탯을 기반으로 계산될 것임
            });
        } else if (diff < 0) {
            // 표본수가 감소한 경우 (데이터 수집 방식에 따라 발생 가능성 있음) - 델타로 포함하지 않음
            // console.warn(`Sample size decreased for ${name} (${prevSample} -> ${currSample}). Skipping delta calculation.`);
        } else if (diff === 0 && currSample > 0) {
             // 표본수 변화는 없지만 데이터가 있는 경우 - 델타로 포함하지 않음
             // console.log(`Sample size unchanged for ${name} (${currSample}). Skipping delta calculation.`);
        }
        // diff <= 0 인 경우는 델타 결과에 포함시키지 않음
    }
    return delta;
}


// 11. 색상 보간 헬퍼 함수 (기존 함수 유지)
function interpolateColor(start, end, ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
    return `rgba(${rgb.join(',')}, ${0.3 + 0.5 * t})`;
}

// 티어 색상 (단일 모드) - 기존 유지
const TIER_COLORS_SINGLE = {
    'S+': 'rgba(255,127,127, 1)',
    'S':  'rgba(255,191,127, 1)',
    'A':  'rgba(255,223,127, 1)',
    'B':  'rgba(255,255,127, 1)',
    'C':  'rgba(191,255,127, 1)',
    'D':  'rgba(127,255,127, 1)',
    'F':  'rgba(127,255,255, 1)',
};

// 12. 단일 데이터용 그라디언트 색상 적용 - 기존 유지
function applyGradientColorsSingle(table) {
    if (!table) return;
    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th')];
    const goodCols = ['점수','픽률','RP 획득','승률','TOP 3'];
    const badCols = ['평균 순위'];

    // 픽률 정보를 가져올 컬럼 인덱스를 찾습니다. (가중치로 사용)
    const pickRateColIndex = headers.findIndex(th => th.dataset.col === '픽률'); // 픽률 컬럼 인덱스


    headers.forEach((th, i) => {
        const col = th.dataset.col;
        if (![...goodCols, ...badCols].includes(col)) return;

        // 색상 스케일링에 사용할 값들을 모읍니다.
        const valuesOnly = rows.map(r => {
             const cell = r.children[i];
             const text = cell.textContent.replace('%','').replace('위',''); // '위' 제거 추가
             const val = parseFloat(text);
             return isNaN(val) ? null : val;
        }).filter(v => v !== null);


        if (valuesOnly.length === 0) { // 유효한 값이 없으면
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return; // 이 컬럼 색칠 중단
        }

        const min = Math.min(...valuesOnly);
        const max = Math.max(...valuesOnly);

        let avg; // 평균값

        // 사용자 요구사항 반영: 픽률 열은 단순 평균, 그 외는 가중평균
        if (col === '픽률') {
            // 픽률 열은 단순 평균
            avg = valuesOnly.reduce((sum, value) => sum + value, 0) / valuesOnly.length;
        } else {
             // 그 외 스탯 열은 픽률을 가중치로 사용한 가중평균
             const valuesWithPickRate = rows.map(r => {
                  const cell = r.children[i];
                  const text = cell.textContent.replace('%','').replace('위',''); // '위' 제거 추가
                  const val = parseFloat(text);

                  let pickRate = 0;
                  if (pickRateColIndex !== -1) {
                       const pickRateCell = r.children[pickRateColIndex];
                       pickRate = parseFloat(pickRateCell.textContent.replace('%','')) / 100; // 0~1 사이 값으로 변환
                  } else {
                       // 만약 픽률 컬럼이 없는데 가중평균이 필요하다면 다른 가중치 기준 필요
                       // 현재는 픽률 컬럼이 있다고 가정
                       console.error("픽률 컬럼이 없습니다. 가중평균 계산 불가.");
                       return null; // 계산 불가 시 해당 항목 제외
                  }

                  return isNaN(val) ? null : { value: val, pickRate: pickRate };
             }).filter(item => item !== null && item.pickRate !== 0); // 유효한 값 + 픽률 0이 아닌 항목만 사용


             let totalPickRate = valuesWithPickRate.reduce((sum, item) => sum + item.pickRate, 0);
             let weightedSum = valuesWithPickRate.reduce((sum, item) => sum + item.value * item.pickRate, 0);

             // 픽률 합이 0이면 단순 평균 또는 0 처리 (나눗셈 오류 방지)
             avg = totalPickRate === 0 ? 0 : weightedSum / totalPickRate;

        }


        rows.forEach((r) => {
            const cell = r.children[i];
            const cellText = cell.textContent.replace('%','').replace('위',''); // '위' 제거 추가
            const v = parseFloat(cellText);

            if (isNaN(v) || v === null) {
                 cell.style.backgroundColor = '';
                 return;
            }

            let ratio;
            const isBad = badCols.includes(col);

            // 평균값(avg)을 기준으로 스케일링
            if (max === min) {
                ratio = 0.5; // 범위가 없으면 중간값
            } else if (!isBad) { // 클수록 좋음 (점수, 픽률 등)
                // Map value from [min, max] range to [0, 1] ratio, using avg as center (0.5)
                if (v >= avg) {
                     ratio = 0.5 + (v - avg) / (max - avg) * 0.5; // Map [avg, max] to [0.5, 1]
                } else { // v < avg
                     ratio = 0.5 - (avg - v) / (avg - min) * 0.5; // Map [min, avg] to [0, 0.5]
                }
            } else { // 작을수록 좋음 (평균 순위)
                // Map value from [min, max] range to [1, 0] ratio (inverted), using avg as center (0.5)
                if (v <= avg) {
                     ratio = 0.5 + (avg - v) / (avg - min) * 0.5; // Map [min, avg] to [0.5, 1] (inverted)
                } else { // v > avg
                     ratio = 0.5 - (v - avg) / (max - avg) * 0.5; // Map [avg, max] to [0, 0.5] (inverted)
                }
            }
            ratio = Math.max(0, Math.min(1, ratio)); // Clamp between 0 and 1

            let color;
            // Interpolate from Blue (0 - Worst) to White (0.5 - Avg) to Red (1 - Best)
            // Based on isBad and ratio
            if (!isBad) { // 클수록 좋음
               color = (ratio >= 0.5)
                   ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                   : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)
            } else { // 작을수록 좋음 (평균 순위)
                // If isBad is true, ratio 1 is min (best), ratio 0 is max (worst).
                // We want ratio 1 to be Red (best), ratio 0 to be Blue (worst).
                // So, interpolate from Blue to White to Red based on the ratio.
                // The previous invertedRatio logic was unnecessary if ratio is already mapped 0=worst, 1=best
                // The ratio calculation logic above (isBad branch) already maps min(best) to ratio 1, max(worst) to ratio 0.
                 color = (ratio >= 0.5)
                      ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                      : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)
            }
            cell.style.backgroundColor = color;
        });
    });

    const tierColIndex = headers.findIndex(th => th.dataset.col === '티어');
    if (tierColIndex >= 0) {
        rows.forEach(tr => {
            const cell = tr.children[tierColIndex];
            const tierValue = cell.textContent.trim();
            const color = TIER_COLORS_SINGLE[tierValue];
            if (color) {
                cell.style.backgroundColor = color;
            } else {
                cell.style.backgroundColor = '';
            }
        });
    }
}

// 12. 비교 데이터용 그라디언트 색상 적용 - 기존 유지
// data: 정렬된 비교 데이터 배열 (행 객체들의 배열)
// mode: 현재 정렬 모드 ('value1', 'value2', 'delta')
// sortedCol: 현재 정렬 기준 컬럼의 data-col 값 ('점수', '티어', 등)
function applyGradientColorsComparison(table, data, mode, sortedCol) {
    if (!table || !data || data.length === 0) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const headers = Array.from(table.querySelectorAll('thead th'));

    // 픽률 정보를 가져올 컬럼 인덱스를 찾습니다. (가중치로 사용)
    const pickRateColIndex1 = headers.findIndex(th => th.dataset.col === '픽률'); // '픽률' 헤더를 찾아 인덱스 확인

    headers.forEach((th, i) => {
        const col = th.dataset.col;
        // '실험체' 컬럼은 그라디언트 적용 제외
        if (col === '실험체') {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return;
        }

        // --- 티어 컬럼 색상 로직 ---
        // 티어 컬럼은 숫자형 델타 색상 대신 티어 변화 문자열 기반 색상 또는 Value1/Value2 기반 티어 색상을 사용
        if (col === '티어') {
            rows.forEach((r, idx) => {
                const cell = r.children[i];
                cell.style.backgroundColor = ''; // Clear any previous inline style

                if (mode === 'value1') {
                    // Value1 mode: Apply standard tier color based on Ver1 Tier value
                    const tierValue = data[idx]['티어 (Ver1)'];
                    const color = TIER_COLORS_SINGLE[tierValue];
                    if (color) {
                        cell.style.backgroundColor = color;
                    }
                } else if (mode === 'value2') {
                    // Value2 mode: Apply standard tier color based on Ver2 Tier value
                    const tierValue = data[idx]['티어 (Ver2)'];
                    const color = TIER_COLORS_SINGLE[tierValue];
                    if (color) {
                        cell.style.backgroundColor = color;
                    }
                } else if (mode === 'delta') {
                    // Delta mode: Apply gradient based on numeric rank change (if available)
                    const rankChangeValue = data[idx]['순위 변화값']; // Get rank change for this row

                    // Apply gradient only if rank change is numeric
                    if (typeof rankChangeValue === 'number' && rankChangeValue !== null && rankChangeValue !== undefined) {
                         const valueKey = '순위 변화값';
                         const isBetterWhenLower = true; // Lower rank change (more negative) is better

                         // Collect numeric rank change values for gradient calculation across the column
                         const valuesOnly = data.map(d => {
                              const val = d[valueKey];
                              return (typeof val === 'number') ? val : null;
                         }).filter(v => v !== null);

                         if (valuesOnly.length === 0) {
                              // No numeric delta data in column, no coloring
                              return; // Exit this column's processing
                         }

                         const min = Math.min(...valuesOnly);
                         const max = Math.max(...valuesOnly);
                         const avg = valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length; // Simple average for rank change

                         let ratio;
                         if (max === min) {
                             ratio = 0.5;
                         } else if (!isBetterWhenLower) { // Higher is better (not applicable for rank change)
                             ratio = (rankChangeValue >= avg)
                                 ? 0.5 + (rankChangeValue - avg) / (max - avg) * 0.5
                                 : 0.5 - (avg - rankChangeValue) / (avg - min) * 0.5;
                         } else { // Lower is better (rank change)
                             ratio = (rankChangeValue <= avg)
                                 ? 0.5 + (avg - rankChangeValue) / (avg - min) * 0.5
                                 : 0.5 - (rankChangeValue - avg) / (max - avg) * 0.5;
                         }
                         ratio = Math.max(0, Math.min(1, ratio));

                         // Interpolate from Blue (Worst) to White (0.5 - Avg) to Red (1 - Best)
                         const color = (ratio >= 0.5)
                              ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                              : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)

                         cell.style.backgroundColor = color; // Apply gradient via inline style
                    }
                    // Non-numeric rank change (신규, 삭제, -) will have no background color
                }
                // If mode is value1/value2 and tierValue is null/undefined, or mode is delta and rankChangeValue is non-numeric,
                // cell.style.backgroundColor remains '' (cleared at the start of the loop)
            });
            return; // Finished processing Tier column, move to next header
        }


        // --- 다른 숫자 컬럼 색상 로직 ---
        let valueKey; // Key to get the value for gradient calculation
        let isBetterWhenLower; // Is lower value better for coloring?
        let useSimpleAverage = false; // Should we use simple average instead of weighted?

        // Logic for other numeric stat columns (Score, Pick Rate, RP, Win Rate, Top 3, Avg Rank, Sample Size)
         if (mode === 'value1') {
             valueKey = col + ' (Ver1)';
         } else if (mode === 'value2') {
             valueKey = col + ' (Ver2)';
         } else { // mode === 'delta'
             // Delta 모드에서는 변화량 키를 사용하고, 기본적으로 단순 평균 사용
             valueKey = (col === '평균 순위') ? '평균 순위 변화량' : col + ' 변화량';
             useSimpleAverage = true; // Delta 모드는 항상 단순 평균
         }

         // Determine if lower is better based on the valueKey
         const lowerKeysAreBetter = ['평균 순위', '평균 순위 (Ver1)', '평균 순위 (Ver2)', '순위 변화값', '평균 순위 변화량'];
         isBetterWhenLower = lowerKeysAreBetter.includes(valueKey);

         // Value1 또는 Value2 모드에서 '픽률' 컬럼은 단순 평균
         if (mode !== 'delta' && col === '픽률') {
             useSimpleAverage = true;
         }
         // 그 외 (Value1/Value2 모드의 점수, RP, 승률 등)는 가중평균

        // Collect numeric values for the determined valueKey
        const valuesOnly = data.map(d => {
             const val = d[valueKey];
             return (typeof val === 'number') ? val : null;
        }).filter(v => v !== null);

        if (valuesOnly.length === 0) {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return; // Exit this column's processing
        }

        const min = Math.min(...valuesOnly);
        const max = Math.max(...valuesOnly);

        // Calculate average
        let avg;
        if (useSimpleAverage) {
             avg = valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length;
        } else {
            // Weighted average (Only for Value1/Value2 mode, non-PickRate columns)
            const pickRateKey = mode === 'value1' ? '픽률 (Ver1)' : '픽률 (Ver2)';
            const tuples = data.map(d => {
                const v = d[valueKey];
                const pr = d[pickRateKey];
                // 픽률이 숫자가 아니거나 0이면 가중치 적용 불가 (Value1/Value2 픽률 컬럼이 누락된 경우 등)
                return (typeof v === 'number' && typeof pr === 'number' && pr > 0) ? {v, pr: pr/100} : null;
            }).filter(x=>x);
            const totalPr = tuples.reduce((s,x)=>s+x.pr,0);
            const wsum    = tuples.reduce((s,x)=>s+x.v*x.pr,0);
            avg = totalPr > 0 ? wsum/totalPr : 0; // 픽률 합이 0이면 평균 0
        }


        // Apply color to each cell in the column
        rows.forEach((r, idx) => {
            const cell = r.children[i];
            const v = data[idx][valueKey]; // Get the value for this specific row

            // Skip coloring if value is not numeric (e.g., '신규 → ', '→ 삭제')
            if (typeof v !== 'number' || v === null || v === undefined) {
                 cell.style.backgroundColor = ''; // Clear any previous inline style
                 // CSS rules handle non-numeric states like '신규'/'삭제' for text/color
                 return;
            }

            let ratio;
            if (max === min) {
                ratio = 0.5;
            } else if (!isBetterWhenLower) { // Higher is better
                ratio = (v >= avg)
                    ? 0.5 + (v - avg) / (max - avg) * 0.5
                    : 0.5 - (avg - v) / (avg - min) * 0.5;
            } else { // Lower is better
                ratio = (v <= avg)
                    ? 0.5 + (avg - v) / (avg - min) * 0.5
                    : 0.5 - (v - avg) / (max - avg) * 0.5;
            }
            ratio = Math.max(0, Math.min(1, ratio));

            let color;
            // Interpolate from Blue (Worst) to White (0.5 - Avg) to Red (1 - Best)
            // The ratio calculation already maps 0=worst, 1=best based on isBetterWhenLower
            color = (ratio >= 0.5)
                 ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                 : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)

            cell.style.backgroundColor = color;
        });
    });
}

// 두 데이터셋 병합 및 변화량 계산 (common.js로 이동)
function mergeDataForComparison(data1, data2) {
    const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d])); // Ver1 데이터 (보통 최신)
    const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d])); // Ver2 데이터 (보통 과거 또는 비교 대상)

    const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
    const comparisonResult = [];

    const statsCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'];

    // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다.
    // (data1, data2는 calculateTiers를 거친 상태이며, '점수' 키를 가집니다)
    const sortedData1 = [...data1].sort((a,b) => {
         // 점수가 같으면 실험체 이름으로 정렬하여 순위의 일관성 확보
         if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0);
         return String(a['실험체']).localeCompare(String(b['실험체']));
    });
     const sortedData2 = [...data2].sort((a,b) => {
         // 점수가 같으면 실험체 이름으로 정렬하여 순위의 일관성 확보
         if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0);
         return String(a['실험체']).localeCompare(String(b['실험체']));
     });

    const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1])); // Ver1 순위
    const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1])); // Ver2 순위


    allCharacters.forEach(charName => {
        const d1 = map1[charName]; // data1 (Ver1) 데이터
        const d2 = map2[charName]; // data2 (Ver2) 데이터

        const result = { '실험체': charName };

        // Ver1과 Ver2의 각 스탯 값을 결과 객체에 추가
        statsCols.forEach(col => {
             result[`${col} (Ver1)`] = d1 ? d1[col] : null;
             result[`${col} (Ver2)`] = d2 ? d2[col] : null;

             // 변화량 계산 (Value1 - Value2)
             const val1 = result[`${col} (Ver1)`]; // 최신 시점 값
             const val2 = result[`${col} (Ver2)`]; // 과거 시점 값

             if (typeof val1 === 'number' && typeof val2 === 'number') {
                  result[`${col} 변화량`] = val1 - val2; // (최신 값) - (과거 값)
             } else {
                  // 둘 중 하나라도 숫자가 아니면 변화량 없음
                  result[`${col} 변화량`] = null;
             }
        });

        // 티어 변화 계산
        // calculateTiers에서 이미 '티어' 키가 계산되어 있음.
        // d1, d2가 null일 경우 해당 시점에 데이터가 없다는 의미.
        const tier1 = d1 ? d1['티어'] : '삭제'; // Ver1 티어 (데이터 없으면 '삭제'로 간주)
        const tier2 = d2 ? d2['티어'] : '삭제'; // Ver2 티어 (데이터 없으면 '삭제'로 간주)

         // Ver1 및 Ver2의 실제 티어 값을 결과 객체에 저장
         result['티어 (Ver1)'] = d1 ? d1['티어'] : null;
         result['티어 (Ver2)'] = d2 ? d2['티어'] : null;


         // --- 수정 시작: '티어 변화' 문자열 생성 로직 (Ver2 → Ver1 방향) ---
         if (!d2 && d1) { // Ver2에 없고 Ver1에만 있음 -> Ver1에서 신규 등장
             result['티어 변화'] = `신규 → ${tier1}`; // '신규 → {Ver1 티어}'
         } else if (d2 && !d1) { // Ver2에 있고 Ver1에 없음 -> Ver1에서 삭제됨
             result['티어 변화'] = `${tier2} → 삭제`; // '{Ver2 티어} → 삭제'
         } else if (d1 && d2) { // 둘 다 있음
             if (tier1 === tier2) {
                  result['티어 변화'] = tier1; // 티어 변화 없으면 Ver1 티어만 표시
             } else {
                  result['티어 변화'] = `${tier2} → ${tier1}`; // '{Ver2 티어} → {Ver1 티어}'
             }
         } else { // 둘 다 없음 (실제 발생 가능성은 낮지만 안전 장치)
             result['티어 변화'] = '-';
         }
         // --- 수정 끝

        // 순위 변화 계산 (점수 기준)
        const rank1 = rankMap1[charName]; // Ver1 순위
        const rank2 = rankMap2[charName]; // Ver2 순위

        result['순위 (Ver1)'] = rank1;
        result['순위 (Ver2)'] = rank2;

        if (typeof rank1 === 'number' && typeof rank2 === 'number') {
             result['순위 변화값'] = rank1 - rank2; // (Ver1 순위) - (Ver2 순위)
        } else if (typeof rank1 === 'number') {
             result['순위 변화값'] = '신규 → '; // string (Ver2에 없고 Ver1에만 있음)
        } else if (typeof rank2 === 'number') {
             result['순위 변화값'] = '→ 삭제'; // string (Ver1에 없고 Ver2에만 있음)
        } else {
             result['순위 변화값'] = '-'; // string
        }

        // 평균 순위 변화량 계산 (숫자)
        const avgRank1 = d1 ? d1['평균 순위'] : null; // Ver1 평균 순위
        const avgRank2 = d2 ? d2['평균 순위'] : null; // Ver2 평균 순위
        if (typeof avgRank1 === 'number' && typeof avgRank2 === 'number') {
             result['평균 순위 변화량'] = avgRank1 - avgRank2; // (Ver1 평균 순위) - (Ver2 평균 순위)
        } else {
             result['평균 순위 변화량'] = null;
        }


        comparisonResult.push(result);
    });

    return comparisonResult;
}