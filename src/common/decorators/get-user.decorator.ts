import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as Record<string, unknown> | undefined;

    if (!user) {
      return undefined;
    }

    // If a specific field is requested (e.g., 'id', 'email')
    if (data) {
      return user[data];
    }

    // Return the entire user object
    return user;
  },
);
