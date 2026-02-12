import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getPublicConfig() {
    return {
      telegramBotUsername: this.config.get<string>('TELEGRAM_BOT_USERNAME', 'drivergo_bot'),
      yandexMapsApiKey: this.config.get<string>('YANDEX_MAPS_API_KEY', ''),
    };
  }
}
