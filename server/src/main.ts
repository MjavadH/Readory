import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // Automatically validate incoming requests based on DTO decorators
    app.enableCors({
        origin: 'http://localhost:3001',
        credentials: true,
    });
    app.use(cookieParser());

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    );
    const port = process.env.PORT || 3000;
    await app.listen(port);
}
bootstrap();
