import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { RatingsService } from '../ratings/ratings.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-status.dto';
import { RateOrderDto } from '../ratings/dto/rate-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly ratings: RatingsService,
  ) {}

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
  async available(
    @CurrentUser() payload: JwtPayload,
    @Query('preferredDateFrom') preferredDateFrom?: string,
    @Query('preferredDateTo') preferredDateTo?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
  ) {
    const filters = {
      preferredDateFrom,
      preferredDateTo,
      priceMin: priceMin != null ? Number(priceMin) : undefined,
      priceMax: priceMax != null ? Number(priceMax) : undefined,
    };
    return this.orders.listAvailableForDriver(payload.userId, filters);
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

  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async start(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.startOrder(id, payload.userId);
  }

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async complete(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.completeOrder(id, payload.userId);
  }

  @Post(':id/cancel-by-driver')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async cancelByDriver(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.cancelOrderByDriver(id, payload.userId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.updateOrder(id, payload.userId, dto);
  }

  @Post(':id/unpublish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async unpublish(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.unpublishOrder(id, payload.userId);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async cancel(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.orders.cancelOrder(id, payload.userId);
  }

  @Post(':id/rate')
  async rate(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RateOrderDto,
  ) {
    return this.ratings.createRating(payload.userId, { ...dto, orderId: id });
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
