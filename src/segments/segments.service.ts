import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { customerSegments, events, profiles } from '../database/schema';
import { sql, SQL } from 'drizzle-orm';

interface SegmentCondition {
  event_name: string;
  min_occurrences?: number;
}

interface SegmentCriteria {
  conditions: SegmentCondition[];
  conjunction?: 'AND' | 'OR';
}

@Injectable()
export class SegmentsService {
  constructor(private readonly db: DatabaseService) {}

  async createSegment(data: {
    name: string;
    description?: string;
    criteria: SegmentCriteria;
  }) {
    return this.db.conn
      .insert(customerSegments)
      .values({
        name: data.name,
        description: data.description,
        criteria: data.criteria,
      })
      .returning();
  }

  async getSegments() {
    return this.db.conn.select().from(customerSegments);
  }

  async getSegmentPreview(criteria: SegmentCriteria) {
    const { conditions, conjunction = 'AND' } = criteria;

    if (!conditions || conditions.length === 0) {
      return { count: 0 };
    }

    // Build query động dựa trên criteria
    const subqueries: SQL[] = conditions.map((cond: SegmentCondition) => {
      return sql`(
        SELECT profile_id 
        FROM ${events} 
        WHERE event_name = ${cond.event_name}
        GROUP BY profile_id
        HAVING COUNT(*) >= ${cond.min_occurrences || 1}
      )`;
    });

    // Kết hợp các subqueries bằng INTERSECT (AND) hoặc UNION (OR)
    const operator = conjunction === 'AND' ? sql` INTERSECT ` : sql` UNION `;
    const finalQuery = sql.join(subqueries, operator);

    const result = (await this.db.conn.execute(sql`
      SELECT COUNT(*) as count FROM ${profiles} 
      WHERE id IN (${finalQuery})
    `)) as { rows: { count: string }[] };

    const count = parseInt(result.rows[0]?.count || '0', 10);
    return { count };
  }
}
