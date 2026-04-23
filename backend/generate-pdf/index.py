"""Генерирует PDF-смету — точное воспроизведение утверждённого дизайна."""

import json, os, base64, io, re, requests, boto3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from datetime import date

BUCKET = 'files'

WHITE        = HexColor('#ffffff')
BLACK        = HexColor('#1a1a1a')
ORANGE       = HexColor('#f97316')
ORANGE_SUM   = HexColor('#c2500a')
GRAY_TEXT    = HexColor('#666666')
GRAY_LABEL   = HexColor('#999999')
SEC_BG       = HexColor('#f3f4f6')   # светло-серый фон секций
TABLE_HEAD   = HexColor('#2d2d2d')
BORDER       = HexColor('#e0e0e0')
TOTAL_BG     = HexColor('#fff7ed')
TOTAL_BORDER = HexColor('#f5c59a')
LOGO_BG      = HexColor('#1a1a2e')

# Новый логотип
LOGO_URL    = 'https://cdn.poehali.dev/files/3a96cf97-dbfb-47e7-8b6a-f8f01d5998e2.png'
LOGO_S3_KEY = 'assets/mospotolki-logo-v2.png'

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
logo_cache = [None]


def get_s3():
    return boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])


def download_font(s3, cfg):
    try:
        return s3.get_object(Bucket=BUCKET, Key=cfg['key'])['Body'].read()
    except Exception:
        pass
    for url in cfg['urls']:
        try:
            r = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
            if r.status_code == 200 and len(r.content) > 10000:
                s3.put_object(Bucket=BUCKET, Key=cfg['key'], Body=r.content, ContentType='font/ttf')
                return r.content
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
        pdfmetrics.registerFont(TTFont('PTSans' if name == 'regular' else 'PTSans-Bold', io.BytesIO(data)))
    fonts_registered = True
    return True


def load_logo(s3):
    if logo_cache[0]:
        return logo_cache[0]
    try:
        logo_cache[0] = s3.get_object(Bucket=BUCKET, Key=LOGO_S3_KEY)['Body'].read()
        return logo_cache[0]
    except Exception:
        pass
    try:
        r = requests.get(LOGO_URL, timeout=10)
        if r.status_code == 200 and len(r.content) > 100:
            s3.put_object(Bucket=BUCKET, Key=LOGO_S3_KEY, Body=r.content, ContentType='image/png')
            logo_cache[0] = r.content
            return r.content
    except Exception:
        pass
    return None


def clean(s):
    return (s or '').replace('**', '').strip()


def ensure_rub(s):
    if not s:
        return s
    s = re.sub(r'(\d{3,})[.,]\d{2}(?=\s*[₽Рруб\s]|$)', r'\1', s)
    s = s.replace('Р', '₽').replace('руб', '₽')
    return s.strip()


def split_value(value):
    v = clean(value)
    if not v:
        return '', '', ''
    m = re.match(
        r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб]?)\s*=\s*([\d\s,.]+\s*[₽Рруб]?)$',
        v, re.I)
    if m:
        return m.group(1).strip(), ensure_rub(m.group(2).strip()), ensure_rub(m.group(3).strip())
    m2 = re.match(
        r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+)\s*[₽Рруб]?$',
        v, re.I)
    if m2:
        try:
            q = float(re.sub(r'[^\d.,]', '', m2.group(1)).replace(',', '.'))
            p = float(re.sub(r'[^\d.,]', '', m2.group(2)).replace(',', '.'))
            total = f"{round(q * p):,}".replace(',', '\u202f') + ' ₽'
            price = f"{round(p):,}".replace(',', '\u202f') + ' ₽'
            return m2.group(1).strip(), price, total
        except Exception:
            pass
    if re.search(r'[₽Рруб]', v):
        return '', '', ensure_rub(v)
    return '', '', ''


