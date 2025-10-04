from fastapi import APIRouter
from ..schemas import ChatRequest
from ..services.ollama_client import ask_ollama

router = APIRouter()

SYSTEM_PROMPT = """
Você é um assistente de CLIMA do projeto Meetyou.
INSTRUÇÕES:
- Responda SEMPRE em português simples e direto.
- NÃO use <think>.
- NÃO explique o processo.
- Estrutura da resposta (siga exatamente este formato, sem repeti-lo literalmente):
Risco: descreva em UMA frase se há chance de chuva, calor ou vento.
• dica prática 1
• dica prática 2
Plano B: descreva em UMA frase alternativa.
"""

@router.post("/chat")
def chat(req: ChatRequest):
    user = req.message.strip()
    # um contexto curtíssimo ajuda modelos menores a ficarem no tema
    contexto = "Local: Vilhena, RO. Data: amanhã. Época com chance de chuva e calor."

    full_prompt = f"""{SYSTEM_PROMPT}

Contexto: {contexto}
Usuário: {user}
Saída:"""

    # aqui garantimos o 7B
    answer = ask_ollama(full_prompt, model="deepseek-r1:7b")
    return {"answer": answer}

