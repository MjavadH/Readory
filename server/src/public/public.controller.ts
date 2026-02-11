import {Controller, Get, Param, Query} from '@nestjs/common';
import { PublicService } from './public.service';
import { BookTypesService } from '../book-types/book-types.service'
import { BooksService } from '../books/books.service';
import { BrowseGenreDto } from '../books/dto/browse-genre.dto';

@Controller('public')
export class PublicController {
    constructor(
        private readonly publicService: PublicService,
        private readonly bookTypesService: BookTypesService,
        private readonly booksService: BooksService,
    ) {}

    @Get('content')
    async getHomeContent() {
        return this.publicService.getHomeContent();
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
}
