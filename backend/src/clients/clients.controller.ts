import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ClientProfileDto } from './dto/client-profile.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get('profile')
  async getProfile(@CurrentUser() payload: JwtPayload) {
    return this.clients.getProfile(payload.userId);
  }

  @Put('profile')
  async updateProfile(@CurrentUser() payload: JwtPayload, @Body() dto: ClientProfileDto) {
    return this.clients.updateProfile(payload.userId, dto);
  }
}
