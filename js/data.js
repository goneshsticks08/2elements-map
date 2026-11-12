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
// 見出し名の別名（比較時は前後空白を除去し、英字は小文字・括弧は半角に揃える）
const HEADER_ALIASES = {
  id: ['ホテル番号', '店コード', '店舗コード', 'コード', '番号', 'id', 'no', 'no.'],
  name: ['ホテル名', '店名称(漢字)', '店舗名', '店名', '名称', '名前', 'name'],
  address: ['住所', '所在地', 'address'],
  lat: ['latitude', 'lat', '緯度'],
  lng: ['longitude', 'lng', 'lon', '経度']
};

// 直近のインポート失敗理由（画面表示用）
let lastImportError = '';

function normalizeHeader(h) {
  return h.replace(/^﻿/, '').trim().toLowerCase()
    .replace(/（/g, '(').replace(/）/g, ')');
}

function resolveHeaderKey(h) {
  const n = normalizeHeader(h);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(n)) return key;
  }
  return h.trim();
}

/**
 * タブ区切りテキストをパースする
 * @param {string} text - 1行目が見出しのタブ区切りテキスト
 * @param {string} label - エラーメッセージ用のデータ名
 */
function parseTSV(text, label) {
  const lines = (text || '').split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error(`${label}：見出し行とデータ行が必要です`);
  }

  const keys = lines[0].split('\t').map(resolveHeaderKey);
  const missing = [];
  if (!keys.includes('name')) missing.push('店舗名（例：店舗名・ホテル名）');
  if (!keys.includes('lat')) missing.push('緯度（例：緯度・latitude）');
  if (!keys.includes('lng')) missing.push('経度（例：経度・longitude）');
  if (missing.length > 0) {
    throw new Error(`${label}：次の列の見出しが見つかりません\n・${missing.join('\n・')}\n（タブ区切りで貼り付けているかも確認してください）`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = line.split('\t');
    const obj = {};
    keys.forEach((key, i) => {
      let val = values[i] ? values[i].trim() : "";
      if (key === 'lat' || key === 'lng') val = parseFloat(val);
      obj[key] = val;
    });
    // ID列がない・空欄の行は連番を振る
    if (!obj.id) obj.id = `${rowIndex + 1}`;
    obj.id = String(obj.id);
    if (obj.address === undefined) obj.address = '';
    return obj;
  });
}

function importTextData(baseText, targetText) {
  lastImportError = '';
  try {
    baseData = parseTSV(baseText, '基準データ');
    targetData = parseTSV(targetText, '対象データ');
    dataLoaded = true;
    // 都道府県情報を処理
    processPrefectureData();

    // 都道府県を「すべて」に戻し、基準データの選択肢を全件で作成
    const prefSelect = document.getElementById('prefecture-select');
    if (prefSelect) prefSelect.value = '';
    updateBaseDataSelectByPrefecture('');

    return true;
  } catch (error) {
    console.error('パースエラー:', error);
    lastImportError = error.message;
    return false;
  }
}

function getLastImportError() { return lastImportError; }

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
  
  if (!address) return '不明';
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
 * 都道府県別に、基準データ数と「検索半径内にある対象データ数（重複なし）」を集計する
 * - 対象データは、その都道府県の基準データのいずれかの半径内に入るものを1件と数える
 * - 県境で2県の基準データの半径に入る対象データは、各県で1件ずつ数える
 * - 合計の対象データ数は、全都道府県を通して重複を除いた件数
 * @param {string[]} prefectures - 集計する都道府県（この順で返す）
 * @param {number} radiusKm - 検索半径（km）
 * @returns {{rows: {prefecture: string, baseCount: number, targetCount: number}[], totalBase: number, totalTarget: number}}
 */
function aggregateByPrefecture(prefectures, radiusKm) {
  const allTargetsInRadius = new Set();
  let totalBase = 0;

  const rows = prefectures.map(prefecture => {
    const bases = getBaseDataByPrefecture(prefecture);
    const targetsInRadius = new Set();
    bases.forEach(base => {
      findTargetsInRadius(base, radiusKm).forEach(target => {
        targetsInRadius.add(target);
        allTargetsInRadius.add(target);
      });
    });
    totalBase += bases.length;
    return { prefecture, baseCount: bases.length, targetCount: targetsInRadius.size };
  });

  return { rows, totalBase, totalTarget: allTargetsInRadius.size };
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