// script_common.js
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

const tierMap = { // window.tierMap 대신 const 사용
    "platinum_plus": "플래티넘+",
    "diamond_plus": "다이아몬드+",
    "meteorite_plus": "메테오라이트+",
    "mithril_plus": "미스릴+",
    "in1000": "in1000"
};
function populateTierDropdown(selectElem) {
    selectElem.innerHTML = '';
    Object.entries(tierMap).forEach(([val, label]) => { // tierMap 사용
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        selectElem.appendChild(opt);
    });
    selectElem.value = 'diamond_plus';
}

const periodOptions = [ // window.periodOptions 대신 const 사용
    { value: 'latest', label: '버전 전체' },
    { value: '3day', label: '최근 3일' },
    { value: '7day', label: '최근 7일' }
];
function populatePeriodDropdown(selectElem) {
    selectElem.innerHTML = '';
    periodOptions.forEach(optDef => { // periodOptions 사용
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
    // 표본수가 0인 데이터를 제외하고 계산
    const validData = data.filter(item => item['표본수'] > 0);
    const total = validData.reduce((sum, item) => sum + item['표본수'], 0);

    if (total === 0) return 0; // 유효 데이터가 없으면 평균 0

    let sumRP = 0, sumWin = 0, sumTop3 = 0;
    validData.forEach(i => {
        const w = i['표본수'] / total;
        sumRP += (i['RP 획득'] || 0) * w; // undefined/null 안전 장치
        sumWin += (i['승률'] || 0) * w;
        sumTop3 += (i['TOP 3'] || 0) * w;
    });
    return getRPScore(sumRP) + sumWin * 9 + sumTop3 * 3; // getRPScore 사용
}

// 6. 표준 편차 계산
function calculateStandardDeviation(data, avgScore) {
     // 표본수가 0인 데이터를 제외하고 계산
    const validData = data.filter(item => item['표본수'] > 0);
    const total = validData.reduce((sum, item) => sum + item['표본수'], 0);

    if (total === 0) return 0; // 유효 데이터가 없으면 표준편차 0

    const variance = validData.reduce((sum, item) => {
        const s = getRPScore(item['RP 획득'] || 0) + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3; // getRPScore 사용, 안전 장치
        return sum + Math.pow(s - avgScore, 2) * (item['표본수'] / total);
    }, 0);
    return Math.sqrt(variance);
}

// 7. 점수 및 티어, 픽률 계산
function calculateTiers(data, avgScore, stddev, config) {
    const total = data.reduce((sum, item) => sum + item['표본수'], 0);
    const avgPickRate = total === 0 ? 0 : data.reduce((sum, i) => sum + i['표본수'], 0) / total / (data.length || 1); // data.length가 0일 경우 대비
    const k = 1.5;

    return data.map(item => {
        // 표본수 0인 경우 기본값 또는 제외 처리
        if (item['표본수'] === 0) {
             return {
                 ...item,
                 '점수': 0.00,
                 '티어': 'F', // 표본수 없으면 F 티어 등으로 처리
                 '픽률': 0.00
             };
        }

        const pickRate = total === 0 ? 0 : item['표본수'] / total;
        const r = avgPickRate ? pickRate / avgPickRate : 1; // avgPickRate가 0이면 1로 처리
        const originWeight =
            r <= 1/3
                ? 0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))
                : 0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k));
        const meanWeight = 1 - originWeight;
        let factor = avgPickRate === 0 ? 1 : (0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k))); // avgPickRate 0이면 factor 1
        if (r > 5) {
            factor += 0.05 * (1 - Math.min((r - 5) / 5, 1));
        }
        const baseScore = getRPScore(item['RP 획득'] || 0) + (item['승률'] || 0) * 9 + (item['TOP 3'] || 0) * 3; // getRPScore 사용, 안전 장치
        let score;

        // avgPickRate가 0이면 비교 로직 회피
        if (avgPickRate !== 0 && item['표본수'] < total * avgPickRate) {
            score =
                baseScore * (originWeight + meanWeight * Math.min(1, pickRate / avgPickRate)) +
                avgScore * meanWeight * (1 - Math.min(1, pickRate / avgPickRate));
            score *= factor;
        } else {
            score = baseScore * factor;
        }

        const tierLabel = calculateTier(score, avgScore, stddev, config); // calculateTier 사용

        return {
            ...item,
            '점수': parseFloat(score.toFixed(2)),
            '티어': tierLabel,
            '픽률': parseFloat((pickRate * 100).toFixed(2))
        };
    });
};

