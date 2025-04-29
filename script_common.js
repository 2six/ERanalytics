//START OF FILE script_common.js
// 필요한 함수들을 전역 스코프에 둡니다.

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
    if (stddev === 0) { // 표준 편차가 0이면 모든 점수가 같다는 의미
        // 모든 점수가 평균과 같거나 높으면 S+, 낮으면 F (데이터 1개인 경우 등)
        return diff >= 0 ? 'S+' : 'F';
    }
    if (diff > stddev * parseFloat(config['S+'] || 0)) return 'S+'; // 설정값이 없을 경우 0으로 처리
    if (diff > stddev * parseFloat(config['S'] || 0)) return 'S';
    if (diff > stddev * parseFloat(config['A'] || 0)) return 'A';
    if (diff > stddev * parseFloat(config['B'] || 0)) return 'B';
    if (diff > stddev * parseFloat(config['C'] || 0)) return 'C';
    if (diff > stddev * parseFloat(config['D'] || 0)) return 'D';
    return 'F';
}

function calculateAverageScore(data) {
    const validData = data.filter(item => (item['표본수'] || 0) > 0);
    const total = validData.reduce((sum, item) => sum + (item['표本数'] || 0), 0); // Ensure 표본수 is treated as 0 if null/undefined

    if (total === 0) return 0;

    let sumRP = 0, sumWin = 0, sumTop3 = 0;
    validData.forEach(i => {
        const w = (i['표本数'] || 0) / total; // Ensure 표본수 is treated as 0 if null/undefined
        // 승률, TOP 3는 0-1 스케일로 입력된다고 가정합니다. calculateFinalStatsForPeriod에서 이 스케일을 보장해야 합니다.
        sumRP += (i['RP 획득'] || 0) * w; // Ensure stat values are treated as 0 if null/undefined
        sumWin += (i['승률'] || 0) * w;
        sumTop3 += (i['TOP 3'] || 0) * w;
    });
    // calculateTiers의 baseScore 계산에 사용되므로 0-1 스케일이 맞는 것 같습니다.
    return getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
}

function calculateStandardDeviation(data, avgScore) {
    const validData = data.filter(item => (item['표본수'] || 0) > 0);
    const total = validData.reduce((sum, item) => sum + (item['표본수'] || 0), 0); // Ensure 표본수 is treated as 0 if null/undefined

    if (total === 0) return 0;

    const variance = validData.reduce((sum, item) => {
        // 승률, TOP 3는 0-1 스케일 가정
        const s = getRPScore(item['RP 획득'] || 0) + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3; // Ensure stat values are treated as 0 if null/undefined
        return sum + Math.pow(s - avgScore, 2) * ((item['표본수'] || 0) / total); // Ensure 표본수 is treated as 0 if null/undefined
    }, 0);
     // 분산이 음수일 경우 (부동소수점 오류 등으로 발생 가능) 0으로 처리하여 NaN 방지
     if (variance < 0) {
          console.warn("Negative variance calculated, setting to 0.", variance);
          return 0;
     }
    return Math.sqrt(variance);
}

function calculateTiers(data, avgScore, stddev, config) {
     // calculateFinalStatsForPeriod 결과에서 '픽률'은 0-100% 값으로 넘어옵니다.
     // 입력 데이터셋(data)에서 유효한 픽률 값들 (0-100% 스케일)
     const pickRateValuesInInput = data.map(item => item['픽률']).filter(pr => typeof pr === 'number' && pr >= 0);
     // 입력 데이터셋 캐릭터들의 픽률 평균 (0-100% 스케일)
     const avgPickRateInInput = pickRateValuesInInput.length === 0 ? 0 : pickRateValuesInInput.reduce((sum, pr) => sum + pr, 0) / pickRateValuesInInput.length;

     const k = 1.5; // Constant used in original formula

     return data.map(item => {
         const sampleSize = item['표본수'] || 0;
         // calculateFinalStatsForPeriod 결과에서 픽률은 0-100% 값으로 넘어옵니다.
         const characterPickRate = item['픽률'] || 0; // Assuming this is the percentage (e.g., 1.5 for 1.5%)

         if (sampleSize === 0) {
              // 표본수가 0인 경우, 점수 0, F 티어, 픽률은 그대로 반환
              return {
                  ...item, // Include original properties like 실험체
                  '점수': 0.00,
                  '티어': 'F',
                  '픽률': parseFloat(characterPickRate.toFixed(2)) // Keep original pick rate (0-100%)
              };
         }

         // 픽률 'r'을 계산합니다. 캐릭터 픽률(0-100) / 평균 픽률(0-100) -> 결과는 비율 (0-n)
         const r = avgPickRateInInput === 0 ? 1 : characterPickRate / avgPickRateInInput;

         // 원본 코드의 가중치/요소 계산 로직 유지 (r에 기반)
         // 분모에 Math.exp(-k)가 중복으로 곱해져 있던 오류 수정
         const originWeight =
             r <= 1/3
                 ? 0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))
                 : 0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k));
         const meanWeight = 1 - originWeight;
         // factor 계산도 분모에 Math.exp(-k)가 중복으로 곱해져 있던 오류 수정
         let factor = avgPickRateInInput === 0 ? 1 : (0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k)));
         if (r > 5) {
             factor += 0.05 * (1 - Math.min((r - 5) / 5, 1));
         }

         // baseScore 계산 (RP는 값 그대로, 승률/TOP3는 0-1 스케일 가정)
         const baseScore = getRPScore(item['RP 획득'] || 0) + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3;

         // 최종 점수 계산 로직 유지 (low pick rate character score pulled towards avgScore)
         let score;
         // 조건: 입력 데이터셋 평균 픽률이 0보다 크고, 캐릭터 픽률이 입력 데이터셋 평균 픽률보다 낮을 경우
         // >>> 오류 수정: avgPickRateUsedInDataSet 대신 avgPickRateInInput 사용
         if (avgPickRateInInput > 0 && characterPickRate < avgPickRateInInput) {
             // Math.min(1, r)은 Math.min(1, characterPickRate / avgPickRateInInput)과 같음
             score = baseScore * (originWeight + meanWeight * Math.min(1, r)) + avgScore * meanWeight * (1 - Math.min(1, r));
             score *= factor; // factor 적용
         } else {
             // 픽률이 평균 이상이거나, 평균 픽률이 0이거나, 캐릭터 픽률이 0인 경우 (avgPickRateInInput > 0 && characterPickRate === 0)
             // baseScore에 factor만 곱함
             score = baseScore * factor;
         }
         // >>> 수정 끝


         const tierLabel = calculateTier(score, avgScore, stddev, config);

         return {
             ...item, // Include original properties
             '점수': parseFloat(score.toFixed(2)),
             '티어': tierLabel,
             '픽률': parseFloat(characterPickRate.toFixed(2)) // Ensure pick rate (0-100%) is included and formatted
         };
     });
 }

