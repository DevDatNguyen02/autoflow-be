import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { profiles, events } from '../database/schema';
import { count, sql } from 'drizzle-orm';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) { }

  async getOverview() {
    // 1. Total Users (Profiles)
    const [userCount] = await this.db.conn
      .select({ value: count() })
      .from(profiles);

    // 2. Total Events
    const [eventCount] = await this.db.conn
      .select({ value: count() })
      .from(events);

    // 3. Active Flows (Placeholder until Phase 4.2)
    const activeFlows = 0;

    // 4. Time-series data (Events per day for the last 7 days)
    const timeSeries = await this.db.conn.execute(sql`
      SELECT 
        date_trunc('day', timestamp) as date, 
        count(*) as count 
      FROM events 
      WHERE timestamp > now() - interval '7 days'
      GROUP BY date 
      ORDER BY date ASC
    `);

    return {
      totalUsers: userCount.value,
      totalEvents: eventCount.value,
      activeFlows,
      timeSeries: timeSeries,
    };
  }
}
