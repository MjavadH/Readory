import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LibraryService } from './library.service';

@Controller('library')
export class LibraryController {
    constructor(private readonly libraryService: LibraryService) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getLibrary(@Request() req: any) {
        const userId = req.user.userId ?? req.user.id;
        return this.libraryService.getLibrary(Number(userId));
    }
}
