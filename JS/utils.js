// Funções pequenas e reutilizáveis por todo o projeto.

export const SETORES = ['FIGUEIRA', 'FARMA/NUTROR', 'ARAUCARIA', 'IPÊ', 'CUPUAÇU'];

// ---------- DOM ----------
export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

export const abrir = (id) => { $(`#${id}`).hidden = false; };
export const fechar = (id) => { $(`#${id}`).hidden = true; };

export const icone = (nome, extra = '') => `<svg class="icone ${extra}"><use href="#i-${nome}"/></svg>`;

// Bloco "rótulo + valor" usado no comprovante e no detalhe do monitoramento
export const campo = (rotulo, valor, classe = '') =>
  `<div class="dado ${classe}"><small>${rotulo}</small><strong>${esc(valor)}</strong></div>`;

let timerToast;
export function toast(mensagem) {
  const el = $('#toast');
  $('#toast-message').textContent = mensagem;
  el.classList.add('is-visivel');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => el.classList.remove('is-visivel'), 3200);
}

// ---------- Texto e datas ----------
// Escapa HTML: evita que texto digitado pelo usuário vire código na tela.
export const esc = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Data de hoje (+ N dias) no formato AAAA-MM-DD, usando o fuso do usuário.
export const hojeISO = (dias = 0) => new Date(Date.now() + dias * 864e5).toLocaleDateString('sv-SE');

export const formatDataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// ---------- Máscaras de campos (usadas via data-mascara="cpf" | "placa") ----------
export const mascaras = {
  cpf: (v) => v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  placa: (v) => {
    const limpo = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return limpo.length > 3 ? `${limpo.slice(0, 3)}-${limpo.slice(3, 7)}` : limpo;
  },
};

// ---------- Armazenamento no navegador ----------
export const carregarJSON = (chave) => {
  try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
};
export const salvarJSON = (chave, valor) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; }
  catch (e) { console.error('Erro ao salvar:', e); return false; }   // ex.: memória do navegador cheia
};

// ---------- Exportação ----------
export function baixarCSV(nome, cabecalho, linhas) {
  const csv = '\uFEFF' + [cabecalho, ...linhas]
    .map((linha) => linha.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  link.download = `${nome}_${hojeISO()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
