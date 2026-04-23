"""Генерирует PDF-смету — современный деловой стиль."""

import json, os, base64, io, re, requests, boto3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from datetime import date

BUCKET = 'files'

# ── Палитра — современная деловая ────────────────────────────────────────────
WHITE         = HexColor('#ffffff')
BG_PAGE       = HexColor('#f8f9fa')   # лёгкий серый фон страницы
CARD_BG       = HexColor('#ffffff')   # белая карточка таблицы
BLACK         = HexColor('#1e2029')   # почти чёрный текст
ACCENT        = HexColor('#f97316')   # оранжевый бренд
ACCENT_DARK   = HexColor('#c2500a')   # тёмно-оранж для сумм
HEADER_BG     = HexColor('#1e2029')   # тёмный заголовок таблицы
SEC_BG        = HexColor('#f1f3f5')   # светло-серый фон секции
SEC_STRIPE    = HexColor('#f97316')   # оранжевая левая полоска
ROW_ALT       = HexColor('#fafafa')   # чуть светлее для чётных строк
BORDER_INNER  = HexColor('#e9ecef')   # внутренние линии
BORDER_OUTER  = HexColor('#ced4da')   # внешняя рамка
TEXT_MUTED    = HexColor('#868e96')   # серый текст (Кол-во, Цена)
TEXT_SECTION  = HexColor('#343a40')   # текст секции
TOTAL_BG      = HexColor('#ffffff')   # белый фон блока итогов
TOTAL_BORDER  = HexColor('#dee2e6')
TOTAL_STD_BG  = HexColor('#fff4ec')   # фон строки Standard

LOGO_URL    = 'https://cdn.poehali.dev/files/3a96cf97-dbfb-47e7-8b6a-f8f01d5998e2.png'
LOGO_S3_KEY = 'assets/mospotolki-logo-v2.png'

FONT_URLS = {
    'regular': {'key': 'fonts/PTSans-Regular.ttf', 'urls': [
        'https://raw.githubusercontent.com/openmaptiles/fonts/master/pt-sans/PTSans-Regular.ttf',
        'https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79D0KExQ.ttf',
    ]},
    'bold': {'key': 'fonts/PTSans-Bold.ttf', 'urls': [
        'https://raw.githubusercontent.com/openmaptiles/fonts/master/pt-sans/PTSans-Bold.ttf',
        'https://fonts.gstatic.com/s/ptsans/v17/jizfRExUiTo99u79B_mh4OmnLD0Z4zM.ttf',
    ]},
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


def rub(s):
    if not s:
        return s
    s = re.sub(r'(\d{3,})[.,]\d{2}(?=\s*[₽Рруб\s]|$)', r'\1', s)
    return s.replace('Р', '₽').replace('руб', '₽').strip()


def split_value(value):
    v = clean(value)
    if not v:
        return '', '', ''
    m = re.match(
        r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб]?)\s*=\s*([\d\s,.]+\s*[₽Рруб]?)$',
        v, re.I)
    if m:
        return m.group(1).strip(), rub(m.group(2).strip()), rub(m.group(3).strip())
    m2 = re.match(
        r'^([\d,.\s]+\s*(?:м²|м2|мп|пм|пог\.?м|шт\.?|шт|м\.п\.?|м|%)?)\s*[×xх]\s*([\d\s,.]+)\s*[₽Рруб]?$',
        v, re.I)
    if m2:
        try:
            q = float(re.sub(r'[^\d.,]', '', m2.group(1)).replace(',', '.'))
            p = float(re.sub(r'[^\d.,]', '', m2.group(2)).replace(',', '.'))
            return (m2.group(1).strip(),
                    f"{round(p):,}".replace(',', '\u202f') + '\u202f₽',
                    f"{round(q*p):,}".replace(',', '\u202f') + '\u202f₽')
        except Exception:
            pass
    if re.search(r'[₽Рруб]', v):
        return '', '', rub(v)
    return '', '', ''


