@echo off
chcp 65001 >nul
echo ========================================
echo   Alphacut 앱 종료 중...
echo ========================================
echo.

echo FastAPI 서버 종료 중...
taskkill /FI "WINDOWTITLE eq Alphacut API Server*" /T /F >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST ^| findstr /C:"PID:"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Next.js 서버 종료 중...
taskkill /FI "WINDOWTITLE eq Alphacut Web Server*" /T /F >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /C:"PID:"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ========================================
echo   모든 서버가 종료되었습니다.
echo ========================================
timeout /t 2 /nobreak >nul
