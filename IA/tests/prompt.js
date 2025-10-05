
require('dotenv').config();

// --- CONFIGURAÇÃO DAS CHAVES DE API ---
// Pega as chaves do arquivo .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NASA_API_KEY = process.env.NASA_API_KEY; // Adicione esta linha ao seu .env

if (!GEMINI_API_KEY) {
    throw new Error("Verifique se GEMINI_API_KEY e NASA_API_KEY estão definidas no arquivo .env");
}

/**
 * 1. FUNÇÃO PARA BUSCAR DADOS DA NASA
 * Busca os dados meteorológicos horários para uma data e local específicos.
 * @returns {Promise<object|null>} Um objeto com os dados do clima ou null em caso de erro.
 */
async function fetchNASAData() {
    const PARAMETROS = 'T2M,RH2M,PRECTOTCORR'; // Temperatura, Umidade, Precipitação

    const DATA = `20251001`;

    const latitude = '-12.7405600'; // Vilhena, RO
    const longitude = '-60.1458300';

    console.log(`Buscando dados da NASA para Vilhena em ${DATA}...`);
    
    const apiUrlNasa = `https://power.larc.nasa.gov/api/temporal/hourly/point?start=${DATA}&end=${DATA}&latitude=${latitude}&longitude=${longitude}&community=RE&parameters=${PARAMETROS}&header=true`;

    try {
        const response = await fetch(apiUrlNasa);
        if (!response.ok) {
            throw new Error(`Erro na API da NASA: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data || !data.properties || !data.properties.parameter) {
            throw new Error('A resposta da NASA não contém dados válidos.');
        }
        
        console.log("Dados da NASA recebidos com sucesso!");
        return data.properties.parameter; // Retorna os dados para a próxima função

    } catch (error) {
        console.error("Falha ao buscar dados da NASA:", error.message);
        return null; // Retorna nulo para indicar que houve um erro
    }
}

// ... (mantenha a função fetchNASAData como está) ...

/**
 * NOVA FUNÇÃO: Formata o texto puro do Gemini em um bloco HTML.
 * @param {string} textContent - O texto recebido da API Gemini.
 * @returns {string} Uma string contendo o bloco de HTML formatado.
 */
function formatResponseToHTML(textContent) {
    // Divide o texto em parágrafos (assumindo que o Gemini usa quebras de linha)
    const paragraphs = textContent.trim().split('\n').filter(p => p);

    // Pega as partes principais do texto
    const summary = paragraphs[0] || '';
    const comfort = paragraphs[1] || '';
    const recommendation = paragraphs[2] || '';
    const question = paragraphs[3] || '';

    // Monta a string HTML
    const html = `
        <div class="insights-container">
            <h2>✨ Análise do Clima para Hoje ✨</h2>
            <p class="climate-summary">${summary}</p>
            
            <ul class="insights-list">
                <li><strong>Nível de Conforto:</strong> ${comfort.replace('Devido à alta umidade, ', '')}</li>
                <li><strong>Recomendação para Evento:</strong> ${recommendation.replace('Apesar do calor, ', '')}</li>
            </ul>

            <p class="call-to-action">${question}</p>
        </div>
    `;

    return html;
}


/**
 * 2. FUNÇÃO generateInsights MODIFICADA
 * Agora ela chama a função de formatação e exibe o HTML.
 */
async function generateInsights(weatherData) {
    console.log("Enviando dados para o Gemini para gerar insights...");
    // ... (toda a lógica de formatação de dados e o prompt continuam iguais) ...
    const dadosFormatados = `...`;
    const prompt = `...`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const options = { /* ... */ };

    try {
        const response = await fetch(url, options);
        if (!response.ok) { /* ... */ }

        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        
        // --- MUDANÇA PRINCIPAL AQUI ---
        // Em vez de apenas imprimir o texto, formatamos para HTML
        const htmlOutput = formatResponseToHTML(content);

        console.log("\n--- HTML Gerado para o Template ---\n");
        console.log(htmlOutput); // Agora isso imprime o bloco de HTML pronto

    } catch (error) {
        console.error("Falha ao gerar insights com o Gemini:", error.message);
    }
}


/**
 * 3. FUNÇÃO PRINCIPAL
 * Orquestra o processo: busca dados da NASA e depois gera os insights.
 */
async function main() {
    const weatherData = await fetchNASAData();
    
    // Só continua se os dados da NASA foram obtidos com sucesso
    if (weatherData) {
        await generateInsights(weatherData);
    } else {
        console.log("\nNão foi possível gerar insights pois os dados do clima não foram obtidos.");
    }
}

// Executa o script
main();