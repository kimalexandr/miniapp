# Backend — мини-апп «Курьер — доставка на маркетплейс»

Бэкенд на NestJS + Prisma + PostgreSQL по ТЗ для Telegram Mini App.

## Требования

- Node.js 18+
- PostgreSQL 14+

## Установка и запуск

```bash
cd backend
npm install
cp .env.example .env
# Заполнить .env: DATABASE_URL, TELEGRAM_BOT_TOKEN, JWT_SECRET
npx prisma migrate dev
npm run start:dev
```

API доступен по адресу: `http://localhost:3000/api`

## Переменные окружения (.env)

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | URL подключения к PostgreSQL |
| `TELEGRAM_BOT_TOKEN` | Токен бота для проверки подписи Telegram WebApp |
| `JWT_SECRET` | Секрет для JWT (не менее 32 символов в production) |
| `JWT_EXPIRES_IN` | Время жизни токена (например `7d`) |
| `PORT` | Порт сервера (по умолчанию 3000) |

## API (REST)

Базовый путь: `/api`. Заголовок авторизации: `Authorization: Bearer <JWT>` (кроме входа по Telegram).

### Авторизация (`/api/auth`)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/telegram` | Вход по Telegram WebApp (тело: `{ "initData": "..." }`) |
| POST | `/auth/phone/request-code` | Запрос кода подтверждения телефона (тело: `{ "phone": "+79001234567" }`) |
| POST | `/auth/phone/confirm` | Подтверждение телефона кодом |
| POST | `/auth/choose-role` | Выбор роли: `{ "role": "CLIENT" }` или `"DRIVER"` |

### Пользователь (`/api/users`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/users/me` | Текущий пользователь и профиль (client/driver) |

### Клиент (`/api/clients`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/clients/profile` | Профиль клиента (реквизиты, контакты) |
| PUT | `/clients/profile` | Обновление профиля клиента |

### Водитель (`/api/drivers`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/drivers/profile` | Профиль водителя |
| PUT | `/drivers/profile` | Обновление профиля водителя |
| PUT | `/drivers/location` | Обновление геолокации (тело: `{ "latitude", "longitude" }`) |

### Заявки (`/api/orders`)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/orders` | Создать заявку (клиент) |
| GET | `/orders` | Список заявок (query: `role`, опционально `status`) |
| GET | `/orders/available` | Доступные заявки для водителя |
| GET | `/orders/my` | Мои заявки водителя |
| GET | `/orders/:id` | Детали заявки |
| POST | `/orders/:id/take` | Взять заявку в работу (водитель) |
| POST | `/orders/:id/status` | Сменить статус (водитель), тело: `{ "status", "comment?" }` |

Статусы заявки: `NEW`, `DRAFT`, `PUBLISHED`, `TAKEN`, `AT_WAREHOUSE`, `LOADING_DONE`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`.

### Склады (`/api/warehouses`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/warehouses` | Список складов клиента |
| GET | `/warehouses/:id` | Один склад |
| POST | `/warehouses` | Создать склад |
| PUT | `/warehouses/:id` | Обновить склад |
| DELETE | `/warehouses/:id` | Удалить склад |

### Карта (`/api/map`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/map` | Данные для карты: заявки и водители с координатами (по роли пользователя) |

## Безопасность

- Проверка подписи Telegram WebApp при каждом запросе на `/auth/telegram`.
- JWT привязан к `user_id` и `telegram_id`.
- Rate limiting (Throttler): общий лимит запросов; отдельное ограничение на запрос кода телефона (3 запроса в минуту).
- Логирование действий в `audit_logs`: создание заявки, взятие заявки, смена статуса.

## Миграции БД

```bash
npx prisma migrate dev --name init
npx prisma studio  # просмотр БД
```
