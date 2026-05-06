import { Injectable, Inject, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { MailService } from '../mail/mail.service';

export type UserRole = 'admin' | 'marketer' | 'agent';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly mailService: MailService,
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

    // Gửi email chào mừng kèm mật khẩu
    try {
      await this.mailService.sendUserWelcome(newUser.name || 'User', newUser.email || '', tempPassword);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Vẫn tiếp tục vì user đã được tạo trong DB
    }

    return newUser; // Không trả về tempPassword nữa để bảo mật
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

  async findById(id: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    // Nếu đổi email, kiểm tra email mới có bị trùng không
    if (data.email) {
      const [existing] = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, data.email))
        .limit(1);

      if (existing && existing.id !== userId) {
        throw new ConflictException(`Email '${data.email}' đã được sử dụng bởi tài khoản khác.`);
      }
    }

    const [updatedUser] = await this.db
      .update(schema.users)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
      })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
      });

    return updatedUser;
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await this.findById(userId);
    if (!user || !user.password) {
      throw new NotFoundException('Người dùng không tồn tại hoặc chưa thiết lập mật khẩu.');
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác.');
    }

    // Băm mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPass, 10);

    await this.db
      .update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.id, userId));

    return { success: true };
  }

  async updateAvatar(userId: string, imageUrl: string) {
    const [updatedUser] = await this.db
      .update(schema.users)
      .set({ image: imageUrl })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        image: schema.users.image,
      });

    return updatedUser;
  }
}
