import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';

interface RequestWithUser { user: { userId: string } }

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  /**
   * Создать рейтинг для завершенной заявки
   */
  @Post()
  async createRating(@Request() req: RequestWithUser, @Body() dto: CreateRatingDto) {
    return this.ratings.createRating(req.user.userId, dto);
  }

  /**
   * Получить рейтинги клиента (для просмотра водителем)
   */
  @Get('client/:clientId')
  async getClientRatings(@Param('clientId') clientId: string) {
    return this.ratings.getClientRatings(clientId);
  }

  /**
   * Мои отзывы (для водителя — отзывы от складов/клиентов)
   */
  @Get('driver/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  async getMyDriverRatings(@Request() req: RequestWithUser) {
    return this.ratings.getMyDriverRatings(req.user.userId);
  }

  /**
   * Получить рейтинги водителя (для просмотра клиентом)
   */
  @Get('driver/:driverId')
  async getDriverRatings(@Param('driverId') driverId: string) {
    return this.ratings.getDriverRatings(driverId);
  }

  /**
   * Получить свою статистику рейтингов
   */
  @Get('my-stats')
  async getMyStats(@Request() req: RequestWithUser) {
    return this.ratings.getMyStats(req.user.userId);
  }

  /**
   * Рейтинг по userId (для отображения в профиле клиента/водителя)
   */
  @Get('user/:userId')
  async getStatsByUser(@Param('userId') userId: string) {
    return this.ratings.getStatsByUserId(userId);
  }
}