// 8. 데이터 정렬
function sortData(data, column, asc, mode = 'value') { // mode 인자 추가, 기본값 'value'
    if (!data || data.length === 0) return [];

   // 비교 모드에서 사용할 정렬 기준 키를 결정합니다.
   let sortKey;
   if (mode === 'value') {
       // 값 기준으로 정렬할 때는 '컬럼 이름 (Ver1)' 형태의 키를 사용합니다.
       // 단, 실험체, 티어 변화, 순위 변화는 그대로 사용합니다.
       if (['실험체', '티어 변화', '순위 변화'].includes(column)) {
           sortKey = column;
       } else {
           sortKey = `${column} (Ver1)`; // 기본은 Ver1 값 기준
            // 만약 Ver2 기준으로 정렬하고 싶다면 여기서 로직 변경 필요 (현재는 Ver1 고정)
       }
   } else { // mode === 'delta'
       // 변화량 기준으로 정렬할 때는 '컬럼 이름 변화량' 형태의 키를 사용합니다.
        // 순위 변화는 '순위 변화' 키를 그대로 사용합니다.
        if (column === '평균 순위') { // '평균 순위' 컬럼 클릭 시 순위 변화로 정렬
            sortKey = '순위 변화';
        } else if (column === '티어') { // '티어' 컬럼 클릭 시 티어 변화로 정렬
            sortKey = '티어 변화'; // 티어 변화는 문자열 정렬 (숫자 비교 아님)
        }
        else {
           sortKey = `${column} 변화량`; // 예: '점수 변화량'
        }
   }


   return [...data].sort((a, b) => {
       // 정렬 기준 키에 해당하는 값을 가져옵니다.
       const x = a[sortKey];
       const y = b[sortKey];

       // null/undefined 값을 처리 (항상 맨 끝으로 보내거나 맨 앞으로 보내거나)
       const xIsNull = (x === undefined || x === null);
       const yIsNull = (y === undefined || y === null);

       if (xIsNull && yIsNull) return 0;
       if (xIsNull) return asc ? 1 : -1; // asc=true이면 null이 뒤로, asc=false이면 null이 앞으로
       if (yIsNull) return asc ? -1 : 1; // asc=true이면 null이 앞으로, asc=false이면 null이 뒤로

       // 티어는 별도 비교 로직 (정해진 순서) - mode, sortKey와 관계없이 티어 값 자체로 비교
        if (sortKey === '티어 (Ver1)' || sortKey === '티어 (Ver2)') { // Ver1/Ver2 티어 컬럼 정렬 시
            const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
            const indexX = tierOrder.indexOf(String(x));
            const indexY = tierOrder.indexOf(String(y));

            const xNotInOrder = indexX === -1;
            const yNotInOrder = indexY === -1;

            if (xNotInOrder && yNotInOrder) return 0;
            if (xNotInOrder) return asc ? 1 : -1;
            if (yNotInOrder) return asc ? -1 : 1;

            return asc ? indexX - indexY : indexY - indexX;
        }

        // 티어 변화는 문자열 비교 - sortKey가 '티어 변화'일 때
        if (sortKey === '티어 변화') {
            // '신규', '삭제', 'S+→S' 등의 문자열 비교
            // 특정 순서를 원하면 별도 매핑 필요 (예: 신규 > 개선 > 변화 없음 > 악화 > 삭제)
            // 일단 기본 문자열 비교
            return asc
               ? String(x).localeCompare(String(y))
               : String(y).localeCompare(String(x));
        }

       // 숫자 또는 숫자로 변환 가능한 값 비교 (Value 및 Delta)
       // parseFloat 사용 시 기호(+,-,%,▲,▼) 제거
       const xNum = parseFloat(String(x).replace(/[+%▲▼]/g, ''));
       const yNum = parseFloat(String(y).replace(/[+%▲▼]/g, ''));

       if (!isNaN(xNum) && !isNaN(yNum)) {
            // '순위 변화' 컬럼일 때 (값이 작을수록 좋음) - sortKey가 '순위 변화'
            if (sortKey === '순위 변화') {
                return asc ? xNum - yNum : yNum - xNum; // asc=true -> -5, +2 순서 -> -5가 위로
            }
            // '평균 순위 (Ver1)' 또는 '평균 순위 (Ver2)' 컬럼일 때 (값이 작을수록 좋음)
             if (sortKey === '평균 순위 (Ver1)' || sortKey === '평균 순위 (Ver2)') {
                 return asc ? xNum - yNum : yNum - xNum; // asc=true -> 3.8, 4.1 순서 -> 3.8이 위로
             }


            // 그 외 숫자 컬럼 (점수, 픽률, RP, 승률, TOP3, 변화량)은 클수록 좋음
            return asc ? xNum - yNum : yNum - xNum; // asc=true -> 10, 15 순서 -> 10이 위로
       }


       // 기본 문자열 비교 (실험체 이름 등) - sortKey가 '실험체'
       return asc
           ? String(x).localeCompare(String(y))
           : String(y).localeCompare(String(x));
   });
}


