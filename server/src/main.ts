import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Automatically validate incoming requests based on DTO decorators
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
