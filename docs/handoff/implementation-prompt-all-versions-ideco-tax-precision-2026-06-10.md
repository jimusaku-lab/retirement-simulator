# 実装担当向けプロンプト: iDeCo一時金税制ロジック精密化（ローカル版・一般向け版）

あなたは実装担当です。以下の設計監査メモを読み、ローカル版と一般向け版の両方へ同じ税制ロジック修正を入れてください。

- 監査メモ: `docs/public-app/ideco-lump-sum-tax-logic-audit-2026-06-10.md`
- ローカル版: `apps/retirement-life-planner`
- 一般向け版: `apps/retirement-life-planner-public`

## 実装対象

### 1. 退職所得金額の端数処理を修正

現行の `Math.round((gross - deduction) / 2)` 系を、次に統一してください。

```ts
const taxableRetirementIncome = floorToThousand(Math.max(0, (gross - deduction) / 2));
```

`floorToThousand` は 1,000円未満切捨てです。

対象候補:

- `apps/retirement-life-planner/src/lib/simulation.ts`
- `apps/retirement-life-planner-public/src/lib/simulation.ts`
- `apps/retirement-life-planner/src/lib/taxEngine.ts`
- `apps/retirement-life-planner-public/src/lib/taxEngine.ts`
- `apps/retirement-life-planner/src/lib/retirementIncome.ts`
- `apps/retirement-life-planner-public/src/lib/retirementIncome.ts`

### 2. 所得税・復興特別所得税の端数処理を切捨てへ

退職所得に対する所得税・復興特別所得税は、累進税率・控除後に 102.1% を掛け、1円未満切捨てにしてください。

```ts
const baseIncomeTax = taxableRetirementIncome * rate - quickDeduction;
const nationalTax = Math.floor(Math.max(0, baseIncomeTax) * 1.021);
```

通常の総合所得税計算も同じ丸めポリシーにするかは影響範囲が大きいため、まずは退職所得専用関数で正確化してください。

### 3. 退職所得に係る住民税を 6% + 4% に分ける

現行の `taxableRetirementIncome * 0.1` 近似を、以下へ変更してください。

```ts
const municipalResidentTax = floorToHundred(taxableRetirementIncome * 0.06);
const prefecturalResidentTax = floorToHundred(taxableRetirementIncome * 0.04);
const residentTax = municipalResidentTax + prefecturalResidentTax;
```

表示上も、必要なら「住民税（市区町村6% + 都道府県4%）」として内訳を出せるようにしてください。

### 4. 重複期間の年数計算を修正

`getDateRangeOverlapYears` の `Math.ceil(overlapMonths / 12)` は、退職所得控除の重複調整用途では不適切です。

日付ベースで重複期間を計算する場合、1年未満端数は切捨てにしてください。

```ts
const overlapYears = Math.floor(overlapMonths / 12);
```

月数の数え方は既存UIの年月入力と矛盾しないようにし、以下のテストを追加してください。

- 重複11か月: 0年
- 重複12か月: 1年
- 重複13か月: 1年

注意: 通常の勤続年数・iDeCo拠出年数は端数切上げです。重複期間だけ端数切捨てになるため、共通関数化する場合は用途名を明確にしてください。

### 5. iDeCo加入期間を月数・日付ベースで扱う

現行の「加入年数」だけでは、iDeCo公式FAQの「拠出月数を年換算して端数切上げ」を厳密に満たせません。

実装方針:

1. 加入開始日・加入終了日が入力されている場合は、拠出月数を算出し、控除年数を端数切上げ。
2. 拠出月数を直接持てる型にする場合は、その月数を正とする。
3. 年数だけの場合は、既存互換として「控除年数（端数切上げ済み）」とみなし、概算表示を出す。

UI文言は「加入年数」ではなく、少なくとも「iDeCo拠出年数（1年未満切上げ）」または「加入・拠出期間」にしてください。

### 6. 失業手当を原則非課税にする

収入イベント `type === "unemployment"` は、初期値として `taxTreatment: "nonTaxable"` にしてください。

既存データで課税設定になっているものを自動変換するかは別途判断ですが、新規追加時は非課税をデフォルトにしてください。

### 7. 表示ラベルを修正

iDeCo一時金の「提出あり」では、所得税・復興特別所得税だけでなく、退職所得に係る住民税相当も即時計算に入れています。表示上「源泉徴収税額」と呼ぶと不正確です。

表示候補:

- 退職所得税額（所得税等 + 住民税）
- iDeCo一時金の税額見積
- 提出なしの場合のみ「源泉徴収 20.42%」

内部変数名も可能なら `idecoWithholdingTaxTotal` から用途別に分けてください。

## 追加テスト

両版に同じテストを追加してください。

### iDeCo一時金 800万円・15年・重複なし

期待値:

- 退職所得控除: 600万円
- 退職所得金額: 100万円
- 所得税・復興特別所得税: 51,050円
- 住民税: 100,000円
- 合計: 151,050円

### iDeCo一時金 1,200万円・25年・重複なし

期待値:

- 退職所得控除: 1,150万円
- 退職所得金額: 25万円
- 所得税・復興特別所得税: 12,762円
- 住民税: 25,000円
- 合計: 37,762円

### 重複期間

- 重複11か月: 0年
- 重複12か月: 1年
- 重複13か月: 1年

### 退職所得申告なし

- 受取総額 × 20.42% が源泉徴収として即時控除されること。
- 確定申告で精算対象である旨の表示が崩れないこと。

### 税社保への反映

- iDeCo一時金は公的年金等・雑所得に入らない。
- iDeCo一時金は国保・後期高齢者医療の所得判定に入らない。
- iDeCo年金受取は公的年金等・雑所得に入り、翌年の住民税・社保計算に反映される。
- 普通口座の米国株式オプション等の申告所得は、翌年の住民税・社保計算に反映される。
- 失業手当は非課税扱いで税社保所得判定に入らない。

## 完了条件

- `apps/retirement-life-planner` のテストが通る。
- `apps/retirement-life-planner-public` のテストが通る。
- 既存の iDeCo一時金・退職所得重複調整 UI が壊れていない。
- 一般向け版で、ユーザーが「iDeCo一時金は雑所得ではなく退職所得」「提出なしは20.42%源泉」「2025年退職金後の受取は重複調整対象」と理解できる表示になっている。
