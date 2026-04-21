import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { profiles, events } from '../database/schema';
import { desc, sql } from 'drizzle-orm';

@Injectable()
export class TrackingService {
  constructor(
    @InjectQueue('tracking-queue') private readonly trackingQueue: Queue,
    private readonly db: DatabaseService,
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

  async getProfiles(limit = 100) {
    const data = await this.db.conn
      .select()
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(limit);
    return { data };
  }

  async getUniqueEventNames() {
    const result = await this.db.conn
      .select({ name: events.eventName })
      .from(events)
      .groupBy(events.eventName);
    return result.map((r) => r.name);
  }
}
