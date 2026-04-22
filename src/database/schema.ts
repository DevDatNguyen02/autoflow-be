import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  primaryKey,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';
// Import custom vector type để Drizzle hỗ trợ pgvector
import { customType } from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';

// Định nghĩa cột 'vector' cho pgvector - Phù hợp với Gemini (768 dims)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)'; // Gemini's text-embedding-004 uses 768 dims
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    try {
      if (typeof value === 'string') {
        const cleaned = value.replace('[', '').replace(']', '');
        return cleaned.split(',').map((v) => parseFloat(v));
      }
      return value;
    } catch {
      return [];
    }
  },
});

// Bảng quản lý tài liệu nguồn
export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(), // pdf, txt, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Bảng chứa các đoạn văn bản (chunks) và vector tương ứng
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- NextAuth Tables ---

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  role: text('role').default('admin'), // 'admin' | 'marketer' | 'agent'
  password: text('password'), // Mật khẩu băm (bcrypt)
  // --- MFA Fields ---
  mfaEnabled: text('mfa_enabled').default('false'), // 'true' | 'false'
  mfaSecret: text('mfa_secret'), // TOTP secret (encrypted)
  mfaRecoveryCodes: jsonb('mfa_recovery_codes'), // Mảng các mã khôi phục đã băm
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// --- Customer Profiles & Tracking ---

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email'),
  name: text('name'),
  properties: jsonb('properties'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    anonymousId: text('anonymous_id'),
    profileId: uuid('profile_id').references(() => profiles.id, {
      onDelete: 'cascade',
    }),
    eventName: text('event_name').notNull(),
    url: text('url'),
    source: text('source'),
    campaign: text('campaign'),
    properties: jsonb('properties'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    idx_events_name_profile: index('idx_events_name_profile').on(
      table.eventName,
      table.profileId,
    ),
  }),
);

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  graph: jsonb('graph').notNull(), // Chứa nodes và edges từ Xyflow
  status: text('status', { enum: ['draft', 'active'] }).default('draft'), // 'draft' | 'active'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- AI Chat & Feedback (Phase 7) ---

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  anonymousId: text('anonymous_id'),
  needsAgent: integer('needs_agent').default(0), // 0: No, 1: Yes
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'bot'
  content: text('content').notNull(),
  confidenceScore: integer('confidence_score'), // 0-100
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const feedbacks = pgTable('feedbacks', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: text('message_id')
    .notNull()
    .references(() => chatMessages.id, { onDelete: 'cascade' }),
  isLike: integer('is_like').notNull(), // 1: Like, 0: Dislike
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Customer Segmentation (Phase 8) ---

export const customerSegments = pgTable('customer_segments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(), // { conditions: [], conjunction: 'AND' }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- Audit Log (Phase 10) ---

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // 'login', 'login_failed', 'role_changed', etc.
    resource: text('resource'), // 'user', 'workflow', 'document', etc.
    resourceId: text('resource_id'),
    metadata: jsonb('metadata'), // Dữ liệu bổ sung: { old, new, ip, ... }
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    idx_audit_logs_user: index('idx_audit_logs_user').on(table.userId),
    idx_audit_logs_action: index('idx_audit_logs_action').on(table.action),
  }),
);

export type Profile = InferSelectModel<typeof profiles>;
export type Event = InferSelectModel<typeof events>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type ChatSession = InferSelectModel<typeof chatSessions>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
