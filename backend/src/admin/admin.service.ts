import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface DriverEarningsReportParams {
  driverId?: string;
  clientId?: string;
  from?: Date;
  to?: Date;
}

export interface DriverEarningsReport {
  totalAmount: number;
  byPaymentType: { cash: number; non_cash: number };
  byClients: { clientId: string; clientName: string; amount: number }[];
}

export interface ClientOrdersReportParams {
  clientId?: string;
  driverId?: string;
  from?: Date;
  to?: Date;
}

export interface ClientOrdersReport {
  totalAmount: number;
  byDrivers: { driverId: string; driverName: string; amount: number }[];
}

function toNum(d: Decimal | null | undefined): number {
  return d != null ? Number(d) : 0;
}

function paymentKind(pt: string | null): 'cash' | 'non_cash' {
  if (!pt) return 'non_cash';
  const lower = pt.toLowerCase();
  if (lower === 'cash' || lower.includes('налич')) return 'cash';
  return 'non_cash';
}

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
      agreedPrice: o.agreedPrice != null ? Number(o.agreedPrice) : null,
    }));
  }

  async getDriverEarningsReport(params: DriverEarningsReportParams): Promise<DriverEarningsReport> {
    const where: { status: OrderStatus; driverId?: string; clientId?: string; updatedAt?: { gte?: Date; lte?: Date } } = {
      status: OrderStatus.COMPLETED,
    };
    if (params.driverId) where.driverId = params.driverId;
    if (params.clientId) where.clientId = params.clientId;
    if (params.from != null || params.to != null) {
      where.updatedAt = {};
      if (params.from != null) where.updatedAt.gte = params.from;
      if (params.to != null) where.updatedAt.lte = params.to;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    let totalAmount = 0;
    const byPaymentType = { cash: 0, non_cash: 0 };
    const byClientsMap = new Map<string, { clientName: string; amount: number }>();

    for (const o of orders) {
      const amount = toNum(o.agreedPrice ?? o.price);
      if (amount <= 0) continue;
      totalAmount += amount;
      const kind = paymentKind(o.paymentTypeKind ?? o.paymentType);
      byPaymentType[kind] += amount;
      if (o.clientId) {
        const cur = byClientsMap.get(o.clientId);
        const clientName = o.client?.companyName || [o.client?.user?.firstName, o.client?.user?.lastName].filter(Boolean).join(' ') || '—';
        if (cur) cur.amount += amount;
        else byClientsMap.set(o.clientId, { clientName, amount });
      }
    }

    const byClients = Array.from(byClientsMap.entries()).map(([clientId, v]) => ({
      clientId,
      clientName: v.clientName,
      amount: v.amount,
    }));

    return { totalAmount, byPaymentType, byClients };
  }

  async getClientOrdersReport(params: ClientOrdersReportParams): Promise<ClientOrdersReport> {
    const where: { status: OrderStatus; clientId?: string; driverId?: string; updatedAt?: { gte?: Date; lte?: Date } } = {
      status: OrderStatus.COMPLETED,
    };
    if (params.clientId) where.clientId = params.clientId;
    if (params.driverId) where.driverId = params.driverId;
    if (params.from != null || params.to != null) {
      where.updatedAt = {};
      if (params.from != null) where.updatedAt.gte = params.from;
      if (params.to != null) where.updatedAt.lte = params.to;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        driver: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    let totalAmount = 0;
    const byDriversMap = new Map<string, { driverName: string; amount: number }>();

    for (const o of orders) {
      const amount = toNum(o.agreedPrice ?? o.price);
      if (amount <= 0) continue;
      totalAmount += amount;
      if (o.driverId) {
        const cur = byDriversMap.get(o.driverId);
        const driverName = o.driver?.user ? [o.driver.user.firstName, o.driver.user.lastName].filter(Boolean).join(' ') || '—' : '—';
        if (cur) cur.amount += amount;
        else byDriversMap.set(o.driverId, { driverName, amount });
      }
    }

    const byDrivers = Array.from(byDriversMap.entries()).map(([driverId, v]) => ({
      driverId,
      driverName: v.driverName,
      amount: v.amount,
    }));

    return { totalAmount, byDrivers };
  }

  async listDriversForFilters(): Promise<{ id: string; name: string }[]> {
    const drivers = await this.prisma.driver.findMany({
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return drivers.map((d) => ({
      id: d.id,
      name: [d.user?.firstName, d.user?.lastName].filter(Boolean).join(' ') || d.fullName || d.id,
    }));
  }

  async listClientsForFilters(): Promise<{ id: string; name: string }[]> {
    const clients = await this.prisma.client.findMany({
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return clients.map((c) => ({
      id: c.id,
      name: c.companyName || [c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || c.id,
    }));
  }
}