// 9. 기간별 데이터 추출 함수
function extractPeriodEntries(history, period) {
    const keys = Object.keys(history).sort();
    if (keys.length === 0) return []; // 데이터가 없으면 빈 배열 반환

    const latestKey = keys[keys.length - 1];
    const latest = history[latestKey];

    if (period === 'latest') return latest;

    const days = period === '3day' ? 3 : 7;
    // 키 형식이 'YYYY-MM-DD_HH:mm' 일 때 파싱
    let latestDate = new Date(latestKey.replace('_', 'T')); // ISO 8601 형식으로 변환 시도 (YYYY-MM-DDTHH:mm)
    if (isNaN(latestDate.getTime())) { // 파싱 실패 시 다른 형식으로 재시도
         const parts = latestKey.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (parts) {
              latestDate = new Date(Date.UTC(parts[1], parts[2]-1, parts[3], parts[4], parts[5])); // UTC로 파싱
         } else {
              console.error("Unsupported date format:", latestKey);
              return latest; // 날짜 파싱 실패 시 전체 데이터 반환 (fallback)
         }
    }
    // 시간을 00:00:00.000으로 설정하여 날짜만으로 비교
    latestDate.setUTCHours(0, 0, 0, 0);


    const cutoff = new Date(latestDate.getTime()); // 복사
    cutoff.setUTCDate(cutoff.getUTCDate() - days);


    // 기준일 이전 데이터 중 가장 최신 데이터를 찾음
    const pastKey = keys.slice().reverse().find(k => {
        let kDate;
        const kParts = k.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2}):(\d{2})/);
         if (kParts) {
              kDate = new Date(Date.UTC(kParts[1], kParts[2]-1, kParts[3], kParts[4], kParts[5]));
         } else {
              kDate = new Date(k.replace('_', 'T'));
         }
        if (isNaN(kDate.getTime())) return false; // 유효하지 않은 날짜는 건너뛰기

        kDate.setUTCHours(0,0,0,0); // 비교를 위해 시간을 0으로 설정
        return kDate <= cutoff;
    });

    if (!pastKey) {
        // 기준일 이전 데이터가 없으면 해당 기간의 데이터 추출 불가능
        // 변화량을 계산할 수 없으므로 빈 배열 반환합니다.
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

        // 둘 중 하나라도 데이터가 없는 캐릭터는 이 기간 데이터로 포함하지 않음
        // delta 계산의 목적은 '변화량'이므로, 비교 대상 두 시점에 모두 데이터가 있어야 함.
        if (!c || !p) return; // 이 경우 해당 기간 변화량 계산 대상에서 제외

        const diff = c['표본수'] - p['표본수'];

        // 원본 코드 로직: 표본수가 증가한 경우에만 delta 계산
         if (diff > 0) {
              // 가중 평균 계산
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
                '표본수': diff, // 해당 기간의 표본수 변화량
                'RP 획득': diff > 0 ? rpDiff / diff : 0, // diff>0이면 기간 평균, 아니면 0
                '승률':    diff > 0 ? winDiff / diff : 0,
                'TOP 3':   diff > 0 ? top3Diff / diff : 0,
                '평균 순위': diff > 0 ? rankDiff / diff : 0
            });
         }
    });

    return delta; // 계산된 기간별 데이터 반환
};

// 색상 보간 헬퍼 함수
function interpolateColor(start, end, ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
    return `rgba(${rgb.join(',')}, ${0.3 + 0.5 * t})`; // 불투명도 조절
}

// 티어 색상 (단일 모드)
const TIER_COLORS_SINGLE = { // const 사용
    'S+': 'rgba(255,127,127, 0.3)',
    'S':  'rgba(255,191,127, 0.3)',
    'A':  'rgba(255,223,127, 0.3)',
    'B':  'rgba(255,255,127, 0.3)',
    'C':  'rgba(191,255,127, 0.3)',
    'D':  'rgba(127,255,127, 0.3)',
    'F':  'rgba(127,255,255, 0.3)',
};

