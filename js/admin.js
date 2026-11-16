import { getSupabaseClient, loginUsuario, logoutUsuario } from "/js/supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const STATUS_OPTIONS = [
  ["pendente", "Pendente"],
  ["confirmado", "Confirmado"],
  ["em_producao", "Em produção"],
  ["enviado", "Enviado"],
  ["concluido", "Concluído"],
  ["cancelado", "Cancelado"]
];
const VIEW_INFO = {
  dashboard: ["Visão geral", "Resumo atualizado da operação da loja."],
  orders: ["Pedidos", "Consulte os detalhes e atualize o andamento dos pedidos."],
  products: ["Produtos", "Cadastre produtos e edite preço, descrição e disponibilidade no catálogo."],
  customers: ["Clientes", "Consulte os dados básicos das contas cadastradas."]
};
let activeView = "dashboard";
let productCache = [];
let categoryCache = [];
let dashboardRange = getPresetRange("30days");
let dashboardChartInstances = [];
let dashboardAnalyticsRequest = 0;

function normalizarCategoriaProduto(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/babylook/g, 'baby look').replace(/[-_]+/g, ' ').trim();
}

function filtrarBabyLookProdutos(products, categories) {
  const categoriasBabyLook = new Set(categories.filter(category => normalizarCategoriaProduto(category.nome).includes('baby look')).map(category => String(category.id)));
  return products.filter(product => {
    if (['prod-6', 'prod-7'].includes(String(product.id))) return false;
    const name = normalizarCategoriaProduto(product.nome);
    const style = normalizarCategoriaProduto(product.estilo);
    const category = normalizarCategoriaProduto(product.categoria_id);
    return !name.includes('baby look') && style !== 'baby look' && !category.includes('baby look') && !categoriasBabyLook.has(String(product.categoria_id));
  });
}

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  $("#login-form").addEventListener("submit", onLogin);
  $("#logout-button").addEventListener("click", onLogout);
  $("#refresh-button").addEventListener("click", () => loadView(activeView));
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => loadView(button.dataset.view)));
  $("#view-container").addEventListener("click", handleViewClick);
  $("#view-container").addEventListener("submit", handleViewSubmit);
  $("#view-container").addEventListener("change", handleViewChange);

  const client = getSupabaseClient();
  if (!client) {
    setLoginNotice("O serviço de autenticação não foi carregado. Recarregue a página e tente novamente.");
    return;
  }
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await enterPanel(data.session.user);
  } catch {
    setLoginNotice("Não foi possível validar sua sessão. Entre novamente.");
  }
}

async function onLogin(event) {
  event.preventDefault();
  const button = $("#login-submit");
  button.disabled = true;
  button.textContent = "Verificando...";
  setLoginNotice("");
  try {
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const authData = await loginUsuario(email, password);
    if (!authData || !authData.user || !authData.session) {
      setLoginNotice("A autenticação precisa ser confirmada. Confira seu e-mail caso a conta tenha sido criada agora.");
      return;
    }
    await enterPanel(authData.user);
  } catch (error) {
    setLoginNotice(loginErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "Entrar no painel";
  }
}

async function enterPanel(user) {
  setLoginNotice("");
  $("#login-screen").hidden = true;
  $("#admin-app").hidden = false;
  $("#admin-identity").textContent = user && user.email ? user.email : "Sessão autenticada";
  try {
    const data = await invokeAdmin("dashboard");
    $("#app-notice").textContent = "";
    $("#view-container").innerHTML = "";
    renderDashboard(data);
    setActiveNavigation("dashboard");
    activeView = "dashboard";
    await loadDashboardAnalytics();
    $("#view-title").textContent = VIEW_INFO.dashboard[0];
    $("#view-subtitle").textContent = VIEW_INFO.dashboard[1];
  } catch (error) {
    $("#admin-app").hidden = true;
    $("#login-screen").hidden = false;
    setLoginNotice(error.message || "Esta conta não tem permissão administrativa.");
  }
}

async function onLogout() {
  try { await logoutUsuario(); } finally {
    $("#admin-app").hidden = true;
    $("#login-screen").hidden = false;
    $("#login-password").value = "";
    setLoginNotice("Sessão encerrada.");
  }
}

async function invokeAdmin(action, payload = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Serviço de autenticação indisponível.");
  const result = await client.functions.invoke("rocha7-admin", { body: Object.assign({ action }, payload) });
  if (result.error) {
    let message = result.error.message || "Falha ao consultar o servidor administrativo.";
    try {
      const response = result.error.context;
      if (response && typeof response.json === "function") {
        const body = await response.json();
        if (body && typeof body.error === "string") message = body.error;
      }
    } catch {}
    throw new Error(message);
  }
  if (result.data && result.data.error) throw new Error(result.data.error);
  return result.data || {};
}

async function loadView(view) {
  if (!VIEW_INFO[view]) return;
  activeView = view;
  setActiveNavigation(view);
  $("#view-title").textContent = VIEW_INFO[view][0];
  $("#view-subtitle").textContent = VIEW_INFO[view][1];
  $("#app-notice").textContent = "";
  $("#view-container").innerHTML = '<div class="empty-state">Carregando dados…</div>';
  $("#refresh-button").disabled = true;
  try {
    let data;
    if (view === "dashboard") {
      data = await invokeAdmin("dashboard");
      renderDashboard(data);
      await loadDashboardAnalytics();
    } else if (view === "orders") {
      data = await invokeAdmin("list_orders");
      renderOrders(data.orders || []);
    } else if (view === "products") {
      data = await invokeAdmin("list_products");
      categoryCache = (data.categories || []).filter(category => !normalizarCategoriaProduto(category.nome).includes('baby look'));
      productCache = filtrarBabyLookProdutos(data.products || [], data.categories || []);
      renderProducts();
    } else if (view === "customers") {
      data = await invokeAdmin("list_customers");
      renderCustomers(data.customers || []);
    }
  } catch (error) {
    $("#view-container").innerHTML = '<div class="empty-state">Não foi possível carregar esta seção.</div>';
    $("#app-notice").textContent = error.message || "Erro ao consultar os dados.";
  } finally {
    $("#refresh-button").disabled = false;
  }
}

function setActiveNavigation(view) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
}

