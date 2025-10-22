import { Role } from '@prisma/client';
import { Request } from 'express';
import { OAuthProfile } from './oauth-profile.type';
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    isEmailVerified: boolean;
  };
}

export interface AuthenticatedOAuthRequest extends Request {
  user: OAuthProfile;
}
