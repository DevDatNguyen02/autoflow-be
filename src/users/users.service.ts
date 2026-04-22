import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export type UserRole = 'admin' | 'marketer' | 'agent';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll() {
    const users = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        mfaEnabled: schema.users.mfaEnabled,
        emailVerified: schema.users.emailVerified,
      })
      .from(schema.users)
      .orderBy(schema.users.name);

    return users;
  }

  async createUser(data: { name: string; email: string; role: UserRole }) {
    // Kiểm tra email đã tồn tại
    const [existing] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, data.email))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Email '${data.email}' đã tồn tại trong hệ thống.`);
    }

    // Tạo mật khẩu tạm thời ngẫu nhiên
    const tempPassword = Math.random().toString(36).slice(-10) + '!A1';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        name: data.name,
        email: data.email,
        role: data.role,
        password: hashedPassword,
      })
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
      });

    return { ...newUser, tempPassword }; // Gửi cho Admin để thông báo cho nhân viên
  }

  async updateRole(userId: string, newRole: UserRole) {
    const [user] = await this.db
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException(`Không tìm thấy người dùng ID '${userId}'.`);

    await this.db
      .update(schema.users)
      .set({ role: newRole })
      .where(eq(schema.users.id, userId));

    return { userId, oldRole: user.role, newRole };
  }

  async deleteUser(userId: string) {
    const [user] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException(`Không tìm thấy người dùng ID '${userId}'.`);

    await this.db.delete(schema.users).where(eq(schema.users.id, userId));
    return { success: true };
  }
}
