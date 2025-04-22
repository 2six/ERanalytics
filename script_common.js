// script_common.js
/**
 * script_common.js
 * 공통 기능 모듈
 */

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
       if (xIsNull && yIsNull) return 0;
       if (xIsNull) return asc ? 1 : -1; // asc=true이면 null이 뒤로; asc=false이면 null이 앞으로
       if (yIsNull) return asc ? -1 : 1; // asc=true이면 null이 앞으로; asc=false이면 null이 뒤로

       // --- 데이터 타입별 비교 로직 ---

       // 1. 티어 변화 비교 (문자열) - sortKey가 '티어 변화'일 때 실행 (Delta 모드 '티어')
       // 사용자 요구사항 반영: '티어 변화' 델타 정렬 시 '순위 변화값'을 기준으로 하므로 이 로직은 이제 sortKey가 '티어 변화'일 때는 사용되지 않습니다.
       if (sortKey === '티어 변화') {
            const changeStatusOrder = ['신규 →', '→', '', '삭제', '-'];

            const getChangeStatusIndex = (str) => {
                 if (String(str).includes('신규 →')) return 0;
                 if (String(str) === '-') return 4;
                 if (String(str).includes('→ 삭제')) return 3;
                 if (String(str).includes('→')) {
                      const tiers = String(str).split('→').map(t => t.trim());
                      const tier1 = tiers[0];
                      const tier2 = tiers[1];
                      const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
                      const index1 = tierOrder.indexOf(tier1);
                      const index2 = tierOrder.indexOf(tier2);

                      if (index1 !== -1 && index2 !== -1) {
                          if (index2 < index1) return 1; // 개선
                          if (index2 > index1) return 2; // 악화
                      }
                      return 1.5; // 알 수 없는 변화
                 }
                 return 2.5; // 변화 없음 또는 티어만 표시된 경우
            };

            const statusX = getChangeStatusIndex(x);
            const statusY = getChangeStatusIndex(y);

            if (statusX !== statusY) {
                let comparison = statusX - statusY;
                // 요구사항 반영: 티어 변화는 오름차순 (나쁜 변화 위로), 내림차순 (좋은 변화 위로)
                return asc ? comparison : -comparison;
            }

            // 같은 상태 내에서는 문자열 자체로 비교 (예: 'S→A' vs 'S+→B')
             return asc
               ? String(x).localeCompare(String(y))
               : String(y).localeCompare(String(x));
       }


       // 2. 티어 값 비교 (S+ -> F 순서) - 이제 sortKey는 점수이므로 이 로직은 사용되지 않습니다.
       /*
        if (sortKey === '티어' || sortKey === '티어 (Ver1)' || sortKey === '티어 (Ver2)') {
           // ... (이전 로직) ...
        }
       */


       // 3. 숫자 비교 (value 또는 delta)
       // 순위 관련 값 (평균 순위 값, 순위 변화값)은 작을수록 좋음
       // 그 외 숫자 값 (점수, 픽률, RP 획득, 승률, TOP 3, 해당 변화량, 표본수 값/변화량)은 클수록 좋음

       // 정렬 키에 따라 값이 작을수록 좋은지 판단
       const isBetterWhenLower = (
           sortKey === '평균 순위' || sortKey === '평균 순위 (Ver1)' || sortKey === '평균 순위 (Ver2)' || // 평균 순위 값
           sortKey === '순위 변화값' || // 순위 변화값 (음수가 좋음)
           sortKey === '평균 순위 변화량' // 평균 순위 변화량 (음수가 좋음) - 사용자 요구사항 반영
       );


       const xNum = parseFloat(String(x).replace(/[+%▲▼]/g, ''));
       const yNum = parseFloat(String(y).replace(/[+%▲▼]/g, ''));


       if (!isNaN(xNum) && !isNaN(yNum)) {
            let comparison = xNum - yNum; // 기본 오름차순 숫자 비교

            if (isBetterWhenLower) { // 값이 작을수록 좋은 경우 (순위, 순위 변화값, 평균 순위 변화량)
                // asc=true 이면 작은 값(좋은)이 위로 -> 오름차순 그대로
                // asc=false 이면 큰 값(나쁜)이 위로 -> 내림차순 (결과 뒤집기)
                 return asc ? comparison : -comparison;
            }
            // 그 외 숫자 값 (점수 등) 또는 변화량 (점수 변화량 등) (클수록 좋음)
            // asc=true 이면 작은 값(나쁜)이 위로 -> 오름차순 (결과 뒤집기)
            // asc=false 이면 큰 값(좋은)이 위로 -> 내림차순 그대로
             return asc ? -comparison : comparison;
       }

       // 5. 기본 문자열 비교 (실험체 이름)
       if (sortKey === '실험체') {
            return asc
               ? String(x).localeCompare(String(y))
               : String(y).localeCompare(String(x));
       }

       return 0; // 예상치 못한 경우 (동일하다고 간주)
   });
}

