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

    // ✅ ADICIONADO: Documentação para os novos filtros no Swagger
    @ApiQuery({
        name: 'temperatura',
        required: false, // O filtro é opcional
        type: Boolean,
        example: true,
        description: 'Incluir dados de temperatura na análise. Padrão: true.',
    })
    @ApiQuery({
        name: 'chuva',
        required: false,
        type: Boolean,
        example: true,
        description: 'Incluir dados de chuva na análise. Padrão: true.',
    })
    @ApiQuery({
        name: 'vento',
        required: false,
        type: Boolean,
        example: false,
        description: 'Incluir dados de vento na análise. Padrão: true.',
    })
    @ApiQuery({
        name: 'umidade',
        required: false,
        type: Boolean,
        example: true,
        description: 'Incluir dados de umidade na análise. Padrão: true.',
    })
    async findAll(
        // Parâmetros obrigatórios
        @Query('latitude') latitude: number,
        @Query('longitude') longitude: number,
        @Query('date') date: string,
        @Query('rangeYears') rangeYears: number,

        // ✅ ADICIONADO: Parâmetros de filtro opcionais com valores padrão
        @Query('temperatura', new DefaultValuePipe(true), ParseBoolPipe) temperatura: boolean,
        @Query('chuva', new DefaultValuePipe(true), ParseBoolPipe) chuva: boolean,
        @Query('vento', new DefaultValuePipe(true), ParseBoolPipe) vento: boolean,
        @Query('umidade', new DefaultValuePipe(true), ParseBoolPipe) umidade: boolean,
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