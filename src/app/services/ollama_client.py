import re
import requests

OLLAMA_URL = "http://localhost:11434"

# remove blocos de raciocínio oculto do modelo
_THINK_RE = re.compile(r"<think>.*?</think>", flags=re.DOTALL | re.IGNORECASE)

def _strip_think(text: str) -> str:
    return _THINK_RE.sub("", text).strip()

def ask_ollama(prompt: str, model: str = "deepseek-r1:7b") -> str:
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,  # respostas mais estáveis
                    "num_ctx": 4096      # mais contexto, se suportado
                }
            },
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()
        answer = data.get("response", "")
        return _strip_think(answer)
    except Exception as e:
        return f"[ERRO] Não consegui falar com o Ollama: {e}"