// --- 추가: Tier 라벨 맵 (공통) ---
const tierLabels = {
    'S+': 'S+',
    'S':  'S',
    'A':  'A',
    'B':  'B',
    'C':  'C',
    'D':  'D',
    'F':  'F',
    '삭제': '삭제', // '삭제' 상태 추가
    '신규': '신규'  // '신규' 상태 추가
};
// ------------------------------


// --- 추가: 특정 타임스탬프 키에 해당하는 누적 스냅샷 데이터 가져오기 ---
/**
 * 주어진 history 객체에서 정확히 timestampKey에 해당하는 누적 통계 스냅샷 데이터를 가져옵니다.
 * @param {object} history - YYYY-MM-DD_HH:mm 형식 키를 가진 누적 통계 데이터 객체.
 * @param {string} timestampKey - 가져올 데이터의 타임스탬프 키.
 * @returns {Array<object>} 해당 시점의 누적 통계 데이터 배열. 데이터가 없으면 빈 배열을 반환합니다.
 */
function getSnapshotAtTimestampKey(history, timestampKey) {
    // history 객체가 null/undefined인 경우 빈 배열 반환
    if (!history || typeof history !== 'object') return [];
    // timestampKey가 null/undefined인 경우 빈 배열 반환 (안전장치)
    if (!timestampKey) return [];
    return history[timestampKey] ? history[timestampKey] : [];
}
// -------------------------------------------------------------

// --- 추가: 특정 기간(latest, 3day, 7day)의 끝 시점 타임스탬프 키 찾기 ---
/**
 * 주어진 history 객체와 period 문자열을 받아, 해당 기간의 끝 시점 타임스탬프 키를 반환합니다.
 * latest는 최신 키, 3day/7day는 해당 기간 시작 시점의 가장 가까운 이전 키를 찾습니다.
 * @param {object} history - YYYY-MM-DD_HH:mm 형식 키를 가진 누적 통계 데이터 객체.
 * @param {string} period - 찾을 기간 ('latest', '3day', '7day').
 * @returns {string|null} 해당 시점의 타임스탬프 키. 찾지 못하거나 history가 비어있으면 null을 반환합니다.
 */
function getTimestampKeyForPeriodEnd(history, period) {
    // history 객체가 null/undefined이거나 키가 없으면 null 반환
    const keys = history && typeof history === 'object' ? Object.keys(history).sort() : [];
    if (keys.length === 0) return null;

    const latestKey = keys[keys.length - 1];

    // 'latest' 기간이면 최신 데이터의 키 반환
    if (period === 'latest') {
        return latestKey;
    }

    // '3day' 또는 '7day' 기간이면, 해당 기간 시작 시점의 데이터를 찾습니다.
    const days = period === '3day' ? 3 : 7;

    // 최신 키의 날짜 및 시간을 파싱합니다. (script_common 및 script_tier_table 로직 참고하여 견고하게 파싱)
    let latestDate = new Date(latestKey.replace('_', 'T'));
    if (isNaN(latestDate.getTime())) {
         const parts = latestKey.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (parts) {
              // UTC 시간으로 파싱 (time zone offset 문제 방지)
              latestDate = new Date(Date.UTC(parseInt(parts[1]), parseInt(parts[2])-1, parseInt(parts[3]), parseInt(parts[4]), parseInt(parts[5])));
         } else {
              console.error("Unsupported date format in history key:", latestKey);
              return null; // 파싱 실패 시 null 반환
         }
    }
    // 비교 기준을 위해 시간을 00:00:00으로 맞춤 (날짜만 비교 위주)
    latestDate.setUTCHours(0, 0, 0, 0);

    // cutoff 날짜 계산 (최신 날짜로부터 days일 전)
    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

    // cutoff 날짜보다 같거나 이전에 있는 가장 최신 키를 찾습니다.
    const pastKey = keys.slice().reverse().find(k => {
        let kDate;
        const kParts = k.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (kParts) {
              kDate = new Date(Date.UTC(parseInt(kParts[1]), parseInt(kParts[2])-1, parseInt(kParts[3]), parseInt(kParts[4]), parseInt(kParts[5])));
         } else {
              // Fallback for potentially different formats, though UTC parsing is preferred.
              try { kDate = new Date(k.replace('_', 'T')); } catch(e) { return false; }
         }
        if (isNaN(kDate.getTime())) return false;

        kDate.setUTCHours(0,0,0,0); // 비교를 위해 시간을 0으로 맞춤
        return kDate <= cutoff; // 해당 키의 날짜가 cutoff 날짜보다 같거나 이전인 경우
    });

    // 찾은 pastKey 반환 (없으면 null)
    return pastKey || null;
}
// --------------------------------------------------------------------


// --- 추가: 두 누적 스냅샷 간의 기간 내 유입 표본 통계 역산 ---
/**
 * 두 누적 통계 스냅샷 데이터를 사용하여, 나중 시점 스냅샷과 이전 시점 스냅샷 사이의
 * 새로 유입된 표본의 통계를 계산합니다. 이 함수는 역산된 표본수와 각 스탯의 합계를 계산합니다.
 * 최종 평균 스탯과 픽률은 결과 객체에 포함됩니다.
 *
 * @param {Array<object>} snapshotLatest - 나중 시점의 누적 통계 데이터 배열 (원본 JSON 스케일).
 * @param {Array<object>} snapshotPast - 이전 시점의 누적 통계 데이터 배열 (원본 JSON 스케일).
 * @returns {Array<object>} 기간 내 유입된 표본의 통계 데이터 배열. 각 항목은 '실험체', '표본수'(기간 내 증가분),
 *                          'RP 획득', '승률'(0-1), 'TOP 3'(0-1), '평균 순위', '픽률'(0-100) 필드를 가집니다.
 *                          표본 증가가 있는 기존 캐릭터 및 기간 내 신규 캐릭터가 포함됩니다.
 */
