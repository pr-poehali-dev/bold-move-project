"""Генерирует PDF-смету в стиле делового счёта."""

import json
import os
import base64
import io
import re
import requests
import boto3
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
BLACK        = HexColor('#111111')
ORANGE       = HexColor('#f97316')
ORANGE_DARK  = HexColor('#c2500a')
GRAY_LIGHT   = HexColor('#f3f4f6')
GRAY_MID     = HexColor('#e5e7eb')
GRAY_TEXT    = HexColor('#6b7280')
TABLE_HEAD   = HexColor('#1a1a2e')
SEC_ORANGE   = HexColor('#fff3e0')
TOTAL_BG     = HexColor('#fff7ed')
TOTAL_BORDER = HexColor('#fed7aa')

LOGO_URL    = 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/1dc8a36d-819a-489e-bdcb-25aaa523b7d9.png'
LOGO_S3_KEY = 'assets/mospotolki-logo.png'

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
    headers = {'User-Agent': 'Mozilla/5.0'}
    for url in cfg['urls']:
        try:
            r = requests.get(url, timeout=15, headers=headers)
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
    if logo_cache[0] is not None:
        return logo_cache[0]
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=LOGO_S3_KEY)
        logo_cache[0] = obj['Body'].read()
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
    # "qty unit × price = total"
    m = re.match(
        r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб]?)\s*=\s*([\d\s,.]+\s*[₽Рруб]?)$',
        v, re.I
    )
    if m:
        return m.group(1).strip(), ensure_rub(m.group(2).strip()), ensure_rub(m.group(3).strip())
    # "qty unit × price" без итога
    m2 = re.match(
        r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+)\s*[₽Рруб]?$',
        v, re.I
    )
    if m2:
        try:
            q = float(re.sub(r'[^\d.,]', '', m2.group(1)).replace(',', '.'))
            p = float(re.sub(r'[^\d.,]', '', m2.group(2)).replace(',', '.'))
            total = f"{round(q * p):,}".replace(',', '\u202f') + '\u202f₽'
            price = f"{round(p):,}".replace(',', '\u202f') + '\u202f₽'
            return m2.group(1).strip(), price, total
        except Exception:
            pass
    if re.search(r'[₽Рруб]', v):
        return '', '', ensure_rub(v)
    return '', '', ''


