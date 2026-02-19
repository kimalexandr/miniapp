import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async nextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
    });
    return `ORD-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(clientUserId: string, dto: CreateOrderDto) {
    const client = await this.prisma.client.findUnique({ where: { userId: clientUserId } });
    if (!client) throw new ForbiddenException('Профиль клиента не найден');

    const orderNumber = await this.nextOrderNumber();
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        clientId: client.id,
        fromWarehouseId: dto.fromWarehouseId || null,
        toAddress: dto.toAddress,
        toLatitude: dto.toLatitude ?? null,
        toLongitude: dto.toLongitude ?? null,
        preferredDate: new Date(dto.preferredDate),
        preferredTimeFrom: dto.preferredTimeFrom ?? null,
        preferredTimeTo: dto.preferredTimeTo ?? null,
        cargoType: dto.cargoType ?? null,
        cargoVolume: dto.cargoVolume ?? null,
        cargoWeight: dto.cargoWeight ?? null,
        cargoPlaces: dto.cargoPlaces ?? null,
        pickupRequired: dto.pickupRequired ?? false,
        specialConditions: dto.specialConditions ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        responseDeadline: dto.responseDeadline ? new Date(dto.responseDeadline) : null,
        price: dto.price != null ? new Decimal(dto.price) : null,
        paymentType: dto.paymentType ?? null,
        status: OrderStatus.NEW,
      },
    });

    await this.prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: OrderStatus.NEW, comment: 'Заявка создана' },
    });
    await this.audit.log(clientUserId, 'order_created', 'Order', order.id, { orderNumber });
    return order;
  }

  async findById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true, username: true } } } },
        driver: { include: { user: { select: { firstName: true, lastName: true, username: true } } } },
        fromWarehouse: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        ratings: { select: { raterRole: true, score: true, comment: true, createdAt: true } },
      },
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, driver: true },
    });
    const isClient = user?.client && order.clientId === user.client.id;
    const isDriver = user?.driver && order.driverId === user.driver.id;
    if (!isClient && !isDriver) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }

  async listForClient(clientUserId: string, status?: OrderStatus) {
    const client = await this.prisma.client.findUnique({ where: { userId: clientUserId } });
    if (!client) return [];
    const where: Record<string, unknown> = { clientId: client.id };
    if (status) where.status = status;
    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        fromWarehouse: { select: { address: true, name: true } },
        ratings: { select: { raterRole: true } },
      },
    });
  }

  async listAvailableForDriver(driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) return [];
    return this.prisma.order.findMany({
      where: {
        driverId: null,
        status: { in: [OrderStatus.NEW, OrderStatus.PUBLISHED] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { include: { user: { select: { firstName: true } } } },
        fromWarehouse: { select: { address: true } },
      },
    });
  }

  async listMyForDriver(driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) return [];
    return this.prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: { in: [OrderStatus.TAKEN, OrderStatus.AT_WAREHOUSE, OrderStatus.LOADING_DONE, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
        ratings: { select: { raterRole: true } },
      },
    });
  }

  async takeOrder(orderId: string, driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Профиль водителя не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.driverId) throw new ForbiddenException('Заявка уже взята');
    const availableStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.PUBLISHED];
    if (!availableStatuses.includes(order.status)) {
      throw new ForbiddenException('Заявка недоступна для взятия');
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { driverId: driver.id, status: OrderStatus.TAKEN },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.TAKEN, comment: 'Взята водителем' },
      }),
    ]);
    await this.audit.log(driverUserId, 'order_taken', 'Order', orderId, {});
    return this.findById(orderId, driverUserId);
  }

  async updateOrderStatus(orderId: string, driverUserId: string, status: OrderStatus, comment?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Профиль водителя не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.driverId !== driver.id) throw new ForbiddenException('Это не ваша заявка');

    const allowed: OrderStatus[] = [
      OrderStatus.AT_WAREHOUSE,
      OrderStatus.LOADING_DONE,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ];
    if (!allowed.includes(status)) throw new ForbiddenException('Недопустимый статус');

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status, comment: comment ?? status },
      }),
    ]);
    await this.audit.log(driverUserId, 'status_changed', 'Order', orderId, { status });
    return this.findById(orderId, driverUserId);
  }

  async updateOrder(orderId: string, clientUserId: string, dto: UpdateOrderDto) {
    const client = await this.prisma.client.findUnique({ where: { userId: clientUserId } });
    if (!client) throw new ForbiddenException('Профиль клиента не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== client.id) throw new ForbiddenException('Это не ваша заявка');

    const allowedStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.DRAFT, OrderStatus.PUBLISHED];
    if (!allowedStatuses.includes(order.status)) {
      throw new ForbiddenException('Редактирование недоступно для заявки в текущем статусе');
    }

    const data: Record<string, unknown> = {};
    if (dto.fromWarehouseId !== undefined) data.fromWarehouseId = dto.fromWarehouseId || null;
    if (dto.toAddress !== undefined) data.toAddress = dto.toAddress;
    if (dto.toLatitude !== undefined) data.toLatitude = dto.toLatitude ?? null;
    if (dto.toLongitude !== undefined) data.toLongitude = dto.toLongitude ?? null;
    if (dto.preferredDate !== undefined) data.preferredDate = new Date(dto.preferredDate);
    if (dto.preferredTimeFrom !== undefined) data.preferredTimeFrom = dto.preferredTimeFrom ?? null;
    if (dto.preferredTimeTo !== undefined) data.preferredTimeTo = dto.preferredTimeTo ?? null;
    if (dto.cargoType !== undefined) data.cargoType = dto.cargoType ?? null;
    if (dto.cargoVolume !== undefined) data.cargoVolume = dto.cargoVolume ?? null;
    if (dto.cargoWeight !== undefined) data.cargoWeight = dto.cargoWeight ?? null;
    if (dto.cargoPlaces !== undefined) data.cargoPlaces = dto.cargoPlaces ?? null;
    if (dto.pickupRequired !== undefined) data.pickupRequired = dto.pickupRequired ?? false;
    if (dto.specialConditions !== undefined) data.specialConditions = dto.specialConditions ?? null;
    if (dto.contactName !== undefined) data.contactName = dto.contactName ?? null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone ?? null;
    if (dto.responseDeadline !== undefined) data.responseDeadline = dto.responseDeadline ? new Date(dto.responseDeadline) : null;
    if (dto.price !== undefined) data.price = dto.price != null ? new Decimal(dto.price) : null;
    if (dto.paymentType !== undefined) data.paymentType = dto.paymentType ?? null;

    await this.prisma.order.update({
      where: { id: orderId },
      data,
    });
    await this.audit.log(clientUserId, 'order_updated', 'Order', orderId, {});
    return this.findById(orderId, clientUserId);
  }

  async unpublishOrder(orderId: string, clientUserId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId: clientUserId } });
    if (!client) throw new ForbiddenException('Профиль клиента не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== client.id) throw new ForbiddenException('Это не ваша заявка');
    if (order.status !== OrderStatus.PUBLISHED) {
      throw new ForbiddenException('Снять с публикации можно только заявку в статусе «Ожидает откликов»');
    }
    if (order.driverId) throw new ForbiddenException('По заявке уже есть отклики');

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DRAFT },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.DRAFT, comment: 'Снято с публикации клиентом' },
      }),
    ]);
    await this.audit.log(clientUserId, 'order_unpublished', 'Order', orderId, {});
    return this.findById(orderId, clientUserId);
  }
}
