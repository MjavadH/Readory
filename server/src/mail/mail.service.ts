import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

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
}
