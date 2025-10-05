import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

class AdviceRequestDto {
  weatherPayload!: any;
  userQuestion?: string;
}
class AdviceResponseDto {
  status!: 'GO' | 'ADJUST' | 'DELAY';
  summary!: string;
  advice!: string[];
  tips!: { hidratacao: string; vestuario: string; rota: string; estrutura: string; };
  indicators?: any;
  meta?: any;
}

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('advice')
  @ApiOperation({ summary: 'Conselho estruturado (GO/ADJUST/DELAY) baseado no clima (Gemini)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { weatherPayload: { type: 'object' }, userQuestion: { type: 'string' } },
      example: {
        weatherPayload: {
          meta: { target_date: "2025-10-05", lat: -12.7, lon: -60.1 },
          deterministic: { daily: {
            temp_media: 26, cat_temp_dia: "amena",
            chuva_total_mm: 0.4, cat_chuva_dia: "baixa",
            umid_media: 62, vento_medio: 3.4, cat_vento_dia: "fraco",
            horas_agradaveis: 5, discomfort_index: 64, probabilidade_chuva_3h: 10
          }}
        },
        userQuestion: "Corrida matinal em Vilhena?"
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Resposta estruturada', type: AdviceResponseDto })
  async advice(@Body() body: AdviceRequestDto): Promise<AdviceResponseDto> {
    return await this.ai.generateWeatherAdvice(
      body.weatherPayload,
      body.userQuestion ?? 'Sugerir plano para atividade ao ar livre'
    ) as any;
  }
}