def build_pdf(data, logo_bytes=None):
    blocks       = data.get('blocks', [])
    totals       = data.get('totals', [])
    final_phrase = data.get('finalPhrase', '')

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    mg = 16 * mm
    tw = w - 2 * mg
    today = date.today().strftime('%d.%m.%Y')

    # Колонки: Позиция 55% | Кол-во 15% | Цена 15% | Сумма 15%
    CW = [tw * 0.55, tw * 0.15, tw * 0.15, tw * 0.15]

    def cx(i):
        x = mg
        for k in range(i): x += CW[k]
        return x

    def hline(yy, lw=0.4, col=BORDER):
        c.setStrokeColor(col)
        c.setLineWidth(lw)
        c.line(mg, yy, mg + tw, yy)

    def vlines(y_top, y_bot):
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.3)
        for i in range(1, 4):
            c.line(cx(i), y_bot, cx(i), y_top)

    def draw_footer():
        c.setFont('PTSans', 6.5)
        c.setFillColor(GRAY_LABEL)
        c.drawCentredString(w / 2, 7 * mm,
            'MosPotolki  ·  г. Мытищи, ул. Пограничная 24  ·  +7 (977) 606-89-01  ·  mospotolki.net')

    table_top_y = [0]

    def check(yy, need):
        if yy - need < 18 * mm:
            if table_top_y[0]:
                c.setStrokeColor(BORDER)
                c.setLineWidth(0.5)
                c.rect(mg, yy, tw, table_top_y[0] - yy, fill=0, stroke=1)
            c.showPage()
            c.setFillColor(WHITE)
            c.rect(0, 0, w, h, fill=1, stroke=0)
            draw_footer()
            table_top_y[0] = h - 12 * mm
            return h - 12 * mm
        return yy

    # ── Белый фон ─────────────────────────────────────────────────────────────
    c.setFillColor(WHITE)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # ── ШАПКА ─────────────────────────────────────────────────────────────────
    y = h - 14 * mm

    # Левая: СМЕТА
    c.setFont('PTSans-Bold', 40)
    c.setFillColor(BLACK)
    c.drawString(mg, y - 14 * mm, 'СМЕТА')

    c.setFont('PTSans-Bold', 11)
    c.setFillColor(ORANGE)
    c.drawString(mg, y - 21 * mm, 'на натяжные потолки')

    c.setFont('PTSans', 8.5)
    c.setFillColor(GRAY_TEXT)
    c.drawString(mg, y - 27 * mm, f'№ б/н от {today}')

    # Правая: тёмная плашка с логотипом
    logo_box_w = 52 * mm
    logo_box_h = 12 * mm
    logo_box_x = w - mg - logo_box_w
    logo_box_y = y - logo_box_h

    c.setFillColor(LOGO_BG)
    c.roundRect(logo_box_x, logo_box_y, logo_box_w, logo_box_h, 1.5 * mm, fill=1, stroke=0)

    if logo_bytes:
        try:
            logo_img = ImageReader(io.BytesIO(logo_bytes))
            iw, ih = logo_img.getSize()
            lh = logo_box_h * 0.65
            lw_d = lh * (iw / ih)
            lx = logo_box_x + (logo_box_w - lw_d) / 2
            ly = logo_box_y + (logo_box_h - lh) / 2
            c.drawImage(logo_img, lx, ly, width=lw_d, height=lh, mask='auto')
        except Exception:
            c.setFont('PTSans-Bold', 11)
            c.setFillColor(WHITE)
            c.drawCentredString(logo_box_x + logo_box_w / 2, logo_box_y + 3.5 * mm, 'MOSPOTOLKI')

    # Контакты под плашкой
    for ct in ['+7 (977) 606-89-01', 'mospotolki.net', 'г. Мытищи, ул. Пограничная 24']:
        logo_box_y -= 4.5 * mm
        c.setFont('PTSans', 7.5)
        c.setFillColor(GRAY_TEXT)
        c.drawRightString(w - mg, logo_box_y, ct)

    # Оранжевая разделительная полоса
    sep_y = y - 31 * mm
    c.setFillColor(ORANGE)
    c.rect(mg, sep_y, tw, 1.5 * mm, fill=1, stroke=0)

    y = sep_y - 8 * mm

    # ── ЗАГОЛОВОК ТАБЛИЦЫ ─────────────────────────────────────────────────────
    th = 8 * mm
    c.setFillColor(TABLE_HEAD)
    c.rect(mg, y - th, tw, th, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 8)
    c.setFillColor(WHITE)
    for i, lbl in enumerate(['Позиция', 'Кол-во', 'Цена', 'Сумма']):
        if i == 0:
            c.drawString(cx(0) + 3 * mm, y - th + 2.5 * mm, lbl)
        else:
            c.drawCentredString(cx(i) + CW[i] / 2, y - th + 2.5 * mm, lbl)

    table_top_y[0] = y
    y -= th

    # ── СТРОКА-СЕКЦИЯ ─────────────────────────────────────────────────────────
    def draw_section(yy, label):
        sh = 7.5 * mm
        yy = check(yy, sh + 4 * mm)
        # Светло-серый фон
        c.setFillColor(SEC_BG)
        c.rect(mg, yy - sh, tw, sh, fill=1, stroke=0)
        # Оранжевая левая полоска
        c.setFillColor(ORANGE)
        c.rect(mg, yy - sh, 2.5 * mm, sh, fill=1, stroke=0)
        c.setFont('PTSans-Bold', 9)
        c.setFillColor(BLACK)
        c.drawString(mg + 5 * mm, yy - sh + 2.2 * mm, label)
        hline(yy - sh)
        return yy - sh

    # ── СТРОКА ПОЗИЦИИ (все белые, без чередования) ───────────────────────────
    def draw_row(yy, name, qty, price, total):
        rh = 8 * mm
        yy = check(yy, rh)
        c.setFillColor(WHITE)
        c.rect(mg, yy - rh, tw, rh, fill=1, stroke=0)

        ry = yy - rh + 2.4 * mm

        c.setFont('PTSans', 8.5)
        c.setFillColor(BLACK)
        max_ch = int(CW[0] / (8.5 * 0.20 * mm))
        nm = name[:max_ch - 1] + '…' if len(name) > max_ch else name
        c.drawString(cx(0) + 3 * mm, ry, nm)

        c.setFont('PTSans', 8.5)
        c.setFillColor(GRAY_TEXT)
        if qty:
            c.drawCentredString(cx(1) + CW[1] / 2, ry, ensure_rub(qty))
        if price:
            c.drawCentredString(cx(2) + CW[2] / 2, ry, ensure_rub(price))

        if total:
            c.setFont('PTSans-Bold', 8.5)
            c.setFillColor(ORANGE_SUM)
            c.drawRightString(cx(3) + CW[3] - 3 * mm, ry, ensure_rub(total))

        hline(yy - rh, lw=0.3)
        vlines(yy, yy - rh)
        return yy - rh

    # ── РЕНДЕР БЛОКОВ ─────────────────────────────────────────────────────────
    num_counter = 0
    for block in blocks:
        if block.get('numbered', False):
            num_counter += 1
        title = clean(block.get('title', ''))
        label = f'{num_counter}. {title}' if block.get('numbered') else title
        y = draw_section(y, label)
        for item in block.get('items', []):
            name = re.sub(r'\s*[-–—]\s*$', '', clean(item.get('name', '')))
            value = clean(item.get('value', ''))
            qty, price, total = split_value(value)
            y = draw_row(y, name, qty, price, total)

    # Внешняя рамка таблицы
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(mg, y, tw, table_top_y[0] - y, fill=0, stroke=1)

    # ── БЛОК ИТОГОВ ───────────────────────────────────────────────────────────
    if totals:
        clean_totals = [clean(t) for t in totals
                        if clean(t) and not re.fullmatch(r'[-–—]+', clean(t))]
        # Фильтруем строки для показа (без строк-заголовков без значения)
        rows = []
        for t in clean_totals:
            ci = t.find(':')
            lbl = t[:ci].strip() if ci >= 0 else t
            val = ensure_rub(t[ci + 1:].strip()) if ci >= 0 else ''
            is_hdr = 'итог' in lbl.lower() and not val
            if not is_hdr:
                rows.append((lbl, val))

        if rows:
            # Высота: заголовок + каждая строка
            line_h = 10 * mm
            box_h = 8 * mm + len(rows) * line_h + 6 * mm

            y -= 8 * mm
            y = check(y, box_h + 10 * mm)

            # Блок — правые 56% ширины
            box_w = tw * 0.56
            box_x = mg + tw - box_w

            c.setFillColor(TOTAL_BG)
            c.setStrokeColor(TOTAL_BORDER)
            c.setLineWidth(0.6)
            c.roundRect(box_x, y - box_h, box_w, box_h, 2 * mm, fill=1, stroke=1)

            # "Итоговая стоимость:" — справа сверху
            c.setFont('PTSans-Bold', 8)
            c.setFillColor(GRAY_TEXT)
            c.drawRightString(box_x + box_w - 5 * mm, y - 6 * mm, 'Итоговая стоимость:')

            # Горизонтальная линия под заголовком
            c.setStrokeColor(TOTAL_BORDER)
            c.setLineWidth(0.4)
            c.line(box_x + 4 * mm, y - 8 * mm, box_x + box_w - 4 * mm, y - 8 * mm)

            ty = y - 8 * mm - line_h * 0.5
            lbl_x = box_x + box_w * 0.44   # правый край меток
            val_x = box_x + box_w - 5 * mm  # правый край значений

            for lbl, val in rows:
                is_std = 'standard' in lbl.lower()
                cy_text = ty - line_h / 2 + 1 * mm

                if is_std:
                    # Standard — крупно, жирно, оранжевый
                    c.setFont('PTSans-Bold', 14)
                    c.setFillColor(ORANGE)
                    c.drawRightString(lbl_x, cy_text, lbl + ':')
                    c.setFont('PTSans-Bold', 14)
                    c.setFillColor(ORANGE_SUM)
                    c.drawRightString(val_x, cy_text, val)
                    # Подчёркивание для Standard
                    uly = cy_text - 2 * mm
                    c.setStrokeColor(TOTAL_BORDER)
                    c.setLineWidth(0.3)
                    c.line(box_x + 4 * mm, uly, box_x + box_w - 4 * mm, uly)
                else:
                    # Econom / Premium — серый, обычный
                    c.setFont('PTSans', 9)
                    c.setFillColor(GRAY_LABEL)
                    c.drawRightString(lbl_x, cy_text, lbl + ':')
                    c.setFont('PTSans', 9)
                    c.setFillColor(BLACK)
                    c.drawRightString(val_x, cy_text, val)

                ty -= line_h

            y = y - box_h - 5 * mm

    # ── ДИСКЛЕЙМЕР ────────────────────────────────────────────────────────────
    y -= 5 * mm
    y = check(y, 8 * mm)
    c.setFont('PTSans', 7.5)
    c.setFillColor(ORANGE)
    note = final_phrase or 'Данная смета является предварительной. Точная стоимость будет рассчитана на бесплатном замере.'
    c.drawString(mg, y, note)

    draw_footer()
    c.save()
    return buf.getvalue()


def handler(event, context):
    """Генерирует PDF-смету и возвращает base64."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'}, 'body': ''}

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    data = json.loads(event.get('body', '{}'))

    s3 = get_s3()
    if not ensure_fonts(s3):
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font loading failed'})}

    logo_bytes = load_logo(s3)
    pdf_bytes  = build_pdf(data, logo_bytes=logo_bytes)

    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'pdf': base64.b64encode(pdf_bytes).decode('ascii')})}
