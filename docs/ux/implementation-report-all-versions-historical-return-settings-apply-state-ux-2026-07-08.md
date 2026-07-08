# 過去市場リターン設定 反映状態UX改善 実装報告

作業日: 2026-07-08

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

## 変更ファイル

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `docs/ux/implementation-report-all-versions-historical-return-settings-apply-state-ux-2026-07-08.md`

## 実装内容

- 過去実績・単一期間モードで、設定変更がダッシュボード・結果・比較へ自動反映されることを明示。
- 単一期間モードの確認導線として「ダッシュボードで確認」「結果で確認」「範囲検証で比較する」「固定年率に戻す」を追加。
- 過去実績・範囲検証モードで、自動反映ではなく「検証する / 再検証する」実行が必要なことを明示。
- 範囲検証モードの資産配分設定直下に「検証する / 再検証する」と「固定年率に戻す」を追加。
- 範囲検証済み条件が変更された場合の案内文「条件が変わりました。最新条件で再検証してください。」を近接表示。
- 計算ロジック、バックテストロジック、資産成長率計算には変更なし。

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

- ローカル版 `http://127.0.0.1:5175/#`
  - 「初期資産」内の「資産別利回り」で単一期間モードの自動反映表示を確認。
  - 「ダッシュボードで確認」「結果で確認」「範囲検証で比較する」「固定年率に戻す」を確認。
  - 範囲検証モードで「複数の過去市場開始月でストレステスト」「検証する」「固定年率に戻す」を確認。
- 公開版 `http://127.0.0.1:5176/#`
  - 「初期資産」内の「資産別利回り」で単一期間モードの自動反映表示を確認。
  - 「ダッシュボードで確認」「結果で確認」「範囲検証で比較する」「固定年率に戻す」を確認。
  - 範囲検証モードで「複数の過去市場開始月でストレステスト」「検証する」「固定年率に戻す」を確認。

## 公開版反映

- 公開版の実装差分はコミット・プッシュ対象。
- 公開版へ個人データは追加していない。
