import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { isAdmin?: boolean } }>();
    if (req.user?.isAdmin) return true;
    throw new ForbiddenException('Доступ только для администратора');
  }
}
