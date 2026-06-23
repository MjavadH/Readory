import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
    Post,
    Query,
    UseGuards,
    UseInterceptors,
    Param,
    BadRequestException,
    DefaultValuePipe,
    ParseIntPipe,
    UploadedFiles,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { v4 as uuidv4 } from 'uuid';
import { MediaService } from './media.service';
import { fileTypeFromBuffer } from 'file-type';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesGuard } from '../auth/roles.guard';

type RenameMediaBody = { filename: string };
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9 _-]{3,80}$/;

@Controller('media')
export class MediaController {
    constructor(private mediaService: MediaService) {}

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async listMedia(
        @Query('q') q?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
        @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit = 30,
    ) {
        return this.mediaService.listPaged({ q, page, limit });
    }


    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: 'files', maxCount: 10 }, // multi
                { name: 'file', maxCount: 1 },   // backward compatible
            ],
            {
                limits: {
                    fileSize: 5 * 1024 * 1024, // 5MB per file
                    files: 10,
                },
                fileFilter: (_req, file, cb) => {
                    const allowed = ['image/jpeg', 'image/webp'];
                    cb(null, allowed.includes(file.mimetype));
                },
            },
        ),
    )
    async upload(
        @UploadedFiles()
        payload: { files?: Express.Multer.File[]; file?: Express.Multer.File[] },
    ) {
        const files = [...(payload.files ?? []), ...(payload.file ?? [])];

        if (!files.length) throw new BadRequestException('No files uploaded');

        const created: Array<{ code: string; filename: string; size: number }> = [];
        const failed: Array<{ name: string; reason: string }> = [];

        // Sequential processing avoids CPU spikes while optimizing thumbnails
        for (const f of files) {
            try {
                if (!f?.buffer) throw new BadRequestException('Invalid upload');

                // Validate magic bytes (anti-spoof)
                const type = await fileTypeFromBuffer(f.buffer);
                if (!type || !['image/jpeg', 'image/webp'].includes(type.mime)) {
                    throw new BadRequestException('Unsupported or spoofed file type');
                }

                const code = uuidv4();
                const { storageKey, size } = await this.mediaService.storeBookCoverThumbnail(code, f.buffer);

                const record = await this.mediaService.createRecord({
                    code,
                    filename: code, // admin can rename later
                    storageKey,
                    mimeType: 'image/webp',
                    size,
                });

                created.push({ code: record.code, filename: record.filename, size: record.size });
            } catch (e: any) {
                failed.push({ name: f?.originalname ?? 'file', reason: e?.message ?? 'upload failed' });
            }
        }

        if (created.length === 0) {
            throw new BadRequestException(failed[0]?.reason ?? 'Upload failed');
        }

        return { items: created, failed };
    }

    @Patch(':code')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async rename(@Param('code') code: string, @Body() body: RenameMediaBody) {
        const filename = body?.filename?.trim();
        if (!filename) throw new BadRequestException('filename is required');

        if (!SAFE_FILENAME_REGEX.test(filename)) {
            throw new BadRequestException(
                'filename must be 3-80 chars and contain only letters, numbers, space, dash, underscore',
            );
        }

        return this.mediaService.renameByCode(code, filename);
    }

    @Delete(':code')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async delete(@Param('code') code: string) {
        return this.mediaService.deleteByCode(code);
    }
}
