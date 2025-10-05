
const PARAMETROS = 'T2M,RH2M,PRECTOTCORR';

// --- CRIAÇÃO CORRETA DA DATA ---
const today = new Date();
const dataDay = String(today.getDate()).padStart(2, '0');
const dataMonth = String(today.getMonth() + 1).padStart(2, '0');
const dataYear = today.getFullYear();
const DATA = '20251001'; // Formato correto: YYYYMMDD

// Coordenadas de Vilhena
const latitude = '-12.7405600';
const longitude = '-60.1458300';



console.log(`Buscando dados HORÁRIOS para a data: ${DATA}`);

// --- URL CORRIGIDA PARA DADOS HORÁRIOS ---
// Note a mudança de /daily/ para /hourly/
const apiUrlNasa = `https://power.larc.nasa.gov/api/temporal/hourly/point?start=${DATA}&end=${DATA}&latitude=${latitude}&longitude=${longitude}&community=RE&parameters=${PARAMETROS}&header=true`;


fetch(apiUrlNasa)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Erro de rede: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    if (!data || !data.properties || !data.properties.parameter) {
      throw new Error('A resposta da API da NASA não contém dados válidos.');
    }
    
    console.log("Dados recebidos com sucesso!");
 
    
    const parametrosRecebidos = data.properties.parameter;
    //console.log(parametrosRecebidos)
  

   
  })
  
  .catch(error => {
    console.error("Falha na requisição:", error.message);
  });

