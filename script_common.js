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

       // 1. 티어 변화 비교 (문자열) - 이제 sortKey가 '티어 변화'일 때는 이 로직은 사용되지 않습니다.
       /*
       if (sortKey === '티어 변화') {
           // ... (이전 로직) ...
       }
       */

       // 2. 티어 값 비교 (S+ -> F 순서) - 이제 sortKey는 점수이므로 이 로직은 사용되지 않습니다.
       /*
        if (sortKey === '티어' || sortKey === '티어 (Ver1)' || sortKey === '티어 (Ver2)') {
           // ... (이전 로직) ...
        }
       */


       // 3. 숫자 비교 (value 또는 delta)
       // 순위 관련 값 (평균 순위 값, 순위 변화값, 평균 순위 변화량)은 작을수록 좋음
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
       /*
       // 4. 티어 변화 비교 (문자열) - sortKey가 '티어 변화'일 때 실행 (Delta 모드 '티어')
       // 사용자 요구사항 반영: '티어 변화' 델타 정렬 시 '순위 변화값'을 기준으로 하므로 이 로직은 이제 사용되지 않습니다.
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
        */

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
    'S+': 'rgba(255,127,127, 1)',
    'S':  'rgba(255,191,127, 1)',
    'A':  'rgba(255,223,127, 1)',
    'B':  'rgba(255,255,127, 1)',
    'C':  'rgba(191,255,127, 1)',
    'D':  'rgba(127,255,127, 1)',
    'F':  'rgba(127,255,255, 1)',
};

// 11. 단일 데이터용 그라디언트 색상 적용
// gradientEnabled: 색상 강조가 활성화되었는지 여부
function applyGradientColorsSingle(table, gradientEnabled) { // gradientEnabled 인자 추가
    // 색상 강조 비활성화 시 모든 배경색 초기화 후 종료 (요청 사항 반영)
    if (!table || !gradientEnabled) { // gradientEnabled 체크 추가
        if(table) {
            table.querySelectorAll('td').forEach(td => td.style.backgroundColor = '');
        }
        return;
    }

    // --- 색상 강조가 활성화된 경우에만 실행되는 기존 로직 (원본 유지) ---

    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th')];
    const goodCols = ['점수','픽률','RP 획득','승률','TOP 3'];
    const badCols = ['평균 순위'];

    // 픽률 정보를 가져올 컬럼 인덱스를 찾습니다. (가중치로 사용)
    const pickRateColIndex = headers.findIndex(th => th.dataset.col === '픽률'); // 픽률 컬럼 인덱스


    headers.forEach((th, i) => {
        const col = th.dataset.col;
        // 티어 컬럼은 단일 모드에서 별도 처리 (원본 유지)
        if (col === '티어') return; // 티어 컬럼은 이 루프에서 건너뛰고 아래 별도 처리

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
             // rows 배열과 lastData 배열의 순서가 일치한다고 가정하고 lastData에서 픽률 값을 가져옵니다.
             // lastData는 script_statistics.js에 정의되어 있으며, 렌더링 시 인자로 전달되지 않습니다.
             // 따라서 여기서는 rows에서 직접 픽률 셀의 텍스트를 읽어와 가중평균을 계산해야 합니다.
             // 이 로직은 사용자가 제공한 원본 코드의 applyGradientColorsSingle 함수 로직을 따릅니다.
             const valuesWithPickRate = rows.map(r => {
                  const cell = r.children[i]; // 현재 스탯 값 셀
                  const text = cell.textContent.replace('%','');
                  const val = parseFloat(text);

                  let pickRate = 0;
                  if (pickRateColIndex !== -1) {
                       const pickRateCell = r.children[pickRateColIndex]; // 픽률 셀
                       pickRate = parseFloat(pickRateCell.textContent.replace('%','')) / 100; // 0~1 사이 값으로 변환
                  } else {
                       console.error("픽률 컬럼이 없습니다. 가중평균 계산 불가.");
                       return null;
                  }

                  return isNaN(val) ? null : { value: val, pickRate: pickRate };
             }).filter(item => item !== null && item.pickRate !== 0); // 유효한 값 + 픽률 0이 아닌 항목만 사용


             let totalPickRate = valuesWithPickRate.reduce((sum, item) => sum + item.pickRate, 0);
             let weightedSum = valuesWithPickRate.reduce((sum, item) => sum + item.value * item.pickRate, 0);

             avg = totalPickRate === 0 ? (valuesOnly.length > 0 ? valuesOnly.reduce((s,v)=>s+v,0) / valuesOnly.length : 0) : weightedSum / totalPickRate; // 픽률 합 0이면 단순 평균 사용
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

            // 평균값(avg)을 기준으로 스케일링 (원본 코드 로직 유지)
            if (max === min) {
                ratio = 0.5; // 범위가 없으면 중간값
            } else if (!isBad) { // 클수록 좋음 (점수, 픽률 등)
                // Map value from [min, max] range to [0, 1] ratio, using avg as center (0.5)
                // 0으로 나누는 경우 방지 (max - avg 또는 avg - min 이 0일 때)
                if (v >= avg) {
                     const rangeSize = max - avg;
                     ratio = 0.5 + (rangeSize === 0 ? 0 : (v - avg) / rangeSize * 0.5); // Map [avg, max] to [0.5, 1]
                } else { // v < avg
                     const rangeSize = avg - min;
                     ratio = 0.5 - (rangeSize === 0 ? 0 : (avg - v) / rangeSize * 0.5); // Map [min, avg] to [0, 0.5]
                }
            } else { // 작을수록 좋음 (평균 순위)
                // Map value from [min, max] range to [1, 0] ratio (inverted), using avg as center (0.5)
                // 여기서 ratio는 이미 작을수록 좋은 값(min=best, max=worst)이 1=best, 0=worst로 매핑된 상태
                // 0으로 나누는 경우 방지 (avg - min 또는 max - avg 이 0일 때)
                if (v <= avg) { // v가 avg보다 작거나 같으면 (좋은 쪽)
                     const rangeSize = avg - min;
                     ratio = 0.5 + (rangeSize === 0 ? 0 : (avg - v) / rangeSize * 0.5); // [min, avg] -> [1, 0.5] 매핑 결과를 0.5~1로
                } else { // v가 avg보다 크면 (나쁜 쪽)
                     const rangeSize = max - avg;
                     ratio = 0.5 - (rangeSize === 0 ? 0 : (v - avg) / rangeSize * 0.5); // [avg, max] -> [0.5, 0] 매핑 결과를 0~0.5로
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
                // 평균 순위는 값이 작을수록 좋으므로 ratio 매핑이 반대
                // 즉, min (좋음, ratio 1) -> Red
                // max (나쁨, ratio 0) -> Blue
                // ratio 1이 좋은 값, ratio 0이 나쁜 값이 되도록 이미 위에서 ratio 계산
                 color = (ratio >= 0.5) // ratio 0.5 ~ 1 (평균보다 좋거나 같음)
                      ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red
                      : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White
            }
            cell.style.backgroundColor = color;
        });
    });

    // 단일 모드 티어 컬럼 색상 적용 (티어 등급 기준) (원본 유지)
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

