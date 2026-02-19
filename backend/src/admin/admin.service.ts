import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL', 'ya@ya.ru');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD', 'kAlkiujn7');
    if (email !== adminEmail || password !== adminPassword) {
      throw new ForbiddenException('Неверный логин или пароль');
    }
    const accessToken = this.jwt.sign({
      sub: 'admin',
      isAdmin: true,
    });
    return { accessToken };
  }

  async listUsers(): Promise<
    { id: string; telegramId: string; username: string | null; firstName: string | null; lastName: string | null; role: string | null; status: string; phone: string | null; createdAt: Date }[]
  > {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
      },
    });
    return users.map((u) => ({
      id: u.id,
      telegramId: String(u.telegramId),
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: u.status,
      phone: u.phone,
      createdAt: u.createdAt,
    }));
  }

  async deleteUser(userId: string): Promise<{ success: boolean }> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
    return { success: true };
  }
}
