import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverProfileDto, DriverLocationDto } from './dto/driver-profile.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDriver(userId: string) {
    let driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) {
      driver = await this.prisma.driver.create({
        data: { userId },
      });
    }
    return driver;
  }

  async updateProfile(userId: string, dto: DriverProfileDto) {
    const driver = await this.getOrCreateDriver(userId);
    return this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        vehicleType: dto.vehicleType,
        vehiclePlate: dto.vehiclePlate,
        loadCapacity: dto.loadCapacity,
        dimensions: dto.dimensions,
        licenseNumber: dto.licenseNumber,
        licenseInfo: dto.licenseInfo,
        driverStatus: dto.driverStatus,
      },
    });
  }

  async updateLocation(userId: string, dto: DriverLocationDto) {
    const driver = await this.getOrCreateDriver(userId);
    return this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationUpdatedAt: new Date(),
      },
    });
  }

  async getProfile(userId: string) {
    const driver = await this.getOrCreateDriver(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return { ...driver, phone: user?.phone ?? null };
  }

  async getDriverById(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
          },
        },
      },
    });
    
    if (!driver) {
      throw new Error('Водитель не найден');
    }

    // Получаем статистику рейтингов
    const ratings = await this.prisma.rating.findMany({
      where: { targetDriverId: driverId },
      select: { score: true },
    });

    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / totalRatings
      : 0;

    // Количество завершенных поездок
    const completedOrders = await this.prisma.order.count({
      where: {
        driverId: driverId,
        status: 'COMPLETED',
      },
    });

    return {
      ...driver,
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings,
      completedOrders,
    };
  }
}
