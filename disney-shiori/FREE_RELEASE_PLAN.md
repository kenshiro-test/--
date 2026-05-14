# 無料公開に向けた方針

## 結論

無料で友達や一般ユーザーに使ってもらうなら、まずは無料枠のあるホスティングに置きます。

おすすめは次のどちらかです。

| 選択肢 | 向いているケース |
| --- | --- |
| Render Free Web Service | 今の Python サーバーをなるべくそのまま公開したい場合 |
| Cloudflare Pages + Workers + D1 | 将来的に無料枠で安定運用したい場合。ただし作り替えが少し大きい |

このリポジトリは、まず Render などの Python Web Service で動かせるようにしています。

## 今回対応したこと

- 管理者以外はショー・パレードのマスターデータを変更できない
- 一般ユーザーの予定は `dream_user_id` Cookie ごとに分離
- `database.json` ではなく SQLite の `dream_shiori.sqlite3` に保存
- 管理者パスワードは `ADMIN_PASSWORD_HASH` でハッシュ管理可能
- HTTPS 環境では `ADMIN_COOKIE_SECURE=true` で Secure Cookie に対応

## 無料公開時の注意

無料枠はサービス側の条件変更、スリープ、容量制限があり得ます。完全に永久無料を保証できる公開方法はありません。

SQLite を使う場合、無料ホスティングによってはデプロイのたびにファイルが消えることがあります。永続ディスクが無料で使えない環境では、Cloudflare D1 や Supabase Free などの無料DB枠を検討します。

## 本番環境変数

最低限、次を設定します。

```text
ADMIN_PASSWORD_HASH=pbkdf2_sha256$...
ADMIN_COOKIE_SECURE=true
```

必要に応じて SQLite ファイルの場所を指定します。

```text
DATABASE_FILE=/path/to/dream_shiori.sqlite3
```

## 管理者パスワードの作成

```bash
python3 make_admin_password_hash.py
```

14文字以上で、英大文字、英小文字、数字、記号を混ぜたパスワードを推奨します。

## 公開URL

Render や Cloudflare などの公開URLは HTTPS になります。独自ドメインを使わない場合でも、各サービスの標準ドメインで HTTPS が使えます。