function calculatePeriodStatsForNewSamples(snapshotLatest, snapshotPast) {
    // 입력 스냅샷 배열이 유효하지 않거나 비어있으면 빈 배열 반환
    if (!Array.isArray(snapshotLatest) || snapshotLatest.length === 0) {
        console.warn("calculatePeriodStatsForNewSamples: snapshotLatest is invalid or empty.");
        return [];
    }
    if (!Array.isArray(snapshotPast)) { // past는 비어있을 수 있습니다.
         console.warn("calculatePeriodStatsForNewSamples: snapshotPast is invalid, treating as empty.");
    }


    const pastMap = Object.fromEntries((snapshotPast || []).map(d => [d.실험체, d])); // 과거 스냅샷이 null일 경우 빈 맵

    // Calculate total sample diff across all characters that exist in latest snapshot
    let totalSampleDiffPositive = 0; // Sum of positive sample differences (including new characters)
    const characterDeltaSums = {}; // Store sampleDiff and statSums per character that increased or are new

    for (const latestItem of snapshotLatest) {
        const charName = latestItem.실험체;
        const latestSample = latestItem['표본수'] || 0;

        const pastItem = pastMap[charName];
        const pastSample = pastItem ? (pastItem['표본수'] || 0) : 0; // 과거 데이터 없으면 표본수 0


        const sampleDiff = latestSample - pastSample;

        // Only process characters with positive sample increase OR new characters (sampleDiff > 0)
        if (sampleDiff > 0) {
             totalSampleDiffPositive += sampleDiff; // Sum up positive sample differences

             // Calculate total stat sum changes (diffs) for this character
             // Assume original Win/TOP3/Pick are 0-100% scale in snapshotLatest and snapshotPast
             const rpSumDiff = (latestItem['RP 획득'] || 0) * latestSample - (pastItem?.['RP 획득'] || 0) * pastSample; // Use optional chaining for pastItem
             const winSumDiff = ((latestItem['승률'] || 0) / 100 * latestSample) - ((pastItem?.['승률'] || 0) / 100 * pastSample); // Convert 0-100% to 0-1 for sum diff
             const top3SumDiff = ((latestItem['TOP 3'] || 0) / 100 * latestSample) - ((pastItem?.['TOP 3'] || 0) / 100 * pastSample); // Convert 0-100% to 0-1 for sum diff
             const avgRankSumDiff = (latestItem['평균 순위'] || 0) * latestSample - (pastItem?.['평균 순위'] || 0) * pastSample; // Assume AvgRank is original scale

             characterDeltaSums[charName] = {
                 sampleDiff: sampleDiff,
                 rpSumDiff: rpSumDiff,
                 winSumDiff: winSumDiff, // 0-1 scale sum diff
                 top3SumDiff: top3SumDiff, // 0-1 scale sum diff
                 avgRankSumDiff: avgRankSumDiff
             };
        }
    }

    // Now, iterate through characters with positive sample diffs or new characters and calculate their average stats for the period
    // and their pick rate based on the totalSampleDiffPositive
    // >>> 오류 수정: delta 변수 선언이 여기서 이루어지도록 함 (ReferenceError 방지)
    const delta = []; // Declare delta here before using it in the loop
    // >>> 수정 끝

    for (const charName in characterDeltaSums) {
         const sums = characterDeltaSums[charName];

         let pickRateForPeriod = 0; // 0-100% scale
         // totalSampleDiffPositive가 0이 아닐 때만 나누기 수행
         if (totalSampleDiffPositive > 0) {
              // Pick rate of this character's new samples relative to the total new samples (from characters with increase + new)
              pickRateForPeriod = (sums.sampleDiff / totalSampleDiffPositive) * 100; // Calculate as percentage
         }
         // Pick rate should not be negative (safety)
         pickRateForPeriod = Math.max(0, pickRateForPeriod);

         // Ensure sampleDiff is positive when dividing
         const currentSampleDiff = sums.sampleDiff || 0; // Use 0 if null/undefined
         if (currentSampleDiff <= 0) {
              // This case should ideally not be reached due to the filtering above,
              // but as a safety, prevent division by zero/negative.
              console.warn(`calculatePeriodStatsForNewSamples: SampleDiff is not positive for character ${charName}.`);
              continue; // Skip this character if sample diff is not positive
         }

         delta.push({
             '실험체': charName,
             '표본수': sums.sampleDiff, // 표본수는 이 기간에 새로 유입된 표본 수 (양수)
             'RP 획득': sums.rpSumDiff / currentSampleDiff, // 평균 스탯 (값 그대로)
             '승률':    sums.winSumDiff / currentSampleDiff, // 평균 스탯 (0-1 스케일)
             'TOP 3':   sums.top3SumDiff / currentSampleDiff, // 평균 스탯 (0-1 스케일)
             '평균 순위': sums.avgRankSumDiff / currentSampleDiff, // 평균 스탯 (값 그대로)
             '픽률': pickRateForPeriod // 이 기간 유입 표본 기준 픽률 (0-100% 스케일)
             // Note: '점수' and '티어' will be calculated later by calculateTiers based on these delta stats
         });
    }

    return delta; // Contains characters with positive sample increase or entirely new characters in the period
}
// -------------------------------------------------------------


// --- 추가: 특정 기간 선택 시 단일 모드용 최종 통계 데이터 계산 ---
/**
 * 주어진 history 객체와 period, tierConfig를 사용하여
 * 해당 기간을 선택했을 때 단일 모드에서 표시될 최종 통계 데이터셋을 계산합니다.
 *
 * @param {object} history - 누적 통계 history 데이터.
 * @param {string} period - 계산할 기간 ('latest', '3day', '7day').
 * @param {object} tierConfig - config.ini에서 로드된 티어 설정.
 * @returns {Array<object>} 최종 가공된 통계 데이터 배열 (점수, 티어 포함). 데이터가 없으면 빈 배열.
 */
