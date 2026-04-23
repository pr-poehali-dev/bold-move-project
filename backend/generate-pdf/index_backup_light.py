"""BACKUP — светлая версия PDF (оригинал). Для отката переименовать в index.py."""

import json
import os
import base64
import io
import requests
import boto3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, black, white, HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


BUCKET = 'files'
FONT_URLS = {
    'regular': {
        'key': 'fonts/PTSans-Regular.ttf',
        'urls': [
            'https://raw.githubusercontent.com/openmaptiles/fonts/master/pt-sans/PTSans-Regular.ttf',
            'https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79D0KExQ.ttf',
        ],
    },
    'bold': {
        'key': 'fonts/PTSans-Bold.ttf',
        'urls': [
            'https://raw.githubusercontent.com/openmaptiles/fonts/master/pt-sans/PTSans-Bold.ttf',
            'https://fonts.gstatic.com/s/ptsans/v17/jizfRExUiTo99u79B_mh4OmnLD0Z4zM.ttf',
        ],
    },
}

fonts_registered = False


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def download_font(s3, cfg):
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=cfg['key'])
        return obj['Body'].read()
    except Exception:
        pass
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; FontLoader/1.0)'}
    for url in cfg['urls']:
        try:
            resp = requests.get(url, timeout=15, headers=headers, allow_redirects=True)
            if resp.status_code == 200 and len(resp.content) > 10000:
                s3.put_object(Bucket=BUCKET, Key=cfg['key'], Body=resp.content, ContentType='font/ttf')
                return resp.content
        except Exception:
            continue
    return None


def ensure_fonts(s3):
    global fonts_registered
    if fonts_registered:
        return True
    for name, cfg in FONT_URLS.items():
        data = download_font(s3, cfg)
        if not data:
            return False
        font_io = io.BytesIO(data)
        font_name = 'PTSans' if name == 'regular' else 'PTSans-Bold'
        pdfmetrics.registerFont(TTFont(font_name, font_io))
    fonts_registered = True
    return True


