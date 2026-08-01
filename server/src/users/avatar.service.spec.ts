import { BadRequestException, ConflictException } from '@nestjs/common';
import sharp from 'sharp';
import { AvatarService } from './avatar.service';

const prisma = {
    user: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
    },
};
const storage = {
    putObject: jest.fn(),
    deleteKeys: jest.fn(),
};
const cache = { del: jest.fn() };

const file = (buffer: Buffer, overrides: Partial<Express.Multer.File> = {}) =>
    ({ buffer, size: buffer.length, originalname: 'avatar.jpg', mimetype: 'image/jpeg', ...overrides }) as Express.Multer.File;

describe('AvatarService', () => {
    let service: AvatarService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AvatarService(prisma as any, storage as any, cache as any);
        storage.deleteKeys.mockResolvedValue(1);
        storage.putObject.mockResolvedValue({});
    });

    it('accepts a valid 1024x1024 JPEG and converts it to WebP', async () => {
        const input = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#fff' } }).jpeg().toBuffer();
        const result = await service.processAvatar(file(input));
        const metadata = await sharp(result.buffer).metadata();
        expect(result.contentType).toBe('image/webp');
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBe(512);
        expect(metadata.height).toBe(512);
        expect(metadata.exif).toBeUndefined();
    });

    it('rejects PNG, corrupted, oversized, and too-large-dimension uploads', async () => {
        const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
        await expect(service.processAvatar(file(png))).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.processAvatar(file(Buffer.from('not an image')))).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.processAvatar(file(Buffer.alloc(5 * 1024 * 1024)))).rejects.toBeInstanceOf(BadRequestException);
        const large = await sharp({ create: { width: 1025, height: 10, channels: 3, background: '#fff' } }).jpeg().toBuffer();
        await expect(service.processAvatar(file(large))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces the avatar safely and deletes only the exact previous key', async () => {
        jest.spyOn(service, 'processAvatar').mockResolvedValue({ buffer: Buffer.from('webp'), contentType: 'image/webp' });
        prisma.user.findUnique.mockResolvedValue({ id: 7, email: 'a@b.c', username: 'reader', avatarKey: 'media/avatar/7/11111111-1111-4111-8111-111111111111.webp', updatedAt: new Date() });
        prisma.user.updateMany.mockResolvedValue({ count: 1 });
        const result = await service.replaceAvatar(7, file(Buffer.from('x')));
        expect(storage.putObject.mock.calls[0][0].key).toMatch(/^media\/avatar\/7\/[0-9a-f-]{36}\.webp$/);
        expect(cache.del).toHaveBeenCalledWith('session:user:7');
        expect(storage.deleteKeys).toHaveBeenCalledWith(['media/avatar/7/11111111-1111-4111-8111-111111111111.webp']);
        expect(result.user.avatarKey).toMatch(/^media\/avatar\/7\/[0-9a-f-]{36}\.webp$/);
        expect((result.user as any).avatarUrl).toBeUndefined();
    });

    it('cleans up the new object and preserves the old avatar on concurrent update', async () => {
        jest.spyOn(service, 'processAvatar').mockResolvedValue({ buffer: Buffer.from('webp'), contentType: 'image/webp' });
        prisma.user.findUnique.mockResolvedValue({ id: 7, email: 'a@b.c', username: 'reader', avatarKey: null, updatedAt: new Date() });
        prisma.user.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.replaceAvatar(7, file(Buffer.from('x')))).rejects.toBeInstanceOf(ConflictException);
        const newKey = storage.putObject.mock.calls[0][0].key;
        expect(storage.deleteKeys).toHaveBeenCalledWith([newKey]);
    });
});
