import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { profiles, events, workflows } from '../database/schema';
import { count, sql, eq } from 'drizzle-orm';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getOverview() {
    try {
      // 1. Total Users (Profiles)
      const [userCount] = await this.db.conn
        .select({ value: count() })
        .from(profiles);

      // 2. Total Events
      const [eventCount] = await this.db.conn
        .select({ value: count() })
        .from(events);

      // 3. Active Flows (Real count from workflows table)
      const [activeFlowsResult] = await this.db.conn
        .select({ value: count() })
        .from(workflows)
        .where(eq(workflows.status, 'active'));

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
        activeFlows: activeFlowsResult.value,
        timeSeries: (timeSeries as any).rows || [],
      };
    } catch (e) {
      console.error('Error fetching dashboard overview:', e);
      // Fallback to zeros if something still fails
      return {
        totalUsers: 0,
        totalEvents: 0,
        activeFlows: 0,
        timeSeries: [],
      };
    }
  }
}
