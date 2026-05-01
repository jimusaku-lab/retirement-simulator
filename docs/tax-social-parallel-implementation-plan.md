# 税・社会保険強化版の並行実装計画

## 目的

現在の退職後生活シミュレーターを壊さずに、税・社会保険の詳細ロジックを導入した新バージョンを並行して開発する。

現行版と新税社保版を同じ入力データで比較できる状態にし、計算結果の差分を確認しながら段階的に移行判断できるようにする。

## 現在の保存点

- Gitタグ: `v-current-before-tax-social-rewrite`
- 役割: 税・社会保険強化版に入る前の現行安定版
- 復元用途: 新バージョン側で計算ロジックが崩れた場合、現行版へ戻れる基準点

## 推奨フォルダ構成

```text
retirement-simulator/
  apps/
    current/
      現在の安定版アプリ
    next-tax-social/
      税・社会保険強化版アプリ
  docs/
    要件定義、調査レポート、設計メモ
  backups/
    復旧用JSON、実データバックアップ
```

## 移動対象

現行アプリとして `apps/current/` に移す対象:

- `src/`
- `public/`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `tailwind.config.ts`
- `postcss.config.js`
- `README.md`
- `scripts/`

ドキュメントとして `docs/` に置く候補:

- `retirement_sim_requirements_codex.md`
- `retirement_sim_usage_guide.md`
- `deep-research-report.md`

バックアップとして `backups/` に置く候補:

- `recovered_retirement_5173_from_chrome.json`
- `recovered_retirement_5173_state.json`
- `retirement-simulation-backup-*.json`

個人資料、PDF、画像、CSV、調査用フォルダは今回のGit管理対象から外す。必要な場合だけ別途移動する。

## 起動設計

現行版:

```bash
npm run serve:current
```

- URL: `http://127.0.0.1:5174/`
- 目的: 現在の安定版をそのまま確認する

新税社保版:

```bash
npm run serve:next-tax-social
```

- URL: `http://127.0.0.1:5175/`
- 目的: 新ロジックを確認する

比較確認:

```bash
npm run test:current
npm run test:next-tax-social
```

## 新税社保版で導入する主な設計

1. 所得区分の分離
   - 給与
   - 公的年金等
   - 雑所得
   - 退職所得
   - 譲渡所得
   - 非課税収入

2. iDeCo出口戦略の分離
   - 年金受取
   - 一時金受取
   - 一時金 + 年金

3. 公的年金等控除の完全テーブル化
   - 年齢
   - 年金収入額
   - 公的年金等以外の所得区分

4. 所得控除の拡張
   - 社会保険料控除
   - 医療費控除
   - セルフメディケーション税制

5. 大田区社会保険料の制度別分離
   - 国民健康保険
   - 介護保険
   - 後期高齢者医療

6. 申告判定
   - 所得税の申告義務
   - 還付目的の申告有利判定
   - 住民税申告要否

## 実装順序

1. 現行版を `apps/current/` に退避する
2. 現行版をコピーして `apps/next-tax-social/` を作る
3. ルートの `package.json` をワークスペース管理に変更する
4. 現行版を `5174`、新税社保版を `5175` で起動できるようにする
5. 現行版のテスト・ビルドが通ることを確認する
6. 新税社保版の初期コピーでもテスト・ビルドが通ることを確認する
7. 新税社保版だけに税・社会保険の詳細ロジックを段階導入する

## 注意点

- 現行版の計算ロジックは原則変更しない
- 新税社保版で得た改善を現行版へ逆流させない
- 実データ復旧JSONは両方のアプリで読み込める形式を維持する
- 新税社保版の計算が正しいと確認できるまでは、ユーザー判断用のメイン表示は現行版を基準にする
- Gitでは大きな移動とロジック変更を同じコミットに混ぜない

## 次の作業単位

次に実施する作業は、フォルダ再編だけに限定する。

- `apps/current/` 作成
- `apps/next-tax-social/` 作成
- 既存アプリを両方に配置
- 起動スクリプト追加
- ビルドとテスト確認

税・社会保険ロジックの実装は、その次のコミットから開始する。
