/**
 * 2点間の方角を計算する（度数）
 * @param {number} lat1 - 始点の緯度
 * @param {number} lng1 - 始点の経度
 * @param {number} lat2 - 終点の緯度
 * @param {number} lng2 - 終点の経度
 * @returns {number} - 北を0度とした時計回りの角度（度数）
 */
function calculateDirection(lat1, lng1, lat2, lng2) {
  // 緯度経度をラジアンに変換
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  // 方位角の計算
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  // atan2の結果をラジアンから度数に変換し、0-360の範囲に正規化
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  
  return bearing;
}

/**
 * エクスポート機能モジュール
 * データのエクスポート機能を担当
 */

/**
 * エクスポートメニューの表示切替
 */
function toggleExportMenu() {
  const exportOptions = document.getElementById('export-options');
  if (exportOptions) {
    const isVisible = exportOptions.style.display !== 'none';
    exportOptions.style.display = isVisible ? 'none' : 'block';
  }
}

/**
 * エクスポート処理
 * @param {string} type - エクスポートタイプ（'pdf', 'csv', 'image', 'chart'）
 */
function exportData(type) {
  // 選択されている基準データの取得
  const selectedBaseDataId = document.getElementById('base-data-select').value;
  let baseData;
  
  try {
    // getBaseDataById関数がある場合はそれを使用
    if (typeof getBaseDataById === 'function') {
      baseData = getBaseDataById(selectedBaseDataId);
    } 
    // getBaseData関数がある場合は検索
    else if (typeof getBaseData === 'function') {
      const baseDataList = getBaseData();
      baseData = baseDataList.find(item => item.id === selectedBaseDataId);
    }
  } catch (e) {
    console.error('基準データ情報の取得に失敗しました:', e);
  }
  
  if (!baseData) {
    alert('基準データが選択されていません。分析対象を選択してください。');
    return;
  }
  
  const exportTypes = {
    pdf: "分析レポート (HTML)",
    csv: "店舗データ (CSV)",
    image: "現在の地図 (PNG)",
    chart: "グラフデータ (PNG)"
  };
  
  // エクスポートタイプに応じた処理
  switch (type) {
    case 'pdf':
      showPrintableReport(baseData);
      break;
    case 'csv':
      exportCSV(baseData);
      break;
    case 'image':
      exportMapImage();
      break;
    case 'chart':
      exportChartImages();
      break;
    default:
      console.error('不明なエクスポートタイプ:', type);
  }
  
  // エクスポートメニューを閉じる
  const exportOptions = document.getElementById('export-options');
  if (exportOptions) {
    exportOptions.style.display = 'none';
  }console.log(exportTypes[type] + 'のエクスポートを実行しました');
}

/**
 * HTMLレポートの表示（印刷用）-日本語対応
 * @param {Object} baseData - 基準データ
 */
