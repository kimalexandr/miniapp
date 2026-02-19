import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EarningsController],
  providers: [EarningsService],
  exports: [EarningsService],
})
export class EarningsModule {}
