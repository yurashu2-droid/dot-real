# dot-real

**現実に、ドットを。**

ブラウザのカメラで選んだ物体だけをドット絵風に加工する、ローカル処理型のWeb MVPです。

## できること

- **タップで選ぶ**：MediaPipe MagicTouchで1つの物体を切り抜き、緩やかな動きに追従。
- **枠で選ぶ**：AIなしでドラッグした四角い領域を加工・追従。物体の輪郭をAIで切り抜くモードではありません。
- **カメラなしデモ**：合成した動くロケットを選択。初回だけ既知の輪郭を使い、その後は本番と同じ画像追跡・描画を実行します。AI動作の代用テストではありません。
- COLOR / POCKET / MONO / CANDYの4パレット、ドットの粗さ、輪郭、元映像との比較、PNG保存。
- 対象の選び直し、カメラ切替、停止。非表示タブやページ離脱でもカメラとWorkerを停止。

## すぐ動かす

Node.js **22以上**。アプリのビルド用npm依存はありません。`npm install`やAPIキーは不要です。

```sh
git clone https://github.com/yurashu2-droid/dot-real.git
cd dot-real
git switch feat/browser-mvp  # このPRがmainに入るまでは作業ブランチを使用
npm run dev
```

`http://127.0.0.1:5173` を開きます。まず「カメラなしでデモを試す」で試せます。

カメラを開始するとAIの実行環境・モデルを取得します。読み込み完了後、対象の中央をタップしてください。ネットワーク制限などで取得できない場合は「枠で選ぶ」に切り替えられます。マイクは取得しません。

**スマホから試すにはHTTPSでの配信が必要です。** PCのLANアドレスをHTTPで開くだけでは、通常カメラを利用できません。新しいSafari / Chromeが対象ですが、特定の端末での動作やfpsは保証していません。ページをホーム画面に追加する必要はありません。

## 静的サイトとして公開

```sh
npm run build       # dist/ に生成
npm run preview     # http://127.0.0.1:4173
```

`dist/` をHTTPS対応の静的ホスティングへ置けます。相対パスなので、GitHub Pagesの `/dot-real/` のようなサブディレクトリにも対応しています。

GitHub Pages用の手動ワークフローを同梱しています。

1. PRをmainへマージする。
2. リポジトリの **Settings → Pages → Build and deployment → Source = GitHub Actions** に設定する。
3. **Actions → Publish GitHub Pages → Run workflow** を実行する。

ワークフローはAI資材も同一サイトに配置します。GitHub側のPages設定や公開先の作成は、ソースを置くだけでは自動で完了しません。公開完了URLはワークフローのEnvironmentに表示されます。

### AI資材も自分のサイトから配信する

```sh
npm run vendor      # 初回は外部ネットワークが必要
npm run build
```

`assets/vendor/` に固定バージョンのJS/WASM/モデル、MediaPipeのLICENSE、取得元・サイズ・SHA256を保存します。すべての取得が成功した場合だけmanifestを公開します。大きなバイナリはgit管理対象外です。未配置なら固定CDN URLから読み込みます。

- MediaPipe Tasks Vision: **0.10.21**（JSとWASMは同じバージョン）
- MagicTouch: **float32 / version 1**
- 現在のMediaPipeドキュメントにあるv2のstroke APIと混在させないでください。このコードはv0.10.21のkeypoint APIを使用します。
- 配布前に [第三者ライセンス・モデルについて](THIRD_PARTY_NOTICES.md) を確認してください。取得したSHAは記録であり、別途認証された署名ではありません。

## 実装の構成

```text
getUserMedia / 合成デモ
  → 長辺480px以下に縮小
  → 1フレームずつ専用Workerへ
  → MagicTouchのマスク / 明示的な四角形
  → 画像特徴のパッチ照合 + 変換推定 + 輪郭の移動
  → AIモードのみ、定期的に輪郭を再取得・整合性チェック
  → 固定パレット + ドット化 + 輪郭
  → 処理したフレームと対応するマスクを同時に表示
```

`src/core/` は座標・マスク・パレット・追跡、`src/vision/` はAIとWorker通信、`src/camera.js` はカメラの後処理、`src/ui/` は描画を担当します。フレームを積み上げず、解除・対象変更・停止のあとに古い非同期結果が復活しないようにしています。SAM2、OpenCV.js、WebGPU、ARKitは使用していません。

## テスト

```sh
npm test
npm run build

# ブラウザ受入テスト（合成画像、AIなし）
python -m pip install playwright==1.55.0
python -m playwright install chromium
npm run dev
# 別ターミナルで
python tests/browser_smoke.py

# 実際のAIモデル読込・推論（モデルのモックではありません）
npm run vendor
python tests/ai_smoke.py
```

GitHub Actionsの **Verify MVP** は単体テスト、静的ビルド、ブラウザ操作、実AIモデルの初期化・推論を分けて実行します。画像やJSONの結果は `verification-evidence` artifactへ保存します。どこまで実行済みかは [検証記録](docs/verification.md) を参照してください。

## MVPの限界

これはリアルタイムの2D映像加工であり、現実空間に3Dオブジェクトを固定するARではありません。低解像度化・減色によるドット絵風の表現で、毎フレームAIが新しい絵を生成する方式でもありません。

追跡は模様が見える物体の緩やかな移動向けです。高速移動、大きな回転、白一色・反射面、暗所、細い毛・透明物、遮蔽は苦手です。画面外や完全に隠れた対象を自動で同定し直しません。見失ったら効果を解除して再選択を案内しますが、似た模様への誤追従を完全に防ぐ保証はありません。

処理は長辺480px、更新上限20回/秒の設計です。これは**上限設定であって達成fpsの保証ではありません**。AI推論中は処理済みフレームの更新が止まることがあります。保存画像もこの処理解像度です。

映像・写真は外部へ送信しません。ただし標準設定ではAI資材をjsDelivr/Googleから取得するので、IPアドレス等の通常のアクセス情報は配信元へ届きます。サーバーGPU料金は発生しない設計ですが、静的配信の転送量やホスティング料金は契約先によります。
