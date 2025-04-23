// script_common.js
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
    if (diff > stddev * parseFloat(config['S+'])) return 'S+';
    if (diff > stddev * parseFloat(config['S'])) return 'S';
    if (diff > stddev * parseFloat(config['A'])) return 'A';
    if (diff > stddev * parseFloat(config['B'])) return 'B';
    if (diff > stddev * parseFloat(config['C'])) return 'C';
    if (diff > stddev * parseFloat(config['D'])) return 'D';
    return 'F';
}

function calculateAverageScore(data) {
    const validData = data.filter(item => (item['표본수'] || 0) > 0);
    const total = validData.reduce((sum, item) => sum + item['표본수'], 0);

    if (total === 0) return 0;

    let sumRP = 0, sumWin = 0, sumTop3 = 0;
    validData.forEach(i => {
        const w = i['표본수'] / total;
        sumRP += (i['RP 획득'] || 0) * w;
        sumWin += (i['승률'] || 0) * w;
        sumTop3 += (i['TOP 3'] || 0) * w;
    });
    return getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3;
}

function calculateStandardDeviation(data, avgScore) {
    const validData = data.filter(item => (item['표본수'] || 0) > 0);
    const total = validData.reduce((sum, item) => sum + item['표본수'], 0);

    if (total === 0) return 0;

    const variance = validData.reduce((sum, item) => {
        const s = getRPScore(item['RP 획득'] || 0) + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3;
        return sum + Math.pow(s - avgScore, 2) * (item['표본수'] / total);
    }, 0);
    return Math.sqrt(variance);
}

function calculateTiers(data, avgScore, stddev, config) {
    const total = data.reduce((sum, item) => sum + (item['표본수'] || 0), 0);
    const avgPickRate = total === 0 ? 0 : data.reduce((sum, i) => sum + (i['표본수'] || 0), 0) / total / (data.length || 1);

    const k = 1.5;

    return data.map(item => {
        if ((item['표본수'] || 0) === 0) { // null/undefined 대비
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
                ? 0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))
                : 0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k));
        const meanWeight = 1 - originWeight;
        let factor = avgPickRate === 0 ? 1 : (0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k)));
        if (r > 5) {
            factor += 0.05 * (1 - Math.min((r - 5) / 5, 1));
        }
        const baseScore = getRPScore(item['RP 획득'] || 0) + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3;
        let score;

        if (avgPickRate !== 0 && (item['표본수'] || 0) < total * avgPickRate) {
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

// 8. 데이터 정렬 (mode 인자 추가 및 로직 수정)
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

// 9. 기간별 데이터 추출 함수 (델타 계산 로직 제거)
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

        kDate.setUTCHours(0,0,0,0);
        return kDate <= cutoff;
    });

    if (!pastKey) {
        console.warn(`No data found before cutoff date ${cutoff.toISOString()} for period '${period}'. Returning empty array.`);
        return []; // Return empty array if no past data found
    }

    return history[pastKey]; // Return the data for the found past key
}

