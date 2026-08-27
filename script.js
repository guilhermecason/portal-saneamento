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

async function carregarNoticias() {
  try {
    const resp = await fetch("data/noticias.json", { cache: "no-store" });
    TODAS_NOTICIAS = await resp.json();
  } catch (erro) {
    console.error("Não consegui carregar as notícias:", erro);
    TODAS_NOTICIAS = [];
  }

  montarFiltrosDeEmpresa();
  atualizarMeta();
  renderizarCards();
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
    return passaStatus && passaEmpresa;
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
  const bandeira = BANDEIRA_PAIS[noticia.estado] ? BANDEIRA_PAIS[noticia.estado] + " " : "";

  card.innerHTML = `
    <span class="card__stamp card__stamp--${noticia.status}">${STATUS_LABEL[noticia.status] || "Projeto"}</span>
    <p class="card__meta">${bandeira}${escapeHtml(noticia.empresa_nome)} · ${escapeHtml(noticia.estado || "")}${dataFormatada ? " · " + dataFormatada : ""}</p>
    <h4 class="card__title">${escapeHtml(noticia.titulo)}</h4>
    ${noticia.resumo ? `<p class="card__resumo">${escapeHtml(noticia.resumo)}</p>` : ""}
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
  const bandeira = BANDEIRA_PAIS[noticia.estado] ? BANDEIRA_PAIS[noticia.estado] + " " : "";

  document.getElementById("modal-stamp").textContent = STATUS_LABEL[noticia.status] || "Projeto";
  document.getElementById("modal-stamp").className = `modal__stamp modal__stamp--${noticia.status}`;
  document.getElementById("modal-meta").textContent =
    `${bandeira}${noticia.empresa_nome} · ${noticia.estado || ""}${dataFormatada ? " · " + dataFormatada : ""}`;
  document.getElementById("modal-titulo").textContent = noticia.titulo;
  document.getElementById("modal-resumo").textContent =
    noticia.resumo || "Resumo não disponível para esta notícia — clique abaixo para ler a matéria completa no site oficial.";

  const link = document.getElementById("modal-link");
  link.href = noticia.link;

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

function formatarData(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
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
    { x: 40, y: 60, label: "ETA" },
    { x: 180, y: 30, label: "SAB" },
    { x: 320, y: 70, label: "AEG" },
    { x: 460, y: 40, label: "BRK" },
    { x: 120, y: 180, label: "COP" },
    { x: 280, y: 220, label: "SAN" },
    { x: 420, y: 190, label: "ETE" },
    { x: 60, y: 270, label: "CAG" },
  ];

  const conexoes = [
    [0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [4, 7], [2, 6], [0, 4],
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
    g.setAttribute("class", "node");

    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", no.x);
    circle.setAttribute("cy", no.y);
    circle.setAttribute("r", 18);
    g.appendChild(circle);

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", no.x);
    text.setAttribute("y", no.y + 4);
    text.textContent = no.label;
    g.appendChild(text);

    svg.appendChild(g);
  });
}

carregarNoticias();
desenharDiagramaDeRede();
