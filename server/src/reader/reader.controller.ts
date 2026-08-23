import {
  Body,
  Controller,
  Get,
  Header,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { CreateReaderSessionDto } from './dto/create-reader-session.dto';
import type { SaveProgressDto } from './dto/save-progress.dto';
import type { ReaderService } from './reader.service';

type AuthRequest = Request & { user?: { userId?: number } };

@Controller('reader')
@UseGuards(JwtAuthGuard)
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('session')
  async createSession(@Body() body: CreateReaderSessionDto, @Req() req: AuthRequest) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.readerService.createSession(userId, body.bookId, body.chapterIndex, req);
  }

  @Post('admin/session')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async createAdminPreviewSession(@Body() body: CreateReaderSessionDto, @Req() req: AuthRequest) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();

    return this.readerService.createAdminPreviewSession(
      userId,
      body.bookId,
      body.chapterIndex,
      req,
    );
  }

  @Get('manifest')
  async manifest(@Query('token') token: string, @Req() req: Request) {
    return this.readerService.getManifest(token, req);
  }

  @Get('page')
  async page(
    @Query('token') token: string,
    @Query('p', ParseIntPipe) p: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.readerService.getPage(token, p, req);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('image/webp');
    res.send(data);
  }

  @Get('text')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  async text(
    @Query('token') token: string,
    @Query('p', ParseIntPipe) p: number,
    @Req() req: Request,
  ) {
    const html = await this.readerService.getText(token, p, req);
    return { html };
  }

  @Get('context')
  async getContext(@Query('bookId', ParseIntPipe) bookId: number, @Req() req: AuthRequest) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();

    return this.readerService.getReaderContext(userId, bookId);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('progress')
  async saveProgress(@Body() body: SaveProgressDto, @Req() req: AuthRequest) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.readerService.saveProgress(userId, body.chapterId, body.lastPage);
  }
}
