# 初回ウィザード 実装メモ

作成日: 2026-05-19

対象: `apps/retirement-life-planner-public`

## 実装済み

初回設定ウィザードの初期版を追加した。

実装ファイル:

- `src/components/OnboardingWizard.tsx`
- `src/App.tsx`

## ステップ

1. 家族
2. 資産
3. 収入
4. 支出
5. 前提
6. やりたいこと
7. 結果

## 標準入力に含めたもの

- 本人の年齢
- 配偶者の有無と年齢
- 退職状況
- シミュレーション開始年月
- 何歳まで見るか
- 残高確認年齢と残したい金額
- 現金・預金
- NISA
- iDeCo
- 課税口座
- その他運用資産
- その他資産
- 負債
- 年金見込み額
- 年金受給開始年齢
- 給与・パート等
- iDeCo受取予定
- 退職金・一時金の有無
- 毎月の生活費
- 住宅費
- 医療・介護費
- 大きな予定支出
- 年齢別生活費変更
- インフレ率
- 資産別利回り
- 税社保計算方法
- やりたいこと

## 反映方法

ウィザード入力は `OnboardingDraft` として保持し、保存時に表示中の `ScenarioData` へ反映する。

反映する主な領域:

- `userProfile`
- `householdProfile`
- `householdMembers`
- `initialAssets`
- `initialAssetCostBasis`
- `monthlyExpenses`
- `ageExpenseAdjustments`
- `incomeEvents`
- `specialExpenses`
- `timeBucketItems`
- `assetGrowthSettings`
- `inflationSettings`

## 確認済み

- `npm run test:public`: 151件成功
- `npm run build:public`: 成功
- `http://127.0.0.1:5176/` でウィザードを開ける
- 7ステップを進める
- 結果ステップでドラフト値に基づく試算プレビューが表示される
- 保存するとダッシュボードへ戻る
- ヘッダーの `初回設定` から再表示できる

## 残課題

- 匿名サンプルデータへ置き換える
- 既存のシナリオ名を一般向けに変更する
- 初回ウィザードのUIをさらに磨く
- スマートフォン幅での表示確認を追加する
- 詳細入力への案内カードをダッシュボードへ追加する