// 10. 색상 보간 헬퍼 함수 (기존 함수 유지)
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

        // 사용자 요구사항 반영: 픽률 열은 단순 평균, 그 외는 가중평균
        if (col === '픽률') {
            // 픽률 열은 단순 평균
            avg = valuesOnly.reduce((sum, value) => sum + value, 0) / valuesOnly.length;
        } else {
             // 그 외 스탯 열은 픽률을 가중치로 사용한 가중평균
             const valuesWithPickRate = rows.map(r => {
                  const cell = r.children[i];
                  const text = cell.textContent.replace('%','');
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
            const cellText = cell.textContent.replace('%','');
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

// 12. 비교 데이터용 그라디언트 색상 적용
// data: 정렬된 비교 데이터 배열 (행 객체들의 배열)
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
        // '실험체' 컬럼은 그라디언트 적용 제외
        if (col === '실험체') {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return;
        }

        // --- 티어 컬럼 색상 로직 ---
        if (col === '티어') {
            rows.forEach((r, idx) => {
                const cell = r.children[i];
                cell.style.backgroundColor = ''; // Clear any previous inline style for Tier column

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
                    // Delta mode: Apply gradient based on numeric rank change
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
                              return;
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

        // --- 다른 숫자 컬럼 색상 로직 (기존 그대로) ---
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

         // Use simple average for Pick Rate (any mode) and any column in Delta mode
         if (col === '픽률' || mode === 'delta') {
             useSimpleAverage = true;
         }
         // Otherwise, use weighted average (default is false)
        // Note: Tier column now handled separately above, so this weighted average logic applies only to other numeric columns

        // Collect numeric values for the determined valueKey
        const valuesOnly = data.map(d => {
             const val = d[valueKey];
             return (typeof val === 'number') ? val : null;
        }).filter(v => v !== null);

        if (valuesOnly.length === 0) {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return; // Changed from continue to return
        }

        const min = Math.min(...valuesOnly);
        const max = Math.max(...valuesOnly);

        // Calculate average
        let avg;
        if (useSimpleAverage) {
             avg = valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length;
        } else {
            // Weighted average
            const pickRateKey = mode === 'value1' ? '픽률 (Ver1)' : '픽률 (Ver2)';
            const tuples = data.map(d => {
                const v = d[valueKey];
                const pr = d[pickRateKey];
                return (typeof v === 'number' && typeof pr === 'number' && pr > 0) ? {v, pr: pr/100} : null;
            }).filter(x=>x);
            const totalPr = tuples.reduce((s,x)=>s+x.pr,0);
            const wsum    = tuples.reduce((s,x)=>s+x.v*x.pr,0);
            avg = totalPr > 0 ? wsum/totalPr : 0;
        }


        // Apply color to each cell in the column
        rows.forEach((r, idx) => {
            const cell = r.children[i];
            const v = data[idx][valueKey]; // Get the value for this specific row

            // Skip coloring if value is not numeric
            if (typeof v !== 'number' || v === null || v === undefined) {
                 cell.style.backgroundColor = ''; // Clear any previous inline style
                 // CSS rules will handle non-numeric states like '신규'/'삭제'
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

    // 6) 두 데이터셋 병합 및 변화량 계산 (common.js로 이동)
    function mergeDataForComparison(data1, data2) {
        const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
        const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

        const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
        const comparisonResult = [];

        const statsCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'];

        // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다.
        const sortedData1 = [...data1].sort((a,b) => {
             if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0);
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });
         const sortedData2 = [...data2].sort((a,b) => {
             if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0);
             return String(a['실험체']).localeCompare(String(b['실험체']));
         });

        const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1])); // 1부터 시작하는 순위
        const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1]));


        allCharacters.forEach(charName => {
            const d1 = map1[charName];
            const d2 = map2[charName];

            const result = { '실험체': charName };

            statsCols.forEach(col => {
                 const val1 = d1 ? d1[col] : null;
                 const val2 = d2 ? d2[col] : null;

                 result[`${col} (Ver1)`] = val1;
                 result[`${col} (Ver2)`] = val2;

                 // 숫자 값인 경우에만 변화량 계산
                 if (typeof val1 === 'number' && typeof val2 === 'number') {
                      result[`${col} 변화량`] = val2 - val1;
                 } else {
                      result[`${col} 변화량`] = null; // 둘 중 하나라도 숫자가 아니면 변화량 없음
                 }
            });

            // 티어 변화 계산
             const tier1 = d1 ? d1['티어'] : '삭제'; // 데이터 1에 없으면 '삭제'로 간주
             const tier2 = d2 ? d2['티어'] : '삭제'; // 데이터 2에 없으면 '삭제'로 간주

             // --- 추가: Ver1 및 Ver2의 실제 티어 값을 결과 객체에 저장 ---
             result['티어 (Ver1)'] = d1 ? d1['티어'] : null;
             result['티어 (Ver2)'] = d2 ? d2['티어'] : null;
             // ----------------------------------------------------


             if (!d1 && d2) {
                 result['티어 변화'] = `신규 → ${tier2}`;
             } else if (d1 && !d2) {
                 result['티어 변화'] = `${tier1} → 삭제`;
             } else if (d1 && d2) {
                 if (tier1 === tier2) {
                      result['티어 변화'] = tier1; // 티어 변화 없으면 현재 티어만 표시 (string)
                 } else {
                      result['티어 변화'] = `${tier1} → ${tier2}`; // 티어 변화 표시 (string)
                 }
             } else {
                 result['티어 변화'] = '-';
             }

            // 순위 변화 계산 (점수 기준)
            const rank1 = rankMap1[charName];
            const rank2 = rankMap2[charName];

            result['순위 (Ver1)'] = rank1;
            result['순위 (Ver2)'] = rank2;

            if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                 result['순위 변화값'] = rank2 - rank1; // 실제 변화량 (-10, +10 등)
            } else if (typeof rank1 === 'number') {
                 result['순위 변화값'] = '→ 삭제'; // string
            } else if (typeof rank2 === 'number') {
                 result['순위 변화값'] = '신규 → '; // string
            } else {
                 result['순위 변화값'] = '-'; // string
            }

            // 평균 순위 변화량 계산 (숫자)
            const avgRank1 = d1 ? d1['평균 순위'] : null;
            const avgRank2 = d2 ? d2['평균 순위'] : null;
            if (typeof avgRank1 === 'number' && typeof avgRank2 === 'number') {
                 result['평균 순위 변화량'] = avgRank2 - avgRank1;
            } else {
                 result['평균 순위 변화량'] = null;
            }


            comparisonResult.push(result);
        });

        return comparisonResult;
    }
}