function setLoginNotice(message) {
  $("#login-notice").textContent = message || "";
}

function loginErrorMessage(error) {
  const message = String(error && error.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  return error && error.message ? error.message : "Não foi possível entrar.";
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function getISODate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function getPresetRange(preset) {
  const today = new Date();
  const endDate = getISODate(today);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === "7days") start.setDate(start.getDate() - 6);
  else if (preset === "30days") start.setDate(start.getDate() - 29);
  else if (preset === "current_month") start.setDate(1);
  return { preset, startDate: getISODate(start), endDate };
}

function renderDashboard(data) {
  const stats = data.stats || {};
  dashboardChartInstances.forEach((chart) => chart.destroy());
  dashboardChartInstances = [];
  const range = dashboardRange || getPresetRange("30days");
  const custom = range.preset === "custom";
  let html = '<form id="dashboard-filter" class="analytics-filter"><div class="analytics-filter-fields">';
  html += '<div><label for="dashboard-period">Período</label><select id="dashboard-period" name="preset"><option value="7days"' + (range.preset === "7days" ? " selected" : "") + '>Últimos 7 dias</option><option value="30days"' + (range.preset === "30days" ? " selected" : "") + '>Últimos 30 dias</option><option value="current_month"' + (range.preset === "current_month" ? " selected" : "") + '>Mês atual</option><option value="custom"' + (custom ? " selected" : "") + '>Período personalizado</option></select></div>';
  html += '<div class="analytics-date-fields"' + (custom ? '' : ' hidden') + '><label for="dashboard-start">De</label><input id="dashboard-start" type="date" value="' + escapeHtml(range.startDate) + '"' + (custom ? ' required' : '') + '></div>';
  html += '<div class="analytics-date-fields"' + (custom ? '' : ' hidden') + '><label for="dashboard-end">Até</label><input id="dashboard-end" type="date" value="' + escapeHtml(range.endDate) + '"' + (custom ? ' required' : '') + '></div>';
  html += '<button class="button button-primary analytics-apply" type="submit">Aplicar período</button></div></form>';
  html += '<div class="stats-grid analytics-stats">';
  const cards = [
    ['Faturamento', '<span id="analytics-revenue">—</span>', 'Exclui pendentes e cancelados'],
    ['Ticket médio', '<span id="analytics-ticket">—</span>', 'Por pedido faturado'],
    ['Pedidos no período', '<span id="analytics-orders">—</span>', 'Todos os status'],
    ['Produtos', escapeHtml(stats.products == null ? '—' : stats.products), 'Itens no catálogo']
  ];
  cards.forEach((card) => { html += '<article class="stat-card"><span class="stat-label">' + card[0] + '</span><strong class="stat-value">' + card[1] + '</strong><span class="stat-hint">' + card[2] + '</span></article>'; });
  html += '</div><div class="dashboard-charts" id="dashboard-charts"><div class="chart-panel"><div class="chart-panel-heading"><h2 id="orders-chart-title">Pedidos por dia</h2><span id="analytics-granularity">Carregando…</span></div><div class="chart-canvas-wrap"><canvas id="orders-chart" aria-label="Pedidos ao longo do período" role="img"></canvas></div></div>';
  html += '<div class="chart-panel"><div class="chart-panel-heading"><h2>Status dos pedidos</h2></div><div class="chart-canvas-wrap chart-canvas-doughnut"><canvas id="status-chart" aria-label="Pedidos agrupados por status" role="img"></canvas></div></div>';
  html += '<div class="chart-panel chart-panel-wide"><div class="chart-panel-heading"><h2>Produtos mais vendidos</h2><span>Unidades</span></div><div class="chart-canvas-wrap chart-canvas-products"><canvas id="products-chart" aria-label="Produtos mais vendidos no período" role="img"></canvas></div></div></div>';
  html += '<section class="table-panel"><div class="table-head"><h2>Pedidos recentes</h2><button class="button small-button" type="button" data-go-view="orders">Ver todos os pedidos</button></div>' + renderRecentOrders(data.latestOrders || []) + '</section>';
  $("#view-container").innerHTML = html;
}

function handleViewChange(event) {
  if (event.target.id !== "dashboard-period") return;
  const preset = event.target.value;
  $$(".analytics-date-fields").forEach((field) => { field.hidden = preset !== "custom"; });
  const startInput = $("#dashboard-start");
  const endInput = $("#dashboard-end");
  startInput.required = preset === "custom";
  endInput.required = preset === "custom";
  if (preset !== "custom") {
    dashboardRange = getPresetRange(preset);
    startInput.value = dashboardRange.startDate;
    endInput.value = dashboardRange.endDate;
    loadDashboardAnalytics();
  } else {
    dashboardAnalyticsRequest++;
  }
}

async function loadDashboardAnalytics(range = dashboardRange) {
  const requestId = ++dashboardAnalyticsRequest;
  const button = $("#dashboard-filter button[type=\"submit\"]");
  if (button) { button.disabled = true; button.textContent = "Carregando…"; }
  try {
    const response = await invokeAdmin("dashboard_analytics", { range: { startDate: range.startDate, endDate: range.endDate } });
    if (requestId !== dashboardAnalyticsRequest || activeView !== "dashboard") return;
    dashboardRange = range;
    renderDashboardAnalytics(response.analytics || {}, response.granularity || "day");
    $("#app-notice").textContent = "";
  } catch (error) {
    if (requestId !== dashboardAnalyticsRequest) return;
    $("#app-notice").textContent = error.message || "Não foi possível carregar os dados do período.";
    renderDashboardAnalytics(null, "day");
  } finally {
    if (button && button.isConnected) { button.disabled = false; button.textContent = "Aplicar período"; }
  }
}

function renderDashboardAnalytics(analytics, granularity) {
  dashboardChartInstances.forEach((chart) => chart.destroy());
  dashboardChartInstances = [];
  $("#analytics-revenue").textContent = analytics ? formatMoney(analytics.revenue) : "—";
  $("#analytics-ticket").textContent = analytics ? formatMoney(analytics.averageTicket) : "—";
  $("#analytics-orders").textContent = analytics ? String(analytics.totalOrders || 0) : "—";
  if (!analytics) {
    $("#dashboard-charts").innerHTML = '<div class="empty-state analytics-empty">Não foi possível carregar os gráficos para este período.</div>';
    return;
  }
  $("#analytics-granularity").textContent = granularity === "month" ? "Por mês" : "Por dia";
  $("#orders-chart-title").textContent = granularity === "month" ? "Pedidos por mês" : "Pedidos por dia";
  if (!Number(analytics.totalOrders)) {
    $("#dashboard-charts").innerHTML = '<div class="empty-state analytics-empty">Ainda não há pedidos neste período. Escolha outro intervalo para consultar os resultados.</div>';
    return;
  }
  if (!window.Chart) {
    $("#dashboard-charts").innerHTML = '<div class="empty-state analytics-empty">Não foi possível carregar os gráficos. Atualize a página para tentar novamente.</div>';
    return;
  }
  const series = analytics.series || [];
  const statuses = analytics.statuses || [];
  const topProducts = analytics.topProducts || [];
  dashboardChartInstances.push(new window.Chart($("#orders-chart"), {
    type: "line",
    data: { labels: series.map((item) => item.period), datasets: [{ label: "Pedidos", data: series.map((item) => Number(item.orders)), borderColor: "#b68a4c", backgroundColor: "#b68a4c22", fill: true, tension: 0.28, pointRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));
  const statusLabels = { pendente: "Pendente", confirmado: "Confirmado", em_producao: "Em produção", enviado: "Enviado", concluido: "Concluído", entregue: "Entregue", cancelado: "Cancelado" };
  const statusColors = { pendente: "#d8a64e", confirmado: "#629678", em_producao: "#638eb2", enviado: "#7b73b2", concluido: "#3f795a", entregue: "#3f795a", cancelado: "#bd6a65" };
  dashboardChartInstances.push(new window.Chart($("#status-chart"), {
    type: "doughnut",
    data: { labels: statuses.map((item) => statusLabels[item.status] || item.status), datasets: [{ data: statuses.map((item) => Number(item.orders)), backgroundColor: statuses.map((item) => statusColors[item.status] || "#999087"), borderWidth: 2, borderColor: "#fff" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, padding: 12, font: { size: 10 } } } } }
  }));
  if (!topProducts.length) {
    $(".chart-canvas-products").innerHTML = '<div class="empty-state">Ainda não há vendas confirmadas de produtos neste período.</div>';
    return;
  }
  dashboardChartInstances.push(new window.Chart($("#products-chart"), {
    type: "bar",
    data: { labels: topProducts.map((item) => item.name), datasets: [{ label: "Unidades", data: topProducts.map((item) => Number(item.quantity)), backgroundColor: "#b68a4c", borderRadius: 5 }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));
}

function renderRecentOrders(orders) {
  if (!orders.length) return '<div class="empty-state">Ainda não há pedidos registrados.</div>';
  let html = '<div class="table-scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th></tr></thead><tbody>';
  orders.forEach((order) => {
    html += '<tr><td><strong>' + escapeHtml(shortId(order.id)) + '</strong></td><td>' + escapeHtml(order.nome_cliente) + '<span class="table-sub">' + escapeHtml(order.email_cliente) + '</span></td><td>' + escapeHtml(formatDate(order.criado_em)) + '</td><td><strong>' + escapeHtml(formatMoney(order.valor_total)) + '</strong></td><td>' + statusBadge(order.status) + '</td></tr>';
  });
  return html + '</tbody></table></div>';
}

function renderOrders(orders) {
  if (!orders.length) {
    $("#view-container").innerHTML = '<section class="table-panel"><div class="empty-state">Nenhum pedido encontrado.</div></section>';
    return;
  }
  let html = '<section class="table-panel"><div class="table-head"><h2>Pedidos registrados</h2><span class="badge">' + orders.length + ' exibidos</span></div><div class="table-scroll"><table><thead><tr><th>Pedido / data</th><th>Cliente</th><th>Total</th><th>Status</th><th>Detalhes</th></tr></thead><tbody>';
  orders.forEach((order) => {
    const id = escapeHtml(order.id);
    const options = STATUS_OPTIONS.map((option) => '<option value="' + option[0] + '"' + (order.status === option[0] ? " selected" : "") + '>' + option[1] + '</option>').join("");
    const items = Array.isArray(order.itens) ? order.itens : [];
    let detail = '<div><strong>Entrega:</strong> ' + escapeHtml(order.endereco_entrega) + ', CEP ' + escapeHtml(order.cep) + '</div>';
    detail += '<div><strong>Telefone:</strong> ' + escapeHtml(order.telefone_whatsapp) + '</div>';
    detail += '<div><strong>CPF/CNPJ:</strong> ' + escapeHtml(order.cpf_cliente || "Não informado") + '</div>';
    detail += '<div><strong>Pagamento:</strong> ' + escapeHtml(order.forma_pagamento) + ' • <strong>Tipo:</strong> ' + escapeHtml(order.tipo_pedido) + '</div>';
    if (order.observacoes) detail += '<div><strong>Observações:</strong> ' + escapeHtml(order.observacoes) + '</div>';
    detail += '<ul>' + items.map((item) => '<li>' + escapeHtml(item.quantidade) + '× ' + escapeHtml(item.nome_produto) + ' — ' + escapeHtml(item.tamanho) + ', ' + escapeHtml(item.cor) + ' (' + escapeHtml(formatMoney(item.subtotal)) + ')</li>').join("") + '</ul>';
    html += '<tr><td><strong>' + escapeHtml(shortId(order.id)) + '</strong><span class="table-sub">' + escapeHtml(formatDate(order.criado_em)) + '</span></td>';
    html += '<td>' + escapeHtml(order.nome_cliente) + '<span class="table-sub">' + escapeHtml(order.email_cliente) + '</span></td><td><strong>' + escapeHtml(formatMoney(order.valor_total)) + '</strong></td>';
    html += '<td><div class="row-actions"><select class="status-select" aria-label="Status do pedido ' + id + '" data-status-order="' + id + '">' + options + '</select><button class="button small-button" type="button" data-save-order="' + id + '">Salvar</button></div></td>';
    html += '<td><details><summary>Ver dados</summary><div class="order-detail">' + detail + '</div></details></td></tr>';
  });
  html += '</tbody></table></div></section>';
  $("#view-container").innerHTML = html;
}

function statusBadge(status) {
  const option = STATUS_OPTIONS.find((entry) => entry[0] === status);
  const label = option ? option[1] : (status || "Indefinido");
  const className = status === "pendente" ? "badge pending" : "badge";
  return '<span class="' + className + '">' + escapeHtml(label) + '</span>';
}

function shortId(value) {
  return value ? String(value).slice(0, 8).toUpperCase() : "—";
}

function renderProducts() {
  let html = '<section class="panel"><div class="panel-heading"><div><h2 class="form-section-title" id="product-form-title">Cadastrar produto</h2><p class="form-description">Produtos cadastrados aqui são salvos no catálogo do banco de dados.</p></div></div>';
  html += '<form id="product-form" class="product-form"><input type="hidden" name="productId" id="product-id">';
  html += '<div><label for="product-name">Nome</label><input name="nome" id="product-name" maxlength="160" required></div>';
  html += '<div><label for="product-category">Categoria</label><select name="categoria_id" id="product-category" required>' + categoryCache.map((category) => '<option value="' + escapeHtml(category.id) + '">' + escapeHtml(category.nome) + '</option>').join("") + '</select></div>';
  html += '<div><label for="product-price">Preço base (R$)</label><input name="preco_base" id="product-price" type="number" min="0" max="1000000" step="0.01" required></div>';
  html += '<div class="field-wide"><label for="product-image-file">Foto do produto (JPG, PNG ou WebP, até 5 MB)</label><input id="product-image-file" type="file" accept="image/jpeg,image/png,image/webp"><input name="imagem" id="product-image" type="hidden"><img id="product-image-preview" class="product-image-preview" alt="Prévia da foto do produto" hidden><small class="form-description">Escolha uma foto para enviar ou mantenha a foto atual ao editar.</small></div>';
  html += '<div><label for="product-style">Estilo</label><select name="estilo" id="product-style"><option value="normal">Normal</option><option value="polo">Polo</option></select></div>';
  html += '<div><label for="product-type">Personalização</label><select name="tipo_personalizacao" id="product-type"><option value="lisa">Lisa</option><option value="pronta">Estampa pronta</option><option value="personalizavel">Personalizável</option></select></div>';
  html += '<div class="field-wide"><label for="product-description">Descrição</label><textarea name="descricao" id="product-description" maxlength="4000"></textarea></div>';
  html += '<div class="field-wide"><label for="product-colors">Cores disponíveis (separadas por vírgula)</label><input name="cores" id="product-colors" maxlength="1000" placeholder="preto, branco, azul-marinho"></div>';
  html += '<div class="field-wide"><label class="checkbox-row"><input type="checkbox" name="destaque" id="product-featured"> Exibir entre os destaques</label></div>';
  html += '<div class="field-wide"><label class="checkbox-row"><input type="checkbox" name="ativo" id="product-active" checked> Produto disponível para pedidos</label></div>';
  html += '<div class="field-wide form-actions"><button class="button button-primary" type="submit">Salvar produto</button><button class="button" id="product-cancel" type="button">Limpar formulário</button></div></form></section>';
  html += '<section class="table-panel"><div class="table-head"><h2>Catálogo</h2><span class="badge">' + productCache.length + ' produtos</span></div>';
  if (!productCache.length) html += '<div class="empty-state">Não há produtos cadastrados.</div>';
  else {
    html += '<div class="table-scroll"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço base</th><th>Tipo</th><th>Status</th><th>Ação</th></tr></thead><tbody>';
    productCache.forEach((product) => {
      const category = categoryCache.find((entry) => entry.id === product.categoria_id);
      html += '<tr><td><strong>' + escapeHtml(product.nome) + '</strong><span class="table-sub">' + escapeHtml(product.id) + (product.destaque ? ' · Destaque' : '') + '</span></td><td>' + escapeHtml(category ? category.nome : product.categoria_id) + '</td><td><strong>' + escapeHtml(formatMoney(product.preco_base)) + '</strong></td><td>' + escapeHtml(product.tipo_personalizacao) + '</td><td>' + (product.ativo === false ? 'Indisponível' : 'Disponível') + '</td><td><div class="row-actions"><button class="button small-button" type="button" data-edit-product="' + escapeHtml(product.id) + '">Editar</button><button class="button small-button" type="button" data-toggle-product="' + escapeHtml(product.id) + '" data-active="' + (product.ativo === false ? 'false' : 'true') + '">' + (product.ativo === false ? 'Ativar' : 'Desativar') + '</button></div></td></tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</section>';
  $("#view-container").innerHTML = html;
  $("#product-form").addEventListener("reset", () => {});
  $("#product-image-file").addEventListener("change", previewProductImage);
}

function previewProductImage(event) {
  const file = event.target.files && event.target.files[0];
  const preview = $("#product-image-preview");
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    event.target.value = "";
    preview.hidden = true;
    $("#app-notice").textContent = "Escolha uma imagem JPG, PNG ou WebP de até 5 MB.";
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
}

function fillProductForm(product) {
  $("#product-id").value = product ? product.id : "";
  $("#product-name").value = product ? product.nome || "" : "";
  $("#product-category").value = product ? product.categoria_id : (categoryCache[0] ? categoryCache[0].id : "");
  $("#product-price").value = product ? Number(product.preco_base || 0).toFixed(2) : "";
  $("#product-image").value = product ? product.imagem || "" : "";
  $("#product-image-file").value = "";
  $("#product-image-preview").hidden = !product?.imagem;
  if (product?.imagem) $("#product-image-preview").src = product.imagem;
  $("#product-style").value = product ? product.estilo || "normal" : "normal";
  $("#product-type").value = product ? product.tipo_personalizacao || "lisa" : "lisa";
  $("#product-description").value = product ? product.descricao || "" : "";
  $("#product-colors").value = product && Array.isArray(product.cores) ? product.cores.join(", ") : "";
  $("#product-featured").checked = !!(product && product.destaque);
  $("#product-active").checked = !product || product.ativo !== false;
  $("#product-form-title").textContent = product ? "Editar produto" : "Cadastrar produto";
  $("#product-name").focus();
}

function renderCustomers(customers) {
  let html = '<section class="table-panel"><div class="table-head"><h2>Contas de clientes</h2><span class="badge">' + customers.length + ' exibidos</span></div>';
  if (!customers.length) html += '<div class="empty-state">Nenhuma conta encontrada.</div>';
  else {
    html += '<div class="table-scroll"><table><thead><tr><th>Cliente</th><th>E-mail</th><th>Telefone</th><th>Cadastro</th></tr></thead><tbody>';
    customers.forEach((customer) => {
      html += '<tr><td><strong>' + escapeHtml(customer.nome || "Sem nome") + '</strong></td><td>' + escapeHtml(customer.email) + '</td><td>' + escapeHtml(customer.telefone || "—") + '</td><td>' + escapeHtml(formatDate(customer.created_at)) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</section><p class="table-sub">Para reduzir a exposição de dados pessoais, esta lista mostra apenas informações básicas de cadastro.</p>';
  $("#view-container").innerHTML = html;
}

async function handleViewClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.goView) {
    await loadView(button.dataset.goView);
    return;
  }
  if (button.dataset.editProduct) {
    const product = productCache.find((entry) => entry.id === button.dataset.editProduct);
    if (product) fillProductForm(product);
    return;
  }
  if (button.dataset.toggleProduct) {
    const active = button.dataset.active === "true";
    if (active && !window.confirm("Este produto ficará indisponível para novos pedidos. Os pedidos já feitos serão mantidos. Deseja continuar?")) return;
    button.disabled = true;
    try {
      await invokeAdmin("set_product_active", { productId: button.dataset.toggleProduct, ativo: !active });
      const data = await invokeAdmin("list_products");
      categoryCache = (data.categories || []).filter(category => !normalizarCategoriaProduto(category.nome).includes('baby look'));
      productCache = filtrarBabyLookProdutos(data.products || [], data.categories || []);
      renderProducts();
      $("#app-notice").textContent = active ? "Produto desativado. Os pedidos existentes foram mantidos." : "Produto ativado e disponível no catálogo.";
    } catch (error) {
      $("#app-notice").textContent = error.message || "Não foi possível alterar a disponibilidade.";
      button.disabled = false;
    }
    return;
  }
  if (button.id === "product-cancel") {
    fillProductForm(null);
    return;
  }
  if (button.dataset.saveOrder) {
    const id = button.dataset.saveOrder;
    const select = Array.from(document.querySelectorAll("[data-status-order]")).find((element) => element.dataset.statusOrder === id);
    if (!select) return;
    button.disabled = true;
    button.textContent = "Salvando…";
    try {
      await invokeAdmin("update_order_status", { orderId: id, status: select.value });
      $("#app-notice").textContent = "Status do pedido atualizado.";
      await loadView("orders");
    } catch (error) {
      $("#app-notice").textContent = error.message || "Não foi possível atualizar o pedido.";
    } finally {
      button.disabled = false;
      button.textContent = "Salvar";
    }
  }
}

async function handleViewSubmit(event) {
  if (event.target.id === "dashboard-filter") {
    event.preventDefault();
    const startDate = $("#dashboard-start").value;
    const endDate = $("#dashboard-end").value;
    if (!startDate || !endDate || startDate > endDate) {
      $("#app-notice").textContent = "Confira as datas: a data inicial deve ser anterior ou igual à data final.";
      return;
    }
    dashboardRange = { preset: "custom", startDate, endDate };
    $("#app-notice").textContent = "";
    await loadDashboardAnalytics(dashboardRange);
    return;
  }
  if (event.target.id !== "product-form") return;
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Salvando…";
  const formData = new FormData(form);
  const price = Number(formData.get("preco_base"));
  const colors = String(formData.get("cores") || "").split(",").map((value) => value.trim()).filter(Boolean);
  const product = {
    nome: String(formData.get("nome") || "").trim(),
    categoria_id: String(formData.get("categoria_id") || ""),
    preco_base: price,
    imagem: String(formData.get("imagem") || "").trim(),
    estilo: String(formData.get("estilo") || "normal"),
    tipo_personalizacao: String(formData.get("tipo_personalizacao") || "lisa"),
    descricao: String(formData.get("descricao") || "").trim(),
    cores: colors,
    destaque: $("#product-featured").checked,
    ativo: $("#product-active").checked,
    productId: String(formData.get("productId") || "")
  };
  if (normalizarCategoriaProduto(product.nome).includes('baby look')) {
    $("#app-notice").textContent = "Baby Look é uma modelagem, não um produto. Cadastre o modelo de camiseta ou polo e deixe a modelagem como opção.";
    submit.disabled = false;
    submit.textContent = "Salvar produto";
    return;
  }
  try {
    const imageFile = $("#product-image-file").files[0];
    if (imageFile) {
      const upload = await invokeAdmin("create_product_upload", { file: { mimeType: imageFile.type, size: imageFile.size } });
      const client = getSupabaseClient();
      const { error: uploadError } = await client.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, imageFile, { contentType: imageFile.type, upsert: false });
      if (uploadError) throw uploadError;
      product.imagem = client.storage.from(upload.bucket).getPublicUrl(upload.path).data.publicUrl;
    }
    if (!product.imagem) throw new Error("Escolha uma foto para o produto.");
    await invokeAdmin("save_product", { product });
    const response = await invokeAdmin("list_products");
    categoryCache = (response.categories || []).filter(category => !normalizarCategoriaProduto(category.nome).includes('baby look'));
    productCache = filtrarBabyLookProdutos(response.products || [], response.categories || []);
    renderProducts();
    $("#app-notice").textContent = "Produto salvo com sucesso.";
  } catch (error) {
    $("#app-notice").textContent = error.message || "Não foi possível salvar o produto.";
    submit.disabled = false;
    submit.textContent = "Salvar produto";
  }
}
