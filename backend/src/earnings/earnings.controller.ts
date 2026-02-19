import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { EarningsService } from './earnings.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class EarningsController {
  constructor(
    private readonly earnings: EarningsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('drivers/me/earnings')
  async getMyEarnings(
    @CurrentUser() payload: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: payload.userId } });
    if (!driver) throw new Error('Профиль водителя не найден');
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.earnings.getDriverEarnings(driver.id, fromDate, toDate);
  }

  @Get('drivers/:id/earnings')
  async getDriverEarnings(
    @Param('id') driverId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.earnings.getDriverEarnings(driverId, fromDate, toDate);
  }

  @Get('drivers/:id/balance')
  async getDriverBalance(@Param('id') driverId: string) {
    return this.earnings.getDriverBalance(driverId);
  }

  @Post('earnings/:id/mark-paid')
  async markEarningAsPaid(@Param('id') id: string) {
    return this.earnings.markEarningAsPaid(id);
  }
}
