"""Генерирует PDF-смету — белый профессиональный стиль как деловой документ."""

import json
import os
import base64
import io
import re
import requests
import boto3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from datetime import date


BUCKET = 'files'

# Цвета — белая деловая тема
WHITE        = HexColor('#ffffff')
BG_PAGE      = HexColor('#ffffff')
BG_HEADER    = HexColor('#1a1a2e')   # тёмно-синяя шапка (как логотип)
ORANGE       = HexColor('#f97316')   # оранжевый акцент
ORANGE_DARK  = HexColor('#c2500a')   # тёмно-оранжевый для Standard
BG_SEC_HEAD  = HexColor('#f5f5f8')   # фон заголовка секции
TEXT_MAIN    = HexColor('#1a1a2e')   # основной текст
TEXT_DIM     = HexColor('#6b7280')   # приглушённый текст
TEXT_HEAD    = HexColor('#374151')   # заголовки колонок
BORDER_LIGHT = HexColor('#e5e7eb')   # светлая граница строк
BORDER_SEC   = HexColor('#d1d5db')   # граница секций
BG_TOTAL     = HexColor('#fff7ed')   # фон блока итогов
BORDER_TOT   = HexColor('#fed7aa')   # граница итогов

LOGO_URL     = 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/1dc8a36d-819a-489e-bdcb-25aaa523b7d9.png'
LOGO_S3_KEY  = 'assets/mospotolki-logo.png'

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
        resp = requests.get(LOGO_URL, timeout=10)
        if resp.status_code == 200 and len(resp.content) > 100:
            s3.put_object(Bucket=BUCKET, Key=LOGO_S3_KEY, Body=resp.content, ContentType='image/png')
            logo_cache[0] = resp.content
            return resp.content
    except Exception:
        pass
    return None


def split_value(value):
    v = (value or '').replace('**', '').strip()
    if not v:
        return '', ''
    # "... ₽ = total ₽"
    m = re.match(r'^(.+?[₽Рруб])\s*=\s*([\d\s,.]+\s*[₽Рруб]?)$', v)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # "qty × price" без итога
    m2 = re.match(
        r'^([\d\s,.]+\s*(?:м²|м2|мп|пм|шт\.?|шт|м\.п\.?|м)?)\s*[×xх]\s*([\d\s,.]+)\s*[₽Рруб]?$', v
    )
    if m2:
        try:
            q = float(re.sub(r'[^\d.,]', '', m2.group(1)).replace(',', '.'))
            p = float(re.sub(r'[^\d.,]', '', m2.group(2)).replace(',', '.'))
            total = f"{round(q * p):,}".replace(',', ' ') + ' ₽'
            return v, total
        except Exception:
            pass
    if re.search(r'[₽Рруб]', v):
        return '', v
    return '', v


def clean(s):
    return (s or '').replace('**', '').strip()


