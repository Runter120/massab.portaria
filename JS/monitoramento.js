// Monitoramento (somente operador): cards, tabela com filtros, paginação e detalhe.
import { $, esc, campo, toast, abrir, fechar, formatDataBR, carregarJSON, salvarJSON, baixarCSV } from './utils.js';
import { todosAgendamentos, aoMudarAgendamentos } from './agendamentos.js';

// v4: aqui ficam só os dados do monitoramento (status, dispositivo, observação). Quem aparece na lista vem dos agendamentos.
const CHAVE = 'mcassab_portaria_monitoramento_v4';
const STATUS_INICIAL = 'PESAGEM';   // status de todo agendamento novo que chega ao monitoramento
const POR_PAGINA = 8;

// As cores de cada status ficam no CSS (classe .status-NOME).
export const STATUS = {
  FLUXO_DEFINIDO: 'Fluxo definido',
  DOC_VALIDADA: 'Documentação validada',
  DOC_INVALIDADA: 'Documentação invalidada',
  JORNADA_REPROVADA: 'Jornada reprovada',
  ENTRADA_LIBERADA: 'Entrada liberada',
  PESAGEM: 'Pesagem',
};
const ALERTAS = ['DOC_INVALIDADA', 'JORNADA_REPROVADA'];

// Ícone (do sprite no index.html) e explicação curta de cada status, usados no seletor do detalhe.
const STATUS_INFO = {
  FLUXO_DEFINIDO:    { icone: 'fluxo',      ajuda: 'Percurso interno já definido' },
  DOC_VALIDADA:      { icone: 'ok-circulo', ajuda: 'Documentos conferidos e aprovados' },
  DOC_INVALIDADA:    { icone: 'x-circulo',  ajuda: 'Documentos com pendência' },
  JORNADA_REPROVADA: { icone: 'relogio',    ajuda: 'Jornada fora das regras permitidas' },
  ENTRADA_LIBERADA:  { icone: 'seta',       ajuda: 'Veículo autorizado a entrar' },
  PESAGEM:           { icone: 'balanca',    ajuda: 'Veículo em pesagem' },
};

const estado = { lista: [], filtro: 'TODOS', pagina: 1, editando: null };

// Alerta de "Documentação validada": guardamos o último status visto de cada protocolo
// e avisamos quando um deles MUDA para DOC_VALIDADA (o main.js define quem recebe o aviso).
const ultimoStatus = new Map();
let aoValidarDocumentacao = () => {};
export const definirAoValidarDocumentacao = (funcao) => { aoValidarDocumentacao = funcao; };

function verificarMudancas({ apenasMemorizar = false } = {}) {
  estado.lista.forEach((m) => {
    const anterior = ultimoStatus.get(m.id);   // undefined = protocolo novo: só memoriza, não alerta
    if (!apenasMemorizar && anterior !== undefined && anterior !== m.status && m.status === 'DOC_VALIDADA') aoValidarDocumentacao(m);
    ultimoStatus.set(m.id, m.status);
  });
}

const dataHora = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// id → { status, dispositivo, obs, atualizadoEm }  (o que o operador controla no monitoramento)
let ajustes = {};
const salvar = () => salvarJSON(CHAVE, ajustes);
let iniciado = false;

// Monta a lista a partir dos agendamentos confirmados. Agendamento novo entra com o status inicial;
// agendamento cancelado sai da lista.
function sincronizar() {
  let criou = false;
  estado.lista = todosAgendamentos().filter((a) => a.status === 'CONFIRMADO').map((a) => {
    if (!ajustes[a.id]) {
      ajustes[a.id] = { status: STATUS_INICIAL, dispositivo: '—', obs: '', atualizadoEm: new Date().toISOString() };
      criou = true;
    }
    const aj = ajustes[a.id];
    return {
      id: a.id, motorista: a.motorista, placa: a.placaCavalo, transportadora: a.transportadora,
      setor: a.setor, operacao: a.operacao, data: a.data, horario: a.horario,
      dispositivo: aj.dispositivo, status: aj.status, atualizadoEm: aj.atualizadoEm, obs: aj.obs,
    };
  });
  if (criou) salvar();
}

