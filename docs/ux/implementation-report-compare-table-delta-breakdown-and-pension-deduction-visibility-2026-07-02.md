# 比較表 差分分解表示・公的年金等控除確認導線 実装報告

作業日: 2026-07-02

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`
- 設計書: `docs/ux/compare-table-delta-breakdown-and-pension-deduction-visibility-design-2026-07-02.md`

## 実装内容

- 比較タブに新しい大きなカードは追加せず、既存の比較表・詳細比較表を調整した。
- 上段の比較表に `指定年齢残高差 基準比` と `主因メモ` を追加した。
- 主因メモでは、資産成長差を `運用 +xx万円`、税・社会保険等の負担増を残高への影響として `税社保 -xx万円` と読めるようにした。
- 既存詳細表を `差分分解（税社保・運用・NISA）` に変更した。
- 詳細表の優先列を、`主な入力差分`、`指定年齢残高差`、`資産成長差`、`税・社会保険等差`、`生活後余力差`、`NISA実行額差`、`NISA未実行差` の順に整理した。
- 一般口座申告損益・運用口座から流動資金への移動は後方列へ移し、一般口座が関係ない比較で主役に見えないようにした。
- iDeCo一時金受取年月の比較では、受取年月変更として読み方を出し、資産成長差と税・社会保険等影響を並べて読めるようにした。
- 公的年金等控除の年齢切替確認先として、比較タブの読み方に `税・社会保険タブ > 所得税・住民税の計算式確認 > メンバー別の課税対象収入と控除` を追加した。

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `docs/ux/implementation-report-compare-table-delta-breakdown-and-pension-deduction-visibility-2026-07-02.md`

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

## 既存保存データへの影響

- 保存JSONの構造変更は行っていない。
- 今回は比較タブの表示改善のみで、シミュレーション計算結果の算出ロジックは変更していない。
