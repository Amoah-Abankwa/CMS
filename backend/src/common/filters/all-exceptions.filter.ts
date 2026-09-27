import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { RequestContext } from '../../core/context/request-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const correlationId = RequestContext.get()?.correlationId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const obj = typeof body === 'string' ? { message: body } : (body as Record<string, unknown>);
      const message = Array.isArray(obj.message) ? 'Some fields need attention.' : obj.message;
      res.status(status).json({
        statusCode: status,
        code: obj.code ?? (status === 400 ? 'VALIDATION_FAILED' : 'ERROR'),
        message,
        details: Array.isArray(obj.message) ? obj.message : obj.details,
        correlationId,
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception), correlationId);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Quote this reference if you contact support.',
      correlationId,
    });
  }
}
