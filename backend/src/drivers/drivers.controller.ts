import { Controller, Get, Put, Body, UseGuards, Param } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { DriverProfileDto, DriverLocationDto } from './dto/driver-profile.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  async getProfile(@CurrentUser() payload: JwtPayload) {
    return this.drivers.getProfile(payload.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getDriverById(@Param('id') driverId: string) {
    return this.drivers.getDriverById(driverId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  async updateProfile(@CurrentUser() payload: JwtPayload, @Body() dto: DriverProfileDto) {
    return this.drivers.updateProfile(payload.userId, dto);
  }

  @Put('location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  async updateLocation(@CurrentUser() payload: JwtPayload, @Body() dto: DriverLocationDto) {
    return this.drivers.updateLocation(payload.userId, dto);
  }
}
