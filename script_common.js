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

   let sortKey;
   // 비교 모드에서 사용할 정렬 기준 키를 결정합니다.
   if (mode === 'value') {
       // Value 모드 정렬 시, 해당 컬럼의 Ver1 값 기준 (비교 모드) 또는 단일 모드 값 기준
        if (column === '실험체') sortKey = '실험체';
        else if (column === '티어') sortKey = '티어 (Ver1)'; // 티어 자체는 Ver1 기준
        else if (column === '표본수') sortKey = '표본수 (Ver1)'; // 표본수는 Ver1 기준
        else if (column === '평균 순위') sortKey = '평균 순위 (Ver1)'; // 평균 순위 Ver1 기준
        else { // 점수, 픽률, RP 획득, 승률, TOP 3
             sortKey = `${column} (Ver1)`; // Ver1 값 기준
        }

   } else { // mode === 'delta'
       // Delta 모드 정렬 시, 변화량 기준입니다.
        if (column === '실험체') sortKey = '순위 변화'; // 실험체 컬럼 delta 정렬 시 순위 변화 기준
        else if (column === '티어') sortKey = '티어 변화'; // 티어 컬럼 delta 정렬 시 티어 변화 기준 (문자열)
        else if (column === '평본수') sortKey = '표본수 변화량'; // 표본수 변화량 (있다면) - 현재는 없지만, 있다면
        else if (column === '평균 순위') sortKey = '순위 변화'; // 평균 순위 컬럼 delta 정렬 시 순위 변화 기준
        else { // 점수, 픽률, RP 획득, 승률, TOP 3
            sortKey = `${column} 변화량`; // 예: '점수 변화량'
        }
   }


   return [...data].sort((a, b) => {
       const x = a[sortKey];
       const y = b[sortKey];

       const xIsNull = (x === undefined || x === null);
       const yIsNull = (y === undefined || y === null);

       if (xIsNull && yIsNull) return 0;
       if (xIsNull) return asc ? 1 : -1;
       if (yIsNull) return asc ? -1 : 1;

       // --- 데이터 타입별 비교 로직 ---

       // 1. 숫자 비교 (value 또는 delta)
       // 순위 관련 값 (평균 순위 값, 순위 변화)은 작을수록 좋음
       // 그 외 숫자 값 (점수, 픽률, RP 획득, 승률, TOP 3, 해당 변화량)은 클수록 좋음

       const isRankRelatedValue = (sortKey === '평균 순위 (Ver1)' || sortKey === '평균 순위 (Ver2)' || sortKey === '순위 변화');
       const isTierRelated = (sortKey === '티어 (Ver1)' || sortKey === '티어 (Ver2)');
       const isTierChange = (sortKey === '티어 변화');
       const isNumericDelta = sortKey.endsWith(' 변화량') || sortKey === '순위 변화'; // 순위 변화도 숫자 변화량으로 간주


       const xNum = parseFloat(String(x).replace(/[+%▲▼]/g, ''));
       const yNum = parseFloat(String(y).replace(/[+%▲▼]/g, ''));


       if (!isNaN(xNum) && !isNaN(yNum)) {
            let comparison = xNum - yNum; // 기본 오름차순 비교 (x < y 이면 음수, x > y 이면 양수)

            if (isRankRelatedValue) {
                // 순위 관련 값은 작을수록 좋음. 오름차순 정렬 시 작은 값이 위로
                // asc=true 이면 작은 값(좋은 순위)이 위로 -> 오름차순 그대로 (comparison)
                // asc=false 이면 큰 값(나쁜 순위)이 위로 -> 내림차순 (비교 결과 뒤집기)
                 return asc ? comparison : -comparison;
            }
            // 그 외 숫자 값 (점수, 픽률 등 및 해당 변화량)은 클수록 좋음. 내림차순 정렬 시 큰 값이 위로
            // asc=true 이면 작은 값(나쁜 점수)이 위로 -> 오름차순 (비교 결과 뒤집기)
            // asc=false 이면 큰 값(좋은 점수)이 위로 -> 내림차순 그대로
             return asc ? -comparison : comparison;
       }

       // 2. 티어 비교 (value 모드에서 티어 컬럼 정렬 시)
        if (isTierRelated) {
            const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
            const indexX = tierOrder.indexOf(String(x));
            const indexY = tierOrder.indexOf(String(y));

            const xNotInOrder = indexX === -1;
            const yNotInOrder = indexY === -1;

            if (xNotInOrder && yNotInOrder) return 0;
            if (xNotInOrder) return asc ? 1 : -1;
            if (yNotInOrder) return asc ? -1 : 1;

            // 티어는 좋은 티어일수록 위로 (S+ -> F)
            // asc=true 이면 나쁜 티어(F)가 위로 -> 오름차순
            // asc=false 이면 좋은 티어(S+)가 위로 -> 내림차순
             let comparison = indexX - indexY; // S+가 0, F가 6
             return asc ? comparison : -comparison;
        }

       // 3. 티어 변화 비교 (delta 모드에서 티어 컬럼 정렬 시)
       if (isTierChange) {
            // '신규 → S+', 'S → A', 'A', 'B → C', '→ 삭제', '-' 등 문자열 비교
            // 간단한 순서 적용: 신규 > 개선 > 변화 없음 > 악화 > 삭제 > '-' 순서
            const changeStatusOrder = ['신규 →', '→', '', '삭제', '-']; // 접두사/상태 기준 순서

            const getChangeStatusIndex = (str) => {
                 if (str.includes('신규 →')) return 0;
                 if (str === '-') return 4; // '-'는 마지막
                 if (str.includes('→ 삭제')) return 3; // 삭제는 악화 다음
                 if (str.includes('→')) { // 그 외 변화 (개선 또는 악화)
                      // 티어 변화 방향으로 추가 정렬
                      const tiers = str.split('→').map(t => t.trim());
                      const tier1 = tiers[0];
                      const tier2 = tiers[1];
                      const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F']; // 좋은 티어부터 나쁜 티어
                      const index1 = tierOrder.indexOf(tier1);
                      const index2 = tierOrder.indexOf(tier2);

                      if (index1 !== -1 && index2 !== -1) {
                          if (index2 < index1) return 1; // 개선
                          if (index2 > index1) return 2; // 악화
                      }
                      return 1.5; // 알 수 없는 변화는 개선/악화 중간
                 }
                 return 2.5; // 변화 없음 (티어만 표시된 경우)
            };

            const statusX = getChangeStatusIndex(String(x));
            const statusY = getChangeStatusIndex(String(y));

            if (statusX !== statusY) {
                // 신규/개선/변화없음/악화/삭제/- 순서대로 정렬
                // asc=true 이면 나쁜 변화가 위로 -> 오름차순
                // asc=false 이면 좋은 변화가 위로 -> 내림차순
                 let comparison = statusX - statusY;
                return asc ? comparison : -comparison;
            }

            // 같은 상태 내에서는 문자열 자체로 비교 (예: 'S→A' vs 'S+→B')
             return asc
               ? String(x).localeCompare(String(y))
               : String(y).localeCompare(String(x));
       }


       // 4. 기본 문자열 비교 (실험체 이름)
       if (sortKey === '실험체') {
            return asc
               ? String(x).localeCompare(String(y))
               : String(y).localeCompare(String(x));
       }

       // 예상치 못한 경우 (동일하다고 간주)
       return 0;
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

// 12. 그라디언트 컬러 적용 (비교 데이터용 - 변화량에 적용) - 재수정
function applyGradientColorsComparison(table) {
    if (!table) return;
    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th')];

    headers.forEach((th, i) => {
        const col = th.dataset.col;
        const isGoodStat = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3'].includes(col);
        const isBadStat = ['평균 순위'].includes(col);


        // 숫자 스탯 컬럼 (점수, 픽률 등)에 대한 색상 강조 (변화량 기준)
        if (isGoodStat || isBadStat || col === '표본수') {

            const values = rows.map(r => {
                 const cell = r.children[i];
                 const deltaText = cell.dataset.delta;
                 const val = parseFloat(deltaText);
                 return isNaN(val) ? null : val;
            }).filter(v => v !== null);


            if (values.length === 0) {
                 rows.forEach(tr => tr.children[i].style.backgroundColor = '');
                 return;
            }

            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach((r) => {
                const cell = r.children[i];
                const deltaText = cell.dataset.delta;
                const v = parseFloat(deltaText);

                if (isNaN(v) || v === null || deltaText === 'none') {
                    cell.style.backgroundColor = '';
                    return;
                }

                let ratio; // 0 (변화 없음) ~ 1 (최대 변화)
                let color;

                if (v === 0) {
                     color = 'rgba(240, 240, 240, 0.3)';
                } else if (isGoodStat) { // 클수록 좋은 변화 (점수, 픽률 등) -> 하양(0) ~ 빨강(1)
                     if (v > 0) { // 양수 변화
                          ratio = max === 0 ? 0 : v / max; // 0 ~ max 를 0 ~ 1 로
                          ratio = Math.max(0, Math.min(1, ratio)); // 비율 제한
                          color = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                     } else { // 음수 변화
                          ratio = min === 0 ? 0 : v / min; // min ~ 0 을 0 ~ 1 로 (음수 / 음수 = 양수)
                          ratio = Math.max(0, Math.min(1, ratio));
                          color = interpolateColor([255,255,255], [164,194,244], ratio); // 하양 -> 파랑
                     }
                } else if (isBadStat) { // 작을수록 좋은 변화 (평균 순위) -> 하양(0) ~ 빨강(1)
                    if (v < 0) { // 음수 변화
                         ratio = min === 0 ? 0 : v / min; // min ~ 0 을 0 ~ 1 로
                         ratio = Math.max(0, Math.min(1, ratio));
                         color = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강 (좋아짐)
                    } else { // 양수 변화
                         ratio = max === 0 ? 0 : v / max; // 0 ~ max 를 0 ~ 1 로
                         ratio = Math.max(0, Math.min(1, ratio));
                         color = interpolateColor([255,255,255], [164,194,244], ratio); // 하양 -> 파랑 (나빠짐)
                    }
                }

                cell.style.backgroundColor = color;
            });
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
        }

        // 순위 변화 색칠 (실험체 컬럼)
        if (col === '실험체') {
            rows.forEach(tr => {
                const cell = tr.children[i];
                const rankDeltaStatus = cell.dataset.rankdelta;

                cell.style.backgroundColor = '';

                if (rankDeltaStatus === 'new') {
                     cell.style.backgroundColor = 'rgba(127, 255, 255, 0.3)';
                } else if (rankDeltaStatus === 'removed') {
                     cell.style.backgroundColor = 'rgba(200, 200, 200, 0.3)';
                } else { // 숫자 순위 변화
                    const v = parseFloat(rankDeltaStatus);
                    if (!isNaN(v) && v !== 0) {
                         if (v < 0) { // 순위 숫자 감소 (개선)
                             cell.style.backgroundColor = 'rgba(127, 255, 127, 0.3)';
                         } else { // 순위 숫자 증가 (악화)
                             cell.style.backgroundColor = 'rgba(255, 127, 127, 0.3)';
                         }
                    }
                }
            });
        }

    });
}