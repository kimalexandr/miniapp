import { Controller, Get, Query } from '@nestjs/common';
import { YandexService } from './yandex.service';

@Controller('yandex')
export class YandexController {
  constructor(private readonly yandex: YandexService) {}

  /**
   * Прокси к Yandex Geosuggest. Ключ на сервере (YA_SUGGEST_KEY / YANDEX_MAPS_API_KEY).
   */
  @Get('suggest')
  async suggest(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('bbox') bbox?: string,
  ) {
    const limitNum = limit ? Math.min(Math.max(1, parseInt(limit, 10)), 10) : 7;
    return this.yandex.suggest(q ?? '', limitNum, bbox || undefined);
  }

  /**
   * Прокси к Yandex Geocoder. Возвращает полный адрес и координаты.
   */
  @Get('geocode')
  async geocode(@Query('address') address: string) {
    return this.yandex.geocode(address ?? '');
  }
}
