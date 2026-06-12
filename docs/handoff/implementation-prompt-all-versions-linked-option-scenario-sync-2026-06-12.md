# 実装担当向けプロンプト: 収入イベントと一般口座サブ口座のシナリオ反映連動

作成日: 2026-06-12

## 背景

ユーザー検証で、収入タブから `CFD` と `米国株オプション` の収入イベントだけを他シナリオへ反映したところ、収入イベントはコピーされたが、初期資産タブ側の一般口座サブ口座の評価額・取得原価・保護設定が反映されなかった。

これはユーザーにとって分かりにくい。

`CFD` や `米国株オプション` は、収入イベントであると同時に、一般口座サブ口座の初期条件に依存する。タブが分かれていても、シナリオ反映では関連前提として扱う必要がある。

## 最初に読む資料

- `docs/public-app/scenario-sync-linked-option-account-design-2026-06-12.md`
- `apps/retirement-life-planner/docs/handoff-phase4-current-state.md` の `シナリオ間コピー機能`
- `docs/public-app/workplan.md` の `Phase 17`

## 対象

全バージョンに同じ仕様で反映する。

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`
- ベータ版: `apps/life-asset-simulator-beta`

主に確認するファイル:

- `*/src/App.tsx`
- `*/src/incomeSync.test.ts`
- 必要なら asset sync 関連テストファイルを追加

## 重要な制約

- 税制計算ロジックは変更しない。
- シミュレーション本体の計算ロジックは変更しない。
- 既存の収入イベントだけコピーする機能は壊さない。
- 既存の初期資産だけコピーする機能は壊さない。
- 反映先にだけある収入イベントやサブ口座は削除しない。
- 関連項目を黙ってコピーしない。ただし `一緒に反映する（推奨）` は初期ONでよい。
- すでに一部実装済みの差分がある場合は、設計書との不足分を確認し、不足箇所だけ補う。

## 実装方針

### 1. 収入タブから関連サブ口座を検出する

収入タブの `コピーする収入イベント` で選択されたイベントのうち、以下を対象にする。

```ts
event.sourceAssetKey === "ordinaryAccountForOptions"
```

関連サブ口座は以下で特定する。

1. `event.sourceOptionSubAccountId`
2. IDがなければ既存の `resolveOptionSubAccountId` / `inferOptionSubAccountIdFromName` 系ロジック
3. 特定できない場合は警告表示

### 2. 収入タブに関連前提パネルを出す

選択した収入イベントに関連サブ口座がある場合、シナリオ反映カード内に以下を出す。

```text
関連する初期資産があります
[x] 関連する一般口座サブ口座の初期条件も一緒に反映する（推奨）
```

対象のサブ口座名、評価額、取得原価、最低維持証拠金を表示する。

OFFにした場合は、収入イベントだけでは原資口座の初期条件が反映されないことを警告する。

### 3. 収入タブから関連サブ口座をコピーする

ONの場合、収入イベントのコピー処理と同時に、関連する一般口座サブ口座をコピーする。

コピー対象:

- `optionSubAccounts` の該当サブ口座
- `optionAccountRules`
- `initialAssets.ordinaryAccountForOptions`
- `initialAssetCostBasis.ordinaryAccountForOptions`
- `assetGrowthSettings.rates.ordinaryAccountForOptions`

注意:

- `initialAssets.ordinaryAccountForOptions` と `initialAssetCostBasis.ordinaryAccountForOptions` は、反映後の `optionSubAccounts` 合計から再計算する。
- 反映先にだけある別サブ口座は残す。
- 同一IDまたは同一名称のサブ口座は置き換える。

### 4. 初期資産タブから関連収入イベントを検出する

初期資産タブの一般口座サブ口座を他シナリオへ反映する時、コピー元シナリオ内の収入イベントから以下を検出する。

```ts
event.sourceAssetKey === "ordinaryAccountForOptions"
```

かつ、選択されたサブ口座に紐づくイベントを対象にする。

IDがない場合は、イベント名・サブ口座名・シナリオ名から推定する。

### 5. 初期資産タブに関連収入イベントパネルを出す

一般口座サブ口座を反映対象にした時だけ、以下を出す。

```text
関連する収入イベントがあります
[x] 関連する収入イベントも一緒に反映する（推奨）
```

対象の収入イベント名、月額、原資サブ口座、現金収入/口座内積上を表示する。

OFFにした場合は、サブ口座だけでは入金力シナリオとして成立しない可能性を警告する。

### 6. 確認ダイアログと完了メッセージを更新する

確認ダイアログには以下を含める。

- 主対象の件数
- 関連対象の件数
- 関連対象名
- OFFにした関連対象がある場合の注意

完了メッセージにも、コピーした主対象と関連対象を出す。

## QA

必ず実行:

```bash
npm --prefix apps/retirement-life-planner run test -- src/incomeSync.test.ts
npm --prefix apps/retirement-life-planner run build
npm --prefix apps/retirement-life-planner-public run test -- src/incomeSync.test.ts
npm --prefix apps/retirement-life-planner-public run build
npm --prefix apps/life-asset-simulator-beta run test -- src/incomeSync.test.ts
npm --prefix apps/life-asset-simulator-beta run build
```

必要に応じて追加するテスト:

- 収入イベント選択時、関連サブ口座がコピーされる。
- 収入イベント選択時、関連サブ口座OFFならコピーされない。
- 初期資産の一般口座サブ口座選択時、関連収入イベントがコピーされる。
- 初期資産の一般口座サブ口座選択時、関連収入イベントOFFならコピーされない。
- 反映先だけのサブ口座・収入イベントが残る。
- 収入イベントの `sourceOptionSubAccountId` が反映先で正しく解決される。

ブラウザ確認:

- ローカル版: `http://127.0.0.1:5175/`
- 公開版ローカル確認: 該当アプリのローカルサーバー
- ベータ版ローカル確認: 該当アプリのローカルサーバー

確認項目:

- 収入タブでCFD/米国株オプション収入を選ぶと、関連サブ口座の同時反映提案が出る。
- 同時反映ONで反映すると、初期資産タブの一般口座サブ口座も反映される。
- 初期資産タブで一般口座サブ口座を反映対象にすると、関連収入イベントの同時反映提案が出る。
- 個別シナリオ選択時、選択先が色付きで分かる。
- PC幅とスマートフォン幅で表示が崩れない。

## 完了報告に含めること

- 変更したファイル
- 3バージョンへの反映状況
- 収入タブ側の関連サブ口座コピー確認
- 初期資産タブ側の関連収入イベントコピー確認
- OFF時の警告表示確認
- テストとビルド結果
- ブラウザ確認結果
