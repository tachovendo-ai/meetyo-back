import re
import requests

OLLAMA_URL = "http://localhost:11434"

# remove blocos <think> se algum modelo gerar
_THINK_RE = re.compile(r"<think>.*?</think>", flags=re.DOTALL | re.IGNORECASE)

def _strip_think(text: str) -> str:
    return _THINK_RE.sub("", text or "").strip()

def _post_format(text: str) -> str:
    """Acabamento da resposta: PT-BR natural, bullets, evita 'previsto', horários exatos, etc."""
    t = (text or "").replace("\r", "").strip()

    # linhas não vazias
    lines = [ln.strip() for ln in t.split("\n") if ln.strip()]

    # padroniza bullets e limpa "no amanhã"
    fixed = []
    for ln in lines:
        # bullets começam com •
        if ln.startswith("- "):
            ln = "• " + ln[2:].strip()
        # corrigir "no amanhã" -> "amanhã"
        if ln.lower().startswith("risco:"):
            ln = re.sub(r"\bno\s+amanh[ãa]o?\b", "amanhã", ln, flags=re.IGNORECASE)
        fixed.append(ln)

    t = "\n".join(fixed).strip()

    # substituições de tom/termos
    # "Previsto/Prevista" -> "Chance de"
    t = re.sub(r"\b[Pp]revist[oa]\b", "Chance de", t)

    # evitar horários exatos (ex.: "após as 14h") -> "à tarde"
    t = re.sub(r"\b(ap[oó]s\s+as\s+\d{1,2}h)\b", "à tarde", t, flags=re.IGNORECASE)
    t = re.sub(r"\bentre\s+\d{1,2}h\s+e\s+\d{1,2}h\b", "no período da tarde", t, flags=re.IGNORECASE)

    # troca termos vagos "colete" -> "local interno"
    t = re.sub(r"\bcolete\b", "local interno", t, flags=re.IGNORECASE)

    # garantir exatamente 2 bullets
    lines = [ln.strip() for ln in t.split("\n") if ln.strip()]
    bullets_idx = [i for i, ln in enumerate(lines) if ln.startswith("• ")]
    if len(bullets_idx) > 2:
        keep = set(bullets_idx[:2])
        lines = [ln for i, ln in enumerate(lines) if not ln.startswith("• ") or i in keep]
    elif len(bullets_idx) == 1:
        # adiciona segunda dica padrão útil
        lines.insert(bullets_idx[0] + 1, "• Consulte o app de clima/radar antes de sair.")

    # garantir Plano B
    if not any(ln.lower().startswith("plano b:") for ln in lines):
        lines.append("Plano B: considere atividade em local interno ou rotas cobertas.")

    # se faltar "Vilhena" na linha de risco e o usuário perguntou de Vilhena, tenta inserir (defensivo)
    for i, ln in enumerate(lines):
        if ln.lower().startswith("risco:") and "Vilhena" not in ln:
            lines[i] = ln.replace("Risco:", "Risco: Vilhena, RO —", 1)
            break

    # remover duplicatas triviais de dica (ex.: duas vezes guarda-chuva)
    if "• " in lines:
        tips = [ln for ln in lines if ln.startswith("• ")]
        if len(tips) >= 2:
            t1, t2 = tips[0].lower(), tips[1].lower()
            if (("guarda" in t1 or "capa" in t1) and ("guarda" in t2 or "capa" in t2)) or t1 == t2:
                for i, ln in enumerate(lines):
                    if ln == tips[1]:
                        lines[i] = "• Verifique o app de clima antes de sair."
                        break

    return "\n".join(lines).strip()

def ask_ollama(prompt: str, model: str = "qwen2.5:3b-instruct") -> str:
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
            timeout=300,
        )
        r.raise_for_status()
        data = r.json()
        return _post_format(_strip_think(data.get("response", "")))
    except Exception as e:
        return f"[ERRO] Não consegui falar com o Ollama: {e}"
