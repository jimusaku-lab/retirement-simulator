# 実装担当向けプロンプト: 一般公開版へシナリオ反映連動を反映・公開する

作成日: 2026-06-12

## 目的

友人に試用してもらっている一般公開版 `https://jimusaku-lab.github.io/retirement-simulator/` に、以下の改善を反映する。

- 収入タブで `CFD` / `米国株オプション` など一般口座サブ口座由来の収入イベントを他シナリオへ反映する時、関連する初期資産側の一般口座サブ口座条件も同時反映できる。
- 初期資産タブで一般口座サブ口座を他シナリオへ反映する時、関連する収入イベントも同時反映できる。

公開URLで友人が使うため、ローカル実装だけで終わらせず、GitHub Pages反映と公開URL確認まで行う。

## 最初に読む資料

- 設計書: `docs/public-app/scenario-sync-linked-option-account-design-2026-06-12.md`
- 全バージョン実装指示: `docs/handoff/implementation-prompt-all-versions-linked-option-scenario-sync-2026-06-12.md`
- 作業報告書: `docs/public-app/implementation-report-linked-option-scenario-sync-2026-06-12.md`
- GitHub Pages公開手順: `docs/public-app/github-pages-limited-release.md`
- 作業計画: `docs/public-app/workplan.md` の `Phase 17`

## 対象

主対象:

- `apps/retirement-life-planner-public`
- GitHub Pages公開URL: `https://jimusaku-lab.github.io/retirement-simulator/`

比較確認対象:

- `apps/retirement-life-planner`
- `apps/life-asset-simulator-beta`

## 実装担当の作業範囲

今回の主目的は公開版への反映と検証である。

1. 既存実装が公開版に入っているか確認する。
2. 不足があれば `apps/retirement-life-planner-public` に実装する。
3. 公開版のテスト、ビルド、ローカル配信確認を行う。
4. GitHub Pagesへ反映する。
5. 公開URLで最終確認する。
6. 完了報告書を更新または新規作成する。

## 事前確認

次を確認する。

```bash
git status --short
rg -n "関連する初期資産があります|関連する収入イベントがあります|ordinaryAccountForOptions|CFD・米国株オプション設定" apps/retirement-life-planner-public/src
rg -n "linked-option|Phase 17|一般口座サブ口座と収入イベント" docs/public-app docs/handoff
```

確認ポイント:

- `apps/retirement-life-planner-public/src/App.tsx` に、収入タブ側の関連サブ口座同時反映UIがある。
- `apps/retirement-life-planner-public/src/App.tsx` に、初期資産タブ側の関連収入イベント同時反映UIがある。
- `apps/retirement-life-planner-public/src/incomeSync.test.ts` などに、関連サブ口座ON/OFF、関連収入イベントON/OFFのテストがある。

## 不足実装がある場合の実装要件

設計書に沿って、公開版へ不足分を実装する。

必須UI:

- 収入タブ:
  - `関連する初期資産があります`
  - `関連する一般口座サブ口座の初期条件も一緒に反映する（推奨）`
  - OFF時警告
- 初期資産タブ:
  - `関連する収入イベントがあります`
  - `関連する収入イベントも一緒に反映する（推奨）`
  - OFF時警告

必須ロジック:

- `sourceAssetKey === "ordinaryAccountForOptions"` の収入イベントから関連サブ口座を検出する。
- 関連サブ口座ONの場合、サブ口座、評価額、取得原価、一般口座ルール、利回りを同時反映する。
- 一般口座サブ口座反映時、関連収入イベントを検出する。
- 関連収入イベントONの場合、対象収入イベントも同時反映する。
- 反映先にだけある収入イベントやサブ口座は削除しない。
- 確認ダイアログと完了メッセージで、主対象と関連対象を分けて表示する。

## テスト

必ず実行する。

```bash
npm --prefix apps/retirement-life-planner-public run test -- src/incomeSync.test.ts
npm --prefix apps/retirement-life-planner-public run build
```

比較対象として、可能なら以下も実行する。

```bash
npm --prefix apps/retirement-life-planner run test -- src/incomeSync.test.ts
npm --prefix apps/retirement-life-planner run build
npm --prefix apps/life-asset-simulator-beta run test -- src/incomeSync.test.ts
npm --prefix apps/life-asset-simulator-beta run build
```

## ローカル公開版確認

公開版をローカルで配信し、画面確認する。

```bash
npm --prefix apps/retirement-life-planner-public run serve:local
```

想定URL:

- `http://127.0.0.1:5176/`

画面確認項目:

- 収入タブの `他シナリオへ反映（必要時のみ）` を開ける。
- CFD/米国株オプションなど、一般口座サブ口座由来の収入イベントを選んだ時に `関連する初期資産があります` が表示される。
- `関連する一般口座サブ口座の初期条件も一緒に反映する（推奨）` が初期ONになっている。
- OFFにすると警告が出る。
- 初期資産タブの一般口座サブ口座反映で `関連する収入イベントがあります` が表示される。
- `関連する収入イベントも一緒に反映する（推奨）` が初期ONになっている。
- 個別シナリオ選択で、選択済みの反映先が色付きで分かる。
- PC幅、スマートフォン幅で表示崩れがない。

## GitHub Pages反映

テストとローカル確認が終わったら、公開版へ反映する。

手順はリポジトリの現行運用に従う。基本方針:

1. 関連ファイルだけを確認してコミット対象を整理する。
2. 変更をコミットする。
3. GitHubへpushする。
4. GitHub ActionsのPagesデプロイが成功することを確認する。
5. 公開URLを開いて反映確認する。

公開URL:

```text
https://jimusaku-lab.github.io/retirement-simulator/
```

公開URL確認項目:

- アプリが正常に開く。
- `人生資産シミュレーション` と表示される。
- 収入タブに今回の関連前提UIがある。
- 初期資産タブに今回の関連前提UIがある。
- `QNAP`、本人専用保存、実データ復旧など、公開版に戻してはいけない個人環境機能が混入していない。
- 入力データは端末内保存である説明・データ削除導線が残っている。

## 完了報告

完了報告には必ず以下を含める。

- 変更したファイル
- 公開版 `apps/retirement-life-planner-public` への反映状況
- ローカル版・ベータ版との差分がある場合、その理由
- 実行したテストと結果
- ローカル公開版 `http://127.0.0.1:5176/` の確認結果
- GitHub Pages Actionsの結果
- 公開URL `https://jimusaku-lab.github.io/retirement-simulator/` の確認結果
- 公開版に混入してはいけない個人環境文言の検索結果
