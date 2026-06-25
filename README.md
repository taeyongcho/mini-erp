# 영업 ERP — 설치 및 빌드 가이드

## 구조
```
mini-erp/
├── main.py              # FastAPI 서버 진입점
├── database.py          # SQLite 연결
├── models.py            # DB 모델
├── routers/             # API 라우터
│   ├── customer.py
│   ├── product.py
│   ├── quotation.py
│   ├── order.py
│   └── tax.py
├── frontend/            # React (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── components/UI.jsx
│   │   └── pages/
│   └── package.json
├── requirements.txt
└── build.bat            # exe 빌드 스크립트
```

## 개발 환경 실행

### 백엔드
```bash
pip install -r requirements.txt
python main.py
# → http://localhost:18765
```

### 프론트엔드 (개발 모드)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 (API는 18765로 프록시)
```

## exe 빌드 (Windows)

### 사전 준비
1. Python 3.10+ 설치
2. Node.js 18+ 설치
3. pip install -r requirements.txt

### 빌드
```
build.bat 실행
```
→ `dist/release/영업ERP.exe` 생성

### 배포
- `영업ERP.exe` 단일 파일만 배포
- 최초 실행 시 exe 옆에 `data/erp.db` 자동 생성
- 브라우저가 자동으로 열립니다 (http://localhost:18765)

## 데이터 저장 위치
- `data/erp.db` — SQLite 데이터베이스 (exe 옆에 생성)
- 이 파일을 백업하면 모든 데이터가 보존됩니다

## 포트 변경
`main.py` 하단의 `PORT = 18765` 수정
