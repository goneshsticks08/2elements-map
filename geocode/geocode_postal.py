import pandas as pd
import requests
import time
from urllib.parse import quote
import os
import re


class HeartRailsGeoAPI:
    """HeartRails Geo API（郵便番号検索版）"""
    
    def __init__(self, debug=False):
        self.name = "HeartRails Geo API"
        self.base_url = "https://geoapi.heartrails.com/api/json"
        self.success_count = 0
        self.fail_count = 0
        self.debug = debug
    
    def extract_postal_code(self, address):
        """住所から郵便番号を抽出"""
        # 郵便番号のパターン: 123-4567 または 1234567
        patterns = [
            r'(\d{3})-(\d{4})',  # 123-4567
            r'(\d{7})',           # 1234567
            r'〒(\d{3})-(\d{4})', # 〒123-4567
            r'〒(\d{7})',         # 〒1234567
        ]
        
        for pattern in patterns:
            match = re.search(pattern, address)
            if match:
                if len(match.groups()) == 2:
                    # ハイフンありの場合
                    return match.group(1) + match.group(2)
                else:
                    # ハイフンなしの場合
                    return match.group(1)
        
        return None
    
    def geocode_by_postal(self, postal_code):
        """
        郵便番号から座標を取得
        
        Parameters:
        -----------
        postal_code : str
            郵便番号（7桁）
        
        Returns:
        --------
        dict or None
            成功時: {'latitude': float, 'longitude': float, 'matched_address': str}
            失敗時: None
        """
        try:
            # APIリクエスト
            url = f"{self.base_url}?method=searchByPostal&postal={postal_code}"
            
            if self.debug:
                print(f"  リクエストURL: {url}")
            
            response = requests.get(url, timeout=10)
            
            if self.debug:
                print(f"  ステータスコード: {response.status_code}")
                print(f"  レスポンス: {response.text[:300]}")
            
            if response.status_code == 200:
                data = response.json()
                
                # レスポンスの確認
                if data.get('response') and data['response'].get('location'):
                    locations = data['response']['location']
                    if len(locations) > 0:
                        loc = locations[0]
                        
                        if self.debug:
                            print(f"  ✓ マッチ成功!")
                            print(f"    緯度: {loc.get('y')}")
                            print(f"    経度: {loc.get('x')}")
                        
                        self.success_count += 1
                        return {
                            'latitude': float(loc.get('y', 0)),
                            'longitude': float(loc.get('x', 0)),
                            'matched_address': loc.get('prefecture', '') + loc.get('city', '') + loc.get('town', ''),
                            'postal_code': postal_code
                        }
            
            self.fail_count += 1
            return None
            
        except Exception as e:
            if self.debug:
                print(f"    エラー: {e}")
            self.fail_count += 1
            return None
    
    def geocode(self, address):
        """
        住所から座標を取得
        住所から郵便番号を抽出し、それを使って座標を取得
        
        Returns:
        --------
        dict or None
            成功時: {'latitude': float, 'longitude': float, 'matched_address': str, 'postal_code': str}
            失敗時: None
        """
        # 郵便番号を抽出
        postal_code = self.extract_postal_code(address)
        
        if self.debug:
            print(f"  抽出された郵便番号: {postal_code}")
        
        if not postal_code:
            if self.debug:
                print(f"  ✗ 郵便番号が見つかりません")
            self.fail_count += 1
            return None
        
        # 郵便番号で座標を取得
        return self.geocode_by_postal(postal_code)


def load_addresses_from_file(filepath):
    """TXTまたはCSVファイルから住所データを読み込む"""
    file_ext = os.path.splitext(filepath)[1].lower()
    
    if file_ext == '.txt':
        print(f"TXTファイルを読み込んでいます: {filepath}")
        addresses = []
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line:
                    addresses.append(line)
        
        if not addresses:
            raise ValueError("TXTファイルに住所データが見つかりません")
        
        df = pd.DataFrame({'address': addresses})
        print(f"合計 {len(df)}件の住所を読み込みました")
        
    elif file_ext == '.csv':
        print(f"CSVファイルを読み込んでいます: {filepath}")
        encodings = ['utf-8-sig', 'utf-8', 'shift_jis', 'cp932']
        df = None
        
        for encoding in encodings:
            try:
                df = pd.read_csv(filepath, encoding=encoding)
                print(f"  エンコーディング: {encoding} で読み込み成功")
                break
            except:
                continue
        
        if df is None:
            raise ValueError("CSVファイルの読み込みに失敗しました")
        
        if 'address' not in df.columns:
            raise ValueError(f"CSVファイルに'address'カラムが必要です。現在のカラム: {list(df.columns)}")
        
        print(f"合計 {len(df)}件の住所を読み込みました")
        
    else:
        raise ValueError(f"サポートされていないファイル形式です: {file_ext}")
    
    return df


