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

  async sendNewDeviceLoginEmail(
    email: string,
    username: string,
    device: { ipAddress?: string | null; deviceOs?: string | null; deviceBrowser?: string | null },
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Readory - New device login',
        text: `Hi ${username}, a new login was detected from ${device.deviceBrowser || 'Unknown browser'} on ${device.deviceOs || 'Unknown OS'} (${device.ipAddress || 'unknown IP'}).`,
      });
    } catch (error) {
      return;
    }
  }
}