function calculateFinalStatsForPeriod(history, period, tierConfig) {
    // history 객체가 null/undefined인 경우 처리
     if (!history || typeof history !== 'object') {
          console.warn("calculateFinalStatsForPeriod: Invalid history object provided.");
          return [];
     }

    const latestKey = getTimestampKeyForPeriodEnd(history, 'latest');
    if (!latestKey) {
        console.warn("calculateFinalStatsForPeriod: No latest data found in history.");
        return []; // 최신 데이터 없으면 계산 불가
    }

    let dataToProcess; // calculateAverageScore, calculateStandardDeviation, calculateTiers에 전달할 데이터 (승률/TOP3 0-1, 픽률 0-100)

    if (period === 'latest') {
        // 'latest' 기간: 최신 누적 스냅샷 데이터를 가져옵니다.
        const snapshotLatest = getSnapshotAtTimestampKey(history, latestKey);

        // calculateTiers에 전달하기 전에 '승률'과 'TOP 3'를 0-1 스케일로 변환합니다.
        // 원본 JSON 데이터가 0-100% 스케일이라고 가정합니다.
        dataToProcess = snapshotLatest.map(item => ({
            ...item,
            // 원본 데이터의 '승률', 'TOP 3'가 0-100%라고 가정하고 0-1로 변환
            '승률': (item['승률'] || 0) / 100, // 0-100% -> 0-1 스케일로 변환
            'TOP 3': (item['TOP 3'] || 0) / 100, // 0-100% -> 0-1 스케일로 변환
            // '픽률'은 calculateTiers에서 0-100%로 가정하므로 그대로 전달
             '픽률': (item['픽률'] || 0) // 0-100% 그대로
             // 'RP 획득', '평균 순위', '표본수'는 값 그대로 가정
        }));


    } else {
        // '3day' 또는 '7day' 기간: 해당 기간 동안 새로 유입된 표본 통계를 역산
        const pastKey = getTimestampKeyForPeriodEnd(history, period); // 예: 3일 전 시점 키
        // pastKey가 없거나, 이전 키가 최신 키와 같으면 해당 기간 동안 새 표본이 없거나 데이터 부족
        // 또는, history 시작 시점 이전 기간을 선택했을 경우.
        // calculatePeriodStatsForNewSamples는 pastItem이 없는 신규 캐릭터도 포함하여 반환하도록 수정되었습니다.
        // 만약 과거 스냅샷 자체가 없으면 역산 불가.
        if (!pastKey) {
             console.warn(`calculateFinalStatsForPeriod: Past data key not found for period '${period}'. Cannot calculate period stats.`);
             dataToProcess = []; // 해당 기간 데이터 없음 (역산 결과 빈 데이터)
        } else if (pastKey === latestKey) {
             console.warn(`calculateFinalStatsForPeriod: Past data key for period '${period}' is same as latest. No period stats (sample increase).`);
             dataToProcess = []; // 키가 같으면 역산 결과는 당연히 0 또는 빈 데이터
        } else {
            const snapshotLatest = getSnapshotAtTimestampKey(history, latestKey);
            const snapshotPast = getSnapshotAtTimestampKey(history, pastKey);

            // calculatePeriodStatsForNewSamples는 입력 스냅샷이 비어있거나 역산 결과가 없으면 빈 배열 반환
            // calculatePeriodStatsForNewSamples 결과의 승률/TOP3는 0-1 스케일, 픽률은 0-100% 스케일입니다.
             dataToProcess = calculatePeriodStatsForNewSamples(snapshotLatest, snapshotPast);

             if (dataToProcess.length === 0) {
                  console.warn(`calculateFinalStatsForPeriod: calculatePeriodStatsForNewSamples returned empty for period '${period}'.`);
             }
        }
    }

    // dataToProcess가 빈 배열일 수 있음. calculateAverageScore 등은 빈 배열을 처리해야 함.
    // 이 시점에서 dataToProcess는 calculateTiers에 전달할 데이터 (승률/TOP3는 0-1, 픽률은 0-100 스케일)
    // 빈 배열인 경우 calculateAverageScore 등은 0 또는 빈 배열을 반환해야 합니다.

    const avgScore = calculateAverageScore(dataToProcess); // 이 데이터셋의 평균 점수 계산 (승률/TOP3 0-1 가정)
    const stddev = calculateStandardDeviation(dataToProcess, avgScore); // 이 데이터셋의 표준 편차 계산 (승률/TOP3 0-1 가정)

    // 최종 점수, 티어, 픽률 등을 계산하여 반환
    // calculateTiers는 dataToProcess (승률/TOP3 0-1, 픽률 0-100 스케일)을 입력받습니다。
    const finalScoredData = calculateTiers(dataToProcess, avgScore, stddev, tierConfig);

    // calculateTiers 결과의 '승률', 'TOP 3' 필드는 0-1 スケール로 저장되어 있습니다. '픽률'은 0-100% 스케일입니다.
    // 이대로 반환하여 각 페이지에서 표시할 때 변환하도록 합니다.

    return finalScoredData;
}
// ------------------------------------------------------------------------


// 8. データ 정렬 (mode 인자 추가 및 로직 수정)
// mode: 'value' (단일), 'value1' (비교 Ver1), 'value2' (비교 Ver2), 'delta' (비교 변화량)
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
       // asc=true(나쁜 위로): null(나쁜)이 앞으로(-1)
       // asc=false(좋은 위로): null(나쁜)이 뒤로(1)
       if (xIsNull) return asc ? -1 : 1;
       // asc=true(나쁜 위로): null(나쁜)이 뒤로(1)
       // asc=false(좋은 위로): null(나쁜)이 앞으로(-1)
       if (yIsNull) return asc ? 1 : -1;


       // --- 데이터 타입별 비교 로직 ---

       // 1. 기본 문자열 비교 (실험체 이름)
       if (sortKey === '실험체') {
            // 실험체 이름은 항상 가나다순 오름차순 / 역순 내림차순 (오름차순이 '좋은' 기준)
            // sortData의 asc는 '나쁜 것 위로' (true) / '좋은 것 위로' (false) 기준
            // 따라서 '좋은 것 위로' (asc=false)일 때 가나다순 오름차순이 되어야 함 (x.localeCompare(y))
            // '나쁜 것 위로' (asc=true)일 때 가나다 역순 내림차순이 되어야 함 (y.localeCompare(x))
            return asc
               ? String(y).localeCompare(String(x)) // asc=true: 내림차순 (Z-A)
               : String(x).localeCompare(String(y)); // asc=false: 오름차순 (A-Z)
       }

       // 2. 순서가 정의된 문자열 비교 (순위 변화값 문자열, 표본수 변화량 문자열)
       // '신규 → ' > '-' > '→ 삭제' 순서로 정렬 (좋은 것 -> 나쁜 것)
       const order = {'신규 → ': 2, '-': 1, '→ 삭제': 0}; // 순위 변화값 문자열 순서 (높을수록 좋음)
       const sampleOrder = {'new': 2, 'none': 1, 'removed': 0}; // 표본수 변화량 문자열 순서 (높을수록 좋음)
       // Note: '티어 변화' sortKey는 현재 사용되지 않음 (순위 변화값으로 정렬)

       let orderX, orderY;
       let isStringOrderComparison = false;

       if (sortKey === '순위 변화값' && typeof x !== 'number' && typeof y !== 'number') {
           orderX = order[x] !== undefined ? order[x] : -1; // 순서에 없는 문자열 처리 (-1)
           orderY = order[y] !== undefined ? order[y] : -1;
           isStringOrderComparison = true;
       } else if (sortKey === '표본수 변화량' && typeof x !== 'number' && typeof y !== 'number') {
            orderX = sampleOrder[x] !== undefined ? sampleOrder[x] : -1; // 순서에 없는 문자열 처리 (-1)
            orderY = sampleOrder[y] !== undefined ? sampleOrder[y] : -1;
            isStringOrderComparison = true;
       }

       if (isStringOrderComparison) {
            // order 값이 높을수록 좋음 -> 숫자 비교와 동일하게 처리
            const xOrder = orderX;
            const yOrder = orderY;

            // asc=false (좋은 것 위로): order 값이 큰 것이 위로 -> 내림차순 (yOrder - xOrder)
            // asc=true (나쁜 것 위로): order 값이 작은 것이 위로 -> 오름차순 (xOrder - yOrder)
            return asc ? (xOrder - yOrder) : (yOrder - xOrder);
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

       // 문자열 형태의 숫자('1.23', '+2.5%', '-3', '50.1%')를 파싱하여 숫자 비교
       // parseFloat로 변환 시 NaN이 나올 수 있으므로 isNaN 체크 후 0 처리
       const xNum = typeof x === 'number' ? x : parseFloat(String(x).replace(/[+%▲▼]/g, ''));
       const yNum = typeof y === 'number' ? y : parseFloat(String(y).replace(/[+%▲▼]/g, ''));

       const xIsNumber = !isNaN(xNum);
       const yIsNumber = !isNaN(yNum);

       // 숫자와 숫자가 아닌 값 비교 (숫자가 아닌 값은 '나쁜' 것으로 간주하여 정렬)
       // asc=true(나쁜 위로): 숫자가 아닌 값(-1), 숫자인 값(1) -> 숫자가 아닌 값이 위로
       // asc=false(좋은 위로): 숫자가 아닌 값(1), 숫자인 값(-1) -> 숫자가 아닌 값이 뒤로
       if (!xIsNumber && !yIsNumber) return 0;
       if (!xIsNumber) return asc ? -1 : 1;
       if (!yIsNumber) return asc ? 1 : -1;

       // 숫자 값 비교
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
   });
}


