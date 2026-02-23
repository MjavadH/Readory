import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    CreateBucketCommand,
    HeadBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type PutParams = {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
    cacheControl?: string;
};

@Injectable()
export class StorageService implements OnModuleInit {
    private readonly logger = new Logger(StorageService.name);
    private readonly bucket: string;
    private readonly autoCreateBucket: boolean;

    constructor(private readonly s3: S3Client, config: ConfigService) {
        const bucket = config.get<string>('S3_BUCKET_CHAPTERS');
        if (!bucket) throw new Error('S3_BUCKET_CHAPTERS is required');
        this.bucket = bucket;

        this.autoCreateBucket = (config.get<string>('S3_AUTO_CREATE_BUCKET') ?? 'false') === 'true';
    }

    async onModuleInit() {
        // Validate connection at boot (and optionally create bucket in dev)
        await this.ensureBucket();
    }

    private async ensureBucket() {
        try {
            await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
            this.logger.log(`S3 bucket OK: ${this.bucket}`);
        } catch (e) {
            if (!this.autoCreateBucket) {
                this.logger.error(`S3 bucket missing or not accessible: ${this.bucket}`);
                throw e;
            }
            this.logger.warn(`Creating S3 bucket: ${this.bucket}`);
            await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
            this.logger.log(`S3 bucket created: ${this.bucket}`);
        }
    }

    async putObject(params: PutParams) {
        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: params.key,
                Body: params.body,
                ContentType: params.contentType,
                CacheControl: params.cacheControl ?? 'private, max-age=60',
            }),
        );
        return { key: params.key };
    }

    async deleteObject(key: string) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        return { key, deleted: true };
    }

    async getSignedGetUrl(key: string, expiresSeconds = 60) {
        // Keep short TTL for anti-leak; caller must re-request.
        const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
        return getSignedUrl(this.s3, cmd, { expiresIn: Math.max(10, Math.min(300, expiresSeconds)) });
    }

    getBucketName() {
        return this.bucket;
    }
}