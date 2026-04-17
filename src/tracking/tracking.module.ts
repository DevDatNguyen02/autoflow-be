import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingProcessor } from './tracking.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tracking-queue',
    }),
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingProcessor],
})
export class TrackingModule { }
