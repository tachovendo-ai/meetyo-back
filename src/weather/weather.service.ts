import { Injectable } from '@nestjs/common'
import axios from 'axios'

export interface AnoStatus {
  [ano: number]: {
    chuva: boolean
    sol: boolean
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
  tempMedia: string
  confiabilidade: string
  anosStatus: AnoStatus
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

    let somaTemp = 0
    let anosValidos = 0
    const anosStatus: AnoStatus = {}

    const requests: Promise<any>[] = []

    for (let i = 0; i < rangeYears; i++) {
      const ano = anoAtual - (i + 1)
      const dataHist = `${ano}${mesDia}`
      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M&community=AG&longitude=${longitude}&latitude=${latitude}&start=${dataHist}&end=${dataHist}&format=JSON`

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
      const dataKey = Object.keys(p.T2M_MAX)[0]

      const tmax = p.T2M_MAX[dataKey]
      const tmin = p.T2M_MIN[dataKey]
      const chuva = p.PRECTOTCORR[dataKey]
      const vento = p.WS2M[dataKey]
      const ano = anoAtual - (idx + 1)

      if (tmax !== -999 || tmin !== -999 || chuva !== -999 || vento !== -999) {
        anosValidos++

        if (tmax !== -999 && tmax > 30) contagem.quente++
        if (tmin !== -999 && tmin < 20) contagem.frio++
        if (chuva !== -999 && chuva > 1) contagem.chuva++
        if (vento !== -999 && vento > 80) contagem.vento++
        if (
          (tmax !== -999 && chuva !== -999 && tmax > 30 && chuva > 1) ||
          (vento !== -999 && chuva !== -999 && vento > 80 && chuva > 1)
        ) {
          contagem.desconforto++
        }

        if (tmax !== -999 && tmin !== -999) {
          somaTemp += (tmax + tmin) / 2
        }

        contagem.total++

        anosStatus[ano] = {
          chuva: chuva !== -999 && chuva > 1,
          sol: tmax !== -999 && tmax > 20,
        }
      }
    })

    if (contagem.total === 0) return null

    const prob = (x: number) => ((x / contagem.total) * 100).toFixed(1)

    return {
      probabilidade: {
        quente: prob(contagem.quente),
        frio: prob(contagem.frio),
        chuva: prob(contagem.chuva),
        vento: prob(contagem.vento),
        desconforto: prob(contagem.desconforto),
      },
      tempMedia: (somaTemp / contagem.total).toFixed(1),
      confiabilidade: ((anosValidos / rangeYears) * 100).toFixed(1),
      anosStatus,
    }
  }
}
