@echo off
chcp 65001 > nul
echo ====================================
echo  영업 ERP — 빌드 스크립트
echo ====================================
echo.

:: 1. React 빌드
echo [1/3] React 프론트엔드 빌드 중...
cd frontend
call npm install
call npm run build
cd ..
echo    완료!

:: 2. PyInstaller로 exe 패키징
echo [2/3] PyInstaller 패키징 중...
pyinstaller ^
  --onefile ^
  --noconsole ^
  --name "영업ERP" ^
  --add-data "frontend/dist;frontend/dist" ^
  --hidden-import uvicorn.logging ^
  --hidden-import uvicorn.loops ^
  --hidden-import uvicorn.loops.auto ^
  --hidden-import uvicorn.protocols ^
  --hidden-import uvicorn.protocols.http ^
  --hidden-import uvicorn.protocols.http.auto ^
  --hidden-import uvicorn.protocols.websockets ^
  --hidden-import uvicorn.protocols.websockets.auto ^
  --hidden-import uvicorn.lifespan ^
  --hidden-import uvicorn.lifespan.on ^
  --hidden-import sqlalchemy.dialects.sqlite ^
  --hidden-import sqlalchemy.pool ^
  main.py
echo    완료!

:: 3. 결과물 정리
echo [3/3] 배포 폴더 생성 중...
if not exist "dist\release" mkdir "dist\release"
copy "dist\영업ERP.exe" "dist\release\영업ERP.exe"
echo    완료!

echo.
echo ====================================
echo  빌드 완료!
echo  dist\release\영업ERP.exe 를 배포하세요
echo  (처음 실행 시 data\ 폴더가 자동 생성됩니다)
echo ====================================
pause
