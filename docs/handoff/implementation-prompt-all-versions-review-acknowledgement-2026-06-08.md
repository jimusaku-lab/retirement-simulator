# 実装担当向けプロンプト: 確認推奨カードの確認済み機能

作成日: 2026-06-08

## 目的

入力状況サマリーの `確認推奨` が、ユーザー確認後も黄色のまま残り続ける問題を解消する。

特に `退職所得控除の重複調整` は、入力不足ではなく計算上の注意点である。ユーザーが内容を確認した後は `確認済み` として扱い、次対象・黄色強調から外す。ただし、関連する金額や年月などが変わった場合は再確認を求める。

## 対象

両方に反映する。

- ローカル版: `apps/retirement-life-planner`
- 公開版: `apps/retirement-life-planner-public`

主に確認するファイル:

- `apps/retirement-life-planner/src/App.tsx`
- `apps/retirement-life-planner-public/src/App.tsx`
- `apps/retirement-life-planner/src/types.ts`
- `apps/retirement-life-planner-public/src/types.ts`
- `apps/retirement-life-planner/src/store/usePlanStore.ts`
- `apps/retirement-life-planner-public/src/store/usePlanStore.ts`
- `apps/retirement-life-planner/src/data/sampleData.ts`
- `apps/retirement-life-planner-public/src/data/sampleData.ts`

## 最初に読む資料

- `docs/public-app/review-acknowledgement-design-2026-06-08.md`
- `docs/public-app/ux-guided-input-card-collapse-design.md`
- `docs/public-app/workplan.md` の Phase 15-G

## 現状確認

現状の公開版では、`退職所得控除の重複調整` のステータスが次のように決まっている。

```ts
status: retirementAdjustments.length > 0 ? "review_recommended" : "not_applicable"
```

このため、退職金とiDeCo一時金の重複調整が存在する限り、ユーザーがカードを開いて確認しても `確認推奨` のまま残る。

確認済みを保存する状態がないため、入力状況サマリーから黄色を消す方法がない。

## 実装方針

### 1. 確認済み状態を追加する

シナリオ単位で保存する。

```ts
type ReviewAcknowledgement = {
  cardId: InputCardId;
  fingerprint: string;
  acknowledgedAt: string;
};
```

`ScenarioData` に追加する。

```ts
reviewAcknowledgements?: ReviewAcknowledgement[];
```

### 2. ステータスに確認済みを追加する

推奨:

```ts
type InputCardStatus =
  | "not_started"
  | "incomplete"
  | "complete"
  | "review_recommended"
  | "reviewed"
  | "not_applicable"
  | "inactive";
```

表示:

- `review_recommended`: `確認推奨`
- `reviewed`: `確認済み`

完了扱い:

- `isInputCardSatisfied()` では `reviewed` を完了扱いにする。
- `isInputCardActionable()` では `reviewed` を対象外にする。
- `getNextInputCard()` では `reviewed` を次対象にしない。

### 3. fingerprintを作る

`退職所得控除の重複調整` 用に、現在の確認対象を表すfingerprintを生成する。

含める値:

- 対象イベントID
- 過去イベントID
- 受取年月
- 金額
- 勤続/加入年数
- 勤続/加入開始日
- 勤続/加入終了日
- 既受給
- 退職所得控除使用済み
- 源泉徴収税額
- 市町村民税
- 道府県民税
- 重複年数
- 調整後控除

実装は安定したJSON文字列化でよい。暗号学的ハッシュは不要。

### 4. 確認済みボタンを追加する

`退職所得控除の重複調整` カード内にボタンを置く。

表示例:

```text
この内容を確認済みにする
```

補助文:

```text
内容を確認済みにすると、入力状況サマリーでは未確認扱いから外れます。金額や日付を変更すると再確認が必要になります。
```

カードを開いただけでは確認済みにしない。

### 5. サマリー表示を変える

未確認時:

- 黄色
- `確認推奨`
- `未確認: 退職所得控除の重複調整`

確認済み時:

- 緑または中立色
- `確認済み`
- 黄色い次対象からは外す
- 詳細一覧には残してよい

### 6. 入力変更時に再確認へ戻す

fingerprintが変わったら、過去の確認済みは無効にする。

対象:

- 退職所得イベントの金額、年月、勤続/加入年数、開始日、終了日、既受給、控除使用済み、税額
- iDeCo一時金イベントの受取年月、一時金額、加入年数、加入開始日、加入終了日、申告区分

実装は、保存済みackを削除してもよいし、fingerprint不一致として無視してもよい。

## QA

必ず実行:

```bash
npm --prefix apps/retirement-life-planner run test -- src/lib/simulation.test.ts
npm --prefix apps/retirement-life-planner run build
npm --prefix apps/retirement-life-planner-public run test -- src/lib/simulation.test.ts
npm --prefix apps/retirement-life-planner-public run build
```

ブラウザ確認:

- ローカル版: `http://127.0.0.1:5175/`
- 公開版: `http://127.0.0.1:5176/`

確認項目:

- 退職所得控除の重複調整がある状態では、最初は `確認推奨` と表示される。
- 対象カードを開くだけでは `確認済み` にならない。
- `この内容を確認済みにする` を押すと、入力状況サマリーの黄色い次対象から外れる。
- 詳細一覧では `確認済み` と表示される。
- 金額、年月、勤続/加入期間などを変更すると、再び `確認推奨` になる。
- JSON保存・読込後も確認済み状態が維持される。
- 公開版にQNAP共有保存などのローカル専用機能を追加しない。

## 完了報告に含めること

- 変更したファイル
- 確認済み状態の保存形式
- fingerprintに含めた項目
- ローカル版と公開版の両方へ反映したか
- テストとビルド結果
- 5175 と 5176 のブラウザ確認結果
