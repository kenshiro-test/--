# 公開手順

## 方針

友達やスマホから使えるようにする公開版は、次の構成を想定します。

- 画面: GitHub Pages
- 保存先: Supabase Free
- 一般ユーザー: Supabase Anonymous Sign-In でユーザーごとに予定とメモを分離
- 管理者: Supabase Auth のメール/パスワードでログインし、ショー・パレードのマスターデータだけ更新
- 公式サイト確認: 毎月10日の確認タスクで、取れた分だけ更新し、失敗分は履歴に残す

GitHub Pages は静的サイトを公開する仕組みなので、`server.py` は公開版では使いません。ローカル開発用として残します。

## 1. Supabase を作る

1. Supabase で新規プロジェクトを作成します。
2. Authentication の Anonymous Sign-Ins を有効化します。
3. Authentication の Users で管理者用ユーザーを作成します。
4. SQL Editor で [supabase-schema.sql](./supabase-schema.sql) を実行します。
5. `admin_users` に管理者ユーザーIDを追加します。

```sql
insert into public.admin_users (user_id)
values ('SUPABASE_ADMIN_USER_ID');
```

6. Storage で `show-images` バケットを作成します。
7. 画像を公開URLで使う場合は、`show-images` バケットを Public にします。

## 2. アプリに Supabase 情報を入れる

[supabase-config.js](./supabase-config.js) を編集します。

```js
window.DREAM_SUPABASE_CONFIG = {
    url: "https://YOUR_PROJECT_ID.supabase.co",
    anonKey: "YOUR_SUPABASE_ANON_KEY",
    imageBucket: "show-images"
};
```

`anonKey` はブラウザに入れて使う公開キーです。安全性は [supabase-schema.sql](./supabase-schema.sql) の RLS で守ります。

## 3. 初期データを登録する

公開URLを開いたあと、`?admin=true` を付けて管理者ログインします。

```text
https://ユーザー名.github.io/リポジトリ名/index.html?admin=true
```

管理者画面で内容を確認し、Supabaseで作成した管理者メールアドレスとパスワードでログインし、`変更を保存` を押すと Supabase の `global_data` にマスターデータが保存されます。

## 4. GitHub Pages で公開する

1. GitHub にこのリポジトリを push します。
2. GitHub のリポジトリ設定で Pages を開きます。
3. Source を `Deploy from a branch` にします。
4. Branch を `main`、Folder を `/root` にします。
5. 発行された `https://...github.io/.../` のURLをスマホや友達に共有します。
6. HTTPS enforce が選べる場合は有効にします。

## 5. 公開後の運用

- 一般ユーザーの予定とメモは `user_data` にユーザーごとに保存されます。
- ショー・パレードのマスターデータは `admin_users` に登録した管理者だけ更新できます。
- 公式サイト確認は毎月10日のタスクで行い、通信失敗は管理者画面の自動取り込み履歴で確認します。
- Supabase Free は容量や停止条件があります。友達数人から数十人で使う程度ならまずは無料枠で様子を見る想定です。

## 参考

- GitHub Pages は HTML/CSS/JavaScript を公開できる静的ホスティングです。
- GitHub Pages は `github.io` ドメインで HTTPS が自動提供されます。
- Supabase Anonymous Sign-In は個人情報なしでユーザーごとの保存に使えます。
- Supabase では公開ブラウザアプリからDBを使う場合、RLSでテーブルを保護します。
