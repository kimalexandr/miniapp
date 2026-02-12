import { IsString, IsOptional, IsObject } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  initData: string;
}

export class TelegramUserDto {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
