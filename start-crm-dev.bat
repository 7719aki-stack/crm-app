@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

echo ============================================
echo   CRM Dev + ngrok Launcher
echo ============================================
echo.

cd /d C:\crm\app

REM --- Step 1: npm run dev ---
echo [1/3] npm run dev を起動中...
start "CRM Dev Server" cmd /k "cd /d C:\crm\app && npm run dev"
timeout /t 3 /nobreak > nul
echo       OK: http://localhost:3000 で起動しました
echo.

REM --- Step 2: ngrok ---
echo [2/3] ngrok を起動中...
where ngrok > nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] ngrok が見つかりません
    echo   インストール: https://ngrok.com/download
    echo   またはパスが通っていません
    echo.
    pause
    exit /b 1
)
start "ngrok tunnel" cmd /k "ngrok http 3000"
echo       ngrok 起動中... 8秒待機
timeout /t 8 /nobreak > nul
echo.

REM --- Step 3: Get ngrok URL ---
echo [3/3] ngrok 公開URLを取得中...
set NGROK_URL=
for /f "usebackq delims=" %%i in (`powershell -NoProfile -NonInteractive -Command ^
    "try { $r = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -ErrorAction Stop; $u = ($r.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url; if ($u) { $u } else { 'ERR_NO_URL' } } catch { 'ERR_API_FAIL' }"`) do (
    set NGROK_URL=%%i
)

echo.

if "!NGROK_URL!"=="ERR_API_FAIL" (
    echo [ERROR] ngrok API (port 4040) に接続できませんでした
    echo   - ngrok がまだ起動中の可能性があります (もう少し待ってください)
    echo   - ngrok ウィンドウを確認してください
    echo   - 手動確認: http://127.0.0.1:4040
    echo.
    pause
    exit /b 1
)

if "!NGROK_URL!"=="ERR_NO_URL" (
    echo [ERROR] ngrok は起動していますが HTTPS URL が取得できませんでした
    echo   - ngrok ウィンドウでエラーを確認してください
    echo   - 認証: ngrok authtoken ^<your-token^>
    echo.
    pause
    exit /b 1
)

if "!NGROK_URL!"=="" (
    echo [ERROR] URL の取得に失敗しました (空レスポンス)
    echo   - http://127.0.0.1:4040 を手動で確認してください
    echo.
    pause
    exit /b 1
)

echo ============================================
echo   LINE Webhook 設定情報
echo ============================================
echo.
echo   公開URL:
echo     !NGROK_URL!
echo.
echo   LINE Webhook URL (コピーして使用):
echo     !NGROK_URL!/api/line/webhook
echo.
echo ============================================
echo.
echo LINE Developers Console でこのURLを設定:
echo   https://developers.line.biz/console/
echo   チャンネル設定 - Messaging API - Webhook URL
echo.
echo ※ ngrok を再起動するたびにURLが変わります
echo ============================================
echo.
pause
