import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { customerSegments, events, profiles } from '../database/schema';
import { eq, sql, and, or } from 'drizzle-orm';

@Injectable()
export class SegmentsService {
  constructor(private readonly db: DatabaseService) {}

  async createSegment(data: { name: string; description?: string; criteria: any }) {
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

  async getSegmentPreview(criteria: any) {
    const { conditions, conjunction = 'AND' } = criteria;
    
    if (!conditions || conditions.length === 0) {
      return [];
    }

    // Build query động dựa trên criteria
    // Ví dụ đơn giản: Lọc các profileId có event_name tương ứng
    // Phù hợp với đề xuất: Lọc theo Event + Count (Aggregate)
    
    const subqueries = conditions.map((cond: any) => {
      return sql`(
        SELECT profile_id 
        FROM ${events} 
        WHERE event_name = ${cond.value}
        GROUP BY profile_id
        HAVING COUNT(*) >= ${cond.min_occurrences || 1}
      )`;
    });

    // Kết hợp các subqueries bằng INTERSECT (AND) hoặc UNION (OR)
    const operator = conjunction === 'AND' ? sql` INTERSECT ` : sql` UNION `;
    const finalQuery = sql.join(subqueries, operator);

    const result = await this.db.conn.execute(sql`
      SELECT * FROM ${profiles} 
      WHERE id IN (${finalQuery})
    `);

    return (result as any).rows || [];
  }
}
