# 過去実績マーケットリターン・バックテスト Phase 3 作業報告

作業日: 2026-07-06

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 実装内容

- `GrowthSettings.returnModel` の `historicalRollingRange` を前提に、過去実績の範囲検証を追加。
- 指定範囲内の各開始月について、必要月数を満たす開始月だけを試算対象化。
- データ不足の開始月は除外し、平均リターンや固定年率で補完しない。
- 試算は通常表示で自動実行せず、初期資産タブの「過去市場ストレステスト」内の「検証する」ボタンで実行。
- 範囲検証結果として、対象/除外パス数、枯渇パス数、最悪、下位10%、中央値、上位10%、最良、最大ドローダウン、開始月別一覧を表示。
- 通常の結果タブやダッシュボードの値は、範囲検証の中央値や最悪ケースで置き換えない。

## 変更ファイル

### ローカル版

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner/src/lib/assetReturnModel.ts`
- `apps/retirement-life-planner/src/lib/historicalRollingBacktest.ts`
- `apps/retirement-life-planner/src/lib/historicalRollingBacktest.test.ts`

### 公開版

- `apps/retirement-life-planner-public/src/App.tsx`
- `apps/retirement-life-planner-public/src/lib/assetReturnModel.ts`
- `apps/retirement-life-planner-public/src/lib/historicalRollingBacktest.ts`
- `apps/retirement-life-planner-public/src/lib/historicalRollingBacktest.test.ts`

## 検証結果

### ローカル版

- `npm --prefix apps/retirement-life-planner run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 141 tests
- `npm --prefix apps/retirement-life-planner run build`
  - 成功
- ブラウザ確認: `http://127.0.0.1:5178/#`
  - 初期資産タブで「過去実績・範囲検証」を確認。
  - 「過去市場ストレステスト」が初期表示で折りたたまれていることを確認。
  - 「検証する」実行後に、対象パス数、除外数、最悪、中央値、最良、除外理由、開始月ごとの結果一覧が表示されることを確認。

### 公開版

- `npm --prefix apps/retirement-life-planner-public run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 140 tests
- `npm --prefix apps/retirement-life-planner-public run build`
  - 成功
- ブラウザ確認: `http://127.0.0.1:5179/#`
  - 初期資産タブで「過去実績・範囲検証」を確認。
  - 通常表示では範囲検証結果が自動表示されないことを確認。
  - 「検証する」実行後に、対象パス数、除外数、最悪、中央値、最良、除外理由、開始月ごとの結果一覧が表示されることを確認。

## 公開版への反映

- 公開版には個人データを追加していない。
- 公開版の関連ファイルだけをコミット・push対象として分離する。
