import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    return;
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log('--- Seeding Database ---');

  const adminEmail = 'admin@autoflow.ai';
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Check if admin already exists
  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, adminEmail))
    .limit(1);

  if (existingUser) {
    console.log('Admin user already exists, updating password...');
    await db
      .update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.email, adminEmail));
  } else {
    console.log('Creating admin user...');
    await db.insert(schema.users).values({
      id: 'admin-id-001',
      name: 'Admin User',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    });
  }

  console.log('--- Seeding Complete ---');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
