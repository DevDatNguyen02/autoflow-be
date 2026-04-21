import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingProcessor } from './tracking.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: 'tracking-queue' },
      { name: 'automation-engine' },
    ),
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingProcessor],
})
export class TrackingModule {}
