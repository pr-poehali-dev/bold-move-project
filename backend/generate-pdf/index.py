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


def _is_dark_hex(hex_str):
    """Возвращает True если цвет тёмный (для выбора светлой версии логотипа)."""
    try:
        s = hex_str.lstrip('#')
        if len(s) == 3:
            s = ''.join(c*2 for c in s)
        r = int(s[0:2], 16); g = int(s[2:4], 16); b = int(s[4:6], 16)
        # Стандартная формула яркости
        return (0.299*r + 0.587*g + 0.114*b) < 128
    except Exception:
        return False


def load_logo_from_url(url):
    """Скачивает логотип компании по URL (без кеша). Безопасно при ошибке."""
    if not url:
        return None
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200 and len(r.content) > 100:
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
    # Универсальный regex: число + любая единица из русских/латинских букв и точек до знака ×
    # Примеры: "20 м²", "18 п.м", "1 шт", "24 пог.м", "5 м.п."
    UNIT = r'(?:[а-яёa-z]+\.?[а-яёa-z]*\.?|м²|м2|%)?'
    # Полная форма: qty × price = total
    m = re.match(
        rf'^([\d,.\s]+\s*{UNIT})\s*[×xх*]\s*([\d\s,.]+\s*[₽Рруб]?)\s*=\s*([\d\s,.]+\s*[₽Рруб]?)$',
        v, re.I)
    if m:
        return m.group(1).strip(), rub(m.group(2).strip()), rub(m.group(3).strip())
    # Сокращённая: qty × price (без =)
    m2 = re.match(
        rf'^([\d,.\s]+\s*{UNIT})\s*[×xх*]\s*([\d\s,.]+)\s*[₽Рруб]?$',
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


def build_pdf(data, logo_bytes=None, brand=None):
    blocks       = data.get('blocks', [])
    totals_raw   = data.get('totals', [])
    final_phrase = data.get('finalPhrase', '')

    # Бренд: либо из аргумента, либо из data.brand, иначе дефолт
    if brand is None:
        brand = data.get('brand') or {}

    brand_phone   = (brand.get('support_phone')      or '+7 (977) 606-89-01').strip()
    brand_website = (brand.get('website')            or 'mospotolki.net').strip()
    brand_addr    = (brand.get('pdf_footer_address') or 'г. Мытищи, ул. Пограничная 24').strip()
    brand_name    = (brand.get('company_name')       or 'MosPotolki').strip()
    brand_color   = (brand.get('brand_color')        or '#f97316').strip()
    # Динамический акцент: если задан корректный hex — используем
    try:
        custom_accent = HexColor(brand_color)
    except Exception:
        custom_accent = ACCENT
    # Цвет текста позиций (pdf_text_color)
    _raw_text_color = (brand.get('pdf_text_color') or '').strip()
    try:
        custom_text = HexColor(_raw_text_color) if _raw_text_color else BLACK
    except Exception:
        custom_text = BLACK

    # Подложка логотипа: auto / transparent / white / dark / hex
    logo_bg_mode = (brand.get('pdf_logo_bg') or 'auto').strip().lower()
    logo_orient  = (brand.get('brand_logo_orientation') or 'horizontal').strip().lower()
    # Телефон только цифры — для tel: и Записаться
    phone_digits = re.sub(r'\D', '', brand_phone) or '79776068901'

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
        footer_parts = [p for p in [brand_name, brand_addr, brand_phone, brand_website] if p]
        c.drawCentredString(w/2, 5.5*mm, '  ·  '.join(footer_parts))

    table_top = [0]

    def check(yy, need):
        if yy - need < 16*mm:
            if table_top[0]:
                # закрываем рамку таблицы
                c.setStrokeColor(HexColor('#888888'))
                c.setLineWidth(0.35)
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
    c.setFillColor(custom_accent)
    c.roundRect(mg, h - mg - header_h, 3*mm, header_h, 1*mm, fill=1, stroke=0)

    # Левая часть: СМЕТА
    lx = mg + 7*mm
    c.setFont('PTSans-Bold', 36)
    c.setFillColor(BLACK)
    c.drawString(lx, h - mg - 16*mm, 'СМЕТА')

    c.setFont('PTSans-Bold', 10)
    c.setFillColor(custom_accent)
    c.drawString(lx, h - mg - 23*mm, 'на натяжные потолки')

    c.setFont('PTSans', 8)
    c.setFillColor(TEXT_MUTED)
    c.drawString(lx, h - mg - 29*mm, f'Предварительный расчёт  ·  от {today}')

    # Правая часть: логотип + контакты
    # Правый блок занимает 42% ширины карточки
    right_w   = (w - 2*mg) * 0.42
    right_x   = w - mg - right_w          # левый край правого блока
    right_pad = 4 * mm                    # внутренний отступ справа

    # Плашка логотипа — высота зависит от ориентации
    is_vertical = logo_orient == 'vertical'
    logo_pill_h = (22 if is_vertical else 13) * mm
    logo_pill_y = h - mg - logo_pill_h - 4*mm
    logo_pill_w = right_w
    logo_pill_x = right_x

    # Цвет подложки логотипа
    pill_fill = None
    pill_stroke = None
    if logo_bg_mode == 'transparent' or logo_bg_mode == 'none':
        pill_fill = None
    elif logo_bg_mode == 'white':
        pill_fill = WHITE
        pill_stroke = HexColor('#e9ecef')
    elif logo_bg_mode == 'dark':
        pill_fill = HexColor('#1e2029')
    elif logo_bg_mode.startswith('#'):
        try:
            pill_fill = HexColor(logo_bg_mode)
        except Exception:
            pill_fill = WHITE
    else:
        # auto — белая подложка с лёгкой рамкой
        pill_fill = WHITE
        pill_stroke = HexColor('#e9ecef')

    if pill_fill is not None:
        c.setFillColor(pill_fill)
        if pill_stroke is not None:
            c.setStrokeColor(pill_stroke)
            c.setLineWidth(0.5)
            c.roundRect(logo_pill_x, logo_pill_y, logo_pill_w, logo_pill_h, 2*mm, fill=1, stroke=1)
        else:
            c.roundRect(logo_pill_x, logo_pill_y, logo_pill_w, logo_pill_h, 2*mm, fill=1, stroke=0)

    if logo_bytes:
        try:
            img = ImageReader(io.BytesIO(logo_bytes))
            iw, ih_ = img.getSize()
            # Вписать логотип в плашку с отступом, не растягивая больше натурального размера
            pad = 2 * mm
            max_h = logo_pill_h - 2 * pad
            max_w = logo_pill_w - 2 * pad
            scale = min(max_w / iw, max_h / ih_, 1.0)  # не больше 1.0 — без растяжения
            lw_ = iw * scale
            lh  = ih_ * scale
            c.drawImage(img,
                logo_pill_x + (logo_pill_w - lw_) / 2,
                logo_pill_y + (logo_pill_h - lh) / 2,
                width=lw_, height=lh, mask='auto')
        except Exception:
            pass

    # Контакты под плашкой — название компании, телефон, сайт (адрес/реквизиты — в подвале страницы)
    contacts = [p for p in [brand_name, brand_phone, brand_website] if p]
    cy = logo_pill_y - 5.5*mm
    for ct in contacts:
        c.setFont('PTSans', 7.5)
        c.setFillColor(TEXT_MUTED)
        c.drawRightString(right_x + right_w - right_pad, cy, ct)
        cy -= 4.5*mm

    # ── ТАБЛИЦА ───────────────────────────────────────────────────────────────
    y = h - mg - header_h - 10*mm

    # Заголовок таблицы — только верхние углы скруглены (кривые Безье)
    th = 8.5*mm
    r = 2.5*mm
    k = 0.5523 * r
    x0, y0, w0, h0 = card_mg, y - th, tw, th
    c.setFillColor(HEADER_BG)
    p = c.beginPath()
    p.moveTo(x0, y0)                               # низ-лево
    p.lineTo(x0 + w0, y0)                          # низ-право
    p.lineTo(x0 + w0, y0 + h0 - r)                # право вверх
    p.curveTo(x0+w0, y0+h0-r+k, x0+w0-r+k, y0+h0, x0+w0-r, y0+h0)  # верх-правый угол
    p.lineTo(x0 + r, y0 + h0)                     # верх влево
    p.curveTo(x0+r-k, y0+h0, x0, y0+h0-r+k, x0, y0+h0-r)           # верх-левый угол
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    c.setFont('PTSans-Bold', 8)
    c.setFillColor(WHITE)
    for i, lbl in enumerate(['Позиция', 'Кол-во', 'Цена', 'Сумма']):
        if i == 0:
            c.drawString(cx(0) + 4*mm, y - th + 2.8*mm, lbl)
        else:
            c.drawCentredString(cx(i) + CW[i]/2, y - th + 2.8*mm, lbl)

    table_top[0] = y
    y -= th

    row_lines = []   # y-координаты горизонтальных линий строк
    sec_lines = []   # (y_top, y_bot) секций — для исключения вертикалей

    def draw_section(yy, label):
        sh = 8*mm
        yy = check(yy, sh + 5*mm)
        c.setFillColor(SEC_BG)
        c.rect(card_mg, yy - sh, tw, sh, fill=1, stroke=0)
        c.setFillColor(custom_accent)
        c.rect(card_mg, yy - sh, 3*mm, sh, fill=1, stroke=0)
        c.setFont('PTSans-Bold', 9)
        c.setFillColor(custom_text)
        c.drawString(card_mg + 6*mm, yy - sh + 2.4*mm, label)
        sec_lines.append((yy, yy - sh))
        row_lines.append(yy)
        row_lines.append(yy - sh)
        return yy - sh

    def draw_row(yy, name, qty, price, total):
        rh = 8*mm
        yy = check(yy, rh)
        c.setFillColor(WHITE)
        c.rect(card_mg, yy - rh, tw, rh, fill=1, stroke=0)

        ry = yy - rh + 2.5*mm

        c.setFont('PTSans', 8.5)
        c.setFillColor(custom_text)
        max_ch = int(CW[0] / (8.5 * 0.195 * mm))
        nm = name[:max_ch-1] + '…' if len(name) > max_ch else name
        c.drawString(cx(0) + 4*mm, ry, nm)

        c.setFont('PTSans', 8)
        c.setFillColor(custom_text)
        if qty:
            c.drawCentredString(cx(1) + CW[1]/2, ry, rub(qty))
        if price:
            c.drawCentredString(cx(2) + CW[2]/2, ry, rub(price))

        if total:
            c.setFont('PTSans-Bold', 8.5)
            c.setFillColor(custom_accent)
            c.drawRightString(cx(3) + CW[3] - 4*mm, ry, rub(total))

        row_lines.append(yy - rh)
        return yy - rh

    # ── Рендер данных ─────────────────────────────────────────────────────────
    num_counter = 0
    for block in blocks:
        items = block.get('items', [])
        title = clean(block.get('title', ''))
        # Пропускаем пустые блоки-заголовки без позиций
        if not items:
            continue
        if block.get('numbered', False):
            num_counter += 1
        label = f'{num_counter}. {title}' if block.get('numbered') else title
        y = draw_section(y, label)
        for item in items:
            name = re.sub(r'\s*[-–—]\s*$', '', clean(item.get('name', '')))
            value = clean(item.get('value', ''))
            qty_, price_, total_ = split_value(value)
            y = draw_row(y, name, qty_, price_, total_)

    # ── Все линии таблицы рисуем В КОНЦЕ поверх всего содержимого ────────────
    c.setStrokeColor(HexColor('#888888'))
    c.setLineWidth(0.35)

    # Горизонтальные линии (дедупликация, исключаем низ таблицы — он в рамке)
    for ly in sorted(set(row_lines), reverse=True):
        if abs(ly - y) > 0.1:   # пропускаем нижнюю границу таблицы
            c.line(card_mg, ly, card_mg + tw, ly)

    # Вертикальные разделители колонок — тоньше
    c.setLineWidth(0.25)
    for i in range(1, 4):
        x = cx(i)
        seg_top = table_top[0]
        for (st, sb) in sorted(sec_lines, reverse=True):
            if seg_top > st:
                c.line(x, st, x, seg_top)
            seg_top = sb
        if seg_top > y:
            c.line(x, y, x, seg_top)

    # Внешняя рамка
    table_h = table_top[0] - y
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
            STD_ROW_H  = 11 * mm
            NORM_ROW_H = 8  * mm
            HEAD_H     = 7  * mm
            PAD_V      = 4  * mm
            GAP        = 3  * mm
            PAD_H      = 5  * mm   # горизонтальный паддинг внутри блока

            total_rows_h = sum(STD_ROW_H if 'standard' in r[0].lower() else NORM_ROW_H for r in rows)
            box_h = HEAD_H + total_rows_h + PAD_V
            box_w = tw * 0.38

            y -= 7*mm
            y = check(y, box_h + 14*mm)

            box_x = card_mg + tw - box_w
            box_y = y - box_h

            # Тень
            c.setFillColor(HexColor('#00000010'))
            c.roundRect(box_x + 0.8*mm, box_y - 0.8*mm, box_w, box_h, 2.5*mm, fill=1, stroke=0)

            # Светло-серая карточка
            c.setFillColor(HexColor('#f1f3f5'))
            c.setStrokeColor(BORDER_OUTER)
            c.setLineWidth(0.6)
            c.roundRect(box_x, box_y, box_w, box_h, 2.5*mm, fill=1, stroke=1)

            # "Итоговая стоимость:" справа
            c.setFont('PTSans', 7)
            c.setFillColor(TEXT_MUTED)
            c.drawRightString(box_x + box_w - 5*mm, y - 5*mm, 'Итоговая стоимость:')

            # Разделитель
            c.setStrokeColor(BORDER_OUTER)
            c.setLineWidth(0.4)
            c.line(box_x + 5*mm, y - HEAD_H, box_x + box_w - 5*mm, y - HEAD_H)

            val_x = box_x + box_w - PAD_H
            ty = y - HEAD_H

            n_rows = len(rows)
            for row_idx, (lbl_, val_) in enumerate(rows):
                # Средняя строка из 3 — это Standard (базовая цена)
                is_std = (n_rows == 3 and row_idx == 1) or 'standard' in lbl_.lower()
                rh = STD_ROW_H if is_std else NORM_ROW_H
                font_size = 12 if is_std else 9
                mid_y = ty - rh / 2 - font_size * 0.176 * mm

                fnt_name = 'PTSans-Bold' if is_std else 'PTSans'

                # Ширина цифры — чтобы поставить метку вплотную слева
                val_w = c.stringWidth(val_, fnt_name, font_size)
                lbl_right = val_x - val_w - GAP  # правый край метки

                if is_std:
                    c.setFillColor(TOTAL_STD_BG)
                    c.rect(box_x + 1*mm, ty - rh + 0.3*mm, box_w - 2*mm, rh - 0.6*mm, fill=1, stroke=0)
                    c.setFont('PTSans-Bold', font_size)
                    c.setFillColor(custom_accent)
                    c.drawRightString(lbl_right, mid_y, lbl_ + ':')
                    c.setFillColor(custom_accent)
                    c.drawRightString(val_x, mid_y, val_)
                else:
                    c.setFont('PTSans', font_size)
                    c.setFillColor(TEXT_MUTED)
                    c.drawRightString(lbl_right, mid_y, lbl_ + ':')
                    c.setFillColor(custom_text)
                    c.drawRightString(val_x, mid_y, val_)

                ty -= rh

            y = box_y - 4*mm

            # ── Блок-CTA ──────────────────────────────────────────────────────
            y -= 3*mm
            cta_h = 10 * mm
            y = check(y, cta_h + 4*mm)

            cta_y = y - cta_h

            # Светло-серый фон
            c.setFillColor(HexColor('#f1f3f5'))
            c.setStrokeColor(HexColor('#ced4da'))
            c.setLineWidth(0.5)
            c.roundRect(card_mg, cta_y, tw, cta_h, 2*mm, fill=1, stroke=1)

            # Кнопка — рисуем первой чтобы текст был поверх
            btn_w = 28 * mm
            btn_h = 6.5 * mm
            btn_x = card_mg + tw - btn_w - 4*mm
            btn_y = cta_y + (cta_h - btn_h) / 2

            c.setFillColor(custom_accent)
            c.roundRect(btn_x, btn_y, btn_w, btn_h, 1.5*mm, fill=1, stroke=0)
            c.setFont('PTSans-Bold', 8)
            c.setFillColor(WHITE)
            c.drawCentredString(btn_x + btn_w / 2,
                btn_y + (btn_h - 8 * 0.352 * mm) / 2, 'Записаться')

            # Ссылка на звонок поверх кнопки
            c.linkURL(f'tel:+{phone_digits}',
                      (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
                      relative=0)

            # Текст слева
            fs = 8.0
            tx = card_mg + 4*mm
            text_y = cta_y + (cta_h - fs * 0.352 * mm) / 2

            part1 = 'Технолог готов приехать к вам '
            part2 = 'БЕСПЛАТНО'
            part3 = '  На какой день вас записать?'

            c.setFont('PTSans', fs)
            c.setFillColor(BLACK)
            c.drawString(tx, text_y, part1)
            tx += c.stringWidth(part1, 'PTSans', fs)

            c.setFont('PTSans-Bold', fs)
            c.setFillColor(ACCENT)
            c.drawString(tx, text_y, part2)
            tx += c.stringWidth(part2, 'PTSans-Bold', fs)

            c.setFont('PTSans', fs)
            c.setFillColor(BLACK)
            c.drawString(tx, text_y, part3)

            y = cta_y - 2*mm

    draw_footer()
    c.save()
    return buf.getvalue()


def fetch_brand_from_db(company_id):
    """Тянет бренд активной компании напрямую из PostgreSQL.
    Возвращает dict или None. Безопасно — при ошибке возвращает None."""
    if not company_id:
        return None
    try:
        import psycopg2
        schema = os.environ.get('DB_SCHEMA', 't_p45929761_bold_move_project')
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur  = conn.cursor()
        cur.execute(f"""
            SELECT role, has_own_agent, company_name, brand_logo_url, brand_color,
                   support_phone, website, telegram, max_url, working_hours,
                   pdf_footer_address, pdf_text_color, telegram_url,
                   brand_logo_url_dark, brand_logo_orientation, pdf_logo_bg
            FROM {schema}.users
            WHERE id=%s AND removed_at IS NULL
        """, (int(company_id),))
        r = cur.fetchone()
        cur.close(); conn.close()
        if not r:
            return None
        role, has_agent, company_name, brand_logo_url, brand_color, support_phone, \
            website, telegram, max_url, working_hours, pdf_footer_address, \
            pdf_text_color, telegram_url, \
            brand_logo_url_dark, brand_logo_orientation, pdf_logo_bg = r
        if not has_agent or role != 'company':
            return None
        return {
            'company_name':       company_name,
            'brand_logo_url':     brand_logo_url,
            'brand_logo_url_dark': brand_logo_url_dark,
            'brand_logo_orientation': brand_logo_orientation or 'horizontal',
            'pdf_logo_bg':        pdf_logo_bg or 'auto',
            'brand_color':        brand_color,
            'support_phone':      support_phone,
            'website':            website,
            'telegram':           telegram,
            'telegram_url':       telegram_url,
            'max_url':            max_url,
            'working_hours':      working_hours,
            'pdf_footer_address': pdf_footer_address,
            'pdf_text_color':     pdf_text_color,
        }
    except Exception:
        return None


def handler(event, context):
    """Генерирует PDF-смету и возвращает base64."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
            'Access-Control-Max-Age': '86400'}, 'body': ''}

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    data = json.loads(event.get('body', '{}'))

    s3 = get_s3()
    if not ensure_fonts(s3):
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font loading failed'})}

    # Если в data есть company_id — пробуем подтянуть бренд этой компании
    brand = data.get('brand') or fetch_brand_from_db(data.get('company_id'))

    # Логотип: выбираем версию по цвету подложки
    logo_bytes = None
    if brand:
        bg_mode = (brand.get('pdf_logo_bg') or 'auto').strip().lower()
        # Если подложка тёмная и есть светлая версия лого — используем её
        is_dark_bg = bg_mode == 'dark' or (bg_mode.startswith('#') and _is_dark_hex(bg_mode))
        if is_dark_bg and brand.get('brand_logo_url_dark'):
            logo_bytes = load_logo_from_url(brand['brand_logo_url_dark'])
        if not logo_bytes and brand.get('brand_logo_url'):
            logo_bytes = load_logo_from_url(brand['brand_logo_url'])
    if not logo_bytes:
        logo_bytes = load_logo(s3)

    pdf_bytes = build_pdf(data, logo_bytes=logo_bytes, brand=brand)

    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'pdf': base64.b64encode(pdf_bytes).decode('ascii')})}