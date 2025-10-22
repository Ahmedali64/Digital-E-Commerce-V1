import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionsFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const message = exception.message;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${exception.message}`,
      );
    }

    response.status(status).json({
      success: false,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
