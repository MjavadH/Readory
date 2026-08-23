import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

function allowedOrigins() {
  return [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.CORS_ORIGIN,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]
    .flatMap((value) => (value ?? '').split(','))
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

@Injectable()
export class GoogleOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.get('origin')?.replace(/\/+$/, '');
    if (!origin) return true;
    if (!allowedOrigins().includes(origin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
    return true;
  }
}