export function carregarMonitoramento() {
  ajustes = carregarJSON(CHAVE) ?? {};
  sincronizar();
  iniciado = true;
  verificarMudancas({ apenasMemorizar: true });   // primeira leitura: não alerta
}

// Chamado quando os agendamentos mudam (novo, cancelado, outra aba)
aoMudarAgendamentos(() => {
  if (!iniciado) return;
  sincronizar();
  verificarMudancas();   // protocolo novo só é memorizado, não alerta
  renderMonitoramento();
});

// Relê os dados salvos (botão "Atualizar" ou alteração feita em outra aba) e alerta se algo mudou
export function recarregar() {
  ajustes = carregarJSON(CHAVE) ?? ajustes;
  sincronizar();
  verificarMudancas();
  renderMonitoramento();
}
window.addEventListener('storage', (e) => { if (e.key === CHAVE) recarregar(); });

// ---------- Filtros ----------
const filtrarBase = () => {   // respeita setor e busca (usado também nos cards de contagem)
  const setor = $('#mon-filtro-setor').value;
  const termo = $('#mon-busca').value.toLowerCase().trim();
  return estado.lista.filter((m) => (!setor || m.setor === setor) &&
    [m.id, m.motorista, m.placa, m.dispositivo].some((t) => t.toLowerCase().includes(termo)));
};
const filtrada = () => filtrarBase().filter((m) => estado.filtro === 'TODOS' || m.status === estado.filtro);

export function definirFiltro(valor) {
  estado.filtro = valor;
  estado.pagina = 1;
  $('#mon-filtro-status').value = valor;
  renderMonitoramento();
}
export function buscar() { estado.pagina = 1; renderMonitoramento(); }
export function mudarPagina(delta) { estado.pagina += delta; renderMonitoramento(); }

// ---------- Tela ----------
const badge = (status) => `<span class="badge-status status-${status}">${STATUS[status]}</span>`;

const linha = (m) => `
  <tr>
    <td><span class="tag tag--protocolo">${esc(m.id)}</span></td>
    <td><strong>${esc(m.motorista)}</strong><small>${esc(m.placa)}</small></td>
    <td><strong>${esc(m.setor)}</strong><small>${esc(m.operacao)}</small></td>
    <td><strong>${formatDataBR(m.data)}</strong><small>${esc(m.horario)}</small></td>
    <td class="mono">${esc(m.dispositivo)}</td>
    <td>${badge(m.status)}</td>
    <td class="suave">${dataHora(m.atualizadoEm)}</td>
    <td class="direita"><button class="btn btn--contorno btn--sm" data-action="mon-detalhe" data-arg="${esc(m.id)}">Detalhes</button></td>
  </tr>`;

export function renderMonitoramento() {
  const base = filtrarBase();

  $('#mon-cards').innerHTML = Object.entries(STATUS).map(([chave, rotulo]) => {
    const ativo = estado.filtro === chave;
    return `<button class="stat status-${chave}${ativo ? ' is-ativo' : ''}" data-action="mon-filtro" data-arg="${ativo ? 'TODOS' : chave}">
      <span class="stat__rotulo">${rotulo}</span>
      <strong class="stat__valor">${base.filter((m) => m.status === chave).length}</strong>
    </button>`;
  }).join('');

  const lista = filtrada().sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));   // mais recentes primeiro
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  estado.pagina = Math.min(Math.max(estado.pagina, 1), paginas);
  const inicio = (estado.pagina - 1) * POR_PAGINA;
  const pagina = lista.slice(inicio, inicio + POR_PAGINA);

  $('#mon-tbody').innerHTML = pagina.length
    ? pagina.map(linha).join('')
    : `<tr><td colspan="8" class="vazio-tabela"><strong>Nenhum registro encontrado</strong><small>Ajuste o filtro de monitoramento, o setor ou a busca.</small></td></tr>`;
  $('#mon-resumo').textContent = total ? `Mostrando ${inicio + 1}–${inicio + pagina.length} de ${total} registro(s)` : 'Nenhum registro';
  $('#mon-pagina').textContent = `${estado.pagina} / ${paginas}`;
  $('#mon-prev').disabled = estado.pagina <= 1;
  $('#mon-next').disabled = estado.pagina >= paginas;
  $('#badge-mon').textContent = estado.lista.filter((m) => ALERTAS.includes(m.status)).length;
}

