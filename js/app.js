// データ名の設定 - 初期値を空に
let baseDataName = "";
let targetDataName = "";

// 現在のモード（検索/エクスポート）
let currentMode = "search";

// 各モードの設定状態を保持するオブジェクト
let searchModeState = {
  prefecture: "",
  baseData: "",
  radius: 2.0
};

let exportModeState = {
  selectedPrefectures: [],
  radius: 2.0
};

let distanceCalcModeState = {
  prefecture: "",
  transport: "walk",
  time: 15,
  calculatedDistance: 0
};

// 都道府県の地域マップ
const regionPrefectures = {
  'hokkaido-tohoku': [
    "北海道", "青森県", "秋田県", "岩手県", "山形県", "宮城県", "福島県"
  ],
  'kanto': [
    "群馬県", "栃木県", "茨城県", "埼玉県", "千葉県", "東京都", "神奈川県"
  ],
  'chubu': [
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県"
  ],
  'kinki': [
    "三重県", "滋賀県", "京都府", "大阪府", "奈良県", "和歌山県", "兵庫県"
  ],
  'chugoku-shikoku': [
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "香川県", "徳島県", "高知県", "愛媛県"
  ],
  'kyushu': [
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
  ]
};

// 選択された都道府県リスト
let selectedPrefectures = [];

/**
 * データ名を設定
 */
function setDataNames(baseName, targetName) {
  baseDataName = baseName || "";
  targetDataName = targetName || "";
  //凡例の名前を更新
  const baseNameElement = document.getElementById('base-data-name');
  const targetNameElement = document.getElementById('target-data-name');
  if (baseNameElement) baseNameElement.textContent = baseDataName;
  if (targetNameElement) targetNameElement.textContent = targetDataName;
}

/**
 * メインアプリケーションロジック
 */

document.addEventListener('DOMContentLoaded', async function () {
  // データ名の初期設定
  setDataNames("データ未設定", "データ未設定");

  // 1. 地図の初期化
  initMap();

  // 2. データの読み込み試行
  await loadData();
  updateMarkers();

  // 3. イベントリスナー設定
  setupEventListeners();

  // 4. サイドバーの初期状態
  initSidebar();

  // 5. モードの初期設定
  switchMode("search");
});

/**
 * サイドバーの初期化
 */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');

  // LocalStorageから前回の状態を復元
  const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isSidebarCollapsed) {
    sidebar.classList.add('collapsed');
  }
}

// データ総数の更新関数
function updateDataSummary() {
  const baseTotal = document.getElementById('base-data-total');
  const targetTotal = document.getElementById('target-data-total');

  if (baseTotal && targetTotal) {
    const baseCount = getBaseData().length;
    const targetCount = getTargetData().length;

    baseTotal.textContent = `${baseCount}件`;
    targetTotal.textContent = `${targetCount}件`;
  }
}