// 9. 기간별 데이터 추출 함수
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
              return latest;
         }
    }
    latestDate.setUTCHours(0, 0, 0, 0);

    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

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
        console.warn(`No data found before cutoff date ${cutoff.toISOString()} for period '${period}'. Cannot calculate delta.`);
        return [];
    }

    const prev = history[pastKey];
    const currMap = Object.fromEntries(latest.map(d => [d.실험체, d]));
    const prevMap = Object.fromEntries(prev.map(d => [d.실험체, d]));
    const delta = [];

    const allCharacters = new Set([...Object.keys(currMap), ...Object.keys(prevMap)]);

    allCharacters.forEach(name => {
        const c = currMap[name];
        const p = prevMap[name];

        if (!c || !p) return;

        const diff = c['표본수'] - p['표본수'];

         if (diff > 0) {
            const rpSum_c = (c['RP 획득'] || 0) * c['표본수'];
            const winSum_c = (c['승률'] || 0) * c['표본수'];
            const top3Sum_c = (c['TOP 3'] || 0) * c['표본수'];
            const rankSum_c = (c['평균 순위'] || 0) * c['표본수'];

            const rpSum_p = (p['RP 획득'] || 0) * p['표본수'];
            const winSum_p = (p['승률'] || 0) * p['표본수'];
            const top3Sum_p = (p['TOP 3'] || 0) * p['표본수'];
            const rankSum_p = (p['평균 순위'] || 0) * p['표본수'];

            const rpDiff = rpSum_c - rpSum_p;
            const winDiff = winSum_c - winSum_p;
            const top3Diff = top3Sum_c - top3Sum_p;
            const rankDiff = rankSum_c - rankSum_p;


            delta.push({
                '실험체': name,
                '표본수': diff,
                'RP 획득': diff > 0 ? rpDiff / diff : 0,
                '승률':    diff > 0 ? winDiff / diff : 0,
                'TOP 3':   diff > 0 ? top3Diff / diff : 0,
                '평균 순위': diff > 0 ? rankDiff / diff : 0
            });
         }
    });

    return delta;
}

// 10. 색상 보간 헬퍼 함수
function interpolateColor(start, end, ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
    return `rgba(${rgb.join(',')}, ${0.3 + 0.5 * t})`;
}

// 티어 색상 (단일 모드)
const TIER_COLORS_SINGLE = {
    'S+': 'rgba(255,127,127, 0.3)',
    'S':  'rgba(255,191,127, 0.3)',
    'A':  'rgba(255,223,127, 0.3)',
    'B':  'rgba(255,255,127, 0.3)',
    'C':  'rgba(191,255,127, 0.3)',
    'D':  'rgba(127,255,127, 0.3)',
    'F':  'rgba(127,255,255, 0.3)',
};

