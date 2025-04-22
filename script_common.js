// script_common.js
/**
 * script_common.js
 * 공통 기능 모듈
 */

// ... (parseINI 함수부터 calculateTiers 함수까지의 코드는 이전과 동일) ...

// 8. 데이터 정렬 (mode 인자 추가 및 로직 수정)
// mode: 'value' (단일), 'value1' (비교 Ver1), 'value2' (비교 Ver2), 'delta' (비교 변화량)
function sortData(data, column, asc, mode = 'value') {
    if (!data || data.length === 0) return [];

   let sortKey;
   // 비교 모드에서 사용할 정렬 기준 키를 결정합니다.
   // column: 헤더의 data-col 값 ('점수', '티어' 등)
   // mode: 'value' (단일), 'value1', 'value2', 'delta'
   if (mode === 'value') { // 단일 모드
        sortKey = column; // 단일 모드에서는 컬럼 이름 자체가 키
   } else if (mode === 'value1') { // 비교 모드, Ver1 값 기준
        if (column === '실험체') sortKey = '실험체';
        else if (column === '티어') sortKey = '티어 (Ver1)';
        else if (column === '표본수') sortKey = '표본수 (Ver1)';
        else if (column === '평균 순위') sortKey = '평균 순위 (Ver1)';
        else { // 점수, 픽률 등 숫자 스탯
             sortKey = `${column} (Ver1)`; // Ver1 값 기준
        }
   } else if (mode === 'value2') { // 비교 모드, Ver2 값 기준
        if (column === '실험체') sortKey = '실험체';
        else if (column === '티어') sortKey = '티어 (Ver2)';
        else if (column === '표본수') sortKey = '표본수 (Ver2)';
        else if (column === '평균 순위') sortKey = '평균 순위 (Ver2)';
        else {
            sortKey = `${column} (Ver2)`; // Ver2 값 기준
        }
   }
    else { // mode === 'delta' (비교 모드, 변화량 기준)
        if (column === '실험체') sortKey = '순위 변화값';
        else if (column === '티어') sortKey = '티어 변화';
        else if (column === '표본수') sortKey = '표본수 변화량';
        else if (column === '평균 순위') sortKey = '순위 변화값';
        else {
            sortKey = `${column} 변화량`;
        }
   }


    // console.log(`sortData: column=${column}, asc=${asc}, mode=${mode}, sortKey=${sortKey}`); // 디버그

   return [...data].sort((a, b) => {
       const x = a[sortKey];
       const y = b[sortKey];

       const xIsNull = (x === undefined || x === null);
       const yIsNull = (y === undefined || y === null);

       // null/undefined 값을 처리 (항상 맨 끝으로 보내거나 맨 앞으로 보내거나)
       if (xIsNull && yIsNull) return 0;
       if (xIsNull) return asc ? 1 : -1;
       if (yIsNull) return asc ? -1 : 1;

       // --- 데이터 타입별 비교 로직 ---

       // 1. 티어 변화 비교 (문자열)
       if (sortKey === '티어 변화') {
            // '신규 → S+', 'S → A', 'A', 'B → C', '→ 삭제', '-' 등 문자열 비교
            // 간단한 순서 적용: 신규 > 개선 > 변화 없음 > 악화 > 삭제 > '-' 순서
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

       // 2. 티어 값 비교 (S+ -> F 순서)
        if (sortKey === '티어' || sortKey === '티어 (Ver1)' || sortKey === '티어 (Ver2)') {
            const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
            const indexX = tierOrder.indexOf(String(x));
            const indexY = tierOrder.indexOf(String(y));

            const xNotInOrder = indexX === -1;
            const yNotInOrder = indexY === -1;

            if (xNotInOrder && yNotInOrder) return 0;
            if (xNotInOrder) return asc ? 1 : -1;
            if (yNotInOrder) return asc ? -1 : 1;

            let comparison = indexX - indexY; // S+가 0, F가 6
            // 요구사항 반영: 티어는 오름차순 (F 위로), 내림차순 (S+ 위로)
            return asc ? comparison : -comparison;
        }


       // 3. 숫자 비교 (value 또는 delta)
       // 순위 관련 값 (평균 순위 값, 순위 변화값)은 작을수록 좋음
       // 그 외 숫자 값 (점수, 픽률, RP 획득, 승률, TOP 3, 해당 변화량)은 클수록 좋음

       const isRankRelatedNumeric = (sortKey === '평균 순위' || sortKey === '평균 순위 (Ver1)' || sortKey === '평균 순위 (Ver2)'); // 순위 값 자체
       const isRankDeltaValue = (sortKey === '순위 변화값'); // 순위 변화량 값
       const isGoodStatValue = (sortKey === '점수' || sortKey === '점수 (Ver1)' || sortKey === '점수 (Ver2)' ||
                                sortKey === '픽률' || sortKey === '픽률 (Ver1)' || sortKey === '픽률 (Ver2)' ||
                                sortKey === 'RP 획득' || sortKey === 'RP 획득 (Ver1)' || sortKey === 'RP 획득 (Ver2)' ||
                                sortKey === '승률' || sortKey === '승률 (Ver1)' || sortKey === '승률 (Ver2)' ||
                                sortKey === 'TOP 3' || sortKey === 'TOP 3 (Ver1)' || sortKey === 'TOP 3 (Ver2)' ||
                                sortKey === '표본수' || sortKey === '표본수 (Ver1)' || sortKey === '표본수 (Ver2)'); // 단일 및 Ver1/Ver2 값 중 클수록 좋은 것
       const isBadStatValue = (sortKey === '평균 순위' || sortKey === '평균 순위 (Ver1)' || sortKey === '평균 순위 (Ver2)'); // 단일 및 Ver1/Ver2 값 중 작을수록 좋은 것


       const isGoodDelta = (sortKey === '점수 변화량' || sortKey === '픽률 변화량' ||
                            sortKey === 'RP 획득 변화량' || sortKey === '승률 변화량' ||
                            sortKey === 'TOP 3 변화량' || sortKey === '표본수 변화량'); // 변화량 기준: 증가가 좋음
       const isBadDelta = (sortKey === '순위 변화값'); // 변화량 기준: 감소가 좋음 (순위)


       const xNum = parseFloat(String(x).replace(/[+%▲▼]/g, ''));
       const yNum = parseFloat(String(y).replace(/[+%▲▼]/g, ''));


       if (!isNaN(xNum) && !isNaN(yNum)) {
            let comparison = xNum - yNum; // 기본 오름차순 비교

            if (isRankRelatedNumeric || isBadDelta) { // 순위 관련 값 또는 작을수록 좋은 변화량
                // 작을수록 좋음.
                // asc=true 이면 작은 값(좋은)이 위로 -> 오름차순 그대로 (comparison)
                // asc=false 이면 큰 값(나쁜)이 위로 -> 내림차순 (비교 결과 뒤집기)
                 return asc ? comparison : -comparison;
            }
            // 그 외 숫자 값 (점수 등) 또는 클수록 좋은 변화량
            // asc=true 이면 작은 값(나쁜)이 위로 -> 오름차순 (비교 결과 뒤집기)
            // asc=false 이면 큰 값(좋은)이 위로 -> 내림차순 그대로
             return asc ? -comparison : comparison;
       }

       // 4. 기본 문자열 비교 (실험체 이름)
       if (sortKey === '실험체') {
            return asc
               ? String(x).localeCompare(String(y))
               : String(y).localeCompare(String(x));
       }

       return 0; // 예상치 못한 경우 (동일하다고 간주)
   });
}


// 9. 기간별 데이터 추출 함수 (이전 코드와 동일)
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


        if (values.length === 0) {
             rows.forEach(tr => tr.children[i].style.backgroundColor = '');
             return;
        }

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

// 12. 그라디언트 컬러 적용 (비교 데이터용 - 변화량에 적용)
// mode: 현재 정렬 모드 ('value1', 'value2', 'delta') - 색상 기준에는 이 인자를 사용하지 않고 data 속성 값 자체를 사용
// sortedCol: 현재 정렬 기준 컬럼의 data-col 값 ('점수', '티어' 등) - 색상 기준에는 이 인자를 사용하지 않고 data 속성 값 자체를 사용
function applyGradientColorsComparison(table, mode, sortedCol) {
    if (!table) return;
    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th')];

    headers.forEach((th, i) => {
        const col = th.dataset.col;

        // 실험체 열은 배경색 적용 안 함
        if (col === '실험체') {
             rows.forEach(tr => {
                  const cell = tr.children[i];
                  cell.style.backgroundColor = ''; // 실험체 열의 모든 셀 배경색 초기화
             });
             // 실험체 열 (순위 변화) 색칠은 이 루프 내부에서 data-rankdelta 기준으로 처리
            rows.forEach(tr => {
                const cell = tr.children[i];
                const rankDeltaStatus = cell.dataset.rankdelta; // 순위 변화 값 (-10, +5 등) 또는 new/removed/none

                if (rankDeltaStatus === 'new') {
                     cell.style.backgroundColor = 'rgba(127, 255, 255, 0.3)'; // 하늘색 (신규)
                } else if (rankDeltaStatus === 'removed') {
                     cell.style.backgroundColor = 'rgba(200, 200, 200, 0.3)'; // 회색 (삭제)
                } else { // 숫자 순위 변화
                    const v = parseFloat(rankDeltaStatus);
                    if (!isNaN(v) && v !== 0) {
                         if (v < 0) { // 순위 숫자 감소 (개선)
                             cell.style.backgroundColor = 'rgba(127, 255, 127, 0.3)'; // 연두색 (좋아짐)
                         } else { // 순위 숫자 증가 (악화)
                             cell.style.backgroundColor = 'rgba(255, 127, 127, 0.3)'; // 빨간색 (나빠짐)
                         }
                    } else { // 0 또는 none
                         cell.style.backgroundColor = ''; // 변화 없음 또는 정보 없음
                    }
                }
            });

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


        // 그 외 숫자 스탯 컬럼 (점수, 픽률 등, 표본수)에 대한 색상 강조 (변화량 기준)
        const isNumericStatColumn = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'].includes(col);
        if (isNumericStatColumn) {

            // 해당 컬럼의 모든 셀에서 숫자 변화량 값을 모읍니다.
            const values = rows.map(r => {
                 const cell = r.children[i];
                 const deltaText = cell.dataset.delta; // data-delta 속성 값
                 const val = parseFloat(deltaText); // 숫자로 파싱
                 return isNaN(val) ? null : val;
            }).filter(v => v !== null); // 유효한 숫자 변화량만 필터링


            if (values.length === 0) {
                 rows.forEach(tr => tr.children[i].style.backgroundColor = '');
                 return; // 다음 컬럼으로 이동
            }

            const min = Math.min(...values);
            const max = Math.max(...values);


            const isGoodStat = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3'].includes(col);
            const isBadStat = ['평균 순위'].includes(col);


            rows.forEach((r) => {
                const cell = r.children[i];
                const deltaText = cell.dataset.delta;
                const v = parseFloat(deltaText); // 변화량 값 (숫자)

                // 숫자 변화량에 대한 색칠
                if (!isNaN(v) && deltaText !== 'none') {
                     let ratio; // 0 (변화 없음) ~ 1 (최대 변화)
                     let color;

                    if (v === 0) {
                         color = 'rgba(240, 240, 240, 0.3)'; // 변화가 0인 경우 연한 회색
                    } else if (isGoodStat || col === '표본수') { // 클수록 좋은 변화 (점수, 픽률 등) 또는 표본수 증가 -> 하양(0) ~ 빨강(1) 또는 회색
                         // 양수 변화 (좋아짐) -> 0~max 범위를 0~1로
                         // 음수 변화 (나빠짐) -> min~0 범위를 0~1로
                         if (v > 0) { // 양수 변화
                              ratio = max === 0 ? 0 : v / max; // 0 ~ max 를 0 ~ 1 로
                              ratio = Math.max(0, Math.min(1, ratio)); // 비율 제한
                              // 표본수는 회색, 그 외는 빨강
                              color = col === '표본수' ? interpolateColor([255,255,255], [180,180,180], ratio) : interpolateColor([255,255,255], [230,124,115], ratio);
                         } else { // 음수 변화
                              ratio = min === 0 ? 0 : v / min; // min ~ 0 을 0 ~ 1 로 (음수 / 음수 = 양수)
                              ratio = Math.max(0, Math.min(1, ratio));
                              color = interpolateColor([255,255,255], [164,194,244], ratio); // 하양 -> 파랑
                         }
                     } else if (isBadStat) { // 작을수록 좋은 변화 (평균 순위 값 자체의 변화량) -> 하양(0) ~ 빨강(1)
                        // 음수 변화가 좋아짐, 양수 변화가 나빠짐.
                        if (v < 0) {
                             ratio = min === 0 ? 0 : v / min; // min~0 을 0~1 로
                             ratio = Math.max(0, Math.min(1, ratio));
                             color = interpolateColor([255,255,255], [230,124,115], ratio);
                        } else {
                             ratio = max === 0 ? 0 : v / max; // 0~max 를 0~1 로
                             ratio = Math.max(0, Math.min(1, ratio));
                             color = interpolateColor([255,255,255], [164,194,244], ratio);
                        }
                     }

                     cell.style.backgroundColor = color;

                } else { // data-delta가 숫자가 아닌 경우 (new, removed, none)
                     // 배경색 제거 (이미 위에 실험체 열과 티어 열은 처리됨)
                    if (col !== '실험체' && col !== '티어') cell.style.backgroundColor = '';
                }
            });
        }
    });
    // 실험체 열 (순위 변화) 색칠은 headers.forEach 내에서 col === '실험체' 조건으로 처리하도록 수정했습니다.
}