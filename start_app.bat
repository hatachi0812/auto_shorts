@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ─────────────────────────────────────────
REM 프로젝트 루트 경로 설정
REM ─────────────────────────────────────────
set PROJECT_ROOT=%~dp0

REM 프로젝트 루트로 이동
cd /d "%PROJECT_ROOT%"

echo ========================================
echo   Alphacut 앱 시작 중...
echo ========================================
echo.

REM ─────────────────────────────────────────
REM 0단계: 이전 프로세스 정리 (포트 충돌 방지)
REM ─────────────────────────────────────────
echo [0/3] 이전 서버 프로세스 정리 중...

REM 포트 3000 점유 프로세스 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   포트 3000 사용 중인 프로세스 종료 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

REM 포트 8000 점유 프로세스 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo   포트 8000 사용 중인 프로세스 종료 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

REM 이름으로도 찾아서 종료 (잔여 프로세스 제거)
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *main.py*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *next*" >nul 2>&1

timeout /t 1 /nobreak >nul
echo   완료.
echo.

REM ─────────────────────────────────────────
REM 1단계: FastAPI 서버 시작
REM ─────────────────────────────────────────
echo [1/3] FastAPI 서버 시작 중...
cd /d "%PROJECT_ROOT%\apps\api"

REM 경로 확인
if not exist "%PROJECT_ROOT%\apps\api" (
    echo   [오류] API 디렉토리를 찾을 수 없습니다: %PROJECT_ROOT%\apps\api
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\apps\api\main.py" (
    echo   [오류] main.py 파일을 찾을 수 없습니다: %PROJECT_ROOT%\apps\api\main.py
    pause
    exit /b 1
)

REM 가상환경 확인 및 생성
set VENV_PATH=
if exist "venv\Scripts\activate.bat" (
    set VENV_PATH=venv
    echo   Python 가상환경 발견됨 (venv)
) else if exist ".venv\Scripts\activate.bat" (
    set VENV_PATH=.venv
    echo   Python 가상환경 발견됨 (.venv)
) else (
    echo   Python 가상환경이 없습니다. 생성 중...
    python -m venv .venv
    if %ERRORLEVEL% NEQ 0 (
        echo   [오류] 가상환경 생성 실패! Python이 설치되어 있는지 확인하세요.
        pause
        exit /b 1
    )
    set VENV_PATH=.venv
    echo   가상환경 생성 완료 (.venv)
)

REM requirements.txt 설치 확인
if not exist "%VENV_PATH%\Scripts\pip.exe" (
    echo   [오류] pip를 찾을 수 없습니다.
    pause
    exit /b 1
)

REM requirements.txt가 있으면 의존성 설치 확인
if exist "requirements.txt" (
    echo   Python 패키지 설치 확인 중...
    call %VENV_PATH%\Scripts\activate.bat
    pip install -q -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo   [경고] 일부 패키지 설치에 실패했을 수 있습니다.
    ) else (
        echo   Python 패키지 설치 완료
    )
    call %VENV_PATH%\Scripts\deactivate.bat
)

REM uvicorn으로 FastAPI 서버 실행
start "Alphacut API Server" cmd /k "cd /d %PROJECT_ROOT%\apps\api && call %VENV_PATH%\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

REM FastAPI 서버가 실제로 시작되었는지 확인
set API_STARTED=0
for /L %%j in (1,1,5) do (
    netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set API_STARTED=1
        echo   FastAPI 서버 시작됨 (포트 8000)
        goto :api_checked
    )
    timeout /t 1 /nobreak >nul
)
:api_checked
if %API_STARTED% EQU 0 (
    echo   [경고] FastAPI 서버가 시작되지 않았을 수 있습니다. 터미널 창을 확인하세요.
)

REM ─────────────────────────────────────────
REM 2단계: Next.js 서버 시작
REM ─────────────────────────────────────────
echo.
echo [2/3] Next.js 서버 시작 중...
cd /d "%PROJECT_ROOT%\apps\web"

REM 경로 확인
if not exist "%PROJECT_ROOT%\apps\web" (
    echo   [오류] 웹 앱 디렉토리를 찾을 수 없습니다: %PROJECT_ROOT%\apps\web
    pause
    exit /b 1
)

REM Next.js 캐시 정리 (선택사항)
REM if exist ".next" (
REM     echo   Next.js 캐시 정리 중...
REM     rmdir /s /q ".next" >nul 2>&1
REM     echo   캐시 정리 완료
REM )

REM node_modules가 없으면 npm install 실행
if not exist "node_modules" (
    echo   node_modules가 없습니다. npm install을 실행합니다...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo   [오류] npm install 실패!
        pause
        exit /b 1
    )
)

start "Alphacut Web Server" cmd /k "cd /d %PROJECT_ROOT%\apps\web && npm run dev"
echo   Next.js 서버 시작 명령 실행됨

REM ─────────────────────────────────────────
REM 3단계: 실제 사용 포트 감지 후 브라우저 열기
REM ─────────────────────────────────────────
echo.
echo [3/3] 서버가 준비될 때까지 기다리는 중...

set WEB_PORT=3000
set PORT_FOUND=0

REM 최대 30초 동안 포트 감지 시도
for /L %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    
    REM 포트 3000이 사용 중인지 확인
    netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set WEB_PORT=3000
        set PORT_FOUND=1
        goto :port_detected
    )
    
    REM 다른 포트도 확인 (3001-3010)
    for /L %%p in (3001,1,3010) do (
        netstat -ano | findstr :%%p | findstr LISTENING >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            set WEB_PORT=%%p
            set PORT_FOUND=1
            goto :port_detected
        )
    )
    
    REM 진행 상황 표시 (5초마다)
    set /a mod=%%i %% 5
    if !mod! EQU 0 (
        echo   대기 중... (!%%i!/30초)
    )
)

:port_detected
if %PORT_FOUND% EQU 0 (
    echo   [경고] Next.js 서버 포트를 감지하지 못했습니다.
    echo   서버가 아직 시작 중이거나 오류가 발생했을 수 있습니다.
    echo   터미널 창을 확인하세요.
    echo   기본 포트 3000으로 브라우저를 엽니다.
    set WEB_PORT=3000
) else (
    echo   Next.js 서버 감지됨 (포트 %WEB_PORT%)
)

echo   브라우저를 엽니다 → http://localhost:%WEB_PORT%
start http://localhost:%WEB_PORT%

echo.
echo ========================================
echo   서버가 실행 중입니다!
echo   - API 서버: http://localhost:8000
echo   - 웹 서버:  http://localhost:%WEB_PORT%
echo ========================================
echo.
echo 서버 로그는 각 터미널 창에서 확인할 수 있습니다.
echo.
echo 종료하려면 Enter를 누르세요 (서버도 함께 종료됩니다)
pause >nul

REM ─────────────────────────────────────────
REM 종료 처리
REM ─────────────────────────────────────────
echo.
echo 서버를 종료하는 중...

REM 포트로 프로세스 찾아서 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 이름으로 프로세스 종료
taskkill /F /FI "WINDOWTITLE eq Alphacut API Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Alphacut Web Server*" >nul 2>&1

echo 모든 서버가 종료되었습니다.
timeout /t 1 /nobreak >nul
