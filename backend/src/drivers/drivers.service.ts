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
    return this.getOrCreateDriver(userId);
  }
}
