import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EarningStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface DriverEarningsResult {
  totalAmount: number;
  currency: string;
  orders: { id: string; agreedPrice: number; completedAt: Date }[];
}

export interface DriverBalanceResult {
  totalConfirmed: number;
  totalPaid: number;
  balanceToPay: number;
  currency: string;
}

@Injectable()
export class EarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDriverEarnings(
    driverId: string,
    from?: Date,
    to?: Date,
  ): Promise<DriverEarningsResult> {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Водитель не найден');

    const where: { driverId: string; status: EarningStatus; createdAt?: { gte?: Date; lte?: Date } } = {
      driverId,
      status: EarningStatus.CONFIRMED,
    };
    if (from != null || to != null) {
      where.createdAt = {};
      if (from != null) where.createdAt.gte = from;
      if (to != null) where.createdAt.lte = to;
    }

    const earnings = await this.prisma.driverEarning.findMany({
      where,
      include: { order: { select: { id: true, updatedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let totalAmount = 0;
    const orders: { id: string; agreedPrice: number; completedAt: Date }[] = [];
    for (const e of earnings) {
      const amount = e.amount instanceof Decimal ? Number(e.amount) : Number(e.amount);
      totalAmount += amount;
      orders.push({
        id: e.orderId,
        agreedPrice: amount,
        completedAt: e.order?.updatedAt ?? e.createdAt,
      });
    }

    return {
      totalAmount,
      currency: earnings[0]?.currency ?? 'RUB',
      orders,
    };
  }

  async getDriverBalance(driverId: string): Promise<DriverBalanceResult> {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Водитель не найден');

    const [confirmed, paid] = await Promise.all([
      this.prisma.driverEarning.aggregate({
        where: { driverId, status: EarningStatus.CONFIRMED },
        _sum: { amount: true },
      }),
      this.prisma.driverEarning.aggregate({
        where: { driverId, status: EarningStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    const totalConfirmed = confirmed._sum?.amount != null ? Number(confirmed._sum.amount) : 0;
    const totalPaid = paid._sum?.amount != null ? Number(paid._sum.amount) : 0;
    const balanceToPay = Math.max(0, totalConfirmed - totalPaid);

    return {
      totalConfirmed,
      totalPaid,
      balanceToPay,
      currency: 'RUB',
    };
  }

  async markEarningAsPaid(earningId: string): Promise<{ id: string; status: string }> {
    const earning = await this.prisma.driverEarning.findUnique({ where: { id: earningId } });
    if (!earning) throw new NotFoundException('Начисление не найдено');

    const updated = await this.prisma.driverEarning.update({
      where: { id: earningId },
      data: { status: EarningStatus.PAID },
    });
    return { id: updated.id, status: updated.status };
  }
}
