import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.NEXTAUTH_SECRET || 'dev-secret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, MfaService],
  exports: [AuthService, MfaService, JwtModule],
})
export class AuthModule {}
