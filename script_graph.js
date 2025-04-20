document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const tabButtons = document.querySelectorAll('.graph-tab');
    const canvas = document.getElementById('graph-canvas');
    const popup = document.getElementById('image-popup');
    const popupImage = document.getElementById('popup-image');
    const popupClose = document.querySelector('.image-popup-close');
    const popupButton = document.getElementById('popup-graph-button');

    let chart;
    let chartType = 'pick-rp';

    // 드롭다운 초기화
    Promise.all([
        fetch('versions.json').then(res => res.json())
    ]).then(([versionList]) => {
        versionList.sort().reverse().forEach(version => {
            versionSelect.innerHTML += `<option value="${version}">${version}</option>`;
        });

        const tierMap = {
            "platinum_plus": "플래티넘+",
            "diamond_plus": "다이아몬드+",
            "meteorite_plus": "메테오라이트+",
            "mithril_plus": "미스릴+",
            "in1000": "in1000"
        };

        Object.entries(tierMap).forEach(([key, val]) => {
            tierSelect.innerHTML += `<option value="${key}">${val}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;

        versionSelect.addEventListener('change', loadGraph);
        tierSelect.addEventListener('change', loadGraph);
        periodSelect.addEventListener('change', loadGraph);
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                chartType = btn.dataset.type;
                loadGraph();
            });
        });

        loadGraph();
    });

    function loadGraph() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json["통계"];
                const timestamps = Object.keys(history).sort();
                const latestKey = timestamps[timestamps.length - 1];
                const latestData = history[latestKey];

                let dataToUse = latestData;

                if (period !== 'latest') {
                    const days = period === '3day' ? 3 : 7;
                    const latestDate = new Date(latestKey);
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(pastDate.getDate() - days);

                    const pastKey = timestamps.slice().reverse().find(ts => new Date(ts) <= pastDate);

                    if (pastKey && history[pastKey]) {
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

                        dataToUse = delta;
                    }
                }

                renderGraph(dataToUse);
            });
    }

    function renderGraph(data) {
        if (chart) chart.destroy();

        let xLabel, yLabel;
        let xDataKey, yDataKey;
        let bubbleSizeKey;

        if (chartType === 'pick-rp') {
            xLabel = '픽률 (%)';
            yLabel = 'RP 획득';
            xDataKey = d => d["표본수"];
            yDataKey = d => d["RP 획득"];
            bubbleSizeKey = d => d["승률"];
        } else if (chartType === 'pick-win') {
            xLabel = '픽률 (%)';
            yLabel = '승률 (%)';
            xDataKey = d => d["표본수"];
            yDataKey = d => d["승률"] * 100;
            bubbleSizeKey = d => d["RP 획득"];
        } else if (chartType === 'rp-win') {
            xLabel = 'RP 획득';
            yLabel = '승률 (%)';
            xDataKey = d => d["RP 획득"];
            yDataKey = d => d["승률"] * 100;
            bubbleSizeKey = d => d["표본수"];
        }

        const totalSample = data.reduce((sum, d) => sum + d["표본수"], 0);
        const avgWinRate = data.reduce((sum, d) => sum + d["승률"] * d["표본수"], 0) / totalSample;

        const bubbleData = data.map(d => {
            const x = chartType.includes('pick') ? d["표본수"] / totalSample * 100 : xDataKey(d);
            const y = yDataKey(d);
            const size = bubbleSizeKey(d);
            return {
                x,
                y,
                r: Math.max(5, Math.sqrt(size * 100) / 5),
                label: d["실험체"]
            };
        });

        chart = new Chart(canvas, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: '실험체',
                    data: bubbleData,
                }]
            },
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const d = ctx.raw;
                                return `${d.label} (x: ${d.x.toFixed(2)}, y: ${d.y.toFixed(2)})`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xLabel
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yLabel
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // 팝업 관련
    popupButton.addEventListener('click', () => {
        html2canvas(canvas).then(canvasImg => {
            const version = versionSelect.value;
            const tier = tierSelect.value;
            const period = periodSelect.value;
            const now = new Date();
            const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
            const filename = `${version}_${tier}_${period}_${timestamp}.png`;

            popup.style.display = 'block';
            popupImage.src = canvasImg.toDataURL();
            popupImage.alt = filename;
        });
    });

    popupClose.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === popup) {
            popup.style.display = 'none';
        }
    });
});
