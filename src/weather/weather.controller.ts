import { Controller, Get, Query } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import { WeatherService } from './weather.service'

// Enums de exemplo (você pode mover para outro arquivo se quiser)
export enum TipoEntradaEnum {
  LINK = 'link',
  BASE64 = 'base64',
}

export enum AmbienteZeevEnum {
  HML = 'HML',
  PROD = 'PROD',
}

@ApiTags('Weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @ApiQuery({
    name: 'latitude',
    required: true,
    type: Number,
    example: -10.1234,
    description: 'Latitude do ponto de análise.',
  })
  @ApiQuery({
    name: 'longitude',
    required: true,
    type: Number,
    example: -55.9876,
    description: 'Longitude do ponto de análise.',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    example: '20250715',
    description: 'Data no formato YYYYMMDD para consulta histórica.',
  })
  @ApiQuery({
    name: 'rangeYears',
    required: true,
    type: Number,
    example: 10,
    description: 'Número de anos anteriores a serem analisados.',
  })
  async findAll(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('date') date: string,
    @Query('rangeYears') rangeYears: number,
  ) {
    return this.weatherService.findAll(latitude, longitude, date, rangeYears)
  }
}
