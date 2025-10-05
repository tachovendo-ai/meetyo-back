import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { WeatherService } from '../weather/weather.service';

type Filtros = { temperatura: boolean; chuva: boolean; vento: boolean; umidade: boolean };

class AdviceRequestDto {
  latitude!: number;
  longitude!: number;
  date!: string;
  rangeYears?: number;
  temperatura!: boolean;
  chuva!: boolean;
  vento!: boolean;
  umidade!: boolean;
  question?: string;
}

@ApiTags('agent-ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly weatherService: WeatherService,
  ) {}

  private num(v?: unknown) {
    if (v == null) return undefined;
    const n = Number(String(v).replace('%', '').replace('°C', ''));
    return Number.isFinite(n) ? n : undefined;
  }

  private opt(v?: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    return s.length ? s : undefined;
  }

  private toAiPayload(wsOut: any, lat: number, lon: number, dateISO: string) {
    const catChuva =
      typeof wsOut?.chuva?.probabilidade !== 'undefined'
        ? ((this.num(wsOut.chuva.probabilidade) ?? 0) > 50 ? 'alta' : 'baixa')
        : undefined;

    return {
      meta: { target_date: dateISO, lat, lon },
      deterministic: {
        daily: {
          temp_media: this.num(wsOut?.temperatura?.media),
          chuva_total_mm: this.num(wsOut?.indicadores?.chuva_total_mm),
          probabilidade_chuva_3h: this.num(wsOut?.chuva?.probabilidade),
          umid_media: this.num(wsOut?.umidade?.media),
          vento_medio: this.num(wsOut?.indicadores?.vento_medio),
          discomfort_index: this.num(wsOut?.indicadores?.discomfort_index),
          horas_agradaveis: this.num(wsOut?.indicadores?.horas_agradaveis),
          cat_temp_dia: this.opt(wsOut?.temperatura?.nomenclatura_provavel),
          cat_chuva_dia: this.opt(catChuva),
          cat_vento_dia: this.opt(wsOut?.vento?.nomenclatura_provavel),
        },
      },
    };
  }

  @Post('advice')
  @ApiConsumes('application/json')
  @ApiBody({
    description: 'Requisição de conselho climático com filtros e coordenadas.',
    examples: {
      Default: {
        summary: 'Consulta padrão com clima completo',
        value: {
          latitude: -12.74,
          longitude: -60.15,
          date: '2025-10-05',
          rangeYears: 10,
          temperatura: true,
          chuva: true,
          vento: true,
          umidade: true,
          question: 'Planejo evento ao ar livre às 16h, vale a pena?'
        },
      },
    },
  })
  @ApiOperation({ summary: 'Conselhos de IA Climático (GO | ADJUST | DELAY)' })
  @ApiResponse({ status: 201, description: 'Retorna status e recomendações.' })
  async advice(@Body() body: AdviceRequestDto) {
    const { latitude, longitude, date, rangeYears = 5, temperatura, chuva, vento, umidade, question } = body;

    const filtros: Filtros = { temperatura, chuva, vento, umidade };
    const dateParam = String(date).replace(/-/g, '').slice(0, 8);

    const wsOut = await this.weatherService.findAll(latitude, longitude, dateParam, rangeYears, filtros);

    console.log('\n===== SAÍDA DO MOTOR =====');
    console.log(JSON.stringify(wsOut, null, 2));
    console.log('===========================\n');

    const payload = this.toAiPayload(wsOut, latitude, longitude, date);

    console.log('\n===== PAYLOAD ENVIADO PARA IA =====');
    console.log(JSON.stringify(payload, null, 2));
    console.log('====================================\n');

    if (!payload?.deterministic?.daily?.temp_media) {
      return {
        status: 'ADJUST',
        summary: 'Payload incompleto. O motor não retornou todos os dados esperados.',
        advice: ['Aguarde atualização de dados climáticos ou tente novamente.'],
        tips: { hidratacao: '', vestuario: '', rota: '', estrutura: '' },
        indicators: payload?.deterministic?.daily ?? {},
        meta: payload?.meta ?? {},
      };
    }

    return this.aiService.generateFromMotorRaw(
      wsOut,                                  // <-- saída crua do motor
      { lat: latitude, lon: longitude, date}, // <-- contexto
      question ?? 'Gerar card de conselho para atividade ao ar livre'
    );
  }
}
