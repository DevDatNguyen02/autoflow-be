import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService, UserRole } from './users.service';
import { AuditService } from '../audit/audit.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

@Controller('api/v1/users')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('profile')
  async getProfile(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found in session');
    
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Không trả về password
    const { password, mfaSecret, ...profile } = user;
    return { data: profile };
  }

  @Patch('profile')
  async updateProfile(
    @Body() body: { name?: string; email?: string },
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found in session');

    const result = await this.usersService.updateProfile(userId, body);
    
    await this.auditService.logAction({
      userId: userId,
      action: 'profile_updated',
      resource: 'user',
      resourceId: userId,
      metadata: { ...body },
    });

    return { data: result };
  }

  @Patch('profile/password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found in session');

    await this.usersService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );

    await this.auditService.logAction({
      userId: userId,
      action: 'password_changed',
      resource: 'user',
      resourceId: userId,
    });

    return { message: 'Mật khẩu đã được thay đổi thành công.' };
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/avatars';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `avatar-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(new Error('Chỉ cho phép file ảnh!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
    }),
  )
  async uploadAvatar(@Req() req: AuthRequest, @UploadedFile() file: Express.Multer.File) {
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found in session');
    if (!file) throw new NotFoundException('Không tìm thấy file tải lên');

    // Tạo URL để truy cập file (prefix đã config ở main.ts)
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    
    const result = await this.usersService.updateAvatar(userId, avatarUrl);
    
    await this.auditService.logAction({
      userId: userId,
      action: 'profile_updated',
      resource: 'user',
      resourceId: userId,
      metadata: { avatar: avatarUrl },
    });

    return { data: result };
  }

  @Get()
  @Permissions('user:read')
  async listUsers() {
    const users = await this.usersService.findAll();
    return { data: users };
  }

  @Post()
  @Permissions('user:create')
  async createUser(
    @Body() body: { name: string; email: string; role: UserRole },
    @Req() req: AuthRequest,
  ) {
    const result = await this.usersService.createUser(body);
    await this.auditService.logAction({
      userId: req.user?.id,
      action: 'user_created',
      resource: 'user',
      resourceId: result.id,
      metadata: { email: result.email, role: result.role },
    });
    return { data: result };
  }

  @Patch(':id/role')
  @Permissions('user:update')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { role: UserRole },
    @Req() req: AuthRequest,
  ) {
    const result = await this.usersService.updateRole(id, body.role);
    await this.auditService.logAction({
      userId: req.user?.id,
      action: 'role_changed',
      resource: 'user',
      resourceId: id,
      metadata: { oldRole: result.oldRole, newRole: result.newRole },
    });
    return { data: result };
  }

  @Delete(':id')
  @Permissions('user:delete')
  async deleteUser(@Param('id') id: string, @Req() req: AuthRequest) {
    const result = await this.usersService.deleteUser(id);
    await this.auditService.logAction({
      userId: req.user?.id,
      action: 'user_deleted',
      resource: 'user',
      resourceId: id,
    });
    return result;
  }
}
