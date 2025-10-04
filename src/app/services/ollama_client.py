import re
import requests

OLLAMA_URL = "http://localhost:11434"

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
                    "temperature": 0.1,
                    "num_ctx": 2048
                }
            },
            timeout=600,
        )
        r.raise_for_status()
        data = r.json()
        return _strip_think(data.get("response", ""))
    except Exception as e:
        return f"[ERRO] Não consegui falar com o Ollama: {e}"
