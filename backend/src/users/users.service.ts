import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { TelegramUser } from '../auth/telegram.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTelegramId(telegramId: number): Promise<{ id: string; telegramId: bigint; phone: string | null; role: UserRole | null; status: UserStatus } | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { id: true, telegramId: true, phone: true, role: true, status: true },
    });
    if (!user) return null;
    return { ...user, telegramId: user.telegramId };
  }

  async findOrCreateByTelegram(tg: TelegramUser): Promise<{ id: string; isNew: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(tg.id) },
    });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: tg.username ?? existing.username,
          firstName: tg.first_name ?? existing.firstName,
          lastName: tg.last_name ?? existing.lastName,
          languageCode: tg.language_code ?? existing.languageCode,
        },
      });
      return { id: existing.id, isNew: false };
    }
    const created = await this.prisma.user.create({
      data: {
        telegramId: BigInt(tg.id),
        username: tg.username ?? null,
        firstName: tg.first_name,
        lastName: tg.last_name ?? null,
        languageCode: tg.language_code ?? null,
        status: UserStatus.PENDING_ROLE,
      },
    });
    return { id: created.id, isNew: true };
  }

  async setPhone(userId: string, phone: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: new Date(), status: UserStatus.PENDING_ROLE },
    });
  }

  /** Обновить телефон без сброса роли (для «Поделиться номером» внутри Mini App). */
  async updatePhoneInProfile(userId: string, phone: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: new Date() },
    });
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role, status: UserStatus.ACTIVE },
    });
  }

  async findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, driver: true },
    });
  }

  async requestRoleChange(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { roleChangeRequest: true },
    });
  }
}
