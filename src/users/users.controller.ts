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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService, UserRole } from './users.service';
import { AuditService } from '../audit/audit.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
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
