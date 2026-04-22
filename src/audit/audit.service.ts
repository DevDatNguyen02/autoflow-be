import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_verified'
  | 'password_changed'
  | 'document_uploaded'
  | 'document_deleted'
  | 'workflow_created'
  | 'workflow_updated'
  | 'workflow_deleted'
  | 'workflow_activated'
  | 'segment_created'
  | 'segment_updated'
  | 'segment_deleted'
  | 'knowledge_configured'
  | 'customer_viewed'
  | 'profile_deleted';

export interface LogActionParams {
  userId?: string | null;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async logAction(params: LogActionParams): Promise<void> {
    const { userId, action, resource, resourceId, metadata } = params;
    try {
      await this.db.insert(schema.auditLogs).values({
        userId: userId ?? null,
        action,
        resource: resource ?? null,
        resourceId: resourceId ?? null,
        metadata: metadata ?? null,
      });
    } catch (error) {
      // Ghi log lỗi nhưng không throw để tránh ảnh hưởng luồng chính
      console.error('[AuditService] Failed to log action:', action, error);
    }
  }

  async getAuditLogs(options: {
    userId?: string;
    action?: string;
    resource?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(schema.auditLogs)
      .orderBy(schema.auditLogs.timestamp)
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      page,
      limit,
    };
  }
}
