# Cloudflare Tunnel セットアップ手順

LINE Webhook URL を固定化するための Cloudflare Tunnel 導入ガイド。
Windows 個人運用前提。

---

## 前提条件

- Cloudflare アカウントがある
- Cloudflare で管理しているドメインがある（無料で取得可能: https://www.cloudflare.com/）
- `npm run dev` が `localhost:3000` で動いている

---

## Step 1: cloudflared をインストール

### 方法A: winget（推奨）
```powershell
winget install --id Cloudflare.cloudflared
```

### 方法B: 手動ダウンロード
1. https://github.com/cloudflare/cloudflared/releases/latest から
   `cloudflared-windows-amd64.exe` をダウンロード
2. `C:\Windows\System32\cloudflared.exe` にリネームして配置
   （またはパスが通ったフォルダに置く）

### インストール確認
```cmd
cloudflared --version
```

---

## Step 2: Cloudflare にログイン

```cmd
cloudflared tunnel login
```

→ ブラウザが開くので Cloudflare アカウントでログイン
→ ドメインを選択して「Authorize」
→ `C:\Users\<あなたのユーザー名>\.cloudflared\cert.pem` が生成される

---

## Step 3: トンネルを作成

```cmd
cloudflared tunnel create crm-line
```

→ 成功すると以下が表示される:
```
Created tunnel crm-line with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

→ 認証ファイルが生成される:
```
C:\Users\<USERNAME>\.cloudflared\xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json
```

**表示された UUID をメモしてください（config.yml に使います）**

---

## Step 4: config.yml を編集

`cloudflare-tunnel/config.yml` を開いて以下を書き換える:

| 項目 | 置き換える内容 |
|---|---|
| `YOUR_TUNNEL_ID_HERE` | Step 3 で取得した UUID |
| `YOUR_USERNAME` | Windows のユーザー名（例: `aki11`） |
| `YOUR_DOMAIN_HERE` | 使用するドメイン（例: `example.com`）|

**編集例:**
```yaml
tunnel: a1b2c3d4-1234-5678-abcd-ef0123456789
credentials-file: C:\Users\aki11\.cloudflared\a1b2c3d4-1234-5678-abcd-ef0123456789.json

ingress:
  - hostname: crm.example.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## Step 5: DNS を設定（Cloudflare側）

```cmd
cloudflared tunnel route dns crm-line crm.YOUR_DOMAIN_HERE
```

→ Cloudflare DNS に CNAME レコードが自動追加される
→ `crm.example.com` → Cloudflare Tunnel にルーティングされる

---

## Step 6: 動作確認

```cmd
cloudflared tunnel --config C:\crm\app\cloudflare-tunnel\config.yml run
```

→ 接続成功すると以下のようなログが出る:
```
INF Connection established connIndex=0
INF Connection established connIndex=1
```

→ ブラウザで `https://crm.YOUR_DOMAIN_HERE` にアクセスして確認

---

## Step 7: LINE Webhook URL を設定

LINE Developers Console で設定する固定 URL:

```
https://crm.YOUR_DOMAIN_HERE/api/line/webhook
```

設定場所:
1. https://developers.line.biz/console/ を開く
2. チャンネルを選択
3. Messaging API タブ
4. Webhook URL に上記 URL を貼り付け
5. 「更新」→「検証」

**この URL は PC を再起動しても変わりません。**

---

## 日常の使い方

```cmd
C:\crm\app\start-crm-cloudflare.bat
```

→ npm run dev と Cloudflare Tunnel が同時に起動
→ Webhook URL は常に固定（設定変更不要）

---

## ngrok との比較

| 項目 | Cloudflare Tunnel | ngrok（無料プラン） |
|---|---|---|
| URL | **固定** | 再起動のたびに変わる |
| 料金 | **無料**（ドメイン代のみ） | 無料（有料プランで固定URL） |
| 安定性 | **高い**（Cloudflare CDN経由） | 普通 |
| 速度 | **速い**（CDN最適化） | 普通 |
| 設定の手軽さ | ドメイン取得が必要 | **即使える** |
| LINE本番運用 | **向いている** | 開発・テスト向き |
| 認証 | Cloudflareアカウント | ngrokアカウント |

**結論:**
- 開発・動作確認 → ngrok（手軽）
- 本番・長期運用 → Cloudflare Tunnel（安定・固定URL）
