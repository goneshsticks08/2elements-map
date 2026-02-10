/**
 * データ処理モジュール
 */

// データストア
let baseData = []; 
let targetData = []; 
let dataLoaded = false;
let prefectureMap = {};

/**
 * データの読み込みを行う
 */
async function loadData() {
  try {
    console.log('JSONファイルからデータ読み込みを開始します...');
    
    // 基準データの読み込み
    const baseResponse = await fetch('data/base-data.json');
    if (baseResponse.ok) {
        const baseDataJson = await baseResponse.json();
        baseData = baseDataJson.baseData || baseDataJson;
        processPrefectureData();
    }

    // 対象データの読み込み
    const targetResponse = await fetch('data/target-data.json');
    if (targetResponse.ok) {
        const targetDataJson = await targetResponse.json();
        targetData = targetDataJson.targetData || targetDataJson;
    }
    
    dataLoaded = true;
    console.log(`データ読み込み完了: 基準 ${baseData.length}件, 対象 ${targetData.length}件`);
return { baseData, targetData };
  } catch (error) {
    console.warn('JSONの読み込みに失敗しました（初回実行時など）。テキストインポートを試してください。');
    return { baseData, targetData };
  }
}

/**
 * テキストデータ（タブ区切り）をパースしてJSONに変換する
 */
function importTextData(baseText, targetText) {
  try {
    const parseTSV = (text) => {
      const lines = text.trim().split('\n');
      const header = lines[0].split('\t');
      return lines.slice(1).map(line => {
        const values = line.split('\t');
        const obj = {};
        header.forEach((h, i) => {
          let key = h.trim();
          // 地図表示用にキー名を統一
          if (key === 'latitude') key = 'lat';
          if (key === 'longitude') key = 'lng';
          if (key === 'ホテル名' || key === '店名称（漢字）') key = 'name';
          if (key === '住所') key = 'address';
          if (key === 'ホテル番号' || key === '店コード') key = 'id';
          
          let val = values[i] ? values[i].trim() : "";
          if (key === 'lat' || key === 'lng') val = parseFloat(val);
          obj[key] = val;
        });
        return obj;
      });
    };

    baseData = parseTSV(baseText);
    targetData = parseTSV(targetText);
    dataLoaded = true;
    // 都道府県情報を処理
    processPrefectureData();
    
    return true;
  } catch (error) {
    console.error('パースエラー:', error);
    return false;
  }
}

/**
 * 都道府県を住所から抽出する関数
 */
function extractPrefecture(address) {
  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県', 
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];
  
  for (const pref of prefectures) {
    if (address.includes(pref)) {
      return pref;
    }
  }
  return '不明';
}

/**
 * 特定の半径内にある店舗を検索する関数
 */
function findTargetsInRadius(baseLocation, radiusKm) {
  const targets = getTargetData();
  return targets.filter(target => {
    const distance = calculateDistance(
      baseLocation.lat, baseLocation.lng,
      target.lat, target.lng
    );
    return distance <= radiusKm;
  });
}

/**
 * 2点間の距離をkmで計算する関数
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球の半径（km）
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // kmでの距離
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

/**
 * 都道府県ごとのホテル情報を処理する
 */
function processPrefectureData() {
  prefectureMap = {};
  
  //各基準データを都道府県ごとに分類
  baseData.forEach(item => {
    const prefecture = extractPrefecture(item.address);
    if (!prefectureMap[prefecture]) {
      prefectureMap[prefecture] = [];
    }
    prefectureMap[prefecture].push(item);
  });
  
  // 都道府県選択ドロップダウンの更新
  updatePrefectureSelect();
}

/**
 * 都道府県選択ドロップダウンを更新
 */
function updatePrefectureSelect() {
  const select = document.getElementById('prefecture-select');
  if (!select) return;
  
  //既存のオプションをクリア（最初のオプションは保持）
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // 都道府県の地域別順序（北から南）
  const prefectureOrder = [
    "北海道", 
    "青森県", "秋田県", "岩手県", "宮城県", "山形県", "福島県", // 東北
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", // 関東
    "新潟県", "富山県", "石川県", "福井県", // 北陸
    "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", // 中部
    "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", // 近畿
    "鳥取県", "島根県", "岡山県", "広島県", "山口県", // 中国
    "徳島県", "香川県", "愛媛県", "高知県", // 四国
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県" // 九州・沖縄
  ];
  
  // プレフィックスマップが空でないか確認
  if (Object.keys(prefectureMap).length === 0) {
    console.log("都道府県マップが空です。データをインポートしてください。");
    return;
  }
  
  // 各都道府県をオプションとして追加（北から南の順）
  for (const pref of prefectureOrder) {
    if (prefectureMap[pref] && prefectureMap[pref].length > 0) {
      const count = prefectureMap[pref].length;
      const opt = document.createElement('option');
      opt.value = pref;
      opt.textContent = `${pref} (${count}件)`;
      select.appendChild(opt);
    }
  }
  // 地域順に含まれない都道府県がある場合（「不明」など）
  const otherPrefectures = Object.keys(prefectureMap).filter(pref => 
    !prefectureOrder.includes(pref) && pref !== "不明" && prefectureMap[pref].length > 0);
  
  if (otherPrefectures.length > 0) {
    otherPrefectures.sort().forEach(pref => {
      const count = prefectureMap[pref].length;
      const opt = document.createElement('option');
      opt.value = pref;
      opt.textContent = `${pref} (${count}件)`;
      select.appendChild(opt);
    });
  }
  
  console.log("都道府県リスト更新完了:", select.options.length, "件");
}

/**
 * 選択された都道府県に基づいて基準ドロップダウンを更新
 */
function updateBaseDataSelectByPrefecture(prefecture) {
  let items = [];
  
  if (prefecture) {
    // 指定された都道府県の基準データを取得
    items = prefectureMap[prefecture] || [];
  } else {
    //都道府県が指定されていない場合は全基準データを表示
    items = baseData;
  }
  
  const select = document.getElementById('base-data-select');
  if (!select) return;
  
  // 既存のオプションをクリア
  select.innerHTML = '<option value="">基準データを選択してください</option>';
  
  // 基準データをオプションとして追加
  items.forEach(item => {
    if (!item.id || !item.name) return;
    
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
  
  console.log("基準データリスト更新完了:", select.options.length - 1, "件");
}

/**
 * 都道府県のリストを取得
 */
function getPrefectures() {
  return Object.keys(prefectureMap).sort();
}

/**
 * 都道府県に対応するホテルのリストを取得
 */
function getBaseDataByPrefecture(prefecture) {
  return prefecture ? prefectureMap[prefecture] || [] : [];
}

/**
 * 基本的なデータアクセス関数
 */
function getBaseData() { return baseData; }
function getTargetData() { return targetData; }
function getBaseDataById(id) { return baseData.find(item => item.id === id) || null; }

/**
 *基準IDから対応する都道府県を取得
 */
function getPrefectureByBaseDataId(itemId) {
  const item = getBaseDataById(itemId);
  if (!item) return null;
  
  return extractPrefecture(item.address);
}