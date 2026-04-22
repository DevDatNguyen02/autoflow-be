import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { DATABASE_CONNECTION } from './database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(
    @Inject(DATABASE_CONNECTION)
    public readonly conn: NodePgDatabase<typeof schema>,
  ) {}

  async onModuleInit() {
    console.log('Initializing database tables...');
    try {
      // Khởi tạo bảng knowledge_documents nếu chưa có
      await this.conn.execute(sql`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Khởi tạo bảng workflows nếu chưa có
      await this.conn.execute(sql`
        CREATE TABLE IF NOT EXISTS workflows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          graph JSONB NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Thêm cột MFA vào bảng user nếu chưa có (Phase 10)
      await this.conn.execute(sql`
        ALTER TABLE "user"
          ADD COLUMN IF NOT EXISTS mfa_enabled TEXT DEFAULT 'false',
          ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
          ADD COLUMN IF NOT EXISTS mfa_recovery_codes JSONB
      `);

      // Khởi tạo bảng audit_logs nếu chưa có (Phase 10)
      await this.conn.execute(sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          resource TEXT,
          resource_id TEXT,
          metadata JSONB,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await this.conn.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)
      `);
      await this.conn.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)
      `);

      console.log('Database tables initialized successfully.');
    } catch (e) {
      console.error('Error initializing database tables:', e);
    }
  }
}
