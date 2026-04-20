@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

echo ============================================
echo   CRM Dev + Cloudflare Tunnel Launcher
echo ============================================
echo.

cd /d C:\crm\app

REM --- cloudflared インストール確認 ---
where cloudflared > nul 2>&1
if errorlevel 1 (
    echo [ERROR] cloudflared が見つかりません
    echo.
    echo インストール方法:
    echo   winget install --id Cloudflare.cloudflared
    echo.
    echo または cloudflare-tunnel\SETUP.md を参照してください
    echo.
    pause
    exit /b 1
)

REM --- config.yml の存在確認 ---
if not exist "C:\crm\app\cloudflare-tunnel\config.yml" (
    echo [ERROR] config.yml が見つかりません
    echo   cloudflare-tunnel\config.yml を確認してください
    echo.
    pause
    exit /b 1
)

REM --- config.yml がデフォルト値のままかチェック ---
findstr /C:"YOUR_TUNNEL_ID_HERE" "C:\crm\app\cloudflare-tunnel\config.yml" > nul 2>&1
if not errorlevel 1 (
    echo [ERROR] config.yml がまだ初期状態です
    echo.
    echo セットアップが必要です:
    echo   cloudflare-tunnel\SETUP.md を読んで設定してください
    echo.
    pause
    exit /b 1
)

REM --- Step 1: npm run dev ---
echo [1/3] npm run dev を起動中...
start "CRM Dev Server" cmd /k "cd /d C:\crm\app && npm run dev"
timeout /t 3 /nobreak > nul
echo       OK: http://localhost:3000 で起動しました
echo.

REM --- Step 2: Cloudflare Tunnel ---
echo [2/3] Cloudflare Tunnel を起動中...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --config C:\crm\app\cloudflare-tunnel\config.yml run"
echo       Cloudflare Tunnel を起動しました
echo       (接続確立まで数秒かかります)
timeout /t 5 /nobreak > nul
echo.

REM --- Step 3: Webhook URL 表示 ---
echo [3/3] LINE Webhook URL を確認中...
echo.

REM config.yml から hostname を抽出
set HOSTNAME=
for /f "tokens=2 delims=: " %%a in ('findstr /C:"hostname:" "C:\crm\app\cloudflare-tunnel\config.yml"') do (
    set HOSTNAME=%%a
)

echo ============================================
echo   LINE Webhook 設定情報（固定URL）
echo ============================================
echo.

if "!HOSTNAME!"=="" (
    echo [WARN] config.yml から hostname を読み取れませんでした
    echo   config.yml の hostname 行を確認してください
    echo.
    echo   Webhook URL の形式:
    echo     https://あなたのドメイン/api/line/webhook
) else (
    echo   公開URL:
    echo     https://!HOSTNAME!
    echo.
    echo   LINE Webhook URL:
    echo     https://!HOSTNAME!/api/line/webhook
    echo.
    echo   ★ この URL は PC を再起動しても変わりません
)

echo.
echo ============================================
echo.
echo LINE Developers Console でこのURLを設定:
echo   https://developers.line.biz/console/
echo   チャンネル設定 ^> Messaging API ^> Webhook URL
echo.
echo ============================================
echo.
echo ※ 詳細なセットアップ手順: cloudflare-tunnel\SETUP.md
echo.
pause
