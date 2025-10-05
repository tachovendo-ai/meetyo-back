import { Injectable } from '@nestjs/common';
import axios from 'axios';

// =============================================================================
// INTERFACES DE DADOS
// =============================================================================

export interface Filtros {
  temperatura: boolean;
  chuva: boolean;
  vento: boolean;
  umidade: boolean;
}

export interface Contagem {
  muitoQuente: number;
  quente: number;
  frio: number;
  chuva: number;
  muitoVentoso: number;
  ventoso: number;
  calmo: number;
  desconforto: number;
  total: number;
}

// =============================================================================
// CONSTANTES DE CLASSIFICAÇÃO
// =============================================================================
const LIMIAR_FRIO_C = 20;
const LIMIAR_QUENTE_C = 30;
const LIMIAR_MUITO_QUENTE_C = 35;
const LIMIAR_VENTO_VENTOSO_MS = 5;
const LIMIAR_VENTO_MUITO_VENTOSO_MS = 10;
const LIMIAR_CHUVA_HORA_MM = 0.1;
const LIMIAR_CHUVA_DIA_MM = 1.0;
const LIMIAR_DESCONFORTO_HEAT_INDEX_C = 35;

@Injectable()
export class WeatherService {
  private calcularIndiceDeCalor(temperatura: number, umidade: number): number {
    if (temperatura < 27 || umidade < 40) {
      return temperatura;
    }
    const T = temperatura;
    const RH = umidade;
    const HI =
      -8.78469475556 +
      1.61139411 * T +
      2.33854883889 * RH -
      0.14611605 * T * RH -
      0.012308094 * T * T -
      0.0164248277778 * RH * RH +
      0.002211732 * T * T * RH +
      0.00072546 * T * RH * RH -
      0.000003582 * T * T * RH * RH;
    return HI;
  }

  private encontrarCategoriaMaisProvavel(probabilidades: Record<string, string>): string {
    let maisProvavel = 'indefinido';
    let maxProb = -1;

    for (const [categoria, probStr] of Object.entries(probabilidades)) {
      const probNum = parseFloat(probStr);
      if (probNum > maxProb) {
        maxProb = probNum;
        maisProvavel = categoria;
      }
    }
    return maisProvavel;
  }

