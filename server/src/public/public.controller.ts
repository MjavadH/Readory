import {Controller, Get, Param} from '@nestjs/common';
import { PublicService } from './public.service';
import { BookTypesService } from '../book-types/book-types.service'

@Controller('public')
export class PublicController {
    constructor(
        private readonly publicService: PublicService,
        private readonly bookTypesService: BookTypesService,
    ) {}

    @Get('content')
    async getHomeContent() {
        return this.publicService.getHomeContent();
    }

    @Get('genres')
    async getGenresPage() {
        return this.publicService.getGenresPage();
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
