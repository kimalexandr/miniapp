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
      include: { client: { include: { user: { select: { id: true } } } }, driver: { include: { user: { select: { id: true } } } } },
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.status !== 'COMPLETED') throw new BadRequestException('Оценить можно только завершённую заявку');

    const isClient = user.role === 'CLIENT' && order.clientId === user.client?.id;
    const isDriver = user.role === 'DRIVER' && order.driverId === user.driver?.id;
    if (!isClient && !isDriver) throw new BadRequestException('Вы не участвовали в этой заявке');

    const toUserId = user.role === 'CLIENT' ? order.driver?.user?.id : order.client?.user?.id;
    if (!toUserId) throw new BadRequestException('Некого оценивать по этой заявке');

    const existing = await this.prisma.rating.findUnique({
      where: { orderId_raterRole: { orderId: dto.orderId, raterRole: user.role } },
    });
    if (existing) throw new BadRequestException('Вы уже оценили эту заявку');

    const rating = await this.prisma.rating.create({
      data: {
        orderId: dto.orderId,
        fromUserId: userId,
        toUserId,
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
      where: { targetDriverId: driverId, raterRole: 'CLIENT' },
      include: {
        order: {
          include: {
            client: {
              select: { companyName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const stats = await this.calculateStats(driverId, 'DRIVER');
    return { ratings, stats };
  }

  /** Отзывы для текущего водителя (от складов/клиентов) */
  async getMyDriverRatings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });
    if (!user?.driver) return { ratings: [], stats: { averageScore: 0, totalCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } };
    return this.getDriverRatings(user.driver.id);
  }

  async getMyStats(userId: string) {
    if (!userId || userId === 'admin') {
      throw new BadRequestException('Пользователь не найден');
    }
    return this.getStatsByUserId(userId);
  }

  /** Рейтинг по userId (для профиля клиента/водителя) */
  async getStatsByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, driver: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.client) return this.calculateStats(user.client.id, 'CLIENT');
    if (user.driver) return this.calculateStats(user.driver.id, 'DRIVER');
    return { averageScore: 0, totalCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
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

    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) {
      const s = r.score;
      if (s >= 1 && s <= 5) {
        distribution[s] = distribution[s] + 1;
      }
    }

    return { averageScore: Math.round(averageScore * 10) / 10, totalCount, distribution };
  }
}
