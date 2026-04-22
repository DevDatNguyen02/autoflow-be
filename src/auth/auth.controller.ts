import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuditService } from '../audit/audit.service';
import { JwtService } from '@nestjs/jwt';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';


interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; name?: string; role: string };
}

// Cache tạm thời lưu secret chờ xác nhận MFA setup (production nên dùng Redis)
const pendingMfaSecrets = new Map<string, string>();

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * POST /api/v1/auth/login
   * Bước 1: Xác thực password → nếu MFA bật thì yêu cầu OTP
   */
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
  ) {
    const { email, password } = body;
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      await this.auditService.logAction({
        action: 'login_failed',
        resource: 'auth',
        metadata: { email, ip: req.ip },
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    if (user.mfaEnabled) {
      // Trả về token tạm thời, chỉ dùng để xác thực MFA
      const pendingToken = this.jwtService.sign(
        { sub: user.id, pending_mfa: true },
        { expiresIn: '5m' },
      );
      return { status: 'MFA_REQUIRED', pendingToken };
    }

    // Không có MFA → cấp token chính thức
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await this.auditService.logAction({
      userId: user.id,
      action: 'login',
      resource: 'auth',
      metadata: { ip: req.ip },
    });

    return { status: 'SUCCESS', accessToken };
  }

  /**
   * POST /api/v1/auth/mfa/verify-login
   * Bước 2: Xác thực OTP sau khi login
   */
  @Post('mfa/verify-login')
  async verifyMfaLogin(
    @Body() body: { pendingToken: string; otp: string },
    @Req() req: Request,
  ) {
    let payload: { sub: string; pending_mfa: boolean };
    try {
      payload = this.jwtService.verify(body.pendingToken) as typeof payload;
    } catch {
      throw new UnauthorizedException('Token hết hạn hoặc không hợp lệ.');
    }

    if (!payload.pending_mfa) {
      throw new UnauthorizedException('Token không hợp lệ.');
    }

    const user = await this.authService.getUserById(payload.sub);
    if (!user || !user.mfaSecret) {
      throw new UnauthorizedException('Không tìm thấy người dùng.');
    }

    const isValid = this.mfaService.verifyToken(body.otp, user.mfaSecret);
    if (!isValid) {
      throw new UnauthorizedException('Mã OTP không đúng hoặc đã hết hạn.');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await this.auditService.logAction({
      userId: user.id,
      action: 'login',
      resource: 'auth',
      metadata: { ip: req.ip, mfa: true },
    });

    return { status: 'SUCCESS', accessToken };
  }

  /**
   * POST /api/v1/auth/mfa/setup
   * Khởi tạo setup MFA: trả về QR code
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/setup')
  async setupMfa(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    const email = req.user?.email;
    if (!userId || !email) throw new UnauthorizedException();

    const secret = this.mfaService.generateSecret();
    pendingMfaSecrets.set(userId, secret); // Lưu tạm

    const qrCodeDataUrl = await this.mfaService.generateQrCode(email, secret);

    return {
      secret,
      qrCode: qrCodeDataUrl,
      message: 'Quét mã QR bằng ứng dụng Google Authenticator rồi nhập mã xác nhận.',
    };
  }

  /**
   * POST /api/v1/auth/mfa/confirm
   * Xác nhận setup MFA bằng OTP đầu tiên → lưu vào DB
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/confirm')
  async confirmMfa(
    @Body() body: { otp: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();

    const secret = pendingMfaSecrets.get(userId);
    if (!secret) {
      throw new BadRequestException('Phiên setup MFA đã hết hạn. Hãy thử lại.');
    }

    const isValid = this.mfaService.verifyToken(body.otp, secret);
    if (!isValid) {
      throw new BadRequestException('Mã OTP không đúng. Hãy thử lại.');
    }

    const { plain, hashed } = this.mfaService.generateRecoveryCodes();

    await this.db
      .update(schema.users)
      .set({
        mfaSecret: secret,
        mfaEnabled: 'true',
        mfaRecoveryCodes: hashed,
      })
      .where(eq(schema.users.id, userId));

    pendingMfaSecrets.delete(userId);

    await this.auditService.logAction({
      userId,
      action: 'mfa_enabled',
      resource: 'user',
      resourceId: userId,
    });

    return {
      success: true,
      recoveryCodes: plain,
      message: 'MFA đã được bật. Lưu lại 10 mã khôi phục ở nơi an toàn!',
    };
  }

  /**
   * POST /api/v1/auth/mfa/disable
   * Tắt MFA (yêu cầu OTP hiện tại để xác nhận)
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/disable')
  async disableMfa(
    @Body() body: { otp: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();

    const user = await this.authService.getUserById(userId);
    if (!user?.mfaSecret) {
      throw new BadRequestException('MFA chưa được bật.');
    }

    const isValid = this.mfaService.verifyToken(body.otp, user.mfaSecret);
    if (!isValid) {
      throw new UnauthorizedException('Mã OTP không đúng.');
    }

    await this.db
      .update(schema.users)
      .set({ mfaEnabled: 'false', mfaSecret: null, mfaRecoveryCodes: null })
      .where(eq(schema.users.id, userId));

    await this.auditService.logAction({
      userId,
      action: 'mfa_disabled',
      resource: 'user',
      resourceId: userId,
    });

    return { success: true, message: 'MFA đã được tắt.' };
  }
}