def ensure_rub(s):
    if not s:
        return s
    s = re.sub(r'(\d{3,})[.,]\d{2}(?=\s*[₽Рруб\s]|$)', r'\1', s)
    s = s.replace('Р', '₽').replace('руб', '₽')
    return s.strip()


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

    # Колонки: Позиция (широкая) | Кол-во | Цена/ед | Сумма
    COL = [table_w * 0.48, table_w * 0.16, table_w * 0.16, table_w * 0.20]

    # ── helpers ──────────────────────────────────────────────────────────────

    def fill_bg():
        c.setFillColor(BG_PAGE)
        c.rect(0, 0, w, h, fill=1, stroke=0)

    def new_page():
        c.showPage()
        fill_bg()
        draw_footer()
        return h - 12 * mm

    def draw_footer():
        c.setFont('PTSans', 6.5)
        c.setFillColor(TEXT_DIM)
        c.line(margin, 11 * mm, w - margin, 11 * mm)
        c.setStrokeColor(BORDER_LIGHT)
        c.setLineWidth(0.3)
        c.drawCentredString(w / 2, 7 * mm, 'MosPotolki  ·  Мытищи, Пограничная 24  ·  +7 (977) 606-89-01  ·  mospotolki.net')

    def check_space(y_pos, needed):
        if y_pos - needed < 18 * mm:
            return new_page()
        return y_pos

    def col_x(i):
        x = margin
        for k in range(i):
            x += COL[k]
        return x

    # ── Страница 1 ────────────────────────────────────────────────────────────
    fill_bg()

    # ── Шапка ────────────────────────────────────────────────────────────────
    header_h = 22 * mm
    c.setFillColor(BG_HEADER)
    c.rect(0, h - header_h, w, header_h, fill=1, stroke=0)

    # Логотип
    logo_draw_w = 0
    if logo_bytes:
        try:
            logo_img = ImageReader(io.BytesIO(logo_bytes))
            iw, ih = logo_img.getSize()
            logo_draw_h = 9 * mm
            logo_draw_w = logo_draw_h * (iw / ih)
            c.drawImage(logo_img, margin, h - header_h / 2 - logo_draw_h / 2,
                        width=logo_draw_w, height=logo_draw_h, mask='auto')
        except Exception:
            logo_draw_w = 0

    # Дата справа
    c.setFont('PTSans', 7.5)
    c.setFillColor(HexColor('#9ca3af'))
    c.drawRightString(w - margin, h - header_h / 2 + 1 * mm, f'от {today}')
    c.drawRightString(w - margin, h - header_h / 2 - 4 * mm, 'г. Мытищи, ул. Пограничная 24')

    # ── Подзаголовок документа ───────────────────────────────────────────────
    sub_h = 10 * mm
    c.setFillColor(WHITE)
    c.rect(0, h - header_h - sub_h, w, sub_h, fill=1, stroke=0)
    # оранжевая линия под шапкой
    c.setFillColor(ORANGE)
    c.rect(0, h - header_h - 0.8 * mm, w, 0.8 * mm, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 12)
    c.setFillColor(TEXT_MAIN)
    txt_x = margin + logo_draw_w + (4 * mm if logo_draw_w else 0)
    c.drawString(margin, h - header_h - sub_h + 3.2 * mm, 'СМЕТА НА НАТЯЖНЫЕ ПОТОЛКИ')

    y = h - header_h - sub_h - 6 * mm

    # ── Заголовок таблицы ─────────────────────────────────────────────────────
    th = 7 * mm
    c.setFillColor(HexColor('#374151'))
    c.rect(margin, y - th, table_w, th, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 7.5)
    c.setFillColor(WHITE)
    labels = ['ПОЗИЦИЯ', 'КОЛ-ВО', 'ЦЕНА/ЕД', 'СУММА']
    for i, lbl in enumerate(labels):
        x = col_x(i)
        if i == 0:
            c.drawString(x + 2.5 * mm, y - th + 2.3 * mm, lbl)
        else:
            c.drawRightString(x + COL[i] - 2 * mm, y - th + 2.3 * mm, lbl)

    y -= th

    # ── Строки ────────────────────────────────────────────────────────────────
    num_counter = 0
    row_parity = [0]

    def draw_section(y_pos, label):
        sh = 8 * mm
        y_pos = check_space(y_pos, sh + 4 * mm)

        c.setFillColor(BG_SEC_HEAD)
        c.rect(margin, y_pos - sh, table_w, sh, fill=1, stroke=0)

        # левая цветная полоска
        c.setFillColor(ORANGE)
        c.rect(margin, y_pos - sh, 2 * mm, sh, fill=1, stroke=0)

        c.setFont('PTSans-Bold', 9)
        c.setFillColor(TEXT_MAIN)
        c.drawString(margin + 4 * mm, y_pos - sh + 2.3 * mm, label)

        # нижняя граница секции
        c.setStrokeColor(BORDER_SEC)
        c.setLineWidth(0.4)
        c.line(margin, y_pos - sh, margin + table_w, y_pos - sh)

        row_parity[0] = 0
        return y_pos - sh

    def parse_qty_price(formula):
        """Вытаскивает qty+unit и price из строки формулы."""
        if not formula:
            return '', ''
        m = re.match(
            r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб]?)(.*)$',
            formula, re.I
        )
        if m:
            return m.group(1).strip(), ensure_rub(m.group(2).strip())
        return formula, ''

    def draw_item(y_pos, name, formula, total):
        rh = 8 * mm
        y_pos = check_space(y_pos, rh)

        # чередование фона
        bg = HexColor('#fafafa') if row_parity[0] % 2 == 1 else WHITE
        c.setFillColor(bg)
        c.rect(margin, y_pos - rh, table_w, rh, fill=1, stroke=0)

        # нижняя граница
        c.setStrokeColor(BORDER_LIGHT)
        c.setLineWidth(0.25)
        c.line(margin, y_pos - rh, margin + table_w, y_pos - rh)

        text_y = y_pos - rh + 2.3 * mm

        # Название
        c.setFont('PTSans', 8.5)
        c.setFillColor(TEXT_MAIN)
        max_ch = int(COL[0] / (8.5 * 0.21 * mm))
        nm = name if len(name) <= max_ch else name[:max_ch - 1] + '…'
        c.drawString(margin + 2.5 * mm, text_y, nm)

        # Кол-во и цена/ед из формулы
        qty_str, price_str = parse_qty_price(formula)

        c.setFont('PTSans', 8)
        c.setFillColor(TEXT_DIM)
        if qty_str:
            c.drawRightString(col_x(1) + COL[1] - 2 * mm, text_y, ensure_rub(qty_str))
        if price_str:
            c.drawRightString(col_x(2) + COL[2] - 2 * mm, text_y, ensure_rub(price_str))

        # Сумма — жирная, цветная
        if total:
            c.setFont('PTSans-Bold', 8.5)
            c.setFillColor(ORANGE_DARK)
            c.drawRightString(col_x(3) + COL[3] - 2 * mm, text_y, ensure_rub(total))

        # вертикальные разделители колонок
        c.setStrokeColor(BORDER_LIGHT)
        c.setLineWidth(0.25)
        for i in range(1, 4):
            x = col_x(i)
            c.line(x, y_pos - rh, x, y_pos)

        row_parity[0] += 1
        return y_pos - rh

    # ── Рендер блоков ────────────────────────────────────────────────────────
    for block in blocks:
        if block.get('numbered', False):
            num_counter += 1
        title = clean(block.get('title', ''))
        label = f'{num_counter}. {title}' if block.get('numbered') else title
        y = draw_section(y, label)

        for item in block.get('items', []):
            name = re.sub(r'\s*[-–—]\s*$', '', clean(item.get('name', '')))
            value = clean(item.get('value', ''))
            formula, total = split_value(value)
            y = draw_item(y, name, formula, total)

    # ── Итого ─────────────────────────────────────────────────────────────────
    if totals:
        clean_totals = [clean(t) for t in totals
                        if clean(t) and not re.fullmatch(r'[-–—]+', clean(t))]
        if clean_totals:
            box_h = (9 + len(clean_totals) * 8) * mm
            y -= 5 * mm
            y = check_space(y, box_h + 8 * mm)

            # Фон и рамка блока итогов
            c.setFillColor(BG_TOTAL)
            c.setStrokeColor(BORDER_TOT)
            c.setLineWidth(0.5)
            c.roundRect(margin, y - box_h, table_w, box_h, 2 * mm, fill=1, stroke=1)

            # Заголовок блока
            c.setFont('PTSans-Bold', 8)
            c.setFillColor(TEXT_DIM)
            c.drawRightString(w - margin - 3 * mm, y - 6 * mm, 'Итоговая стоимость:')

            ty = y - 13 * mm
            for t in clean_totals:
                ci = t.find(':')
                lbl = t[:ci].strip() if ci >= 0 else t
                val = ensure_rub(t[ci + 1:].strip()) if ci >= 0 else ''
                is_standard = 'standard' in lbl.lower()
                is_header   = 'итог' in lbl.lower() and not val

                if is_header:
                    ty -= 2 * mm
                    continue

                lbl_txt = lbl + (':' if ci >= 0 else '')

                if is_standard:
                    c.setFont('PTSans-Bold', 12)
                    c.setFillColor(ORANGE)
                    c.drawRightString(w - margin - 3 * mm - 38 * mm, ty, lbl_txt)
                    c.setFont('PTSans-Bold', 12)
                    c.setFillColor(ORANGE_DARK)
                    c.drawRightString(w - margin - 3 * mm, ty, val)
                else:
                    c.setFont('PTSans', 8.5)
                    c.setFillColor(TEXT_DIM)
                    c.drawRightString(w - margin - 3 * mm - 38 * mm, ty, lbl_txt)
                    c.setFont('PTSans', 8.5)
                    c.setFillColor(TEXT_MAIN)
                    c.drawRightString(w - margin - 3 * mm, ty, val)

                ty -= 8 * mm
            y = ty - 3 * mm

    # ── Дисклеймер ────────────────────────────────────────────────────────────
    y -= 5 * mm
    y = check_space(y, 8 * mm)
    c.setFont('PTSans', 7)
    c.setFillColor(TEXT_DIM)
    note = final_phrase or 'Данная смета является предварительной. Точная стоимость будет рассчитана на бесплатном замере.'
    c.drawString(margin, y, note)

    draw_footer()
    c.save()
    return buf.getvalue()


def handler(event, context):
    """Генерирует PDF-смету в белом профессиональном стиле."""
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
    pdf_b64 = base64.b64encode(pdf_bytes).decode('ascii')

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'pdf': pdf_b64}),
    }
