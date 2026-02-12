import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async create(@CurrentUser() payload: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.orders.create(payload.userId, dto);
  }

  @Get()
  async list(
    @CurrentUser() payload: JwtPayload,
    @Query('role') role: UserRole,
    @Query('status') status?: OrderStatus,
  ) {
    if (role === UserRole.CLIENT) {
      return this.orders.listForClient(payload.userId, status);
    }
    if (role === UserRole.DRIVER) {
      if (status === 'TAKEN' || status === 'AT_WAREHOUSE' || status === 'LOADING_DONE' || status === 'IN_TRANSIT' || status === 'DELIVERED') {
        return this.orders.listMyForDriver(payload.userId);
      }
      return this.orders.listAvailableForDriver(payload.userId);
    }
    return [];
  }

  @Get('available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async available(@CurrentUser() payload: JwtPayload) {
    return this.orders.listAvailableForDriver(payload.userId);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async my(@CurrentUser() payload: JwtPayload) {
    return this.orders.listMyForDriver(payload.userId);
  }

  @Get(':id')
  async getOne(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.findById(id, payload.userId);
  }

  @Post(':id/take')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async take(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.takeOrder(id, payload.userId);
  }

  @Post(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async updateStatus(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateOrderStatus(id, payload.userId, dto.status, dto.comment);
  }
}
