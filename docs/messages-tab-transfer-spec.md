# ТЗ: перенос вкладки «Сообщения» (единый инбокс) в другой проект

Источник — вкладка «Сообщения» в CRM (poehali.dev, роут `/crm`). Документ описывает
архитектуру, backend-контракты, структуру БД и UI/UX для переноса аналогичного
функционала в другой проект.

## 1. Общая идея

Единый инбокс: слева список диалогов со всеми клиентами по всем каналам (Avito,
Telegram, MAX, звонки), справа — переписка с выбранным клиентом и поле отправки.
Данные обновляются автоматически раз в 30 сек, без перезагрузки страницы (тихий
поллинг).

## 2. Структура файлов (референс для переноса логики)

| Файл | Роль |
|---|---|
| `CrmMessages.tsx` | Главный экран: список слева + переписка справа |
| `DrawerTouchesTab.tsx` | Лента сообщений/звонков конкретного клиента + поле ввода |
| `MessagesDialogRow.tsx` | Одна строка диалога в списке (аватар, превью, бейджи, меню) |
| `MessagesHiddenModal.tsx` | Модалка «скрытые диалоги» с восстановлением |
| `messagesChannels.ts` | Конфиг каналов: иконка/цвет/подпись для Telegram, MAX, Avito, звонков |
| `useInboxUnread.ts` | Счётчик непрочитанных для красного бейджа на вкладке |

## 3. База данных — 2 таблицы

### `touch_clients` — один клиент = одна переписка
```
id             serial primary key
company_id     integer not null
phone          varchar(32)
name           varchar(255)
crm_contact_id integer          -- ссылка на заявку в CRM (live_chats.id)
channel_ids    jsonb default '{}'  -- {"telegram": "123", "avito": "456"}
interest       varchar(16)      -- срез AI-анализа: high/medium/low
stage          varchar(64)
state_summary  text
next_action    text
analysis_updated_at timestamp
pinned         boolean default false
favorite       boolean default false
hidden         boolean default false
created_at     timestamp default now()
```

### `touch_events` — лента сообщений/звонков
```
id            serial primary key
client_id     integer not null references touch_clients(id)
channel       varchar(32) not null   -- telegram | max | avito | whatsapp | call
direction     varchar(8) not null    -- in | out
external_id   varchar(255)           -- id сообщения в канале, защита от дублей
text          text
audio_url     text                   -- для звонков
duration_sec  integer                -- для звонков
attachments   jsonb
status        varchar(32) default 'received'  -- received | pending | sent | error
created_at    timestamp default now()
```

Рекомендуется `UNIQUE(channel, external_id)` на `touch_events` — защита от повторной
вставки одного и того же вебхука.

## 4. Backend-эндпоинты

Один HTTP-хендлер, роутинг по query-параметру `?r=resource`. Формат ответа:
`{"success": true, ...data}` / `{"success": false, "error": "..."}`.

| Resource | Метод | Auth | Что делает |
|---|---|---|---|
| `touch-inbox` | GET | сессия | Список диалогов: последнее сообщение каждого клиента, сортировка «закреплённые → по времени» |
| `touches` | GET | сессия | Полная история переписки одного клиента (по `client_id` / `contact_id` / `phone`) |
| `send-message` | POST | сессия | Отправить сообщение. Avito — сразу через Avito API; Telegram/MAX — кладётся в очередь `pending`, забирает воркер |
| `pending-messages` | GET | webhook-key | Воркер опрашивает: «что отправить?» (для Telegram/MAX) |
| `mark-sent` | POST | webhook-key | Воркер подтверждает: сообщение доставлено / ошибка |
| `touch-flags` | PUT | сессия | Закрепить / в избранное / скрыть диалог (`client_id` в query, патч полей в body) |
| `touch-hidden` | GET | сессия | Список скрытых диалогов |
| `touch-badges` | GET | сессия | Срез интерес/стадия/непрочитано по всем клиентам разом (для бейджей в других разделах) |
| `channel-webhook` | POST | webhook-key | Приём входящих от Telegram/MAX/WhatsApp |
| `avito-webhook` | POST | webhook-key (query) | Приём входящих от Avito (URL регистрируется в самом Avito) |