// 그라디언트 컬러 적용 (단일 데이터용)
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
              const text = r.children[i].textContent.replace('%','');
              const val = parseFloat(text);
              return isNaN(val) ? null : val;
         }).filter(v => v !== null);

         if (values.length === 0) return;

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

             if (max === min) { // 모든 값이 같을 때
                 ratio = 0.5; // 중앙값
             } else if (!isBad) { // 높을수록 좋음
                 ratio = (v >= avg) ? 0.5 + (v - avg) / (max - avg) * 0.5 : 0.5 - (avg - v) / (avg - min) * 0.5;
             } else { // 낮을수록 좋음 (색상 반전)
                 ratio = (v <= avg) ? 0.5 + (avg - v) / (avg - min) * 0.5 : 0.5 - (v - avg) / (max - avg) * 0.5;
             }
             // 비율 범위를 0~1로 확실히 제한
             ratio = Math.max(0, Math.min(1, ratio));

             // 색상: 파랑(0)~하양(0.5)~빨강(1) (낮을수록 파랑, 높을수록 빨강)
             let color;
             if (!isBad) { // 높을수록 빨강
                color = (ratio >= 0.5)
                    ? interpolateColor([255,255,255], [230,124,115], (ratio-0.5)*2) // 하양 -> 빨강
                    : interpolateColor([164,194,244], [255,255,255], ratio*2); // 파랑 -> 하양
             } else { // 낮을수록 빨강
                  // 평균 순위는 값이 작을수록 좋으므로, 색상 스케일을 뒤집거나 기준을 반대로 적용
                 color = (ratio >= 0.5)
                    ? interpolateColor([255,255,255], [164,194,244], (ratio-0.5)*2) // 하양 -> 파랑 (좋아짐)
                    : interpolateColor([230,124,115], [255,255,255], ratio*2); // 빨강 -> 하양 (나빠짐)

             }
             cell.style.backgroundColor = color;
         });
     });

     // 티어 컬럼 색상 적용
     const tierColIndex = headers.findIndex(th => th.dataset.col === '티어');
     if (tierColIndex >= 0) {
         rows.forEach(tr => {
         const tierValue = tr.children[tierColIndex].textContent.trim();
         const color = TIER_COLORS_SINGLE[tierValue]; // TIER_COLORS_SINGLE 사용
         if (color) {
             tr.children[tierColIndex].style.backgroundColor = color;
         } else {
             tr.children[tierColIndex].style.backgroundColor = '';
         }
         });
     }
}

