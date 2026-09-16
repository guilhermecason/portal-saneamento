const STATUS_LABEL = {
  em_teste: "Em teste",
  em_operacao: "Em operação",
};

const BANDEIRA_PAIS = {
  "Singapura": "🇸🇬",
  "Israel": "🇮🇱",
  "Estados Unidos": "🇺🇸",
};

let TODAS_NOTICIAS = [];
let filtroStatus = "todos";
let filtroEmpresa = "todos";
let filtroAno = "todos";

function dataParaOrdenar(noticia) {
  // Prioriza a data de publicacao; se nao tiver (ou for invalida),
  // usa a data em que o robo coletou como aproximacao.
  const candidatos = [noticia.data_publicada, noticia.coletado_em];
  for (const c of candidatos) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0); // sem nenhuma data valida, vai pro final
}

async function carregarNoticias() {
  try {
    const resp = await fetch("data/noticias.json", { cache: "no-store" });
    TODAS_NOTICIAS = await resp.json();
  } catch (erro) {
    console.error("Não consegui carregar as notícias:", erro);
    TODAS_NOTICIAS = [];
  }

  // mais recentes primeiro
  TODAS_NOTICIAS.sort((a, b) => dataParaOrdenar(b) - dataParaOrdenar(a));

  montarFiltrosDeEmpresa();
  montarFiltroDeAno();
  atualizarMeta();
  renderizarCards();
}

function montarFiltroDeAno() {
  const anos = [...new Set(
    TODAS_NOTICIAS.map((n) => dataParaOrdenar(n).getFullYear())
  )].sort((a, b) => b - a);

  const select = document.getElementById("year-filter");
  select.innerHTML = '<option value="todos">Todos os anos</option>';

  anos.forEach((ano) => {
    const option = document.createElement("option");
    option.value = ano;
    option.textContent = ano;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    filtroAno = select.value;
    renderizarCards();
  });
}

function montarFiltrosDeEmpresa() {
  const empresas = [...new Map(
    TODAS_NOTICIAS.map((n) => [n.empresa_id, n.empresa_nome])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const select = document.getElementById("company-filter");
  select.innerHTML = '<option value="todos">Todas as empresas</option>';

  empresas.forEach(([id, nome]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = nome;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    filtroEmpresa = select.value;
    renderizarCards();
  });
}

function atualizarMeta() {
  const empresasUnicas = new Set(TODAS_NOTICIAS.map((n) => n.empresa_id)).size;
  document.getElementById("meta-empresas").textContent = empresasUnicas || "0";
  document.getElementById("meta-projetos").textContent = TODAS_NOTICIAS.length;

  const datas = TODAS_NOTICIAS
    .map((n) => n.coletado_em)
    .filter(Boolean)
    .sort();
  const maisRecente = datas[datas.length - 1];
  document.getElementById("meta-data").textContent = maisRecente
    ? new Date(maisRecente).toLocaleDateString("pt-BR")
    : "—";
}

function renderizarCards() {
  const container = document.getElementById("cards-container");
  const vazio = document.getElementById("empty-state");
  const contagem = document.getElementById("results-count");

  const filtradas = TODAS_NOTICIAS.filter((n) => {
    const passaStatus = filtroStatus === "todos" || n.status === filtroStatus;
    const passaEmpresa = filtroEmpresa === "todos" || n.empresa_id === filtroEmpresa;
    const passaAno = filtroAno === "todos" || String(dataParaOrdenar(n).getFullYear()) === filtroAno;
    return passaStatus && passaEmpresa && passaAno;
  });

  container.innerHTML = "";
  contagem.textContent = `${filtradas.length} resultado(s)`;

  if (filtradas.length === 0) {
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  filtradas.forEach((n) => container.appendChild(criarCard(n)));
}

function criarCard(noticia) {
  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");

  const dataFormatada = formatarData(noticia.data_publicada);
  const relativo = tempoRelativo(noticia);
  const bandeira = BANDEIRA_PAIS[noticia.estado] ? BANDEIRA_PAIS[noticia.estado] + " " : "";

  card.innerHTML = `
    <span class="card__stamp card__stamp--${noticia.status}">${STATUS_LABEL[noticia.status] || "Projeto"}</span>
    <p class="card__meta">${bandeira}${escapeHtml(noticia.empresa_nome)} · ${escapeHtml(noticia.estado || "")}${dataFormatada ? " · " + dataFormatada : ""}${relativo ? ` <span class="card__relativo">(${relativo})</span>` : ""}</p>
    <h4 class="card__title">${escapeHtml(noticia.titulo)}</h4>
    <p class="card__resumo">${escapeHtml(noticia.resumo || "Resumo não disponível — clique para ler a matéria completa no site oficial.")}</p>
    <span class="card__link">Ver notícia completa →</span>
  `;

  const abrir = () => abrirModal(noticia);
  card.addEventListener("click", abrir);
  card.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      abrir();
    }
  });

  return card;
}

