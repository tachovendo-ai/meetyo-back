import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

type AdviceStatus = 'GO' | 'ADJUST' | 'DELAY';

interface WeatherDaily {
  temp_media?: number;
  chuva_total_mm?: number;
  umid_media?: number;
  vento_medio?: number;
  discomfort_index?: number;
  horas_agradaveis?: number;
  probabilidade_chuva_3h?: number;
  cat_temp_dia?: string;
  cat_chuva_dia?: string;
  cat_vento_dia?: string;
}

interface WeatherPayload {
  meta?: { target_date?: string; lat?: number; lon?: number };
  deterministic?: { daily?: WeatherDaily };
}

/** Import dinâmico para compatibilidade CJS (evita ERR_REQUIRE_ESM com node-fetch) */
const fetchDynamic = async (...args: any[]) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(...(args as Parameters<typeof fetch>));
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private loggedOnce = false; // evita spam de log

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no .env');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /** permite trocar o modelo via .env → GEMINI_MODEL, fallback para 2.5 flash latest */
  private getModelName() {
    return this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash-latest';
  }

  private safeGet(obj: any, path: string, fallback: any = null) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : fallback), obj);
  }

  // Heurística simples para classificar o dia
  private classify(d: WeatherDaily): AdviceStatus {
    const t = d.temp_media ?? 25;
    const rain = (d.chuva_total_mm ?? 0) + ((d.probabilidade_chuva_3h ?? 0) / 100) * 2; // pondera prob. 3h
    const hum = d.umid_media ?? 60;
    const wind = d.vento_medio ?? 2;
    const di = d.discomfort_index ?? 60;
    const niceH = d.horas_agradaveis ?? 3;

    let score = 0;
    // temperatura: ideal ~ 18–28
    if (t >= 18 && t <= 28) score += 2;
    else if (t >= 15 && t <= 32) score += 1;

    // chuva: pouca é melhor
    if (rain <= 0.5) score += 2;
    else if (rain <= 5) score += 1;

    // umidade moderada
    if (hum <= 70) score += 1;

    // vento ok
    if (wind <= 5) score += 1;

    // desconforto menor é melhor
    if (di <= 68) score += 1;

    // horas agradáveis
    if (niceH >= 4) score += 2;
    else if (niceH >= 2) score += 1;

    if (score >= 7) return 'GO';
    if (score >= 4) return 'ADJUST';
    return 'DELAY';
  }

  private baseAdvice(status: AdviceStatus): string[] {
    if (status === 'GO') return [
      'Condições favoráveis no geral. Siga com confiança.',
      'Mantenha hidratação regular e use protetor solar se houver sol.',
    ];
    if (status === 'ADJUST') return [
      'Condições mistas. Ajuste horário/roteiro para janelas mais confortáveis.',
      'Tenha plano B coberto e acompanhe atualizações próximas ao evento.',
    ];
    return [
      'Risco climático elevado. Reavalie data/horário ou migre para local coberto.',
      'Priorize segurança e conforto dos participantes.',
    ];
  }

  async generateWeatherAdvice(
    weatherPayload: WeatherPayload,
    userQuestion = 'Sugerir plano para atividade ao ar livre',
  ) {
    // 1) Validar estrutura mínima
    const daily = this.safeGet(weatherPayload, 'deterministic.daily') as WeatherDaily;
    const meta = this.safeGet(weatherPayload, 'meta', {});
    if (!daily || !meta) {
      const status: AdviceStatus = 'ADJUST';
      return {
        status,
        summary: 'Payload incompleto. Ajuste horário/rota e tente novamente.',
        advice: ['Confirme os dados do clima.', 'Monitore atualizações próximas ao evento.'],
        tips: {
          hidratacao: 'Hidrate-se regularmente.',
          vestuario: 'Roupas leves e versáteis.',
          rota: 'Prefira locais com cobertura próxima.',
          estrutura: 'Considere tendas/áreas internas.'
        },
        indicators: null,
        meta: null
      };
    }

    // 2) Indicadores + heurística (sempre calculados)
    const indicators = {
      temp_media: daily.temp_media ?? null,
      chuva_total_mm: daily.chuva_total_mm ?? null,
      prob_chuva_3h: daily.probabilidade_chuva_3h ?? null,
      umid_media: daily.umid_media ?? null,
      vento_medio: daily.vento_medio ?? null,
      discomfort_index: daily.discomfort_index ?? null,
      horas_agradaveis: daily.horas_agradaveis ?? null,
      cats: {
        temp: daily.cat_temp_dia ?? null,
        chuva: daily.cat_chuva_dia ?? null,
        vento: daily.cat_vento_dia ?? null,
      },
    };
    const status: AdviceStatus = this.classify(daily);
    const base = this.baseAdvice(status);

    // 3) Prompt
    const context = `
Data: ${meta.target_date ?? 'desconhecida'}
Local: lat ${meta.lat ?? '?'}, lon ${meta.lon ?? '?'}
Indicadores:
- Temperatura média: ${indicators.temp_media ?? '?'}°C (${indicators.cats.temp ?? 'n/a'})
- Chuva total: ${indicators.chuva_total_mm ?? '?'} mm (prob. 3h: ${indicators.prob_chuva_3h ?? '?'}%)
- Umidade média: ${indicators.umid_media ?? '?'}%
- Vento médio: ${indicators.vento_medio ?? '?'} m/s (${indicators.cats.vento ?? 'n/a'})
- Horas agradáveis: ${indicators.horas_agradaveis ?? '?'}
- Índice de desconforto: ${indicators.discomfort_index ?? '?'}
Classificação heurística: ${status}
    `.trim();

    const prompt = `
Você é o Agente Meetyo. Contexto climático:
${context}

Pergunta do usuário: "${userQuestion}"

Devolva **apenas JSON válido**, em português do Brasil, no formato:
{
  "status": "GO|ADJUST|DELAY",
  "summary": "uma frase curta explicando o porquê",
  "advice": ["frase 1", "frase 2"],
  "tips": {
    "hidratacao": "dica objetiva",
    "vestuario": "dica objetiva",
    "rota": "dica objetiva",
    "estrutura": "dica objetiva"
  }
}

Regras:
- Use o status sugerido: ${status}.
- Máximo de 3 frases somadas entre "summary" e "advice".
- Seja claro, prático e empático.
    `.trim();

    // 4) Chama Gemini (SDK). Se der 404 v1beta, cai pro REST v1 diretamente
    let llmJson: any = null;
    try {
      const model = this.genAI.getGenerativeModel({ model: this.getModelName() });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();

      const extractJson = (s: string) => {
        const fenced = s.match(/```json([\s\S]*?)```/i);
        const body = fenced ? fenced[1] : s;
        const first = body.indexOf('{'); const last = body.lastIndexOf('}');
        if (first >= 0 && last >= 0 && last > first) return body.slice(first, last + 1);
        return body;
      };
      const candidate = extractJson(raw);
      try { llmJson = JSON.parse(candidate); } catch {}
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (!this.loggedOnce) {
        this.logger.warn(`Gemini via SDK falhou, tentando REST v1: ${msg}`);
        this.loggedOnce = true;
      }
      // ---- FALLBACK REST V1 ----
      try {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        const modelName = this.getModelName(); // ex: gemini-2.5-flash-latest
        const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

        const resp = await fetchDynamic(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          this.logger.warn(`REST v1 status ${resp.status}: ${body}`);
        } else {
          const json: any = await resp.json();
          const raw =
            json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
            json?.candidates?.[0]?.content?.parts?.[0]?.text ||
            '';
          if (raw) {
            const extractJson = (s: string) => {
              const fenced = s.match(/```json([\s\S]*?)```/i);
              const body = fenced ? fenced[1] : s;
              const first = body.indexOf('{'); const last = body.lastIndexOf('}');
              if (first >= 0 && last >= 0 && last > first) return body.slice(first, last + 1);
              return body;
            };
            const candidate = extractJson(raw.trim());
            try { llmJson = JSON.parse(candidate); } catch {}
          }
        }
      } catch (restErr: any) {
        this.logger.warn(`REST v1 também falhou: ${String(restErr?.message || restErr)}`);
      }
    }

    // 5) Fallback útil com heurística
    const out = llmJson && llmJson.status ? llmJson : {
      status,
      summary: base[0],
      advice: base.slice(1),
      tips: {
        hidratacao: status !== 'DELAY' ? 'Leve água e ajuste ingestão conforme calor.' : 'Adie e mantenha hidratação ao longo do dia.',
        vestuario: status === 'GO' ? 'Roupas leves e respiráveis; protetor solar.' :
                  status === 'ADJUST' ? 'Adapte camadas e considere capa leve.' :
                  'Opte por roupas confortáveis em ambiente coberto.',
        rota: status === 'DELAY' ? 'Prefira local coberto/indoor hoje.' :
              'Escolha rota com sombra e alternativas cobertas.',
        estrutura: status === 'DELAY' ? 'Reagende ou garanta estrutura coberta.' :
                  'Garanta pontos de descanso e cobertura rápida se necessário.'
      }
    };

    return {
      status: out.status as AdviceStatus,
      summary: out.summary,
      advice: out.advice,
      tips: out.tips,
      indicators,
      meta: { date: meta.target_date ?? null, lat: meta.lat ?? null, lon: meta.lon ?? null }
    };
  }
}
