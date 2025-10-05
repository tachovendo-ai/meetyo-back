import { Controller, Get, Query, DefaultValuePipe, ParseBoolPipe } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { Filtros } from './weather.service'; // Importando a interface de filtros

@ApiTags('Weather')
@Controller('weather')
export class WeatherController {
    constructor(private readonly weatherService: WeatherService) { }

    @Get()
    // Documentação para os parâmetros existentes
    @ApiQuery({ name: 'latitude', required: true, type: Number, example: -10.1234 })
    @ApiQuery({ name: 'longitude', required: true, type: Number, example: -55.9876 })
    @ApiQuery({ name: 'date', required: true, type: String, example: '20251120' })
    @ApiQuery({ name: 'rangeYears', required: true, type: Number, example: 10 })

    @ApiQuery({
        name: 'temperature',
        required: false, // The filter is optional
        type: Boolean,
        example: true,
        description: 'Include temperature data in the analysis. Default: true.',
    })
    @ApiQuery({
        name: 'rain',
        required: false,
        type: Boolean,
        example: true,
        description: 'Include rain data in the analysis. Default: true.',
    })
    @ApiQuery({
        name: 'wind',
        required: false,
        type: Boolean,
        example: false,
        description: 'Include wind data in the analysis. Default: true.',
    })
    @ApiQuery({
        name: 'humidity',
        required: false,
        type: Boolean,
        example: true,
        description: 'Include humidity data in the analysis. Default: true.',
    })
    async findAll(
        // Parâmetros obrigatórios
        @Query('latitude') latitude: number,
        @Query('longitude') longitude: number,
        @Query('date') date: string,
        @Query('rangeYears') rangeYears: number,

        // ✅ ADICIONADO: Parâmetros de filtro opcionais com valores padrão
        @Query('temperature', new DefaultValuePipe(true), ParseBoolPipe) temperatura: boolean,
        @Query('rain', new DefaultValuePipe(true), ParseBoolPipe) chuva: boolean,
        @Query('wind', new DefaultValuePipe(true), ParseBoolPipe) vento: boolean,
        @Query('humidity', new DefaultValuePipe(true), ParseBoolPipe) umidade: boolean,
    ) {
        // Monta o objeto de filtros para enviar ao serviço
        const filtros: Filtros = {
            temperatura,
            chuva,
            vento,
            umidade,
        };

        // ✅ ALTERADO: Passa o objeto de filtros para o serviço
        return this.weatherService.findAll(
            latitude,
            longitude,
            date,
            rangeYears,
            filtros, // <-- objeto de filtros aqui
        );
    }
}