// ===== Modal de notícia completa =====
function abrirModal(noticia) {
  const dataFormatada = formatarData(noticia.data_publicada);
  const relativo = tempoRelativo(noticia);
  const bandeira = BANDEIRA_PAIS[noticia.estado] ? BANDEIRA_PAIS[noticia.estado] + " " : "";

  document.getElementById("modal-stamp").textContent = STATUS_LABEL[noticia.status] || "Projeto";
  document.getElementById("modal-stamp").className = `modal__stamp modal__stamp--${noticia.status}`;
  document.getElementById("modal-meta").textContent =
    `${bandeira}${noticia.empresa_nome} · ${noticia.estado || ""}${dataFormatada ? " · " + dataFormatada : ""}${relativo ? ` (${relativo})` : ""}`;
  document.getElementById("modal-titulo").textContent = noticia.titulo;
  document.getElementById("modal-resumo").textContent =
    noticia.resumo || "Resumo não disponível para esta notícia — clique abaixo para ler a matéria completa no site oficial.";

  const link = document.getElementById("modal-link");
  link.href = noticia.link;

  const botaoCopiar = document.getElementById("modal-copiar");
  botaoCopiar.dataset.link = noticia.link;
  botaoCopiar.textContent = "Copiar link";
  botaoCopiar.classList.remove("modal__copiar--sucesso");

  document.getElementById("modal-overlay").hidden = false;
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  document.getElementById("modal-overlay").hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("modal-close").addEventListener("click", fecharModal);
document.getElementById("modal-overlay").addEventListener("click", (evento) => {
  if (evento.target.id === "modal-overlay") fecharModal();
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") fecharModal();
});

document.getElementById("modal-copiar").addEventListener("click", async (evento) => {
  const botao = evento.currentTarget;
  const link = botao.dataset.link;
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
  } catch (erro) {
    // navegadores mais antigos / sem permissao de clipboard: metodo alternativo
    const campoTemporario = document.createElement("textarea");
    campoTemporario.value = link;
    campoTemporario.style.position = "fixed";
    campoTemporario.style.opacity = "0";
    document.body.appendChild(campoTemporario);
    campoTemporario.select();
    document.execCommand("copy");
    document.body.removeChild(campoTemporario);
  }

  botao.textContent = "Link copiado ✓";
  botao.classList.add("modal__copiar--sucesso");
  setTimeout(() => {
    botao.textContent = "Copiar link";
    botao.classList.remove("modal__copiar--sucesso");
  }, 2000);
});

function formatarData(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
}

