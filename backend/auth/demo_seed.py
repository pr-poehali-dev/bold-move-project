import json as _json
import secrets
from datetime import datetime, timedelta


def seed_demo(cur, SCHEMA: str, user_id: int) -> None:
    """Создаёт демо-данные (канбан, заявки, чертежи, сметы) для нового демо-пользователя."""
    now = datetime.utcnow()

    # ── Канбан-колонки ────────────────────────────────────────────────────────
    demo_columns = [
        ("Заявки",    "#8b5cf6", 0),
        ("В работе",  "#a78bfa", 1),
        ("Замеры",    "#f59e0b", 2),
        ("Договор",   "#f97316", 3),
        ("Монтаж",    "#06b6d4", 4),
        ("Выполнено", "#10b981", 5),
    ]
    col_ids = []
    for col_title, col_color, col_pos in demo_columns:
        cur.execute(
            f"INSERT INTO {SCHEMA}.kanban_columns (title, color, position, company_id) VALUES (%s,%s,%s,%s) RETURNING id",
            (col_title, col_color, col_pos, user_id)
        )
        col_ids.append(cur.fetchone()[0])

    # ── Заявки ────────────────────────────────────────────────────────────────
    demo_clients = [
        # (client_name, phone, status, address, area, budget, contract_sum,
        #  prepayment, extra_payment, material_cost, measure_cost, install_cost, management_cost,
        #  notes, source, col_index, priority, tags, sub_status,
        #  prepayment_confirmed, extra_payment_confirmed, created_dt, measure_dt, install_dt)
        ("Алексей Морозов", "+7 (903) 112-34-56", "new",
         "Мытищи, ул. Колонцова, 8, кв. 14", 28.0, 45000, None,
         None, None, None, None, None, None,
         "Звонил сам. Хочет матовое полотно, 2 комнаты.", "chat", 0, "high",
         ["демо", "срочно"], None, False, False,
         now - timedelta(hours=3), None, None),
        ("Марина Степанова", "+7 (916) 234-56-78", "new",
         "Пушкино, Набережная, 22, кв. 5", 18.5, 28000, None,
         None, None, None, None, None, None,
         "Интересует сатиновое полотно, есть люстра.", "estimate", 0, "medium",
         ["демо"], None, False, False,
         now - timedelta(hours=7), None, None),
        ("Дмитрий Захаров", "+7 (925) 345-67-89", "call",
         "Королёв, ул. Октябрьская, 3, кв. 47", 35.0, 58000, None,
         None, None, None, None, None, None,
         "Договорились созвониться в 18:00. Две комнаты + коридор.", "chat", 1, "high",
         ["демо", "перезвонить"], "Ожидает ответа", False, False,
         now - timedelta(days=1), None, None),
        ("Ольга Никитина", "+7 (977) 456-78-90", "call",
         "Мытищи, Юбилейная, 14, кв. 33", 22.0, 36000, None,
         None, None, None, None, None, None,
         "Нужно уточнить цвет и тип. Фото комнаты на WA.", "manual", 1, "low",
         ["демо"], None, False, False,
         now - timedelta(days=2), None, None),
        ("Сергей Павлов", "+7 (903) 567-89-01", "measure",
         "Пушкино, ул. Тургенева, 5, кв. 12", 41.0, 70000, None,
         None, None, None, None, None, None,
         "Замер назначен. Хочет глянец на кухне, матовый в спальне.", "chat", 2, "high",
         ["демо", "замер"], None, False, False,
         now - timedelta(days=3), now + timedelta(days=1), None),
        ("Татьяна Лебедева", "+7 (926) 678-90-12", "measured",
         "Королёв, Циолковского, 18, кв. 9", 19.0, 31000, None,
         None, None, None, None, None, None,
         "Замер прошёл. Площадь уточнена, смета отправлена.", "estimate", 2, "medium",
         ["демо"], None, False, False,
         now - timedelta(days=4), None, None),
        ("Андрей Козлов", "+7 (916) 789-01-23", "contract",
         "Мытищи, Силикатная, 47, кв. 2", 52.0, 89000, 89000,
         35600, None, 32000, 2500, 28000, 8000,
         "Договор подписан. Предоплата 35 600 ожидается.", "chat", 3, "high",
         ["демо", "ожидает предоплату"], None, False, False,
         now - timedelta(days=6), None, None),
        ("Наталья Фролова", "+7 (977) 890-12-34", "prepaid",
         "Пушкино, ул. Чехова, 9, кв. 88", 33.0, 56000, 56000,
         22400, 33600, 19000, 1800, 18500, 5200,
         "Предоплата получена. Ждём дату монтажа.", "estimate", 3, "medium",
         ["демо", "предоплата получена"], "Ждёт дату монтажа", True, False,
         now - timedelta(days=8), None, None),
        ("Игорь Соколов", "+7 (925) 901-23-45", "install_scheduled",
         "Королёв, ул. Пионерская, 3, кв. 71", 45.0, 78000, 78000,
         31200, 46800, 27500, 2200, 24000, 7000,
         "Монтаж назначен на завтра, бригада готова.", "chat", 4, "high",
         ["демо", "монтаж завтра"], "Бригада подтверждена", True, False,
         now - timedelta(days=10), now - timedelta(days=8), now + timedelta(days=1)),
        ("Елена Воронова", "+7 (903) 012-34-56", "install_done",
         "Мытищи, ул. Речная, 25, кв. 4", 27.0, 46000, 46000,
         18400, 27600, 15500, 1500, 14000, 4500,
         "Монтаж выполнен. Клиент доволен. Ждём доплату.", "manual", 4, "medium",
         ["демо", "монтаж выполнен"], "Ожидает доплаты", True, False,
         now - timedelta(days=14), now - timedelta(days=12), now - timedelta(days=2)),
        ("Виктор Новиков", "+7 (916) 123-45-67", "done",
         "Пушкино, Московский пр., 12, кв. 56", 38.0, 64000, 64000,
         25600, 38400, 22000, 1900, 20000, 5800,
         "Работа завершена, акт подписан. Клиент оставил отзыв.", "chat", 5, "low",
         ["демо", "отзыв"], None, True, True,
         now - timedelta(days=20), now - timedelta(days=18), now - timedelta(days=7)),
        ("Людмила Орлова", "+7 (926) 234-56-78", "done",
         "Королёв, ул. Горького, 7, кв. 3", 24.0, 41000, 41000,
         16400, 24600, 13500, 1400, 13000, 4200,
         "Сдано. Фото до/после сделаны, клиент рекомендует.", "estimate", 5, "low",
         ["демо"], None, True, True,
         now - timedelta(days=25), now - timedelta(days=22), now - timedelta(days=10)),
    ]

    demo_client_ids = {}
    for (cname, phone, status, address, area, budget, contract_sum,
         prepayment, extra_payment, mat_cost, meas_cost, inst_cost, mgmt_cost,
         notes, source, col_idx, priority, tags, sub_status,
         prep_conf, extra_conf, created_dt, measure_dt, install_dt) in demo_clients:

        session_id = f"demo_{secrets.token_hex(8)}"
        cur.execute(f"""
            INSERT INTO {SCHEMA}.live_chats
            (session_id, client_name, phone, status, address, area, budget,
             contract_sum, prepayment, extra_payment,
             material_cost, measure_cost, install_cost, management_cost,
             notes, source, sub_status, tags,
             prepayment_confirmed, extra_payment_confirmed,
             company_id, created_at, measure_date, install_date, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,
                    %s,%s,%s,%s,%s)
            RETURNING id
        """, (
            session_id, cname, phone, status, address, area, budget,
            contract_sum, prepayment, extra_payment,
            mat_cost, meas_cost, inst_cost, mgmt_cost,
            notes, source, sub_status, tags,
            prep_conf, extra_conf,
            user_id, created_dt, measure_dt, install_dt, created_dt
        ))
        client_id = cur.fetchone()[0]
        demo_client_ids[cname] = client_id

        col_id = col_ids[col_idx]
        cur.execute(f"""
            INSERT INTO {SCHEMA}.kanban_cards
            (column_id, client_id, title, phone, amount, priority, position, company_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (col_id, client_id, cname, phone, contract_sum or budget, priority, 0, user_id))

    # ── Проект построителя ────────────────────────────────────────────────────
    plan_chat_id = demo_client_ids.get("Дмитрий Захаров")
    cur.execute(
        f"""INSERT INTO {SCHEMA}.plan_projects
            (company_id, name, client_name, address, phone, status, crm_chat_id, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,'active',%s,%s,%s) RETURNING id""",
        (user_id, "Квартира Захаровых, Королёв", "Дмитрий Захаров",
         "Королёв, ул. Октябрьская, 3, кв. 47", "+7 (925) 345-67-89",
         plan_chat_id, now - timedelta(days=3), now - timedelta(days=1))
    )
    plan_proj_id = cur.fetchone()[0]
    if plan_chat_id:
        cur.execute(f"UPDATE {SCHEMA}.live_chats SET project_id=%s WHERE id=%s",
                    (plan_proj_id, plan_chat_id))

    kitchen_data = {"arcs":[],"room":{"name":"Главная фигура","concreteDipMm":None,"floorToCeilCm":None,"mansardCeiling":False},"tool":"move","phase":"lengths","points":[{"x":620,"y":580,"id":"pt_dk1"},{"x":620,"y":260,"id":"pt_dk2"},{"x":940,"y":260,"id":"pt_dk3"},{"x":940,"y":500,"id":"pt_dk4"},{"x":860,"y":500,"id":"pt_dk5"},{"x":860,"y":540,"id":"pt_dk6"},{"x":940,"y":540,"id":"pt_dk7"},{"x":940,"y":580,"id":"pt_dk8"}],"isBuilt":True,"dimLines":[],"isClosed":True,"segments":[{"id":"s_dk1","toId":"pt_dk2","items":[{"name":"EuroKRAAB стеновой","unit":"пог.м","priceId":12,"category":"Теневой профиль","quantity":4,"isWallItem":True}],"fromId":"pt_dk1","lengthCm":400,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk2","toId":"pt_dk3","items":[{"name":"Ниша ПК-14 (2 ряда)","unit":"пог.м","priceId":59,"category":"Ниши для штор","quantity":4,"isWallItem":True}],"fromId":"pt_dk2","lengthCm":400,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk3","toId":"pt_dk4","items":[{"name":"Flexy FLY 02 с рассеивателем","unit":"пог.м","priceId":17,"category":"Парящий профиль","quantity":3,"isWallItem":True}],"fromId":"pt_dk3","lengthCm":300,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk4","toId":"pt_dk5","items":[{"name":"Flexy FLY 02 с рассеивателем","unit":"пог.м","priceId":17,"category":"Парящий профиль","quantity":1,"isWallItem":True}],"fromId":"pt_dk4","lengthCm":100,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk5","toId":"pt_dk6","items":[{"name":"Flexy FLY 02 с рассеивателем","unit":"пог.м","priceId":17,"category":"Парящий профиль","quantity":0.5,"isWallItem":True}],"fromId":"pt_dk5","lengthCm":50,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk6","toId":"pt_dk7","items":[{"name":"Flexy FLY 02 с рассеивателем","unit":"пог.м","priceId":17,"category":"Парящий профиль","quantity":1,"isWallItem":True}],"fromId":"pt_dk6","lengthCm":100,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk7","toId":"pt_dk8","items":[{"name":"Flexy FLY 02 с рассеивателем","unit":"пог.м","priceId":17,"category":"Парящий профиль","quantity":0.5,"isWallItem":True}],"fromId":"pt_dk7","lengthCm":50,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dk8","toId":"pt_dk1","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":4,"isWallItem":True}],"fromId":"pt_dk8","lengthCm":400,"arcRadius":0,"showLength":True,"showDimLine":True}],"settings":{"panX":-621.0,"panY":-415.0,"zoom":3.9,"ortho":True,"gridSize":20,"showGrid":True,"showPoints":True,"showDimLines":False,"snapToPoints":True,"showDiagonals":True,"showAngleLabels":False,"showPointLabels":True,"showSegmentLabels":False},"baseScale":0.8,"diagonals":[{"id":"d_dk1","toId":"pt_dk3","fromId":"pt_dk1","visible":True,"lengthCm":565.7,"showLength":True},{"id":"d_dk2","toId":"pt_dk7","fromId":"pt_dk1","visible":True,"lengthCm":403.1,"showLength":True}],"ceilItems":[{"id":"ci_dk1","x":750,"y":400,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1},{"id":"ci_dk2","x":820,"y":420,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1},{"id":"ci_dk3","x":680,"y":380,"name":"Светильник GX-53","priceId":45,"category":"Освещение","quantity":1}]}

    living_data = {"arcs":[],"room":{"name":"Главная фигура","concreteDipMm":None,"floorToCeilCm":None,"mansardCeiling":False},"tool":"move","phase":"lengths","points":[{"x":200,"y":600,"id":"pt_dl1"},{"x":700,"y":600,"id":"pt_dl2"},{"x":700,"y":200,"id":"pt_dl3"},{"x":200,"y":200,"id":"pt_dl4"}],"isBuilt":True,"dimLines":[],"isClosed":True,"segments":[{"id":"s_dl1","toId":"pt_dl2","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":5,"isWallItem":True},{"name":"Теневой классик (Flexy KLASSIKA 140)","unit":"пог.м","priceId":60,"category":"Теневой профиль","quantity":5,"isWallItem":True}],"fromId":"pt_dl1","lengthCm":500,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dl2","toId":"pt_dl3","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":4,"isWallItem":True},{"name":"Ниша ПК-14 (2 ряда)","unit":"пог.м","priceId":59,"category":"Ниши для штор","quantity":4,"isWallItem":True}],"fromId":"pt_dl2","lengthCm":400,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dl3","toId":"pt_dl4","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":5,"isWallItem":True},{"name":"Flexy FLY 02 с рассеивателем","unit":"пог.м","priceId":17,"category":"Парящий профиль","quantity":5,"isWallItem":True}],"fromId":"pt_dl3","lengthCm":500,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_dl4","toId":"pt_dl1","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":4,"isWallItem":True}],"fromId":"pt_dl4","lengthCm":400,"arcRadius":0,"showLength":True,"showDimLine":True}],"settings":{"panX":-150.0,"panY":-150.0,"zoom":2.5,"ortho":True,"gridSize":20,"showGrid":True,"showPoints":True,"showDimLines":False,"snapToPoints":True,"showDiagonals":True,"showAngleLabels":False,"showPointLabels":True,"showSegmentLabels":False},"baseScale":0.8,"diagonals":[{"id":"d_dl1","toId":"pt_dl3","fromId":"pt_dl1","visible":True,"lengthCm":640.3,"showLength":True}],"ceilItems":[{"id":"ci_dl1","x":350,"y":350,"name":"Под люстру ∅200","priceId":33,"category":"Закладные","quantity":1},{"id":"ci_dl2","x":280,"y":300,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1},{"id":"ci_dl3","x":420,"y":300,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1},{"id":"ci_dl4","x":280,"y":420,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1},{"id":"ci_dl5","x":420,"y":420,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1}]}

    bedroom_data = {"arcs":[],"room":{"name":"Главная фигура","concreteDipMm":None,"floorToCeilCm":None,"mansardCeiling":False},"tool":"move","phase":"lengths","points":[{"x":300,"y":550,"id":"pt_db1"},{"x":650,"y":550,"id":"pt_db2"},{"x":650,"y":250,"id":"pt_db3"},{"x":300,"y":250,"id":"pt_db4"}],"isBuilt":True,"dimLines":[],"isClosed":True,"segments":[{"id":"s_db1","toId":"pt_db2","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":3.5,"isWallItem":True}],"fromId":"pt_db1","lengthCm":350,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_db2","toId":"pt_db3","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":3,"isWallItem":True},{"name":"Теневой классик (Flexy KLASSIKA 140)","unit":"пог.м","priceId":60,"category":"Теневой профиль","quantity":3,"isWallItem":True}],"fromId":"pt_db2","lengthCm":300,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_db3","toId":"pt_db4","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":3.5,"isWallItem":True}],"fromId":"pt_db3","lengthCm":350,"arcRadius":0,"showLength":True,"showDimLine":True},{"id":"s_db4","toId":"pt_db1","items":[{"name":"Стеновой алюминиевый","unit":"пог.м","priceId":10,"category":"Профиль стандартный","quantity":3,"isWallItem":True}],"fromId":"pt_db4","lengthCm":300,"arcRadius":0,"showLength":True,"showDimLine":True}],"settings":{"panX":-250.0,"panY":-200.0,"zoom":2.8,"ortho":True,"gridSize":20,"showGrid":True,"showPoints":True,"showDimLines":False,"snapToPoints":True,"showDiagonals":True,"showAngleLabels":False,"showPointLabels":True,"showSegmentLabels":False},"baseScale":0.8,"diagonals":[{"id":"d_db1","toId":"pt_db3","fromId":"pt_db1","visible":True,"lengthCm":459.6,"showLength":True}],"ceilItems":[{"id":"ci_db1","x":450,"y":390,"name":"Под люстру ∅200","priceId":33,"category":"Закладные","quantity":1},{"id":"ci_db2","x":380,"y":340,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1},{"id":"ci_db3","x":520,"y":340,"name":"Под светильник ∅90","priceId":31,"category":"Закладные","quantity":1}]}

    for room_name, room_data in [("Кухня", kitchen_data), ("Гостиная", living_data), ("Спальня", bedroom_data)]:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.room_plans
                (user_id, name, data, project_id, include_in_estimate, include_drawing, created_at, updated_at)
                VALUES (%s,%s,%s,%s,TRUE,TRUE,%s,%s)""",
            (user_id, room_name, _json.dumps(room_data, ensure_ascii=False),
             plan_proj_id, now - timedelta(days=3), now - timedelta(days=1))
        )

    # ── Сметы привязанные к заявкам ───────────────────────────────────────────
    demo_estimates = [
        {
            "title": "Смета — Гостиная + Кухня, 2 комнаты",
            "chat_name": "Дмитрий Захаров",
            "blocks": [{"title":"Полотно","numbered":True,"items":[{"name":"MSD Classic матовый","value":"20 м² × 399 ₽ = 7 980 ₽"},{"name":"Раскрой ПВХ","value":"20 м² × 100 ₽ = 2 000 ₽"},{"name":"Огарпунивание ПВХ","value":"20 м² × 100 ₽ = 2 000 ₽"}]},{"title":"Профиль","numbered":True,"items":[{"name":"Стеновой алюминиевый","value":"21 пог.м × 200 ₽ = 4 200 ₽"},{"name":"Парящий Flexy FLY 02","value":"5 пог.м × 1 650 ₽ = 8 250 ₽"}]},{"title":"Закладные","numbered":True,"items":[{"name":"Под светильник ∅90","value":"10 шт × 350 ₽ = 3 500 ₽"},{"name":"Под светильник ∅100-300","value":"2 шт × 450 ₽ = 900 ₽"}]},{"title":"Освещение","numbered":True,"items":[{"name":"Лента QF Premium 5м","value":"1 катушка × 4 000 ₽ = 4 000 ₽"},{"name":"Блок питания 100 Вт","value":"1 шт × 3 500 ₽ = 3 500 ₽"}]},{"title":"Ниши","numbered":True,"items":[{"name":"Ниша ПК-14 (2 ряда)","value":"3 пог.м × 3 600 ₽ = 10 800 ₽"}]},{"title":"Услуги монтажа","numbered":True,"items":[{"name":"Монтаж полотна ПВХ","value":"20 м² × 350 ₽ = 7 000 ₽"},{"name":"Монтаж профиля стандарт","value":"26 пог.м × 200 ₽ = 5 200 ₽"},{"name":"Монтаж парящего профиля","value":"5 пог.м × 350 ₽ = 1 750 ₽"},{"name":"Монтаж закладной","value":"12 шт × 350 ₽ = 4 200 ₽"},{"name":"Монтаж ниши","value":"3 пог.м × 700 ₽ = 2 100 ₽"},{"name":"Монтаж ленты","value":"5 пог.м × 350 ₽ = 1 750 ₽"},{"name":"Монтаж блока питания","value":"1 шт × 500 ₽ = 500 ₽"}]}],
            "totals": ["Econom:   63 436 ₽","Standard: 74 630 ₽","Premium:  94 780 ₽"],
            "final_phrase": "На какой день вас записать на бесплатный замер?",
            "total_econom": 63436, "total_standard": 74630, "total_premium": 94780,
            "status": "sent", "created_at": now - timedelta(days=5),
        },
        {
            "title": "Смета — 3 комнаты + коридор",
            "chat_name": "Андрей Козлов",
            "blocks": [{"title":"Полотно","numbered":True,"items":[{"name":"MSD Classic матовый","value":"20 м² × 399 ₽ = 7 980 ₽"},{"name":"Раскрой ПВХ","value":"20 м² × 100 ₽ = 2 000 ₽"},{"name":"Огарпунивание ПВХ","value":"20 м² × 100 ₽ = 2 000 ₽"}]},{"title":"Профиль","numbered":True,"items":[{"name":"Стеновой алюминиевый","value":"17 пог.м × 200 ₽ = 3 400 ₽"},{"name":"Парящий Flexy FLY 02 с рассеивателем","value":"5 пог.м × 1 650 ₽ = 8 250 ₽"}]},{"title":"Закладные","numbered":True,"items":[{"name":"Под светильник ∅90","value":"12 шт × 350 ₽ = 4 200 ₽"},{"name":"Под люстру планка","value":"3 шт × 700 ₽ = 2 100 ₽"}]},{"title":"Освещение","numbered":True,"items":[{"name":"Лента QF Premium 5м","value":"1 катушка × 4 000 ₽ = 4 000 ₽"},{"name":"Блок питания 100 Вт","value":"1 шт × 3 500 ₽ = 3 500 ₽"},{"name":"Светильник GX-53","value":"12 шт × 400 ₽ = 4 800 ₽"},{"name":"Лампа GX-53","value":"12 шт × 150 ₽ = 1 800 ₽"}]},{"title":"Ниши","numbered":True,"items":[{"name":"Ниша ПК-12 (3 ряда)","value":"3 пог.м × 3 600 ₽ = 10 800 ₽"}]},{"title":"Услуги монтажа","numbered":True,"items":[{"name":"Монтаж полотна ПВХ","value":"20 м² × 350 ₽ = 7 000 ₽"},{"name":"Монтаж профиля стандарт","value":"22 пог.м × 200 ₽ = 4 400 ₽"},{"name":"Монтаж ниши","value":"3 пог.м × 700 ₽ = 2 100 ₽"},{"name":"Монтаж парящего профиля","value":"5 пог.м × 350 ₽ = 1 750 ₽"},{"name":"Монтаж закладной","value":"15 шт × 350 ₽ = 5 250 ₽"},{"name":"Монтаж ленты","value":"5 пог.м × 350 ₽ = 1 750 ₽"},{"name":"Монтаж блока питания","value":"1 шт × 500 ₽ = 500 ₽"}]}],
            "totals": ["Econom:   71 043 ₽","Standard: 83 580 ₽","Premium:  106 147 ₽"],
            "final_phrase": "На какой день вас записать на бесплатный замер?",
            "total_econom": 71043, "total_standard": 83580, "total_premium": 106147,
            "status": "viewed", "created_at": now - timedelta(days=12),
        },
        {
            "title": "Смета — Спальня 12 м², матовый потолок",
            "chat_name": "Алексей Морозов",
            "blocks": [{"title":"Полотно","numbered":True,"items":[{"name":"MSD Classic матовый","value":"12 м² × 399 ₽ = 4 788 ₽"},{"name":"Раскрой ПВХ","value":"12 м² × 100 ₽ = 1 200 ₽"},{"name":"Огарпунивание ПВХ","value":"12 м² × 100 ₽ = 1 200 ₽"}]},{"title":"Профиль","numbered":True,"items":[{"name":"Стеновой алюминиевый","value":"14 пог.м × 200 ₽ = 2 800 ₽"}]},{"title":"Закладные","numbered":True,"items":[{"name":"Под светильник ∅90","value":"6 шт × 350 ₽ = 2 100 ₽"},{"name":"Под люстру ∅200","value":"1 шт × 700 ₽ = 700 ₽"}]},{"title":"Услуги монтажа","numbered":True,"items":[{"name":"Монтаж полотна ПВХ","value":"12 м² × 350 ₽ = 4 200 ₽"},{"name":"Монтаж профиля стандарт","value":"14 пог.м × 200 ₽ = 2 800 ₽"},{"name":"Монтаж закладной","value":"7 шт × 350 ₽ = 2 450 ₽"}]}],
            "totals": ["Econom:   18 488 ₽","Standard: 22 238 ₽","Premium:  28 238 ₽"],
            "final_phrase": "Запишем вас на замер?",
            "total_econom": 18488, "total_standard": 22238, "total_premium": 28238,
            "status": "new", "created_at": now - timedelta(days=1),
        },
    ]

    for est in demo_estimates:
        chat_id_val = demo_client_ids.get(est.get("chat_name"))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.saved_estimates
                (user_id, company_id, chat_id, title, blocks, totals, final_phrase,
                 total_econom, total_standard, total_premium, status, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (user_id, user_id, chat_id_val, est["title"],
             _json.dumps(est["blocks"], ensure_ascii=False),
             _json.dumps(est["totals"], ensure_ascii=False),
             est["final_phrase"],
             est["total_econom"], est["total_standard"], est["total_premium"],
             est["status"], est["created_at"], est["created_at"])
        )