// 11. 그라디언트 컬러 적용 (단일 데이터용)
function applyGradientColorsSingle(table) {
     if (!table) return;
     const rows = [...table.querySelectorAll('tbody tr')];
     const headers = [...table.querySelectorAll('thead th')];
     const goodCols = ['점수','픽률','RP 획득','승률','TOP 3'];
     const badCols = ['평균 순위'];

     headers.forEach((th, i) => {
         const col = th.dataset.col;
         if (![...goodCols, ...badCols].includes(col)) return;

         const values = rows.map(r => {
              const cell = r.children[i];
              const text = cell.textContent.replace('%','');
              const val = parseFloat(text);
              return isNaN(val) ? null : val;
         }).filter(v => v !== null);


         if (values.length === 0) { // 오류 수정: values가 비어있을 때 계산 건너뛰기
              rows.forEach(tr => tr.children[i].style.backgroundColor = '');
              return; // 이 컬럼에 대한 색상 적용 중단
         }

         // 오류 수정: avg, min, max를 여기서 다시 계산하도록 scope 수정
         const avg = values.reduce((a,b)=>a+b,0)/values.length;
         const min = Math.min(...values);
         const max = Math.max(...values);


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

             if (max === min) {
                 ratio = 0.5;
             } else if (!isBad) {
                 ratio = (v >= avg) ? 0.5 + (v - avg) / (max - avg) * 0.5 : 0.5 - (avg - v) / (avg - min) * 0.5;
             } else {
                 ratio = (v <= avg) ? 0.5 + (avg - v) / (avg - min) * 0.5 : 0.5 - (v - avg) / (max - avg) * 0.5;
             }
             ratio = Math.max(0, Math.min(1, ratio));

             let color;
             if (!isBad) {
                color = (ratio >= 0.5)
                    ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2)
                    : interpolateColor([164,194,244], [255,255,255], ratio*2);
             } else {
                 color = (ratio >= 0.5)
                     ? interpolateColor([255,255,255], [164,194,244], (ratio-0.5)*2)
                     : interpolateColor([230,124,115], [255,255,255], ratio*2);
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

// 12. 그라디언트 컬러 적용 (비교 데이터용)
// mode: 현재 정렬 모드 ('value1', 'value2', 'delta')
// sortedCol: 현재 정렬 기준 컬럼의 data-col 값 ('점수', '티어' 등)
function applyGradientColorsComparison(table, mode, sortedCol) {
    if (!table) return;
    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th')];

    headers.forEach((th, i) => {
        const col = th.dataset.col;

        // 사용자 요구사항 반영: 실험체 열은 배경색 적용 안 함 (이전 수정에서 이미 제거됨)
        if (col === '실험체') {
             rows.forEach(tr => {
                  const cell = tr.children[i];
                  cell.style.backgroundColor = ''; // 실험체 열의 모든 셀 배경색 초기화
             });
            // 실험체 열 (순위 변화) 색칠은 이 함수 밖으로 이동하거나, 이곳에서 배경색이 아닌 다른 스타일로 처리해야 합니다.
            // 현재는 배경색 제거만 유지
             return; // 실험체 열 처리는 여기서 끝
        }

        // 티어 변화 색칠 (티어 컬럼)
        if (col === '티어') {
             rows.forEach(tr => {
                  const cell = tr.children[i];
                  const tierChangeStatus = cell.dataset.tierchange;

                  cell.style.backgroundColor = '';

                  if (tierChangeStatus === 'new') {
                      cell.style.backgroundColor = 'rgba(127, 255, 255, 0.3)';
                  } else if (tierChangeStatus === 'removed') {
                      cell.style.backgroundColor = 'rgba(200, 200, 200, 0.3)';
                  } else if (tierChangeStatus === 'up') {
                      cell.style.backgroundColor = 'rgba(127, 255, 127, 0.3)';
                  } else if (tierChangeStatus === 'down') {
                      cell.style.backgroundColor = 'rgba(255, 127, 127, 0.3)';
                  } else if (cell.dataset.tier) { // 변화 없지만 단일 모드 티어 색상 사용
                        const tierValue = cell.dataset.tier;
                        const color = TIER_COLORS_SINGLE[tierValue];
                        if (color) cell.style.backgroundColor = color;
                  }
             });
            return; // 티어 컬럼은 여기서 색칠 완료
       }


       // 그 외 숫자 스탯 컬럼 (점수, 픽률 등, 표본수)에 대한 색상 강조
       const isNumericStatColumn = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'].includes(col);
       if (isNumericStatColumn) {
            // 색상 적용 기준이 되는 값을 컬럼의 모든 셀에서 모읍니다.
            let valuesToScale = [];

            rows.forEach(r => {
                 const cell = r.children[i];
                 let value;
                  if (mode === 'value1') {
                       // Ver1 값 기준
                      value = parseFloat(String(cell.textContent.split('→')[0] || '').trim().replace('%',''));
                  } else if (mode === 'value2') {
                       // Ver2 값 기준
                      value = parseFloat(String(cell.textContent.split('→')[1]?.split('▲')[0].split('▼')[0] || '').trim().replace('%',''));
                  } else if (mode === 'delta') {
                       // 변화량 기준 (data-delta 속성 사용)
                      value = parseFloat(cell.dataset.delta);
                  } else { // 단일 모드 (비교 페이지에서는 발생하지 않아야 함)
                       value = parseFloat(String(cell.textContent || '').replace('%',''));
                  }
                 if (!isNaN(value) && value !== null) { // null 체크 추가
                      valuesToScale.push(value);
                  }
            });

            if (valuesToScale.length === 0) {
                 rows.forEach(tr => tr.children[i].style.backgroundColor = '');
                 return; // 다음 컬럼으로 이동
            }

            const min = Math.min(...valuesToScale);
            const max = Math.max(...valuesToScale);


            // 값이 클수록 좋은지, 작을수록 좋은지 판단 (값 또는 변화량)
            let isBetterWhenHigher;
            let isBetterWhenLower;

            if (mode === 'delta') {
                 // 변화량 기준 (Delta)
                 isBetterWhenHigher = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '표본수'].includes(col); // 증가가 좋음
                 isBetterWhenLower = ['평균 순위'].includes(col); // 감소가 좋음
            } else {
                 // 값 기준 (Value1, Value2, 단일)
                 isBetterWhenHigher = ['점수','픽률','RP 획득','승률','TOP 3', '표본수'].includes(col); // 값이 클수록 좋음
                 isBetterWhenLower = ['평균 순위'].includes(col); // 값이 작을수록 좋음
            }


            rows.forEach((r) => {
                const cell = r.children[i];
                let valueForScale; // 색상 스케일 계산에 사용할 현재 셀의 값

                // 셀의 값 가져오기 (현재 정렬 모드에 따라)
                 if (mode === 'value1') {
                      valueForScale = parseFloat(String(cell.textContent.split('→')[0] || '').trim().replace('%',''));
                 } else if (mode === 'value2') {
                      valueForScale = parseFloat(String(cell.textContent.split('→')[1]?.split('▲')[0].split('▼')[0] || '').trim().replace('%',''));
                 } else if (mode === 'delta') {
                      valueForScale = parseFloat(cell.dataset.delta); // data-delta 속성 사용
                 } else { // 단일 모드
                      valueForScale = parseFloat(String(cell.textContent || '').replace('%',''));
                 }


                if (isNaN(valueForScale) || valueForScale === null) { // null 체크 추가
                    cell.style.backgroundColor = '';
                    return;
                }

                let ratio; // 0 (스케일 기준점) ~ 1 (스케일 끝점)
                let color;

                // 값이 min/max와 같을 때 ratio 계산 오류 방지 및 0 기준 스케일링
                if (max === min) {
                     ratio = 0; // 모든 값이 같으면 변화 없음 (중앙값)
                } else if (isBetterWhenHigher) { // 클수록 좋음 -> 하양(0) ~ 빨강(1)
                    // 0 또는 min/max 기준으로 스케일링
                    if (valueForScale >= 0) { // 0 이상 (좋음 방향 또는 0)
                         ratio = max === 0 ? 0 : valueForScale / max; // 0 ~ max 를 0 ~ 1 로
                    } else { // valueForScale < 0 (나쁨 방향)
                          ratio = min === 0 ? 0 : valueForScale / min; // min ~ 0 을 0 ~ 1 로 (음수 / 음수 = 양수)
                    }
                } else if (isBetterWhenLower) { // 작을수록 좋음 -> 하양(0) ~ 빨강(1) (평균 순위)
                   // 0 또는 min/max 기준으로 스케일링
                   if (valueForScale <= 0) { // 0 이하 (좋음 방향 또는 0)
                         ratio = min === 0 ? 0 : valueForScale / min; // min ~ 0 을 0 ~ 1 로
                   } else { // valueForScale > 0 (나쁨 방향)
                         ratio = max === 0 ? 0 : valueForScale / max; // 0 ~ max 를 0 ~ 1 로
                   }
                } else { // 이 경우는 발생하지 않아야 하지만, 혹시 몰라 추가
                     ratio = 0;
                }

                // 비율 범위를 0~1로 확실히 제한 (값의 절대적인 크기에 비례하도록)
                ratio = Math.max(0, Math.min(1, Math.abs(ratio)));


                // 색상 적용
                if (valueForScale === 0) { // 0값은 변화 없음 색 (회색)
                     color = 'rgba(240, 240, 240, 0.3)';
                } else if (isBetterWhenHigher) { // 클수록 좋음 -> 빨강(좋음) / 파랑(나쁨)
                     if (valueForScale > 0) { // 양수 (좋아짐)
                         color = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                     } else { // 음수 (나빠짐)
                         color = interpolateColor([255,255,255], [164,194,244], ratio); // 하양 -> 파랑
                     }
                } else if (isBetterWhenLower) { // 작을수록 좋음 -> 빨강(좋음) / 파랑(나쁨) (평균 순위)
                     if (valueForScale < 0) { // 음수 (좋아짐)
                          color = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                     } else { // 양수 (나빠짐)
                          color = interpolateColor([255,255,255], [164,194,244], ratio); // 하양 -> 파랑
                     }
                } else { // 표본수 등 (isBetterWhenHigher/Lower에 포함 안된 경우 - 회색 계열)
                    color = 'rgba(240, 240, 240, 0.3)'; // Default light gray
                }


                cell.style.backgroundColor = color;

             });
        }
    });
}