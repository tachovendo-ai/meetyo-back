import { Injectable } from '@nestjs/common'
import axios from 'axios'

export interface AnoStatus {
  [ano: number]: {
    chuva: boolean
    sol: boolean
    tempMedia: string
  }
}

export interface Contagem {
  quente: number
  frio: number
  chuva: number
  vento: number
  desconforto: number
  total: number
}

export interface Probabilidade {
  quente: string
  frio: string
  chuva: string
  vento: string
  desconforto: string
}

export interface WeatherResponse {
  probabilidade: Probabilidade
  probabilidadePorHora: Record<string, Probabilidade>
  tempMedia: string
  confiabilidade: string
  anosStatus: AnoStatus
  // results: any[]
}

@Injectable()
export class WeatherService {
  async findAll(
    latitude: number,
    longitude: number,
    date: string,
    rangeYears: number
  ): Promise<WeatherResponse | null> {
    const mesDia = date.slice(4)
    const anoAtual = new Date().getFullYear()

    const contagem: Contagem = {
      quente: 0,
      frio: 0,
      chuva: 0,
      vento: 0,
      desconforto: 0,
      total: 0,
    }

    // 👇 contagens por hora (00 a 23)
    const contagemPorHora: Record<string, Contagem> = {}
    for (let h = 0; h < 24; h++) {
      const hora = h.toString().padStart(2, '0')
      contagemPorHora[hora] = {
        quente: 0,
        frio: 0,
        chuva: 0,
        vento: 0,
        desconforto: 0,
        total: 0,
      }
    }

    let somaTemp = 0
    let anosValidos = 0
    const anosStatus: AnoStatus = {}

    const requests: Promise<any>[] = []

    for (let i = 0; i < rangeYears; i++) {
      const ano = anoAtual - (i + 1)
      const dataHist = `${ano}${mesDia}`
      const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,PRECTOTCORR,WS2M&community=RE&longitude=${longitude}&latitude=${latitude}&start=${dataHist}&end=${dataHist}&format=JSON`

      requests.push(
        axios
          .get(url)
          .then((res) => res.data)
          .catch(() => null)
      )
    }

    const results = await Promise.all(requests)

    results.forEach((json, idx) => {
      if (!json?.properties?.parameter) return
      const p = json.properties.parameter
      const horas = Object.keys(p.T2M || {})

      if (horas.length === 0) return

      let somaT = 0
      let countT = 0
      let chuvaDia = 0
      let ventoDia = 0
      let tmax = -Infinity
      let tmin = Infinity

      horas.forEach((h) => {
        const hora = h.slice(-2) // ex: 20240425Z09 → '09'
        const t = p.T2M[h]
        const chuva = p.PRECTOTCORR[h]
        const vento = p.WS2M[h]

        if (t !== -999) {
          somaT += t
          countT++
          if (t > tmax) tmax = t
          if (t < tmin) tmin = t
        }

        if (chuva !== -999) chuvaDia += chuva
        if (vento !== -999 && vento > ventoDia) ventoDia = vento

        // 🕒 Contagem por hora
        const ch = contagemPorHora[hora]
        if (!ch) return

        if (t !== -999) {
          if (t > 30) ch.quente++
          if (t < 20) ch.frio++
        }
        if (chuva !== -999 && chuva > 0.1) ch.chuva++
        if (vento !== -999 && vento > 10) ch.vento++
        if ((t > 30 && chuva > 0.1) || (vento > 10 && chuva > 0.1))
          ch.desconforto++
        ch.total++
      })

      if (countT === 0) return
      anosValidos++

      const tempMedia = somaT / countT
      const ano = anoAtual - (idx + 1)

      if (tmax > 30) contagem.quente++
      if (tmin < 20) contagem.frio++
      if (chuvaDia > 1) contagem.chuva++
      if (ventoDia > 10) contagem.vento++
      if ((tmax > 30 && chuvaDia > 1) || (ventoDia > 10 && chuvaDia > 1))
        contagem.desconforto++

      somaTemp += tempMedia
      contagem.total++

      anosStatus[ano] = {
        chuva: chuvaDia > 1,
        sol: tmax > 20 && chuvaDia < 1,
        tempMedia: tempMedia.toFixed(1),
      }
    })

    if (contagem.total === 0) return null

    const prob = (x: number) => ((x / contagem.total) * 100).toFixed(1)
    const probPorHora = (x: number, total: number) =>
      total > 0 ? ((x / total) * 100).toFixed(1) : '0.0'

    // 🕐 Probabilidade por hora
    const probabilidadePorHora: Record<string, Probabilidade> = {}
    for (const [hora, c] of Object.entries(contagemPorHora)) {
      probabilidadePorHora[hora] = {
        quente: probPorHora(c.quente, c.total),
        frio: probPorHora(c.frio, c.total),
        chuva: probPorHora(c.chuva, c.total),
        vento: probPorHora(c.vento, c.total),
        desconforto: probPorHora(c.desconforto, c.total),
      }
    }

    return {
      probabilidade: {
        quente: prob(contagem.quente),
        frio: prob(contagem.frio),
        chuva: prob(contagem.chuva),
        vento: prob(contagem.vento),
        desconforto: prob(contagem.desconforto),
      },
      probabilidadePorHora,
      tempMedia: (somaTemp / contagem.total).toFixed(1),
      confiabilidade: ((anosValidos / rangeYears) * 100).toFixed(1),
      anosStatus,
      // results,
    }
  }
}
