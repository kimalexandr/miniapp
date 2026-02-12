import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { DriverProfileDto, DriverLocationDto } from './dto/driver-profile.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get('profile')
  async getProfile(@CurrentUser() payload: JwtPayload) {
    return this.drivers.getProfile(payload.userId);
  }

  @Put('profile')
  async updateProfile(@CurrentUser() payload: JwtPayload, @Body() dto: DriverProfileDto) {
    return this.drivers.updateProfile(payload.userId, dto);
  }

  @Put('location')
  async updateLocation(@CurrentUser() payload: JwtPayload, @Body() dto: DriverLocationDto) {
    return this.drivers.updateLocation(payload.userId, dto);
  }
}
