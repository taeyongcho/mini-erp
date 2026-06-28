from fastapi import APIRouter, UploadFile, File, HTTPException
import io

router = APIRouter(prefix="/api/convert", tags=["convert"])


@router.post("/pdf-to-items")
async def pdf_to_items(file: UploadFile = File(...)):
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(500, "pdfplumber가 설치되지 않았습니다. pip install pdfplumber")

    contents = await file.read()
    items = []
    raw_text = ""

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            raw_text += text + "\n"
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row:
                        continue
                    # 숫자가 포함된 셀이 있으면 품목 행으로 판단
                    has_number = any(
                        cell and any(c.isdigit() for c in str(cell))
                        for cell in row
                    )
                    if not has_number:
                        continue
                    # 첫 번째 non-empty 셀을 품목명으로 사용
                    name = ""
                    price = 0.0
                    qty = 1
                    for cell in row:
                        cell_str = str(cell).strip() if cell else ""
                        if not name and cell_str and not all(c.isdigit() or c in '.,- ' for c in cell_str):
                            name = cell_str
                        elif cell_str:
                            # 숫자 추출 시도
                            num_str = cell_str.replace(',', '').replace(' ', '')
                            try:
                                val = float(num_str)
                                if val > price:
                                    price = val
                            except ValueError:
                                pass
                    if name:
                        items.append({"name": name, "qty": qty, "unit": "식", "price": price})

    # 테이블이 없으면 텍스트에서 라인별 파싱
    if not items:
        for line in raw_text.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            has_number = any(p.replace(',', '').replace('.', '').isdigit() for p in parts)
            if not has_number or len(parts) < 2:
                continue
            name = parts[0]
            price = 0.0
            for p in parts[1:]:
                try:
                    val = float(p.replace(',', ''))
                    if val > price:
                        price = val
                except ValueError:
                    pass
            if name and price > 0:
                items.append({"name": name, "qty": 1, "unit": "식", "price": price})

    return {"items": items, "raw_text": raw_text.strip()}
