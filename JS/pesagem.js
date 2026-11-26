// Pesagem (somente operador): lista dos agendamentos + modal "Controle de Pesagem".
// As pesagens ficam gravadas dentro do próprio agendamento (campo "pesagens"), em agendamentos.js.
import { $, esc, campo, toast, abrir, fechar, formatDataBR } from './utils.js';
import {
  sessao, agendamentosParaPesagem, buscarAgendamento, salvarPesagens,
  TIPOS_PESAGEM, calcularPesagem, numero, kg, diferencaKg, dataHora,
} from './agendamentos.js';

const estado = { id: null, rascunho: [], alterado: false };

const placas = (a) => (a.placaCarreta && a.placaCarreta !== '-' ? `${a.placaCavalo} / ${a.placaCarreta}` : a.placaCavalo);

// SIMULAÇÃO: ainda não há balança conectada. Para usar a leitura real, troque o corpo desta função
// (API, porta serial, etc.) por uma que devolva o peso em kg.
const lerPesoBalanca = () => new Promise((resolve) => {
  setTimeout(() => resolve(Math.round((8000 + Math.random() * 37000) / 10) * 10), 600);
});

// ---------- Lista ----------
const linha = (a) => {
  const pesagens = a.pesagens ?? [];
  const resumo = pesagens.length
    ? `<span class="badge-status status-PESAGEM">${pesagens.length} ${pesagens.length === 1 ? 'pesagem' : 'pesagens'}</span><small>Líquido ${kg(calcularPesagem(pesagens).liquido)}</small>`
    : '<span class="tag">Sem pesagem</span>';
  return `
    <tr>
      <td><span class="tag tag--protocolo">${esc(a.id)}</span></td>
      <td><strong>${esc(a.motorista)}</strong><small>${esc(placas(a))}</small></td>
      <td>${esc(a.transportadora)}</td>
      <td><strong>${esc(a.setor)}</strong><small>${esc(a.operacao)}</small></td>
      <td><strong>${formatDataBR(a.data)}</strong><small>${esc(a.horario)}</small></td>
      <td>${resumo}</td>
      <td class="direita"><button class="btn ${pesagens.length ? 'btn--contorno' : 'btn--primario'} btn--sm" data-action="pes-abrir" data-arg="${esc(a.id)}"><svg class="icone"><use href="#i-balanca"/></svg>${pesagens.length ? 'Editar' : 'Pesar'}</button></td>
    </tr>`;
};

export function renderPesagem() {
  const termo = $('#pes-busca').value.toLowerCase().trim();
  const situacao = $('#pes-filtro').value;   // TODOS | SEM | COM
  const lista = agendamentosParaPesagem()
    .filter((a) => situacao === 'TODOS' || (situacao === 'COM') === Boolean(a.pesagens?.length))
    .filter((a) => [a.id, a.motorista, a.placaCavalo, a.placaCarreta, a.transportadora].some((t) => String(t ?? '').toLowerCase().includes(termo)))
    .sort((x, y) => `${x.data} ${x.horario}`.localeCompare(`${y.data} ${y.horario}`));

  $('#pes-lista-tbody').innerHTML = lista.length
    ? lista.map(linha).join('')
    : '<tr><td colspan="7" class="vazio-tabela">Nenhum agendamento encontrado para pesagem.</td></tr>';
  $('#pes-resumo').textContent = `${lista.length} ${lista.length === 1 ? 'veículo' : 'veículos'}`;
}

// ---------- Modal "Controle de Pesagem" ----------
export function validarFormulario() {
  $('#pes-adicionar').disabled = !(Number($('#pes-peso').value) > 0);
}

function renderModal() {
  const t = calcularPesagem(estado.rascunho);
  $('#pes-tbody').innerHTML = estado.rascunho.length
    ? estado.rascunho.map((p) => `
        <tr>
          <td><strong>${esc(TIPOS_PESAGEM[p.tipo] ?? p.tipo)}</strong></td>
          <td>${numero(p.peso)}</td>
          <td>${dataHora(p.registradoEm)}</td>
          <td class="direita"><button type="button" class="btn btn--perigo-contorno btn--sm" data-action="pes-remover" data-arg="${esc(p.id)}" aria-label="Remover pesagem"><svg class="icone"><use href="#i-lixeira"/></svg></button></td>
        </tr>`).join('')
    : '<tr><td colspan="4" class="vazio-tabela">Nenhuma pesagem registrada.</td></tr>';
  $('#pes-liquido').textContent = kg(t.liquido);
  const dif = $('#pes-diferenca');
  dif.textContent = diferencaKg(t.diferenca);
  dif.classList.toggle('is-alerta', t.diferenca !== 0);
  $('#pes-aviso').hidden = !estado.alterado;
  validarFormulario();
}

export function abrirPesagem(id) {
  if (sessao.perfil !== 'operador') return;
  const a = buscarAgendamento(id);
  if (!a) return;
  estado.id = id;
  estado.rascunho = (a.pesagens ?? []).map((p) => ({ ...p }));   // edita uma cópia; só grava ao clicar em Salvar
  estado.alterado = false;
  $('#pes-info').innerHTML = `
    <div class="pes-info__topo">
      <span class="tag tag--protocolo">${esc(a.id)}</span>
      <span class="tag">${esc(a.operacao)}</span>
      <span class="item__setor">• ${esc(a.setor)}</span>
    </div>
    <div class="dados-grid">
      ${campo('Motorista', a.motorista, 'dado--largo')}
      ${campo('Transportadora', a.transportadora)}${campo('Placas', placas(a))}
    </div>`;
  $('#pes-tipo').selectedIndex = 0;
  $('#pes-peso').value = '';
  renderModal();
  abrir('modal-pesagem');
  $('#pes-peso').focus();
}

export async function buscarPeso() {
  const botao = $('#pes-buscar');
  const rotulo = $('#pes-buscar-rotulo');
  botao.disabled = true;
  rotulo.textContent = 'Lendo…';
  try {
    $('#pes-peso').value = await lerPesoBalanca();
    validarFormulario();
    toast('Peso lido da balança (simulado).');
  } catch {
    toast('Não foi possível ler o peso da balança.');
  } finally {
    botao.disabled = false;
    rotulo.textContent = 'Buscar peso';
  }
}

export function adicionarPesagem() {
  const peso = Math.round(Number($('#pes-peso').value));
  if (!(peso > 0)) return;
  estado.rascunho.push({
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tipo: $('#pes-tipo').value,
    peso,
    registradoEm: new Date().toISOString(),
  });
  estado.alterado = true;
  $('#pes-peso').value = '';
  renderModal();
  $('#pes-peso').focus();
}

export function removerPesagem(id) {
  estado.rascunho = estado.rascunho.filter((p) => p.id !== id);
  estado.alterado = true;
  renderModal();
}

export function salvarPesagem() {
  if (Number($('#pes-peso').value) > 0) {   // peso digitado e ainda não adicionado: não deixa perder
    toast('Clique em Adicionar para incluir o peso digitado antes de salvar.');
    return;
  }
  if (!salvarPesagens(estado.id, estado.rascunho)) {
    toast('Não foi possível salvar: memória do navegador cheia.');
    return;
  }
  fechar('modal-pesagem');
  renderPesagem();
  toast(`Pesagem do protocolo ${estado.id} salva.`);
}
