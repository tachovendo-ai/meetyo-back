from fastapi import APIRouter
from ..schemas import ChatRequest
from ..services.ollama_client import ask_ollama

router = APIRouter()

SYSTEM_PROMPT = """
Você é um assistente de CLIMA do projeto Meetyou.
REGRAS:
- Responda SEMPRE em português simples e direto.
- NÃO use <think> nem explique o processo.
- NUNCA invente palavras.
- Formato de saída:
  Risco: (1 frase sobre chuva/calor/vento)
  • dica 1
  • dica 2
  Plano B: (1 frase)
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