def build_pdf(data, logo_bytes=None):
    blocks       = data.get('blocks', [])
    totals_raw   = data.get('totals', [])
    final_phrase = data.get('finalPhrase', '')

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    mg   = 14 * mm          # внешний отступ
    card_mg = 14 * mm       # отступ карточки таблицы
    tw   = w - 2 * card_mg  # ширина таблицы
    today = date.today().strftime('%d.%m.%Y')

    # Колонки: Позиция 54% | Кол-во 15% | Цена 15% | Сумма 16%
    CW = [tw * 0.54, tw * 0.15, tw * 0.15, tw * 0.16]

    def cx(i):
        x = card_mg
        for k in range(i): x += CW[k]
        return x

    def shadow_rect(x, y, w_, h_, radius=2*mm):
        """Рисует карточку с тенью."""
        # тень
        c.setFillColor(HexColor('#00000012'))
        c.roundRect(x + 0.8*mm, y - 0.8*mm, w_, h_, radius, fill=1, stroke=0)
        # карточка
        c.setFillColor(CARD_BG)
        c.setStrokeColor(BORDER_OUTER)
        c.setLineWidth(0.6)
        c.roundRect(x, y, w_, h_, radius, fill=1, stroke=1)

    def draw_footer():
        c.setFillColor(BG_PAGE)
        c.rect(0, 0, w, 14*mm, fill=1, stroke=0)
        c.setFont('PTSans', 6.5)
        c.setFillColor(TEXT_MUTED)
        c.drawCentredString(w/2, 5.5*mm,
            'MosPotolki  ·  г. Мытищи, ул. Пограничная 24  ·  +7 (977) 606-89-01  ·  mospotolki.net')

    table_top = [0]

    def check(yy, need):
        if yy - need < 16*mm:
            if table_top[0]:
                # закрываем рамку таблицы
                c.setStrokeColor(BORDER_OUTER)
                c.setLineWidth(0.6)
                c.line(card_mg, yy, card_mg + tw, yy)
                c.line(card_mg, yy, card_mg, table_top[0])
                c.line(card_mg + tw, yy, card_mg + tw, table_top[0])
            c.showPage()
            c.setFillColor(BG_PAGE)
            c.rect(0, 0, w, h, fill=1, stroke=0)
            draw_footer()
            table_top[0] = h - 14*mm
            return h - 14*mm
        return yy

    # ── Фон страницы ──────────────────────────────────────────────────────────
    c.setFillColor(BG_PAGE)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # ── ШАПКА ─────────────────────────────────────────────────────────────────
    # Белая карточка шапки
    header_h = 38 * mm
    shadow_rect(mg, h - mg - header_h, w - 2*mg, header_h, radius=2.5*mm)

    # Оранжевая вертикальная полоска слева в шапке
    c.setFillColor(ACCENT)
    c.roundRect(mg, h - mg - header_h, 3*mm, header_h, 1*mm, fill=1, stroke=0)

    # Левая часть: СМЕТА
    lx = mg + 7*mm
    c.setFont('PTSans-Bold', 36)
    c.setFillColor(BLACK)
    c.drawString(lx, h - mg - 16*mm, 'СМЕТА')

    c.setFont('PTSans-Bold', 10)
    c.setFillColor(ACCENT)
    c.drawString(lx, h - mg - 23*mm, 'на натяжные потолки')

    c.setFont('PTSans', 8)
    c.setFillColor(TEXT_MUTED)
    c.drawString(lx, h - mg - 29*mm, f'Предварительный расчёт  ·  от {today}')

    # Правая часть: логотип + контакты
    right_block_x = w / 2 + 5*mm
    right_block_w = w - mg - right_block_x - 4*mm

    # Тёмная плашка логотипа
    logo_pill_h = 13 * mm
    logo_pill_y = h - mg - logo_pill_h - 4*mm
    c.setFillColor(HexColor('#1e2029'))
    c.roundRect(right_block_x, logo_pill_y, right_block_w, logo_pill_h, 2*mm, fill=1, stroke=0)

    if logo_bytes:
        try:
            img = ImageReader(io.BytesIO(logo_bytes))
            iw, ih_ = img.getSize()
            lh = logo_pill_h * 0.68
            lw_ = lh * (iw / ih_)
            c.drawImage(img,
                right_block_x + (right_block_w - lw_) / 2,
                logo_pill_y + (logo_pill_h - lh) / 2,
                width=lw_, height=lh, mask='auto')
        except Exception:
            pass

    # Контакты под логотипом
    contacts = ['+7 (977) 606-89-01', 'mospotolki.net', 'г. Мытищи, ул. Пограничная 24']
    cy = logo_pill_y - 5.5*mm
    for ct in contacts:
        c.setFont('PTSans', 7.5)
        c.setFillColor(TEXT_MUTED)
        c.drawRightString(right_block_x + right_block_w, cy, ct)
        cy -= 4.5*mm

    # ── ТАБЛИЦА ───────────────────────────────────────────────────────────────
    y = h - mg - header_h - 6*mm

    # Заголовок таблицы — скруглён только сверху
    th = 8.5*mm
    r = 2.5*mm
    c.setFillColor(HEADER_BG)
    c.roundRect(card_mg, y - th, tw, th + r, r, fill=1, stroke=0)  # верхние углы скруглены
    c.rect(card_mg, y - th, tw, r, fill=1, stroke=0)               # нижние углы прямые

    c.setFont('PTSans-Bold', 8)
    c.setFillColor(WHITE)
    for i, lbl in enumerate(['Позиция', 'Кол-во', 'Цена', 'Сумма']):
        if i == 0:
            c.drawString(cx(0) + 4*mm, y - th + 2.8*mm, lbl)
        else:
            c.drawCentredString(cx(i) + CW[i]/2, y - th + 2.8*mm, lbl)

    table_top[0] = y
    y -= th

    row_idx = [0]

    def draw_section(yy, label):
        sh = 8*mm
        yy = check(yy, sh + 5*mm)
        c.setFillColor(SEC_BG)
        c.rect(card_mg, yy - sh, tw, sh, fill=1, stroke=0)
        c.setFillColor(SEC_STRIPE)
        c.rect(card_mg, yy - sh, 3*mm, sh, fill=1, stroke=0)
        c.setFont('PTSans-Bold', 9)
        c.setFillColor(TEXT_SECTION)
        c.drawString(card_mg + 6*mm, yy - sh + 2.4*mm, label)
        # нижняя линия секции
        c.setStrokeColor(BORDER_INNER)
        c.setLineWidth(0.35)
        c.line(card_mg, yy - sh, card_mg + tw, yy - sh)
        row_idx[0] = 0
        return yy - sh

    def draw_row(yy, name, qty, price, total):
        rh = 8*mm
        yy = check(yy, rh)
        bg = WHITE if row_idx[0] % 2 == 0 else ROW_ALT
        c.setFillColor(bg)
        c.rect(card_mg, yy - rh, tw, rh, fill=1, stroke=0)

        ry = yy - rh + 2.5*mm

        # Название
        c.setFont('PTSans', 8.5)
        c.setFillColor(BLACK)
        max_ch = int(CW[0] / (8.5 * 0.195 * mm))
        nm = name[:max_ch-1] + '…' if len(name) > max_ch else name
        c.drawString(cx(0) + 4*mm, ry, nm)

        # Кол-во / Цена
        c.setFont('PTSans', 8)
        c.setFillColor(BLACK)
        if qty:
            c.drawCentredString(cx(1) + CW[1]/2, ry, rub(qty))
        if price:
            c.drawCentredString(cx(2) + CW[2]/2, ry, rub(price))

        # Сумма
        if total:
            c.setFont('PTSans-Bold', 8.5)
            c.setFillColor(ACCENT_DARK)
            c.drawRightString(cx(3) + CW[3] - 4*mm, ry, rub(total))

        # Горизонтальная линия строки
        c.setStrokeColor(BORDER_INNER)
        c.setLineWidth(0.25)
        c.line(card_mg, yy - rh, card_mg + tw, yy - rh)

        # Вертикальные разделители колонок
        c.setStrokeColor(BORDER_INNER)
        c.setLineWidth(0.25)
        for i in range(1, 4):
            c.line(cx(i), yy - rh, cx(i), yy)

        row_idx[0] += 1
        return yy - rh

    # ── Рендер данных ─────────────────────────────────────────────────────────
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
            qty_, price_, total_ = split_value(value)
            y = draw_row(y, name, qty_, price_, total_)

    # Внешняя рамка таблицы — roundRect только stroke, fill=0, не перекрывает текст
    table_h = table_top[0] - y
    c.setStrokeColor(BORDER_OUTER)
    c.setLineWidth(0.8)
    c.roundRect(card_mg, y, tw, table_h, 2.5*mm, fill=0, stroke=1)

    # ── БЛОК ИТОГОВ ───────────────────────────────────────────────────────────
    if totals_raw:
        rows = []
        for t in totals_raw:
            t = clean(t)
            if not t or re.fullmatch(r'[-–—]+', t):
                continue
            ci = t.find(':')
            lbl_ = t[:ci].strip() if ci >= 0 else t
            val_ = rub(t[ci+1:].strip()) if ci >= 0 else ''
            if 'итог' in lbl_.lower() and not val_:
                continue
            rows.append((lbl_, val_))

        if rows:
            # Компактные высоты строк
            STD_ROW_H  = 12 * mm   # строка Standard — чуть выше
            NORM_ROW_H = 8  * mm   # Econom / Premium — компактно
            HEAD_H     = 8  * mm   # заголовок "Итоговая стоимость"
            PAD_V      = 4  * mm   # паддинг снизу

            total_rows_h = sum(STD_ROW_H if 'standard' in r[0].lower() else NORM_ROW_H for r in rows)
            box_h = HEAD_H + total_rows_h + PAD_V

            y -= 7*mm
            y = check(y, box_h + 14*mm)

            # Правые 52% страницы
            box_w = tw * 0.52
            box_x = card_mg + tw - box_w
            box_y = y - box_h

            # Тень
            c.setFillColor(HexColor('#00000010'))
            c.roundRect(box_x + 0.8*mm, box_y - 0.8*mm, box_w, box_h, 2.5*mm, fill=1, stroke=0)

            # Белая карточка
            c.setFillColor(TOTAL_BG)
            c.setStrokeColor(BORDER_OUTER)
            c.setLineWidth(0.6)
            c.roundRect(box_x, box_y, box_w, box_h, 2.5*mm, fill=1, stroke=1)

            # "Итоговая стоимость:" — прижато к правому краю
            c.setFont('PTSans-Bold', 7.5)
            c.setFillColor(TEXT_MUTED)
            c.drawRightString(box_x + box_w - 5*mm, y - 5.5*mm, 'Итоговая стоимость:')

            # Разделитель под заголовком
            c.setStrokeColor(BORDER_INNER)
            c.setLineWidth(0.4)
            c.line(box_x + 5*mm, y - HEAD_H, box_x + box_w - 5*mm, y - HEAD_H)

            val_x = box_x + box_w - 6*mm
            lbl_x = box_x + box_w * 0.46
            ty = y - HEAD_H

            for lbl_, val_ in rows:
                is_std = 'standard' in lbl_.lower()
                rh = STD_ROW_H if is_std else NORM_ROW_H

                # Точное вертикальное центрирование текста в строке
                font_size_std  = 13
                font_size_norm = 9
                # Baseline = низ строки + (высота строки - размер шрифта) / 2
                if is_std:
                    mid_y = ty - rh + (rh - font_size_std * 0.352 * mm) / 2
                else:
                    mid_y = ty - rh + (rh - font_size_norm * 0.352 * mm) / 2

                if is_std:
                    # Подсветка — занимает всю высоту строки без зазоров
                    c.setFillColor(TOTAL_STD_BG)
                    c.rect(box_x + 1*mm, ty - rh + 0.5*mm, box_w - 2*mm, rh - 1*mm, fill=1, stroke=0)

                    c.setFont('PTSans-Bold', font_size_std)
                    c.setFillColor(ACCENT)
                    c.drawRightString(lbl_x, mid_y, lbl_ + ':')
                    c.setFillColor(ACCENT_DARK)
                    c.drawRightString(val_x, mid_y, val_)
                else:
                    c.setFont('PTSans', font_size_norm)
                    c.setFillColor(TEXT_MUTED)
                    c.drawRightString(lbl_x, mid_y, lbl_ + ':')
                    c.setFillColor(BLACK)
                    c.drawRightString(val_x, mid_y, val_)

                ty -= rh

            y = box_y - 6*mm

            # ── Блок-CTA: серая плашка во всю ширину таблицы ─────────────────
            y -= 5*mm
            cta_h = 11 * mm
            y = check(y, cta_h + 6*mm)

            # Серый фон
            c.setFillColor(HexColor('#f1f3f5'))
            c.setStrokeColor(HexColor('#dee2e6'))
            c.setLineWidth(0.5)
            c.roundRect(card_mg, y - cta_h, tw, cta_h, 2*mm, fill=1, stroke=1)

            # Левый текст
            text_y = y - cta_h + (cta_h - 8.5 * 0.352 * mm) / 2
            c.setFont('PTSans', 8.5)
            c.setFillColor(BLACK)
            c.drawString(card_mg + 4*mm, text_y,
                'Технолог готов приехать к вам ')
            c.setFont('PTSans-Bold', 8.5)
            c.setFillColor(ACCENT)
            # Измеряем ширину первой части
            first_part_w = c.stringWidth('Технолог готов приехать к вам ', 'PTSans', 8.5)
            c.drawString(card_mg + 4*mm + first_part_w, text_y, 'БЕСПЛАТНО')
            free_w = c.stringWidth('БЕСПЛАТНО', 'PTSans-Bold', 8.5)
            c.setFont('PTSans', 8.5)
            c.setFillColor(BLACK)
            c.drawString(card_mg + 4*mm + first_part_w + free_w, text_y,
                '  На какой день вас записать?')

            # Кнопка "Записаться" справа — оранжевая с гиперссылкой
            btn_w = 30 * mm
            btn_h = 7 * mm
            btn_x = card_mg + tw - btn_w - 4*mm
            btn_y = y - cta_h + (cta_h - btn_h) / 2

            c.setFillColor(ACCENT)
            c.roundRect(btn_x, btn_y, btn_w, btn_h, 1.5*mm, fill=1, stroke=0)

            btn_text_y = btn_y + (btn_h - 8 * 0.352 * mm) / 2
            c.setFont('PTSans-Bold', 8)
            c.setFillColor(WHITE)
            c.drawCentredString(btn_x + btn_w / 2, btn_text_y, 'Записаться')

            # Гиперссылка на звонок
            from reportlab.lib.pdfencrypt import StandardEncryption
            c.linkURL('tel:+79776068901',
                (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
                relative=0)

            y = y - cta_h

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