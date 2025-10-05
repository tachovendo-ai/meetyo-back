require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

async function listAvailableModels() {
    if (!apiKey) {
        console.error("Chave de API não encontrada no arquivo .env");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro da API: ${response.status} - ${JSON.stringify(errorData)}`);
        }
        
        const data = await response.json();
        
        console.log("--- Modelos disponíveis para sua chave de API ---");
        data.models.forEach(model => {
            console.log(`- ${model.name} (${model.displayName})`);
        });

    } catch (error) {
        console.error("Falha ao listar modelos:", error.message);
    }
}

listAvailableModels();