// ---------- Detalhe (modal) ----------
export function abrirDetalhe(id) {
  const m = estado.lista.find((x) => x.id === id);
  if (!m) return;
  estado.editando = id;
  const opcoes = Object.entries(STATUS).map(([chave, rotulo]) => `
    <label class="status-opcao status-${chave}">
      <input type="radio" name="mon-status" value="${chave}"${chave === m.status ? ' checked' : ''}>
      <span class="status-opcao__corpo">
        <span class="status-opcao__icone"><svg class="icone"><use href="#i-${STATUS_INFO[chave].icone}"/></svg></span>
        <span class="status-opcao__texto">
          <strong>${rotulo}</strong>
          <small>${STATUS_INFO[chave].ajuda}</small>
        </span>
        ${ALERTAS.includes(chave) ? '<span class="status-opcao__alerta">Atenção</span>' : ''}
        <svg class="icone status-opcao__check"><use href="#i-check"/></svg>
      </span>
    </label>`).join('');

  $('#mon-modal-body').innerHTML = `
    <div class="resumo">
      <div><small>Protocolo</small><strong class="resumo__destaque">${esc(m.id)}</strong></div>
      ${badge(m.status)}
    </div>
    <div class="dados-grid">
      ${campo('Motorista', m.motorista, 'dado--largo')}
      ${campo('Transportadora', m.transportadora)}${campo('Placa', m.placa)}
      ${campo('Setor / Operação', `${m.setor} · ${m.operacao}`)}${campo('Janela', `${formatDataBR(m.data)} às ${m.horario}`)}
      ${campo('Dispositivo', m.dispositivo, 'mono')}${campo('Última atualização', dataHora(m.atualizadoEm))}
    </div>
    <hr>
    <div class="campo">
      <span>Status do monitoramento</span>
      <div class="status-grid" role="radiogroup" aria-label="Status do monitoramento">${opcoes}</div>
      <p id="mon-status-aviso" class="status-aviso" hidden></p>
    </div>
    <label class="campo"><span>Observação</span>
      <textarea id="mon-edit-obs" class="input" rows="3" placeholder="Registre detalhes sobre este monitoramento...">${esc(m.obs)}</textarea></label>`;
  // Avisa o operador quando ele escolhe um status diferente do atual (nada é salvo até clicar em Salvar)
  $('#mon-modal-body').onchange = () => {
    const novo = $('input[name="mon-status"]:checked').value;
    const aviso = $('#mon-status-aviso');
    aviso.hidden = novo === m.status;
    aviso.innerHTML = `Ao salvar, o status muda de <strong>${STATUS[m.status]}</strong> para <strong>${STATUS[novo]}</strong>.`;
  };
  abrir('modal-monitoramento');
}

export function salvarDetalhe() {
  const m = estado.lista.find((x) => x.id === estado.editando);
  if (!m) return;
  Object.assign(ajustes[m.id], { status: $('input[name="mon-status"]:checked').value, obs: $('#mon-edit-obs').value.trim(), atualizadoEm: new Date().toISOString() });
  salvar();
  sincronizar();
  renderMonitoramento();
  fechar('modal-monitoramento');
  toast(`Monitoramento ${m.id} atualizado.`);
  verificarMudancas();   // por último, para o alerta abrir depois de fechar o detalhe
}

// ---------- Exportação ----------
export function exportarCSV() {
  const lista = filtrada();
  if (!lista.length) return toast('Não há registros para exportar.');
  baixarCSV('monitoramento_mcassab',
    ['Protocolo', 'Monitoramento', 'Motorista', 'Placa', 'Transportadora', 'Setor', 'Operacao', 'Data', 'Horario', 'Dispositivo', 'Atualizado em', 'Observacao'],
    lista.map((m) => [m.id, STATUS[m.status], m.motorista, m.placa, m.transportadora, m.setor, m.operacao, formatDataBR(m.data), m.horario, m.dispositivo, dataHora(m.atualizadoEm), m.obs]));
  toast('Monitoramento exportado em CSV!');
}
