#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Alphacut 앱 시작 중..."
echo "========================================"
echo ""

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# FastAPI 서버 시작 (백그라운드)
echo -e "${BLUE}[1/3]${NC} FastAPI 서버 시작 중..."
cd apps/api

# venv 활성화 (존재하는 경우)
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# FastAPI 서버를 백그라운드에서 실행
python main.py > /tmp/alphacut_api.log 2>&1 &
API_PID=$!
echo "FastAPI 서버 PID: $API_PID"

# 루트로 돌아가기
cd "$SCRIPT_DIR"

# 2초 대기
sleep 2

# Next.js 서버 시작 (백그라운드)
echo -e "${BLUE}[2/3]${NC} Next.js 서버 시작 중..."
cd apps/web

# npm run dev를 백그라운드에서 실행
npm run dev > /tmp/alphacut_web.log 2>&1 &
WEB_PID=$!
echo "Next.js 서버 PID: $WEB_PID"

# 루트로 돌아가기
cd "$SCRIPT_DIR"

# 5초 대기
echo -e "${BLUE}[3/3]${NC} 서버가 시작되는 동안 잠시 기다려주세요..."
sleep 5

# 브라우저 열기 (OS별로 다름)
echo "브라우저를 엽니다..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v gnome-open &> /dev/null; then
        gnome-open http://localhost:3000
    else
        echo "브라우저를 수동으로 열어주세요: http://localhost:3000"
    fi
fi

echo ""
echo "========================================"
echo -e "  ${GREEN}서버가 실행 중입니다!${NC}"
echo "  - API 서버: http://localhost:8000"
echo "  - 웹 서버: http://localhost:3000"
echo "========================================"
echo ""
echo "서버 로그 확인:"
echo "  - API 로그: tail -f /tmp/alphacut_api.log"
echo "  - Web 로그: tail -f /tmp/alphacut_web.log"
echo ""
echo "서버를 종료하려면 다음 명령어를 실행하세요:"
echo "  kill $API_PID $WEB_PID"
echo ""
echo "또는 프로세스를 찾아 종료:"
echo "  pkill -f 'python.*main.py'"
echo "  pkill -f 'next dev'"
echo ""

# PID를 파일에 저장 (나중에 종료할 수 있도록)
echo "$API_PID" > /tmp/alphacut_api.pid
echo "$WEB_PID" > /tmp/alphacut_web.pid

# 스크립트가 종료되어도 서버가 계속 실행되도록
wait
