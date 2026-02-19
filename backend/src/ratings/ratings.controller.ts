import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
