"""
Robo coletor de noticias do Portal de Saneamento.

O QUE ELE FAZ:
  1. Le a lista de empresas em config.json
  2. Para cada empresa, tenta buscar noticias por RSS (se tiver) ou varrendo
     a pagina de noticias em HTML (se nao tiver RSS)
  3. Filtra so as noticias que parecem ser sobre PROJETOS (novos, em teste,
     inaugurados etc) usando a lista de palavras-chave do config.json
  4. Descarta links de menu/rodape/paginas genericas e links quebrados
     (faz uma checagem real se a pagina existe antes de salvar)
  5. Junta tudo com o que ja existia em data/noticias.json (sem duplicar)
  6. Salva o resultado final em data/noticias.json, que e o arquivo que o
     site le para mostrar as noticias

COMO RODAR MANUALMENTE:
  pip install -r requirements.txt
  python coletar_noticias.py

COMO RODAR AUTOMATICO TODA MES:
  Ja esta configurado em .github/workflows/coletar-mensal.yml
  Ver instrucoes no README.md
"""

import json
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

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

# Textos de link que quase sempre sao menu/rodape/navegacao, nao noticia.
# Se o texto do link for exatamente (ou quase) um desses, e descartado.
TEXTOS_IGNORADOS = {
    "menu", "home", "inicio", "início", "contato", "fale conosco", "ouvidoria",
    "sobre", "sobre nos", "sobre nós", "quem somos", "transparência",
    "transparencia", "login", "entrar", "cadastre-se", "cadastrar",
    "política de privacidade", "politica de privacidade", "termos de uso",
    "termos e condições", "lgpd", "acessibilidade", "mapa do site",
    "redes sociais", "facebook", "instagram", "twitter", "linkedin",
    "youtube", "whatsapp", "telefone", "e-mail", "email", "buscar",
    "pesquisar", "ver mais", "ver todas", "leia mais", "saiba mais",
    "compartilhar", "imprimir", "voltar", "próxima", "proxima", "anterior",
    "carregar mais", "notícias", "noticias", "imprensa", "clipping",
    "trabalhe conosco", "licitações", "licitacoes", "editais", "ouvidoria",
    "2ª via", "segunda via", "fatura", "boleto", "serviços", "servicos",
    "portal do cliente", "área do cliente", "area do cliente",
}

# Trechos de URL que indicam pagina generica (nao artigo especifico)
URL_IGNORAR_SE_CONTEM = [
    "/wp-login", "/login", "/cadastro", "javascript:", "mailto:", "tel:",
    "/busca?", "?s=", "/tag/", "/categoria/", "/category/", "/page/",
    "#", "/feed", "/rss", "/contato", "/fale-conosco", "/ouvidoria",
    "/2via", "/2-via", "/segunda-via", "/politica-de-privacidade",
    "/termos-de-uso", "/acessibilidade", "/lgpd",
]


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


def normalizar_titulo(titulo):
    """Deixa o titulo 'limpo' pra comparar e evitar duplicados parecidos."""
    t = (titulo or "").lower().strip()
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"[^\w\s]", "", t)
    return t


def parece_projeto(texto, palavras_chave, palavras_excluir):
    texto = (texto or "").lower()

    # se tiver qualquer termo de incidente/rotina, descarta na hora,
    # mesmo que tambem contenha uma palavra-chave de projeto
    if any(p.lower() in texto for p in palavras_excluir):
        return False

    return any(p.lower() in texto for p in palavras_chave)


def parece_link_de_menu(texto, href):
    """Filtra links que quase certamente sao menu/rodape, nao noticia."""
    texto_limpo = (texto or "").strip().lower()

    if texto_limpo in TEXTOS_IGNORADOS:
        return True

    # texto muito curto ou so numeros/pontuacao nao e manchete de verdade
    if len(texto_limpo) < 25:
        return True

    palavras = texto_limpo.split()
    if len(palavras) < 5:
        return True

    href_lower = (href or "").lower()
    if any(trecho in href_lower for trecho in URL_IGNORAR_SE_CONTEM):
        return True

    return False


def link_existe(url):
    """Confere se a pagina realmente existe (evita salvar link quebrado)."""
    try:
        resp = requests.head(
            url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True
        )
        if resp.status_code == 405:  # site nao aceita HEAD, tenta GET
            resp = requests.get(
                url, headers=HEADERS, timeout=TIMEOUT, stream=True
            )
        return resp.status_code < 400
    except Exception:
        return False


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
    ser materias de verdade (nao menu, nao rodape, nao pagina quebrada).

    ATENCAO: isso e um fallback generico. Sites de orgaos publicos mudam de
    layout com frequencia — se uma empresa parar de aparecer no site, o
    ajuste mais provavel e customizar o seletor CSS aqui pra essa empresa
    especifica.
    """
    candidatos = []
    resp = requests.get(empresa["pagina_noticias"], headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    vistos_na_pagina = set()

    for a in soup.find_all("a", href=True):
        texto = a.get_text(strip=True)
        href = a["href"]

        if parece_link_de_menu(texto, href):
            continue

        link_completo = urljoin(empresa["pagina_noticias"], href)

        # ignora links que voltam pra propria pagina de listagem ou pra home
        if link_completo.rstrip("/") in (
            empresa["pagina_noticias"].rstrip("/"),
            empresa["site"].rstrip("/"),
        ):
            continue

        if link_completo in vistos_na_pagina:
            continue
        vistos_na_pagina.add(link_completo)

        candidatos.append(
            {
                "titulo": texto,
                "resumo": "",
                "link": link_completo,
                "data_publicada": "",
            }
        )

    # Confere se o link realmente abre (evita 404) — so faz isso pros
    # candidatos que ja passaram no filtro de texto, pra nao gastar tempo
    # checando menu/rodape que ja foi descartado acima.
    validos = []
    for c in candidatos[:40]:  # limite de seguranca por empresa
        if link_existe(c["link"]):
            validos.append(c)

    return validos[:30]


def coletar_empresa(empresa, palavras_chave, palavras_excluir):
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
    titulos_normalizados_nesta_rodada = set()

    for n in brutas:
        texto_para_filtro = f"{n['titulo']} {n['resumo']}"
        if not parece_projeto(texto_para_filtro, palavras_chave, palavras_excluir):
            continue

        titulo_norm = normalizar_titulo(n["titulo"])
        if titulo_norm in titulos_normalizados_nesta_rodada:
            continue  # duplicado dentro da mesma coleta
        titulos_normalizados_nesta_rodada.add(titulo_norm)

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

    print(f"   {len(filtradas)} noticia(s) relevante(s) e validada(s) encontradas")
    return filtradas


def main():
    config = carregar_config()
    existentes = carregar_noticias_existentes()
    ids_existentes = {n["id"] for n in existentes}
    titulos_existentes = {normalizar_titulo(n["titulo"]) for n in existentes}

    novas_total = []
    for empresa in config["empresas"]:
        novas = coletar_empresa(
            empresa, config["palavras_chave_projeto"], config["palavras_chave_excluir"]
        )
        for n in novas:
            titulo_norm = normalizar_titulo(n["titulo"])
            if n["id"] in ids_existentes or titulo_norm in titulos_existentes:
                continue
            novas_total.append(n)
            ids_existentes.add(n["id"])
            titulos_existentes.add(titulo_norm)

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
