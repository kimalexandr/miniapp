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

  async listOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          include: {
            user: { select: { firstName: true, lastName: true, username: true, phone: true } },
          },
        },
        driver: {
          include: {
            user: { select: { firstName: true, lastName: true, username: true, phone: true } },
          },
        },
        fromWarehouse: { select: { name: true, address: true } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      toAddress: o.toAddress,
      toLatitude: o.toLatitude,
      toLongitude: o.toLongitude,
      preferredDate: o.preferredDate,
      preferredTimeFrom: o.preferredTimeFrom,
      preferredTimeTo: o.preferredTimeTo,
      cargoType: o.cargoType,
      cargoVolume: o.cargoVolume,
      cargoWeight: o.cargoWeight,
      cargoPlaces: o.cargoPlaces,
      pickupRequired: o.pickupRequired,
      specialConditions: o.specialConditions,
      contactName: o.contactName,
      contactPhone: o.contactPhone,
      price: o.price != null ? Number(o.price) : null,
      paymentType: o.paymentType,
      responseDeadline: o.responseDeadline,
      client: o.client
        ? {
            id: o.client.id,
            companyName: o.client.companyName,
            user: o.client.user
              ? {
                  firstName: o.client.user.firstName,
                  lastName: o.client.user.lastName,
                  username: o.client.user.username,
                  phone: o.client.user.phone,
                }
              : null,
          }
        : null,
      driver: o.driver
        ? {
            id: o.driver.id,
            user: o.driver.user
              ? {
                  firstName: o.driver.user.firstName,
                  lastName: o.driver.user.lastName,
                  username: o.driver.user.username,
                  phone: o.driver.user.phone,
                }
              : null,
          }
        : null,
      fromWarehouse: o.fromWarehouse,
      statusHistory: o.statusHistory,
    }));
  }
}
