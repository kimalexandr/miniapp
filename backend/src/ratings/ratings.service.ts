import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRating(userId: string, dto: CreateRatingDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, driver: true },
    });
    if (!user || !user.role) throw new BadRequestException('Пользователь не найден');

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { client: true, driver: true },
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.status !== 'COMPLETED') throw new BadRequestException('Заявка еще не завершена');

    // Проверяем, что пользователь участвовал в заказе
    const isClient = user.role === 'CLIENT' && order.clientId === user.client?.id;
    const isDriver = user.role === 'DRIVER' && order.driverId === user.driver?.id;
    if (!isClient && !isDriver) throw new BadRequestException('Вы не участвовали в этой заявке');

    // Проверяем, что рейтинг еще не оставлен
    const existing = await this.prisma.rating.findUnique({
      where: {
        orderId_raterRole: { orderId: dto.orderId, raterRole: user.role },
      },
    });
    if (existing) throw new BadRequestException('Вы уже оценили эту заявку');

    // Создаем рейтинг
    const rating = await this.prisma.rating.create({
      data: {
        orderId: dto.orderId,
        raterRole: user.role,
        targetClientId: user.role === 'DRIVER' ? order.clientId : undefined,
        targetDriverId: user.role === 'CLIENT' ? order.driverId : undefined,
        score: dto.score,
        comment: dto.comment,
      },
    });

    return { success: true, rating };
  }

  async getClientRatings(clientId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { targetClientId: clientId },
      include: {
        order: {
          select: {
            orderNumber: true,
            toAddress: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const stats = await this.calculateStats(clientId, 'CLIENT');
    return { ratings, stats };
  }

  async getDriverRatings(driverId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { targetDriverId: driverId },
      include: {
        order: {
          select: {
            orderNumber: true,
            toAddress: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const stats = await this.calculateStats(driverId, 'DRIVER');
    return { ratings, stats };
  }

  async getMyStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, driver: true },
    });
    if (!user || !user.role) throw new BadRequestException('Пользователь не найден');

    if (user.role === 'CLIENT' && user.client) {
      return this.calculateStats(user.client.id, 'CLIENT');
    } else if (user.role === 'DRIVER' && user.driver) {
      return this.calculateStats(user.driver.id, 'DRIVER');
    }
    return { averageScore: 0, totalCount: 0, distribution: {} };
  }

  private async calculateStats(targetId: string, targetRole: 'CLIENT' | 'DRIVER') {
    const where = targetRole === 'CLIENT' 
      ? { targetClientId: targetId }
      : { targetDriverId: targetId };

    const ratings = await this.prisma.rating.findMany({ where, select: { score: true } });
    const totalCount = ratings.length;
    const averageScore = totalCount > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / totalCount
      : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((r) => { distribution[r.score] = (distribution[r.score] || 0) + 1; });

    return { averageScore: Math.round(averageScore * 10) / 10, totalCount, distribution };
  }
}