function switchMode(mode) {
  // 現在のモードの状態を保存
  if (currentMode === "search") {
    // 検索モードの状態を保存（エラーチェック追加）
    const prefSelect = document.getElementById('prefecture-select');
    const baseDataSelect = document.getElementById('base-data-select');
    const radiusSlider = document.getElementById('radius-slider');
    searchModeState.prefecture = prefSelect ? prefSelect.value : "";
    searchModeState.baseData = baseDataSelect ? baseDataSelect.value : "";
    searchModeState.radius = radiusSlider ? parseFloat(radiusSlider.value) : 2.0;
  } else if (currentMode === "export") {
    // エクスポートモードの状態を保存（エラーチェック追加）
    const batchRadiusSlider = document.getElementById('batch-radius-slider');
    exportModeState.radius = batchRadiusSlider ? parseFloat(batchRadiusSlider.value) : 2.0;

    // 選択されている都道府県のチェックボックスから値を取得
    exportModeState.selectedPrefectures = [];
    const checkboxes = document.querySelectorAll('.prefecture-checkbox-input:checked');
    if (checkboxes) {
      checkboxes.forEach(checkbox => {
        exportModeState.selectedPrefectures.push(checkbox.value);
      });
    }
  } else if (currentMode === "distance-calc") {
    // 距離計算モードの状態を保存
    const prefSelect = document.getElementById('calc-prefecture');
    const transSelect = document.getElementById('calc-transport');
    const timeInput = document.getElementById('calc-time');
    const resultBox = document.getElementById('calc-result-distance');

    distanceCalcModeState.prefecture = prefSelect ? prefSelect.value : "";
    distanceCalcModeState.transport = transSelect ? transSelect.value : "walk";
    distanceCalcModeState.time = timeInput ? parseFloat(timeInput.value) : 15;
    distanceCalcModeState.calculatedDistance = resultBox && resultBox.textContent !== "--" ? parseFloat(resultBox.textContent) : 0;
  }

  // モードを切り替え
  currentMode = mode;

  // タブボタンのアクティブ状態を更新（nullチェック追加）
  const tabSearch = document.getElementById('tab-search');
  const tabExport = document.getElementById('tab-export');
  const tabPreparation = document.getElementById('tab-preparation');
  const tabDistanceCalc = document.getElementById('tab-distance-calc');

  if (tabSearch) tabSearch.classList.remove('active');
  if (tabExport) tabExport.classList.remove('active');
  if (tabPreparation) tabPreparation.classList.remove('active');
  if (tabDistanceCalc) tabDistanceCalc.classList.remove('active');

  if (mode === "search" && tabSearch) {
    tabSearch.classList.add('active');
  } else if (mode === "export" && tabExport) {
    tabExport.classList.add('active');
  } else if (mode === "preparation" && tabPreparation) {
    tabPreparation.classList.add('active');
  } else if (mode === "distance-calc" && tabDistanceCalc) {
    tabDistanceCalc.classList.add('active');
  }

  // コンテンツの表示/非表示を切り替え（nullチェック追加）
  const searchPanel = document.getElementById('search-panel');
  const exportPanel = document.getElementById('export-settings-panel');
  const prepPanel = document.getElementById('data-preparation-panel');
  const calcSidebar = document.getElementById('distance-calc-sidebar');
  const mapArea = document.getElementById('map-area');
  const exportArea = document.getElementById('export-area');
  const prepArea = document.getElementById('preparation-area');
  const calcArea = document.getElementById('distance-calc-area');

  if (searchPanel) searchPanel.style.display = mode === "search" ? 'block' : 'none';
  if (exportPanel) exportPanel.style.display = mode === "export" ? 'block' : 'none';
  if (prepPanel) prepPanel.style.display = mode === "preparation" ? 'block' : 'none';
  if (calcSidebar) calcSidebar.style.display = mode === "distance-calc" ? 'block' : 'none';

  if (mapArea) mapArea.style.display = mode === "search" ? 'block' : 'none';
  if (exportArea) exportArea.style.display = mode === "export" ? 'block' : 'none';
  if (prepArea) prepArea.style.display = mode === "preparation" ? 'block' : 'none';
  if (calcArea) calcArea.style.display = mode === "distance-calc" ? 'block' : 'none';

  // エクスポート機能の初期化（モードが変わったときのみ）
  if (mode === "export") {
    try {
      initExportMode();
      updateDataSummary();

      // エクスポートモードの設定を復元
      if (exportModeState.selectedPrefectures.length > 0) {
        // 半径スライダーの復元
        const batchRadiusSlider = document.getElementById('batch-radius-slider');
        const batchRadiusLabel = document.getElementById('batch-radius-label');
        if (batchRadiusSlider && batchRadiusLabel) {
          batchRadiusSlider.value = exportModeState.radius;
          batchRadiusLabel.textContent = `検索半径: ${exportModeState.radius}km`;
        }

        // 都道府県チェックボックスの復元
        setTimeout(() => {
          exportModeState.selectedPrefectures.forEach(prefecture => {
            const checkbox = document.getElementById(`pref-${prefecture}`);
            if (checkbox) checkbox.checked = true;
          });
          updateSelectedPrefectures(); // チェックボックス状態を反映
        }, 100); // 少し遅延させて実行（DOM要素の生成後）
      }
    } catch (e) {
      console.log("エクスポートモードの初期化中にエラーが発生しました:", e);
    }
  }
  // 以前の設定を復元
  if (mode === "search") {
    try {
      // 検索モードの設定を復元
      const prefSelect = document.getElementById('prefecture-select');
      if (prefSelect && searchModeState.prefecture) {
        prefSelect.value = searchModeState.prefecture;
        updateBaseDataSelectByPrefecture(searchModeState.prefecture);

        //基準データ選択の復元
        setTimeout(() => {
          const baseDataSelect = document.getElementById('base-data-select');
          if (baseDataSelect && searchModeState.baseData) {
            baseDataSelect.value = searchModeState.baseData;
            selectBaseData(searchModeState.baseData);
          }
        }, 100);
      }

      // 半径スライダーの復元
      const radiusSlider = document.getElementById('radius-slider');
      const radiusLabel = document.getElementById('radius-label');
      if (radiusSlider && radiusLabel) {
        radiusSlider.value = searchModeState.radius;
        radiusLabel.textContent = `検索半径: ${searchModeState.radius}km`; setRadius(searchModeState.radius);
      }

      resizeMap();
    } catch (e) {
      console.log("検索モードの設定復元中にエラーが発生しました:", e);
    }
  }

  // 距離計算モードの設定を復元
  if (mode === "distance-calc") {
    try {
      const prefSelect = document.getElementById('calc-prefecture');
      if (prefSelect && prefSelect.options.length <= 1) {
        initDistanceCalcMode(); // 初回のみ選択肢追加
      }

      if (distanceCalcModeState.prefecture) {
        if (prefSelect) prefSelect.value = distanceCalcModeState.prefecture;
      }
      const transSelect = document.getElementById('calc-transport');
      if (transSelect && distanceCalcModeState.transport) {
        transSelect.value = distanceCalcModeState.transport;
      }
      const timeInput = document.getElementById('calc-time');
      if (timeInput && distanceCalcModeState.time) {
        timeInput.value = distanceCalcModeState.time;
      }
      const resultBox = document.getElementById('calc-result-distance');
      const applyBtn = document.getElementById('btn-apply-radius');
      if (resultBox && distanceCalcModeState.calculatedDistance > 0) {
        resultBox.textContent = distanceCalcModeState.calculatedDistance;
        if (applyBtn) applyBtn.disabled = false;
      }

      resizeMap();
    } catch (e) {
      console.log("距離計算モードの設定復元中にエラーが発生しました:", e);
    }
  }

  console.log(`モードを ${mode} に切り替えました`);
}

