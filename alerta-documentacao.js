// Alerta de portaria: pop-up exibido quando um veículo passa para "Documentação validada".
// Usa o mesmo visual dos outros modais do site (.overlay / .modal); aqui só se preenche o conteúdo.
// Quem decide QUANDO alertar é o monitoramento.js; main.js liga os dois.
import { $, abrir, fechar, campo, esc, formatDataBR } from './utils.js';
import { STATUS } from './monitoramento.js';

const TOCAR_SOM = true;   // false = alerta sem som

const fila = [];          // alertas esperando (vários veículos podem ser validados ao mesmo tempo)
let aberto = false;
const tituloOriginal = document.title;

// Três bipes curtos (o navegador pode bloquear áudio se a pessoa ainda não clicou em nada na página)
function beep() {
  if (!TOCAR_SOM) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((atraso) => {
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      volume.gain.value = 0.08;
      osc.connect(volume);
      volume.connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.15);
    });
  } catch { /* sem áudio: o alerta visual continua funcionando */ }
}

// "+ N alerta(s) na fila": atualizado também quando chega um novo alerta com o pop-up já aberto
function atualizarFila() {
  const aviso = $('#alerta-doc-fila');
  if (!aviso) return;
  aviso.hidden = !fila.length;
  aviso.textContent = `+ ${fila.length} alerta(s) na fila`;
}

function mostrarProximo() {
  if (aberto || !fila.length) return;
  const m = fila.shift();
  aberto = true;

  $('#alerta-doc-body').innerHTML = `
    <div class="alerta-doc__destaque">
      <span class="icone-redondo icone-redondo--ok"><svg class="icone"><use href="#i-ok-circulo"/></svg></span>
      <h3 id="alerta-doc-titulo">Liberação na portaria</h3>
      <p class="texto-suave">Detectado às <strong>${new Date().toLocaleTimeString('pt-BR')}</strong></p>
    </div>
    <div class="resumo">
      <div><small>Protocolo</small><strong class="resumo__destaque">${esc(m.id)}</strong></div>
      <span class="badge-status status-DOC_VALIDADA">${STATUS.DOC_VALIDADA}</span>
    </div>
    <div class="dados-grid">
      ${campo('Motorista', m.motorista, 'dado--largo')}
      ${campo('Placa', m.placa)}${campo('Transportadora', m.transportadora)}
      ${campo('Setor / Operação', `${m.setor} · ${m.operacao}`)}${campo('Janela', `${formatDataBR(m.data)} às ${m.horario}`)}
    </div>
    <p id="alerta-doc-fila" class="alerta-doc__fila" hidden></p>`;
  atualizarFila();

  document.title = '● Alerta de portaria — Documentação validada';
  abrir('modal-alerta-doc');
  $('#alerta-doc-ok').focus();
  beep();
}

// Chamado pelo main.js quando um veículo vira "Documentação validada"
export function alertar(registro) {
  fila.push(registro);
  if (aberto) atualizarFila();
  else mostrarProximo();
}

export function fecharAlerta() {
  if (!aberto) return;
  fechar('modal-alerta-doc');
  aberto = false;
  document.title = tituloOriginal;
  mostrarProximo();   // próximo da fila, se houver
}

// Usado ao sair da sessão: descarta o que estiver na fila
export function limparAlertas() {
  fila.length = 0;
  fecharAlerta();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharAlerta(); });
