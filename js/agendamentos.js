// Agendamentos: dados, etapas do formulário, lista, comprovante e cancelamento.
import { $, $$, esc, campo, icone, abrir, fechar, toast, hojeISO, formatDataBR, carregarJSON, salvarJSON, baixarCSV } from './utils.js';

const CHAVE = 'mcassab_portaria_agendamentos_v1';
const VAGAS = { '06:00': 3, '08:00': 4, '10:00': 3, '12:00': 3, '14:00': 3 };   // horário → vagas

// Quem está usando o sistema: perfil 'operador' | 'motorista' | null
export const sessao = { perfil: null, motorista: null };

const estado = { operacao: '', horario: '', foto: '', filtro: 'TODOS', cancelando: null };
let agendamentos = [];

const agora = () => new Date().toLocaleString('pt-BR');
const normalizar = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

// Operador vê tudo. Motorista vê só o que ele mesmo acabou de agendar.
const visiveis = () => {
  if (sessao.perfil !== 'motorista') return agendamentos;
  const m = sessao.motorista;
  return m ? agendamentos.filter((a) => normalizar(a.motorista) === normalizar(m.nome) && a.cpf.trim() === m.cpf.trim()) : [];
};

// ---------- Dados ----------
const exemplos = () => [
  { id: 'MC-2026-8492', setor: 'FIGUEIRA', operacao: 'Carregar', data: hojeISO(), horario: '10:00', motorista: 'Marcos Antônio Oliveira', cpf: '348.912.450-11', transportadora: 'TransLog Express Ltda', veiculo: 'Carreta', placaCavalo: 'FGH-4J21', placaCarreta: 'KLM-9A82', nf: 'NF 0048291', status: 'CONFIRMADO', criadoEm: agora() },
  { id: 'MC-2026-8510', setor: 'CUPUAÇU', operacao: 'Descarregar', data: hojeISO(1), horario: '14:00', motorista: 'Roberto Carlos Mendes', cpf: '219.874.630-05', transportadora: 'RodoCargo Brasil', veiculo: 'Bitrem / Rodotrem', placaCavalo: 'RTY-7B19', placaCarreta: 'QWE-2C44', nf: 'NF 0091204 / Pedido 441', status: 'CONFIRMADO', criadoEm: agora() },
];

const salvar = () => { const ok = salvarJSON(CHAVE, agendamentos); atualizarBadge(); return ok; };

export function carregarAgendamentos() {
  agendamentos = carregarJSON(CHAVE) ?? exemplos();
  salvar();
}

export const atualizarBadge = () => {
  $('#badge-count').textContent = visiveis().filter((a) => a.status === 'CONFIRMADO').length;
};

export function aplicarPerfil(perfil) {
  sessao.perfil = perfil;
  sessao.motorista = null;
  $('#nav-monitoramento').hidden = perfil !== 'operador';
  atualizarBadge();
  renderAgendamentos();
}

// ---------- Etapa 1: setor e operação ----------
export function escolherOperacao(operacao) {
  estado.operacao = operacao;
  $('#op-error-msg').hidden = true;
  $$('.opcao').forEach((b) => b.classList.toggle('is-ativo', b.dataset.arg === operacao));
}

export function irParaEtapa(n) {
  if (n === 2) {
    if (!estado.operacao) { $('#op-error-msg').hidden = false; return; }
    $('#summary-setor').textContent = $('#select-setor').value;
    $('#summary-operacao').textContent = estado.operacao;
    const descarregar = estado.operacao === 'Descarregar';
    $('#campo-foto').hidden = !descarregar;       // foto só no descarregamento
    $('#input-foto').required = descarregar;
    if (!descarregar) limparFoto();
    renderHorarios();
  }
  $('#etapa-1').hidden = n !== 1;
  $('#etapa-2').hidden = n !== 2;
  $('#pill-1').classList.toggle('is-ativo', n === 1);
  $('#pill-1').classList.toggle('is-feito', n === 2);
  $('#pill-2').classList.toggle('is-ativo', n === 2);
}

// ---------- Foto da carga (obrigatória só no descarregamento) ----------
const limparFoto = () => {
  estado.foto = '';
  $('#input-foto').value = '';
  $('#foto-preview').hidden = true;
  $('#foto-error-msg').hidden = true;
};

// Reduz a foto (lado maior = 900px, JPEG) para caber no armazenamento do navegador.
const redimensionar = (arquivo, max = 900, qualidade = 0.65) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.onload = () => {
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', qualidade));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
  img.src = url;
});

