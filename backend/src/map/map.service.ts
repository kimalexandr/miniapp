import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrderStatus } from '@prisma/client';

/**
 * Данные для отображения на карте: заявки с координатами и водители с геолокацией.
 */
@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrdersForMap(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, driver: true },
    });
    if (!user) return { orders: [], drivers: [] };

    if (role === UserRole.CLIENT && user.client) {
      const orders = await this.prisma.order.findMany({
        where: { clientId: user.client.id },
        select: {
          id: true,
          orderNumber: true,
          toAddress: true,
          toLatitude: true,
          toLongitude: true,
          status: true,
          preferredDate: true,
          fromWarehouse: { select: { address: true, latitude: true, longitude: true } },
        },
      });
      const withCoords = orders.map((o) => ({
        ...o,
        lat: o.fromWarehouse?.latitude ?? o.toLatitude,
        lng: o.fromWarehouse?.longitude ?? o.toLongitude,
      }));
      return { orders: withCoords, drivers: [] };
    }

    if (role === UserRole.DRIVER && user.driver) {
      const myOrders = await this.prisma.order.findMany({
        where: { driverId: user.driver.id },
        select: {
          id: true,
          orderNumber: true,
          toAddress: true,
          toLatitude: true,
          toLongitude: true,
          status: true,
          fromWarehouse: { select: { latitude: true, longitude: true, address: true } },
        },
      });
      const availableOrders = await this.prisma.order.findMany({
        where: { driverId: null, status: { in: [OrderStatus.NEW, OrderStatus.PUBLISHED] } },
        select: {
          id: true,
          orderNumber: true,
          toAddress: true,
          toLatitude: true,
          toLongitude: true,
          status: true,
          fromWarehouse: { select: { latitude: true, longitude: true, address: true } },
        },
      });
      const drivers = await this.prisma.driver.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          driverStatus: true,
          user: { select: { firstName: true, lastName: true } },
        },
      });
      return {
        orders: [...myOrders, ...availableOrders].map((o) => ({
          ...o,
          lat: o.fromWarehouse?.latitude ?? o.toLatitude,
          lng: o.fromWarehouse?.longitude ?? o.toLongitude,
        })),
        drivers: drivers.filter((d) => d.latitude != null && d.longitude != null),
      };
    }

    return { orders: [], drivers: [] };
  }
}
