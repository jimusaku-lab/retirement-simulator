# 過去実績マーケットリターン・バックテスト Phase 4 作業報告

作業日: 2026-07-06

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 実装内容

- USD/JPY月次データを追加。
  - データ範囲: `1971-01`〜`2026-06`
  - 出典: FRED `EXJPUS` monthly average
- 過去実績モードの `currencyMode` を実動作化。
  - `indexOnly`: 指数リターンのみ
  - `jpyConverted`: 円換算リターン
- 円換算リターンの計算式を追加。
  - `(1 + ドル建て指数リターン) * (1 + USD/JPY変化率) - 1`
- 資産配分は、まずドル建て指数リターンを加重平均し、その後にUSD/JPY変化率を掛けるようにした。
- 現金、普通預金、定期預金は従来どおり固定年率で扱い、USD/JPY変化率を掛けない。
- `jpyConverted` では、指数データだけでなくUSD/JPYデータも必要月数チェックに含めた。
- USD/JPYデータ不足月は平均値や0%で補完せず、単一期間では警告、範囲検証では除外対象にした。
- UIに為替モード選択、円換算リターンの説明、将来為替予測ではない注意文を追加。
- 結果タブにも使用中の為替モードを表示。

## 変更ファイル

### ローカル版

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner/src/data/historicalMarketReturns.ts`
- `apps/retirement-life-planner/src/lib/assetReturnModel.ts`
- `apps/retirement-life-planner/src/lib/historicalRollingBacktest.ts`
- `apps/retirement-life-planner/src/lib/historicalRollingBacktest.test.ts`
- `apps/retirement-life-planner/src/lib/simulation.test.ts`

### 公開版

- `apps/retirement-life-planner-public/src/App.tsx`
- `apps/retirement-life-planner-public/src/data/historicalMarketReturns.ts`
- `apps/retirement-life-planner-public/src/lib/assetReturnModel.ts`
- `apps/retirement-life-planner-public/src/lib/historicalRollingBacktest.ts`
- `apps/retirement-life-planner-public/src/lib/historicalRollingBacktest.test.ts`
- `apps/retirement-life-planner-public/src/lib/simulation.test.ts`

## 確認結果

### テスト

- ローカル版: `npm --prefix apps/retirement-life-planner run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 146 tests
- 公開版: `npm --prefix apps/retirement-life-planner-public run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 145 tests

### ビルド

- ローカル版: `npm --prefix apps/retirement-life-planner run build`
  - 成功
- 公開版: `npm --prefix apps/retirement-life-planner-public run build`
  - 成功

### ブラウザ確認

- ローカル版: `http://127.0.0.1:5175/#`
  - 初期資産タブで為替モード `指数リターンのみ / 円換算リターン` を確認。
  - 円換算リターン選択時にUSD/JPY説明、将来為替予測ではない注意文、USD/JPY必要データ表示、データ不足警告を確認。
  - 結果タブで為替モード `円換算リターン` と注意文を確認。
- 公開版: `http://127.0.0.1:5176/#`
  - 初期資産タブで為替モード `指数リターンのみ / 円換算リターン` を確認。
  - 円換算リターン選択時にUSD/JPY説明、将来為替予測ではない注意文、USD/JPY必要データ表示、データ不足警告を確認。
  - 結果タブで為替モード `円換算リターン` と注意文を確認。

## 公開版への反映

- 公開版に個人データは追加していない。
- 公開版の関連ファイルだけをコミット・push対象として分離する。