// 10. 色상 보간 헬퍼 함수 (기존 함수 유지)
function interpolateColor(start, end, ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
    return `rgba(${rgb.join(',')}, ${0.3 + 0.5 * t})`;
}

// 티어 색상 (단일 모드)
const TIER_COLORS_SINGLE = {
    'S+': 'rgba(255,127,127, 1)',
    'S':  'rgba(255,191,127, 1)',
    'A':  'rgba(255,223,127, 1)',
    'B':  'rgba(255,255,127, 1)',
    'C':  'rgba(191,255,127, 1)',
    'D':  'rgba(127,255,127, 1)',
    'F':  'rgba(127,255,255, 1)',
};

// 11. 단일 데이터용 그라디언트 색상 적용
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
        // valuesOnly에는 셀에 표시된 스케일의 숫자 값이 들어갑니다.
        const valuesOnly = rows.map(r => {
             const cell = r.children[i];
             const text = cell.textContent.replace('%','');
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

        // 픽률 열은 단순 평균, 그 외는 가중평균
        if (col === '픽률') {
            // 픽률 열은 단순 평균 (valuesOnly는 이미 픽률 값들의 배열, 0-100% 스케일)
            avg = valuesOnly.reduce((sum, value) => sum + value, 0) / valuesOnly.length;
        } else {
             // 그 외 스탯 열은 픽률을 가중치로 사용한 가중평균
             const valuesWithPickRate = rows.map(r => {
                  const cell = r.children[i];
                  // applyGradientColorsSingle은 cell.textContent를 파싱한 값 v를 사용합니다.
                  // v의 스케일은 renderTable에서 표시될 스케일 (승률/TOP3 0-100%, 픽률 0-100%, 나머지는 값 그대로)
                  const text = cell.textContent.replace('%','');
                  const val = parseFloat(text); // 표시될 스케일의 값 (예: 승률 51.2, RP 획득 10.50)

                  let pickRate = 0;
                  if (pickRateColIndex !== -1) {
                       const pickRateCell = r.children[pickRateColIndex];
                       // 픽률 값 자체를 가져와서 사용 (이미 퍼센트 형태, 0-100% 스케일)
                       const prText = pickRateCell.textContent.replace('%','');
                       // 가중치로 사용하려면 0-1 스케일이 필요합니다。
                       pickRate = parseFloat(prText) / 100; // 0~1 사이 값으로 변환
                  } else {
                       // 만약 픽률 컬럼이 없는데 가중평균이 필요하다면 다른 가중치 기준 필요
                       console.error("픽률 컬럼이 없습니다. 가중평균 계산 불가.");
                       return null; // 계산 불가 시 해당 항목 제외
                  }

                  // val은 표시될 스케일, pickRate는 0-1 스케일입니다.
                  return isNaN(val) ? null : { value: val, pickRate: pickRate };
             }).filter(item => item !== null && item.pickRate > 0); // 유효한 값 + 픽률이 0보다 큰 항목만 사용


             let totalPickRate = valuesWithPickRate.reduce((sum, item) => sum + item.pickRate, 0); // 픽률 합 (0-1 스케일)
             // weightedSum은 스탯 값(다양한 스케일) * 픽률 가중치(0-1 스케일) 의 합
             let weightedSum = valuesWithPickRate.reduce((sum, item) => sum + item.value * item.pickRate, 0);

             // 平均はweightedSum / totalPickRate. この平均のスケールはステータス値のスケールを追跡します。
             // 평균은 weightedSum / totalPickRate. 이 평균의 스케일은 스탯 값의 스케일을 따라갑니다.
             avg = totalPickRate === 0 ? (valuesOnly.length > 0 ? valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length : 0) : weightedSum / totalPickRate; // Fallback to simple average if totalPickRate is 0 or valuesOnly is empty
        }

        rows.forEach((r) => {
            const cell = r.children[i];
            // セルテキストから % を取り除いてパース (表示されるスケールの値)
            const cellText = cell.textContent.replace('%','');
            const v = parseFloat(cellText); // 이 v의 스케일은 컬럼에 따라 다릅니다. (승률/TOP3 0-100%, 픽률 0-100%, 나머지는 값 그대로)

            if (isNaN(v) || v === null) {
                 cell.style.backgroundColor = '';
                 return;
            }

            let ratio;
            const isBad = badCols.includes(col);

            // 平均値(avg)を基準にスケーリング
            // v와 avg는 동일한 스케일 (컬럼에 따라 다름)
             if (max === min) {
                 ratio = 0.5;
             } else if (!isBad) { // 클수록 좋음
                 if (v >= avg) {
                      if (max === avg) ratio = 0.5; else ratio = 0.5 + (v - avg) / (max - avg) * 0.5;
                 } else { // v < avg
                      if (avg === min) ratio = 0.5; else ratio = 0.5 - (avg - v) / (avg - min) * 0.5;
                 }
             } else { // 작을수록 좋음
                 if (v <= avg) {
                      if (avg === min) ratio = 0.5; else ratio = 0.5 + (avg - v) / (avg - min) * 0.5;
                 } else { // v > avg
                      if (max === avg) ratio = 0.5; else ratio = 0.5 - (v - avg) / (max - avg) * 0.5;
                 }
             }
            ratio = Math.max(0, Math.min(1, ratio)); // Clamp between 0 and 1

            let color;
            // Interpolate from Blue (0 - Worst) to White (0.5 - Avg) to Red (1 - Best)
            // Based on the ratio.
            color = (ratio >= 0.5)
                 ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                 : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)

            cell.style.backgroundColor = color;
        });
    });

    const tierColIndex = headers.findIndex(th => th.dataset.col === '티어');
    if (tierColIndex >= 0) {
        rows.forEach(tr => {
            const cell = tr.children[tierColIndex];
            const tierValue = cell.textContent.trim();
            const color = TIER_COLORS_SINGLE[tierValue]; // TIER_COLORS_SINGLE은 common.js에 정의됨
            if (color) {
                cell.style.backgroundColor = color;
            } else {
                cell.style.backgroundColor = '';
            }
        });
    }
}

