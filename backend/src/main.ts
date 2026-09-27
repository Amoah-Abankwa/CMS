import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { loadEnv } from './core/config/env';
import { csrfHeaderMiddleware } from './common/middleware/csrf.middleware';

async function bootstrap() {
  const env = loadEnv();
  // rawBody lets the Paystack webhook check its signature against the exact bytes received.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Required behind Render/Railway/Nginx so req.ip is the client address.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.use(csrfHeaderMiddleware);
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('ANU Platform API').setVersion('0.1.0').build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
