# 税・社会保険強化版

現行版とは別に、税・社会保険の詳細ロジックを段階導入する比較用アプリです。現行版と同じJSONを読み込み、差分を見ながら検証する前提で使います。

## 起動方法

```bash
npm install
npm run dev
```

比較用の固定URLは `http://127.0.0.1:5175/` です。

## テスト

```bash
npm test
```

## ビルド

```bash
npm run build
```

## 役割

- `apps/current`: 現行の安定版
- `apps/next-tax-social`: 税・社会保険強化版

