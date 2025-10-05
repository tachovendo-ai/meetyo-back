import { Injectable } from '@nestjs/common';

type MotorRaw = any; // formato retornado pelo weather.service.ts (não vamos alterar)
type Contexto = { lat: number; lon: number; date: string };

@Injectable()
export class AiService {
  // ✅ Método novo que aceita o RAW do motor (sem adaptar/alterar motor)
  async generateFromMotorRaw(motorOut: MotorRaw, ctx: Contexto, question?: string) {
    // logs para depuração
    console.log('\n===== IA::RAW RECEBIDO =====');
    console.log(JSON.stringify({ motorOut, ctx, question }, null, 2));
    console.log('============================\n');

    // Se o motor não retornou nada útil:
    if (!motorOut || typeof motorOut !== 'object') {
      return this.fallbackAdjust('Sem retorno do motor.', ctx);
    }
    if ('mensagem' in motorOut && motorOut.mensagem) {
      // caso do motor: { mensagem: 'Nenhum filtro selecionado.' }
      return this.fallbackAdjust(String(motorOut.mensagem), ctx);
    }

    // ===== Extrai os campos do formato ATUAL do motor =====
    // Exemplos do motor: 
    // - temperatura.media: "26.5°C"
    // - chuva.probabilidade: "90.0%"
    // - vento.nomenclatura_provavel: "calmo" (opcional)
    // - umidade.media: "81.0%"
    // - probabilidades_por_hora: { "16:00": { ... } }
    // - meta: { confiabilidade: "100.0%", anos_analisados: 10 }

    const num = (v?: unknown) => {
      if (v == null) return undefined;
      const n = Number(String(v).replace('%','').replace('°C',''));
      return Number.isFinite(n) ? n : undefined;
    };
    const txt = (v?: unknown) => typeof v === 'string' ? (v.trim() || undefined) : undefined;

    const tempMedia = num(motorOut?.temperatura?.media);
    const probChuva = num(motorOut?.chuva?.probabilidade);
    const umidMedia = num(motorOut?.umidade?.media);
    const catTemp = txt(motorOut?.temperatura?.nomenclatura_provavel);
    const catVento = txt(motorOut?.vento?.nomenclatura_provavel);
    const horas = motorOut?.probabilidades_por_hora ?? {};
    const confiabilidade = txt(motorOut?.meta?.confiabilidade);
    const anosAnalisados = motorOut?.meta?.anos_analisados;

    // Heurística simples de status (pode trocar pelo Gemini real)
    const chuvaAlta = (probChuva ?? 0) >= 60;
    const status = chuvaAlta ? 'DELAY' : 'GO';

    // Se nada essencial veio, retorna ajuste
    if (tempMedia == null && probChuva == null && umidMedia == null) {
      return this.fallbackAdjust('Payload do motor incompleto.', ctx);
    }

    // ===== Chamada ao Gemini (substitua por sua integração real) =====
    const response = await this.callGeminiWithRaw(motorOut, ctx, question, {
      statusHeuristico: status,
      tempMedia, probChuva, umidMedia, catTemp, catVento,
      confiabilidade, anosAnalisados
    });

    console.log('\n===== IA::RESPOSTA FINAL =====');
    console.log(JSON.stringify(response, null, 2));
    console.log('==============================\n');

    return response;
  }

  // Mock/placeholder de chamada ao Gemini usando o RAW como contexto
  private async callGeminiWithRaw(
    motorOut: MotorRaw,
    ctx: Contexto,
    question: string | undefined,
    resumo: {
      statusHeuristico: 'GO' | 'DELAY',
      tempMedia?: number, probChuva?: number, umidMedia?: number,
      catTemp?: string, catVento?: string,
      confiabilidade?: string, anosAnalisados?: number
    }
  ) {
    const status = resumo.statusHeuristico;
    const summary = status === 'DELAY'
      ? `Chuva provável${resumo.probChuva != null ? ` (~${resumo.probChuva}%)` : ''} e umidade ${resumo.umidMedia != null ? `(~${resumo.umidMedia}%)` : 'elevada'}. Considere adiar ou usar abrigo.`
      : `Clima favorável${resumo.tempMedia != null ? ` (~${resumo.tempMedia}°C)` : ''}. Boa janela para atividade ao ar livre.`;

    return {
      status,
      summary,
      advice: status === 'DELAY'
        ? [
            'Tenha plano B coberto.',
            'Monitore radar de chuva 1–2h antes.',
          ]
        : [
            'Use protetor solar.',
            'Evite pico de calor (12h–15h).',
          ],
      tips: {
        hidratacao: 'Leve água.',
        vestuario: 'Roupas leves.',
        rota: status === 'DELAY' ? 'Escolha rota com abrigos.' : 'Prefira rotas sombreadas.',
        estrutura: status === 'DELAY' ? 'Tenda/varanda.' : 'Área verde e ventilada.',
      },
      indicators: {
        temp_media: resumo.tempMedia,
        prob_chuva_3h: resumo.probChuva,
        umid_media: resumo.umidMedia,
        cats: { temp: resumo.catTemp ?? 'desconhecido', vento: resumo.catVento ?? 'desconhecido' },
        confiabilidade: resumo.confiabilidade,
        anos_analisados: resumo.anosAnalisados,
      },
      meta: { target_date: ctx.date, lat: ctx.lat, lon: ctx.lon },
      // opcional: incluir um espelho do RAW para debug em dev
      // raw: motorOut
    };
  }

  // Fallback quando o RAW do motor está ausente/incompleto
  private fallbackAdjust(motivo: string, ctx: Contexto) {
    return {
      status: 'ADJUST',
      summary: `Payload incompleto: ${motivo} Ajuste horário/rota e tente novamente.`,
      advice: ['Confirme os dados do clima.', 'Monitore atualizações próximas ao evento.'],
      tips: {
        hidratacao: 'Hidrate-se regularmente.',
        vestuario: 'Roupas leves e versáteis.',
        rota: 'Prefira locais com cobertura próxima.',
        estrutura: 'Considere tendas/áreas internas.'
      },
      indicators: null,
      meta: { target_date: ctx.date, lat: ctx.lat, lon: ctx.lon },
    };
  }
}
