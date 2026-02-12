import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  async list(@CurrentUser() payload: JwtPayload) {
    return this.warehouses.listByClient(payload.userId);
  }

  @Get(':id')
  async getOne(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.warehouses.getOne(id, payload.userId);
  }

  @Post()
  async create(@CurrentUser() payload: JwtPayload, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(payload.userId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(id, payload.userId, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() payload: JwtPayload, @Param('id') id: string) {
    return this.warehouses.delete(id, payload.userId);
  }
}