/**
 * エクスポートモード初期化
 */
function initExportMode() {
  // 都道府県チェックボックスの生成
  Object.entries(regionPrefectures).forEach(([regionId, prefectures]) => {
    const regionElement = document.getElementById(`region-${regionId}`);
    if (!regionElement) return;

    regionElement.innerHTML = '';

    // 都道府県を一行で表示するコンテナ
    const prefContainer = document.createElement('div');
    prefContainer.className = 'prefecture-container';

    const availablePrefectures = prefectures.filter(prefecture => {
      const prefBaseData = getBaseDataByPrefecture(prefecture);
      return prefBaseData && prefBaseData.length > 0;
    });

    if (availablePrefectures.length > 0) {
      let prefRow = '';

      availablePrefectures.forEach((prefecture, index) => {
        const prefBaseData = getBaseDataByPrefecture(prefecture);
        if (prefBaseData && prefBaseData.length > 0) {
          prefRow += `
            <span class="prefecture-item">
              <input type="checkbox" id="pref-${prefecture}" value="${prefecture}" class="prefecture-checkbox-input">
              <label for="pref-${prefecture}">${prefecture} (${prefBaseData.length})</label>
            </span>
          `;

          // 区切り文字を追加（最後の都道府県以外）
          if (index < availablePrefectures.length - 1) {
            prefRow += ' / ';
          }
        }
      });

      prefContainer.innerHTML = prefRow;
      regionElement.appendChild(prefContainer);
    }
    // チェックボックスのイベントリスナーを設定
    regionElement.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', updateSelectedPrefectures);
    });
  });

  // 初期状態で都道府県データサマリーを更新
  updateSelectedPrefectures();
}

