import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // Automatically validate incoming requests based on DTO decorators
    const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });
    app.use(cookieParser());

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    );
    app.enableShutdownHooks();

    const port = process.env.PORT || 3000;
    await app.listen(port);
}
bootstrap();
