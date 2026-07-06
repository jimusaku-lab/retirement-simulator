# 過去実績マーケットリターン・バックテスト Phase 5 QA・公開前仕上げ 作業報告

作成日: 2026-07-06

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `docs/finance/work-report-historical-market-return-phase5-qa-release-2026-07-06.md`

## 実装内容

Phase 5 は新機能追加ではなく、QA・性能確認・公開前仕上げとして実施した。

- マニュアルに「運用リターン設定と過去市場検証」を追加した。
- 固定年率、過去実績・単一期間、過去実績・範囲検証の使い分けを記載した。
- 60歳から90歳は約360か月、40年検証は約480か月の過去データが必要であることを記載した。
- データ不足分を平均リターンなどで補完せず、検証対象から除外することを記載した。
- 指数リターンのみ、円換算リターン、USD/JPY変化率の計算式を記載した。
- 現金、普通預金、定期預金には為替変動を掛けないことを記載した。
- 過去市場だった場合の検証であり、将来予測や将来保証ではないことを明記した。
- データ出典、対象期間、最終データ年月をマニュアル上で確認できるようにした。

計算ロジックは Phase 5 では変更していない。

## QA結果

### 固定年率モード

- `returnModel` 未設定時は固定年率モードとして扱われる既存テストを確認した。
- 既存シナリオを勝手に過去実績モードへ変換しない仕様を維持している。

### 過去実績・単一期間

- S&P500、NASDAQ100、S&P500/米国債券配分、資産別に固定年率と過去実績を混在するケースのテストを確認した。
- 定期預金は過去実績モードでも固定年率のまま計算されるテストを確認した。

### 円換算リターン

- 円換算式 `(1 + ドル建て指数リターン) * (1 + USD/JPY変化率) - 1` のテストを確認した。
- 資産配分では、ドル建て加重平均後に USD/JPY 変化率を掛けるテストを確認した。
- USD/JPY データ不足月は補完せず不足扱いにするテストを確認した。

### 範囲検証

- 必要月数に足りない開始月は平均リターンで補完せず除外するテストを確認した。
- 円換算リターンでは USD/JPY データ不足の開始月を範囲検証から除外するテストを確認した。
- UI上では通常タブ移動では自動実行せず、詳細を開いて「検証する」を押した時だけ複数試算を実行する表示・導線を確認した。

### ローカル版・公開版の仕様一致

- `src/data/historicalMarketReturns.ts` はローカル版・公開版で一致している。
- `src/lib/assetReturnModel.ts` はローカル版・公開版で一致している。
- `src/lib/historicalRollingBacktest.ts` はローカル版・公開版で一致している。

## テスト結果

### 公開版

- `npm --prefix apps/retirement-life-planner-public run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 145 tests
- `npm --prefix apps/retirement-life-planner-public run test`
  - 成功: 16 files / 217 tests
- `npm --prefix apps/retirement-life-planner-public run build`
  - 成功
  - Vite の chunk size warning のみ

### ローカル版

- `npm --prefix apps/retirement-life-planner run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 146 tests
- `npm --prefix apps/retirement-life-planner run test`
  - 成功: 16 files / 214 tests
- `npm --prefix apps/retirement-life-planner run build`
  - 成功
  - Vite の chunk size warning のみ

## 画面確認結果

### 公開版

- `http://127.0.0.1:5176/#` で確認した。
- マニュアルに以下が表示されることを確認した。
  - 運用リターン設定と過去市場検証
  - 固定年率
  - 過去実績・単一期間
  - 過去実績・範囲検証
  - 約360か月、約480か月
  - 指数リターンのみ、円換算リターン
  - 将来を保証するものではない旨
  - FRED EXJPUS、配当を含まない旨、最終データ年月: 2026-06
- 安全性シミュレーションの初期資産で、範囲検証は初期表示では自動実行されず、詳細を開いて「検証する」を押すまで結果が出ないことを確認した。
- 「検証する」実行後、最悪・中央値・最良、除外理由、開始月ごとの結果一覧が表示されることを確認した。
- 公開版の既定範囲でのブラウザ実行は約45.3秒だった。

### ローカル版

- `http://127.0.0.1:5175/#` のサーバー応答が 200 であることを確認した。
- マニュアル追記内容が `src/App.tsx` とビルド済み `dist/assets` に含まれることを確認した。
- ローカル版のブラウザプラグイン操作では、広い範囲検証の待機中に操作側のタイムアウトに当たったため、公開版と同等の画面操作完走までは確認していない。
- 計算モジュール、過去データ、範囲検証モジュールは公開版と一致しており、ローカル版のテスト・ビルドは成功している。

## 残課題

- 広い範囲検証は通常タブ移動では自動実行されないが、ユーザーが明示的に実行した場合は数十秒かかることがある。現在は「検証する」ボタン実行、折りたたみ、件数表示、時間がかかる可能性の警告で対処している。
- Vite の chunk size warning は既存のバンドルサイズ警告であり、今回の Phase 5 では未対応。
