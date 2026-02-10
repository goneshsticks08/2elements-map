/**
 * グラフ生成モジュール
 * Chart.jsを使用したグラフの生成と更新を担当
 */

// グラフオブジェクトを保存する変数
let distanceChart;
let directionChart;

/**
 * グラフの初期化を行う
 */
function initCharts() {
  // Canvas要素の存在チェックを追加
  const distanceChart = document.getElementById('distance-chart');
  const directionChart = document.getElementById('direction-chart');
  
  // Canvasが存在しない場合は処理をスキップ
  if (!distanceChart || !directionChart) {
    console.warn('チャート用のCanvas要素が見つかりません。チャートの初期化をスキップします。');
    return;
  }
  
  //距離帯ごとの店舗数グラフ
  const distanceCtx = document.getElementById('distanceChart').getContext('2d');
  distanceChart = new Chart(distanceCtx, {
    type: 'bar',
    data: {
      labels: ['0-0.5km', '0.5-1km', '1-1.5km', '1.5-2km'],
      datasets: [{
        label: '距離帯ごとの店舗数',
        data: [0, 0, 0, 0],
        backgroundColor: 'rgba(0, 145, 64, 0.7)',
        borderColor: 'rgba(0, 145, 64, 1)',
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
  
  // 方角ごとの店舗数グラフ
  const directionCtx = document.getElementById('directionChart').getContext('2d');
  directionChart = new Chart(directionCtx, {
    type: 'radar',
    data: {
      labels: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
      datasets: [{
        label: '方角ごとの店舗数',
        data: [0, 0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(25, 118, 210, 0.2)',
        borderColor: 'rgba(25, 118, 210, 1)',
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0
        }
      }
    }
  });
}

/**
 * 分析結果に基づいてグラフを更新する
 * @param {Object} results - 分析結果オブジェクト
 */
function updateCharts(results) {
  // 距離帯グラフの更新
  distanceChart.data.datasets[0].data = results.targetsByDistance;
  distanceChart.update();
  
  // 方角グラフの更新
  directionChart.data.datasets[0].data = results.targetsByDirection;
  directionChart.update();
}

/**
 * グラフをPNG画像として保存する
 * @param {string} chartType - グラフタイプ（'distance'または'direction'）
 * @returns {string} データURL
 */
function getChartImage(chartType) {
  if (chartType === 'distance') {
    return distanceChart.toBase64Image();
  } else if (chartType === 'direction') {
    return directionChart.toBase64Image();
  }
  return null;
}