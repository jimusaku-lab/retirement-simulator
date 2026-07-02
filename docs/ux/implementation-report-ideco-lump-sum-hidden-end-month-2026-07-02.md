# iDeCo一時金 受取年月UI・比較差分表示 実装報告

作業日: 2026-07-02

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`
- 設計書: `docs/ux/ideco-lump-sum-hidden-end-month-design-2026-07-02.md`

## 実装内容

- iDeCo一時金イベント（`type: "oneTime"` かつ `sourceAssetKey: "ideco"`）では、収入入力UIの汎用 `開始年月` を非表示にした。
- iDeCo一時金は既存の専用 `受取年月` 入力だけを表示し、受取年月変更時は `startYearMonth` と `endYearMonth` を同じ年月へ同期する既存処理を利用する。
- 比較タブの入力差分では、iDeCo一時金の期間差分を汎用 `期間 YYYY/MM〜YYYY/MM` として表示せず、`iDeCo一時金受取年月: 基準 YYYY/MM / このシナリオ YYYY/MM` として表示する。
- iDeCo一時金の隠し `endYearMonth` 差分だけでは、比較差分を出さないようにした。
- iDeCo年金受取など、一時金ではないiDeCo収入イベントは従来どおり期間差分を表示する。

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner/src/lib/scenarioDiff.ts`
- `apps/retirement-life-planner/src/lib/scenarioDiff.test.ts`
- `apps/retirement-life-planner-public/src/App.tsx`
- `apps/retirement-life-planner-public/src/lib/scenarioDiff.ts`
- `apps/retirement-life-planner-public/src/lib/scenarioDiff.test.ts`
- `docs/ux/implementation-report-ideco-lump-sum-hidden-end-month-2026-07-02.md`

## テスト結果

- ローカル版: `npm --prefix apps/retirement-life-planner run test`
  - 成功: 14 files passed, 192 tests passed
- 公開版: `npm --prefix apps/retirement-life-planner-public run test`
  - 成功: 14 files passed, 195 tests passed

## ビルド結果

- ローカル版: `npm --prefix apps/retirement-life-planner run build`
  - 成功
  - Vite の chunk size warning のみ
- 公開版: `npm --prefix apps/retirement-life-planner-public run build`
  - 成功
  - Vite の chunk size warning のみ

## 画面確認

- ローカル版 `http://127.0.0.1:5175/#` で安全性シミュレーション > 収入タブを確認。
- iDeCo一時金カード内に `受取年月` が表示され、汎用 `開始年月` ラベルが表示されないことを確認。
- 比較タブでは、隠し `endYearMonth` 由来の `2027/02` 期間表示が出ないことを確認。

## 既存保存データへの影響

- 既存JSONの直接正規化は行っていない。
- 既存データに古い `endYearMonth` が残っていても、iDeCo一時金の比較差分では隠し項目として無視する。
