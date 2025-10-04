// src/meetyoWeatherEngine.ts
/**
 * Meetyo Weather Engine (TypeScript - arquivo único)
 * - Consulta NASA POWER API (hourly/point)
 * - Métricas básicas/avançadas
 * - Agregação diária e classificações
 * - Exportação JSON
 */

import axios from "axios";
import fs from "fs";
import path from "path";

// ==================== Tipos ====================

type HourKey = string; // "YYYYMMDDHH"

export interface HourlyRecord {
  ano: number;
  data: string;      // "YYYY-MM-DD"
  hora: string;      // "HH"
  temp: number | null;
  chuva: number | null;
  vento: number | null;
  umid: number | null;
  claridade_pct: number | null;
  heat_index: number | null;
  conforto: number | null;
  cat_temp: string;
  cat_chuva: string;
  cat_vento: string;
  cat_umid: string;
  cat_conforto: string;

  // métricas avançadas opcionais (preenchidas no primeiro registro do dia/ano)
  amplitude_termica?: number | null;
  horas_agradaveis?: number;
  indice_uv?: number | null;
  probabilidade_chuva_3h?: number;
  discomfort_index?: number | null;
}

export interface DailyRecord {
  ano: number;
  data: string; // "YYYY-MM-DD"
  temp: number; // média
  chuva: number; // soma
  vento: number; // média
  umid: number; // média
  claridade_pct: number; // média
  heat_index: number; // média
  conforto: number; // média
  cat_temp: string;
  cat_chuva: string;
  cat_vento: string;
  cat_umid: string;
}

// ==================== Constantes ====================

const POWER_BASE = "https://power.larc.nasa.gov/api";
const TIMEOUT_MS = 10000;
const DEFAULT_PARAMETERS = [
  "T2M",               // Temperatura (°C)
  "PRECTOTCORR",       // Precipitação corrigida (mm/h)
  "WS2M",              // Vento 2m (m/s)
  "RH2M",              // Umidade relativa (%)
  "ALLSKY_SFC_SW_DWN", // Radiação solar (kWh/m²)
  "ALLSKY_KT",         // Índice de claridade (0–1)
];

// ==================== Utilidades de FS ====================

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ==================== Métricas Básicas ====================

export function computeHeatIndex(temp: number, umid: number | null | undefined): number {
  if (temp == null || umid == null) return temp ?? 0;
  if (temp < 27) return temp;
  return -8.784695 + 1.61139411 * temp + 2.338549 * (umid / 100) - 0.14611605 * temp * (umid / 100);
}

export function computeConforto(temp: number | null | undefined, umid: number | null | undefined): number {
  if (temp == null || umid == null) return 0;
  return Math.max(0, Math.min(1, (1 - Math.abs(temp - 25) / 15) * (umid / 100)));
}

export function classifyTemp(temp: number): string {
  if (temp < 18) return "muito fria";
  if (temp < 27) return "amena";
  if (temp < 33) return "quente";
  return "muito quente";
}

export function classifyChuva(chuva: number): string {
  if (chuva < 0.1) return "sem chuva";
  if (chuva < 2) return "chuva leve";
  if (chuva < 10) return "chuva moderada";
  return "chuva forte";
}

export function classifyVento(vento: number): string {
  if (vento < 1) return "calmo";
  if (vento < 5) return "ventoso";
  return "muito ventoso";
}

export function classifyUmid(umid: number): string {
  if (umid < 40) return "seca";
  if (umid < 70) return "agradável";
  return "muito úmida";
}

export function classifyConforto(conforto: number): string {
  if (conforto < 0.3) return "muito desconfortável";
  if (conforto < 0.6) return "moderado";
  return "confortável";
}

// ==================== Métricas Avançadas ====================

export function amplitudeTermica(temps: number[]): number | null {
  if (!temps || temps.length === 0) return null;
  return Math.max(...temps) - Math.min(...temps);
}

export function horasAgradaveis(temps: number[], umids: number[]): number {
  if (!temps || !umids || temps.length !== umids.length) return 0;
  return temps.filter((t, i) => t >= 20 && t <= 30 && umids[i] < 70).length;
}

export function indiceUV(radKwhPerM2: number | null): number | null {
  if (radKwhPerM2 == null || Number.isNaN(radKwhPerM2)) return null;
  const uv = radKwhPerM2 * 40; // escala empírica (0–12+)
  return Math.min(12, Math.round(uv * 10) / 10);
}

export function probabilidadeChuva(chuvas: number[]): number {
  if (!chuvas || chuvas.length < 3) return 0.0;
  const ult3 = chuvas.slice(-3);
  const eventos = ult3.filter((c) => c > 0.1).length;
  return Math.round(((eventos / 3) * 100) * 10) / 10;
}

export function discomfortIndex(temp: number | null, umid: number | null): number | null {
  if (temp == null || umid == null) return null;
  const di = temp - 0.55 * (1 - umid / 100) * (temp - 14.5);
  return Math.round(di * 100) / 100;
}

// ==================== Engine Principal ====================

