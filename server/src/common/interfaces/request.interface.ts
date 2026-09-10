import { RoleName } from '@prisma/client';
import { Request } from 'express';

// Defines the structure of the user object attached to the request.
export interface UserPayload {
  userId: number;
  id?: number;
  username: string;
  sessionId: string;
  roleName?: RoleName;
  permissions?: string[];
}

// Applies to endpoints strictly protected by authentication guards.
export interface AuthenticatedRequest extends Request {
  user: UserPayload;
}

// Applies to public endpoints or optional authentication guards.
export interface OptionalAuthRequest extends Request {
  user?: UserPayload;
}

// Applies to endpoints protected by LocalAuthGuard.
export interface LocalAuthRequest extends Request {
  user: {
    id: number;
  };
}
