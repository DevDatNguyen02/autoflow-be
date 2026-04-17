import {
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  integer,
  primaryKey,
  jsonb,
} from 'drizzle-orm/pg-core';
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
  role: text('role').default('admin'), // Mặc định role cho dashboard
  password: text('password'), // Mật khẩu băm (bcrypt)
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

export const events = pgTable('events', {
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
});

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  graph: jsonb('graph').notNull(), // Chứa nodes và edges từ Xyflow
  isActive: integer('is_active').default(1), // 1: Active, 0: Inactive
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
