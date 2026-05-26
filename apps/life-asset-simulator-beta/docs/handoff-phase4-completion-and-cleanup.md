# 退職後シミュレーション フェーズ4完了・引き継ぎ資料

作成日: 2026-05-18  
対象アプリ: `apps/retirement-life-planner`  
ローカルURL: `http://127.0.0.1:5175/`  
完了コミット: `6d4c233d Improve retirement simulator phase 4 UX`

## 1. 現在の状態

フェーズ4の実装・検証・Git保存は完了済みです。

直近コミット:

```text
6d4c233d Improve retirement simulator phase 4 UX
```

直前の安定コミット:

```text
9b3faca3 Add special expense inflation settings
```

検証済みコマンド:

```bash
npm run build
npm test
npm run serve:local
```

最終テスト結果:

```text
8 test files passed
151 tests passed
```

公開済みローカル版:

```text
http://127.0.0.1:5175/
```

## 2. フェーズ4で完了した主な改善

### 2.1 比較タブ

- 比較基準シナリオを明示的に選べるようにした。
- 比較基準はシナリオの並び順に依存しない。
- 比較基準 `baselineScenarioId` を保存データへ追加した。
- JSON出力、JSON読込、履歴復元でも比較基準が維持される。
- 古い保存データに `baselineScenarioId` がない場合は、比較対象の先頭、なければ先頭シナリオを基準にする。
- 基準シナリオ削除時は、次の比較対象へ自動で切り替える。
- 複数シナリオ比較表は、意思決定に必要な主要列へ整理した。
- `基準との差分要約` の大きな列は主表から外し、折りたたみ内の「比較基準と入力差分」へ移した。

### 2.2 ダッシュボード

- 上部を占有していた「基準との差分」は折りたたみ・下方配置へ整理した。
- 資産活用集計期間カードをコンパクト化した。
- 資産活用集計期間から基本情報の該当欄へ移動できる導線を追加した。
- 資産活用ウォーターフォールを追加した。
- ウォーターフォールでは、収入・支出の明細と、ネットの「現金収支」「資産活用額」を見分けやすくした。

### 2.3 資産活用ビュー / タイムバケット

- 資産活用ビューの導線を、`タイムバケット -> クイック試算 -> 資産レビュー -> 入金力診断` の順に整理した。
- タイムバケットを `apps/retirement-life-planner` に統合した。
- タイムバケット項目は、置いただけでは計算に入らない。
- 明示的に特別支出へ変換したものだけが計算対象になる。
- 変換時に、カテゴリ、計算方式、インフレ反映、終了年月を設定できる。
- 変換済み項目は、タイムバケット側で特別支出の要約を確認できる。
- タイムバケット側からリンク先の特別支出を確認、リンク解除、削除できる。
- 特別支出側からも「タイムバケット由来」が分かり、タイムバケットへ戻れる。
- タイムバケットの他シナリオ反映を追加した。
- 反映時は「タイムバケットだけ」または「支出化済み特別支出も含める」を明示選択する。

### 2.4 他シナリオへ反映

- 基本情報にも他シナリオ反映ボタンを追加した。
- 初期資産、生活費、収入、特別支出、タイムバケットで、反映先を分かりやすくした。
- 反映先の選択肢を `比較対象にチェック済み`、`個別に選択`、`全シナリオ` に整理した。
- `比較対象シナリオ` という曖昧な表現は削除した。
- 実行前の確認ダイアログに、反映先シナリオ名を表示する。
- 画面上は反映先が多い場合、先頭6件と `ほかN件` に省略して表示する。

### 2.5 税・社会保険 / 譲渡益課税

- `売却時控除税` という分かりにくい表記を `売却時譲渡益税` に変更した。
- 譲渡益課税の根拠表示を追加した。
- `売却・移動発生額`、`取得原価部分`、`実現譲渡益`、`売却時譲渡益税`、`翌年・申告扱い`、`手取り額`、`理由`、`扱い` を確認できる。
- 特定口座の源泉徴収ありは、売却時に譲渡益税を差し引き、申告対象損益や社会保険料には入れない。
- 普通口座オプションの申告対象損益は、翌年の所得税・住民税・国保などへ反映する。
- 税社保タブに計算前提、年度ラベル、普通口座オプション利益の扱いを明示した。

### 2.6 扶養表現

- `世帯主の扶養` を `税計算上の扶養・配偶者控除` に変更した。
- 健康保険の扶養、国保加入、税計算上の配偶者控除が別物であることを説明文で補足した。
- 将来の扶養・国保変更予定も同じ表現に合わせた。

## 3. 追加された主なファイル

```text
apps/retirement-life-planner/docs/handoff-phase4-current-state.md
apps/retirement-life-planner/docs/phase4-improvement-design.md
apps/retirement-life-planner/docs/handoff-phase4-completion-and-cleanup.md
apps/retirement-life-planner/src/components/TimeBucketPlanner.tsx
apps/retirement-life-planner/src/lib/scenarioDiff.ts
apps/retirement-life-planner/src/lib/scenarioDiff.test.ts
apps/time-bucket-planner/
```

