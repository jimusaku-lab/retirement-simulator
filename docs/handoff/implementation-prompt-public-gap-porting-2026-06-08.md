# 実装担当向けプロンプト: ローカル版・GitHub公開版の仕様差分反映

作成日: 2026-06-08

## 目的

ローカル版 `apps/retirement-life-planner` と、GitHubで公開する一般向け版 `apps/retirement-life-planner-public` の仕様差分を確認し、公開版に未反映の承認済みUX改善を実装する。

ローカル版のすべてを公開版へ移植しない。公開版に必要なのは、一般ユーザーにとって入力しやすく、見やすくする共通UX改善である。本人専用、QNAP共有、実データ復旧などの個人環境機能は公開版へ戻さない。

## 対象

主対象:

- `apps/retirement-life-planner-public`

比較・共通UI確認対象:

- `apps/retirement-life-planner`

参照する主なファイル:

- `apps/retirement-life-planner-public/src/App.tsx`
- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/store/usePlanStore.ts`
- `apps/retirement-life-planner/src/store/usePlanStore.ts`
- `apps/retirement-life-planner-public/src/features/TimeBucketPlanner.tsx`
- `apps/retirement-life-planner/src/features/TimeBucketPlanner.tsx`

## 最初に読む資料

- `docs/public-app/local-vs-public-gap-audit-2026-06-08.md`
- `docs/public-app/ux-guided-input-card-collapse-design.md`
- `docs/handoff/implementation-prompt-public-input-navigation-strengthening-2026-06-08.md`
- `docs/handoff/implementation-prompt-all-versions-asset-tab-priority-2026-06-08.md`
- `docs/public-app/data-storage-policy.md`
- `docs/public-app/workplan.md` の Phase 15-E, 15-F, 16

## 最初に実施する監査

GitHub公開版との差分を確認する。

```bash
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git diff --name-status origin/main -- apps/retirement-life-planner apps/retirement-life-planner-public docs/public-app docs/handoff
git diff origin/main -- apps/retirement-life-planner/src/App.tsx apps/retirement-life-planner-public/src/App.tsx
```

確認観点:

- `HEAD` と `origin/main` が一致していても、作業ツリーに未コミット変更があればGitHub公開版には未反映である。
- 公開版に入れるべき変更と、公開版へ戻してはいけない本人専用変更を分ける。
- ローカル版と公開版で共通化すべき文言・折りたたみ・入力誘導は、両方の体験差が不要に広がらないよう確認する。

## 実装範囲

### 1. 初期資産タブの文言と優先度

公開版へ必ず反映する。ローカル版にも同じ文言・表示優先度を残す。

実装内容:

- `証券・iDeCoの評価額と評価損益` を `NISA・iDeCo・特定口座などの評価額と評価損益` に変更する。
- 同じ意味の短いラベルは `NISA・iDeCo等の評価額` に寄せる。
- 補助文は、NISA、iDeCo、特定口座、マネーフォワード等の評価額・評価損益を入れることが伝わる文にする。
- このカードを `詳細` ではなく `推奨` または `確認推奨` として扱う。
- 入力状況サマリーや次対象からこのカードへ移動できるようにする。
- 一般口座（申告対象運用）のサブ口座は初期表示で畳む。

避けること:

- 一般口座サブ口座フォームを初期資産タブの主役にしない。
- `証券・iDeCoの評価額と評価損益` という旧文言を残さない。

### 2. 入力ナビゲーション強化

公開版へ反映する。

実装内容:

- `6/6 完了` を `6項目中6項目完了` または `必須入力は完了` に変更する。
- 必須入力が完了し、推奨確認だけが残る場合は `次に入力` ではなく `次に確認するとよい` と表示する。
- 入力状況サマリーの次対象枠全体をクリック可能にする。
- クリック時は、対象タブへ切り替え、対象カードを展開し、最初に必要な入力欄へスクロール・フォーカスする。
- 次対象が `iDeCo受取` の場合は、`収入` タブのiDeCo受取方法入力へ移動させる。
- タブ上の `次` バッジには、対象タブ内に次対象がある意味を持たせる。
- ダッシュボードや結果画面からも、入力状況サマリーまたは次対象へアクセスできる導線を出す。

### 3. カード折りたたみ方針

公開版へ反映する。

実装内容:

- 通常入力画面で、すべてのカードを常時全体表示しない。
- 完了済みカードは主要値と状態だけの要約表示にする。
- 詳細入力、専門補正、計算対象外カード、コピー操作、年度別根拠は初期状態で閉じる。
- ユーザーが見ている文脈で必要なカードだけを開く。
- 結果や注意表示から原因調査で指定されたカードは、その時だけ展開する。

例:

- 年金受給プランナー反映中の外部公的年金イベントは、注意文だけ要約表示し、カード全体を開きっぱなしにしない。
- 一般口座サブ口座は、詳細管理をするユーザーだけが開く。

## 公開版へ戻してはいけない機能

次はローカル版にあっても公開版へ実装しない。

- QNAP共有保存
- `共有保存へ保存`
- `実データを復旧`
- `restore=chrome5173`
- `本人専用MVP`
- `奥様PC`
- `Chrome 5173`
- QNAP、家庭内共有、個人環境前提の文言
- ローカル版の保存キー

公開版には次を残す。

- 初回設定ウィザード
- データの扱い説明
- GitHub Pages向けの信頼性表示
- 公開版専用保存キー
- 一般向け匿名サンプル
- ブラウザ内保存データ削除
- 公開版用のサンプル移行処理

## 検索確認

実装後、公開版に個人環境文言が混入していないか確認する。

```bash
rg -n "QNAP|共有保存へ保存|実データを復旧|restore=chrome5173|本人専用MVP|奥様PC|Chrome 5173" apps/retirement-life-planner-public/src
rg -n "証券・iDeCoの評価額と評価損益|証券・iDeCo評価額" apps/retirement-life-planner-public/src apps/retirement-life-planner/src
```

1つ目は、公開版ソースに該当がないことを確認する。
2つ目は、旧文言が残っていないことを確認する。

## QA

公開版で必ず実行する。

```bash
npm --prefix apps/retirement-life-planner-public run test -- src/lib/simulation.test.ts
npm --prefix apps/retirement-life-planner-public run build
```

ローカル版にも共通UI変更を入れた場合は実行する。

```bash
npm --prefix apps/retirement-life-planner run test -- src/lib/simulation.test.ts
npm --prefix apps/retirement-life-planner run build
```

ブラウザ確認:

- ローカル版: `http://127.0.0.1:5175/`
- 公開版: `http://127.0.0.1:5176/`
- GitHub Pages公開版: `https://jimusaku-lab.github.io/retirement-simulator/`

確認項目:

- 公開版で `人生資産シミュレーション` と表示される。
- 公開版に本人専用、QNAP、実データ復旧の導線がない。
- 公開版に初回設定ウィザードとデータの扱い説明が残っている。
- 初期資産タブで `NISA・iDeCo・特定口座などの評価額と評価損益` が確認推奨として見える。
- 一般口座サブ口座が初期表示で畳まれている。
- 入力状況サマリーの完了表記が分かりやすい。
- 次対象枠をクリックすると、対象タブ、対象カード、対象入力欄へ移動する。
- PC幅とスマートフォン幅で表示が崩れない。

## GitHub反映

GitHub公開版へ反映する場合は、テストとビルド成功後にコミット、push、GitHub Pagesの反映確認まで行う。

完了報告には次を含める。

- 変更したファイル
- 公開版へ反映した差分
- 公開版へ意図的に反映しなかったローカル版機能
- 旧文言と個人環境文言の検索結果
- テストとビルド結果
- 5175、5176、GitHub Pagesの確認結果