// 12. 비교 데이터용 그라디언트 색상 적용
// data: 정렬된 비교 데이터 배열 (mergeDataForComparison 결과)
// mode: 현재 정렬 모드 ('value1', 'value2', 'delta')
// sortedCol: 현재 정렬 기준 컬럼의 data-col 값 ('점수', '티어', 등)
function applyGradientColorsComparison(table, data, mode, sortedCol) {
    if (!table || !data || data.length === 0) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const headers = Array.from(table.querySelectorAll('thead th'));

    // 픽률 정보를 가져올 컬럼 인덱스를 찾습니다. (가중치로 사용)
    const pickRateColIndex = headers.findIndex(th => th.dataset.col === '픽률'); // 픽률 컬럼 인덱스

    headers.forEach((th, i) => {
        const col = th.dataset.col;
        if (![...goodCols, ...badCols].includes(col)) return;

        // '실험체' 컬럼은 그라디언트 적용 제외 (이미 위에서 처리)
        if (col === '실험체') {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return;
        }

        // --- 티어 컬럼 색상 로직 ---
        if (col === '티어') {
            rows.forEach((r, idx) => {
                const cell = r.children[i];
                cell.style.backgroundColor = ''; // Clear any previous inline style for Tier column

                // In comparison mode, tier column coloring is based on Rank Change Delta value (numeric).
                // The tier icons/text inside the cell provide the Ver1/Ver2 tier information.
                const rankChangeValue = data[idx]['순위 변화값']; // Get rank change for this row (number or string)

                // Apply gradient only if rank change is numeric for coloring
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
                          // rows.forEach(tr => tr.children[i].style.backgroundColor = ''); // Already cleared at start of cell loop
                          return; // Exit this cell's coloring logic
                     }

                     const min = Math.min(...valuesOnly);
                     const max = Math.max(...valuesOnly);
                     const avg = valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length; // Simple average for numeric rank change

                     let ratio;
                     if (max === min) {
                         ratio = 0.5;
                     } else if (!isBetterWhenLower) { // Higher is better (not applicable for rank change)
                         // This branch is unlikely for rank change but kept for generality based on original logic.
                         ratio = (rankChangeValue >= avg)
                             ? 0.5 + (rankChangeValue - avg) / (max - avg) * 0.5
                             : 0.5 - (avg - rankChangeValue) / (avg - min) * 0.5;
                     } else { // Lower is better (rank change)
                         // The logic `(avg - v) / (avg - min)` for `v <= avg` mapping [min, avg] to [0, 1] (min->1, avg->0)
                         // And `(v - avg) / (max - avg)` for `v > avg` mapping [avg, max] to [0, 1] (avg->0, max->1)
                         // Then combining them with 0.5 offset is correct for using avg as center.
                          if (rankChangeValue <= avg) { // v is better than or equal to avg
                             // map [min, avg] to [1, 0.5]
                              if (avg === min) ratio = 0.5; else ratio = 0.5 + (avg - rankChangeValue) / (avg - min) * 0.5;
                         } else { // v > avg (v is worse)
                              // map [avg, max] to [0.5, 0]
                              if (max === avg) ratio = 0.5; else ratio = 0.5 - (rankChangeValue - avg) / (max - avg) * 0.5;
                         }

                     }
                     ratio = Math.max(0, Math.min(1, ratio)); // Clamp between 0 and 1

                     let color;
                     // Interpolate from Blue (0 - Worst) to White (0.5 - Avg) to Red (1 - Best)
                     // For rank change (lower is better), min (large negative, best) maps to ratio 1 (Red), max (large positive, worst) maps to ratio 0 (Blue).
                     color = (ratio >= 0.5)
                          ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                          : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)

                     cell.style.backgroundColor = color; // Apply gradient via inline style
                }
                // Non-numeric rank change (신규, 삭제, -) will have no background color from this JS logic, relying on CSS if defined.
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
             valueKey = (col === '평균 순위') ? '평균 순위 변화량' : col + ' 변화량';
         }

         // Determine if lower is better based on the valueKey
         const lowerKeysAreBetter = ['평균 순위', '평균 순위 (Ver1)', '평균 순위 (Ver2)', '순위 변화값', '평균 순위 변화량'];
         isBetterWhenLower = lowerKeysAreBetter.includes(valueKey);

         // Use simple average for any column in Delta mode
         // Use weighted average for Value1/Value2 modes UNLESS it's Pick Rate or Sample Size (which don't have Pick Rate weight)
         if (mode === 'delta' || col === '픽률' || col === '표본수') {
             useSimpleAverage = true;
         }
        // Note: Tier column now handled separately above, so this weighted average logic applies only to other numeric columns

        // Collect numeric values for the determined valueKey across all rows in the data array
        // mergeDataForComparison 결과의 승률, TOP 3는 0-1 스케일, 픽률은 0-100% 스케일입니다.
        // valuesOnly에는 표시될 스케일의 숫자를 모읍니다.
        const valuesOnly = data.map(d => {
             const val = d[valueKey];
             let v;
             if (typeof val === 'number') {
                  // 픽률, 승률, TOP 3 컬럼은 표시될 때 %가 붙으며, 승률/TOP3는 100이 곱해집니다.
                  // 예를 들어 승률이 0.51이면 표시될 때 "51.00%"가 되고, 여기서 파싱하면 51이 됩니다。
                  // 픽률이 1.5%이면 표시될 때 "1.50%"가 되고, 여기서 파싱하면 1.5가 됩니다。
                  // RP, 점수, 평균 순위, 표본수는 값 그대로 표시됩니다。
                  if (col === '승률' || col === 'TOP 3') v = val * 100; // 0-1 -> 0-100 (가정)
                  else if (col === '픽률') v = val; // 0-100 그대로 (가정)
                  else v = val; // 다른 값 그대로
             } else { // 문자열 ('신규', '삭제', '-', 변화량 문자열 등)
                  // 델타 컬럼 중 문자열 값은 숫자 비교에서 제외되어야 합니다。
                  if (mode === 'delta' && (col === '티어' || col === '실험체' || col === '표본수' || col === '평균 순위')) { // 순위 변화값, 표본수 변화량, 평균 순위 변화량 등이 문자열일 수 있음
                       return null;
                  }
                  // 다른 숫자 변화량 컬럼('점수 변화량', '픽률 변화량', 'RP 변화량' 등)의 문자열 ('▲2.50', '▼10')은 파싱 가능。
                  // applyGradientColorsComparison은 cell.textContentからパースしたvを使用するため、valuesOnlyもパース可能な数値文字列を含む必要があります。
                  v = parseFloat(String(val).replace(/[+%▲▼]/g, '')); // 기호 제거 후 파싱
             }

             return isNaN(v) ? null : v;
        }).filter(v => v !== null); // 유효한 숫자 값만 필터링

        if (valuesOnly.length === 0) {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return;
        }

        const min = Math.min(...valuesOnly);
        const max = Math.max(...valuesOnly);

        // Calculate average
        let avg;
        if (useSimpleAverage) {
             avg = valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length;
        } else {
            // Weighted average for Value1/Value2 modes, using Pick Rate (Ver1 or Ver2) as weight
            // Pick Rate in calculateFinalStatsForPeriod result is 0-100% scale.
            // Weight should be based on 0-1 scale pick rate.
            const pickRateKey = mode === 'value1' ? '픽률 (Ver1)' : '픽률 (Ver2)';
            const tuples = data.map(d => {
                const v = d[valueKey]; // ス탯 값 (점수, RP 등 - 다양한 스케일, calculateFinalStatsForPeriod 결과)
                const pr = d[pickRateKey]; // 픽률 값 (0-100% 스케일, calculateFinalStatsForPeriod 결과)
                // Ensure value and pick rate are numbers, and pick rate is positive for weighting
                 // applyGradientColorsComparison은 표시될 스케일의 v와 0-1 스케일의 픽률 가중치로 가중평균을 계산해야 합니다.
                let statValueForAvg;
                if (typeof v === 'number') {
                     if (col === '勝率' || col === 'TOP 3') statValueForAvg = v * 100; // 0-1 -> 0-100 (가정)
                     else if (col === 'ピック率') statValueForAvg = v; // 0-100 그대로 (가정)
                     else statValueForAvg = v; // 다른 값 그대로
                } else { // 비숫자 값 (가중평균에서 제외)
                     return null;
                }

                return (typeof pr === 'number' && pr > 0) ? {v: statValueForAvg, pr: pr/100} : null; // Divide pick rate by 100
            }).filter(x=>x); // Filter out items where value, pick rate is invalid or pick rate is zero

            const totalPr = tuples.reduce((s,x)=>s+x.pr,0); // 픽률 합 (0-1 스케일)
            // weightedSum은 스탯 값(표시될 스케일) * 픽률 가중치(0-1 스케일) 의 합
            let weightedSum = tuples.reduce((s,x)=>s+x.v*x.pr,0);

            // 平均はweightedSum / totalPr. この平均のスケールはステータス値のスケールを追跡します。
            // 평균은 weightedSum / totalPr. 이 평균의 스케일은 스탯 값의 스케일을 따라갑니다.
            avg = totalPr > 0 ? wsum/totalPr : (valuesOnly.length > 0 ? valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length : 0); // Fallback to simple average if totalPr is 0 or valuesOnly is empty
        }


        // Apply color to each cell in the column
        rows.forEach((r, idx) => {
            const cell = r.children[i];
            // セルテキストから % を取り除いてパース (表示されるスケールの値)
            // 이 v의 스케일은 renderComparisonTable에서 표시될 스케일입니다.
            const cellText = cell.textContent.replace('%','');
            const v = parseFloat(cellText);

            if (isNaN(v) || v === null) {
                 cell.style.backgroundColor = ''; // Clear any previous inline style
                 // CSS rules will handle non-numeric states like '新규'/'削除' if defined.
                 return;
            }

            let ratio;
            const isBad = badCols.includes(col);

            // 平均値(avg)を基準にスケーリング
            // v와 avg는 동일한 스케일 (컬럼에 따라 다름)
             if (max === min) {
                 ratio = 0.5;
             } else if (!isBad) { // 클수록 좋음
                 if (v >= avg) {
                      if (max === avg) ratio = 0.5; else ratio = 0.5 + (v - avg) / (max - avg) * 0.5;
                 } else { // v < avg
                      if (avg === min) ratio = 0.5; else ratio = 0.5 - (avg - v) / (avg - min) * 0.5;
                 }
             } else { // 작을수록 좋음
                 if (v <= avg) {
                      if (avg === min) ratio = 0.5; else ratio = 0.5 + (avg - v) / (avg - min) * 0.5;
                 } else { // v > avg
                      if (max === avg) ratio = 0.5; else ratio = 0.5 - (v - avg) / (max - avg) * 0.5;
                 }
             }
            ratio = Math.max(0, Math.min(1, ratio)); // Clamp between 0 and 1

            let color;
            // Interpolate from Blue (0 - Worst) to White (0.5 - Avg) to Red (1 - Best)
            // Based on the ratio.
            color = (ratio >= 0.5)
                 ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red (Avg to Best)
                 : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White (Worst to Avg)

            cell.style.backgroundColor = color;
        });
    });
}