function showPrintableReport(baseData) {
  if (!baseData) {
    alert('基準データが選択されていません。分析対象を選択してください。');
    return;
  }
  
  try {
    // 現在の日時
    const now = new Date();
    const dateStr = now.toLocaleDateString('ja-JP');
    const timeStr = now.toLocaleTimeString('ja-JP');
    
    // 総数の取得
    const allBaseData = getBaseData();
    const allTargetData = getTargetData();
    const baseTotalCount = allBaseData.length;
    const targetTotalCount = allTargetData.length;
    
    // 分析データの取得
    const radius = document.getElementById('radius-slider').value;
    const targetsInRadius = getTargetData().filter(target => {
      const distance = calculateDistance(baseData.lat, baseData.lng, target.lat, target.lng);
      return distance <= radius;
    });

    // 最も近い対象データ情報
    let nearestTargetInfo = '';
    let avgDistanceInfo = '';

    if (targetsInRadius.length > 0) {
      // 最も近い対象データと距離
      targetsInRadius.sort((a, b) => {
        const distA = calculateDistance(baseData.lat, baseData.lng, a.lat, a.lng);
        const distB = calculateDistance(baseData.lat, baseData.lng, b.lat, b.lng);
        return distA - distB;
      });
      const nearestTarget = targetsInRadius[0];
      const nearestDistance = calculateDistance(baseData.lat, baseData.lng, nearestTarget.lat, nearestTarget.lng);
      nearestTargetInfo = `<p>最も近い対象データ: ${nearestTarget.name} (${nearestDistance.toFixed(2)}km)</p>`;
      
      // 平均距離
      const totalDistance = targetsInRadius.reduce((sum, target) => {
        return sum + calculateDistance(baseData.lat, baseData.lng, target.lat, target.lng);
      }, 0);
      const avgDistance = totalDistance / targetsInRadius.length;
      avgDistanceInfo = `<p>平均距離: ${avgDistance.toFixed(2)}km</p>`;
    }
    
    // 都道府県別データ集計（分析結果サマリーを置き換え）
    // データの集計
    const prefCountMap = new Map();
    // 基準データの集計
    const allBaseDataItems = getBaseData();
    allBaseDataItems.forEach(item => {
      const pref = extractPrefecture(item.address);
      if (!prefCountMap.has(pref)) {
        prefCountMap.set(pref, { base: 0, target: 0 });
      }
      prefCountMap.get(pref).base++;
    });
    
    // 対象データの集計
    const allTargetItems = getTargetData();
    allTargetData.forEach(target => {
      const pref = extractPrefecture(target.address);
      if (!prefCountMap.has(pref)) {
        prefCountMap.set(pref, { base: 0, target: 0 });
      }
      prefCountMap.get(pref).target++;
    });
    
    // 対象データリストテーブル
    let targetTable = `<table border="1" style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead>
        <tr>
          <th style="padding: 8px;">対象データ名</th>
          <th style="padding: 8px;">距離(km)</th>
          <th style="padding: 8px;">方角</th>
          <th style="padding: 8px;">住所</th></tr>
      </thead>
      <tbody>`;

    targetsInRadius.forEach(target => {
      const distance = calculateDistance(baseData.lat, baseData.lng, target.lat, target.lng);
      const direction = calculateDirection(baseData.lat, baseData.lng, target.lat, target.lng);
      const directionText = getDirectionText(direction);
      targetTable += `
        <tr>
          <td style="padding: 8px;">${target.name}</td>
          <td style="padding: 8px; text-align: right;">${distance.toFixed(2)}</td>
          <td style="padding: 8px; text-align: center;">${directionText}</td>
          <td style="padding: 8px;">${target.address || ""}</td>
        </tr>
      `;
    });

targetTable += `</tbody></table>`;
    
    targetTable += `</tbody>
      </table>`;
    
    // 地図を作成するための情報
    // 中心座標
    const centerLat = baseData.lat;
    const centerLng = baseData.lng;
    
    // マーカー表示用のデータ
    const mapMarkers = [];
    // 基準データのマーカー
    mapMarkers.push({
      lat: baseData.lat,
      lng: baseData.lng,
      name: baseData.name,
      color: 'orange',
      type: 'base'
    });
    
    // 対象データのマーカー
    targetsInRadius.forEach(target => {
      const targetItem = getTargetData().find(t => t.name === target.name);
      if (targetItem && targetItem.lat && targetItem.lng) {
        mapMarkers.push({
          lat: targetItem.lat,
          lng: targetItem.lng,
          name: target.name,
          color: 'green',
          type: 'target'
        });
      }
    });
    
    // マーカーJSONを作成
    const markersJson = JSON.stringify(mapMarkers);
    
    // 地図表示用のHTMLとJavaScript
    const mapImageHTML = `
      <div style="margin: 20px 0;">
        <h3>位置関係マップ</h3>
        <div id="report-map" style="height: 400px; width: 100%;"></div>
        <p style="font-size: 12px; color: #777; margin-top: 5px;">
          * オレンジ色が基準データ、緑色が対象データです。範囲: ${radius}km
        </p>
      </div>
      <script>
        // レポート用マップの初期化
        function initReportMap() {
          const map = L.map('report-map').setView([${centerLat}, ${centerLng}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(map);
          
          // 検索範囲を円で表示
          L.circle([${centerLat}, ${centerLng}], {
            color: 'blue',
            fillColor: '#30f',
            fillOpacity: 0.1,
            radius: ${radius} * 1000
          }).addTo(map);
          
          // マーカーデータ
          const markers = ${markersJson};
          
          // マーカーを追加
          markers.forEach(marker => {
            const icon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: ' + marker.color + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [15, 15],
              iconAnchor: [7, 7]
            });
            
            if (marker.type === 'base') {
              // 基準データは大きめのマーカー
              const baseIcon = L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background-color: ' + marker.color + '; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              
              L.marker([marker.lat, marker.lng], { icon: baseIcon })
                .bindTooltip(marker.name)
                .addTo(map);
            } else {
              L.marker([marker.lat, marker.lng], { icon: icon })
                .bindTooltip(marker.name)
                .addTo(map);
            }
          });
        }
        
        // マップの初期化（遅延実行）
        setTimeout(initReportMap, 100);
      </script>
    `;
    
    // HTMLレポートの構築
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>${baseData.name} - 位置関係分析レポート</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css">
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
        <style>
          body { font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif; }
          .report { max-width: 800px; margin: 0 auto; padding: 20px; }
          h1, h2, h3 { color: #333; }
          .section { margin-bottom: 20px; }
          .footer { margin-top: 30px; font-size: 12px; color: #777; text-align: center; }
          .button { 
            padding: 8px 16px; 
            margin-right: 8px; 
            background-color: #4CAF50; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;}
          .button:hover { background-color: #45a049; }
          .print-button { background-color: #2196F3; }
          .print-button:hover { background-color: #0b7dda; }
          .close-button { background-color: #f44336; }
          .close-button:hover { background-color: #d32f2f; }
          @media print {
            .no-print { display: none; }
            body { font-size: 12px; }
            h1 { font-size: 18px; }
            h2 { font-size: 16px; }
            h3 { font-size: 14px; }}
        </style>
      </head>
      <body>
        <div class="report">
          <div class="no-print" style="text-align: right;">
            <button class="button" onclick="exportToPDF();">PDFで保存</button><button class="button print-button" onclick="window.print();">印刷する</button>
            <button class="button close-button" onclick="window.close();">閉じる</button>
          </div>
          
          <div id="report-content">
            <h1>位置関係分析レポート</h1>
            
            <div class="section">
              <h2>基本情報</h2>
              <p>作成日時: ${dateStr} ${timeStr}</p>
              <p>基準データ: ${baseDataName || "未設定"} （総数: ${baseTotalCount}件）</p>
              <p>対象データ: ${targetDataName || "未設定"} （総数: ${targetTotalCount}件）</p>
            </div><div class="section">
              <h2>選択基準データ情報</h2>
              <p>基準データ名: ${baseData.name}</p>
              <p>住所: ${baseData.address || "情報なし"}</p>
              <!-- 電話番号の表示を削除 -->
            </div>
            
            <div class="section">
              <h2>検索条件</h2>
              <p>検索半径: ${radius}km</p></div>
            
            <div class="section">
              <h2>検索結果サマリー</h2>
              <p>対象データ数: ${targetsInRadius.length}件</p>
              ${nearestTargetInfo}${avgDistanceInfo}
            </div>
            
            ${mapImageHTML}
            
            <div class="section">
              <h2>対象データリスト</h2>
              ${targetTable}
            </div>
            
            <div class="footer">
              <p>位置関係分析ツール | ${dateStr}</p>
            </div>
          </div>
        </div>
        
        <script>
          function exportToPDF() {
            // PDFファイル名を設定
            const filename = '${baseData.name}_分析レポート_${dateStr.replace(/\//g, '')}.pdf';
            
            // PDFのオプション
            const opt = {
              margin: [10, 10, 10, 10],
              filename: filename,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            // report-contentのみをPDFにする
            const content = document.getElementById('report-content');
            // PDFを生成してダウンロード
            html2pdf().set(opt).from(content).save().then(() => {
              alert('PDFの保存が完了しました');
            });
          }
        </script>
      </body>
      </html>
    `;
    
    //新しいウィンドウでレポートを開く
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();
    console.log(`${baseData.name}の分析レポートをHTMLで表示しました`);
  } catch (error) {
    console.error('HTMLレポートの生成中にエラーが発生しました:', error);
    alert('HTMLレポートの生成中にエラーが発生しました。');
  }
}

/**
 * 一括エクスポートレポート（修正版）
 * @param {Array} baseDataList - 基準データの配列
 * @param {number} radius - 検索半径（km）
 */
function generateBatchExportReport(baseDataList, radius) {
  try {
    // 現在の日時
    const now = new Date();
    const dateStr = now.toLocaleDateString('ja-JP');
    const timeStr = now.toLocaleTimeString('ja-JP');
    
    //選択された都道府県を抽出
    const selectedPrefectures = [...new Set(baseDataList.map(item => extractPrefecture(item.address)))];
    
    // 総数の取得（エクスポート機能のメニューカードと同じ値を使用）
    const allBaseData = getBaseData();
    const allTargetData = getTargetData();
    
    // ここに baseTotalCount と targetTotalCount の定義を追加
    const baseTotalCount = allBaseData.length;
    const targetTotalCount = allTargetData.length;
    
    // データの集計（選択された都道府県のみ）
    const prefCountMap = new Map();
    // 基準データの集計
    baseDataList.forEach(item => {
      const pref = extractPrefecture(item.address);
      if (!prefCountMap.has(pref)) {
        prefCountMap.set(pref, { base: 0, target: 0 });
      }
      prefCountMap.get(pref).base++;
    });
    
    // 対象データの集計
    //選択された都道府県内のみカウント
     allTargetData.forEach(target => {
      const pref = extractPrefecture(target.address);
      if (selectedPrefectures.includes(pref)) {
        if (!prefCountMap.has(pref)) {
          prefCountMap.set(pref, { base: 0, target: 0 });
        }
        prefCountMap.get(pref).target++;
      }
    });
    
    // メインカードと同じ順序で都道府県を表示するための処理
    // 地域ごとの都道府県配列（app.jsから地域マップ定義を利用）
    const orderedPrefectures = [
      // 北海道・東北
      "北海道", "青森県", "秋田県", "岩手県", "山形県", "宮城県", "福島県",
      // 関東
      "群馬県", "栃木県", "茨城県", "埼玉県", "千葉県", "東京都", "神奈川県",
      // 中部
      "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", 
      "岐阜県", "静岡県", "愛知県",
      // 近畿
      "三重県", "滋賀県", "京都府", "大阪府", "奈良県", "和歌山県", "兵庫県",
      // 中国・四国
      "鳥取県", "島根県", "岡山県", "広島県", "山口県",
      "香川県", "徳島県", "高知県", "愛媛県",
      // 九州・沖縄
      "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
    ];
    
    // 集計データを地域順にソート
    const sortedPrefDataArray = [];
    orderedPrefectures.forEach(pref => {
      if (prefCountMap.has(pref)) {
        sortedPrefDataArray.push([pref, prefCountMap.get(pref)]);
      }
    });
    
    //合計を計算
    let totalBase = 0;
    let totalTarget = 0;
    sortedPrefDataArray.forEach(entry => {
      totalBase += entry[1].base;
      totalTarget += entry[1].target;
    });
    
    // HTMLレポートの構築
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>一括分析レポート</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <style>
          body { font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif; }
          .report { max-width: 800px; margin: 0 auto; padding: 20px; }
          h1, h2, h3 { color: #333; }
          .section { margin-bottom: 20px; }
          .footer { margin-top: 30px; font-size: 12px; color: #777; text-align: center; }
          .button { 
            padding: 8px 16px; 
            margin-right: 8px; 
            background-color: #4CAF50; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;}
          .button:hover { background-color: #45a049; }
          .print-button { background-color: #2196F3; }
          .print-button:hover { background-color: #0b7dda; }
          .close-button { background-color: #f44336; }
          .close-button:hover { background-color: #d32f2f; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 8px; border: 1px solid #ddd; text-align: center; }
          th { background-color: #f2f2f2; }
          .total-row { background-color: #e9ecef; font-weight: bold; }
          @media print {
            .no-print { display: none; }body { font-size: 12px; }
            h1 { font-size: 18px; }
            h2 { font-size: 16px; }
            h3 { font-size: 14px; }
          }
        </style>
      </head>
      <body>
        <div class="report">
          <div class="no-print" style="text-align: right;">
            <button class="button" onclick="exportToPDF();">PDFで保存</button>
            <button class="button print-button" onclick="window.print();">印刷する</button>
            <button class="button close-button" onclick="window.close();">閉じる</button>
          </div>
          
          <div id="report-content">
            <h1>一括分析レポート</h1>
            
            <div class="section">
              <h2>基本情報</h2>
              <p>作成日時: ${dateStr} ${timeStr}</p>
              <p>基準データ: ${baseDataName || "未設定"} （総数: ${baseTotalCount}件）</p>
              <p>対象データ: ${targetDataName || "未設定"} （総数: ${targetTotalCount}件）</p>
            </div><div class="section">
              <h2>検索条件</h2>
              <p>検索半径: ${radius}km</p>
              <p>選択都道府県数: ${selectedPrefectures.length}件</p>
              <p>対象データ数: ${baseDataList.length}件</p>
            </div><div class="section">
              <h2>分析結果一覧</h2>
              <table>
                <thead>
                  <tr>
                    <th>都道府県</th>
                    <th>基準データ数</th>
                    <th>対象データ数</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedPrefDataArray.map(([pref, counts]) => `
                    <tr>
                      <td>${pref}</td>
                      <td>${counts.base}</td>
                      <td>${counts.target}</td>
                    </tr>
                  `).join('')}<tr class="total-row">
                    <td>合計</td>
                    <td>${totalBase}</td>
                    <td>${totalTarget}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="footer">
              <p>位置関係分析ツール | ${dateStr}</p>
            </div>
          </div>
        </div>
        
        <script>
          function exportToPDF() {
            // PDFファイル名を設定
            const filename = '一括分析レポート_${dateStr.replace(/\//g, '')}.pdf';
            
            // PDFのオプション
            const opt = {
              margin: [10, 10, 10, 10],
              filename: filename,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            // report-contentのみをPDFにする
            const content = document.getElementById('report-content');
            // PDFを生成してダウンロード
            html2pdf().set(opt).from(content).save().then(() => {
              alert('PDFの保存が完了しました');
            });
          }
        </script>
      </body>
      </html>
    `;
    
    // 新しいウィンドウでレポートを開く
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();
    console.log(`一括分析レポートをHTMLで表示しました`);
  } catch (error) {
    console.error('一括レポートの生成中にエラーが発生しました:', error);
    alert('一括レポートの生成中にエラーが発生しました。');
  }
}

/**
 * CSV形式での分析レポート出力
 */
function generateCSVReport(selectedPrefectures, radius) {
  //選択された都道府県の基準データを収集
  let baseDataList = [];
  selectedPrefectures.forEach(pref => {
    const prefBaseData = getBaseDataByPrefecture(pref);
    baseDataList = baseDataList.concat(prefBaseData);
  });
  
  if (baseDataList.length === 0) {
    alert('選択された都道府県に基準データがありません。');
    return;
  }
  
  // CSVヘッダー
  let csvContent = "都道府県,基準データ（名称）,基準データ（住所）,対象データ（名称）,対象データ（住所）,距離(km)\n";
  
  // 各基準データに対する検索結果をCSVに追加
  baseDataList.forEach(baseData => {
    const prefecture = extractPrefecture(baseData.address);
    const nearbyTargets = findTargetsInRadius(baseData, radius);
    
    if (nearbyTargets.length === 0) {
      // 近くの対象データがない場合は、基準データのみ出力
      csvContent += `${prefecture},${baseData.name},${baseData.address},,,""\n`;
    } else {
      // 近くの対象データがある場合は、各対象データとの組み合わせを出力
      nearbyTargets.forEach(target => {
        const distance = calculateDistance(
          baseData.lat, baseData.lng, 
          target.lat, target.lng
        ).toFixed(2);
        
        csvContent += `${prefecture},${baseData.name},${baseData.address},${target.name},${target.address},${distance}\n`;
      });
    }
  });
  
  // CSVファイルのダウンロード
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `分析レポート_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// イベントリスナー設定（app.jsのsetupEventListeners関数内に追加）
const generateCSVBtn = document.getElementById('generate-export-csv');
if (generateCSVBtn) {
  generateCSVBtn.addEventListener('click', function() {
    const radius = parseFloat(document.getElementById('batch-radius-slider').value);
    generateCSVReport(selectedPrefectures, radius);
  });
}

/**
 * CSVエクスポート
 * @param {Object} baseData - 基準データ
 */
function exportCSV(baseData) {
  if (!baseData) {
    alert('基準データが選択されていません。分析対象を選択してください。');
    return;
  }

  //検索半径内の対象データを取得
  const radius = document.getElementById('radius-slider').value;
  const targetsInRadius = getTargetData().filter(target => {
    const distance = calculateDistance(baseData.lat, baseData.lng, target.lat, target.lng);
    return distance <= radius;
  });
  
  // CSVヘッダー - 不要な項目を削除
  let csv = "対象データ名,住所,距離(km),方角\n";
  
  // 各対象データの詳細を追加 - 不要な項目を削除
  targetsInRadius.forEach(target => {
    const distance = calculateDistance(baseData.lat, baseData.lng, target.lat, target.lng);
    const direction = calculateDirection(baseData.lat, baseData.lng, target.lat, target.lng);
    const directionText = getDirectionText(direction);
    csv += '"' + target.name + '","' + 
           (target.address || '') + '",' + 
           distance.toFixed(2) + ',"' + 
           directionText + '"\n';
  });
  
  // CSVファイルのダウンロード
  downloadFile(csv, baseData.name + '_周辺対象データリスト.csv', 'text/csv');
  console.log(`${baseData.name}の周辺対象データをCSVで出力しました`);
}

/**
 * 方角の数値をテキストに変換
 * @param {number} degrees - 方角（度数）
 * @returns {string}方角テキスト
 */
function getDirectionText(degrees) {
  if (degrees >= 337.5 || degrees < 22.5) return '北';
  if (degrees >= 22.5 && degrees < 67.5) return '北東';
  if (degrees >= 67.5 && degrees < 112.5) return '東';
  if (degrees >= 112.5 && degrees < 157.5) return '南東';
  if (degrees >= 157.5 && degrees < 202.5) return '南';
  if (degrees >= 202.5 && degrees < 247.5) return '南西';
  if (degrees >= 247.5 && degrees < 292.5) return '西';
  if (degrees >= 292.5 && degrees < 337.5) return '北西';
  return '不明';
}

/**
 * 地図の画像をエクスポート
 */
function exportMapImage() {
  // 実際の実装では、地図のスクリーンショットを撮るライブラリなどを使用する
  alert('地図のエクスポート機能はこのバージョンではサポートされていません。');
}

/**
 * グラフ画像をエクスポート
 */
function exportChartImages() {
  const baseData = getBaseDataById(selectedBaseDataId);
  if (!baseData) return;
  
  // 距離グラフの画像URL
  const distanceImageURL = getChartImage('distance');
  if (distanceImageURL) {
    //新しいタブでグラフ画像を開く
    const distanceWindow = window.open();
    distanceWindow.document.write('<img src="' + distanceImageURL +'" alt="距離帯ごとの対象データ数" />');
  }
  
  // 方角グラフの画像URL
  const directionImageURL = getChartImage('direction');
  if (directionImageURL) {
    // 新しいタブでグラフ画像を開く
    const directionWindow = window.open();
    directionWindow.document.write('<img src="' + directionImageURL + '" alt="方角ごとの対象データ数" />');
  }
}

/**
 *ファイルをダウンロードする
 * @param {string} content - ファイルコンテンツ
 * @param {string} fileName - ファイル名
 * @param {string} contentType - コンテンツタイプ
 */
function downloadFile(content, fileName, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

// クリック以外の場所をクリックしたときにメニューを閉じる
document.addEventListener('click', function(event) {
  const exportMenu = document.getElementById('export-menu');
  const exportBtn = document.getElementById('export-btn');
  
  // nullチェックを追加
  if (exportMenu && exportBtn && exportMenu.classList.contains('show') && 
      !exportMenu.contains(event.target) && 
      !exportBtn.contains(event.target)) {
    exportMenu.classList.remove('show');
  }
});