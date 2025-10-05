import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SwaggerConfig } from './config/swaggerConfig';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);    

    const document = SwaggerModule.createDocument(app, SwaggerConfig);
    SwaggerModule.setup('/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
    });

    
    await app.listen(3000);
    console.log('🚀 Swagger rodando em: http://localhost:3000/docs');
}
bootstrap();
