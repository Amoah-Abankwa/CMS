import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RequestContext } from './request-context';
import { normaliseIp } from './client-ip';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-correlation-id');
    const correlationId = incoming && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('x-correlation-id', correlationId);
    RequestContext.run(
      { correlationId, ipAddress: normaliseIp(req.ip), userAgent: req.header('user-agent') ?? undefined },
      () => next(),
    );
  }
}
