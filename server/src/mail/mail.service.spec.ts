import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

const FRONTEND_URL = 'https://readory.test';

describe('MailService', () => {
  let service: MailService;
  let mailerService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue(FRONTEND_URL) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailerService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendUserConfirmation', () => {
    it('sends the verification template with the recipient and OTP context', async () => {
      // Act
      await service.sendUserConfirmation('reader@test.com', 'reader', '123456');

      // Assert
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'reader@test.com',
        subject: 'Welcome to Readory - Confirm your Email',
        template: './verification',
        context: { username: 'reader', code: '123456' },
      });
    });

    it('translates a transport failure into a 500 without leaking the cause', async () => {
      // Arrange: SMTP errors can contain credentials or internal hostnames.
      mailerService.sendMail.mockRejectedValue(new Error('SMTP 535 auth failed'));

      // Act & Assert
      await expect(
        service.sendUserConfirmation('reader@test.com', 'reader', '123456'),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.sendUserConfirmation('reader@test.com', 'reader', '123456'),
      ).rejects.toThrow('Failed to send verification email');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('builds the reset URL from FRONTEND_URL and the token', async () => {
      // Act
      await service.sendPasswordResetEmail('reader@test.com', 'tok-123');

      // Assert
      expect(configService.get).toHaveBeenCalledWith('FRONTEND_URL');
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'reader@test.com',
        subject: 'Readory - Password Reset Request',
        template: './reset-password',
        context: { resetUrl: `${FRONTEND_URL}/reset-password?token=tok-123` },
      });
    });

    it('translates a transport failure into a 500', async () => {
      // Arrange
      mailerService.sendMail.mockRejectedValue(new Error('connection refused'));

      // Act & Assert
      await expect(service.sendPasswordResetEmail('reader@test.com', 'tok')).rejects.toThrow(
        'Failed to send password reset email',
      );
    });
  });

  describe('sendNewDeviceLoginEmail', () => {
    it('describes the device in the alert body', async () => {
      // Act
      await service.sendNewDeviceLoginEmail('reader@test.com', 'reader', {
        ipAddress: '203.0.113.5',
        deviceOs: 'Linux',
        deviceBrowser: 'Firefox',
      });

      // Assert
      const [[payload]] = mailerService.sendMail.mock.calls;
      expect(payload.to).toBe('reader@test.com');
      expect(payload.subject).toBe('Readory - New device login');
      expect(payload.text).toContain('reader');
      expect(payload.text).toContain('Firefox');
      expect(payload.text).toContain('Linux');
      expect(payload.text).toContain('203.0.113.5');
    });

    it.each([
      [{}, ['Unknown browser', 'Unknown OS', 'unknown IP']],
      [{ deviceOs: 'macOS' }, ['Unknown browser', 'macOS', 'unknown IP']],
      [{ ipAddress: null, deviceOs: null, deviceBrowser: null }, ['Unknown browser', 'Unknown OS']],
    ])('substitutes placeholders for missing device fields (%j)', async (device, expected) => {
      // Act
      await service.sendNewDeviceLoginEmail('reader@test.com', 'reader', device);

      // Assert
      const [[payload]] = mailerService.sendMail.mock.calls;
      for (const fragment of expected) {
        expect(payload.text).toContain(fragment);
      }
    });

    it('swallows transport failures because the alert is advisory', async () => {
      // Arrange
      mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      // Act & Assert: unlike the other two methods this must NOT throw — a
      // failed notification must never block an otherwise valid login.
      await expect(
        service.sendNewDeviceLoginEmail('reader@test.com', 'reader', {}),
      ).resolves.toBeUndefined();
    });
  });
});
