import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TrackingService {
  constructor(
    @InjectQueue('tracking-queue') private readonly trackingQueue: Queue,
  ) {}

  async enqueueTrack(payload: any) {
    // Basic validation could happen here
    await this.trackingQueue.add('process-event', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
    });
  }
}
