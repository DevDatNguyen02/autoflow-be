import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { workflows } from '../database/schema';

@Injectable()
export class AutomationService {
  constructor(private readonly db: DatabaseService) {}

  async createWorkflow(data: { name: string; graph: any }) {
    const [newWorkflow] = await this.db.conn
      .insert(workflows)
      .values({
        name: data.name,
        graph: data.graph,
      })
      .returning();
    return newWorkflow;
  }

  async getAllWorkflows() {
    return this.db.conn.select().from(workflows);
  }
}
