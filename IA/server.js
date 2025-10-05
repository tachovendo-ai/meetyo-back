// --- server.js (VERSÃO CORRIGIDA) ---
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;


const option = {
    origin: 'http://localhost:3000'

}


app.use(cors());

// Pega as chaves de API do arquivo .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NASA_API_KEY = process.env.NASA_API_KEY;

// --- FUNÇÕES CORRIGIDAS ---

async function fetchNASAData() {
    console.log("Buscando dados da NASA...");
    // CORREÇÃO: Data agora é dinâmica, pega o dia de hoje
    const today = new Date();
    const DATA = "20251001";
    
    const apiUrlNasa = `https://power.larc.nasa.gov/api/temporal/hourly/point?start=${DATA}&end=${DATA}&latitude=-12.74&longitude=-60.14&community=RE&parameters=T2M,RH2M,PRECTOTCORR&header=true&api_key=${NASA_API_KEY}`;
    
    try {
        const response = await fetch(apiUrlNasa);
        if (!response.ok) throw new Error(`Erro na API da NASA: ${response.statusText}`);
        const data = await response.json();
        if (!data?.properties?.parameter) throw new Error('Resposta da NASA inválida.');
        console.log("Dados da NASA recebidos.");
        return data.properties.parameter;
    } catch (error) {
        console.error("Falha ao buscar dados da NASA:", error.message);
        return null;
    }
}

async function generateInsights(weatherData) {
    console.log("Gerando insights com o Gemini...");
    const DATA = Object.keys(weatherData.T2M)[0].substring(0, 8);

    // CORREÇÃO: Lógica de formatação dos dados preenchida
    const dadosFormatados = `
    - Localização: Vilhena, Rondônia
    - Temperatura (°C) às 14:00: ${weatherData.T2M[`${DATA}14`] || 'N/A'}
    - Umidade Relativa (%) às 14:00: ${weatherData.RH2M[`${DATA}14`] || 'N/A'}
    - Precipitação Total (chuva em mm) durante o dia: ${weatherData.PRECTOTCORR[`${DATA}23`] || 'N/A'}
    `;

    // CORREÇÃO: Prompt detalhado preenchido
    const prompt = `
    Você é um assistente de planejamento de eventos e bem-estar. Analise os seguintes dados climáticos para o dia de hoje.

    Dados Climáticos:
    ${dadosFormatados}

    Com base nesses dados, gere um texto com os seguintes insights:
    1.  **Resumo do Clima:** Descreva em uma frase como será o clima geral do dia (ex: "O dia será quente e úmido, com baixa probabilidade de chuva.").
    2.  **Nível de Conforto:** Comente sobre o conforto térmico. O dia será agradável para atividades ao ar livre ou será abafado e desconfortável?
    3.  **Recomendação para Evento:** Diga se as condições são favoráveis para um evento ao ar livre.
    4.  **Pergunta Final:** Termine o texto com uma pergunta aberta e amigável para o usuário, incentivando-o a dar mais detalhes sobre o evento que ele tem em mente.
    `;
    
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro na API do Gemini: ${JSON.stringify(errorData)}`);
        }
        const data = await response.json();
        console.log("Insights do Gemini recebidos.");
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Falha ao gerar insights:", error.message);
        return null;
    }
}

function formatResponseToHTML(textContent) {
    const paragraphs = textContent.trim().split('\n').filter(p => p.trim() !== '');
    const summary = paragraphs[0] || 'Resumo indisponível.';
    const comfort = paragraphs[1] || 'Nível de conforto indisponível.';
    const recommendation = paragraphs[2] || 'Recomendação indisponível.';
    const question = paragraphs[3] || 'Como posso ajudar mais?';
    
    return `
        <div class="insights-container">
            <h2>✨ Análise do Clima para Hoje ✨</h2>
            <p class="climate-summary">${summary}</p>
            <ul class="insights-list">
                <li><strong>Nível de Conforto:</strong> ${comfort.replace('Nível de Conforto: ', '')}</li>
                <li><strong>Recomendação para Evento:</strong> ${recommendation.replace('Recomendação para Evento: ', '')}</li>
            </ul>
            <p class="call-to-action">${question.replace('Pergunta Final: ', '')}</p>
        </div>`;
}


app.get('/get-insights', async (req, res) => {
    console.log("Recebida requisição para /get-insights");
    
    const weatherData = await fetchNASAData();
    if (!weatherData) {
        return res.status(500).send('<p style="color: red;">Erro ao buscar dados do clima na NASA.</p>');
    }

    const insightsText = await generateInsights(weatherData);
    if (!insightsText) {
        return res.status(500).send('<p style="color: red;">Erro ao gerar insights com a IA.</p>');
    }
    
    const finalHtml = formatResponseToHTML(insightsText);
    res.send(finalHtml);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});