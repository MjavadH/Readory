import {Body, Controller, Delete, Get, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors, Res, Param, BadRequestException} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { v4 as uuidv4 } from 'uuid';
import { MediaService } from './media.service';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import * as fs from "node:fs";
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import {RolesGuard} from "../auth/roles.guard";

type RenameMediaBody = { filename: string };
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9 _-]{3,80}$/;

@Controller('media')
export class MediaController {
    constructor(private mediaService: MediaService) {}

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_MEDIA)
    async listMedia(@Query('q') q?: string) {
        return this.mediaService.list(q);
    }

    @Get(':code')
    async getMedia(@Param('code') code: string, @Res() res: any) {
        const { stream } = await this.mediaService.getFileStream(code);
        res.set({
            'Content-Type': 'image/webp',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=86400',
        });
        stream.pipe(res);
    }

    @Get(':code/thumbnail')
    async getThumbnail(@Param('code') code: string, @Res() res: any) {
        const { stream } = await this.mediaService.getThumbnailStream(code);
        res.set({
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400',
        });
        stream.pipe(res);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_MEDIA)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
            fileFilter: (_req, file, cb) => {
                const allowed = ['image/jpeg', 'image/webp'];
                cb(null, allowed.includes(file.mimetype));
            },
        }),
    )
    async upload(@UploadedFile() file: Express.Multer.File) {
        if (!file?.buffer) throw new BadRequestException('No file uploaded');
        const code = uuidv4();
        // Validate magic bytes
        const type = await fileTypeFromBuffer(file.buffer);
        if (!type || !['image/jpeg', 'image/webp'].includes(type.mime)) {
            throw new Error('File type spoofing detected');
        }
        // Convert and strip metadata
        const sanitized = await sharp(file.buffer).webp({ quality: 90 }).toBuffer();
        const storageKey = `${code}.webp`;
        await fs.promises.writeFile(`uploads/${storageKey}`, sanitized);

        const record = await this.mediaService.createRecord({
            code,
            filename: code,
            storageKey,
            mimeType: 'image/webp',
            size: sanitized.length,
        });

        return { code: record.code, filename: record.filename };
    }

    @Patch(':code')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_MEDIA)
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
    @RequirePermissions(AdminPermissions.MANAGE_MEDIA)
    async delete(@Param('code') code: string) {
        return this.mediaService.deleteByCode(code);
    }
}
