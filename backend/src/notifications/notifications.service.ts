import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  notifyNewOrder(orderId: string): void {
    console.log(`[Notification] Новая заявка опубликована: orderId=${orderId}`);
  }

  notifyOrderTaken(orderId: string): void {
    console.log(`[Notification] Заявка взята водителем: orderId=${orderId}`);
  }

  notifyOrderCompleted(orderId: string): void {
    console.log(`[Notification] Заявка завершена: orderId=${orderId}`);
  }
}
