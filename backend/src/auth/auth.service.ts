import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { TelegramService, TelegramBotService } from './telegram.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestPhoneCodeDto, ConfirmPhoneDto } from './dto/phone-verify.dto';
import { ChooseRoleDto } from './dto/choose-role.dto';

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 минут

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    private readonly telegramBot: TelegramBotService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithTelegram(initData: string): Promise<{ accessToken: string; user: object; isNew: boolean }> {
    if (!this.telegram.validateWebAppInitData(initData)) {
      throw new UnauthorizedException('Недействительная подпись Telegram WebApp');
    }
    const parsed = this.telegram.parseInitData(initData);
    if (!parsed?.user) throw new UnauthorizedException('Данные пользователя отсутствуют');

    const { id, isNew } = await this.users.findOrCreateByTelegram(parsed.user);
    let user = await this.users.findById(id);
    
    // Автоматически переводим PENDING_PHONE в PENDING_ROLE (телефон больше не требуется)
    if (user && user.status === 'PENDING_PHONE') {
      await this.prisma.user.update({
        where: { id },
        data: { status: 'PENDING_ROLE' },
      });
      user = await this.users.findById(id);
    }
    
    const accessToken = this.jwt.sign({
      sub: id,
      telegramId: String(parsed.user.id),
    });
    return {
      accessToken,
      user: this.sanitizeUser(user),
      isNew,
    };
  }

  async requestPhoneCode(userId: string, dto: RequestPhoneCodeDto): Promise<{ success: boolean }> {
    const code = crypto.randomInt(100000, 999999).toString();
    await this.prisma.phoneVerification.create({
      data: {
        userId,
        phone: dto.phone,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    // TODO: отправить SMS через провайдера (Twilio, SMS.ru и т.д.)
    if (this.config.get('NODE_ENV') !== 'production') {
      console.log(`[DEV] Код подтверждения для ${dto.phone}: ${code}`);
    }
    return { success: true };
  }

  /**
   * Запросить у пользователя отправку номера в боте (отправить клавиатуру с request_contact).
   */
  async requestTelegramPhone(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });
    if (!user?.telegramId) {
      throw new BadRequestException('Telegram не привязан');
    }
    await this.telegramBot.sendContactKeyboard(Number(user.telegramId));
    return {
      success: true,
      message: 'Перейдите в чат с ботом (@drivergo_bot), нажмите «Отправить номер телефона», затем вернитесь сюда и обновите профиль.',
    };
  }

  /**
   * Установить телефон пользователя из контакта Telegram (webhook бота).
   * Номер нормализуется к E.164; также обновляется contactPhone в профиле клиента при наличии.
   */
  async setPhoneFromTelegram(telegramId: number, rawPhone: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: { client: true, driver: true },
    });
    if (!user) return false;
    const phone = this.normalizePhoneE164(rawPhone);
    if (!phone) return false;
    await this.users.setPhone(user.id, phone);
    if (user.client) {
      await this.prisma.client.update({
        where: { id: user.client.id },
        data: { contactPhone: phone },
      });
    }
    return true;
  }

  private normalizePhoneE164(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
    if (digits.length === 10) return '+7' + digits;
    return raw.startsWith('+') ? raw : '+' + raw;
  }

  async confirmPhone(userId: string, dto: ConfirmPhoneDto): Promise<{ accessToken?: string }> {
    const verification = await this.prisma.phoneVerification.findFirst({
      where: { userId, phone: dto.phone, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification) throw new BadRequestException('Запрос на подтверждение не найден');
    if (verification.expiresAt < new Date()) throw new BadRequestException('Код истёк');
    if (verification.code !== dto.code) throw new BadRequestException('Неверный код');

    await this.prisma.$transaction([
      this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { verifiedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { phone: dto.phone, phoneVerifiedAt: new Date(), status: 'PENDING_ROLE' },
      }),
    ]);

    const user = await this.users.findById(userId);
    const accessToken = this.jwt.sign({ sub: userId, telegramId: String(user!.telegramId) });
    return { accessToken };
  }

  async chooseRole(userId: string, dto: ChooseRoleDto): Promise<{ accessToken: string }> {
    await this.users.setRole(userId, dto.role);
    const user = await this.users.findById(userId);
    
    // Автоматически создать профиль с данными из Telegram
    if (dto.role === 'CLIENT') {
      await this.prisma.client.upsert({
        where: { userId: userId },
        create: { 
          userId,
          contactName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
        },
        update: {},
      });
    } else {
      await this.prisma.driver.upsert({
        where: { userId: userId },
        create: { 
          userId,
          fullName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
        },
        update: {},
      });
    }
    
    const accessToken = this.jwt.sign({ sub: userId, telegramId: String(user!.telegramId) });
    return { accessToken };
  }

  private sanitizeUser(user: any): object {
    if (!user) return {};
    const { id, telegramId, username, firstName, lastName, role, status, phone, phoneVerifiedAt, client, driver } = user;
    return {
      id,
      telegramId: String(telegramId),
      username,
      firstName,
      lastName,
      role,
      status,
      phone: phone ? '***' + phone.slice(-4) : null,
      phoneVerified: !!phoneVerifiedAt,
      client: client ? { id: client.id } : null,
      driver: driver ? { id: driver.id } : null,
    };
  }
}
