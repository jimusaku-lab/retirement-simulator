# GitHub Pages 限定公開準備

作成日: 2026-05-21

## 方針

協力者にはURLだけを送る。

協力者はインストール不要で、ブラウザで開いて試す。

入力した内容は、ご利用中のパソコンやスマートフォン内に保存される。アプリ作成者へ自動送信する機能は入れない。

## 公開対象

- アプリ: `apps/retirement-life-planner-public`
- 公開ビルド: `apps/retirement-life-planner-public/dist`
- GitHub Pages用ビルド: `GITHUB_PAGES=true npm run build:public`

## GitHub Actions

`.github/workflows/deploy-pages.yml` は一般向けアプリを公開する設定にする。

実行内容:

1. 依存関係を入れる
2. `npm run test:public`
3. `GITHUB_PAGES=true npm run build:public`
4. `apps/retirement-life-planner-public/dist` をGitHub Pagesへ公開

## GitHub側で必要な設定

GitHubのリポジトリ画面で次を確認する。

1. Settings を開く
2. Pages を開く
3. Source を GitHub Actions にする
4. Actions から `Deploy public retirement life planner` を手動実行する

## 協力者へ送るもの

- 公開URL
- `docs/public-app/collaborator-message-short.md` の短い案内文

## 注意

URLを知っている人は開ける。完全な秘密ページではない。

協力者以外へ広げない運用にする。

検索やSNSで広く案内するのは、一般公開準備が終わってからにする。