function tempoRelativo(noticia) {
  const d = dataParaOrdenar(noticia);
  if (!d || d.getTime() === 0) return "";

  const agora = new Date();
  const diffDias = Math.floor((agora - d) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return "";
  if (diffDias === 0) return "hoje";
  if (diffDias === 1) return "há 1 dia";
  if (diffDias < 30) return `há ${diffDias} dias`;

  const diffMeses = Math.floor(diffDias / 30);
  if (diffMeses === 1) return "há 1 mês";
  if (diffMeses < 12) return `há ${diffMeses} meses`;

  const diffAnos = Math.floor(diffMeses / 12);
  if (diffAnos === 1) return "há 1 ano";
  return `há ${diffAnos} anos`;
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

// ===== Filtros de status =====
document.getElementById("status-filters").addEventListener("click", (evento) => {
  const alvo = evento.target.closest(".chip");
  if (!alvo) return;
  filtroStatus = alvo.dataset.status;
  [...evento.currentTarget.children].forEach((c) => c.classList.remove("is-active"));
  alvo.classList.add("is-active");
  renderizarCards();
});

// ===== Diagrama animado de rede (elemento de assinatura visual) =====
function desenharDiagramaDeRede() {
  const svg = document.getElementById("network-svg");
  const ns = "http://www.w3.org/2000/svg";

  const nos = [
    { x: 359.1, y: 191.7, label: "SAB", nome: "Sabesp" },
    { x: 267.1, y: 208.9, label: "COP", nome: "Copasa" },
    { x: 322.6, y: 138.4, label: "CED", nome: "Cedae" },
    { x: 383.5, y: 241.0, label: "SPR", nome: "Sanepar" },
    { x: 199.3, y: 175.6, label: "CSB", nome: "Caesb" },
    { x: 434.6, y: 155.4, label: "COR", nome: "Corsan" },
    { x: 284.6, y: 256.3, label: "CPE", nome: "Compesa" },
    { x: 250.0, y: 123.3, label: "CAG", nome: "Cagece" },
    { x: 456.4, y: 216.5, label: "EMB", nome: "Embasa" },
    { x: 141.8, y: 216.8, label: "AEG", nome: "Aegea Saneamento" },
    { x: 375.6, y: 103.2, label: "BRK", nome: "BRK Ambiental" },
    { x: 362.1, y: 285.8, label: "CAJ", nome: "Águas de Joinville" },
    { x: 152.8, y: 137.3, label: "PUB", nome: "PUB — Singapura" },
    { x: 490.4, y: 163.9, label: "MEK", nome: "Mekorot — Israel" },
    { x: 198.6, y: 281.3, label: "EPA", nome: "EPA — EUA" },
    { x: 275.2, y: 73.6, label: "SAT", nome: "Saneatins (BRK)" },
    { x: 480.7, y: 261.5, label: "DES", nome: "Deso" },
    { x: 100.9, y: 190.3, label: "SAS", nome: "Sanasa Campinas" },
    { x: 488.0, y: 106.8, label: "IGU", nome: "Iguá Saneamento" },
    { x: 302.3, y: 317.8, label: "ADB", nome: "Águas do Brasil" },
    { x: 161.1, y: 89.2, label: "AMB", nome: "Ambiental (Grupo Equatorial)" },
  ];

  const conexoes = [
    [0, 1], [0, 2], [0, 3], [0, 5], [1, 2], [1, 4], [1, 6], [2, 7], [2, 10], [2, 15],
    [3, 8], [3, 11], [4, 7], [4, 9], [4, 12], [5, 8], [5, 10], [5, 13], [5, 18], [6, 11],
    [6, 14], [6, 19], [7, 12], [7, 15], [7, 20], [8, 13], [8, 16], [9, 14], [9, 17],
    [11, 19], [12, 17], [12, 20], [13, 16], [13, 18],
  ];

  conexoes.forEach(([a, b], i) => {
    const noA = nos[a];
    const noB = nos[b];
    const path = document.createElementNS(ns, "path");
    const d = `M ${noA.x} ${noA.y} L ${noB.x} ${noB.y}`;
    path.setAttribute("d", d);
    path.setAttribute("class", "pipe");
    path.setAttribute("id", `pipe-${i}`);
    svg.appendChild(path);

    // gota de "fluxo" animada ao longo do cano
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("r", "3");
    dot.setAttribute("class", "flow-dot");
    const anim = document.createElementNS(ns, "animateMotion");
    anim.setAttribute("dur", `${3 + (i % 4)}s`);
    anim.setAttribute("repeatCount", "indefinite");
    anim.setAttribute("path", d);
    dot.appendChild(anim);
    svg.appendChild(dot);
  });

  nos.forEach((no) => {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", no.label === "CAJ" ? "node node--destaque" : "node");

    // nome completo ao passar o mouse
    const titulo = document.createElementNS(ns, "title");
    titulo.textContent = no.nome;
    g.appendChild(titulo);

    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", no.x);
    circle.setAttribute("cy", no.y);
    circle.setAttribute("r", no.label === "CAJ" ? 16 : 13);
    g.appendChild(circle);

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", no.x);
    text.setAttribute("y", no.y + 3);
    text.textContent = no.label;
    g.appendChild(text);

    svg.appendChild(g);
  });
}

carregarNoticias();
desenharDiagramaDeRede();
