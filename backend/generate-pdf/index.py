"""Генерирует PDF-смету в тёмном стиле — идентично рендеру в редакторе."""

import json
import os
import base64
import io
import re
import requests
import boto3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, white, HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import date


BUCKET = 'files'

# Цвета — тёмная тема как в редакторе
BG_PAGE       = HexColor('#0b0b11')      # фон страницы
BG_HEADER     = HexColor('#0d0d18')      # шапка документа
BG_SECTION    = HexColor('#12121c')      # строка-заголовок секции
BG_ROW        = HexColor('#0e0e16')      # обычная строка
BG_ROW_ALT    = HexColor('#0b0b13')      # чередование строк
BG_TOTALS     = HexColor('#13100a')      # блок итогов
BORDER        = HexColor('#ffffff14')    # граница (белая 8% прозрачность)
BORDER_ORANGE = HexColor('#ff6b0044')    # граница секции
COL_ORANGE    = HexColor('#fb923c')      # оранжевый (заголовки, цены)
COL_WHITE     = HexColor('#e5e5f0')      # белый текст
COL_DIM       = HexColor('#8888aa')      # приглушённый текст
COL_FORMULA   = HexColor('#666688')      # формула (серый)
COL_STANDARD  = HexColor('#fb923c')      # Standard — оранжевый жирный
COL_OTHER     = HexColor('#aaaacc')      # Econom / Premium
COL_HEAD_COL  = HexColor('#555577')      # заголовки колонок

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


def split_value(value):
    """Разбивает строку значения на (формула, итог)."""
    v = value.replace('**', '').strip()
    if not v:
        return '', ''
    # "qty ед × price ₽ = total ₽"
    m = re.match(
        r'^(.+?[₽Рруб])\s*=\s*([\d\s,.]+\s*[₽Рруб]?)$', v
    )
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # "qty × price" без итога — считаем
    m2 = re.match(
        r'^([\d\s,.]+\s*(?:м²|м2|мп|пм|шт\.?|шт|м\.п\.?|м)?)\s*[×xх]\s*([\d\s,.]+)\s*[₽Рруб]?$', v
    )
    if m2:
        try:
            q = float(re.sub(r'[^\d.,]', '', m2.group(1)).replace(',', '.'))
            p = float(re.sub(r'[^\d.,]', '', m2.group(2)).replace(',', '.'))
            total = f"{round(q * p):,}".replace(',', '\u202f') + '\u202f\u20bd'
            return v, total
        except Exception:
            pass
    # просто итог
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