def geocode_addresses(input_file, output_csv='output_with_coords.csv', rate_limit=1.0, debug_mode=False, max_items=None):
    """住所データに座標を付与"""
    df_input = load_addresses_from_file(input_file)
    
    print(f"\n{'='*60}")
    print(f"{len(df_input)}件の住所をジオコーディングしています...")
    print(f"APIリクエスト間隔: {rate_limit}秒")
    
    # デバッグモードまたはmax_items指定の場合
    if max_items:
        print(f"⚠️ 最初の{max_items}件のみ処理します")
        df_input = df_input.head(max_items)
    
    api = HeartRailsGeoAPI(debug=debug_mode)
    print(f"使用するAPI: {api.name}")
    print(f"{'='*60}\n")
    
    # 結果格納用のカラムを初期化
    df_input['latitude'] = None
    df_input['longitude'] = None
    df_input['matched_address'] = None
    df_input['postal_code'] = None
    df_input['api_used'] = None
    
    start_time = time.time()
    
    for idx, row in df_input.iterrows():
        address = row['address']
        
        if pd.isna(address) or not address:
            print(f"[{idx+1}] 住所が空です。スキップします。")
            continue
        
        print(f"[{idx+1}/{len(df_input)}] 処理中: {address}")
        
        result = api.geocode(address)
        
        if result:
            df_input.at[idx, 'latitude'] = result['latitude']
            df_input.at[idx, 'longitude'] = result['longitude']
            df_input.at[idx, 'matched_address'] = result['matched_address']
            df_input.at[idx, 'postal_code'] = result.get('postal_code', '')
            df_input.at[idx, 'api_used'] = api.name
            print(f"  ✓ 成功: 郵便番号={result.get('postal_code')}, 緯度={result['latitude']}, 経度={result['longitude']}")
        else:
            print(f"  ✗ 失敗: 住所に郵便番号が含まれていません")
        
        if idx < len(df_input) - 1:
            time.sleep(rate_limit)
    
    df_input.to_csv(output_csv, index=False, encoding='utf-8-sig')
    
    total_time = time.time() - start_time
    total_matched = df_input['latitude'].notna().sum()
    
    print(f"\n{'='*60}")
    print("処理完了!")
    print(f"{'='*60}")
    print(f"\n総件数: {len(df_input)}")
    print(f"マッチ成功: {total_matched} 件 ({total_matched/len(df_input)*100:.1f}%)")
    print(f"マッチ失敗: {len(df_input) - total_matched} 件")
    print(f"処理時間: {total_time/60:.1f}分")
    print(f"\n結果を {output_csv} に保存しました")
    
    unmatched = df_input[df_input['latitude'].isna()]
    if len(unmatched) > 0:
        print(f"\n以下の {len(unmatched)} 件の住所はマッチしませんでした:")
        print("（住所に郵便番号が含まれていない可能性があります）")
        for idx, row in unmatched.head(10).iterrows():
            print(f"  - {row['address']}")
        if len(unmatched) > 10:
            print(f"  ... 他 {len(unmatched) - 10} 件")
    
    return df_input


def main():
    """メイン処理"""
    print("=" * 60)
    print("HeartRails Geo API 住所ジオコーディング（郵便番号版）")
    print("=" * 60)
    
    RATE_LIMIT = 0.5
    OUTPUT_CSV = './output_with_coords.csv'
    DEBUG_MODE = False
    MAX_ITEMS = None  # 最初の3件のみ処理（None で全件処理）
    
    input_file = None
    if os.path.exists('./input.txt'):
        input_file = './input.txt'
    elif os.path.exists('./input.csv'):
        input_file = './input.csv'
    
    if not input_file:
        print(f"\nエラー: 入力ファイルが見つかりません")
        print("\nサンプルファイルを作成します...")
        
        with open('./input.txt', 'w', encoding='utf-8') as f:
            f.write("〒100-0013 東京都千代田区霞が関1-2-1\n")
            f.write("大阪府大阪市北区梅田1-1-3 530-0001\n")
            f.write("060-0001 北海道札幌市中央区北1条西2丁目\n")
        
        print("input.txt にサンプルデータを作成しました")
        print("\n⚠️ 重要: 住所に郵便番号が含まれている必要があります")
        print("例:")
        print("  ○ 〒100-0013 東京都千代田区霞が関1-2-1")
        print("  ○ 東京都千代田区霞が関1-2-1 100-0013")
        print("  ○ 1000013 東京都千代田区霞が関1-2-1")
        return
    
    try:
        print(f"\n入力ファイル: {input_file}")
        
        if MAX_ITEMS:
            print(f"\n⚠️ テストモード: 最初の{MAX_ITEMS}件のみ処理します")
            print("全件処理する場合は、スクリプト内の MAX_ITEMS = None に変更してください。\n")
        
        result = geocode_addresses(input_file, OUTPUT_CSV, RATE_LIMIT, DEBUG_MODE, MAX_ITEMS)
        
        print("\n" + "=" * 60)
        print("【重要】利用規約について")
        print("=" * 60)
        print("\nHeartRails Geo APIを使用する場合、以下のクレジット表記が必要です:")
        print('  出典：「位置参照情報ダウンロードサービス」（国土交通省）を加工して作成')
        print("\n詳細: https://geoapi.heartrails.com/")
        
    except Exception as e:
        print(f"\nエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()