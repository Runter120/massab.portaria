// Monitoramento (somente operador): cards, tabela com filtros, paginação e detalhe.
import { $, esc, campo, toast, abrir, fechar, hojeISO, formatDataBR, carregarJSON, salvarJSON, baixarCSV } from './utils.js';

const CHAVE = 'mcassab_portaria_monitoramento_v2';
const POR_PAGINA = 8;

// As cores de cada status ficam no CSS (classe .status-NOME).
export const STATUS = {
  DISPOSITIVO_ASSOCIADO: 'Dispositivo associado',
  RECUPERAR_DISPOSITIVO: 'Recuperar dispositivo',
  FLUXO_DEFINIDO: 'Fluxo definido',
  DOC_VALIDADA: 'Documentação validada',
  DOC_INVALIDADA: 'Documentação invalidada',
  JORNADA_REPROVADA: 'Jornada reprovada',
};
const ALERTAS = ['RECUPERAR_DISPOSITIVO', 'DOC_INVALIDADA', 'JORNADA_REPROVADA'];

const estado = { lista: [], filtro: 'TODOS', pagina: 1, editando: null };

// id, motorista, placa, transportadora, setor, operação, horário, dispositivo, status, minutos atrás, observação
const EXEMPLOS = [
  ['MC-2026-8492', 'Marcos Antônio Oliveira', 'FGH-4J21', 'TransLog Express Ltda', 'FIGUEIRA', 'Carregar', '10:00', 'TRK-0231', 'DISPOSITIVO_ASSOCIADO', 6, ''],
  ['MC-2026-8510', 'Roberto Carlos Mendes', 'RTY-7B19', 'RodoCargo Brasil', 'CUPUAÇU', 'Descarregar', '14:00', '—', 'FLUXO_DEFINIDO', 14, 'Doca 04 definida.'],
  ['MC-2026-8523', 'Luciana Prado Ferreira', 'BRA-2E19', 'Prado Transportes', 'ARAUCARIA', 'Carregar', '06:00', 'TRK-0114', 'DOC_VALIDADA', 22, 'NF e CNH conferidas.'],
  ['MC-2026-8527', 'José Ricardo Alves', 'QPD-5F83', 'Alves & Filhos Logística', 'IPÊ', 'Descarregar', '08:00', 'TRK-0087', 'RECUPERAR_DISPOSITIVO', 35, 'Veículo saiu sem devolver o dispositivo.'],
  ['MC-2026-8531', 'Anderson Silva Rocha', 'LMN-3C47', 'RodoNorte Cargas', 'FARMA/NUTROR', 'Carregar', '12:00', '—', 'DOC_INVALIDADA', 41, 'CNH vencida.'],
  ['MC-2026-8536', 'Paulo Henrique Souza', 'XYZ-8D02', 'TransLog Express Ltda', 'FIGUEIRA', 'Descarregar', '10:00', 'TRK-0302', 'JORNADA_REPROVADA', 55, 'Tempo de direção acima do permitido.'],
  ['MC-2026-8540', 'Carlos Eduardo Lima', 'HJK-1A56', 'Lima Express', 'CUPUAÇU', 'Carregar', '14:00', 'TRK-0150', 'DISPOSITIVO_ASSOCIADO', 63, ''],
  ['MC-2026-8544', 'Fernanda Costa Dias', 'TUV-6G90', 'Costa Dias Transportes', 'ARAUCARIA', 'Descarregar', '14:00', '—', 'FLUXO_DEFINIDO', 78, 'Fluxo: portaria → balança → doca 02.'],
  ['MC-2026-8549', 'Ricardo Gomes Neto', 'DEF-9H31', 'GN Logística', 'IPÊ', 'Carregar', '14:00', 'TRK-0066', 'DOC_VALIDADA', 90, ''],
  ['MC-2026-8553', 'Marcelo Batista Reis', 'MNO-4J77', 'Reis Cargas Pesadas', 'FARMA/NUTROR', 'Descarregar', '06:00', 'TRK-0199', 'RECUPERAR_DISPOSITIVO', 120, 'Dispositivo não localizado no pátio.'],
  ['MC-2026-8558', 'Tiago Moreira Pinto', 'PQR-2K64', 'Pinto & Moreira', 'FIGUEIRA', 'Carregar', '08:00', '—', 'DOC_INVALIDADA', 150, 'NF divergente do pedido.'],
  ['MC-2026-8562', 'Sandra Regina Lopes', 'STU-7L08', 'Lopes Transportes', 'CUPUAÇU', 'Descarregar', '12:00', 'TRK-0245', 'JORNADA_REPROVADA', 180, 'Descanso mínimo não cumprido.'],
];

const minutosAtras = (min) => new Date(Date.now() - min * 60000).toISOString();
const dataHora = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const salvar = () => salvarJSON(CHAVE, estado.lista);

export function carregarMonitoramento() {
  estado.lista = carregarJSON(CHAVE) ?? EXEMPLOS.map(
    ([id, motorista, placa, transportadora, setor, operacao, horario, dispositivo, status, min, obs]) =>
      ({ id, motorista, placa, transportadora, setor, operacao, data: hojeISO(), horario, dispositivo, status, atualizadoEm: minutosAtras(min), obs }));
  salvar();
}

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
  const opcoes = Object.entries(STATUS)
    .map(([chave, rotulo]) => `<option value="${chave}"${chave === m.status ? ' selected' : ''}>${rotulo}</option>`).join('');

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
    <label class="campo"><span>Status do monitoramento</span><select id="mon-edit-status" class="input">${opcoes}</select></label>
    <label class="campo"><span>Observação</span>
      <textarea id="mon-edit-obs" class="input" rows="3" placeholder="Registre detalhes sobre este monitoramento...">${esc(m.obs)}</textarea></label>`;
  abrir('modal-monitoramento');
}

export function salvarDetalhe() {
  const m = estado.lista.find((x) => x.id === estado.editando);
  if (!m) return;
  Object.assign(m, { status: $('#mon-edit-status').value, obs: $('#mon-edit-obs').value.trim(), atualizadoEm: new Date().toISOString() });
  salvar();
  renderMonitoramento();
  fechar('modal-monitoramento');
  toast(`Monitoramento ${m.id} atualizado.`);
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
