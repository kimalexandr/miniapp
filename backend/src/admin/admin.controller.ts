import { Controller, Get, Delete, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('reports/drivers/earnings')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getDriverEarningsReport(
    @Query('driverId') driverId?: string,
    @Query('clientId') clientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.getDriverEarningsReport({
      driverId: driverId || undefined,
      clientId: clientId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('reports/clients/orders')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getClientOrdersReport(
    @Query('clientId') clientId?: string,
    @Query('driverId') driverId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.getClientOrdersReport({
      clientId: clientId || undefined,
      driverId: driverId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.admin.login(body.email || '', body.password || '');
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listUsers() {
    return this.admin.listUsers();
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteUser(@Param('id') id: string) {
    return this.admin.deleteUser(id);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listOrders() {
    return this.admin.listOrders();
  }

  @Get('drivers-for-filters')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listDriversForFilters() {
    return this.admin.listDriversForFilters();
  }

  @Get('clients-for-filters')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listClientsForFilters() {
    return this.admin.listClientsForFilters();
  }
}
