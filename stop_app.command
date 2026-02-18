#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  Alphacut 앱 종료 중..."
echo "========================================"
echo ""

# PID 파일에서 읽기
if [ -f /tmp/alphacut_api.pid ]; then
    API_PID=$(cat /tmp/alphacut_api.pid)
    if ps -p $API_PID > /dev/null 2>&1; then
        echo "FastAPI 서버 종료 중... (PID: $API_PID)"
        kill $API_PID 2>/dev/null
    fi
    rm /tmp/alphacut_api.pid
fi

if [ -f /tmp/alphacut_web.pid ]; then
    WEB_PID=$(cat /tmp/alphacut_web.pid)
    if ps -p $WEB_PID > /dev/null 2>&1; then
        echo "Next.js 서버 종료 중... (PID: $WEB_PID)"
        kill $WEB_PID 2>/dev/null
    fi
    rm /tmp/alphacut_web.pid
fi

# 프로세스 이름으로도 찾아서 종료 (PID 파일이 없는 경우)
echo "남은 프로세스 종료 중..."
pkill -f "python.*main.py" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "uvicorn.*main:app" 2>/dev/null

echo ""
echo "========================================"
echo "  모든 서버가 종료되었습니다."
echo "========================================"
echo ""
echo "3초 후 창이 닫힙니다..."
sleep 3
