import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SwaggerConfig } from './config/swaggerConfig';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Adição: CORS liberado (restrinja depois ao domínio do front)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });

  const document = SwaggerModule.createDocument(app, SwaggerConfig);
  SwaggerModule.setup('/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Adição: usa PORT do .env (fallback 3000)
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  console.log('🚀 Swagger rodando em: http://localhost:' + port + '/docs');
}
bootstrap();
