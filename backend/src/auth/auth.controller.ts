import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { RequestPhoneCodeDto, ConfirmPhoneDto } from './dto/phone-verify.dto';
import { ChooseRoleDto } from './dto/choose-role.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram')
  async loginTelegram(@Body() dto: TelegramAuthDto) {
    return this.auth.loginWithTelegram(dto.initData);
  }

  @Post('phone/request-code')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 запроса в минуту на смену телефона
  async requestPhoneCode(@CurrentUser() payload: JwtPayload, @Body() dto: RequestPhoneCodeDto) {
    return this.auth.requestPhoneCode(payload.userId, dto);
  }

  @Post('phone/confirm')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmPhone(@CurrentUser() payload: JwtPayload, @Body() dto: ConfirmPhoneDto) {
    return this.auth.confirmPhone(payload.userId, dto);
  }

  @Post('choose-role')
  @UseGuards(JwtAuthGuard)
  async chooseRole(@CurrentUser() payload: JwtPayload, @Body() dto: ChooseRoleDto) {
    return this.auth.chooseRole(payload.userId, dto);
  }
}
