// --- client.js ---

document.addEventListener('DOMContentLoaded', () => {
    // Seleciona o botão e o container de resultado
    const getInsightsBtn = document.getElementById('getInsightsBtn');
    const resultContainer = document.getElementById('result-container');

    // Adiciona o Event Listener no botão
    getInsightsBtn.addEventListener('click', async () => {
        // Mostra uma mensagem de carregamento
        resultContainer.innerHTML = '<p>Buscando dados e gerando insights, por favor aguarde...</p>';
        getInsightsBtn.disabled = true; // Desabilita o botão para evitar múltiplos cliques

        try {
            // Chama o nosso back-end (que está rodando em http://localhost:3000)
            const response = await fetch('http://localhost:3000/get-insights');

            if (!response.ok) {
                throw new Error(`Erro do servidor: ${response.statusText}`);
            }

            // Pega a resposta (que é o HTML formatado) e a insere na página
            const htmlResult = await response.text();
            resultContainer.innerHTML = htmlResult;

        } catch (error) {
            // Mostra uma mensagem de erro se algo falhar
            resultContainer.innerHTML = `<p style="color: red;">Falha ao obter os insights: ${error.message}</p>`;
        } finally {
            // Reabilita o botão no final do processo
            getInsightsBtn.disabled = false;
        }
    });
});