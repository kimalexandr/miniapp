import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/warehouse.dto';
import { UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByClient(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) return [];
    return this.prisma.warehouse.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(warehouseId: string, userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, clientId: client.id },
    });
    if (!wh) throw new NotFoundException('Склад не найден');
    return wh;
  }

  async create(userId: string, dto: CreateWarehouseDto) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    return this.prisma.warehouse.create({
      data: {
        clientId: client.id,
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        workSchedule: dto.workSchedule,
        contactPhone: dto.contactPhone,
        contactPerson: dto.contactPerson,
        pickupAvailable: dto.pickupAvailable ?? false,
      },
    });
  }

  async update(warehouseId: string, userId: string, dto: UpdateWarehouseDto) {
    await this.getOne(warehouseId, userId);
    return this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        workSchedule: dto.workSchedule,
        contactPhone: dto.contactPhone,
        contactPerson: dto.contactPerson,
        pickupAvailable: dto.pickupAvailable,
      },
    });
  }

  async delete(warehouseId: string, userId: string) {
    await this.getOne(warehouseId, userId);
    await this.prisma.warehouse.delete({ where: { id: warehouseId } });
    return { success: true };
  }
}
