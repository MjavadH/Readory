import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  // Sends OTP for account verification
  async sendUserConfirmation(email: string, username: string, code: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to Readory - Confirm your Email',
        template: './verification',
        context: { username, code },
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

      await this.mailerService.sendMail({
        to: email,
        subject: 'Readory - Password Reset Request',
        template: './reset-password',
        context: { resetUrl },
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to send password reset email');
    }
  }
}
