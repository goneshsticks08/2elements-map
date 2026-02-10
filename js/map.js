/**
 * 地図関連モジュール
 */
let map;
let circleLayer;
let baseDataMarkers = {};
let targetDataMarkers = {};
let selectedBaseDataId = null;
let searchRadius = 2; // km
let inRadiusTargets = []; // 検索半径内の対象データ

function initMap() {
  if (map) map.remove();
  
  map = L.map('map').setView([35.6812, 139.7671], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  updateMarkers();
  
  // マップサイズの調整（サイドバーの状態変更時）
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

/**
 * マーカーを最新のデータに基づいて配置する
 */
function updateMarkers() {
  const baseDataList = getBaseData();
  const targetDataList = getTargetData();

  // 既存マーカーの削除
  Object.values(baseDataMarkers).forEach(m => map.removeLayer(m));
  Object.values(targetDataMarkers).forEach(m => map.removeLayer(m));
  baseDataMarkers = {};
  targetDataMarkers = {};

  // 基準データ表示 (オレンジ)
  baseDataList.forEach(baseData => {
    if (!baseData.lat || !baseData.lng) return;
    
    const marker = L.circleMarker([baseData.lat, baseData.lng], {
      radius: 10, fillColor: "#FF8C00", color: "#000", weight: 2, fillOpacity: 0.9
    }).addTo(map);
    
    //ポップアップに都道府県情報も追加
    const prefecture = extractPrefecture(baseData.address);
    marker.bindPopup(`<b>${baseData.name}</b><br>${prefecture}`);
    
    // クリックイベント：都道府県と基準データの自動選択
    marker.on('click', () => {
      // 対応する都道府県を選択
      const prefecture = extractPrefecture(baseData.address);
      const prefSelect = document.getElementById('prefecture-select');
      if (prefSelect && prefecture !== "不明") {
        prefSelect.value = prefecture;
        //都道府県変更イベントを発火
        const event = new Event('change');
        prefSelect.dispatchEvent(event);
      }// 基準データを選択
      selectBaseData(baseData.id);
    });
    
    baseDataMarkers[baseData.id] = marker;
  });

  // 対象データ表示 (緑)
  targetDataList.forEach(target => {
    if (!target.lat || !target.lng) return;
    
    const marker = L.circleMarker([target.lat, target.lng], {
      radius: 8, fillColor: "#009140", color: "#fff", weight: 2, fillOpacity: 0.8
    }).addTo(map);
    
    marker.bindPopup(`${targetDataName} ${target.name}`);
    
    //対象データマーカークリックイベント
    marker.on('click', () => {
      highlightTargetMarker(target.id || target.name);
    });
    
    targetDataMarkers[target.id || target.name] = marker;
  });
}

/**
 * 基準を選択してマップに表示
 */
function selectBaseData(baseDataId) {
  // 前の選択状態をリセット
  if (selectedBaseDataId && baseDataMarkers[selectedBaseDataId]) {
    const marker = baseDataMarkers[selectedBaseDataId];
    marker.setStyle({
      radius: 10, 
      fillColor: "#FF8C00", 
      color: "#000", 
      weight: 2, 
      fillOpacity: 0.9
    });
  }
  
  // 検索半径内の対象データ強調表示をリセット
  resetTargetHighlight();
  
  selectedBaseDataId = baseDataId;
  const baseData = getBaseDataById(baseDataId);
  if (!baseData) return;

  // 基準データ選択ドロップダウンも更新
  const baseDataSelect = document.getElementById('base-data-select');
  if (baseDataSelect) baseDataSelect.value = baseDataId;

  // 地図を移動
  map.panTo([baseData.lat, baseData.lng]);
  
  // 選択した基準データのマーカーを強調表示
  if (baseDataMarkers[baseDataId]) {
    const marker = baseDataMarkers[baseDataId];
    marker.setStyle({
      radius: 12, 
      fillColor: "#FF8C00", 
      color: "#FFFF00", 
      weight: 3, 
      fillOpacity: 1.0
    });marker.bringToFront();
  }
  
  // 半径円を表示
  if (circleLayer) map.removeLayer(circleLayer);
  circleLayer = L.circle([baseData.lat, baseData.lng], {
    radius: searchRadius * 1000,
    color: '#1976d2',
    fillOpacity: 0.1
  }).addTo(map);

  // 分析の実行
  if (typeof analyzeData === 'function') analyzeData();
}

/**
 * 検索半径を設定
 */
function setRadius(r) {
  searchRadius = r;
  if (selectedBaseDataId) selectBaseData(selectedBaseDataId);
}

/**
 * マップのサイズを再計算（サイドバートグル時）
 */
function resizeMap() {
  if (map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }
}

/**
 * 検索半径内の対象データのマーカーを強調表示
 */
function highlightTargetsInRadius(targetIds) {
  // 既存の強調表示をリセット
  resetTargetHighlight();
  
  // 検索半径内の対象データを記録
  inRadiusTargets = targetIds;
  
  // 強調表示
  targetIds.forEach(id => {
    const marker = targetDataMarkers[id];
    if (marker) {
      marker.setStyle({
        radius: 10, 
        fillColor: "#00C060", 
        color: "#FFFFFF", 
        weight: 2, 
        fillOpacity: 0.9
      });
      marker.bringToFront();
    }
  });
}

/**
 * 対象データのマーカー強調表示をリセット
 */
function resetTargetHighlight() {
  inRadiusTargets.forEach(id => {
    const marker = targetDataMarkers[id];
    if (marker) {
      marker.setStyle({
        radius: 8, 
        fillColor: "#009140", 
        color: "#fff", 
        weight: 2, 
        fillOpacity: 0.8
      });
    }
  });
  inRadiusTargets = [];
  // 選択中の対象データも通常表示に戻す
  Object.keys(targetDataMarkers).forEach(id => {
    const marker = targetDataMarkers[id];
    if (marker && marker.options.fillColor === "#00E070") {
      marker.setStyle({
        radius: 8, 
        fillColor: "#009140", 
        color: "#fff", 
        weight: 2, 
        fillOpacity: 0.8
      });
    }
  });
}

/**
 * 特定の対象データマーカーを強調表示
 */
function highlightTargetMarker(targetId) {
  // いったん全ての選択を解除
  Object.keys(targetDataMarkers).forEach(id => {
    const marker = targetDataMarkers[id];
    if (marker && marker.options.fillColor === "#00E070") {
      if (inRadiusTargets.includes(id)) {
        // 範囲内なら範囲内スタイルに戻す
        marker.setStyle({
          radius: 10, 
          fillColor: "#00C060", 
          color: "#FFFFFF", 
          weight: 2, 
          fillOpacity: 0.9
        });
      } else {
        // 範囲外なら通常スタイルに戻す
        marker.setStyle({
          radius: 8, 
          fillColor: "#009140", 
          color: "#fff", 
          weight: 2, 
          fillOpacity: 0.8
        });
      }
    }
  });
  
  // 選択した対象データを強調表示
  const marker = targetDataMarkers[targetId];
  if (marker) {
    marker.setStyle({
      radius: 12, 
      fillColor: "#00E070", 
      color: "#FFFF00", 
      weight: 3, 
      fillOpacity: 1.0
    });
    marker.bringToFront();
    // マップの中心にパン
    const target = getTargetData().find(t => (t.id || t.name) === targetId);
    if (target) {
      map.panTo([target.lat, target.lng]);
    }
  }
  
  // 対応する対象データリストアイテムをアクティブに
  const targetItems = document.querySelectorAll('.target-item');
  targetItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.id === targetId) {
      item.classList.add('active');
      // スムーズスクロール
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}