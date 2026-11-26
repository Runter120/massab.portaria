// Ponto de entrada: liga os botões do HTML às funções e controla o fluxo entre telas.
import { $, $$, abrir, fechar, toast, mascaras, SETORES } from './utils.js';
import * as ag from './agendamentos.js';
import * as mon from './monitoramento.js';
import * as alerta from './alerta-documentacao.js';

// ---------- Navegação ----------
const ABAS = ['agendar', 'meus', 'monitoramento'];

function irParaAba(aba) {
  if (aba === 'monitoramento' && ag.sessao.perfil !== 'operador') aba = 'agendar';
  ABAS.forEach((a) => {
    $(`#view-${a}`).hidden = a !== aba;
    $(`#nav-${a}`).classList.toggle('is-ativo', a === aba);
  });
  if (aba === 'meus') ag.renderAgendamentos();
  if (aba === 'monitoramento') mon.renderMonitoramento();
}

// ---------- Perfis e login ----------
function escolherPerfil(perfil) {
  fechar('tela-inicial');
  ag.aplicarPerfil(perfil);
  if (perfil === 'operador') {
    abrir('modal-login');
  } else {
    irParaAba('agendar');
    ag.irParaEtapa(1);
  }
}

function entrar(evento) {
  evento.preventDefault();
  fechar('modal-login');
  ag.aplicarPerfil('operador');
  irParaAba('monitoramento');
  toast('Sessão iniciada no portal MCASSAB.');
}

function sair() {
  ag.aplicarPerfil(null);
  fechar('modal-sucesso');
  fechar('modal-login');
  alerta.limparAlertas();
  irParaAba('agendar');
  abrir('tela-inicial');
}

function confirmarAgendamento(evento) {
  const novo = ag.confirmar(evento);
  if (!novo) return;
  ag.irParaEtapa(1);

  if (ag.sessao.perfil === 'motorista') {
    ag.sessao.motorista = { nome: novo.motorista, cpf: novo.cpf };   // motorista passa a ver só o que agendou
    ag.atualizarBadge();
    ag.renderAgendamentos();
    $('#sucesso-protocolo').textContent = novo.id;
    abrir('modal-sucesso');
  } else {
    irParaAba('meus');
    toast('Agendamento confirmado com sucesso!');
    ag.abrirComprovante(novo.id);
  }
}

// ---------- Ações: cada data-action="nome" do HTML chama a função abaixo ----------
const acoes = {
  perfil: escolherPerfil,
  sair,
  aba: irParaAba,
  etapa: (n) => ag.irParaEtapa(Number(n)),
  operacao: ag.escolherOperacao,
  horario: ag.escolherHorario,
  filtro: ag.definirFiltro,
  comprovante: ag.abrirComprovante,
  cancelar: ag.pedirCancelamento,
  'cancelar-sim': ag.confirmarCancelamento,
  csv: ag.exportarCSV,
  imprimir: () => window.print(),
  fechar,
  'ir-agendamentos': () => { fechar('modal-sucesso'); irParaAba('meus'); },
  'mon-atualizar': () => { mon.recarregar(); toast('Monitoramento atualizado.'); },
  'alerta-fechar': alerta.fecharAlerta,
  'mon-csv': mon.exportarCSV,
  'mon-filtro': mon.definirFiltro,
  'mon-pagina': (delta) => mon.mudarPagina(Number(delta)),
  'mon-detalhe': mon.abrirDetalhe,
  'mon-salvar': mon.salvarDetalhe,
};

document.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-action]');
  if (botao) acoes[botao.dataset.action]?.(botao.dataset.arg);
});

// ---------- Formulários e campos ----------
$('#form-login').addEventListener('submit', entrar);
$('#form-agendamento').addEventListener('submit', confirmarAgendamento);
$('#input-data').addEventListener('change', ag.renderHorarios);
$('#input-foto').addEventListener('change', ag.escolherFoto);
$('#busca-agendamentos').addEventListener('input', ag.renderAgendamentos);
$('#mon-busca').addEventListener('input', mon.buscar);
$('#mon-filtro-setor').addEventListener('change', mon.buscar);
$('#mon-filtro-status').addEventListener('change', (e) => mon.definirFiltro(e.target.value));
$$('[data-mascara]').forEach((input) =>
  input.addEventListener('input', () => { input.value = mascaras[input.dataset.mascara](input.value); }));

// ---------- Início ----------
const listas = { setores: SETORES.map((s) => [s, s]), status: Object.entries(mon.STATUS) };
$$('select[data-lista]').forEach((select) =>
  select.insertAdjacentHTML('beforeend', listas[select.dataset.lista].map(([valor, rotulo]) => `<option value="${valor}">${rotulo}</option>`).join('')));

// Alerta de "Documentação validada": só aparece para o operador
mon.definirAoValidarDocumentacao((registro) => { if (ag.sessao.perfil === 'operador') alerta.alertar(registro); });

ag.carregarAgendamentos();
ag.definirDataPadrao();
ag.renderHorarios();
ag.renderAgendamentos();
mon.carregarMonitoramento();
mon.renderMonitoramento();