// 그라디언트 컬러 적용 (비교 데이터용 - 차이값에 적용)
function applyGradientColorsComparison(table) {
    if (!table) return;
    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th')];

    // 색상 강조를 적용할 컬럼 및 기준 값을 결정합니다.
    // 여기서는 각 스탯 컬럼 (점수, 픽률 등)에 대해 변화량 (data-delta 속성)을 기준으로 색칠합니다.

    headers.forEach((th, i) => {
        const col = th.dataset.col; // '점수', '픽률' 등 원래 컬럼 이름

        // 실험체, 티어, 표본수 컬럼은 숫자 변화량 색칠 대상에서 제외
        if (['실험체', '티어', '표본수'].includes(col)) {
            // 티어 변화 및 순위 변화는 별도로 처리 (셀 자체에 data-delta, data-rankdelta 있음)
            rows.forEach(tr => {
                 const cell = tr.children[i];
                 cell.style.backgroundColor = ''; // 기본 배경색 제거

                 // 티어 변화 색칠 (티어 컬럼)
                 if (col === '티어') {
                     const tierChange = cell.textContent.trim(); // 표시된 텍스트 사용
                      if (tierChange.includes('→')) {
                          const tiers = tierChange.split('→').map(t => t.trim());
                          const tier1 = tiers[0];
                          const tier2 = tiers[1];
                          const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F', '삭제'];
                          const index1 = tierOrder.indexOf(tier1);
                          const index2 = tierOrder.indexOf(tier2);

                          if (tierChange.includes('신규 →')) {
                              cell.style.backgroundColor = 'rgba(127, 255, 255, 0.3)'; // 하늘색 (신규)
                          } else if (index1 >= 0 && index2 >= 0) {
                              if (index2 < index1) { // 티어 개선
                                  cell.style.backgroundColor = 'rgba(127, 255, 127, 0.3)'; // 연두색 (좋아짐)
                              } else if (index2 > index1) { // 티어 악화
                                  cell.style.backgroundColor = 'rgba(255, 127, 127, 0.3)'; // 빨간색 (나빠짐)
                              }
                          }
                      } else if (tierChange === '-') {
                           cell.style.backgroundColor = '';
                      } else { // 티어 변화 없는 경우 (S+ 등) - 단일 모드 티어 색상 사용?
                           const color = TIER_COLORS_SINGLE[tierChange];
                            if (color) cell.style.backgroundColor = color;
                      }
                 }
                 // 순위 변화 색칠 (실험체 컬럼) - 실험체 컬럼에 순위 변화 정보를 통합했으므로
                 if (col === '실험체') {
                     // 실험체 이름 옆에 괄호로 표시된 순위 변화 정보를 파싱하여 색칠
                      const text = cell.textContent;
                      const match = text.match(/\(([^\)]+)\)/); // 괄호 안 내용 찾기
                      if (match) {
                          const rankInfo = match[1]; // 예: 10위 ▼2, 신규, 삭제
                           if (rankInfo === '신규') {
                                cell.style.backgroundColor = 'rgba(127, 255, 255, 0.3)'; // 하늘색 (신규)
                           } else if (rankInfo === '삭제') {
                                cell.style.backgroundColor = 'rgba(200, 200, 200, 0.3)'; // 회색 (삭제)
                           } else if (rankInfo.includes('▼')) { // 순위 숫자 감소 (개선)
                                cell.style.backgroundColor = 'rgba(127, 255, 127, 0.3)'; // 연두색 (좋아짐)
                           } else if (rankInfo.includes('▲+')) { // 순위 숫자 증가 (악화)
                                cell.style.backgroundColor = 'rgba(255, 127, 127, 0.3)'; // 빨간색 (나빠짐)
                           }
                          // 변화 없는 순위 (예: 10위)는 색칠 안 함
                      }
                 }
            });
            return; // 숫자 변화량 컬럼이 아니므로 다음 컬럼으로 이동
        }


        // 숫자 스탯 컬럼 (점수, 픽률 등)에 대한 색상 강조 (변화량 기준)
        // 해당 컬럼의 모든 셀에 저장된 data-delta 속성 값을 모읍니다.
        const values = rows.map(r => {
             const cell = r.children[i];
             const deltaText = cell.dataset.delta; // data-delta 속성 값
              const val = parseFloat(deltaText);
             return isNaN(val) ? null : val;
        }).filter(v => v !== null); // 유효한 숫자 변화량만 필터링

        if (values.length === 0) {
             // 유효한 변화량 값이 없으면 해당 컬럼의 모든 셀 배경색 제거
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);


        rows.forEach((r) => {
            const cell = r.children[i];
            const deltaText = cell.dataset.delta; // data-delta 속성 값

             // data-delta가 숫자인 경우에만 색칠
            const v = parseFloat(deltaText);

            if (isNaN(v) || v === null) {
                cell.style.backgroundColor = ''; // 숫자가 아니면 배경색 제거
                return;
            }

            let ratio;
            // 어떤 스탯의 변화량인지 확인하여 isGood 결정
            const isGood = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3'].includes(col); // 평균 순위는 작을수록 좋음

            if (v === 0) {
                // 변화가 0인 경우 연한 배경색
                cell.style.backgroundColor = 'rgba(240, 240, 240, 0.3)'; // 연한 회색
            } else if (isGood) { // 클수록 좋은 차이 (점수, 픽률 등)
                // 0을 기준으로 얼마나 멀리 떨어져 있는지 비율 계산
                if (v > 0) { // 양수 변화 (좋아짐) -> 빨간색 계열
                     ratio = max === 0 ? 0 : v / max; // 0 ~ max 를 0 ~ 1 로
                     cell.style.backgroundColor = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                } else { // 음수 변화 (나빠짐) -> 파란색 계열
                     ratio = min === 0 ? 0 : v / min; // min ~ 0 을 1 ~ 0 으로 (음수니까 v/min은 양수)
                     cell.style.backgroundColor = interpolateColor([255,255,255], [164,194,244], 1 - ratio); // 하양 -> 파랑
                }
            } else { // 작을수록 좋은 차이 (평균 순위)
                // 0을 기준으로 얼마나 멀리 떨어져 있는지 비율 계산 (색상 반전)
                if (v < 0) { // 음수 변화 (좋아짐) -> 빨간색 계열
                      ratio = min === 0 ? 0 : v / min; // min ~ 0 을 0 ~ 1 로
                     cell.style.backgroundColor = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                } else { // 양수 변화 (나빠짐) -> 파란색 계열
                      ratio = max === 0 ? 0 : v / max; // 0 ~ max 를 1 ~ 0 으로
                     cell.style.backgroundColor = interpolateColor([255,255,255], [164,194,244], 1 - ratio); // 하양 -> 파랑
                }
            }
        });
    });

    // Note: 티어 변화 및 순위 변화 색칠은 위 루프에서 이미 처리되었습니다.
};