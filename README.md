# Rede Saneamento — Portal de Projetos

Portal de notícias que reúne, automaticamente, projetos novos, em teste ou já em operação nas maiores empresas de saneamento do Brasil.

## O que já vem pronto

- **Site** (`index.html`, `style.css`, `script.js`) — mostra as notícias em cards, com filtro por status (em teste / em operação) e por empresa.
- **Robô coletor** (`scraper/coletar_noticias.py`) — busca notícias das empresas configuradas, filtra só o que parece ser sobre projetos, e salva em `data/noticias.json`.
- **Automação mensal** (`.github/workflows/coletar-mensal.yml`) — roda o robô todo dia 1º de cada mês, às 8h (horário de Brasília) sozinho, sem você precisar fazer nada, uma vez publicado no GitHub.
- **Dados de exemplo** já estão em `data/noticias.json` para você ver o site funcionando antes mesmo do robô rodar de verdade.

---

## 1. Ver o site funcionando agora (no seu computador)

Não precisa instalar nada além de abrir um servidor local simples, porque o navegador bloqueia `fetch` de arquivos abertos direto com duplo clique.

Se você tem Python instalado, dentro da pasta do projeto:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

---

## 2. Publicar o site de graça (GitHub Pages)

1. Crie uma conta no [GitHub](https://github.com) se ainda não tiver.
2. Crie um repositório novo (pode ser público) e suba todos os arquivos desta pasta.
3. No repositório, vá em **Settings → Pages**.
4. Em "Source", selecione a branch `main` e a pasta `/ (root)`.
5. Salve. Em alguns minutos seu site estará no ar em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

---

## 3. Ativar a coleta automática mensal

Isso já está configurado no arquivo `.github/workflows/coletar-mensal.yml`. Você só precisa:

1. Ter subido o projeto pro GitHub (passo 2 acima).
2. Ir na aba **Settings → Actions → General** do repositório e garantir que "Workflow permissions" está como **Read and write permissions** (precisa disso pra o robô conseguir salvar as notícias novas sozinho).
3. Pronto — todo mês o robô roda sozinho e atualiza `data/noticias.json`, e o site (que lê esse arquivo) mostra as notícias novas automaticamente.

Quer testar sem esperar o próximo mês? Vá na aba **Actions** do repositório, clique no workflow "Coletar noticias mensalmente" e depois em **Run workflow**.

---

## 5. Sobre as fontes internacionais (Singapura, Israel, Estados Unidos)

O portal também acompanha três referências internacionais em gestão de água:

- **PUB** — Agência Nacional de Águas de Singapura
- **Mekorot** — Companhia Nacional de Água de Israel
- **EPA** — Agência de Proteção Ambiental dos EUA (programa de reúso de água)

Essas são **agências/companhias públicas**, não empresas privadas como as brasileiras — por isso elas têm menos notícias "de projeto pontual" e mais anúncios de política pública, financiamento e parcerias de pesquisa. O robô trata elas do mesmo jeito (mesmo filtro de palavras-chave, agora incluindo termos em inglês como "pilot", "reuse", "desalination"), mas vale checar de vez em quando se `pagina_noticias` ainda é a página certa — sites de agências de governo mudam de estrutura de tempos em tempos.

---

## 6. Ajustar as empresas acompanhadas

Edite `scraper/config.json`. Cada empresa tem:

```json
{
  "id": "sabesp",
  "nome": "Sabesp",
  "estado": "SP",
  "site": "https://www.sabesp.com.br",
  "pagina_noticias": "https://www.sabesp.com.br/a-sabesp/central-noticias/noticias",
  "rss": null
}
```

- Se a empresa tiver um feed RSS de notícias, cole a URL no campo `"rss"` — é o método mais confiável.
- Se não tiver, deixe `"rss": null` e o robô tenta varrer a `pagina_noticias` sozinho (menos preciso, mas funciona como ponto de partida).

Você pode adicionar, remover ou trocar qualquer empresa da lista — só seguir esse mesmo formato.

## Sobre os filtros de palavra-chave

O robô só guarda notícias cujo título/resumo contém alguma palavra da lista `palavras_chave_projeto` (também em `config.json`) — coisas como "projeto", "obra", "piloto", "inaugur", "ETE", "tecnologia" etc. Ajuste essa lista se quiser pegar mais ou menos notícias.

---

## ⚠️ Limitações importantes (leia antes de confiar 100% nos dados)

- **Sites sem RSS são varridos de forma genérica.** O robô pega links que parecem manchetes na página de notícias. Isso funciona bem em alguns sites e mal em outros — sites com muito JavaScript ou layout incomum podem trazer lixo ou nada. Se perceber isso numa empresa específica, me avise ou ajuste o código de coleta pra HTML dela (posso te ajudar a fazer isso).
- **URLs das páginas de notícias podem mudar.** Empresas públicas às vezes trocam de site. Se uma empresa parar de trazer notícias, o primeiro passo é checar se `pagina_noticias` no `config.json` ainda está certa.
- **Sempre leia a matéria original** antes de republicar qualquer coisa — o robô só coleta título/resumo/link, nunca o texto completo (isso é de propósito, por causa de direitos autorais).

---

## Estrutura de pastas

```
portal-saneamento/
├── index.html              → página principal
├── style.css                → visual do site
├── script.js                → carrega e filtra as notícias
├── data/
│   └── noticias.json        → onde as notícias ficam salvas
├── scraper/
│   ├── coletar_noticias.py  → o robô coletor
│   ├── config.json          → lista de empresas e palavras-chave
│   └── requirements.txt     → dependências Python
└── .github/workflows/
    └── coletar-mensal.yml  → agenda a coleta automática
```