def build_pdf(data):
    blocks = data.get('blocks', [])
    totals = data.get('totals', [])
    final_phrase = data.get('finalPhrase', '')

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    margin = 12 * mm
    table_w = w - 2 * margin

    # Колонки: Позиция | (формула справа + итог)
    # В редакторе — 2 колонки: левая (название) + правая (формула сверху, цена снизу)
    col_name_w  = table_w * 0.62
    col_price_w = table_w * 0.38

    today = date.today().strftime('%d.%m.%Y')

    page_num = [1]

    def fill_bg():
        c.setFillColor(BG_PAGE)
        c.rect(0, 0, w, h, fill=1, stroke=0)

    def new_page():
        c.showPage()
        page_num[0] += 1
        fill_bg()
        # Тонкий футер
        c.setFont('PTSans', 6.5)
        c.setFillColor(COL_DIM)
        c.drawCentredString(w / 2, 6 * mm, 'MosPotolki | +7 (977) 606-89-01 | mospotolki.net')
        return h - 14 * mm

    fill_bg()

    # ── Шапка ────────────────────────────────────────────────────────────────
    header_h = 28 * mm
    c.setFillColor(BG_HEADER)
    c.rect(0, h - header_h, w, header_h, fill=1, stroke=0)

    # Оранжевая полоска снизу шапки
    c.setFillColor(COL_ORANGE)
    c.rect(0, h - header_h, w, 0.6 * mm, fill=1, stroke=0)

    # Иконка-квадратик слева от заголовка
    c.setFillColor(COL_ORANGE)
    c.roundRect(margin, h - 10 * mm - 5 * mm, 4 * mm, 4 * mm, 0.8 * mm, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 13)
    c.setFillColor(COL_WHITE)
    c.drawString(margin + 6 * mm, h - 10 * mm - 2.5 * mm, 'Смета на натяжные потолки')

    c.setFont('PTSans', 7.5)
    c.setFillColor(COL_DIM)
    c.drawString(margin + 6 * mm, h - 10 * mm - 7.5 * mm, f'Мытищи, Пограничная 24  ·  +7 (977) 606-89-01  ·  mospotolki.net')

    c.setFont('PTSans', 7.5)
    c.setFillColor(COL_DIM)
    c.drawRightString(w - margin, h - 10 * mm - 2.5 * mm, f'от {today}')

    y = h - header_h - 4 * mm

    # ── Заголовок таблицы ─────────────────────────────────────────────────
    col_head_h = 7 * mm
    c.setFillColor(HexColor('#0f0f1a'))
    c.rect(margin, y - col_head_h, table_w, col_head_h, fill=1, stroke=0)
    # нижняя граница
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.4)
    c.line(margin, y - col_head_h, margin + table_w, y - col_head_h)

    c.setFont('PTSans-Bold', 7.5)
    c.setFillColor(COL_HEAD_COL)
    c.drawString(margin + 3 * mm, y - col_head_h + 2.3 * mm, 'ПОЗИЦИЯ')
    c.drawRightString(margin + table_w - 3 * mm, y - col_head_h + 2.3 * mm, 'СТОИМОСТЬ')

    y -= col_head_h

    def check_space(y_pos, needed):
        if y_pos - needed < 16 * mm:
            return new_page()
        return y_pos

    # ── Строки таблицы ────────────────────────────────────────────────────
    num_counter = 0
    row_idx = [0]

    def draw_section_header(y_pos, label):
        sh = 9 * mm
        y_pos = check_space(y_pos, sh + 2 * mm)

        # фон секции
        c.setFillColor(BG_SECTION)
        c.rect(margin, y_pos - sh, table_w, sh, fill=1, stroke=0)

        # левая оранжевая полоска
        c.setFillColor(COL_ORANGE)
        c.rect(margin, y_pos - sh, 1.5 * mm, sh, fill=1, stroke=0)

        # нижняя граница
        c.setStrokeColor(BORDER_ORANGE)
        c.setLineWidth(0.4)
        c.line(margin, y_pos - sh, margin + table_w, y_pos - sh)

        c.setFont('PTSans-Bold', 9)
        c.setFillColor(COL_ORANGE)
        c.drawString(margin + 4 * mm, y_pos - sh + 2.8 * mm, label)

        return y_pos - sh

    def draw_item_row(y_pos, name, formula, total, alt=False):
        rh = 12 * mm if formula else 8 * mm
        y_pos = check_space(y_pos, rh)

        bg = BG_ROW_ALT if alt else BG_ROW
        c.setFillColor(bg)
        c.rect(margin, y_pos - rh, table_w, rh, fill=1, stroke=0)

        # нижняя граница
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.3)
        c.line(margin, y_pos - rh, margin + table_w, y_pos - rh)

        # Название (левая колонка)
        c.setFont('PTSans', 8.5)
        c.setFillColor(COL_WHITE)
        # обрезаем если не влезает
        max_chars = int(col_name_w / (8.5 * 0.22 * mm))
        txt = name if len(name) <= max_chars else name[:max_chars - 1] + '…'
        if formula:
            text_y = y_pos - 5 * mm
        else:
            text_y = y_pos - rh + 2.5 * mm
        c.drawString(margin + 3 * mm, text_y, txt)

        # Правая колонка: формула (серая, мелкая) + итог (оранжевый, жирный)
        rx = margin + table_w - 3 * mm
        if formula:
            c.setFont('PTSans', 7)
            c.setFillColor(COL_FORMULA)
            c.drawRightString(rx, y_pos - 4.5 * mm, ensure_rub(formula))

            c.setFont('PTSans-Bold', 9)
            c.setFillColor(COL_ORANGE)
            c.drawRightString(rx, y_pos - 9.5 * mm, ensure_rub(total))
        elif total:
            c.setFont('PTSans-Bold', 9)
            c.setFillColor(COL_ORANGE)
            c.drawRightString(rx, text_y, ensure_rub(total))

        row_idx[0] += 1
        return y_pos - rh

    # Рендерим блоки
    for block in blocks:
        if block.get('numbered', False):
            num_counter += 1
        title = clean(block.get('title', ''))
        label = f'{num_counter}. {title}' if block.get('numbered') else title

        y = draw_section_header(y, label)

        for i, item in enumerate(block.get('items', [])):
            name = re.sub(r'\s*[-–—]\s*$', '', clean(item.get('name', '')))
            value = clean(item.get('value', ''))
            formula, total = split_value(value)
            y = draw_item_row(y, name, formula, total, alt=(i % 2 == 1))

    # ── Итого ─────────────────────────────────────────────────────────────
    if totals:
        clean_totals = [clean(t) for t in totals if clean(t) and not re.fullmatch(r'[-–—]+', clean(t))]
        if clean_totals:
            box_h = (6 + len(clean_totals) * 8) * mm
            y -= 4 * mm
            y = check_space(y, box_h + 6 * mm)

            # фон блока итогов
            c.setFillColor(BG_TOTALS)
            c.rect(margin, y - box_h, table_w, box_h, fill=1, stroke=0)

            # верхняя граница
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.4)
            c.line(margin, y, margin + table_w, y)
            c.line(margin, y - box_h, margin + table_w, y - box_h)

            # Надпись "Итоговая стоимость:"
            c.setFont('PTSans', 7.5)
            c.setFillColor(COL_DIM)
            c.drawRightString(margin + table_w - 3 * mm, y - 4.5 * mm, 'Итоговая стоимость:')

            ty = y - 11 * mm
            for t in clean_totals:
                ci = t.find(':')
                lbl = t[:ci].strip() if ci >= 0 else t
                val = ensure_rub(t[ci + 1:].strip()) if ci >= 0 else ''

                is_standard = 'standard' in lbl.lower()
                is_total_line = 'итог' in lbl.lower()

                if is_total_line:
                    c.setFont('PTSans-Bold', 8)
                    c.setFillColor(COL_DIM)
                    c.drawRightString(margin + table_w - 3 * mm, ty, lbl + ':' if ci >= 0 else lbl)
                    if val:
                        c.drawRightString(margin + table_w - 3 * mm, ty - 5 * mm, val)
                    ty -= 8 * mm
                    continue

                if is_standard:
                    c.setFont('PTSans-Bold', 11)
                    c.setFillColor(COL_STANDARD)
                else:
                    c.setFont('PTSans', 8.5)
                    c.setFillColor(COL_OTHER)

                lbl_txt = lbl + ':'
                c.drawRightString(margin + table_w - 3 * mm - 60 * mm, ty, lbl_txt)

                if val:
                    if is_standard:
                        c.setFont('PTSans-Bold', 11)
                        c.setFillColor(COL_STANDARD)
                    else:
                        c.setFont('PTSans', 8.5)
                        c.setFillColor(COL_OTHER)
                    c.drawRightString(margin + table_w - 3 * mm, ty, val)

                ty -= 8 * mm

            y = ty - 2 * mm

    # Дисклеймер
    y -= 4 * mm
    y = check_space(y, 8 * mm)
    c.setFont('PTSans', 7)
    c.setFillColor(COL_FORMULA)
    note = final_phrase or 'Данная смета является предварительной. Точная стоимость будет рассчитана на бесплатном замере.'
    c.drawString(margin, y, note)

    # Футер
    c.setFont('PTSans', 6.5)
    c.setFillColor(COL_DIM)
    c.drawCentredString(w / 2, 6 * mm, 'MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01 | mospotolki.net')

    c.save()
    return buf.getvalue()


def handler(event, context):
    """Генерирует PDF-смету в тёмном стиле и возвращает base64."""
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

    body = event.get('body', '{}')
    data = json.loads(body)

    s3 = get_s3()
    if not ensure_fonts(s3):
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font loading failed'})}

    pdf_bytes = build_pdf(data)
    pdf_b64 = base64.b64encode(pdf_bytes).decode('ascii')

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'pdf': pdf_b64}),
    }
