import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { WeatherService } from '../weather/weather.service';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

// Booleans no body (forma pedida) -> montamos o objeto filtros aqui
type Filtros = { temperatura: boolean; chuva: boolean; vento: boolean; umidade: boolean };

class AdviceRequestDto {
  latitude!: number;
  longitude!: number;
  date!: string;           // "YYYY-MM-DD" ou "YYYYMMDD"
  rangeYears?: number;     // padrão 5
  temperatura!: boolean;
  chuva!: boolean;
  vento!: boolean;
  umidade!: boolean;
  question?: string;
}

// Payload esperado pelo AiService (meta + deterministic.daily)
type WeatherPayload = {
  meta?: { target_date?: string; lat?: number; lon?: number };
  deterministic?: {
    daily?: {
      temp_media?: number;
      chuva_total_mm?: number;
      probabilidade_chuva_3h?: number;
      umid_media?: number;
      vento_medio?: number;
      discomfort_index?: number;
      horas_agradaveis?: number;
      cat_temp_dia?: string | undefined;
      cat_chuva_dia?: string | undefined;
      cat_vento_dia?: string | undefined;
    };
  };
};

@ApiTags('agent-ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly weatherService: WeatherService,
  ) {}

  // Helpers do adaptador (converte saída do motor -> payload do agente)
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
  private toAiPayload(wsOut: any, lat: number, lon: number, dateISO: string): WeatherPayload {
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


  @ApiConsumes('application/json')
  @ApiBody({
    description: 'Parâmetros para obter o conselho do agente a partir do motor climático.',
    required: true,
    examples: {
      PiqueniqueChuvoso: {
        summary: 'Cenário chuvoso (90%), sem vento, igual ao retorno do seu motor',
        description:
          'O controller normaliza a data (YYYY-MM-DD -> YYYYMMDD), chama o WeatherService com os filtros e envia o contexto para a IA (Gemini) gerar o card de conselho.',
        value: {
          latitude: -12.74,
          longitude: -60.15,
          date: "2025-10-05",
          rangeYears: 10,
          temperatura: true,
          chuva: true,
          vento: false,
          umidade: true,
          question: "Quero um piquenique às 16h, vale a pena?"
        }
      },
      CompletoComVento: {
        summary: 'Exemplo completo (todos os filtros ligados)',
        value: {
          latitude: -23.55,
          longitude: -46.64,
          date: "2025-10-05",
          rangeYears: 5,
          temperatura: true,
          chuva: true,
          vento: true,
          umidade: true,
          question: "Evento corporativo ao ar livre entre 10h e 14h — recomendações?"
        }
      }
    }
  })

  @Post('advice')
  @ApiOperation({ summary: 'Conselhos de IA Climático (GO | ADJUST | DELAY)' })
  @ApiResponse({
    status: 201,
    description: 'Retorna status, resumo, conselhos, dicas e indicadores.',
  })
  async advice(@Body() body: AdviceRequestDto) {
    const {
      latitude,
      longitude,
      date,
      rangeYears = 5,
      temperatura,
      chuva,
      vento,
      umidade,
      question,
    } = body;

    // ✅ monta o objeto de filtros a partir dos booleans avulsos (como seu colega sugeriu)
    const filtros: Filtros = { temperatura, chuva, vento, umidade };

    // ✅ normaliza data para o formato que o WeatherService espera (YYYYMMDD)
    const dateParam = String(date).replace(/-/g, '').slice(0, 8);

    // 1) Chama o motor TypeScript (WeatherService)
    const wsOut = await this.weatherService.findAll(
      latitude,
      longitude,
      dateParam,
      rangeYears,
      filtros,
    );

    // 2) Fallback se o motor não retornar dados
    if (!wsOut) {
      return {
        status: 'DELAY',
        summary: 'Sem dados suficientes para gerar conselho.',
        advice: ['Tente outro horário ou verifique novamente mais tarde.'],
        tips: { hidratacao: '', vestuario: '', rota: '', estrutura: '' },
        indicators: {},
        meta: { target_date: date, lat: latitude, lon: longitude },
      };
    }

    // 3) Converte a saída do motor para o formato esperado pelo agente
    const payload = this.toAiPayload(wsOut, latitude, longitude, date);

    // 4) Passa para o agente (AiService)
    return this.aiService.generateWeatherAdvice(
      payload,
      question ?? 'Sugerir plano para atividade ao ar livre'
    );
  }
}
