@echo off
chcp 65001 > nul

echo [1/3] 既存の Node.js プロセスを停止中...
taskkill /F /IM node.exe > nul 2>&1
timeout /t 1 /nobreak > nul

echo [2/3] npm run dev を起動中...
cd /d C:\crm\app
start "CRM Dev Server" cmd /k npm run dev

echo [3/3] ブラウザを開いています...
timeout /t 3 /nobreak > nul
start http://localhost:3000

exit
