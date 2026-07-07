# 過去市場ストレステスト UX改善 実装報告

作成日: 2026-07-07

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `docs/ux/implementation-report-all-versions-historical-stress-test-ux-clarity-2026-07-07.md`

## 実装内容

- 過去市場ストレステストのユーザー向け表現を変更した。
  - `対象パス数` -> `検証できた開始月`
  - `枯渇パス` -> `資産が尽きた開始月`
  - `除外理由` -> `データ不足で除外`
  - `候補` -> `開始月候補`
  - `過去開始月` -> `過去市場の開始月`
- 検証範囲、必要データ、検証できた開始月、資産が尽きた開始月、データ不足で除外に補足説明を追加した。
- 範囲検証は複数の過去市場の開始月をまとめて検証するストレステストであり、通常のダッシュボードや資産推移チャートを置き換えないことを明記した。
- 90歳残高の最悪・中央値・最良ケースの見出しと補足説明を改善した。
- 最大ドローダウンに、ピークからの落ち込みを示す指標である説明を追加した。
- 範囲検証結果に以下の導線を追加した。
  - `最悪ケースをチャートで見る`
  - `中央値ケースをチャートで見る`
  - `最良ケースをチャートで見る`
- ボタン押下時のみ、現在の範囲検証設定の `assetMappings` と `currencyMode` を引き継いで、`historicalSinglePath` へ切り替えるようにした。
- アプリ内マニュアルに、範囲検証の意味、開始月候補、検証できた開始月、データ不足で除外、単一期間への切替導線を追記した。

計算ロジックは変更していない。

## テスト結果

### 公開版

- `npm --prefix apps/retirement-life-planner-public run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 145 tests
- `npm --prefix apps/retirement-life-planner-public run build`
  - 成功
  - Vite の chunk size warning のみ

### ローカル版

- `npm --prefix apps/retirement-life-planner run test -- src/lib/historicalRollingBacktest.test.ts src/lib/simulation.test.ts`
  - 成功: 2 files / 146 tests
- `npm --prefix apps/retirement-life-planner run build`
  - 成功
  - Vite の chunk size warning のみ

## 画面確認結果

### 公開版

- `http://127.0.0.1:5176/#` で確認した。
- 初期資産タブの過去市場ストレステストに以下が表示されることを確認した。
  - `検証できた開始月`
  - `開始月候補`
  - `データ不足で除外`
  - `過去市場の開始月`
  - 範囲検証は通常のダッシュボードや資産推移チャートを置き換えない旨
- `対象パス数`、`枯渇パス`、`除外理由` が表示されないことを確認した。
- `検証する` 実行後、以下のボタンが表示されることを確認した。
  - `最悪ケースをチャートで見る`
  - `中央値ケースをチャートで見る`
  - `最良ケースをチャートで見る`
- `中央値ケースをチャートで見る` を押すと、運用リターン方式が `過去実績・単一期間` に切り替わり、過去市場の開始月へ該当月が入ることを確認した。

### ローカル版

- `http://127.0.0.1:5175/#` で確認した。
- 初期資産タブの過去市場ストレステストに新ラベルと説明が表示されることを確認した。
- `対象パス数`、`枯渇パス`、`除外理由` が表示されないことを確認した。

## 残課題

- 広い範囲検証は、明示実行時に数十秒かかる場合がある。今回の変更でも自動実行はせず、ユーザーが `検証する` を押した時だけ実行する設計を維持している。
- Vite の chunk size warning は既存警告として残る。
