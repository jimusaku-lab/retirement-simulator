# 実装担当向けプロンプト: 一般向け版 iDeCo一時金UI・退職所得控除改善

作成日: 2026-06-05

## 依頼

あなたは「人生資産シミュレーション」一般向け版の実装担当です。

今回の主対象は `apps/retirement-life-planner-public` です。ローカル版 `apps/retirement-life-planner` には同趣旨の先行実装があるため、挙動確認の参考にしてよいですが、一般向け版の保存方針、匿名サンプル、公開向け文言は維持してください。

## 目的

iDeCo一時金を入力するためにユーザーが「単発入金」を選ぶ必要がある現状は分かりにくい。iDeCoを選んだ時点で、年金受取と一時金受取の違い、税区分、退職所得控除の重複調整、社会保険料への影響が分かるUIに改善する。

## 参照する設計書

- `docs/public-app/requirements.md`
- `docs/public-app/information-architecture.md`
- `docs/public-app/input-classification.md`
- `docs/public-app/tax-social-policy.md`
- `docs/public-app/glossary.md`
- `docs/tax-social/ideco_lump_sum_retirement_overlap_rules_for_codex_updated.md`
- `docs/public-app/workplan.md` の Phase 12

## 実装範囲

### 1. iDeCo受取方法のUI

対象: `apps/retirement-life-planner-public/src/App.tsx`

要件:

- 汎用の収入種別 `oneTime` の表示名を `単発入金` から `一時金・単発入金` に変更する。
- `sourceAssetKey === "ideco"` の収入イベントでは、ラベルを `種別` ではなく `iDeCo受取方法` にする。
- iDeCo選択時の選択肢は次の2つに絞る。
  - `iDeCo年金受取（雑所得）`
  - `iDeCo一時金（一括受取・退職所得）`
- iDeCo以外の収入イベントでは、既存の収入種別選択を維持する。
- 原資資産をiDeCoへ変更したとき、現在の種別がiDeCoに不適切なら `pension` へ補正する。
- iDeCo一時金を選んだときは、既存どおり `endYearMonth = startYearMonth` にする。

### 2. iDeCo一時金入力欄

対象: `apps/retirement-life-planner-public/src/App.tsx`

既存のiDeCo一時金欄に、次を追加する。

- `加入開始日（任意）`
- `加入終了日（任意）`

既存欄は維持する。

- `受取年月`
- `一時金受取額`
- `加入年数`
- `退職所得の申告`

補助文:

```text
iDeCo年金受取は公的年金等の雑所得、一時金（一括受取）は退職所得として扱います。一時金は過去退職金との重複調整後の退職所得控除で概算し、国保・後期高齢者医療の所得割には含めません。加入開始日/終了日は任意です。未入力なら加入年数ベース、入力すると期間重複ベースで概算します。
```

### 3. 型定義

対象: `apps/retirement-life-planner-public/src/types.ts`

`IncomeEvent` に次を追加する。

```ts
idecoLumpSumContributionStartDate?: string;
idecoLumpSumContributionEndDate?: string;
```

### 4. 退職所得控除の重複調整

対象: `apps/retirement-life-planner-public/src/lib/retirementIncome.ts`

要件:

- `buildRetirementIncomeRecords` で、収入イベントとして登録されたiDeCo一時金を退職所得レコードへ変換するとき、次を渡す。
  - `serviceStartDate: event.idecoLumpSumContributionStartDate`
  - `serviceEndDate: event.idecoLumpSumContributionEndDate`
- 日付が揃っている場合は既存の `getDateRangeOverlapYears` により期間入力ベースで概算する。
- 日付が不足している場合は、従来どおり `Math.min(current.serviceYears, prior.serviceYears)` の年数ベースで概算する。
- 年数ベースの根拠文を次の趣旨に変える。

```text
勤続/加入年数は使っていますが、開始日・終了日が片方でも未入力のため、双方の年数の小さい方を重複年数として使った概算です。iDeCo一時金の加入開始日/終了日と、退職所得履歴の勤続開始日/終了日を入れると期間入力ベースになります。
```

### 5. テスト

対象: `apps/retirement-life-planner-public/src/lib/simulation.test.ts`

追加するケース:

- 収入イベントとして登録したiDeCo一時金に `idecoLumpSumContributionStartDate` と `idecoLumpSumContributionEndDate` がある場合、退職所得控除の重複調整が `precision: "dateBased"` になる。
- 同じケースで、日付重複がなければ `estimatedOverlapYears` が `0` になり、加入年数による控除がそのまま残る。

既存のiDeCo一時金テストを壊さないこと。

## 検証

必ず実行する。

```bash
npm --prefix apps/retirement-life-planner-public run test -- src/lib/simulation.test.ts
npm --prefix apps/retirement-life-planner-public run build
```

ブラウザ確認:

- `http://127.0.0.1:5176/`
- 収入画面で原資資産を `iDeCo から受取` にする。
- ラベルが `iDeCo受取方法` になること。
- 選択肢が `iDeCo年金受取（雑所得）` と `iDeCo一時金（一括受取・退職所得）` になること。
- iDeCo一時金を選ぶと `加入開始日（任意）` と `加入終了日（任意）` が出ること。
- 税金・社会保険タブの退職所得控除重複調整表で、年数ベース/期間入力ベースの説明が誤解なく表示されること。

## 注意

- 一般向け版にQNAP共有保存、実データ復旧、Chrome 5173等の個人用導線を戻さない。
- iDeCo一時金は雑所得ではなく退職所得として扱う。
- 国保・後期高齢者医療の所得割には含めない説明を維持する。
- 住民税は通常所得の翌年負担と混同させない。

## 別枠タスク: ローカル版の名称統一

ユーザー要望として、ローカル版 `apps/retirement-life-planner` もアプリ名を `人生資産シミュレーション` に変更する。

実装担当がこの別枠タスクも担当する場合は、次を行う。

- `apps/retirement-life-planner/index.html` のブラウザタイトルを変更する。
- `apps/retirement-life-planner/src/App.tsx` の画面主タイトルを変更する。
- 必要に応じてREADME等の旧名称を確認する。
- `npm --prefix apps/retirement-life-planner run build` を通す。
- `http://127.0.0.1:5175/` でタブタイトルと画面主タイトルを確認する。
