import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib');

@Injectable()
export class MfaService {
  private readonly APP_NAME = 'AutoFlow Enterprise';

  /**
   * Tạo secret key mới cho TOTP
   */
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /**
   * Tạo URI otpauth:// và chuyển thành QR code (base64 Data URL)
   */
  async generateQrCode(email: string, secret: string): Promise<string> {
    const otpAuthUri = authenticator.keyuri(email, this.APP_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUri);
    return qrCodeDataUrl;
  }

  /**
   * Kiểm tra mã TOTP 6 số từ Authenticator App
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }

  /**
   * Tạo 10 mã khôi phục dạng hex ngẫu nhiên
   * Trả về object: { plain: string[] (hiển thị 1 lần), hashed: string[] (lưu DB) }
   */
  generateRecoveryCodes(): { plain: string[]; hashed: string[] } {
    const plain: string[] = [];
    const hashed: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(5).toString('hex').toUpperCase(); // VD: "A3F2E1B4C5"
      plain.push(code);
      hashed.push(
        crypto.createHash('sha256').update(code).digest('hex'),
      );
    }

    return { plain, hashed };
  }

  /**
   * Kiểm tra mã khôi phục (so sánh với danh sách đã hash trong DB)
   */
  verifyRecoveryCode(
    inputCode: string,
    hashedCodes: string[],
  ): { valid: boolean; remainingCodes: string[] } {
    const inputHashed = crypto
      .createHash('sha256')
      .update(inputCode.toUpperCase())
      .digest('hex');

    const foundIndex = hashedCodes.indexOf(inputHashed);
    if (foundIndex === -1) {
      return { valid: false, remainingCodes: hashedCodes };
    }

    // Xóa mã đã dùng
    const remainingCodes = [...hashedCodes];
    remainingCodes.splice(foundIndex, 1);
    return { valid: true, remainingCodes };
  }
}