export async function escolherFoto(evento) {
  const arquivo = evento.target.files[0];
  estado.foto = '';
  $('#foto-preview').hidden = true;
  if (!arquivo) return;
  try {
    estado.foto = await redimensionar(arquivo);
    $('#foto-preview').src = estado.foto;
    $('#foto-preview').hidden = false;
    $('#foto-error-msg').hidden = true;
  } catch {
    evento.target.value = '';
    toast('Não foi possível ler essa imagem. Tente outra foto.');
  }
}

// ---------- Etapa 2: data e horário ----------
export const definirDataPadrao = () => {
  const campoData = $('#input-data');
  campoData.min = campoData.value = hojeISO();
};

// { '10:00': 2, ... } → quantos agendamentos confirmados há em cada horário
const ocupacao = (data, setor) => agendamentos.reduce((total, a) => {
  if (a.status === 'CONFIRMADO' && a.data === data && a.setor === setor) total[a.horario] = (total[a.horario] || 0) + 1;
  return total;
}, {});

export function renderHorarios() {
  const usadas = ocupacao($('#input-data').value, $('#select-setor').value);
  const livres = (h) => VAGAS[h] - (usadas[h] || 0);
  const horas = Object.keys(VAGAS);

  if (estado.horario && livres(estado.horario) <= 0) estado.horario = '';   // o horário escolhido lotou

  const total = Object.values(VAGAS).reduce((soma, n) => soma + n, 0);
  const sobra = horas.reduce((soma, h) => soma + Math.max(0, livres(h)), 0);
  $('#vagas-contador').textContent = `${sobra} de ${total} vagas livres neste dia e setor`;

  $('#horarios-grid').innerHTML = horas.map((h) => {
    const n = livres(h);
    if (n <= 0) return `<button type="button" class="horario" disabled title="Horário lotado"><s>${h}</s><small>Lotado</small></button>`;
    const sel = h === estado.horario ? ' is-selecionado' : '';
    return `<button type="button" class="horario${sel}" data-action="horario" data-arg="${h}">${h}<small>${n} ${n === 1 ? 'vaga' : 'vagas'}</small></button>`;
  }).join('');
}

export function escolherHorario(horario) {
  estado.horario = horario;
  $('#horario-error-msg').hidden = true;
  renderHorarios();
}

