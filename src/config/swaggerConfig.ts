import { DocumentBuilder } from '@nestjs/swagger';

export const SwaggerConfig = new DocumentBuilder()
  .setTitle('MEETYO API')
  .setDescription('This API provides access to personalized climate data and actionable recommendations, leveraging Earth observation data from NASA')
  .setVersion('1.0')
  .addTag('Weather', 'Endpoints for querying weather data and forecasts.')
//   .setExternalDoc('Clique aqui para gerar um token de acesso na microsoft', 'https://developer.microsoft.com/en-us/graph/graph-explorer')
//   .setContact(
//     'Setor de Inovação e Transformação Digital',
//     'https://www.sicoob.com.br/web/sicoobcredisul',
//     'desenvolvimento@sicoobcredisul.com.br',
//   )
//   .addBearerAuth()
  .build();