  async findAll(
    latitude: number,
    longitude: number,
    date: string,
    rangeYears: number,
    filtros: Filtros,
  ): Promise<any | null> {
    const parametrosApi:string[] = [];
    if (filtros.temperatura) parametrosApi.push('T2M');
    if (filtros.chuva) parametrosApi.push('PRECTOTCORR');
    if (filtros.vento) parametrosApi.push('WS2M');
    if (filtros.umidade || (filtros.temperatura && filtros.umidade)) {
      parametrosApi.push('RH2M');
    }

    if (parametrosApi.length === 0) {
      return { mensagem: 'Nenhum filtro selecionado.' };
    }

    const mesDia = date.slice(4);
    const anoAtual = new Date().getFullYear();

    const contagem: Contagem = {
      muitoQuente: 0, quente: 0, frio: 0, chuva: 0,
      muitoVentoso: 0, ventoso: 0, calmo: 0, desconforto: 0, total: 0,
    };

    const contagemPorHora: Record<string, Contagem> = {};
    // ✅ ADICIONADO: Estrutura para calcular a média de umidade por hora
    const umidadePorHora: Record<string, { soma: number; count: number }> = {};

    for (let h = 0; h < 24; h++) {
      const horaStr = h.toString().padStart(2, '0');
      contagemPorHora[horaStr] = {
        muitoQuente: 0, quente: 0, frio: 0, chuva: 0,
        muitoVentoso: 0, ventoso: 0, calmo: 0, desconforto: 0, total: 0,
      };
      umidadePorHora[horaStr] = { soma: 0, count: 0 };
    }

    let somaTempGeral = 0, somaUmidGeral = 0;
    let anosValidos = 0;

    const requests = Array.from({ length: rangeYears }, (_, i) => {
      const ano = anoAtual - (i + 1);
      const dataHist = `${ano}${mesDia}`;
      const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=${parametrosApi.join(',')}&community=AG&longitude=${longitude}&latitude=${latitude}&start=${dataHist}&end=${dataHist}&format=JSON`;
      return axios.get(url).then(res => ({ data: res.data, ano })).catch(() => null);
    });

    const results = await Promise.all(requests);

    for (const response of results) {
      if (!response?.data?.properties?.parameter) continue;

      const p = response.data.properties.parameter;
      const ano = response.ano;

      if (!p.T2M && filtros.temperatura) continue;

      const horas = Object.keys(p.T2M || p.PRECTOTCORR || p.WS2M || p.RH2M || {});
      if (horas.length === 0) continue;

      let somaTempDia = 0, countTempDia = 0, somaUmidDia = 0, countUmidDia = 0;
      let chuvaTotalDia = 0, ventoMaxDia = 0, indiceCalorMax = -Infinity, tmax = -Infinity, tmin = Infinity;

      for (const h of horas) {
        const hora = h.slice(-2);
        const ch = contagemPorHora[hora];
        if (!ch) continue;

        const t = p.T2M?.[h];
        const chuva = p.PRECTOTCORR?.[h];
        const vento = p.WS2M?.[h];
        const umidade = p.RH2M?.[h];

        let processouHora = false;

        if (filtros.temperatura && t !== -999) {
          somaTempDia += t;
          countTempDia++;
          if (t > tmax) tmax = t;
          if (t < tmin) tmin = t;

          if (t > LIMIAR_MUITO_QUENTE_C) ch.muitoQuente++;
          else if (t > LIMIAR_QUENTE_C) ch.quente++;
          if (t < LIMIAR_FRIO_C) ch.frio++;
          processouHora = true;
        }

        if (filtros.umidade && umidade !== -999) {
          somaUmidDia += umidade;
          countUmidDia++;
          // ✅ ADICIONADO: Acumula dados para a média horária de umidade
          const u_hora = umidadePorHora[hora];
          u_hora.soma += umidade;
          u_hora.count++;
        }

        if (filtros.temperatura && filtros.umidade && t !== -999 && umidade !== -999) {
          const hi = this.calcularIndiceDeCalor(t, umidade);
          if (hi > indiceCalorMax) indiceCalorMax = hi;
          if (hi > LIMIAR_DESCONFORTO_HEAT_INDEX_C) ch.desconforto++;
        }

        if (filtros.chuva && chuva > 0) {
          chuvaTotalDia += chuva;
          if (chuva > LIMIAR_CHUVA_HORA_MM) ch.chuva++;
          processouHora = true;
        }

        if (filtros.vento && vento !== -999) {
          if (vento > ventoMaxDia) ventoMaxDia = vento;
          if (vento > LIMIAR_VENTO_MUITO_VENTOSO_MS) ch.muitoVentoso++;
          else if (vento > LIMIAR_VENTO_VENTOSO_MS) ch.ventoso++;
          else ch.calmo++;
          processouHora = true;
        }

        if (processouHora) ch.total++;
      }

      if (countTempDia === 0 && filtros.temperatura) continue;
      anosValidos++;

      if (filtros.temperatura && countTempDia > 0) {
        somaTempGeral += somaTempDia / countTempDia;
        if (tmax > LIMIAR_MUITO_QUENTE_C) contagem.muitoQuente++;
        else if (tmax > LIMIAR_QUENTE_C) contagem.quente++;
        if (tmin < LIMIAR_FRIO_C) contagem.frio++;
      }
      if (filtros.umidade && countUmidDia > 0) {
        somaUmidGeral += somaUmidDia / countUmidDia;
      }
      if (filtros.chuva && chuvaTotalDia > LIMIAR_CHUVA_DIA_MM) contagem.chuva++;
      if (filtros.vento) {
        if (ventoMaxDia > LIMIAR_VENTO_MUITO_VENTOSO_MS) contagem.muitoVentoso++;
        else if (ventoMaxDia > LIMIAR_VENTO_VENTOSO_MS) contagem.ventoso++;
        else contagem.calmo++;
      }
      if (filtros.temperatura && filtros.umidade && indiceCalorMax > LIMIAR_DESCONFORTO_HEAT_INDEX_C) contagem.desconforto++;
      
      contagem.total++;
    }

    if (anosValidos === 0) return null;

    const respostaFinal: any = {};
    const prob = (x: number, total: number) => total > 0 ? ((x / total) * 100).toFixed(1) : '0.0';

    const probabilidadesPorHora: Record<string, any> = {};

    for (const hora of Object.keys(contagemPorHora)) {
      const c = contagemPorHora[hora];
      const horaFormatada = `${hora}:00`;
      probabilidadesPorHora[horaFormatada] = {};

      if (filtros.temperatura) {
        probabilidadesPorHora[horaFormatada].temperatura = {
            muito_quente: prob(c.muitoQuente, c.total) + '%',
            quente: prob(c.quente, c.total) + '%',
            frio: prob(c.frio, c.total) + '%',
        };
        if (filtros.umidade) {
            probabilidadesPorHora[horaFormatada].temperatura.desconforto = prob(c.desconforto, c.total) + '%';
        }
      }
      if (filtros.chuva) {
        probabilidadesPorHora[horaFormatada].chuva = prob(c.chuva, c.total) + '%';
      }
      if (filtros.vento) {
        probabilidadesPorHora[horaFormatada].vento = {
            muito_ventoso: prob(c.muitoVentoso, c.total) + '%',
            ventoso: prob(c.ventoso, c.total) + '%',
            calmo: prob(c.calmo, c.total) + '%',
        };
      }
      // ✅ ADICIONADO: Calcula e insere a média de umidade da hora específica
      if (filtros.umidade) {
        const u_hora_stats = umidadePorHora[hora];
        if (u_hora_stats.count > 0) {
          probabilidadesPorHora[horaFormatada].umidade_media = (u_hora_stats.soma / u_hora_stats.count).toFixed(1) + '%';
        } else {
          probabilidadesPorHora[horaFormatada].umidade_media = 'N/A';
        }
      }
    }

    if (filtros.temperatura) {
      const probsTemp = {
        muito_quente: prob(contagem.muitoQuente, contagem.total),
        quente: prob(contagem.quente, contagem.total),
        frio: prob(contagem.frio, contagem.total),
      };
      respostaFinal.temperatura = {
        media: (somaTempGeral / anosValidos).toFixed(1) + '°C',
        probabilidades: probsTemp,
        nomenclatura_provavel: this.encontrarCategoriaMaisProvavel(probsTemp),
      };
      if (filtros.umidade) {
        respostaFinal.temperatura.prob_desconforto = prob(contagem.desconforto, contagem.total) + '%';
      }
    }

    if (filtros.chuva) {
      respostaFinal.chuva = {
        probabilidade: prob(contagem.chuva, contagem.total) + '%',
      };
    }

    if (filtros.vento) {
      const probsVento = {
        muito_ventoso: prob(contagem.muitoVentoso, contagem.total),
        ventoso: prob(contagem.ventoso, contagem.total),
        calmo: prob(contagem.calmo, contagem.total),
      };
      respostaFinal.vento = {
        probabilidades: probsVento,
        nomenclatura_provavel: this.encontrarCategoriaMaisProvavel(probsVento),
      };
    }

    if (filtros.umidade) {
      respostaFinal.umidade = {
        media: (somaUmidGeral / anosValidos).toFixed(1) + '%',
      };
    }

    respostaFinal.probabilidades_por_hora = probabilidadesPorHora;

    respostaFinal.meta = {
      confiabilidade: ((anosValidos / rangeYears) * 100).toFixed(1) + '%',
      anos_analisados: anosValidos,
    };

    return respostaFinal;
  }
}