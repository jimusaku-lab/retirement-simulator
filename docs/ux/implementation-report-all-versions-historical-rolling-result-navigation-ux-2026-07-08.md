# 過去市場ストレステスト 結果表示ナビゲーションUX改善 実装報告

作業日: 2026-07-08

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `docs/ux/implementation-report-all-versions-historical-rolling-result-navigation-ux-2026-07-08.md`

## 実装内容

- 黄色枠の主ボタンを `検証して結果を見る` / `再検証して結果を見る` に変更。
- 黄色枠に `検証後、下の「過去市場ストレステスト」を開いて結果を表示します。` を追加。
- 検証開始時に `過去市場ストレステスト` の折りたたみを自動で開くように変更。
- 検証完了またはエラー時に、結果表示位置へスクロールする導線を追加。
- 検証完了後、黄色枠に `検証完了: 対象... / 資産が尽きた開始月... / 90歳残高の最悪...` の要約を表示。
- 黄色枠に `結果を開く` ボタンを追加。
- `過去市場ストレステスト` 見出しに `未検証 / 検証中 / 結果あり / 再検証が必要 / エラー` の状態バッジを追加。
- 計算ロジック、範囲検証ロジック、シナリオ計算には変更なし。

## テスト結果

- ローカル版: `npm --prefix apps/retirement-life-planner run test -- src/lib/simulation.test.ts`
  - 1 file passed / 141 tests passed
- 公開版: `npm --prefix apps/retirement-life-planner-public run test -- src/lib/simulation.test.ts`
  - 1 file passed / 140 tests passed

## ビルド結果

- ローカル版: `npm --prefix apps/retirement-life-planner run build`
  - 成功
- 公開版: `npm --prefix apps/retirement-life-planner-public run build`
  - 成功

## 画面確認結果

- 公開版 `http://127.0.0.1:5176/#`
  - `検証して結果を見る` の表示を確認。
  - 検証後、黄色枠に検証完了要約が表示されることを確認。
  - `過去市場ストレステスト` が自動で開くことを確認。
  - 見出しに `結果あり` バッジが出ることを確認。
  - 結果アンカーと `90歳残高が最も少ないケース` の結果表示を確認。
- ローカル版 `http://127.0.0.1:5175/#`
  - 保存データ変更を避けるため実行操作は行わず、範囲検証モード表示上で主ボタン、補足文、状態バッジ、ストレステストカードの存在を確認。

## 公開版反映

- 公開版の実装差分はコミット・プッシュ対象。
- 公開版へ個人データは追加していない。