// 두 데이터셋 병합 및 변화량 계산 (common.js로 이동)
function mergeDataForComparison(data1, data2) {
    // data1과 data2는 이미 calculateFinalStatsForPeriod를 거친 최종 데이터셋입니다.
    // calculateFinalStatsForPeriod 결과의 '승률', 'TOP 3'는 0-1 스케일, '픽률', '표본수', '점수', 'RP 획득', '평균 순위'는 값 그대로 (표시될 스케일)입니다。

    const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
    const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

    // 모든 캐릭터 목록은 두 데이터셋에 등장하는 모든 실험체를 포함합니다.
    const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
    const comparisonResult = [];

    // 스탯 컬럼 목록 (변화량 및 비교값 계산 대상)
    const statsCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수']; // 표본수 포함

    // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다.
    // 점수 계산이 완료된 finalScoredData를 입력받으므로 '점수' 필드를 바로 사용합니다.
    const sortedData1 = [...data1].sort((a,b) => {
         // 점수 기준 내림차순, 같으면 실험체 이름 오름차순 (안정 정렬)
         const scoreA = a['점수'] !== undefined && a['점수'] !== null ? a['점수'] : -Infinity; // null/undefined 점수는 가장 낮게
         const scoreB = b['점수'] !== undefined && b['점수'] !== null ? b['점수'] : -Infinity;

         if (scoreB !== scoreA) return scoreB - scoreA;
         return String(a['실험체']).localeCompare(String(b['실험체']));
    });
     const sortedData2 = [...data2].sort((a,b) => {
         // 점수 기준 내림차순, 같으면 실험체 이름 오름차순 (안정 정렬)
         const scoreA = a['점수'] !== undefined && a['점수'] !== null ? a['점수'] : -Infinity; // null/undefined 점수는 가장 낮게
         const scoreB = b['점수'] !== undefined && b['점수'] !== null ? b['점수'] : -Infinity;

         if (scoreB !== scoreA) return scoreB - scoreA;
         return String(a['실험체']).localeCompare(String(b['실험체']));
     });

    // 정렬된 데이터셋에서 순위 맵 생성 (1부터 시작)
    // data1/data2에 해당 캐릭터가 없으면 순위는 부여되지 않습니다.
    const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1]));
    const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1]));


    allCharacters.forEach(charName => {
        const d1 = map1[charName]; // Data 1 (Period 1 final stats from calculateFinalStatsForPeriod)
        const d2 = map2[charName]; // Data 2 (Period 2 final stats from calculateFinalStatsForPeriod)

        const result = { '실험체': charName };

        statsCols.forEach(col => {
             // d1, d2는 calculateFinalStatsForPeriod의 결과이므로 점수, 픽률, RP 등 필드가 계산되어 있을 것입니다.
             // 승률, TOP 3는 0-1 스케일, 픽률은 0-100% 스케일, 나머지는 값 그대로입니다.
             // 다만, 해당 기간에 표본이 없었거나 데이터 로드 실패 등의 이유로 d1/d2가 undefined/null일 수 있습니다.
             // 또한, d1/d2 객체 안에 특정 col의 값이 계산되지 않았거나 (예: 표본 0) null/undefined일 수 있습니다.

             const val1 = d1 ? d1[col] : null;
             const val2 = d2 ? d2[col] : null;

             // calculateFinalStatsForPeriod 결과의 '승률', 'TOP 3'는 0-1 스케일, 나머지는 값 그대로입니다.
             // 비교 결과 객체에는 원본 스케일 그대로 저장합니다.
             result[`${col} (Ver1)`] = val1;
             result[`${col} (Ver2)`] = val2;

             // 숫자 값인 경우에만 변화량 계산
             // null 또는 undefined 값은 숫자 비교/계산에서 제외
             // 승률, TOP 3는 0-1 스케일 그대로 계산합니다.
             if (typeof val1 === 'number' && typeof val2 === 'number') {
                  result[`${col} 변화량`] = val2 - val1;
             } else {
                  result[`${col} 변화량`] = null; // 둘 중 하나라도 숫자가 아니면 변화량 없음
             }
        });

        // 티어 변화 계산
        // d1, d2는 calculateFinalStatsForPeriod 결과이므로 '티어' 필드가 있을 것입니다.
        // 해당 기간에 표본이 없거나 데이터 로드 실패 등으로 d1/d2 객체가 없으면 티어는 null/undefined입니다.
         const tier1 = d1 ? d1['티어'] : null;
         const tier2 = d2 ? d2['티어'] : null;

         // Ver1 및 Ver2의 실제 티어 값을 결과 객체에 저장
         result['티어 (Ver1)'] = tier1;
         result['티어 (Ver2)'] = tier2;

         // 티어 변화 문자열 생성
         if (tier1 !== null && tier1 !== undefined && tier2 !== null && tier2 !== undefined) {
             if (tier1 === tier2) {
                 result['티어 변화'] = tier1; // 티어 변화 없으면 해당 티어만 표시 (string)
             } else {
                 result['티어 변화'] = `${tier1} → ${tier2}`; // 티어 변화 표시 (string)
             }
         } else if (tier1 !== null && tier1 !== undefined) { // Ver1에만 데이터 있고 Ver2에 없는 경우 (삭제)
             result['티어 변화'] = `${tier1} → 삭제`; // string
         } else if (tier2 !== null && tier2 !== undefined) { // Ver2에만 데이터 있고 Ver1에 없는 경우 (신규)
             result['티어 변화'] = `신규 → ${tier2}`; // string
         } else { // 둘 다 없는 경우
             result['티어 변화'] = '-'; // string
         }


        // 순위 변화 계산 (점수 기준)
        // rankMap1/rankMap2는 해당 데이터셋에 캐릭터가 있으면 순위를 가집니다.
        const rank1 = rankMap1[charName]; // number or undefined
        const rank2 = rankMap2[charName]; // number or undefined

        result['순위 (Ver1)'] = rank1 !== undefined ? rank1 : null; // null로 통일
        result['순위 (Ver2)'] = rank2 !== undefined ? rank2 : null; // null로 통일


        if (typeof rank1 === 'number' && typeof rank2 === 'number') {
             result['순위 변화값'] = rank2 - rank1; // 실제 변화량 (-10, +10 등) (number)
        } else if (typeof rank1 === 'number') { // Ver1에만 있고 Ver2에 없음 (삭제)
             result['순위 변화값'] = '→ 삭제'; // string
        } else if (typeof rank2 === 'number') { // Ver2에만 있고 Ver1에 없음 (신규)
             result['순위 변화값'] = '신규 → '; // string
        } else { // 둘 다 없음
             result['순위 변화값'] = '-'; // string
        }

        // 平均順位 변화량 계산 (숫자)
        // d1, d2는 calculateFinalStatsForPeriod 결과이므로 '평균 순위' 필드가 있을 것입니다.
        // 해당 기간에 표본이 없었으면 '평균 순위' 값이 null/undefined일 수 있습니다.
        const avgRank1 = d1 ? d1['평균 순위'] : null;
        const avgRank2 = d2 ? d2['평균 순위'] : null;

        if (typeof avgRank1 === 'number' && typeof avgRank2 === 'number') {
             result['평균 순위 변화량'] = avgRank2 - avgRank1; // number
        } else {
             result['평균 순위 변화량'] = null; // null
        }


        comparisonResult.push(result);
    });

    return comparisonResult;
}