### Пример ответа `touch-inbox`
```json
{
  "dialogs": [{
    "client_id": 123,
    "name": "Иван",
    "phone": "+7...",
    "contact_id": 456,
    "interest": "high",
    "stage": "Замер назначен",
    "last_channel": "telegram",
    "last_direction": "in",
    "last_text": "Да, спасибо!",
    "last_at": "2026-08-03T14:22:00Z",
    "unread": true,
    "in_count": 3,
    "pinned": true,
    "favorite": false,
    "source": "Авито",
    "avito_chat_url": "https://www.avito.ru/profile/messenger/..."
  }]
}
```

### Пример ответа `touches`
```json
{
  "client": {
    "id": 123, "phone": "+7...", "name": "Иван",
    "state_summary": "Ждёт предложение по цене",
    "next_action": "Перезвонить в пятницу",
    "interest": "high", "stage": "Замер выполнен"
  },
  "touches": [{
    "id": 789, "channel": "telegram", "direction": "in",
    "text": "...", "status": "received", "created_at": "..."
  }]
}
```

## 5. UI/UX — точное описание по зонам

**Верхняя шапка списка (слева):**
- Поле поиска «Поиск по диалогам…» — фильтр по имени/телефону/тексту последнего
  сообщения, чисто на клиенте, без запроса к серверу
- Кнопка ⭐ — переключатель «только избранные»
- Кнопка с иконкой скрытого глаза + бейдж числом — открывает модалку скрытых чатов

**Список диалогов (строка на клиента):**
- Иконка канала (для Avito — логотип-картинка, для остальных — цветная иконка канала)
- Имя (или «Без имени» / номер телефона), ⭐ если избранное
- Превью последнего сообщения (с префиксом «Вы:» если сообщение исходящее)
- Время (сегодня — часы:минуты, иначе дата)
- Красный кружок-бейдж с цифрой, если есть непрочитанное
- Контекстное меню: закрепить сверху / в избранное / скрыть

**Шапка переписки (справа):**
- Аватар + имя + название канала
- Кнопка **«Avito»** — открывает диалог в веб-версии Avito по прямой ссылке
  (`avito_chat_url`)
- Кнопка **«Заявка»** — открывает связанную карточку клиента в CRM в новой вкладке

**Тело переписки:**
- Входящие сообщения — слева, приглушённый фон; исходящие — справа, акцентный цвет
- Звонки — отдельным блоком: аудиоплеер + расшифровка (разворачивается по клику)
- Опциональный блок «инфо по клиенту» сверху: интерес, стадия, рекомендованный
  следующий шаг (из AI-анализа)

**Поле ввода снизу:**
- Выпадающий список каналов (Telegram/MAX/Avito) — отправка возможна только в канал,
  где клиент уже писал (есть `channel_ids` в БД)
- Поле текста + кнопка «Отправить»
- Оптимистичное добавление сообщения в ленту сразу; статус обновляется по факту
  (`pending` → `sent`/`error`)

## 6. Обновление в реальном времени

Простой `setInterval` каждые **30 сек**, тихий (без спиннера/мигания) — обновляет и
список диалогов, и открытую переписку. Непрочитанное определяется через
`localStorage` (отметка времени последнего просмотра диалога конкретным клиентом)
плюс направление последнего сообщения (`in`/`out`).

```js
useEffect(() => {
  const timer = setInterval(() => load(/* silent */ true), 30000);
  return () => clearInterval(timer);
}, [load]);
```

## 7. Важный архитектурный нюанс

Отправка в Telegram/MAX идёт не напрямую из backend, а через очередь и отдельный
воркер (на своём сервере/VPS): воркер опрашивает `pending-messages`, отправляет через
Bot API, подтверждает через `mark-sent`. Avito отправляется сразу синхронно через
Avito Messenger API (в момент вызова `send-message`).

При переносе в другой проект нужно решить:
- либо поднимать такой же внешний воркер-опросчик (если Bot API каналов не поддерживает
  прямые вебхуки/долгоживущие соединения из cloud-функции),
- либо интегрировать отправку прямыми синхронными вызовами API, если это позволяет
  таймаут функции и сам мессенджер (как сделано для Avito).

## 8. Каналы — конфиг для справки

| Канал | Иконка (lucide) | Цвет |
|---|---|---|
| telegram | Send | `#3b82f6` |
| max | MessageCircle | `#a855f7` |
| avito | MessagesSquare | `#f97316` |
| call (звонок) | Phone | `#22c55e` |
