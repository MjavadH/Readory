import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command, PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

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
  private readonly publicBaseUrl?: string;

  constructor(
    private readonly s3: S3Client,
    config: ConfigService,
  ) {
    const bucket = config.get<string>('S3_BUCKET_NAME');
    if (!bucket) throw new Error('S3_BUCKET_NAME is required');
    this.bucket = bucket;

    this.autoCreateBucket =
      (config.get<string>('S3_AUTO_CREATE_BUCKET') ?? 'false') === 'true';
    const publicBaseUrl = config.get<string>('S3_PUBLIC_BASE_URL')?.trim();
    this.publicBaseUrl = publicBaseUrl ? publicBaseUrl.replace(/\/+$/, '') : undefined;
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket OK: ${this.bucket}`);
    } catch (e) {
      if (!this.autoCreateBucket) {
        this.logger.error(
          `S3 bucket missing or not accessible: ${this.bucket}`,
        );
        throw e;
      }
      this.logger.warn(`Creating S3 bucket: ${this.bucket}`);
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));

      const publicReadPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            // Restrict public access to media directory
            Resource: [`arn:aws:s3:::${this.bucket}/media/*`],
          },
        ],
      };
      await this.s3.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucket,
            Policy: JSON.stringify(publicReadPolicy),
          })
      );

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

  async putJson(key: string, obj: unknown): Promise<void> {
    await this.putObject({
      key,
      body: Buffer.from(JSON.stringify(obj), 'utf8'),
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'private, no-store, max-age=0',
    });
  }

  async putBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.putObject({
      key,
      body: buffer,
      contentType,
      cacheControl: 'private, max-age=60',
    });
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const out = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = out.Body;
    if (!body || !(body instanceof Readable)) {
      throw new Error('Failed to read object body');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getObjectStream(key: string): Promise<Readable> {
    const out = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = out.Body;
    if (!body || !(body instanceof Readable)) {
      throw new Error('Failed to read object stream');
    }
    return body;
  }

  async headObject(key: string) {
    return this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async listPrefix(prefix: string): Promise<string[]> {
    let token: string | undefined;
    const keys: string[] = [];

    do {
      const out = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
      (out.Contents ?? []).forEach((item) => {
        if (item.Key) {
          keys.push(item.Key);
        }
      });
    } while (token);

    return keys;
  }

  async deletePrefix(prefix: string): Promise<number> {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const keys = await this.listPrefix(normalizedPrefix);
    if (keys.length === 0) return 0;

    let deleted = 0;
    for (let idx = 0; idx < keys.length; idx += 1000) {
      const batch = keys.slice(idx, idx + 1000);

      const out = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((k) => ({ Key: k })) },
          }),
      );

      if (out.Errors && out.Errors.length > 0) {
        this.logger.error(
            `Partial delete failure in deletePrefix(${normalizedPrefix}): ${out.Errors
                .map((e) => `${e.Key}:${e.Code}`)
                .join(', ')}`,
        );
        throw new Error('S3 partial delete failure');
      }

      deleted += out.Deleted?.length ?? 0;
    }

    return deleted;
  }

  async deleteKeys(keys: string[]): Promise<number> {
    const valid = [...new Set(keys.filter(Boolean))];
    if (valid.length === 0) return 0;

    let deleted = 0;
    for (let i = 0; i < valid.length; i += 1000) {
      const batch = valid.slice(i, i + 1000);

      const out = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })) },
          }),
      );

      if (out.Errors && out.Errors.length > 0) {
        this.logger.error(
            `Partial delete failure in deleteKeys(): ${out.Errors
                .map((e) => `${e.Key}:${e.Code}`)
                .join(', ')}`,
        );
        throw new Error('S3 partial delete failure');
      }

      deleted += out.Deleted?.length ?? 0;
    }

    return deleted;
  }

  getPublicUrl(key: string) {
    if (!this.publicBaseUrl) return null;
    return `${this.publicBaseUrl}/${key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;
  }

  getBucketName() {
    return this.bucket;
  }
}
