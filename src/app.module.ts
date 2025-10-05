import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WeatherModule } from './weather/weather.module';

import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    WeatherModule,
    ConfigModule.forRoot({ isGlobal: true }), // carrega .env
  ],
  controllers: [
    AppController,
    AiController,
    HealthController,
  ],
  providers: [
    AppService,
    AiService,
  ],
})
export class AppModule {}
