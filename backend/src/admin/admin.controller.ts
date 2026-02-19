import { Controller, Get, Delete, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
}
