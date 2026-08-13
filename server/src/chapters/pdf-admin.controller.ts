import {
  BadRequestException,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PdfProcessingService, PDF_UPLOAD_MAX_FILE_BYTES } from './pdf-processing.service';

const PDF_UPLOAD_MULTER = {
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: PDF_UPLOAD_MAX_FILE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    cb(null, file.mimetype === 'application/pdf');
  },
};

@Controller('admin/chapters')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_BOOKS)
export class PdfAdminController {
  constructor(private readonly pdfProcessing: PdfProcessingService) {}

  @Post(':id/pdf')
  @UseInterceptors(FileInterceptor('file', PDF_UPLOAD_MULTER))
  uploadPdf(
    @Param('id', ParseIntPipe) chapterId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('PDF file is required');
    return this.pdfProcessing.uploadAndReplace(chapterId, file.buffer, file.originalname);
  }
}
