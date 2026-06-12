# 収入イベントと一般口座サブ口座のシナリオ反映連動 作業報告書

作成日: 2026-06-12

## 対象

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`
- ベータ版: `apps/life-asset-simulator-beta`
- 実装指示: `docs/handoff/implementation-prompt-all-versions-linked-option-scenario-sync-2026-06-12.md`
- 設計書: `docs/public-app/scenario-sync-linked-option-account-design-2026-06-12.md`

## 実装内容

- 収入タブで `ordinaryAccountForOptions` 由来の収入イベントを選択したとき、関連する一般口座サブ口座を検出するようにした。
- 収入タブに「関連する初期資産があります」パネルを追加し、関連サブ口座の同時反映を推奨ONで選べるようにした。
- 収入タブ側で同時反映ONの場合、関連サブ口座、一般口座ルール、評価額、取得原価、利回り前提を一緒に反映するようにした。
- 初期資産タブで一般口座サブ口座を反映対象にしたとき、関連する収入イベントを検出するようにした。
- 初期資産タブに「関連する収入イベントがあります」パネルを追加し、関連収入イベントの同時反映を推奨ONで選べるようにした。
- 確認ダイアログと完了メッセージに、主対象と関連対象の件数・名称を表示するようにした。
- 反映先にだけ存在する収入イベントやサブ口座は残すようにした。

## 3バージョンへの反映状況

- `apps/retirement-life-planner`: 反映済み
- `apps/retirement-life-planner-public`: 反映済み
- `apps/life-asset-simulator-beta`: 反映済み

## テスト結果

- `npm --prefix apps/retirement-life-planner run test -- src/incomeSync.test.ts`: 成功、8件
- `npm --prefix apps/retirement-life-planner-public run test -- src/incomeSync.test.ts`: 成功、8件
- `npm --prefix apps/life-asset-simulator-beta run test -- src/incomeSync.test.ts`: 成功、8件

追加確認:

- 収入イベント選択時、関連サブ口座がコピーされることを確認。
- 収入イベント選択時、関連サブ口座OFFならコピーされないことを確認。
- 初期資産の一般口座サブ口座選択時、関連収入イベントがコピーされることを確認。
- 初期資産の一般口座サブ口座選択時、関連収入イベントOFFならコピーされないことを確認。
- 反映先だけのサブ口座・収入イベントが残ることを確認。

## ビルド結果

- `npm --prefix apps/retirement-life-planner run build`: 成功
- `npm --prefix apps/retirement-life-planner-public run build`: 成功
- `npm --prefix apps/life-asset-simulator-beta run build`: 成功

公開版とベータ版では既存の Vite chunk size warning が表示されるが、ビルド失敗ではない。

## ローカル配信確認

- `npm run serve:retirement-life-planner`: 成功、`http://127.0.0.1:5175/`
- `npm run serve:public`: 成功、`http://127.0.0.1:5176/`
- `npm run serve:beta`: 成功、`http://127.0.0.1:5177/`
- HTTP確認: 5175、5176、5177 はすべて `200`

## ブラウザ確認結果

- `http://127.0.0.1:5175/` の実ブラウザ確認で、収入タブの「関連する初期資産があります」を確認した。
- `http://127.0.0.1:5175/` の実ブラウザ確認で、「関連する一般口座サブ口座の初期条件も一緒に反映する（推奨）」を確認した。
- `http://127.0.0.1:5175/` の実ブラウザ確認で、関連サブ口座OFF時の警告文を確認した。
- `http://127.0.0.1:5175/` の実ブラウザ確認で、初期資産タブの「関連する収入イベントがあります」を確認した。
- `http://127.0.0.1:5175/` の実ブラウザ確認で、「関連する収入イベントも一緒に反映する（推奨）」を確認した。
- `http://127.0.0.1:5175/` の実ブラウザ確認で、個別シナリオ選択時に選択先が `border-teal-400 bg-teal-50` で色付き表示になることを確認した。
- `http://127.0.0.1:5176/` と `http://127.0.0.1:5177/` は画面起動とHTTP 200を確認した。
- スマートフォン幅 390px で表示し、横スクロール崩れが出ていないことを確認した。
