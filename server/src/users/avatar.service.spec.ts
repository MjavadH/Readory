import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import {
  asCacheManager,
  asPrismaService,
  asStorageService,
  createMockCacheManager,
  createMockPrismaService,
  createMockStorageService,
  type MockCacheManager,
  type MockPrismaService,
  type MockStorageService,
} from '../../test/mocks';
import { AvatarService } from './avatar.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;
const EXISTING_KEY = 'media/avatar/7/11111111-1111-4111-8111-111111111111.webp';
const NEW_KEY_PATTERN = /^media\/avatar\/7\/[0-9a-f-]{36}\.webp$/;

/** Builds a Multer file wrapper around a real image buffer. */
const asUpload = (buffer: Buffer, overrides: Partial<Express.Multer.File> = {}) =>
  ({
    buffer,
    size: buffer.length,
    originalname: 'avatar.jpg',
    mimetype: 'image/jpeg',
    ...overrides,
  }) as Express.Multer.File;

/** Generates a genuine encoded image so `file-type` sniffs real magic bytes. */
const makeImage = (
  format: 'jpeg' | 'png' | 'webp' | 'gif',
  width = 1024,
  height = 1024,
): Promise<Buffer> => {
  const base = sharp({ create: { width, height, channels: 3, background: '#ffffff' } });
  return format === 'jpeg'
    ? base.jpeg().toBuffer()
    : format === 'png'
      ? base.png().toBuffer()
      : format === 'webp'
        ? base.webp().toBuffer()
        : base.gif().toBuffer();
};

