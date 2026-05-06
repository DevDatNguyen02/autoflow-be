import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserWelcome(name: string, email: string, tempPassword: string) {
    const url = process.env.FRONTEND_URL || 'http://localhost:3000/login';

    await this.mailerService.sendMail({
      to: email,
      // from: '"AutoFlow Team" <support@autoflow.com>', // Override default from
      subject: 'Chào mừng bạn đến với AutoFlow - Thông tin tài khoản mới',
      template: './welcome', // `.hbs` extension is appended automatically
      context: {
        name: name,
        email: email,
        password: tempPassword,
        url: url,
      },
    });
  }
}
