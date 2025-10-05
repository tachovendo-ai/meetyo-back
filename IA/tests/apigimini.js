
require('dotenv').config();

// Pega a chave da API do arquivo .env
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("A variável de ambiente GEMINI_API_KEY não foi definida.");
}

// A função principal precisa ser 'async' para usarmos 'await'
async function main() {
    console.log("Enviando requisição para a API do Gemini...");

    const payload = {
        contents: [
            {
                parts: [
                    { text: 'Explique como a IA funciona em poucas palavras' },
                ],
            },
        ],
    };

    // AQUI ESTÁ A CORREÇÃO FINAL: Usando o modelo gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro da API: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        
        console.log("\n--- Resposta da IA ---");
        console.log(content);

    } catch (error) {
        console.error("Falha ao executar a função:", error.message);
    }
}

// Executa a função principal
main();
