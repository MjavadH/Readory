import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
    imports: [ConfigModule],
    controllers: [StorageController],
    providers: [
        {
            provide: S3Client,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const endpoint = config.get<string>('S3_ENDPOINT');
                const region = config.get<string>('S3_REGION') ?? 'us-east-1';
                const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
                const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
                const forcePathStyle = (config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true') === 'true';
                if (!endpoint || !accessKeyId || !secretAccessKey) {
                    throw new Error('Missing S3 configuration env vars');
                }
                return new S3Client({
                    region,
                    endpoint,
                    forcePathStyle,
                    credentials: { accessKeyId, secretAccessKey },
                });
            },
        },
      StorageService
    ],
    exports: [StorageService],
})
export class StorageModule {}
