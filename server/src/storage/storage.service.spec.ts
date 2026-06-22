import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let s3Send: jest.Mock;

  beforeEach(async () => {
    s3Send = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: S3Client,
          useValue: { send: s3Send },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'S3_BUCKET_CHAPTERS') return 'test-bucket';
              if (key === 'S3_AUTO_CREATE_BUCKET') return 'false';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('throws when S3_BUCKET_CHAPTERS is not set', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            StorageService,
            { provide: S3Client, useValue: { send: jest.fn() } },
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
          ],
        }).compile(),
      ).rejects.toThrow('S3_BUCKET_CHAPTERS is required');
    });
  });

  describe('onModuleInit / ensureBucket', () => {
    it('succeeds when bucket exists', async () => {
      s3Send.mockResolvedValue({});
      await service.onModuleInit();
      expect(s3Send).toHaveBeenCalledTimes(1);
    });

    it('throws when bucket missing and autoCreate is false', async () => {
      s3Send.mockRejectedValue(new Error('bucket not found'));
      await expect(service.onModuleInit()).rejects.toThrow('bucket not found');
    });

    it('creates bucket when autoCreate is true', async () => {
      const module = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: S3Client, useValue: { send: s3Send } },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'S3_BUCKET_CHAPTERS') return 'auto-bucket';
                if (key === 'S3_AUTO_CREATE_BUCKET') return 'true';
                return undefined;
              }),
            },
          },
        ],
      }).compile();
      const autoService = module.get<StorageService>(StorageService);

      s3Send.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce({});

      await autoService.onModuleInit();

      expect(s3Send).toHaveBeenCalledTimes(2);
    });
  });

  describe('putObject', () => {
    it('uploads object to S3', async () => {
      s3Send.mockResolvedValue({});

      const result = await service.putObject({
        key: 'test/file.json',
        body: Buffer.from('data'),
        contentType: 'application/json',
      });

      expect(result).toEqual({ key: 'test/file.json' });
      expect(s3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'test/file.json',
            ContentType: 'application/json',
          }),
        }),
      );
    });

    it('uses custom cacheControl', async () => {
      s3Send.mockResolvedValue({});
      await service.putObject({
        key: 'k',
        body: Buffer.from(''),
        contentType: 'text/plain',
        cacheControl: 'no-store',
      });

      expect(s3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ CacheControl: 'no-store' }),
        }),
      );
    });
  });

  describe('putJson', () => {
    it('stores JSON with correct content type', async () => {
      s3Send.mockResolvedValue({});
      await service.putJson('path/data.json', { foo: 'bar' });
      expect(s3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/json; charset=utf-8',
            CacheControl: 'private, no-store, max-age=0',
          }),
        }),
      );
    });
  });

  describe('putBuffer', () => {
    it('stores buffer with correct content type', async () => {
      s3Send.mockResolvedValue({});
      await service.putBuffer('img.png', Buffer.from('pixels'), 'image/png');
      expect(s3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'image/png',
          }),
        }),
      );
    });
  });

  describe('getObjectBuffer', () => {
    it('returns buffer from readable stream', async () => {
      const readable = Readable.from([Buffer.from('hello'), Buffer.from(' world')]);
      s3Send.mockResolvedValue({ Body: readable });

      const buf = await service.getObjectBuffer('key');

      expect(buf.toString()).toBe('hello world');
    });

    it('throws when body is missing', async () => {
      s3Send.mockResolvedValue({ Body: null });
      await expect(service.getObjectBuffer('key')).rejects.toThrow('Failed to read object body');
    });
  });

  describe('getObjectStream', () => {
    it('returns readable stream', async () => {
      const readable = Readable.from(['data']);
      s3Send.mockResolvedValue({ Body: readable });

      const stream = await service.getObjectStream('key');

      expect(stream).toBe(readable);
    });

    it('throws when body is not readable', async () => {
      s3Send.mockResolvedValue({ Body: 'not-readable' });
      await expect(service.getObjectStream('key')).rejects.toThrow('Failed to read object stream');
    });
  });

  describe('headObject', () => {
    it('sends HeadObjectCommand', async () => {
      s3Send.mockResolvedValue({ ContentLength: 100 });
      const result = await service.headObject('some/key');
      expect(result).toEqual({ ContentLength: 100 });
    });
  });

  describe('listPrefix', () => {
    it('returns all keys across pagination', async () => {
      s3Send
        .mockResolvedValueOnce({
          IsTruncated: true,
          NextContinuationToken: 'token2',
          Contents: [{ Key: 'a' }, { Key: 'b' }],
        })
        .mockResolvedValueOnce({
          IsTruncated: false,
          Contents: [{ Key: 'c' }],
        });

      const keys = await service.listPrefix('prefix/');

      expect(keys).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array when no contents', async () => {
      s3Send.mockResolvedValue({ IsTruncated: false, Contents: undefined });
      const keys = await service.listPrefix('empty/');
      expect(keys).toEqual([]);
    });
  });

  describe('deletePrefix', () => {
    it('returns 0 when no keys to delete', async () => {
      s3Send.mockResolvedValue({ IsTruncated: false, Contents: undefined });
      const count = await service.deletePrefix('empty/');
      expect(count).toBe(0);
    });

    it('deletes all keys under prefix', async () => {
      s3Send
        .mockResolvedValueOnce({ IsTruncated: false, Contents: [{ Key: 'prefix/a' }, { Key: 'prefix/b' }] })
        .mockResolvedValueOnce({ Deleted: [{ Key: 'prefix/a' }, { Key: 'prefix/b' }] });

      const count = await service.deletePrefix('prefix');

      expect(count).toBe(2);
    });

    it('throws on partial delete failure', async () => {
      s3Send
        .mockResolvedValueOnce({ IsTruncated: false, Contents: [{ Key: 'a' }] })
        .mockResolvedValueOnce({ Errors: [{ Key: 'a', Code: 'AccessDenied' }] });

      await expect(service.deletePrefix('test/')).rejects.toThrow('S3 partial delete failure');
    });
  });

  describe('deleteKeys', () => {
    it('returns 0 for empty keys', async () => {
      const count = await service.deleteKeys([]);
      expect(count).toBe(0);
    });

    it('returns 0 for only falsy keys', async () => {
      const count = await service.deleteKeys(['', '']);
      expect(count).toBe(0);
    });

    it('deduplicates keys', async () => {
      s3Send.mockResolvedValue({ Deleted: [{ Key: 'a' }] });
      const count = await service.deleteKeys(['a', 'a', 'a']);
      expect(count).toBe(1);
    });

    it('throws on partial failure', async () => {
      s3Send.mockResolvedValue({ Errors: [{ Key: 'a', Code: 'Err' }] });
      await expect(service.deleteKeys(['a'])).rejects.toThrow('S3 partial delete failure');
    });
  });

  describe('getBucketName', () => {
    it('returns the bucket name', () => {
      expect(service.getBucketName()).toBe('test-bucket');
    });
  });
});
