# 過去市場ケースの通常チャート反映UX改善 実装報告

作成日: 2026-07-07

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `docs/ux/implementation-report-all-versions-historical-market-chart-apply-flow-ux-2026-07-07.md`

## 実装内容

- 範囲検証結果のボタン文言を `チャートで見る` から `通常チャートに反映` に変更した。
  - `最悪ケースを通常チャートに反映`
  - `中央値ケースを通常チャートに反映`
  - `最良ケースを通常チャートに反映`
- ボタン付近に、押下後は通常の運用リターン設定へ反映され、ダッシュボードと結果タブの資産推移が再計算されることを明記した。
- ボタン押下後に、反映したケース、過去市場の開始月、配分、為替モードを表示する成功メッセージを追加した。
- 成功メッセージ内に以下の導線を追加した。
  - `ダッシュボードで見る`
  - `範囲検証に戻る`
  - `固定年率に戻す`
- ダッシュボードの `資産残高推移` に現在の運用リターン状態を表示した。
  - 固定年率: `運用リターン: 固定年率`
  - 過去実績単一期間: `運用リターン: 過去実績 YYYY年MM月開始 / 配分 / 為替モード`
- 過去実績反映中のダッシュボードに `固定年率に戻す` と `設定を変更` を追加した。
- 資産別利回りカードにも `固定年率に戻す` を追加した。

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
- 範囲検証結果に `最悪ケースを通常チャートに反映`、`中央値ケースを通常チャートに反映`、`最良ケースを通常チャートに反映` が表示されることを確認した。
- `中央値ケースを通常チャートに反映` を押すと、運用リターン方式が `過去実績・単一期間` へ切り替わることを確認した。
- 押下後メッセージに、過去市場の開始月、配分、為替、`ダッシュボードで見る`、`範囲検証に戻る`、`固定年率に戻す` が表示されることを確認した。
- `ダッシュボードで見る` でダッシュボードへ移動し、資産残高推移に `運用リターン: 過去実績...` と反映中バナーが出ることを確認した。
- ダッシュボードの `固定年率に戻す` を押すと、`運用リターン: 固定年率` に戻ることを確認した。

### ローカル版

- `http://127.0.0.1:5175/#` で確認した。
- 初期資産画面に運用リターン状態と `固定年率に戻す` が表示されることを確認した。
- 旧文言 `チャートで見る` が表示されないことを確認した。

## 残課題

- 広い範囲検証は、明示実行時に数十秒かかる場合がある。今回も自動実行はせず、ユーザーが `検証する` を押した時だけ実行する仕様を維持している。
- Vite の chunk size warning は既存警告として残る。
