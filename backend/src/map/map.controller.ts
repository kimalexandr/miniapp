import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MapService } from './map.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Controller('map')
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(
    private readonly map: MapService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getMapData(@CurrentUser() payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });
    const role = user?.role ?? UserRole.CLIENT;
    return this.map.getOrdersForMap(payload.userId, role);
  }
}