// 12. 비교 데이터용 그라디언트 색상 적용 (gradientEnabled 인자 추가 및 티어 색상 로직 추가)
// data: 정렬된 비교 데이터 배열 (행 객체들의 배열)
// mode: 현재 정렬 모드 ('value1', 'value2', 'delta')
// sortedCol: 현재 정렬 기준 컬럼의 data-col 값 ('점수', '티어', 등)
// gradientEnabled: 색상 강조가 활성화되었는지 여부 (요청 사항 반영)
function applyGradientColorsComparison(table, data, mode, sortedCol, gradientEnabled) { // gradientEnabled 인자 추가
    // 색상 강조 비활성화 시 모든 배경색 초기화 후 종료 (요청 사항 반영)
    if (!table || !data || data.length === 0 || !gradientEnabled) { // gradientEnabled 체크 추가
        if(table) {
            table.querySelectorAll('td').forEach(td => td.style.backgroundColor = '');
        }
        return;
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const headers = Array.from(table.querySelectorAll('thead th'));

    // 숫자 스탯 컬럼에 대한 처리
    const numericStatCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'];

     // 숫자 스탯 컬럼의 min/max/avg 미리 계산 (원본 코드 로직 유지)
     const statRanges = {};
     numericStatCols.forEach(col => {
         let valueKey;
         if (mode === 'value1') valueKey = col + ' (Ver1)';
         else if (mode === 'value2') valueKey = col + ' (Ver2)';
         else valueKey = (col === '평균 순위') ? '평균 순위 변화량' : col + ' 변화량'; // 평균 순위 델타 키 수정

         // 원본 코드와 동일하게 숫자 값만 필터링 (null/undefined/NaN 제거)
         const allVals = data.map(item => item[valueKey]).filter(v => typeof v === 'number' && !isNaN(v));

         if (allVals.length > 0) {
             const min = Math.min(...allVals);
             const max = Math.max(...allVals);

             let avg;
              // 가중 평균 계산 (Value1, Value2 모드일 때만, 픽률 가중) - 원본 로직 유지
              if (mode === 'value1' || mode === 'value2') {
                  const tuples = data.map(d => {
                      const v = d[valueKey]; // 현재 스탯 값
                      // 해당 버전의 픽률 사용 (data 구조에서 픽률 (VerX) 키를 가져옴)
                      const pickRateKey = mode === 'value1' ? '픽률 (Ver1)' : '픽률 (Ver2)';
                      const pr = (d[pickRateKey] || 0) / 100; // 픽률을 0~1로 변환
                      return (typeof v === 'number' && pr > 0) ? { v, pr } : null;
                  }).filter(x => x);
                   const totalPr = tuples.reduce((s, x) => s + x.pr, 0);
                   const wsum = tuples.reduce((s, x) => s + x.v * x.pr, 0);
                   avg = totalPr > 0 ? wsum / totalPr : (allVals.reduce((s, v) => s + v, 0) / allVals.length); // 픽률 합 0이면 단순 평균
              } else { // Delta 모드는 단순 평균
                  avg = allVals.reduce((s, v) => s + v, 0) / allVals.length;
              }

             statRanges[col] = { min, max, avg, valueKey };
         }
     });


    // --- 티어 컬럼 색상 적용 (비교 모드) --- (요청 사항 반영)
     const tierColIndex = headers.findIndex(th => th.dataset.col === '티어');
     if (tierColIndex >= 0) {
         // Delta 모드 티어 색상 그라데이션을 위한 '순위 변화값' 범위 계산
         let minRankDelta, maxRankDelta, avgRankDelta;
         if (mode === 'delta') {
              // 순위 변화값 (숫자)만 필터링 (null/undefined/NaN 제거)
              // data 대신 셀의 data-rankdelta-numeric 속성 사용 (renderComparisonTable에서 저장한 값)
              const rankDeltas = rows.map(r => parseFloat(r.children[tierColIndex].dataset.rankdeltaNumeric))
                                  .filter(v => typeof v === 'number' && !isNaN(v));
              if (rankDeltas.length > 0) {
                  minRankDelta = Math.min(...rankDeltas); // 가장 작은 변화값 (가장 순위 많이 오름 = 좋음)
                  maxRankDelta = Math.max(...rankDeltas); // 가장 큰 변화값 (가장 순위 많이 내림 = 나쁨)
                  avgRankDelta = rankDeltas.reduce((s,v) => s + v, 0) / rankDeltas.length;
              }
         }

         rows.forEach((r, rowIndex) => {
             const cell = r.children[tierColIndex];
             // const itemData = data[rowIndex]; // data 배열 대신 data-* 속성 사용

             let color = '';

             if (mode === 'value1') {
                  // data-* 속성에서 Ver1 티어 값 가져오기
                  const tierValue1 = cell.dataset.tierSingle; // 예: 'S+'
                  // 티어 변화 상태가 '신규'일 경우 (data-tierchange="new")
                  const tierChangeStatus = cell.dataset.tierchange; // 예: 'new', 'removed', 'up', 'down', 'same', 'unknown', 'none'
                  if (tierChangeStatus === 'new') {
                      // TIER_COLORS_SINGLE에 '신규' 색상이 없으므로 직접 색상 코드를 사용.
                      // 사용자 요청에 따라 객체에 추가하는 방식을 따르지 않고 직접 정의.
                      color = 'rgba(144, 238, 144, 0.5)'; // 신규 색상 직접 정의
                  } else {
                      // TIER_COLORS_SINGLE에 기존 티어 등급 색상이 있으므로 이를 사용.
                      // data-tier-single 속성에 'S+' 등 티어 등급이 저장되어 있다고 가정.
                      color = TIER_COLORS_SINGLE[tierValue1] || ''; // TIER_COLORS_SINGLE에 정의된 색상 사용, 없으면 빈 값
                  }

             } else if (mode === 'value2') {
                   // data-* 속성에서 Ver2 티어 값 가져오기
                   // renderComparisonTable에서 Ver2 티어 값을 data 속성에 저장해야 합니다.
                   // 현재 renderComparisonTable에서는 단일 티어 속성(data-tier-single)을 티어 변화 없을 때만 저장하고 있습니다.
                   // Value2 모드일 때 Ver2 티어 색상을 정확히 적용하려면, renderComparisonTable에서 Ver2 티어 값을 다른 data 속성에 저장하거나
                   // data 배열의 itemData['티어 (Ver2)'] 값을 사용해야 합니다.
                   // 사용자께서 원본 객체 수정을 금지하셨으므로, renderComparisonTable 수정이 필요합니다.
                   // 현재 renderComparisonTable 수정 범위 밖이므로, data 배열에서 값을 가져오되, 사용자께 renderComparisonTable 수정 필요성을 보고해야 합니다.
                   // 임시로 data 배열에서 Ver2 티어 값을 사용합니다. (data 배열은 정렬되어 있으므로 rowIndex로 접근 가능)
                   const itemData = data[rowIndex]; // data 배열 사용
                   const tierValue2 = itemData['티어 (Ver2)']; // data 배열에서 Ver2 티어 값 가져오기
                   // 티어 변화 상태가 '삭제'일 경우 (data-tierchange="removed")
                   const tierChangeStatus = cell.dataset.tierchange;
                   if (tierChangeStatus === 'removed') {
                       // TIER_COLORS_SINGLE에 '삭제' 색상이 없으므로 직접 색상 코드를 사용.
                        color = 'rgba(220, 220, 220, 0.5)'; // 삭제 색상 직접 정의
                   } else {
                       // TIER_COLORS_SINGLE에 기존 티어 등급 색상이 있으므로 이를 사용.
                        color = TIER_COLORS_SINGLE[tierValue2] || ''; // TIER_COLORS_SINGLE에 정의된 색상 사용, 없으면 빈 값
                   }

             } else if (mode === 'delta') {
                  // const rankDelta = itemData['순위 변화값']; // data 배열 대신 data-* 속성 사용
                  const tierChangeStatus = cell.dataset.tierchange; // string 상태 ('new', 'removed', 'up', 'down', 'same', 'unknown', 'none')
                  const rankDeltaNumeric = parseFloat(cell.dataset.rankdeltaNumeric); // 숫자 변화값 (data 속성에서 가져옴)

                  // 숫자 변화량 & 범위가 있을 때만 그라데이션
                  if (typeof rankDeltaNumeric === 'number' && !isNaN(rankDeltaNumeric) && minRankDelta !== maxRankDelta) {
                      // 순위 변화값은 작을수록(음수) 좋음. minRankDelta (음수) -> Red (좋음), maxRankDelta (양수) -> Blue (나쁨)
                      // ratio 매핑: [minRankDelta, avgRankDelta, maxRankDelta] -> [1, 0.5, 0]
                       let ratio;
                       if (rankDeltaNumeric <= avgRankDelta) { // avg보다 좋거나 같음 (min ~ avg)
                            // (avgRankDelta - rankDeltaNumeric)는 양수, 범위도 양수 -> 0.5 ~ 1
                            // 0으로 나누는 경우 방지 (avg - min 이 0일 때)
                            const rangeSize = avgRankDelta - minRankDelta;
                            ratio = 0.5 + (rangeSize === 0 ? 0 : (avgRankDelta - rankDeltaNumeric) / rangeSize * 0.5);
                       } else { // avg보다 나쁨 (avg ~ max)
                            // (rankDeltaNumeric - avgRankDelta)는 양수, 범위도 양수 -> 0 ~ 0.5
                             // 0으로 나누는 경우 방지 (max - avg 이 0일 때)
                             const rangeSize = maxRankDelta - avgRankDelta;
                             ratio = 0.5 - (rangeSize === 0 ? 0 : (rankDeltaNumeric - avgRankDelta) / rangeSize * 0.5);
                       }
                       ratio = Math.max(0, Math.min(1, ratio)); // 0~1 클램프

                       // Blue (Worst/나쁨) -> White (0.5) -> Red (Best/좋음)
                       // rankDelta는 작을수록 좋으므로 ratio 1이 좋음, ratio 0이 나쁨
                       color = (ratio >= 0.5) // ratio 0.5 ~ 1 (평균보다 좋거나 같음)
                            ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red
                            : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White

                   } else { // 숫자 변화량이 아니거나 범위가 없는 경우 (신규, 삭제, 변화없음 등)
                        // 티어 변화 상태 문자열에 따라 색상 적용 (data-tierchange 사용)
                        // TIER_COLORS_SINGLE에 해당 상태 색상이 없으므로 직접 정의.
                        if (tierChangeStatus === 'new') color = 'rgba(144, 238, 144, 0.5)'; // 신규
                        else if (tierChangeStatus === 'removed') color = 'rgba(220, 220, 220, 0.5)'; // 삭제
                        else if (tierChangeStatus === 'up') color = 'rgba(144, 238, 144, 0.5)'; // 상승
                        else if (tierChangeStatus === 'down') color = 'rgba(255, 127, 127, 0.5)'; // 하락
                        else if (tierChangeStatus === 'same') color = 'rgba(255, 255, 127, 0.5)'; // 동일
                        else color = 'rgba(240, 240, 240, 0.5)'; // 알 수 없음, 없음 등
                   }
             } // End of mode === 'delta' for Tier column

             cell.style.backgroundColor = color;
         });
     } // End of Tier column handling


    // --- 숫자 스탯 컬럼 색상 적용 (비교 모드) --- (원본 코드 로직 유지 + continue -> return 수정)
    headers.forEach((th, i) => {
        const col = th.dataset.col;
        // 티어 컬럼은 위에서 처리했으므로 건너뛰기
        if (col === '티어') return;
        if (!numericStatCols.includes(col)) return; // 숫자 스탯 컬럼만 처리

        const range = statRanges[col];
        // 유효한 값 범위가 없거나 범위가 0이면 색상 초기화
        // forEach에서는 continue 대신 return 사용 (이전 수정 반영)
        if (!range || range.max === range.min) {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return; // 현재 컬럼 처리 중단
        }

        const { min, max, avg, valueKey } = range;
        const isBad = (col === '평균 순위'); // 평균 순위는 작을수록 좋음


        rows.forEach((r, rowIndex) => { // rowIndex 추가
            const cell = r.children[i];
             // 셀 텍스트 대신 data-* 속성 사용 (renderComparisonTable에서 저장한 값)
             // renderComparisonTable에서 numeric stat delta 값을 data-delta-numeric에 저장하고 있습니다.
             // Value1/Value2 모드일 때는 delta 값이 아닌 value1/value2 값을 사용해야 합니다.
             // data 배열에서 직접 value1/value2 값을 가져오도록 수정합니다.
             const itemData = data[rowIndex]; // data 배열 사용
             const v = itemData[valueKey]; // 해당 컬럼의 값 (value1/value2/delta)


            // 값이 없거나 숫자가 아니면 색상 초기화
            if (typeof v !== 'number' || isNaN(v)) { // 숫자가 아니거나 NaN인 경우
                 cell.style.backgroundColor = '';
                 return; // 현재 로우/컬럼 셀 처리 중단
            }

            let ratio;
            // 평균값(avg)을 기준으로 스케일링 (원본 코드 로직 유지)
             if ((!isBad && v >= avg) || (isBad && v <= avg)) { // 평균보다 좋거나 같음
                 // Map [avg, max] (higher better) or [min, avg] (lower better) to [0.5, 1]
                  const rangeSize = !isBad ? (max - avg) : (avg - min);
                  const valueDiff = !isBad ? (v - avg) : (avg - v);
                  // 0으로 나누는 경우 방지 (rangeSize가 0일 때)
                  ratio = 0.5 + (rangeSize === 0 ? 0 : valueDiff / rangeSize * 0.5); // 0.5 ~ 1
            } else { // 평균보다 나쁨
                 // Map [min, avg] (higher better) or [avg, max] (lower better) to [0, 0.5]
                 const rangeSize = !isBad ? (avg - min) : (max - avg);
                 const valueDiff = !isBad ? (avg - v) : (v - avg);
                 // 0으로 나누는 경우 방지 (rangeSize가 0일 때)
                 ratio = 0.5 - (rangeSize === 0 ? 0 : valueDiff / rangeSize * 0.5); // 0 ~ 0.5
            }
            ratio = Math.max(0, Math.min(1, ratio)); // Clamp between 0 and 1


            // Blue (0 - Worst/나쁨) to White (0.5 - Avg) to Red (1 - Best/좋음)
            let color;
            // 원본 코드와 동일하게 interpolateColor 함수 사용 (투명도 포함)
            color = (ratio >= 0.5)
                   ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // White -> Red
                   : interpolateColor([164,194,244], [255,255,255], ratio*2); // Blue -> White

            cell.style.backgroundColor = color;
        });
    });
}

// 두 색상 간 보간 함수 (기존 그대로)
function interpolateColor(start, end, t) {
    const tt = Math.max(0, Math.min(1, t));
    const rgb = start.map((s,i)=>Math.round(s + (end[i]-s)*tt));
    return `rgb(${rgb.join(',')})`;
}