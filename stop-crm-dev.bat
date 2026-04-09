@echo off
chcp 65001 >nul
title CRM Dev - Stop

echo.
echo  ====================================
echo   Love CRM - Dev Server 停止
echo  ====================================
echo.

:: ── ポート3000を使用中のプロセスを終了 ──────────────
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    echo  [INFO] PID %%a を終了します...
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)

if %FOUND% == 1 (
    echo  [OK] サーバーを停止しました。
) else (
    echo  [INFO] 起動中のサーバーは見つかりませんでした。
)

echo.
pause
