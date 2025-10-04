from fastapi import APIRouter
from ..schemas import ChatRequest
from ..services.ollama_client import ask_ollama

router = APIRouter()

SYSTEM_PROMPT = """
Você é um assistente de CLIMA do Meetyo.
Regras:
- Escreva SOMENTE em português do Brasil, claro e natural.
- Seja curto e direto. NÃO use <think>. NÃO explique o processo.
- NUNCA repita dicas.
- Use “amanhã em <cidade/UF>”.
- Evite horários exatos; prefira períodos (manhã/tarde/noite).
- Use SEMPRE “Chance de ...” (não use “Previsto ...”).
- Evite termos vagos (ex.: “colete”); prefira “local interno” ou “rotas cobertas”.

Formato (preencha com conteúdo real, não copie o texto do formato):
Risco: (1 frase simples sobre chance de chuva, calor ou vento em <cidade/UF>)
• (dica prática 1, curta e específica)
• (dica prática 2, curta e diferente da primeira)
Plano B: (1 frase curta, ex.: considere atividade em local interno)
"""

@router.post("/chat")
def chat(req: ChatRequest):
    user = req.message.strip()
    # contexto enxuto ajuda modelos menores a manter foco.
    # Em MVP, fixamos local/data para demonstrar a estrutura; depois integraremos com mock real.
    contexto = "Local: Vilhena, RO. Data: amanhã."

    full_prompt = f"""{SYSTEM_PROMPT}

Contexto: {contexto}
Usuário: {user}
RESPOSTA:"""

    # Força modelo estável por padrão (pode trocar para deepseek-r1:7b se preferir)
    answer = ask_ollama(full_prompt, model="qwen2.5:3b-instruct")
    return {"answer": answer}
