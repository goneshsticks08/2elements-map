/**
 * 分析モジュール
 */

// 距離を計算するためのハーバーサイン公式
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球の半径(km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // 距離 (km)
  return d;
}

// 方角を計算する関数（北を0°とした時計回りの角度）
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360; // 0〜360度に正規化
  
  return bearing;
}

// 分析データを生成する
function analyzeData() {
  const baseData = getBaseDataById(selectedBaseDataId);
  if (!baseData) return;
  
  const targetDataList = getTargetData();
  const radius = searchRadius; // km
  
  // 半径内の対象データを抽出し、距離を計算
  const targetsInRadius = [];
  const targetIds = [];
  
  targetDataList.forEach(target => {
    if (!target.lat || !target.lng) return;
    
    const distance = calculateDistance(baseData.lat, baseData.lng, target.lat, target.lng);
    if (distance <= radius) {
      targetsInRadius.push({
        id: target.id || target.name,
        name: target.name,
        distance: distance,
        bearing: calculateBearing(baseData.lat, baseData.lng, target.lat, target.lng)
      });
      targetIds.push(target.id || target.name);
    }
  });
  
  // 距離順にソート
  targetsInRadius.sort((a, b) => a.distance - b.distance);
  
  // 対象データ数の表示
  document.getElementById('target-count').textContent = `${targetsInRadius.length}件`;
  
  // 対象データリストの表示
  const targetList = document.getElementById('target-data-list');
  if (!targetList) return; // 要素が存在しない場合は処理終了
  
  targetList.innerHTML = '';
  
  if (targetsInRadius.length === 0) {
    targetList.innerHTML = '<div class="p-3text-center text-muted">範囲内に対象データがありません</div>';
  } else {
    targetsInRadius.forEach(target => {
      const targetItem = document.createElement('div');
      targetItem.className = 'target-item';
      targetItem.dataset.id = target.id;
      
      // 距離を小数点第1位までに丸める
      const formattedDistance = target.distance.toFixed(1);
      
      targetItem.innerHTML = `
        <div class="target-name">${targetDataName} ${target.name}</div>
        <div class="target-distance">${formattedDistance}km</div>
      `;
      
      // クリックイベント追加
      targetItem.addEventListener('click', () => {
        // すべての対象データアイテムから'active' クラスを削除
        document.querySelectorAll('.target-item').forEach(item => {
          item.classList.remove('active');
        });
        
        // クリックした対象データアイテムに 'active' クラスを追加
        targetItem.classList.add('active');
        
        // 対応するマーカーを強調表示
        highlightTargetMarker(target.id);
        
        // マップの中心をその対象データに移動
        const targetItem = targetDataList.find(t => (t.id || t.name) === target.id);
        if (targetItem && map) {
          map.panTo([targetItem.lat, targetItem.lng]);
        }
      });
      
      targetList.appendChild(targetItem);
    });
  }
  // 検索半径内の対象データマーカーを強調表示
  highlightTargetsInRadius(targetIds);
  console.log("分析完了: " + targetsInRadius.length + "件の情報を表示しました");
}