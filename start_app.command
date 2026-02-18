#!/bin/bash

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo "========================================"
echo "  Alphacut 앱 시작 중..."
echo "========================================"
echo ""

# ─────────────────────────────────────────
# 0단계: 이전 프로세스 정리 (포트 충돌 방지)
# ─────────────────────────────────────────
echo -e "${YELLOW}[0/3]${NC} 이전 서버 프로세스 정리 중..."

# 포트 3000 점유 프로세스 종료
PORT3000_PID=$(lsof -ti :3000)
if [ -n "$PORT3000_PID" ]; then
    echo "  포트 3000 사용 중인 프로세스 종료 (PID: $PORT3000_PID)"
    kill -9 $PORT3000_PID 2>/dev/null
fi

# 포트 8000 점유 프로세스 종료
PORT8000_PID=$(lsof -ti :8000)
if [ -n "$PORT8000_PID" ]; then
    echo "  포트 8000 사용 중인 프로세스 종료 (PID: $PORT8000_PID)"
    kill -9 $PORT8000_PID 2>/dev/null
fi

# 이름으로도 찾아서 종료 (잔여 프로세스 제거)
pkill -f "python.*main.py" 2>/dev/null
pkill -f "uvicorn.*main:app" 2>/dev/null
pkill -f "next dev" 2>/dev/null

sleep 1
echo "  완료."
echo ""

# ─────────────────────────────────────────
# 1단계: FastAPI 서버 시작
# ─────────────────────────────────────────
echo -e "${BLUE}[1/3]${NC} FastAPI 서버 시작 중..."
cd "$SCRIPT_DIR/apps/api"

# venv 활성화 (존재하는 경우)
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "  Python 가상환경 활성화됨"
elif [ -d ".venv" ]; then
    source .venv/bin/activate
    echo "  Python 가상환경 활성화됨"
fi

# uvicorn 또는 python main.py 로 실행
if command -v uvicorn &> /dev/null; then
    uvicorn main:app --reload --port 8000 > /tmp/alphacut_api.log 2>&1 &
else
    python main.py > /tmp/alphacut_api.log 2>&1 &
fi
API_PID=$!
echo "  FastAPI 서버 시작됨 (PID: $API_PID)"

sleep 2

# FastAPI가 실제로 올라왔는지 확인
if ps -p $API_PID > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ API 서버 정상 실행 중${NC}"
else
    echo -e "  ${RED}✗ API 서버 시작 실패! 로그를 확인하세요: tail -f /tmp/alphacut_api.log${NC}"
fi

# ─────────────────────────────────────────
# 2단계: Next.js 서버 시작
# ─────────────────────────────────────────
echo ""
echo -e "${BLUE}[2/3]${NC} Next.js 서버 시작 중..."
cd "$SCRIPT_DIR/apps/web"

# node_modules가 없으면 npm install 실행
if [ ! -d "node_modules" ]; then
    echo -e "  ${YELLOW}node_modules가 없습니다. npm install을 실행합니다...${NC}"
    npm install
fi

npm run dev > /tmp/alphacut_web.log 2>&1 &
WEB_PID=$!
echo "  Next.js 서버 시작됨 (PID: $WEB_PID)"

# ─────────────────────────────────────────
# 3단계: 실제 사용 포트 감지 후 브라우저 열기
# ─────────────────────────────────────────
echo ""
echo -e "${BLUE}[3/3]${NC} 서버가 준비될 때까지 기다리는 중..."

WEB_PORT=3000
for i in $(seq 1 15); do
    sleep 1
    # Next.js 로그에서 실제 포트 추출
    DETECTED_PORT=$(grep -oE 'localhost:[0-9]+' /tmp/alphacut_web.log 2>/dev/null | head -1 | cut -d: -f2)
    if [ -n "$DETECTED_PORT" ]; then
        WEB_PORT=$DETECTED_PORT
        break
    fi
done

echo "  브라우저를 엽니다 → http://localhost:$WEB_PORT"
open "http://localhost:$WEB_PORT"

echo ""
echo "========================================"
echo -e "  ${GREEN}서버가 실행 중입니다!${NC}"
echo "  - API 서버: http://localhost:8000"
echo "  - 웹 서버:  http://localhost:$WEB_PORT"
echo "========================================"
echo ""
echo "서버 로그 확인:"
echo "  - API 로그: tail -f /tmp/alphacut_api.log"
echo "  - Web 로그: tail -f /tmp/alphacut_web.log"
echo ""
echo -e "${YELLOW}종료하려면 Enter를 누르세요 (서버도 함께 종료됩니다)${NC}"

# PID 저장
echo "$API_PID" > /tmp/alphacut_api.pid
echo "$WEB_PID" > /tmp/alphacut_web.pid

read

# ─────────────────────────────────────────
# 종료 처리
# ─────────────────────────────────────────
echo ""
echo "서버를 종료하는 중..."
kill $API_PID $WEB_PID 2>/dev/null

PORT3000_PID=$(lsof -ti :3000)
[ -n "$PORT3000_PID" ] && kill -9 $PORT3000_PID 2>/dev/null
PORT8000_PID=$(lsof -ti :8000)
[ -n "$PORT8000_PID" ] && kill -9 $PORT8000_PID 2>/dev/null

pkill -f "python.*main.py" 2>/dev/null
pkill -f "uvicorn.*main:app" 2>/dev/null
pkill -f "next dev" 2>/dev/null

rm -f /tmp/alphacut_api.pid /tmp/alphacut_web.pid
echo "모든 서버가 종료되었습니다."
sleep 1