// Valida e grava. Devolve o novo agendamento (ou null) para a tela decidir o que mostrar.
export function confirmar(evento) {
  evento.preventDefault();
  if (!estado.horario) { $('#horario-error-msg').hidden = false; return null; }

  const data = $('#input-data').value;
  const setor = $('#select-setor').value;
  if ((ocupacao(data, setor)[estado.horario] || 0) >= VAGAS[estado.horario]) {   // confere de novo: pode ter lotado
    toast('Este horário está lotado. Escolha outro.');
    renderHorarios();
    return null;
  }

  const descarregar = estado.operacao === 'Descarregar';
  if (descarregar && !estado.foto) { $('#foto-error-msg').hidden = false; return null; }

  const valor = (seletor) => $(seletor).value.trim();
  const novo = {
    id: `MC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    setor, data,
    operacao: estado.operacao,
    horario: estado.horario,
    motorista: valor('#input-motorista'),
    cpf: valor('#input-cpf'),
    transportadora: valor('#input-transportadora'),
    veiculo: $('#select-veiculo').value,
    placaCavalo: valor('#input-placa-cavalo').toUpperCase(),
    placaCarreta: valor('#input-placa-carreta').toUpperCase() || '-',
    nf: valor('#input-nf'),
    foto: descarregar ? estado.foto : '',
    status: 'CONFIRMADO',
    criadoEm: agora(),
  };

  agendamentos.unshift(novo);
  if (!salvar()) {   // memória do navegador cheia (fotos ocupam espaço)
    agendamentos.shift();
    atualizarBadge();
    toast('Memória do navegador cheia. Cancele/remova agendamentos antigos e tente de novo.');
    return null;
  }
  $('#form-agendamento').reset();
  limparFoto();
  definirDataPadrao();
  estado.horario = '';
  escolherOperacao('');
  return novo;
}

// ---------- Lista ----------
export function definirFiltro(status) {
  estado.filtro = status;
  $$('.chip').forEach((c) => c.classList.toggle('is-ativo', c.dataset.arg === status));
  renderAgendamentos();
}

const cartao = (a) => `
  <article class="item">
    <div class="item__info">
      <div class="item__tags">
        <span class="tag tag--protocolo">${esc(a.id)}</span>
        <span class="tag tag--${a.status.toLowerCase()}">${a.status === 'CONFIRMADO' ? 'Confirmado' : 'Cancelado'}</span>
        <span class="tag">${icone(a.operacao === 'Carregar' ? 'cima' : 'baixo')}${esc(a.operacao)}</span>
        <span class="item__setor">• ${esc(a.setor)}</span>
      </div>
      <div class="dados">
        <div class="dado"><small>Data e Janela</small><strong>${formatDataBR(a.data)} às ${esc(a.horario)}</strong></div>
        <div class="dado"><small>Motorista / Veículo</small><strong>${esc(a.motorista)}</strong> <span class="placa">(${esc(a.placaCavalo)})</span></div>
        <div class="dado"><small>Documento / NF</small><strong>${esc(a.nf)}</strong></div>
      </div>
    </div>
    <div class="item__acoes">
      <button class="btn btn--contorno btn--sm" data-action="comprovante" data-arg="${esc(a.id)}">${icone('documento', 'icone--marca')}Comprovante</button>
      ${a.status === 'CONFIRMADO' ? `<button class="btn btn--perigo-contorno btn--sm" data-action="cancelar" data-arg="${esc(a.id)}">Cancelar</button>` : ''}
    </div>
  </article>`;

export function renderAgendamentos() {
  const termo = $('#busca-agendamentos').value.toLowerCase().trim();
  const lista = visiveis().filter((a) =>
    (estado.filtro === 'TODOS' || a.status === estado.filtro) &&
    [a.id, a.motorista, a.placaCavalo, a.nf, a.setor].some((t) => t.toLowerCase().includes(termo)));

  const dica = sessao.perfil === 'motorista' && !sessao.motorista
    ? 'Realize um agendamento para acompanhá-lo aqui.'
    : 'Tente limpar os filtros ou crie um novo agendamento de portaria.';

  $('#lista-agendamentos').innerHTML = lista.length
    ? lista.map(cartao).join('')
    : `<div class="vazio"><span class="icone-redondo">${icone('calendario')}</span><strong>Nenhum agendamento encontrado</strong><p>${dica}</p></div>`;
}

// ---------- Comprovante e cancelamento ----------
export function abrirComprovante(id) {
  const a = agendamentos.find((x) => x.id === id);
  if (!a) return;
  $('#comprovante-body').innerHTML = `
    <div class="resumo">
      <div><small>Protocolo de Acesso</small><strong class="resumo__destaque">${esc(a.id)}</strong></div>
      <div class="resumo__dir"><small>Status</small><span class="tag tag--${a.status.toLowerCase()}">${a.status}</span></div>
    </div>
    <div class="dados-grid">
      ${campo('Setor', a.setor)}${campo('Operação', a.operacao)}
      ${campo('Data Agendada', formatDataBR(a.data))}${campo('Janela / Horário', a.horario)}
    </div>
    <hr>
    <div class="dados-grid">
      ${campo('Motorista', `${a.motorista} (CPF: ${a.cpf})`, 'dado--largo')}
      ${campo('Transportadora', a.transportadora)}${campo('Tipo de Veículo', a.veiculo)}
      ${campo('Placa Cavalo', a.placaCavalo)}${campo('Placa Carreta', a.placaCarreta)}
      ${campo('Nota Fiscal / Pedido', a.nf, 'dado--largo')}
      ${a.foto ? `<div class="dado dado--largo"><small>Foto da carga</small><img class="foto-comprovante" src="${esc(a.foto)}" alt="Foto da carga anexada"></div>` : ''}
    </div>
    <p class="nota">Apresente este protocolo na portaria MCASSAB com 15 minutos de antecedência. Emitido em ${esc(a.criadoEm)}.</p>`;
  abrir('modal-comprovante');
}

export function pedirCancelamento(id) {
  estado.cancelando = id;
  $('#cancel-protocolo-label').textContent = id;
  abrir('modal-cancelar');
}

export function confirmarCancelamento() {
  const a = agendamentos.find((x) => x.id === estado.cancelando);
  if (a) {
    a.status = 'CANCELADO';
    salvar();
    renderAgendamentos();
    renderHorarios();
    toast(`Agendamento ${a.id} cancelado.`);
  }
  fechar('modal-cancelar');
}

// ---------- Exportação ----------
export function exportarCSV() {
  const lista = visiveis();
  if (!lista.length) return toast('Não há agendamentos para exportar.');
  baixarCSV('agendamentos_mcassab',
    ['Protocolo', 'Status', 'Setor', 'Operacao', 'Data', 'Horario', 'Motorista', 'CPF', 'Transportadora', 'Veiculo', 'Placa Cavalo', 'Placa Carreta', 'Nota Fiscal'],
    lista.map((a) => [a.id, a.status, a.setor, a.operacao, formatDataBR(a.data), a.horario, a.motorista, a.cpf, a.transportadora, a.veiculo, a.placaCavalo, a.placaCarreta, a.nf]));
  toast('Arquivo CSV exportado com sucesso!');
}
