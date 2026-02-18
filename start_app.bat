@echo off
chcp 65001 >nul
echo ========================================
echo   Alphacut 앱 시작 중...
echo ========================================
echo.

REM FastAPI 서버 시작 (새 창)
echo [1/3] FastAPI 서버 시작 중...
start "Alphacut API Server" cmd /k "cd /d %~dp0apps\api && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat && python main.py) else (python main.py)"

REM 2초 대기
timeout /t 2 /nobreak >nul

REM Next.js 서버 시작 (새 창)
echo [2/3] Next.js 서버 시작 중...
start "Alphacut Web Server" cmd /k "cd /d %~dp0apps\web && npm run dev"

REM 5초 대기
echo [3/3] 서버가 시작되는 동안 잠시 기다려주세요...
timeout /t 5 /nobreak >nul

REM 브라우저 열기
echo 브라우저를 엽니다...
start http://localhost:3000

echo.
echo ========================================
echo   서버가 실행 중입니다!
echo   - API 서버: http://localhost:8000
echo   - 웹 서버: http://localhost:3000
echo ========================================
echo.
echo 이 창을 닫아도 서버는 계속 실행됩니다.
echo 서버를 종료하려면 각 터미널 창을 닫으세요.
echo.
pause