def build_pdf(data, logo_bytes=None):
    blocks = data.get('blocks', [])
    totals = data.get('totals', [])
    final_phrase = data.get('finalPhrase', '')

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    margin = 15 * mm
    table_w = w - 2 * margin
    today = date.today().strftime('%d.%m.%Y')

    # Колонки: Позиция | Кол-во | Цена | Сумма
    CW = [table_w * 0.50, table_w * 0.16, table_w * 0.16, table_w * 0.18]

    def cx(i):
        x = margin
        for k in range(i):
            x += CW[k]
        return x

    def hline(y_pos, x0=None, x1=None, color=None, lw=0.3):
        c.setStrokeColor(color or GRAY_MID)
        c.setLineWidth(lw)
        c.line(x0 or margin, y_pos, x1 or (margin + table_w), y_pos)

    def draw_footer():
        c.setFont('PTSans', 6.5)
        c.setFillColor(GRAY_TEXT)
        hline(10 * mm, color=GRAY_MID, lw=0.3)
        c.drawCentredString(w / 2, 6.5 * mm,
            'MosPotolki  ·  г. Мытищи, ул. Пограничная 24  ·  +7 (977) 606-89-01  ·  mospotolki.net')

    def check(y_pos, need):
        if y_pos - need < 18 * mm:
            c.showPage()
            c.setFillColor(WHITE)
            c.rect(0, 0, w, h, fill=1, stroke=0)
            draw_footer()
            return h - 12 * mm
        return y_pos

    # ── Белый фон ─────────────────────────────────────────────────────────────
    c.setFillColor(WHITE)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # ── Шапка: левая — заголовок+дата, правая — логотип+контакты ─────────────
    y_top = h - 12 * mm
    right_x = w - margin  # правый край
    mid_x = w / 2         # граница между левой и правой частью шапки

    # ЛЕВАЯ ЧАСТЬ — крупное "СМЕТА"
    c.setFont('PTSans-Bold', 38)
    c.setFillColor(BLACK)
    c.drawString(margin, y_top - 14 * mm, 'СМЕТА')

    c.setFont('PTSans-Bold', 11)
    c.setFillColor(ORANGE)
    c.drawString(margin, y_top - 21 * mm, 'на натяжные потолки')

    c.setFont('PTSans', 9)
    c.setFillColor(GRAY_TEXT)
    c.drawString(margin, y_top - 27.5 * mm, f'№ б/н от {today}')

    # ПРАВАЯ ЧАСТЬ — логотип сверху
    right_col_x = mid_x + 5 * mm
    logo_bottom = y_top
    if logo_bytes:
        try:
            logo_img = ImageReader(io.BytesIO(logo_bytes))
            iw, ih = logo_img.getSize()
            lh = 11 * mm
            lw_draw = lh * (iw / ih)
            logo_bottom = y_top - lh
            c.drawImage(logo_img, right_x - lw_draw, logo_bottom,
                        width=lw_draw, height=lh, mask='auto')
        except Exception:
            pass

    # Контакты под логотипом — выровнены по правому краю
    contacts = [
        '+7 (977) 606-89-01',
        'mospotolki.net',
        'г. Мытищи, ул. Пограничная 24',
    ]
    cy = logo_bottom - 6 * mm
    for ct in contacts:
        c.setFont('PTSans', 8)
        c.setFillColor(GRAY_TEXT)
        c.drawRightString(right_x, cy, ct)
        cy -= 5 * mm

    # Оранжевая разделительная полоса — на уровне низа левой части
    header_bottom = y_top - 32 * mm
    c.setFillColor(ORANGE)
    c.rect(margin, header_bottom, table_w, 1.8 * mm, fill=1, stroke=0)

    y = header_bottom - 7 * mm

    # ── Заголовок таблицы ─────────────────────────────────────────────────────
    th = 8.5 * mm
    c.setFillColor(TABLE_HEAD)
    c.rect(margin, y - th, table_w, th, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 8.5)
    c.setFillColor(WHITE)
    for i, lbl in enumerate(['Позиция', 'Кол-во', 'Цена', 'Сумма']):
        if i == 0:
            c.drawString(cx(0) + 3 * mm, y - th + 2.8 * mm, lbl)
        else:
            c.drawCentredString(cx(i) + CW[i] / 2, y - th + 2.8 * mm, lbl)

    # Запоминаем верх таблицы для внешней рамки
    table_top_y = y
    y -= th
    row_idx = [0]

    # ── Секция ────────────────────────────────────────────────────────────────
    def draw_section(y_pos, label):
        sh = 7.5 * mm
        y_pos = check(y_pos, sh + 4 * mm)
        c.setFillColor(SEC_ORANGE)
        c.rect(margin, y_pos - sh, table_w, sh, fill=1, stroke=0)
        c.setFillColor(ORANGE)
        c.rect(margin, y_pos - sh, 2.5 * mm, sh, fill=1, stroke=0)
        c.setFont('PTSans-Bold', 9)
        c.setFillColor(BLACK)
        c.drawString(margin + 5 * mm, y_pos - sh + 2.2 * mm, label)
        hline(y_pos - sh)
        row_idx[0] = 0
        return y_pos - sh

    # ── Строка позиции ────────────────────────────────────────────────────────
    def draw_row(y_pos, name, qty, price, total):
        rh = 8 * mm
        y_pos = check(y_pos, rh)
        bg = WHITE if row_idx[0] % 2 == 0 else GRAY_LIGHT
        c.setFillColor(bg)
        c.rect(margin, y_pos - rh, table_w, rh, fill=1, stroke=0)

        ry = y_pos - rh + 2.4 * mm

        # Название
        c.setFont('PTSans', 8.5)
        c.setFillColor(BLACK)
        max_ch = int(CW[0] / (8.5 * 0.205 * mm))
        nm = name if len(name) <= max_ch else name[:max_ch - 1] + '…'
        c.drawString(cx(0) + 3 * mm, ry, nm)

        # Кол-во
        c.setFont('PTSans', 8.5)
        c.setFillColor(GRAY_TEXT)
        if qty:
            c.drawCentredString(cx(1) + CW[1] / 2, ry, ensure_rub(qty))

        # Цена
        if price:
            c.drawCentredString(cx(2) + CW[2] / 2, ry, ensure_rub(price))

        # Сумма — оранжевая жирная
        if total:
            c.setFont('PTSans-Bold', 8.5)
            c.setFillColor(ORANGE_DARK)
            c.drawRightString(cx(3) + CW[3] - 3 * mm, ry, ensure_rub(total))

        hline(y_pos - rh, lw=0.25)
        # Вертикальные разделители
        c.setStrokeColor(GRAY_MID)
        c.setLineWidth(0.25)
        for i in range(1, 4):
            c.line(cx(i), y_pos - rh, cx(i), y_pos)

        row_idx[0] += 1
        return y_pos - rh

    # ── Рендер блоков ─────────────────────────────────────────────────────────
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

    # Внешняя рамка вокруг всей таблицы
    c.setStrokeColor(GRAY_MID)
    c.setLineWidth(0.5)
    c.rect(margin, y, table_w, table_top_y - y, fill=0, stroke=1)

    # ── Итого ─────────────────────────────────────────────────────────────────
    if totals:
        clean_totals = [clean(t) for t in totals
                        if clean(t) and not re.fullmatch(r'[-–—]+', clean(t))]
        if clean_totals:
            box_h = (10 + len(clean_totals) * 9) * mm
            y -= 6 * mm
            y = check(y, box_h + 8 * mm)

            box_x = margin + table_w * 0.42
            box_w = table_w * 0.58

            c.setFillColor(TOTAL_BG)
            c.setStrokeColor(TOTAL_BORDER)
            c.setLineWidth(0.6)
            c.roundRect(box_x, y - box_h, box_w, box_h, 2 * mm, fill=1, stroke=1)

            c.setFont('PTSans-Bold', 8)
            c.setFillColor(GRAY_TEXT)
            c.drawRightString(box_x + box_w - 4 * mm, y - 6.5 * mm, 'Итоговая стоимость:')

            ty = y - 14 * mm
            for t in clean_totals:
                ci = t.find(':')
                lbl = t[:ci].strip() if ci >= 0 else t
                val = ensure_rub(t[ci + 1:].strip()) if ci >= 0 else ''
                is_std = 'standard' in lbl.lower()
                is_hdr = 'итог' in lbl.lower() and not val
                if is_hdr:
                    continue
                lbl_txt = lbl + ':'
                if is_std:
                    c.setFont('PTSans-Bold', 13)
                    c.setFillColor(ORANGE)
                    c.drawRightString(box_x + box_w * 0.50, ty, lbl_txt)
                    c.setFont('PTSans-Bold', 13)
                    c.setFillColor(ORANGE_DARK)
                    c.drawRightString(box_x + box_w - 4 * mm, ty, val)
                else:
                    c.setFont('PTSans', 9)
                    c.setFillColor(GRAY_TEXT)
                    c.drawRightString(box_x + box_w * 0.50, ty, lbl_txt)
                    c.setFont('PTSans', 9)
                    c.setFillColor(BLACK)
                    c.drawRightString(box_x + box_w - 4 * mm, ty, val)
                ty -= 9 * mm
            y = y - box_h - 4 * mm

    # ── Дисклеймер ────────────────────────────────────────────────────────────
    y -= 5 * mm
    y = check(y, 8 * mm)
    c.setFont('PTSans', 7.5)
    c.setFillColor(ORANGE)
    note = final_phrase or 'Данная смета является предварительной. Точная стоимость будет рассчитана на бесплатном замере.'
    c.drawString(margin, y, note)

    draw_footer()
    c.save()
    return buf.getvalue()


def handler(event, context):
    """Генерирует PDF-смету в стиле делового счёта и возвращает base64."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    data = json.loads(event.get('body', '{}'))

    s3 = get_s3()
    if not ensure_fonts(s3):
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font loading failed'})}

    logo_bytes = load_logo(s3)
    pdf_bytes = build_pdf(data, logo_bytes=logo_bytes)

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'pdf': base64.b64encode(pdf_bytes).decode('ascii')}),
    }