describe('AvatarService', () => {
  let service: AvatarService;
  let prisma: MockPrismaService;
  let storage: MockStorageService;
  let cacheManager: MockCacheManager;

  beforeEach(() => {
    prisma = createMockPrismaService();
    storage = createMockStorageService();
    cacheManager = createMockCacheManager();
    service = new AvatarService(
      asPrismaService(prisma),
      asStorageService(storage),
      asCacheManager(cacheManager),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processAvatar', () => {
    it.each(['jpeg', 'png', 'webp'] as const)(
      'accepts a real %s upload and normalises it to 512x512 WebP',
      async (format) => {
        // Arrange
        const input = await makeImage(format);

        // Act
        const result = await service.processAvatar(asUpload(input));

        // Assert
        const metadata = await sharp(result.buffer).metadata();
        expect(result.contentType).toBe('image/webp');
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBe(AVATAR_SIZE);
        expect(metadata.height).toBe(AVATAR_SIZE);
        // Re-encoding must strip EXIF, which can carry GPS/PII.
        expect(metadata.exif).toBeUndefined();
      },
    );

    it('rejects a real image whose format is not allow-listed', async () => {
      // Arrange: GIF is a valid image but deliberately unsupported.
      const gif = await makeImage('gif', 64, 64);

      // Act & Assert
      await expect(service.processAvatar(asUpload(gif))).rejects.toThrow(BadRequestException);
    });

    it('rejects a payload that is not an image regardless of its declared mimetype', async () => {
      // Arrange: a lying `mimetype` must not defeat magic-byte sniffing.
      const upload = asUpload(Buffer.from('not an image'), { mimetype: 'image/jpeg' });

      // Act & Assert
      await expect(service.processAvatar(upload)).rejects.toThrow(
        'Only actual JPG/JPEG, PNG, or WebP images are allowed',
      );
    });

    it('rejects an upload at or above the 5 MB limit', async () => {
      // Act & Assert: the guard is `>=`, so exactly 5 MB is refused.
      await expect(
        service.processAvatar(asUpload(Buffer.alloc(MAX_AVATAR_BYTES))),
      ).rejects.toThrow('Avatar must be smaller than 5 MB');
    });

    it('rejects an upload whose declared size exceeds the limit even if the buffer is small', async () => {
      // Arrange: a spoofed `size` field must still be honoured by the guard.
      const jpeg = await makeImage('jpeg', 32, 32);

      // Act & Assert
      await expect(
        service.processAvatar(asUpload(jpeg, { size: MAX_AVATAR_BYTES + 1 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a request with no file attached', async () => {
      // Act & Assert
      await expect(service.processAvatar(undefined)).rejects.toThrow(
        'Exactly one avatar image is required',
      );
    });

    it('rejects a file object carrying no buffer', async () => {
      // Act & Assert
      await expect(
        service.processAvatar({ size: 10 } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not enlarge an image smaller than the target size', async () => {
      // Arrange
      const small = await makeImage('jpeg', 100, 100);

      // Act
      const result = await service.processAvatar(asUpload(small));

      // Assert: `withoutEnlargement` keeps the original dimensions.
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });

    it('cover-crops a wide image to the target width', async () => {
      // Arrange: 1025px wide, which exercises the resize path.
      const wide = await makeImage('jpeg', 1025, 10);

      // Act
      const result = await service.processAvatar(asUpload(wide));

      // Assert: width is reduced to 512; height stays below the target because
      // `withoutEnlargement` prevents upscaling the 10px axis.
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(AVATAR_SIZE);
      expect(metadata.height).toBe(10);
    });
  });

  describe('storeProcessedAvatar', () => {
    it('uploads the processed image under an immutable-cache key', async () => {
      // Arrange
      const jpeg = await makeImage('jpeg', 64, 64);

      // Act
      const key = await service.storeProcessedAvatar(7, jpeg);

      // Assert
      expect(key).toMatch(NEW_KEY_PATTERN);
      expect(storage.putObject).toHaveBeenCalledWith({
        key,
        body: expect.any(Buffer),
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      });
    });
  });

  describe('replaceAvatar', () => {
    /** Stubs image processing so these tests focus on the storage/DB workflow. */
    const stubProcessing = () =>
      jest
        .spyOn(service, 'processAvatar')
        .mockResolvedValue({ buffer: Buffer.from('webp'), contentType: 'image/webp' });

    const existingUser = (avatarKey: string | null) => ({
      id: 7,
      email: 'reader@test.com',
      username: 'reader',
      avatarKey,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    it('uploads the new object, updates the row, busts caches and deletes the old key', async () => {
      // Arrange
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser(EXISTING_KEY));
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.replaceAvatar(7, asUpload(Buffer.from('x')));

      // Assert
      const uploadedKey = storage.putObject.mock.calls[0][0].key;
      expect(uploadedKey).toMatch(NEW_KEY_PATTERN);
      // Compare-and-swap on the previous key guards against lost updates.
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 7, avatarKey: EXISTING_KEY },
        data: { avatarKey: uploadedKey },
      });
      expect(cacheManager.del).toHaveBeenCalledWith('session:user:7');
      expect(cacheManager.bumpVersion).toHaveBeenCalledWith('public_profile:version:7');
      // Only the exact previous key may be removed.
      expect(storage.deleteKeys).toHaveBeenCalledWith([EXISTING_KEY]);
      expect(result.user.avatarKey).toBe(uploadedKey);
    });

    it('does not attempt a delete when the user had no previous avatar', async () => {
      // Arrange
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser(null));
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.replaceAvatar(7, asUpload(Buffer.from('x')));

      // Assert
      expect(storage.deleteKeys).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user without uploading', async () => {
      // Arrange
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.replaceAvatar(7, asUpload(Buffer.from('x')))).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('refuses to proceed when the stored key is untrusted', async () => {
      // Arrange: a tampered key could be used to target arbitrary objects.
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser('../../etc/passwd'));

      // Act & Assert: the guard runs before the upload block, so the specific
      // 500 surfaces rather than the generic "Failed to update avatar" wrapper.
      await expect(service.replaceAvatar(7, asUpload(Buffer.from('x')))).rejects.toThrow(
        'Invalid stored avatar key',
      );
      // Critically, the malicious key must never reach the storage layer, and
      // no orphan object should be created.
      expect(storage.deleteKeys).not.toHaveBeenCalled();
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('cleans up the orphaned upload and keeps the old avatar on a concurrent write', async () => {
      // Arrange: updateMany matching 0 rows means someone else changed it first.
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser(null));
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      // Act & Assert
      await expect(service.replaceAvatar(7, asUpload(Buffer.from('x')))).rejects.toThrow(
        ConflictException,
      );
      const orphanKey = storage.putObject.mock.calls[0][0].key;
      expect(storage.deleteKeys).toHaveBeenCalledWith([orphanKey]);
    });

    it('propagates a BadRequestException from processing without touching storage', async () => {
      // Arrange
      jest
        .spyOn(service, 'processAvatar')
        .mockRejectedValue(new BadRequestException('Invalid image dimensions'));

      // Act & Assert: the original 400 must not be masked as a 500.
      await expect(service.replaceAvatar(7, asUpload(Buffer.from('x')))).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('still surfaces the conflict when orphan cleanup itself fails', async () => {
      // Arrange
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser(null));
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      storage.deleteKeys.mockRejectedValue(new Error('S3 unavailable'));

      // Act & Assert: a best-effort cleanup failure must not hide the conflict.
      await expect(service.replaceAvatar(7, asUpload(Buffer.from('x')))).rejects.toThrow(
        ConflictException,
      );
    });

    it('succeeds even if deleting the previous avatar fails', async () => {
      // Arrange
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser(EXISTING_KEY));
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      storage.deleteKeys.mockRejectedValue(new Error('S3 unavailable'));

      // Act
      const result = await service.replaceAvatar(7, asUpload(Buffer.from('x')));

      // Assert: the user's avatar is already updated, so a stale leftover
      // object must not fail the request.
      expect(result.success).toBe(true);
    });

    it('wraps an unexpected database error as a 500 and removes the upload', async () => {
      // Arrange
      stubProcessing();
      prisma.user.findUnique.mockResolvedValue(existingUser(null));
      prisma.user.updateMany.mockRejectedValue(new Error('connection reset'));

      // Act & Assert
      await expect(service.replaceAvatar(7, asUpload(Buffer.from('x')))).rejects.toThrow(
        'Failed to update avatar',
      );
      const orphanKey = storage.putObject.mock.calls[0][0].key;
      expect(storage.deleteKeys).toHaveBeenCalledWith([orphanKey]);
    });
  });
});