def build_pdf(data):
    blocks = data.get('blocks', [])
    totals = data.get('totals', [])
    final_phrase = data.get('finalPhrase', '')

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    margin = 14 * mm
    table_w = w - 2 * margin
    col_w = [table_w * 0.44, table_w * 0.14, table_w * 0.20, table_w * 0.22]

    from datetime import date
    today = date.today().strftime('%d.%m.%Y')

    def new_page():
        c.showPage()
        return h - 20 * mm

    def check_space(y, needed):
        if y - needed < 15 * mm:
            return new_page()
        return y

    c.setFillColor(Color(20/255, 20/255, 30/255))
    c.rect(0, h - 36*mm, w, 36*mm, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 18)
    c.setFillColor(HexColor('#FF8C32'))
    c.drawString(14*mm, h - 16*mm, 'MOSPOTOLKI')

    c.setFont('PTSans', 8)
    c.setFillColor(Color(200/255, 200/255, 215/255))
    c.drawString(14*mm, h - 23*mm, 'Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net')

    c.setFont('PTSans-Bold', 14)
    c.setFillColor(white)
    c.drawRightString(w - 14*mm, h - 16*mm, 'СМЕТА')

    c.setFont('PTSans', 8)
    c.setFillColor(Color(200/255, 200/255, 215/255))
    c.drawRightString(w - 14*mm, h - 23*mm, 'от ' + today)

    y = h - 44 * mm
    num_counter = 0

    def draw_row(y_pos, cols, is_head=False, row_h=7*mm):
        y_pos = check_space(y_pos, row_h)

        if is_head:
            c.setFillColor(Color(235/255, 232/255, 245/255))
            c.rect(margin, y_pos - row_h, table_w, row_h, fill=1, stroke=0)

        c.setStrokeColor(Color(200/255, 200/255, 210/255))
        c.setLineWidth(0.3)
        cx = margin
        for cw in col_w:
            c.rect(cx, y_pos - row_h, cw, row_h, fill=0, stroke=1)
            cx += cw

        c.setFillColor(black)
        font_size = 9 if is_head else 9
        c.setFont('PTSans-Bold' if is_head else 'PTSans', font_size)

        text_y = y_pos - row_h + 2.5 * mm
        cx = margin
        for i, col in enumerate(cols):
            txt = (col or '').replace('**', '')
            cw = col_w[i]
            if i == 0:
                max_chars = int(cw / (font_size * 0.22 * mm))
                if len(txt) > max_chars:
                    txt = txt[:max_chars-1] + '…'
                c.drawString(cx + 1.5*mm, text_y, txt)
            else:
                c.drawRightString(cx + cw - 1.5*mm, text_y, txt)
            cx += cw

        return y_pos - row_h

    def split_value(value):
        import re
        v = value.replace('**', '').strip()
        if not v:
            return '', '', ''
        m = re.match(r'^([\d\s,.]+\s*[м²шткгмlpа-яА-Я.]*)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб.]*)\s*=\s*([\d\s,.]+\s*[₽Рруб.]*)$', v)
        if m:
            return m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        m = re.match(r'^([\d\s,.]+\s*[м²шткгмlpа-яА-Я.]*)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб.]*)$', v)
        if m:
            try:
                q = float(re.sub(r'[^\d.]', '', m.group(1)))
                p = float(re.sub(r'[^\d.]', '', m.group(2)))
                total = f'{round(q * p):,}'.replace(',', ' ') + ' Р'
            except Exception:
                total = ''
            return m.group(1).strip(), m.group(2).strip(), total
        if re.match(r'^\d[\d\s,.]*\s*[₽Рруб.]', v):
            return '', '', v
        return '', '', v

    for block in blocks:
        if block.get('numbered', False):
            num_counter += 1
        title = block.get('title', '')
        label = f'{num_counter}. {title}' if block.get('numbered') else title
        label = label.replace('**', '')

        y = check_space(y, 15*mm)
        y = draw_row(y, [label, 'Кол-во', 'Цена/ед', 'Сумма'], is_head=True, row_h=8*mm)

        for item in block.get('items', []):
            import re as _re
            name = _re.sub(r'\s*[-–—]\s*$', '', item.get('name', '').replace('**', '').strip())
            value = item.get('value', '').replace('**', '').strip()
            qty, price, total = split_value(value)

            if qty or price or total:
                y = draw_row(y, [name, qty, price, total])
            else:
                y = draw_row(y, [name, '', '', ''])

    if totals:
        y -= 3 * mm
        clean_totals = [t.replace('**', '').strip() for t in totals if t.strip() and not all(ch in '-–—' for ch in t.strip())]
        box_h = (8 + len(clean_totals) * 7) * mm
        y = check_space(y, box_h + 5*mm)

        c.setFillColor(HexColor('#FFF8EE'))
        c.setStrokeColor(HexColor('#FF8228'))
        c.setLineWidth(0.5)
        c.roundRect(margin, y - box_h, table_w, box_h, 2*mm, fill=1, stroke=1)

        ty = y - 6 * mm
        for t in clean_totals:
            ci = t.find(':')
            lbl = t[:ci].strip() if ci >= 0 else t
            val = t[ci+1:].strip() if ci >= 0 else ''
            is_hl = 'standard' in lbl.lower()

            c.setFont('PTSans-Bold' if is_hl else 'PTSans', 11 if is_hl else 9)
            c.setFillColor(HexColor('#D35400') if is_hl else black)
            suffix = ':' if ci >= 0 else ''
            c.drawString(margin + 3*mm, ty, lbl + suffix)
            if val:
                c.drawRightString(margin + table_w - 3*mm, ty, val)
            ty -= 7 * mm
        y = ty

    y -= 5 * mm
    y = check_space(y, 10 * mm)
    c.setFont('PTSans', 7.5)
    c.setFillColor(Color(80/255, 80/255, 80/255))
    note = 'Данная смета является предварительной. Точная стоимость будет рассчитана на бесплатном замере.'
    c.drawString(margin, y, note)

    c.setFont('PTSans', 7)
    c.setFillColor(Color(150/255, 150/255, 150/255))
    c.drawCentredString(w/2, 8*mm, 'MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01')

    c.save()
    return buf.getvalue()


def handler(event, context):
    """BACKUP светлой версии PDF. Не используется напрямую."""
    pass