// 地域IDから表示名を取得
function getRegionName(regionId) {
  const regionNames = {
    'hokkaido-tohoku': '北海道・東北',
    'kanto': '関東',
    'chubu': '中部・北陸',
    'kinki': '近畿',
    'chugoku-shikoku': '中国・四国',
    'kyushu': '九州・沖縄'
  };
  return regionNames[regionId] || regionId;
}

/**
 *選択された都道府県を更新
 */
function updateSelectedPrefectures() {
  // チェックされた都道府県を収集
  const checkboxes = document.querySelectorAll('.prefecture-checkbox-input:checked');
  selectedPrefectures = Array.from(checkboxes).map(cb => cb.value);

  // データサマリーテーブルの更新
  const tableBody = document.querySelector('#prefecture-data-summary tbody');
  if (!tableBody) return; // tableBodyが存在しない場合は処理しない

  tableBody.innerHTML = '';

  if (selectedPrefectures.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" class="text-center">都道府県を選択してください</td>';
    tableBody.appendChild(tr);
    return;
  }

  let totalBaseData = 0;
  let totalTargetData = 0;

  // 選択された各都道府県のデータを表示
  selectedPrefectures.forEach(prefecture => {
    const baseData = getBaseDataByPrefecture(prefecture);
    const baseCount = baseData.length;

    //対象データの都道府県別カウント
    const targetData = getTargetData().filter(target => {
      return extractPrefecture(target.address) === prefecture;
    });
    const targetCount = targetData.length;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${prefecture}</td>
      <td>${baseCount}</td>
      <td>${targetCount}</td>
    `;
    tableBody.appendChild(tr);

    totalBaseData += baseCount;
    totalTargetData += targetCount;
  });

  // 合計行を追加
  const totalRow = document.createElement('tr');
  totalRow.className = 'table-active font-weight-bold';
  totalRow.innerHTML = `
    <td>合計</td>
    <td>${totalBaseData}</td>
    <td>${totalTargetData}</td>
  `;
  tableBody.appendChild(totalRow);
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  // 既存のタブ切り替え
  const tabSearch = document.getElementById('tab-search');
  const tabExport = document.getElementById('tab-export');
  const tabPreparation = document.getElementById('tab-preparation'); // 追加

  if (tabSearch) {
    tabSearch.addEventListener('click', () => switchMode('search'));
  }

  if (tabExport) {
    tabExport.addEventListener('click', () => switchMode('export'));
  }

  if (tabPreparation) { // 追加
    tabPreparation.addEventListener('click', () => switchMode('preparation'));
  }

  const tabDistanceCalc = document.getElementById('tab-distance-calc');
  if (tabDistanceCalc) {
    tabDistanceCalc.addEventListener('click', () => switchMode('distance-calc'));
  }

  // サイドバートグル
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }

  // 都道府県選択（検索モード）
  const prefectureSelect = document.getElementById('prefecture-select');
  if (prefectureSelect) {
    prefectureSelect.addEventListener('change', (e) => {
      const selectedPrefecture = e.target.value;
      updateBaseDataSelectByPrefecture(selectedPrefecture);
    });
  }

  // 都道府県選択（エクスポートモード）- 全選択/解除ボタン
  const selectAllBtn = document.getElementById('select-all-prefectures');
  const clearAllBtn = document.getElementById('clear-all-prefectures');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () {
      const checkboxes = document.querySelectorAll('.prefecture-checkbox-input');
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
      updateSelectedPrefectures();
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function () {
      const checkboxes = document.querySelectorAll('.prefecture-checkbox-input');
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      updateSelectedPrefectures();
    });
  }
  // 基準データ選択ドロップダウン
  const baseDataSelect = document.getElementById('base-data-select');
  if (baseDataSelect) {
    baseDataSelect.addEventListener('change', (e) => {
      selectBaseData(e.target.value);
    });
  }

  // 半径スライダー（検索モード）
  const radiusSlider = document.getElementById('radius-slider');
  const radiusLabel = document.getElementById('radius-label');
  if (radiusSlider && radiusLabel) {
    radiusSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      radiusLabel.textContent = `検索半径: ${val}km`;
      setRadius(parseFloat(val));
    });
  }

  // 半径スライダー（エクスポートモード）
  const batchRadiusSlider = document.getElementById('batch-radius-slider');
  const batchRadiusLabel = document.getElementById('batch-radius-label');
  if (batchRadiusSlider && batchRadiusLabel) {
    batchRadiusSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      batchRadiusLabel.textContent = `検索半径: ${val}km`;
    });
  }

  // インポートボタン
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn && typeof $ !== 'undefined') {
    $('#importDataBtn').on('click', function () {
      const baseText = $('#baseTextInput').val();
      const targetText = $('#targetTextInput').val();

      // データ名を取得
      const baseName = $('#baseDataName').val();
      const targetName = $('#targetDataName').val();

      // データ名を設定
      setDataNames(baseName, targetName);

      if (importTextData(baseText, targetText)) {
        updateMarkers();
        $('#importModal').modal('hide');
        alert('インポートが完了しました。都道府県と基準データを選択してください。');

        // エクスポートモードの場合はホテルリストを更新
        if (currentMode === "export") {
          initExportMode();
        }
      } else {
        alert('データのパースに失敗しました。形式を確認してください。');
      }
    });
  }

  // 分析レポート出力ボタン
  const exportReportBtn = document.getElementById('export-report-btn');
  if (exportReportBtn) {
    exportReportBtn.addEventListener('click', () => {
      const baseDataSelect = document.getElementById('base-data-select');
      if (baseDataSelect) {
        const selectedBaseDataId = baseDataSelect.value;
        const baseData = getBaseDataById(selectedBaseDataId);
        if (baseData) {
          showPrintableReport(baseData);
        } else {
          alert('基準データが選択されていません。分析対象を選択してください。');
        }
      }
    });
  }

  // 一括レポート生成ボタン
  const generateExportBtn = document.getElementById('generate-export-report');
  if (generateExportBtn) {
    generateExportBtn.addEventListener('click', generateBatchReport);
  }

  // データ準備パネルのステップナビゲーション
  try {
    const stepItems = document.querySelectorAll('.step-item');
    if (stepItems && stepItems.length > 0) {
      stepItems.forEach(item => {
        if (item) {
          item.addEventListener('click', function () {
            try {
              // アクティブステップの切り替え
              const allSteps = document.querySelectorAll('.step-item');
              if (allSteps && allSteps.length > 0) {
                allSteps.forEach(step => {
                  if (step) step.classList.remove('active');
                });
              }

              this.classList.add('active');

              // 対応するコンテンツを表示
              const stepNumber = this.getAttribute('data-step');
              if (stepNumber) {
                const allContents = document.querySelectorAll('.step-content');
                if (allContents && allContents.length > 0) {
                  allContents.forEach(content => {
                    if (content) content.classList.remove('active');
                  });
                }

                const targetContent = document.getElementById(`step-${stepNumber}`);
                if (targetContent) {
                  targetContent.classList.add('active');
                }
              }
            } catch (e) {
              console.error("ステップ切替処理でエラーが発生しました:", e);
            }
          });
        }
      });
    } else {
      console.log("ステップナビゲーション要素が見つかりません");
    }
  } catch (e) {
    console.error("ステップナビゲーションの初期化中にエラーが発生しました:", e);
  }
}

/**
 *一括レポート生成
 */
function generateBatchReport() {
  // 選択された都道府県と検索半径を取得
  if (selectedPrefectures.length === 0) {
    alert('都道府県を選択してください。');
    return;
  }

  // 選択された都道府県の基準データを収集
  let baseDataList = [];
  selectedPrefectures.forEach(pref => {
    const prefBaseData = getBaseDataByPrefecture(pref);
    baseDataList = baseDataList.concat(prefBaseData);
  });

  if (baseDataList.length === 0) {
    alert('選択された都道府県に基準データがありません。');
    return;
  }

  const radius = parseFloat(document.getElementById('batch-radius-slider').value);
  // 一括レポート生成
  generateBatchExportReport(baseDataList, radius);
}

/**
 * サイドバーの開閉切り替え
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');

  // 状態をLocalStorageに保存
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('sidebarCollapsed', isCollapsed);

  // マップのサイズを再計算（検索モードの場合）
  if (currentMode === "search" || currentMode === "distance-calc") {
    resizeMap();
  }
}

/**
 * 距離計算モードの初期化とロジック
 */
function initDistanceCalcMode() {
  const prefSelect = document.getElementById('calc-prefecture');

  // 全都道府県をプルダウンに追加
  if (prefSelect && prefSelect.options.length <= 1) {
    const prefectures = [
      "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
      "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
      "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県",
      "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
      "鳥取県", "島根県", "岡山県", "広島県", "山口県",
      "徳島県", "香川県", "愛媛県", "高知県",
      "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
    ];

    prefectures.forEach(pref => {
      const option = document.createElement('option');
      option.value = pref;
      option.textContent = pref;
      prefSelect.appendChild(option);
    });
  }

  // 計算ボタンのイベントリスナー
  const calcBtn = document.getElementById('btn-calculate-distance');
  if (calcBtn) {
    calcBtn.addEventListener('click', calculateDistance);
  }

  // 適用ボタンのイベントリスナー
  const applyBtn = document.getElementById('btn-apply-radius');
  if (applyBtn) {
    applyBtn.addEventListener('click', applyCalculatedRadius);
  }
}

function calculateDistance() {
  const pref = document.getElementById('calc-prefecture').value;
  const transport = document.getElementById('calc-transport').value;
  const time = parseFloat(document.getElementById('calc-time').value);

  if (!pref) {
    alert("都道府県を選択してください。");
    return;
  }
  if (!time || time <= 0) {
    alert("所要時間を正しく入力してください。");
    return;
  }

  // 速度の設定 (km/h)
  const speeds = {
    "walk": 4,
    "bicycle": 15,
    "car": 30,
    "train": 35
  };
  const speed = speeds[transport];

  // 迂回率の設定
  let detourRate = 1.3; // デフォルト (地方都市型)

  const superUrban = ["東京都", "大阪府"];
  const urban = ["神奈川県", "埼玉県", "千葉県", "愛知県", "京都府", "兵庫県", "福岡県"];
  const rural = [
    "青森県", "岩手県", "秋田県", "山形県", "福島県", "新潟県", "富山県", "石川県", "福井県",
    "和歌山県", "鳥取県", "島根県", "徳島県", "愛媛県", "高知県", "長崎県", "大分県", "宮崎県", "鹿児島県"
  ];

  if (superUrban.includes(pref) || pref === "北海道") {
    detourRate = 1.2;
  } else if (urban.includes(pref)) {
    detourRate = 1.25;
  } else if (rural.includes(pref)) {
    detourRate = 1.5;
  }

  // 距離計算: (時速 * (分 / 60)) / 迂回率
  const rawDistance = (speed * (time / 60)) / detourRate;
  const roundedDistance = Math.round(rawDistance * 100) / 100; // 小数第2位に丸める

  document.getElementById('calc-result-distance').textContent = roundedDistance;
  document.getElementById('btn-apply-radius').disabled = false;

  // 状態を更新
  distanceCalcModeState.calculatedDistance = roundedDistance;
}

function applyCalculatedRadius() {
  const resultBox = document.getElementById('calc-result-distance');
  if (resultBox.textContent !== "--") {
    const dist = parseFloat(resultBox.textContent);

    // 検索モードの状態変数に直接値をセットする
    searchModeState.radius = dist;

    // 検索モードに切り替え（switchMode内で自動的にスライダーとマップ半径が適用されます）
    switchMode('search');
  }
}