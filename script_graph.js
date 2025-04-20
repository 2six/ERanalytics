document.addEventListener('DOMContentLoaded', function () {
    let myChart;
    let chartData = [];

    const canvas = document.getElementById('graph-canvas');
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const excludeLowCheckbox = document.getElementById('exclude-low-pickrate');
    const excludeHighCheckbox = document.getElementById('exclude-high-pickrate');

    function setupGraphPopup() {
        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        const closeButton = document.querySelector('.image-popup-close');
        const popupGraphButton = document.getElementById('popup-graph-button');

        if (popupGraphButton && popup && popupImage && closeButton) {
            popupGraphButton.addEventListener('click', () => {
                html2canvas(canvas).then(canvas => {
                    popup.style.display = 'block';
                    popupImage.src = canvas.toDataURL();
                });
            });

            closeButton.addEventListener('click', () => {
                popup.style.display = 'none';
            });

            window.addEventListener('click', (event) => {
                if (event.target === popup) {
                    popup.style.display = 'none';
                }
            });
        }
    }

    function setupGraphTabs() {
        document.querySelectorAll('.graph-tab').forEach(button => {
            button.addEventListener('click', () => {
                const type = button.dataset.type;
                if (type === 'pick-rp') {
                    createGraph({ xKey: "픽률", yKey: "RP 획득", radiusKey: "승률", title: "픽률 / RP 획득" });
                } else if (type === 'pick-win') {
                    createGraph({ xKey: "픽률", yKey: "승률", radiusKey: "RP 획득", title: "픽률 / 승률" });
                } else if (type === 'rp-win') {
                    createGraph({ xKey: "RP 획득", yKey: "승률", radiusKey: "픽률", title: "RP 획득 / 승률" });
                }
            });
        });
    }

    const labelPlugin = {
        id: 'labelPlugin',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            const dataPoints = meta.data;
            const chartLabels = chart.data.labels;

            ctx.save();
            dataPoints.forEach((point, index) => {
                const x = point.x;
                const y = point.y;
                const label = chartLabels[index];

                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.lineWidth = 2;
                ctx.strokeStyle = 'white';
                ctx.strokeText(label, x, y);

                ctx.fillStyle = 'black';
                ctx.fillText(label, x, y);
            });
            ctx.restore();
        }
    };

    const cornerTextPlugin = {
        id: 'cornerTextPlugin',
        afterDraw(chart) {
            const { ctx, chartArea } = chart;
            const left = chartArea.left;
            const right = chartArea.right;
            const top = chartArea.top;

            ctx.save();
            ctx.font = '14px sans-serif';
            ctx.fillStyle = 'black';

            ctx.textAlign = 'left';
            ctx.fillText(chart.config._제목 || '', left + 10, top + 20);

            ctx.textAlign = 'right';
            ctx.fillText(`평균 픽률: ${(chart.config._평균픽률 * 100).toFixed(2)}%`, right - 10, top + 20);
            ctx.fillText(`평균 RP: ${chart.config._가중평균RP.toFixed(1)}`, right - 10, top + 40);
            ctx.fillText(`평균 승률: ${(chart.config._가중평균승률 * 100).toFixed(2)}%`, right - 10, top + 60);

            ctx.restore();
        }
    };

    function createGraph({ xKey, yKey, radiusKey, title }) {
        if (myChart) myChart.destroy();

        const ctx = canvas.getContext('2d');
        const 전체표본수 = chartData.reduce((sum, d) => sum + d["표본수"], 0);
        const 평균픽률 = chartData.reduce((acc, d) => acc + (d["표본수"] / 전체표본수), 0) / chartData.length;

        const 필터링된데이터 = chartData.filter(d => {
            const 픽률 = d["표본수"] / 전체표본수;
            if (excludeLowCheckbox.checked && 픽률 < 평균픽률 / 4) return false;
            if (excludeHighCheckbox.checked && 픽률 > 평균픽률 * 5) return false;
            return true;
        });

        if (필터링된데이터.length === 0) {
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const labels = 필터링된데이터.map(d => d["실험체"]);
        const getValue = (key, d) => key === "픽률" ? d["표본수"] / 전체표본수 : d[key];

        const xValues = 필터링된데이터.map(d => getValue(xKey, d));
        const yValues = 필터링된데이터.map(d => getValue(yKey, d));
        const radiusValues = 필터링된데이터.map(d => getValue(radiusKey, d));

        const 가중평균RP = 필터링된데이터.reduce((acc, d) => acc + d["RP 획득"] * (d["표본수"] / 전체표본수), 0);
        const 가중평균승률 = 필터링된데이터.reduce((acc, d) => acc + d["승률"] * (d["표본수"] / 전체표본수), 0);

        const isXPercent = xKey === "픽률" || xKey === "승률";
        const isYPercent = yKey === "픽률" || yKey === "승률";

        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);

        Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    data: 필터링된데이터.map((d, i) => ({
                        x: xValues[i],
                        y: yValues[i],
                        label: d["실험체"]
                    })),
                    backgroundColor: (ctx) => {
                        const index = ctx.dataIndex;
                        const hue = (index * 360 / 필터링된데이터.length) % 360;
                        return `hsl(${hue}, 60%, 70%, 0.8)`;
                    },
                    pointRadius: (ctx) => {
                        const v = radiusValues[ctx.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
                        return min === max ? 15 : 6 + ((v - min) / (max - min)) * 24;
                    },
                    pointHoverRadius: (ctx) => {
                        const v = radiusValues[ctx.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
                        return min === max ? 15 : 6 + ((v - min) / (max - min)) * 24;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const index = context.dataIndex;
                                const d = 필터링된데이터[index];
                                return [
                                    `${d["실험체"]}`,
                                    `픽률: ${(d["표본수"] / 전체표본수 * 100).toFixed(2)}%`,
                                    `RP 획득: ${d["RP 획득"]}`,
                                    `승률: ${(d["승률"] * 100).toFixed(2)}%`
                                ];
                            }
                        }
                    },
                    annotation: {
                        annotations: [
                            {
                                type: 'line',
                                scaleID: 'x',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: xKey === "픽률" ? 평균픽률 : (xKey === "승률" ? 가중평균승률 : 가중평균RP)
                            },
                            {
                                type: 'line',
                                scaleID: 'y',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: yKey === "픽률" ? 평균픽률 : (yKey === "승률" ? 가중평균승률 : 가중평균RP)
                            }
                        ]
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: xKey },
                        min: xMin,
                        max: xMax,
                        ticks: {
                            callback: v => isXPercent ? (v * 100).toFixed(1) + '%' : v,
                            stepSize: isXPercent ? 0.01 : 1
                        }
                    },
                    y: {
                        title: { display: true, text: yKey },
                        min: yMin,
                        max: yMax,
                        ticks: {
                            callback: v => isYPercent ? (v * 100).toFixed(1) + '%' : v,
                            stepSize: isYPercent ? 0.01 : 1
                        }
                    }
                }
            }
        });

        myChart.config._제목 = title;
        myChart.config._평균픽률 = 평균픽률;
        myChart.config._가중평균RP = 가중평균RP;
        myChart.config._가중평균승률 = 가중평균승률;
    }

    function loadData() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(r => r.json())
            .then(json => {
                const history = json["통계"];
                const timestamps = Object.keys(history).sort();
                const latestKey = timestamps[timestamps.length - 1];
                const latestData = history[latestKey];

                if (period === 'latest') {
                    chartData = latestData;
                    document.querySelector('[data-type="pick-rp"]').click();
                    return;
                }

                const days = period === '3day' ? 3 : 7;
                const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
                const pastDate = new Date(latestDate);
                pastDate.setDate(pastDate.getDate() - days);

                const pastKey = timestamps.slice().reverse().find(ts => {
                    const d = new Date(ts.replace(/_/g, ':').replace(/-/g, '/'));
                    return d <= pastDate;
                });

                if (!pastKey || !history[pastKey]) {
                    chartData = latestData;
                    document.querySelector('[data-type="pick-rp"]').click();
                    return;
                }

                const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
                const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));

                const delta = [];
                for (const name in currMap) {
                    const curr = currMap[name];
                    const prev = prevMap[name];
                    if (!prev) continue;
                    const diffSample = curr["표본수"] - prev["표본수"];
                    if (diffSample <= 0) continue;

                    delta.push({
                        "실험체": name,
                        "표본수": diffSample,
                        "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diffSample,
                        "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diffSample,
                        "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diffSample,
                        "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diffSample
                    });
                }

                chartData = delta;
                document.querySelector('[data-type="pick-rp"]').click();
            });
    }

    Promise.all([
        fetch('versions.json').then(r => r.json())
    ]).then(([versions]) => {
        versions.sort().reverse().forEach(v => {
            versionSelect.innerHTML += `<option value="${v}">${v}</option>`;
        });

        const tierMap = {
            "platinum_plus": "플래티넘+",
            "diamond_plus": "다이아몬드+",
            "meteorite_plus": "메테오라이트+",
            "mithril_plus": "미스릴+",
            "in1000": "in1000"
        };
        Object.entries(tierMap).forEach(([val, name]) => {
            tierSelect.innerHTML += `<option value="${val}">${name}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;

        versionSelect.addEventListener('change', loadData);
        tierSelect.addEventListener('change', loadData);
        periodSelect.addEventListener('change', loadData);
        excludeLowCheckbox.addEventListener('change', () => document.querySelector('[data-type="pick-rp"]').click());
        excludeHighCheckbox.addEventListener('change', () => document.querySelector('[data-type="pick-rp"]').click());

        loadData();
    });

    setupGraphPopup();
    setupGraphTabs();
});
