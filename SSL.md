# HTTPS (Let's Encrypt) для Nginx в Docker

Сайт доступен по HTTP; для HTTPS нужен SSL-сертификат. Ниже — вариант через **Certbot** на VPS и текущий Nginx в Docker.

## 1. Установить Certbot на сервер

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot
```

**CentOS/RHEL:**
```bash
sudo yum install certbot
# или
sudo dnf install certbot
```

## 2. Получить сертификат

Домен: **lp.7rights.ru**

**Вариант A — временно освободить порт 80 (проще):**

Остановите контейнеры, чтобы порт 80 был свободен:
```bash
cd /path/to/miniapp   # ваш DEPLOY_PATH
docker compose down
```

Выпуск сертификата:
```bash
sudo certbot certonly --standalone -d lp.7rights.ru
```

Certbot спросит email и согласие с условиями. Сертификаты появятся в:
`/etc/letsencrypt/live/lp.7rights.ru/`  
(файлы `fullchain.pem` и `privkey.pem`).

**Вариант B — через webroot (без остановки контейнеров):**

Если не хотите останавливать сайт, настройте в Nginx отдачу `/.well-known/acme-challenge/` с диска и используйте:
```bash
sudo certbot certonly --webroot -w /path/to/webroot -d lp.7rights.ru
```
(для этого нужно один раз добавить в конфиг Nginx location для `/.well-known` и примонтировать каталог от certbot; при необходимости можно вынести в отдельную инструкцию.)

## 3. Запуск с HTTPS в Docker

В `.env` в корне проекта (рядом с `docker-compose.yml`) добавьте путь к сертификатам:

```env
CERT_PATH=/etc/letsencrypt/live/lp.7rights.ru
```

Запуск с HTTPS-конфигом:
```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Nginx будет слушать 80 (редирект на HTTPS) и 443 (HTTPS с вашим сертификатом).

Если деплой идёт через GitHub Actions, на сервере в каталоге проекта (DEPLOY_PATH) создайте/заполните `.env` с `CERT_PATH=...` и запускайте стек этой же командой (с двумя файлами compose). При следующем деплое через git pull перезапустите контейнеры той же командой.

## 4. Продление сертификата

Let's Encrypt выдаёт сертификаты на 90 дней. Продление:

```bash
sudo certbot renew
```

После продления перезагрузите Nginx в контейнере, чтобы подхватить новые файлы:
```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml exec frontend nginx -s reload
```

Можно настроить cron для автоматического продления, например:
```bash
0 3 * * * certbot renew --quiet && docker compose -f /path/to/miniapp/docker-compose.yml -f /path/to/miniapp/docker-compose.https.yml exec -T frontend nginx -s reload
# Подставьте вместо /path/to/miniapp ваш DEPLOY_PATH (каталог проекта на сервере).
```

## Полезные ссылки

- [Certbot](https://certbot.eff.org/)
- [Инструкции Certbot по типам ОС и веб-сервера](https://certbot.eff.org/instructions)
- [Видео-инструкция для Nginx](https://www.youtube.com/watch?v=...) (подставьте ссылку из письма хостинга при необходимости)