export class MeetyoWeatherEngine {
  private lat: number;
  private lon: number;
  private date: string; // YYYYMMDD
  private rangeYears: number;
  private yearNow: number;
  private resultsSummary: HourlyRecord[] = [];

  constructor(opts: { lat: number; lon: number; date: string; years?: number }) {
    this.lat = opts.lat;
    this.lon = opts.lon;
    this.date = opts.date; // "YYYYMMDD"
    this.rangeYears = opts.years ?? 1;
    this.yearNow = new Date().getFullYear();
  }

  private buildUrl(dateStr: string, parameters: string[]): string {
    const params = new URLSearchParams({
      parameters: parameters.join(","),
      community: "RE",
      longitude: String(this.lon),
      latitude: String(this.lat),
      start: dateStr,
      end: dateStr,
      format: "JSON",
    });
    return `${POWER_BASE}/temporal/hourly/point?${params.toString()}`;
  }

  private async fetchDataForYear(year: number, parameters: string[]): Promise<any | null> {
    const yyyymmdd = `${year}${this.date.slice(4)}`; // mantém mês/dia da data base
    const url = this.buildUrl(yyyymmdd, parameters);

    const maxAttempts = 3;
    const backoffSec = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await axios.get(url, { timeout: TIMEOUT_MS });
        console.log(`✅ Dados recebidos de ${year}`);
        return resp.data;
      } catch (err: any) {
        console.warn(`⚠️ Falha ao baixar ${year} (tentativa ${attempt}/${maxAttempts}): ${err?.message ?? err}`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, backoffSec * 1000));
        }
      }
    }
    console.error(`❌ Não foi possível baixar dados do ano ${year} após ${maxAttempts} tentativas.`);
    return null;
  }

  private processYear(data: any): HourlyRecord[] | null {
    const p = data?.properties?.parameter ?? {};
    const hours: HourKey[] = Object.keys(p?.T2M ?? {});
    if (!hours || hours.length === 0) return null;

    const registros: HourlyRecord[] = [];

    for (const h of hours) {
      // h = "YYYYMMDDHH"
      const ano = h.slice(0, 4);
      const mes = h.slice(4, 6);
      const dia = h.slice(6, 8);
      const hora = h.slice(8, 10);
      const dataISO = `${ano}-${mes}-${dia}`;

      const t = safeNum(p?.T2M?.[h]);
      const chuva = safeNum(p?.PRECTOTCORR?.[h]);
      const vento = safeNum(p?.WS2M?.[h]);
      const umid = safeNum(p?.RH2M?.[h]);
      const rad = safeNum(p?.ALLSKY_SFC_SW_DWN?.[h]); // kWh/m²
      const clar = safeNum(p?.ALLSKY_KT?.[h]);        // 0–1

      if (t == null) continue;

      const heatIndex = computeHeatIndex(t, umid ?? null);
      const conforto = computeConforto(t, umid ?? null);
      const clarPct = clar != null ? clar * 100 : null;

      const rec: HourlyRecord = {
        ano: Number(ano),
        data: dataISO,
        hora,
        temp: roundOrNull(t, 2),
        chuva: roundOrNull(chuva, 2),
        vento: roundOrNull(vento, 2),
        umid: roundOrNull(umid, 2),
        claridade_pct: clarPct != null ? roundOrNull(clarPct, 1) : null,
        heat_index: heatIndex != null ? roundOrNull(heatIndex, 2) : null,
        conforto: conforto != null ? roundOrNull(conforto, 2) : null,
        cat_temp: classifyTemp(t),
        cat_chuva: classifyChuva(chuva ?? 0),
        cat_vento: classifyVento(vento ?? 0),
        cat_umid: classifyUmid(umid ?? 0),
        cat_conforto: classifyConforto(conforto ?? 0),
      };

      registros.push(rec);
    }

    // Métricas avançadas adicionadas no primeiro registro do conjunto
    if (registros.length > 0) {
      const temps = registros.map((r) => r.temp).filter(isNum) as number[];
      const umids = registros.map((r) => r.umid).filter(isNum) as number[];
      const chuvas = registros.map((r) => r.chuva).filter(isNum) as number[];
      const clarPctList = registros.map((r) => r.claridade_pct).filter(isNum) as number[];

      const amp = amplitudeTermica(temps);
      const horasOk = horasAgradaveis(temps, umids);
      const mediaRadKwh = clarPctList.length > 0 ? mean(clarPctList) / 100 : null;
      const uvEst = indiceUV(mediaRadKwh);
      const probChuva = probabilidadeChuva(chuvas);
      const di = discomfortIndex(temps.length ? mean(temps) : null, umids.length ? mean(umids) : null);

      registros[0].amplitude_termica = amp != null ? roundOrNull(amp, 2) : null;
      registros[0].horas_agradaveis = horasOk;
      registros[0].indice_uv = uvEst;
      registros[0].probabilidade_chuva_3h = probChuva;
      registros[0].discomfort_index = di;
    }

    return registros;
  }

  /** Executa a coleta e o processamento horário para os últimos N anos. */
  public async run(): Promise<void> {
    console.log(`📡 Iniciando análise para lat=${this.lat}, lon=${this.lon}`);
    for (let i = 0; i < this.rangeYears; i++) {
      const ano = this.yearNow - (i + 1);
      const raw = await this.fetchDataForYear(ano, DEFAULT_PARAMETERS);
      if (!raw) continue;

      const registros = this.processYear(raw);
      if (!registros || !registros.length) continue;

      this.resultsSummary.push(...registros);
      // Pequena pausa para respeitar limites de API
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log("✅ Processamento concluído.");
  }

  /** Retorna todos os registros horários processados. */
  public getHourly(): HourlyRecord[] {
    return this.resultsSummary;
  }

  /** Exporta o JSON horário consolidado (weather_summary.json). */
  public exportHourly(filePath: string = "data/weather_summary.json"): void {
    ensureDirForFile(filePath);
    fs.writeFileSync(filePath, JSON.stringify(this.resultsSummary, null, 2), { encoding: "utf-8" });
    console.log(`💾 Resumo horário salvo em: ${filePath}`);
  }

  /** Gera o resumo diário (médias/somas + classificações) a partir do horário já carregado. */
  public buildDaily(): DailyRecord[] {
    const byDay = new Map<string, HourlyRecord[]>();
    for (const r of this.resultsSummary) {
      const key = `${r.ano}|${r.data}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(r);
    }

    const daily: DailyRecord[] = [];

    for (const [key, rows] of byDay.entries()) {
      const [anoStr, dataISO] = key.split("|");
      const ano = Number(anoStr);

      const meanTemp = mean(rows.map((r) => r.temp).filter(isNum) as number[]);
      const sumChuva = sum(rows.map((r) => r.chuva).filter(isNum) as number[]);
      const meanVento = mean(rows.map((r) => r.vento).filter(isNum) as number[]);
      const meanUmid = mean(rows.map((r) => r.umid).filter(isNum) as number[]);
      const meanClar = mean(rows.map((r) => r.claridade_pct).filter(isNum) as number[]);
      const meanHI = mean(rows.map((r) => r.heat_index).filter(isNum) as number[]);
      const meanConf = mean(rows.map((r) => r.conforto).filter(isNum) as number[]);

      const cat_temp =
        meanTemp > 33 ? "muito quente" :
        meanTemp > 27 ? "quente" :
        meanTemp > 18 ? "amena" : "fria";

      const cat_chuva =
        sumChuva > 50 ? "chuva forte" :
        sumChuva > 10 ? "chuva moderada" :
        sumChuva > 1 ? "chuva leve" : "sem chuva";

      const cat_vento =
        meanVento > 5 ? "muito ventoso" :
        meanVento > 1 ? "ventoso" : "calmo";

      const cat_umid =
        meanUmid > 70 ? "muito úmida" :
        meanUmid > 40 ? "agradável" : "seca";

      daily.push({
        ano,
        data: dataISO,
        temp: round(meanTemp, 2),
        chuva: round(sumChuva, 2),
        vento: round(meanVento, 2),
        umid: round(meanUmid, 2),
        claridade_pct: round(meanClar, 1),
        heat_index: round(meanHI, 2),
        conforto: round(meanConf, 2),
        cat_temp,
        cat_chuva,
        cat_vento,
        cat_umid,
      });
    }

    // ordena por data
    daily.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    return daily;
  }

  /** Exporta o JSON diário consolidado (daily_summary.json). */
  public exportDaily(daily: DailyRecord[], filePath: string = "data/daily_summary.json"): void {
    ensureDirForFile(filePath);
    fs.writeFileSync(filePath, JSON.stringify(daily, null, 2), { encoding: "utf-8" });
    console.log(`💾 Resumo diário salvo em: ${filePath}`);
  }
}

// ==================== Helpers Numéricos ====================

function isNum(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function round(x: number, digits = 2): number {
  const p = Math.pow(10, digits);
  return Math.round(x * p) / p;
}
function roundOrNull(x: number | null, digits = 2): number | null {
  if (x == null) return null;
  return round(x, digits);
}
function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function safeNum(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

// ==================== Exemplo CLI (opcional) ====================
// Para rodar sem NestJS: ts-node src/meetyoWeatherEngine.ts --lat -12.74 --lon -60.15 --date 20240915 --years 1
if (require.main === module) {
  (async () => {
    const args = require("minimist")(process.argv.slice(2));
    const lat = Number(args.lat);
    const lon = Number(args.lon);
    const date = String(args.date); // YYYYMMDD
    const years = args.years ? Number(args.years) : 1;
    const outHourly = args.outHourly || "data/weather_summary.json";
    const outDaily = args.outDaily || "data/daily_summary.json";

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !/^\d{8}$/.test(date)) {
      console.error("Uso: --lat <num> --lon <num> --date <YYYYMMDD> [--years <N>] [--outHourly <path>] [--outDaily <path>]");
      process.exit(1);
    }

    const engine = new MeetyoWeatherEngine({ lat, lon, date, years });
    await engine.run();

    const hourly = engine.getHourly();
    engine.exportHourly(outHourly);

    const daily = engine.buildDaily();
    engine.exportDaily(daily, outDaily);
  })();
}
