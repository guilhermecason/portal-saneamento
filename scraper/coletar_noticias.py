"""
Robo coletor de noticias do Portal de Saneamento.

O QUE ELE FAZ:
  1. Le a lista de empresas em config.json
  2. Para cada empresa, tenta buscar noticias por RSS (se tiver) ou varrendo
     a pagina de noticias em HTML (se nao tiver RSS)
  3. Filtra so as noticias que parecem ser sobre PROJETOS (novos, em teste,
     inaugurados etc) usando a lista de palavras-chave do config.json
  4. Junta tudo com o que ja existia em data/noticias.json (sem duplicar)
  5. Salva o resultado final em data/noticias.json, que e o arquivo que o
     site le para mostrar as noticias

COMO RODAR MANUALMENTE:
  pip install -r requirements.txt
  python coletar_noticias.py

COMO RODAR AUTOMATICO TODA SEMANA:
  Ja esta configurado em .github/workflows/coletar-mensal.yml
  Ver instrucoes no README.md
"""

import json
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import feedparser
import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "scraper" / "config.json"
DATA_PATH = BASE_DIR / "data" / "noticias.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; PortalSaneamentoBot/1.0; "
        "+https://github.com/) coletor-de-noticias-educacional"
    )
}

TIMEOUT = 15


def carregar_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def carregar_noticias_existentes():
    if DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def gerar_id(link, titulo):
    """Gera um ID estavel pra noticia, pra nao duplicar quando rodar de novo."""
    base = (link or titulo or "").strip().lower()
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def parece_projeto(texto, palavras_chave):
    texto = (texto or "").lower()
    return any(p.lower() in texto for p in palavras_chave)


def classificar_status(texto):
    """Tenta adivinhar se e projeto 'em teste' ou 'em operacao' pelo texto."""
    texto = (texto or "").lower()
    termos_teste = ["piloto", "teste", "testes", "fase de teste", "experimental"]
    if any(t in texto for t in termos_teste):
        return "em_teste"
    return "em_operacao"


def coletar_via_rss(empresa):
    noticias = []
    feed = feedparser.parse(empresa["rss"], request_headers=HEADERS)
    for entrada in feed.entries[:20]:
        titulo = entrada.get("title", "").strip()
        resumo = re.sub("<[^<]+?>", "", entrada.get("summary", "")).strip()
        link = entrada.get("link", "")
        data_pub = entrada.get("published", "") or entrada.get("updated", "")
        noticias.append(
            {
                "titulo": titulo,
                "resumo": resumo,
                "link": link,
                "data_publicada": data_pub,
            }
        )
    return noticias


def coletar_via_html(empresa):
    """
    Varredura generica: pega links da pagina de noticias que parecem
    ser materias (texto do link com mais de ~25 caracteres).

    ATENCAO: isso e um fallback generico. Sites de orgaos publicos mudam de
    layout com frequencia — se uma empresa parar de aparecer no site, o
    ajuste mais provavel e customizar o seletor CSS aqui pra essa empresa
    especifica (ver comentario mais abaixo).
    """
    noticias = []
    resp = requests.get(empresa["pagina_noticias"], headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    candidatos = soup.find_all("a", href=True)
    vistos = set()

    for a in candidatos:
        texto = a.get_text(strip=True)
        href = a["href"]

        if not texto or len(texto) < 25:
            continue
        if href in vistos:
            continue
        vistos.add(href)

        link_completo = urljoin(empresa["pagina_noticias"], href)

        noticias.append(
            {
                "titulo": texto,
                "resumo": "",
                "link": link_completo,
                "data_publicada": "",
            }
        )

    return noticias[:30]


def coletar_empresa(empresa, palavras_chave):
    print(f"-> Coletando: {empresa['nome']}")
    brutas = []

    try:
        if empresa.get("rss"):
            brutas = coletar_via_rss(empresa)
        else:
            brutas = coletar_via_html(empresa)
    except Exception as erro:
        print(f"   [erro] Nao consegui coletar de {empresa['nome']}: {erro}")
        return []

    filtradas = []
    for n in brutas:
        texto_para_filtro = f"{n['titulo']} {n['resumo']}"
        if not parece_projeto(texto_para_filtro, palavras_chave):
            continue

        filtradas.append(
            {
                "id": gerar_id(n["link"], n["titulo"]),
                "empresa_id": empresa["id"],
                "empresa_nome": empresa["nome"],
                "estado": empresa["estado"],
                "titulo": n["titulo"],
                "resumo": n["resumo"],
                "link": n["link"],
                "data_publicada": n["data_publicada"],
                "status": classificar_status(texto_para_filtro),
                "coletado_em": datetime.now(timezone.utc).isoformat(),
            }
        )

    print(f"   {len(filtradas)} noticia(s) relevante(s) encontradas")
    return filtradas


def main():
    config = carregar_config()
    existentes = carregar_noticias_existentes()
    ids_existentes = {n["id"] for n in existentes}

    novas_total = []
    for empresa in config["empresas"]:
        novas = coletar_empresa(empresa, config["palavras_chave_projeto"])
        for n in novas:
            if n["id"] not in ids_existentes:
                novas_total.append(n)
                ids_existentes.add(n["id"])

    resultado = novas_total + existentes
    # mais recentes primeiro (quando tem data), limitando o arquivo a 300 itens
    resultado = resultado[:300]

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"\nConcluido. {len(novas_total)} noticia(s) nova(s) adicionada(s).")
    print(f"Total no arquivo: {len(resultado)}")


if __name__ == "__main__":
    main()
