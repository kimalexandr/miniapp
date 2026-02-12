import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Проверка подписи Telegram WebApp initData.
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
@Injectable()
export class TelegramService {
  private readonly botToken: string;
  constructor(private readonly config: ConfigService) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  validateWebAppInitData(initData: string): boolean {
    if (!initData || !this.botToken) return false;
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(this.botToken)
        .digest();
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      return calculatedHash === hash;
    } catch {
      return false;
    }
  }

  parseInitData(initData: string): { user?: TelegramUser } | null {
    if (!initData) return null;
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (!userStr) return {};
      const user = JSON.parse(userStr) as TelegramUser;
      return { user };
    } catch {
      return null;
    }
  }
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Отправить в чат сообщение с кнопкой «Поделиться номером телефона» (request_contact).
 * Вызывается при /start или любом сообщении от пользователя без телефона.
 */
@Injectable()
export class TelegramBotService {
  private readonly botToken: string;
  private readonly apiBase = 'https://api.telegram.org/bot';

  constructor(private readonly config: ConfigService) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async sendContactKeyboard(chatId: number): Promise<void> {
    if (!this.botToken) return;
    const url = `${this.apiBase}${this.botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Нажмите кнопку ниже, чтобы поделиться номером телефона для доступа в мини-приложение «Курьер».',
        reply_markup: {
          keyboard: [[{ text: '📱 Отправить номер телефона', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      }),
    });
  }
}
