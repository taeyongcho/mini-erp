import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import HTTPException


def items_html(items):
    """품목 리스트 → (HTML 행, 공급가액합계)"""
    rows = ""
    supply = 0
    for i, it in enumerate(items or [], 1):
        qty = it.get("qty", 0) or 0
        price = it.get("price", 0) or 0
        amt = qty * price
        supply += amt
        rows += (f"<tr><td>{i}</td><td>{it.get('name','')}</td>"
                 f"<td style='text-align:right'>{qty:,}</td>"
                 f"<td style='text-align:right'>{price:,.0f}</td>"
                 f"<td style='text-align:right'>{amt:,.0f}</td></tr>")
    return rows, supply


def send_mail(company, to, subject, html):
    """업체 SMTP 설정으로 HTML 메일 발송"""
    if not (company and company.smtp_host and company.smtp_pass and company.smtp_user):
        raise HTTPException(400, "내 정보에서 SMTP(메일) 설정을 먼저 완료하세요")
    if not to or "@" not in to:
        raise HTTPException(400, "받는사람 이메일을 올바르게 입력하세요")
    sender = company.smtp_from or company.smtp_user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        if company.smtp_tls:
            s = smtplib.SMTP(company.smtp_host, company.smtp_port or 587, timeout=20)
            s.ehlo(); s.starttls(); s.ehlo()
        else:
            s = smtplib.SMTP_SSL(company.smtp_host, company.smtp_port or 465, timeout=20)
        s.login(company.smtp_user, company.smtp_pass)
        s.sendmail(sender, [to], msg.as_string())
        s.quit()
    except Exception as e:
        raise HTTPException(500, f"메일 발송 실패: {e}")