`apps/time-bucket-planner/` は、別アプリとして作られたタイムバケット・プランナーです。  
`apps/retirement-life-planner` には、その考え方を取り込んだ `TimeBucketPlanner.tsx` が統合されています。

## 4. 変更された主なファイル

```text
apps/retirement-life-planner/src/App.tsx
apps/retirement-life-planner/src/types.ts
apps/retirement-life-planner/src/store/usePlanStore.ts
apps/retirement-life-planner/src/store/usePlanStore.test.ts
apps/retirement-life-planner/src/lib/flexibleFreeCash.ts
apps/retirement-life-planner/src/lib/flexibleFreeCash.test.ts
apps/retirement-life-planner/src/lib/simulation.ts
apps/retirement-life-planner/src/lib/simulation.test.ts
apps/retirement-life-planner/src/data/sampleData.ts
package.json
```

## 5. 次スレッドでの最初の確認

次スレッドでは、まず以下を実行してください。

```bash
cd "/Users/motomichi/Documents/30_ファイナンス（作業中）/apps/retirement-life-planner"
git log -1 --oneline
npm run build
npm test
npm run serve:local
```

期待する直近コミット:

```text
6d4c233d Improve retirement simulator phase 4 UX
```

期待するURL:

```text
http://127.0.0.1:5175/
```

## 6. 残件

### 6.1 アプリ機能上の残件

フェーズ4として必須の残件はありません。  
ただし、次フェーズ以降で検討するとよい改善はあります。

- 比較タブのチャートをさらに整理する。
- 大きいJavaScriptチャンクの分割を検討する。
- タイムバケットから特別支出化した後の編集導線をさらに滑らかにする。
- 税・社会保険タブの根拠表示を、ユーザー向けヘルプとしてさらに短く畳む。
- JSONバックアップ一覧や復元画面を、より安全に見せる。

### 6.2 計算ロジック上の注意残件

- 今回は計算エンジンの大規模置き換えはしていない。
- 追加した譲渡益課税根拠表示は、既存シミュレーションの計算結果を可視化するためのもの。
- 特定口座の源泉徴収ありは、売却時控除として扱い、翌年申告損益には入れない。
- 普通口座オプションは、申告対象損益として翌年の税社保側に反映する。
- これらの前提を変える場合は、`src/lib/simulation.test.ts` に回帰テストを追加する。

## 7. フォルダ整理の現状

Git上、アプリ改善コミット後に残っている未追跡ファイルは、主に親フォルダ `/Users/motomichi/Documents/30_ファイナンス（作業中）` 直下の資料類です。  
今回のアプリ改善コミットには含めていません。

代表例:

```text
20260316_nenkinshisan_01_01.csv
20260316_ねんきん定期便.pdf
60代からのマネーマシーン早見表.pdf
Die_with_Zero観点_UI改善提案レポート.md
UI_DESIGN_RULES.md
dashboard_phase3_improvement_memo.md
deep-research-report.md
handoff_next_tax_social.md
retirement_sim_requirements_codex.md
retirement_sim_usage_guide.md
自分用アプリ完成版_改善提案レポート.md
譲渡益課税根拠表示_設計提案.md
確定申告/
社会保険料の試算/
マネースクール/
お役立ち補足資料集 鳥海翔の騙されない金融学/
```

整理方針の提案:

```text
30_ファイナンス（作業中）/
  apps/
    retirement-life-planner/
    time-bucket-planner/
  docs/
    app-requirements/
    tax-social/
    pension/
    ui-research/
    backups/
  source-materials/
    pdf/
    csv/
    images/
```

ただし、フォルダ整理はファイル移動を伴うため、次スレッドでユーザー確認を取ってから実行すること。  
特にPDF、CSV、確定申告、社会保険料の試算フォルダは、アプリ外の資料として使っている可能性があるため、勝手に移動しない。

## 8. 注意事項

- Git作業ツリー上、アプリ本体のフェーズ4差分はコミット済み。
- 未追跡ファイルは、アプリ本体の未保存差分ではない。
- 次にフォルダ整理を行う場合、まず `git status --short` と `find` で対象を確認する。
- `node_modules`、`.git`、`.codex-runtime`、`dist` は通常整理対象にしない。
- アプリの動作確認は `http://127.0.0.1:5175/` を使う。

## 9. 次スレッドへの推奨依頼文

次スレッドを始める場合は、以下のように依頼するとよいです。

```text
退職後シミュレーションアプリのフェーズ4はコミット 6d4c233d で完了済みです。
apps/retirement-life-planner/docs/handoff-phase4-completion-and-cleanup.md を読んで、現在状態を確認してください。
次はフォルダ整理をしたいです。未追跡ファイルを分類し、移動してよいもの・確認が必要なものを分けて提案してください。
勝手にファイル移動せず、まず整理案を出してください。
```
