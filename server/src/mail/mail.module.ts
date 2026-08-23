import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/adapters/ejs.adapter';
import * as fs from 'fs';
import { join } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const templateDirWithSrc = join(process.cwd(), 'dist', 'src', 'mail', 'templates');
        const templateDirWithoutSrc = join(process.cwd(), 'dist', 'mail', 'templates');

        const finalTemplateDir = fs.existsSync(templateDirWithSrc)
          ? templateDirWithSrc
          : templateDirWithoutSrc;

        return {
          transport: {
            host: config.get('MAIL_HOST'),
            port: Number(config.get('MAIL_PORT')),
            secure: config.get('MAIL_PORT') === '465',
            auth: {
              user: config.get('MAIL_USER'),
              pass: config.get('MAIL_PASSWORD'),
            },
          },
          defaults: {
            from: config.get('MAIL_FROM'),
          },
          template: {
            dir: finalTemplateDir,
            adapter: new EjsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
