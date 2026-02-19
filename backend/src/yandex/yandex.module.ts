import { Module } from '@nestjs/common';
import { YandexController } from './yandex.controller';
import { YandexService } from './yandex.service';

@Module({
  controllers: [YandexController],
  providers: [YandexService],
  exports: [YandexService],
})
export class YandexModule {}
