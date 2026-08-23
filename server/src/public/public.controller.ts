import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { BookTypesService } from '../book-types/book-types.service';
import type { BooksService } from '../books/books.service';
import type { BrowseGenreDto } from '../books/dto/browse-genre.dto';
import type { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly bookTypesService: BookTypesService,
    private readonly booksService: BooksService,
  ) {}

  @Get('content')
  async getHomeContent() {
    return this.publicService.getPublicHomeContent();
  }

  @UseGuards(JwtAuthGuard)
  @Get('personalized')
  async getPersonalizedContent(@Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.publicService.getUserPersonalizedContent(userId);
  }

  @Get('genres')
  async getGenresPage() {
    return this.publicService.getGenresPage();
  }

  @Get('genres/:slug/browse')
  async browseGenre(@Param('slug') slug: string, @Query() query: BrowseGenreDto) {
    return this.booksService.browseByGenre(slug, query);
  }

  @Get('book-types')
  async bookTypes() {
    return this.bookTypesService.listPublic();
  }

  @Get('book-types/:type')
  async getBooksByType(@Param('type') type: string) {
    return this.bookTypesService.findByType(type);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('profiles/:username')
  @UseGuards(OptionalJwtAuthGuard)
  async getUserProfile(@Param('username') username: string, @Request() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.publicService.getPublicUserProfile(username, userId ? Number(userId) : undefined);
  }
}
