console.log("test");

document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            const tierGroups = {};
            const orderedTiers = ["S+", "S", "A", "B", "C", "D", "F"];

            data.forEach(item => {
                const tier = item["티어"];
                if (!tierGroups[tier]) {
                    tierGroups[tier] = [];
                }
                tierGroups[tier].push(item["실험체"]);
            });

            const container = document.getElementById('tier-table-container');
            let html = '<table class="tier-table">';

            orderedTiers.forEach(tier => {
                html += '<tr class="tier-row">';
                html += `<th>${tier}</th>`;
                html += '<td>';
                if (tierGroups[tier]) {
                    tierGroups[tier].forEach((experiment) => {
                        const imageName = convertExperimentNameToImageName(experiment);
                        const imageSrc = `image/${imageName}.png`;
                        console.log("생성된 이미지 src:", imageSrc); // 이 줄을 추가
                        html += `<img src="${imageSrc}" alt="${experiment}" width="100">`;
                    });
                }
                html += '</td>';
                html += '</tr>';
            });

            html += '</table>';
            container.innerHTML = html;
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('tier-table-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    function convertExperimentNameToImageName(experimentName) {
        if (experimentName.includes(" ")) {
            const parts = experimentName.split(" ");
            if (parts.length >= 2) {
                return `${parts[1]}-${parts[0]}`;
            }
        }
        return experimentName;
    }
});