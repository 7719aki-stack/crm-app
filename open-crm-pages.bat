@echo off
chcp 65001 >nul
title CRM - ページを開く

set BASE_URL=http://localhost:3000

echo.
echo  ====================================
echo   Love CRM - ページを選んで開く
echo  ====================================
echo.
echo   1. ダッシュボード
echo   2. 顧客一覧
echo   3. 顧客詳細 (山田花子 #1)
echo   4. 設定（タグマスタ）
echo   5. 全ページを開く
echo   0. キャンセル
echo.
set /p CHOICE=" 番号を入力してください: "

if "%CHOICE%"=="1" start "" "%BASE_URL%/dashboard"
if "%CHOICE%"=="2" start "" "%BASE_URL%/customers"
if "%CHOICE%"=="3" start "" "%BASE_URL%/customers/1"
if "%CHOICE%"=="4" start "" "%BASE_URL%/settings"
if "%CHOICE%"=="5" (
    start "" "%BASE_URL%/dashboard"
    timeout /t 1 /nobreak >nul
    start "" "%BASE_URL%/customers"
    timeout /t 1 /nobreak >nul
    start "" "%BASE_URL%/settings"
)
if "%CHOICE%"=="0" goto END

:END
