import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  // NextAuth v5 specific fields
  jti?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error('AUTH_SECRET or NEXTAUTH_SECRET environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    if (!payload) {
      throw new UnauthorizedException('Token không hợp lệ.');
    }

    return {
      id: payload.sub || payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'agent', // Mặc định agent nếu không có role
    };
  }
}
