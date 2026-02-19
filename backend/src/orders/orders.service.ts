import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus, EarningStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

function paymentTypeToKind(pt: string | null | undefined): 'cash' | 'non_cash' | null {
  if (!pt) return null;
  const lower = pt.toLowerCase();
  if (lower === 'cash' || lower.includes('налич')) return 'cash';
  if (lower === 'non_cash' || lower.includes('безнал') || lower.includes('ндс')) return 'non_cash';
  return null;
}

const ACTIVE_DRIVER_STATUSES: OrderStatus[] = [
  OrderStatus.TAKEN,
  OrderStatus.IN_PROGRESS,
  OrderStatus.AT_WAREHOUSE,
  OrderStatus.LOADING_DONE,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
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
        paymentTypeKind: paymentTypeToKind(dto.paymentType),
        status: OrderStatus.NEW,
      },
    });

    await this.prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: OrderStatus.NEW, comment: 'Заявка создана', changedByUserId: clientUserId },
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

  async listAvailableForDriver(
    driverUserId: string,
    filters?: { preferredDateFrom?: string; preferredDateTo?: string; priceMin?: number; priceMax?: number },
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) return [];
    const where: Record<string, unknown> = {
      driverId: null,
      status: OrderStatus.PUBLISHED,
    };
    if (filters?.preferredDateFrom || filters?.preferredDateTo) {
      where.preferredDate = {};
      if (filters.preferredDateFrom) (where.preferredDate as Record<string, Date>).gte = new Date(filters.preferredDateFrom);
      if (filters.preferredDateTo) (where.preferredDate as Record<string, Date>).lte = new Date(filters.preferredDateTo);
    }
    if (filters?.priceMin != null || filters?.priceMax != null) {
      where.price = {};
      if (filters.priceMin != null) (where.price as Record<string, unknown>).gte = filters.priceMin;
      if (filters.priceMax != null) (where.price as Record<string, unknown>).lte = filters.priceMax;
    }
    return this.prisma.order.findMany({
      where,
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
        status: { in: [OrderStatus.TAKEN, OrderStatus.IN_PROGRESS, OrderStatus.AT_WAREHOUSE, OrderStatus.LOADING_DONE, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
        fromWarehouse: { select: { address: true, name: true } },
        ratings: { select: { raterRole: true } },
      },
    });
  }

  async takeOrder(orderId: string, driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Профиль водителя не найден');

    const activeOrder = await this.prisma.order.findFirst({
      where: { driverId: driver.id, status: { in: ACTIVE_DRIVER_STATUSES } },
    });
    if (activeOrder) throw new ForbiddenException('У вас уже есть активная заявка. Завершите или отмените её.');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.driverId) throw new ForbiddenException('Заявка уже взята');
    if (order.status !== OrderStatus.PUBLISHED) {
      throw new ForbiddenException('Заявка недоступна для взятия');
    }

    const agreedPrice = order.agreedPrice ?? order.price;
    const currency = order.currency ?? 'RUB';

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          driverId: driver.id,
          status: OrderStatus.TAKEN,
          ...(agreedPrice != null && { agreedPrice }),
          currency,
        },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.TAKEN, comment: 'Взята водителем', changedByUserId: driverUserId },
      }),
    ]);
    await this.audit.log(driverUserId, 'order_taken', 'Order', orderId, {});
    this.notifications.notifyOrderTaken(orderId);
    return this.findById(orderId, driverUserId);
  }

  async startOrder(orderId: string, driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Профиль водителя не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.driverId !== driver.id) throw new ForbiddenException('Это не ваша заявка');
    if (order.status !== OrderStatus.TAKEN) throw new ForbiddenException('Начать рейс можно только для заявки в статусе «Взята»');

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.IN_PROGRESS },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.IN_PROGRESS, comment: 'Рейс начат', changedByUserId: driverUserId },
      }),
    ]);
    await this.audit.log(driverUserId, 'order_started', 'Order', orderId, {});
    return this.findById(orderId, driverUserId);
  }

  async completeOrder(orderId: string, clientUserId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId: clientUserId } });
    if (!client) throw new ForbiddenException('Профиль клиента не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== client.id) throw new ForbiddenException('Это не ваша заявка');
    const allowedForComplete: OrderStatus[] = [OrderStatus.IN_PROGRESS, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED];
    if (!allowedForComplete.includes(order.status)) {
      throw new ForbiddenException('Подтвердить выполнение можно только для заявки в процессе доставки');
    }
    const agreedPrice = order.agreedPrice ?? order.price;
    if (agreedPrice == null) {
      throw new ForbiddenException('У заказа не указана согласованная сумма (agreedPrice). Завершение невозможно.');
    }
    if (!order.driverId) throw new ForbiddenException('У заказа не назначен водитель');

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.COMPLETED, comment: 'Подтверждено клиентом', changedByUserId: clientUserId },
      }),
      this.prisma.driverEarning.create({
        data: {
          driverId: order.driverId,
          orderId: order.id,
          amount: agreedPrice,
          currency: order.currency ?? 'RUB',
          status: EarningStatus.CONFIRMED,
        },
      }),
    ]);
    await this.audit.log(clientUserId, 'order_completed', 'Order', orderId, {});
    this.notifications.notifyOrderCompleted(orderId);
    return this.findById(orderId, clientUserId);
  }

  async updateOrderStatus(orderId: string, driverUserId: string, status: OrderStatus, comment?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Профиль водителя не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.driverId !== driver.id) throw new ForbiddenException('Это не ваша заявка');

    const allowed: OrderStatus[] = [
      OrderStatus.IN_PROGRESS,
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
        data: { orderId, status, comment: comment ?? status, changedByUserId: driverUserId },
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
    const noPriceEditStatuses: OrderStatus[] = [OrderStatus.TAKEN, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED];
    if (dto.price !== undefined && noPriceEditStatuses.includes(order.status)) {
      throw new ForbiddenException('Изменение цены/ставки запрещено после взятия заявки');
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
    if (dto.paymentType !== undefined) {
      data.paymentType = dto.paymentType ?? null;
      data.paymentTypeKind = paymentTypeToKind(dto.paymentType);
    }

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
        data: { orderId, status: OrderStatus.DRAFT, comment: 'Снято с публикации клиентом', changedByUserId: clientUserId },
      }),
    ]);
    await this.audit.log(clientUserId, 'order_unpublished', 'Order', orderId, {});
    return this.findById(orderId, clientUserId);
  }

  async cancelOrder(orderId: string, clientUserId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId: clientUserId } });
    if (!client) throw new ForbiddenException('Профиль клиента не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== client.id) throw new ForbiddenException('Это не ваша заявка');

    const allowedStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.DRAFT, OrderStatus.PUBLISHED, OrderStatus.TAKEN];
    if (!allowedStatuses.includes(order.status)) {
      throw new ForbiddenException('Отменить можно только заявку в статусе «Ожидает откликов» или «Взята»');
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, driverId: null },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.CANCELLED, comment: 'Отменена клиентом', changedByUserId: clientUserId },
      }),
    ]);
    await this.audit.log(clientUserId, 'order_cancelled', 'Order', orderId, {});
    return this.findById(orderId, clientUserId);
  }

  async cancelOrderByDriver(orderId: string, driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Профиль водителя не найден');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.driverId !== driver.id) throw new ForbiddenException('Это не ваша заявка');
    if (order.status !== OrderStatus.TAKEN) {
      throw new ForbiddenException('Отменить можно только заявку в статусе «Взята» (до начала рейса)');
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PUBLISHED, driverId: null },
      }),
      this.prisma.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.PUBLISHED, comment: 'Отказ водителя до начала рейса', changedByUserId: driverUserId },
      }),
    ]);
    await this.audit.log(driverUserId, 'order_cancelled_by_driver', 'Order', orderId, {});
    return this.findById(orderId, driverUserId);
  }
}
