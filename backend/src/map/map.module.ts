import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MapController } from './map.controller';
import { MapService } from './map.service';

@Module({
  imports: [AuthModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
