/*
 * Gerador de cartazes ROMANO (porta do projeto gerador-cartaz-rhc).
 * Roda como página própria (/cartaz.html) e também dentro do /adm, numa aba.
 * Dentro do /adm o editor envia os produtos e os dados da loja por postMessage.
 */
import './gerador.css';
import { builtins, ehMascote, IM, LOGO_PADRAO, MASCOTES, PR, SH, TX, uid } from './modelos.js';
import { lerPlanilha, planilhaDoLote } from './planilha.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clone = (o) => JSON.parse(JSON.stringify(o));
const r2 = (v) => Math.round(v * 2) / 2;

const EMBUTIDO = window.parent !== window;
if (EMBUTIDO) document.documentElement.classList.add('embed');

/* ---------- Fontes ---------- */
const FONTS = ['Anton', 'Archivo Black', 'Oswald', 'Bebas Neue', 'Barlow Condensed', 'Roboto Condensed'];
const WEIGHTS = [400, 500, 600, 700, 800];
const fontStr = (fam, w, size) => `${w || 400} ${size}px "${fam}", "Arial Narrow", Impact, sans-serif`;

/* ---------- Tamanhos ---------- */
const SIZES = [
  ['A6', 105, 148], ['A5', 148, 210], ['A4', 210, 297], ['A3', 297, 420], ['A2', 420, 594],
  ['Cartaz 33 × 48 cm', 330, 480], ['Cartaz 45 × 63 cm', 450, 630], ['Cartaz 66 × 96 cm', 660, 960],
  ['Splash 23 × 16 cm', 230, 160], ['Etiqueta 10 × 7 cm', 100, 70],
];
const SHEETS = { A4: [210, 297], A3: [297, 420], Carta: [216, 279], Oficio: [216, 330] };

const BUILTINS = builtins();

/* ---------- Estado ---------- */
const CHAVE_ESTADO = 'romano.cartaz.state';
const CHAVE_MODELOS = 'romano.cartaz.templates';
const state = {
  tab: 'dados',
  data: { descricao: 'Cimento CP II 50kg', unidade: 'Saco 50 kg', de: '45,00', por: '39,90', validade: 'Válido enquanto durarem os estoques', extra: '', codigo: '', foto: '' },
  size: { preset: 'A4', w: 210, h: 297 },
  out: { sheet: 'placa', margin: 5, copies: 1, cut: true, overlap: 10, dpi: 200 },
  tplId: 'classica',
  loja: { nome: 'ROMANO Home Center', contato: '', logo: '' },
  /** Itens do lote: { descricao, unidade, de, por, codigo, validade, copias } (preços em texto "39,90") */
  loteItens: [],
  sel: null,
};
let customs = [];

/* Dados que chegam do /adm */
const catalogo = { produtos: [], logo: '' };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || 'null');
    if (s) {
      Object.assign(state.data, s.data || {}); Object.assign(state.size, s.size || {}); Object.assign(state.out, s.out || {});
      Object.assign(state.loja, s.loja || {}); if (s.tplId) state.tplId = s.tplId; if (Array.isArray(s.loteItens)) state.loteItens = s.loteItens;
    }
    const c = JSON.parse(localStorage.getItem(CHAVE_MODELOS) || 'null');
    if (Array.isArray(c)) customs = c;
  } catch { /* navegador sem armazenamento */ }
  if (!allTpls().some((t) => t.id === state.tplId)) state.tplId = 'classica';
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ data: state.data, size: state.size, out: state.out, tplId: state.tplId, loja: state.loja, loteItens: state.loteItens })); }
    catch { toast('Não consegui salvar no navegador (espaço cheio). A logo pode ser grande demais.'); }
    try { localStorage.setItem(CHAVE_MODELOS, JSON.stringify(customs)); }
    catch { toast('Não consegui salvar os modelos no navegador (espaço cheio). Exporte-os em .json.'); }
  }, 250);
}

const allTpls = () => BUILTINS.concat(customs);
const cur = () => allTpls().find((t) => t.id === state.tplId) || BUILTINS[0];

/* ---------- Números em BRL ---------- */
function parseBR(v) {
  if (v == null) return NaN;
  let s = String(v).replace(/R\$|\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isFinite(n) ? n : NaN;
}
const fmtBR = (n) => (isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
function makeData(src) {
  const deN = parseBR(src.de), porN = parseBR(src.por);
  const hasDe = isFinite(deN) && deN > 0 && (!isFinite(porN) || deN > porN);
  const eco = hasDe && isFinite(porN) ? deN - porN : NaN;
  const pct = hasDe && isFinite(porN) ? Math.round((1 - porN / deN) * 100) : NaN;
  const copias = Math.round(parseBR(src.copias));
  return {
    deN, porN, hasDe, foto: src.foto || '', copias: isFinite(copias) && copias > 0 ? Math.min(200, copias) : 1,
    tokens: {
      descricao: src.descricao || '', unidade: src.unidade || '', de: fmtBR(deN), por: fmtBR(porN),
      economia: fmtBR(eco), pct: isFinite(pct) ? String(pct) : '', validade: src.validade || '', extra: src.extra || '',
      loja: state.loja.nome || '', contato: state.loja.contato || '', codigo: src.codigo || '',
    },
  };
}
const fillTokens = (str, d) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (k in d.tokens ? d.tokens[k] : m));
const slug = (s) => (s || 'placa').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'placa';

/* ---------- Imagens ---------- */
const imgCache = new Map();
function getImg(src) {
  if (!src) return null;
  let im = imgCache.get(src);
  if (!im) {
    im = new Image();
    // Fotos do catálogo vêm de outro domínio (armazenamento): pede CORS para poder exportar
    if (/^https?:/i.test(src) && !src.startsWith(location.origin)) im.crossOrigin = 'anonymous';
    im.onload = () => { scheduleRender(); agendarMiniaturas(); };
    im.src = src; imgCache.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
const logoAtual = () => state.loja.logo || catalogo.logo || LOGO_PADRAO;
function readImage(file, maxSide, type) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('Não foi possível ler o arquivo.'));
    fr.onload = () => {
      const im = new Image(); im.onerror = () => rej(new Error('Arquivo de imagem inválido.'));
      im.onload = () => {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height)); const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL(type || 'image/png', 0.9));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- Motor de renderização ---------- */
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const t = line + ' ' + words[i];
      if (ctx.measureText(t).width <= maxW) line = t; else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}
function fitText(ctx, text, l, boxW, boxH) {
  const LH = 1.06, maxLines = Math.max(1, l.maxLines | 0);
  let lo = 1, hi = Math.max(2, boxH), best = { size: 1, lines: [text] };
  for (let i = 0; i < 20; i++) {
    const s = (lo + hi) / 2;
    ctx.font = fontStr(l.font, l.weight, s);
    const lines = wrapLines(ctx, text, boxW);
    const ok = lines.length <= maxLines && lines.length * s * LH <= boxH && lines.every((t) => ctx.measureText(t).width <= boxW);
    if (ok) { best = { size: s, lines }; lo = s; } else hi = s;
  }
  return { ...best, lh: LH };
}
function drawText(ctx, l, d, x, y, w, h) {
  let text = fillTokens(l.text, d).trim();
  if (!text) return;
  if (l.upper) text = text.toLocaleUpperCase('pt-BR');
  const f = fitText(ctx, text, l, w, h);
  ctx.font = fontStr(l.font, l.weight, f.size);
  ctx.fillStyle = l.color; ctx.textBaseline = 'middle';
  const lineH = f.size * f.lh, total = f.lines.length * lineH;
  let cy = y + (h - total) / 2 + lineH / 2;
  for (const line of f.lines) {
    const lw = ctx.measureText(line).width;
    const lx = l.align === 'left' ? x : l.align === 'right' ? x + w - lw : x + (w - lw) / 2;
    ctx.textAlign = 'left'; ctx.fillText(line, lx, cy + f.size * 0.04);
    if (l.strike) {
      const t = Math.max(1, f.size * 0.075); ctx.fillStyle = l.strikeColor || l.color;
      ctx.fillRect(lx - f.size * 0.05, cy - t / 2, lw + f.size * 0.1, t); ctx.fillStyle = l.color;
    }
    cy += lineH;
  }
}
function drawPrice(ctx, l, d, x, y, w, h) {
  const val = l.field === 'de' ? d.deN : d.porN;
  if (!isFinite(val)) return;
  const [ip, cp] = fmtBR(val).split(',');
  const B = 200, sSym = 0.32, sC = 0.44, sSuf = 0.15;
  const suffix = fillTokens(l.suffix, d).trim();
  const m = (t, size) => { ctx.font = fontStr(l.font, l.weight, size); const r = ctx.measureText(t); return { w: r.width, a: r.actualBoundingBoxAscent || size * 0.72 }; };
  const mi = m(ip, B), ms = l.showSym ? m('R$', B * sSym) : { w: 0, a: 0 }, mc = m(',' + cp, B * sC), mu = suffix ? m(suffix, B * sSuf) : { w: 0, a: 0 };
  const gap = B * 0.05;
  const totalW = (l.showSym ? ms.w + gap : 0) + mi.w + gap * 0.5 + Math.max(mc.w, mu.w);
  const totalH = mi.a;
  const k = Math.min(w / totalW, h / totalH);
  const W = totalW * k, top = y + (h - totalH * k) / 2;
  let cx = l.align === 'left' ? x : l.align === 'right' ? x + w - W : x + (w - W) / 2;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (l.showSym) {
    ctx.font = fontStr(l.font, l.weight, B * sSym * k); ctx.fillStyle = l.symColor || l.color;
    ctx.fillText('R$', cx, top + ms.a * k + mi.a * k * 0.06); cx += (ms.w + gap) * k;
  }
  ctx.fillStyle = l.color;
  ctx.font = fontStr(l.font, l.weight, B * k); ctx.fillText(ip, cx, top + mi.a * k); cx += (mi.w + gap * 0.5) * k;
  ctx.font = fontStr(l.font, l.weight, B * sC * k); ctx.fillText(',' + cp, cx, top + mc.a * k);
  if (suffix) {
    ctx.font = fontStr(l.font, l.weight, B * sSuf * k); ctx.fillStyle = l.symColor || l.color;
    ctx.fillText(suffix, cx + gap * 0.2 * k, top + mc.a * k + gap * 1.4 * k + mu.a * k);
  }
}
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawShape(ctx, l, x, y, w, h, W) {
  const rad = (l.radius || 0) / 100 * W, sw = (l.strokeW || 0) / 100 * W;
  if (l.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
  else if (l.shape === 'burst') {
    const n = Math.max(5, l.points | 0), inn = Math.min(0.98, Math.max(0.3, +l.inner || 0.8)); ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, f = i % 2 ? inn : 1;
      const px = x + w / 2 + Math.cos(a) * w / 2 * f, py = y + h / 2 + Math.sin(a) * h / 2 * f; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else roundRectPath(ctx, x, y, w, h, rad);
  if (l.shape === 'stripes') {
    ctx.save(); ctx.clip(); ctx.fillStyle = l.fill; ctx.fillRect(x, y, w, h);
    const bw = Math.max(1, (l.stripe || 4) / 100 * W); ctx.fillStyle = l.c2;
    for (let sx = x - h - bw * 2; sx < x + w + bw; sx += bw * 2) { ctx.beginPath(); ctx.moveTo(sx, y + h); ctx.lineTo(sx + bw, y + h); ctx.lineTo(sx + bw + h, y); ctx.lineTo(sx + h, y); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  } else if (!l.noFill) { ctx.fillStyle = l.fill; ctx.fill(); }
  if (sw > 0) { ctx.lineWidth = sw; ctx.strokeStyle = l.stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function drawImageFit(ctx, im, x, y, w, h, fit) {
  const k = fit === 'cover' ? Math.max(w / im.width, h / im.height) : Math.min(w / im.width, h / im.height);
  const iw = im.width * k, ih = im.height * k;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
function srcDaCamada(l, d) { return l.useLogo ? logoAtual() : l.useFoto ? d.foto : l.src; }
function renderPoster(ctx, tpl, d, W, H) {
  ctx.save();
  const bg = tpl.bg || {};
  if (bg.gradient) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2); ctx.fillStyle = g; }
  else ctx.fillStyle = bg.c1 || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (bg.img) { const im = getImg(bg.img); if (im) drawImageFit(ctx, im, 0, 0, W, H, 'cover'); }
  for (const l of tpl.layers) {
    if (!l.visible || (l.requireDe && !d.hasDe)) continue;
    const x = l.x / 100 * W, y = l.y / 100 * H, w = l.w / 100 * W, h = l.h / 100 * H;
    if (w <= 0 || h <= 0) continue;
    ctx.save();
    if (l.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(l.rot * Math.PI / 180); ctx.translate(-(x + w / 2), -(y + h / 2)); }
    if (l.type === 'text') drawText(ctx, l, d, x, y, w, h);
    else if (l.type === 'price') drawPrice(ctx, l, d, x, y, w, h);
    else if (l.type === 'shape') drawShape(ctx, l, x, y, w, h, W);
    else if (l.type === 'image') {
      const im = getImg(srcDaCamada(l, d));
      if (im) { ctx.globalAlpha = Math.max(0, Math.min(1, +l.opacity || 1)); drawImageFit(ctx, im, x, y, w, h, l.fit); }
    }
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- Pré-visualização ---------- */
const cv = $('#cv'), paper = $('#paper'), stage = $('#stage');
let rq = 0;
function scheduleRender() { cancelAnimationFrame(rq); rq = requestAnimationFrame(render); }
const fmtMM = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
function render() {
  const pad = parseFloat(getComputedStyle(stage).paddingLeft) || 20;
  const sw = stage.clientWidth - pad * 2, sh = stage.clientHeight - pad * 2 - 14;
  const { w, h } = state.size; const k = Math.min(sw / w, sh / h);
  const cw = Math.max(40, Math.floor(w * k)), ch = Math.max(40, Math.floor(h * k));
  paper.style.width = cw + 'px'; paper.style.height = ch + 'px';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  renderPoster(cv.getContext('2d'), cur(), makeData(state.data), cv.width, cv.height);
  updateSel();
  const preset = SIZES.find((s) => s[1] === w && s[2] === h) || SIZES.find((s) => s[2] === w && s[1] === h);
  $('#dimL').textContent = `${fmtMM(w)} × ${fmtMM(h)} mm${preset ? ' · ' + preset[0] : ''}`;
  $('#dimR').textContent = cur().name;
}

/* ---------- Galeria de modelos (miniaturas com a oferta atual) ---------- */
let thumbT = 0;
function agendarMiniaturas() { clearTimeout(thumbT); thumbT = setTimeout(desenharMiniaturas, 200); }
function montarGaleria() {
  const box = $('#tplGrid'); box.innerHTML = '';
  for (const t of allTpls()) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tpl-card'; b.dataset.id = t.id;
    b.setAttribute('aria-pressed', String(t.id === state.tplId)); b.title = t.name;
    const c = document.createElement('canvas'); c.dataset.id = t.id;
    const nome = document.createElement('span'); nome.textContent = t.name;
    b.append(c, nome);
    if (t.sazonal) { const s = document.createElement('span'); s.className = 'selo'; s.textContent = 'Sazonal'; b.append(s); }
    else if (!t.builtin) { const s = document.createElement('span'); s.className = 'selo'; s.textContent = 'Meu modelo'; b.append(s); }
    b.addEventListener('click', () => chooseTpl(t.id));
    box.append(b);
  }
  desenharMiniaturas();
}
function desenharMiniaturas() {
  const d = makeData(state.data);
  $$('#tplGrid canvas').forEach((c) => {
    const t = allTpls().find((x) => x.id === c.dataset.id); if (!t) return;
    const paisagem = t.orient === 'paisagem';
    const W = paisagem ? 297 : 210, H = paisagem ? 210 : 297, k = 0.75;
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    renderPoster(c.getContext('2d'), t, d, c.width, c.height);
  });
  $$('#tplGrid .tpl-card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.tplId)));
}

/* ---------- Cálculos e avisos ---------- */
function updateChips() {
  const d = makeData(state.data), el = $('#calcChips'); el.innerHTML = '';
  const add = (t, c) => { const s = document.createElement('span'); s.className = 'chip ' + (c || ''); s.textContent = t; el.append(s); };
  if (!isFinite(d.porN)) add('Informe o valor atual', 'warn');
  else if (isFinite(d.deN) && d.deN > 0 && d.deN <= d.porN) add('O valor antigo precisa ser maior que o atual', 'warn');
  else if (d.hasDe) { add(`Desconto ${d.tokens.pct}%`, 'ok'); add(`Economia R$ ${d.tokens.economia}`, 'ok'); }
  else add('Sem valor antigo: as camadas “De” ficam ocultas');
}

/* ---------- Abas ---------- */
function setTab(t) {
  state.tab = t;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  ['dados', 'modelo', 'tamanho', 'lote', 'loja'].forEach((n) => { $('#tab-' + n).hidden = n !== t; });
  paper.classList.toggle('editing', t === 'modelo');
  if (t === 'modelo') fillTplPanel();
  updateSel();
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* ---------- Formulário da oferta ---------- */
const CAMPOS = ['descricao', 'unidade', 'de', 'por', 'validade', 'extra'];
function aoMudarDados() { updateChips(); scheduleRender(); agendarMiniaturas(); save(); }
CAMPOS.forEach((k) => {
  const el = $('#f-' + k);
  el.addEventListener('input', () => {
    state.data[k] = el.value;
    // Digitou outra descrição: o produto escolhido (código e foto) deixa de valer
    if (k === 'descricao' && state.data.codigo) { state.data.codigo = ''; state.data.foto = ''; }
    aoMudarDados();
  });
});
['de', 'por'].forEach((k) => $('#f-' + k).addEventListener('blur', (e) => {
  const n = parseBR(e.target.value); if (isFinite(n)) { e.target.value = fmtBR(n); state.data[k] = e.target.value; save(); }
}));
function preencherFormulario() { CAMPOS.forEach((k) => { $('#f-' + k).value = state.data[k] || ''; }); }

/* ---------- Produtos do catálogo ---------- */
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function dadosDoProduto(p) {
  const emOferta = p.preco_de > p.preco;
  return {
    descricao: p.nome, unidade: p.unidade || '', de: emOferta ? fmtBR(p.preco_de) : '', por: fmtBR(p.preco),
    codigo: p.sku || '', foto: p.foto_url || '',
  };
}
function listarCatalogo() {
  const box = $('#catLista'); box.innerHTML = '';
  const q = normal($('#catBusca').value.trim());
  if (!q) return;
  const achados = catalogo.produtos.filter((p) => normal(`${p.nome} ${p.sku} ${p.marca}`).includes(q)).slice(0, 40);
  if (!achados.length) { const v = document.createElement('p'); v.className = 'hint'; v.style.padding = '10px'; v.textContent = 'Nenhum produto encontrado.'; box.append(v); return; }
  for (const p of achados) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cat-item';
    if (p.foto_url) { const im = document.createElement('img'); im.src = p.foto_url; im.alt = ''; im.loading = 'lazy'; b.append(im); }
    else { const s = document.createElement('span'); s.className = 'sem-foto'; b.append(s); }
    const info = document.createElement('span'); const n = document.createElement('b'); n.textContent = p.nome;
    const sm = document.createElement('small'); sm.textContent = [p.sku && 'Cód. ' + p.sku, p.unidade, p.marca].filter(Boolean).join(' · ');
    info.append(n, sm);
    const pr = document.createElement('span'); pr.className = 'p';
    if (p.preco_de > p.preco) pr.append(`R$ ${fmtBR(p.preco_de)} → `);
    const bb = document.createElement('b'); bb.textContent = 'R$ ' + fmtBR(p.preco); pr.append(bb);
    b.append(info, pr);
    b.addEventListener('click', () => {
      Object.assign(state.data, dadosDoProduto(p)); preencherFormulario();
      $('#catBusca').value = ''; listarCatalogo(); aoMudarDados(); toast(`“${p.nome}” na placa`);
    });
    box.append(b);
  }
}
$('#catBusca').addEventListener('input', listarCatalogo);

function loteDoCatalogo(filtro, vazio) {
  const lista = catalogo.produtos.filter(filtro);
  if (!lista.length) { toast(vazio); return; }
  state.loteItens = lista.map((p) => { const d = dadosDoProduto(p); return { descricao: d.descricao, unidade: d.unidade, de: d.de, por: d.por, codigo: d.codigo, validade: '', copias: 1 }; });
  renderLote(); save();
  toast(`${lista.length} produto(s) na lista`);
}
$('#loteOfertas').addEventListener('click', () => loteDoCatalogo((p) => p.preco_de > p.preco, 'Nenhum produto com preço “De” maior que o “Por”.'));
$('#loteDestaques').addEventListener('click', () => loteDoCatalogo((p) => p.destaque, 'Nenhum produto marcado como destaque.'));
$('#loteTodos').addEventListener('click', () => loteDoCatalogo(() => true, 'O catálogo ainda não tem produtos.'));

function receberCatalogo(m) {
  catalogo.produtos = Array.isArray(m.produtos) ? m.produtos.filter((p) => p && p.nome) : [];
  catalogo.logo = m.loja?.logo_url || '';
  const temProdutos = catalogo.produtos.length > 0;
  $('#catGroup').hidden = !temProdutos; $('#loteCatGroup').hidden = !temProdutos; $('#planilhaCatalogo').hidden = !temProdutos;
  renderLote();
  // Dados da loja: só preenche o que ainda estiver no padrão
  if (m.loja) {
    if (m.loja.nome && (!state.loja.nome || state.loja.nome === 'ROMANO Home Center')) state.loja.nome = m.loja.nome;
    if (!state.loja.contato) state.loja.contato = [m.loja.whatsapp && formatarFone(m.loja.whatsapp), m.loja.endereco].filter(Boolean).join(' · ');
    $('#lojaNome').value = state.loja.nome; $('#lojaContato').value = state.loja.contato;
  }
  scheduleRender(); agendarMiniaturas();
}
function formatarFone(v) {
  const d = String(v).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.tipo !== 'romano-cartaz:catalogo') return;
  receberCatalogo(e.data);
});

/* ---------- Modelos ---------- */
function fillTplSelect(sel) {
  sel.innerHTML = '';
  const g1 = document.createElement('optgroup'); g1.label = 'Modelos prontos';
  BUILTINS.forEach((t) => g1.append(new Option(t.name, t.id)));
  sel.append(g1);
  if (customs.length) {
    const g2 = document.createElement('optgroup'); g2.label = 'Meus modelos';
    customs.forEach((t) => g2.append(new Option(t.name, t.id))); sel.append(g2);
  }
  sel.value = state.tplId;
}
function refreshTplSelects() { fillTplSelect($('#tplSel')); montarGaleria(); }
function chooseTpl(id) {
  state.tplId = id; state.sel = null;
  const t = cur(), { w, h } = state.size;
  if ((t.orient === 'paisagem' && w < h) || (t.orient === 'retrato' && w > h)) { state.size.w = h; state.size.h = w; fillSizePanel(); }
  fillTplSelect($('#tplSel')); desenharMiniaturas(); if (state.tab === 'modelo') fillTplPanel(); scheduleRender(); save();
}
$('#tplSel').addEventListener('change', (e) => chooseTpl(e.target.value));

function ensureEditable() {
  const t = cur(); if (!t.builtin) return t;
  const c = clone(t); c.id = 'm_' + uid(); c.builtin = false; c.sazonal = false; c.name = t.name + ' (meu)';
  c.layers.forEach((l) => { l.id = uid(); });
  customs.push(c); state.tplId = c.id; refreshTplSelects();
  $('#tplName').value = c.name; $('#tplHint').textContent = '';
  toast(`Criei uma cópia editável: “${c.name}”`);
  return c;
}
function mutateLayer(fn, rebuildList) {
  const t = ensureEditable(); const l = t.layers[state.sel]; if (!l) return;
  fn(l); if (rebuildList) fillLayerList(); scheduleRender(); agendarMiniaturas(); save();
}
function mutateTpl(fn) { const t = ensureEditable(); fn(t); scheduleRender(); agendarMiniaturas(); save(); }

function fillTplPanel() {
  fillTplSelect($('#tplSel'));
  const t = cur();
  $('#tplName').value = t.name;
  $('#tplHint').textContent = t.builtin ? 'Modelo pronto: ao editar qualquer coisa, uma cópia sua é criada automaticamente.' : '';
  $('#tplDel').disabled = !!t.builtin;
  $('#bg1').value = t.bg.c1; $('#bg2').value = t.bg.c2; $('#bgGrad').checked = !!t.bg.gradient;
  fillLayerList(); buildProps();
}
$('#tplName').addEventListener('change', (e) => { const v = e.target.value.trim(); if (!v) return; mutateTpl((t) => { t.name = v; }); refreshTplSelects(); });
$('#tplDup').addEventListener('click', () => {
  const t = clone(cur()); t.id = 'm_' + uid(); t.builtin = false; t.sazonal = false; t.name = cur().name + ' (cópia)'; t.layers.forEach((l) => { l.id = uid(); });
  customs.push(t); state.tplId = t.id; state.sel = null; refreshTplSelects(); fillTplPanel(); scheduleRender(); save(); toast('Modelo duplicado');
});
let delArmed = null;
$('#tplDel').addEventListener('click', (e) => {
  const t = cur(); if (t.builtin) return;
  if (!delArmed) { e.target.textContent = 'Confirmar exclusão'; delArmed = setTimeout(() => { e.target.textContent = 'Excluir'; delArmed = null; }, 3500); return; }
  clearTimeout(delArmed); delArmed = null; e.target.textContent = 'Excluir';
  customs = customs.filter((x) => x.id !== t.id); state.tplId = 'classica'; state.sel = null; refreshTplSelects(); fillTplPanel(); scheduleRender(); save(); toast('Modelo excluído');
});
$('#tplExport').addEventListener('click', () => {
  const t = clone(cur()); delete t.builtin;
  saveFile(`modelo-${slug(t.name)}.json`, new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' }));
});
$('#tplImportBtn').addEventListener('click', () => $('#tplImport').click());
$('#tplImport').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const t = JSON.parse(await f.text());
    if (!t || !Array.isArray(t.layers) || !t.bg) throw new Error();
    t.id = 'm_' + uid(); t.builtin = false; t.name = t.name || 'Modelo importado'; t.layers.forEach((l) => { l.id = uid(); });
    customs.push(t); state.tplId = t.id; state.sel = null; refreshTplSelects(); fillTplPanel(); scheduleRender(); save(); toast(`Modelo “${t.name}” importado`);
  } catch { toast('Esse arquivo não é um modelo válido do gerador de cartazes.'); }
});
$('#bg1').addEventListener('input', (e) => mutateTpl((t) => { t.bg.c1 = e.target.value; }));
$('#bg2').addEventListener('input', (e) => mutateTpl((t) => { t.bg.c2 = e.target.value; }));
$('#bgGrad').addEventListener('change', (e) => mutateTpl((t) => { t.bg.gradient = e.target.checked; }));
$('#bgImgBtn').addEventListener('click', () => $('#bgImg').click());
$('#bgImg').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const src = await readImage(f, 1800, 'image/jpeg'); mutateTpl((t) => { t.bg.img = src; }); } catch (err) { toast(err.message); }
});
$('#bgImgDel').addEventListener('click', () => { if (cur().bg.img) mutateTpl((t) => { t.bg.img = ''; }); });

/* Camadas */
const SHAPE_NAMES = { rect: 'Retângulo', ellipse: 'Elipse', burst: 'Estrela / splash', stripes: 'Faixa listrada' };
function layerLabel(l) {
  if (l.type === 'text') return ['texto', (l.text || '(vazio)').replace(/\n/g, ' ')];
  if (l.type === 'price') return ['preço', l.field === 'de' ? 'Valor antigo' : 'Valor atual'];
  if (l.type === 'shape') return ['forma', SHAPE_NAMES[l.shape] || 'Forma'];
  if (l.useLogo) return ['imagem', 'Logo da loja'];
  if (l.useFoto) return ['imagem', 'Foto do produto'];
  if (ehMascote(l.src)) return ['imagem', 'Mascote · ' + (MASCOTES.find((m) => m.src === l.src)?.nome || '')];
  return ['imagem', 'Imagem'];
}
function fillLayerList() {
  const box = $('#layerList'); box.innerHTML = '';
  const t = cur();
  for (let i = t.layers.length - 1; i >= 0; i--) {
    const l = t.layers[i], [tag, name] = layerLabel(l);
    const row = document.createElement('div'); row.className = 'layer' + (state.sel === i ? ' on' : '');
    const vis = document.createElement('input'); vis.type = 'checkbox'; vis.checked = l.visible; vis.title = 'Visível'; vis.setAttribute('aria-label', 'Visível');
    vis.addEventListener('change', () => { state.sel = i; mutateLayer((x) => { x.visible = vis.checked; }, true); });
    const nb = document.createElement('button'); nb.className = 'name'; nb.type = 'button';
    const tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = tag; nb.append(tg, document.createTextNode(name));
    nb.addEventListener('click', () => { state.sel = i; fillLayerList(); buildProps(); updateSel(); });
    const up = mkBtn('↑', 'Trazer para frente', () => moveLayer(i, 1));
    const dn = mkBtn('↓', 'Enviar para trás', () => moveLayer(i, -1));
    const del = mkBtn('✕', 'Excluir camada', () => { const t2 = ensureEditable(); t2.layers.splice(i, 1); state.sel = null; fillLayerList(); buildProps(); scheduleRender(); agendarMiniaturas(); save(); });
    up.disabled = i === t.layers.length - 1; dn.disabled = i === 0;
    row.append(vis, nb, up, dn, del); box.append(row);
  }
}
function mkBtn(txt, title, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn icon sm'; b.textContent = txt; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', fn); return b; }
function moveLayer(i, dir) {
  const t = ensureEditable(), j = i + dir; if (j < 0 || j >= t.layers.length) return;
  [t.layers[i], t.layers[j]] = [t.layers[j], t.layers[i]]; state.sel = j; fillLayerList(); buildProps(); scheduleRender(); agendarMiniaturas(); save();
}
$$('[data-add]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.add, t = ensureEditable(); let l;
  if (k === 'text') l = TX({ x: 10, y: 40, w: 80, h: 8, text: 'Novo texto' });
  else if (k === 'price') l = PR({ x: 10, y: 55, w: 80, h: 25 });
  else if (k === 'shape') l = SH({ x: 30, y: 30, w: 40, h: 20, fill: '#F5B623' });
  else if (k === 'logo') l = IM({ x: 35, y: 88, w: 30, h: 9, useLogo: true });
  else if (k === 'mascote') l = IM({ x: 64, y: 18, w: 32, h: 45, src: MASCOTES[0].src });
  else if (k === 'foto') { l = IM({ x: 55, y: 20, w: 40, h: 30, useFoto: true }); if (!state.data.foto) toast('Escolha um produto do catálogo (aba Oferta) para a foto aparecer.'); }
  else l = IM({ x: 30, y: 30, w: 40, h: 25 });
  t.layers.push(l); state.sel = t.layers.length - 1; fillLayerList(); buildProps(); scheduleRender(); agendarMiniaturas(); save();
  if (k === 'image') $('#propImgFile')?.click();
}));

/* Propriedades */
function field(label, el, full) { const lab = document.createElement('label'); lab.className = 'f'; lab.append(label, el); if (full) lab.style.gridColumn = '1 / -1'; return lab; }
function inp(type, val, on, attrs) {
  const e = document.createElement('input'); e.type = type; if (type === 'checkbox') e.checked = !!val; else e.value = val;
  Object.assign(e, attrs || {}); e.addEventListener(type === 'checkbox' || type === 'file' ? 'change' : 'input', () => on(type === 'checkbox' ? e.checked : e.value, e)); return e;
}
function sel(opts, val, on) { const s = document.createElement('select'); opts.forEach(([v, t]) => s.append(new Option(t, v))); s.value = String(val); s.addEventListener('change', () => on(s.value)); return s; }
function chk(label, val, on) { const l = document.createElement('label'); l.className = 'check'; l.append(inp('checkbox', val, on), document.createTextNode(label)); return l; }
function grid(n, ...els) { const d = document.createElement('div'); d.className = 'row' + (n === 3 ? ' r3' : n === 4 ? ' r4' : ''); d.append(...els); return d; }
function segAlign(val, on) {
  const d = document.createElement('div'); d.className = 'seg';
  [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']].forEach(([v, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
    b.setAttribute('aria-pressed', String(val === v));
    b.addEventListener('click', () => { d.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); on(v); });
    d.append(b);
  });
  return d;
}
const num = (v, on, st) => inp('number', v, (x) => { const n = parseFloat(x); if (isFinite(n)) on(n); }, { step: st || 0.5 });
const fontSel = (l) => sel(FONTS.map((f) => [f, f]), l.font, (v) => mutateLayer((x) => { x.font = v; }));
const weightSel = (l) => sel(WEIGHTS.map((w) => [w, String(w)]), l.weight, (v) => mutateLayer((x) => { x.weight = +v; }));

function buildProps() {
  const box = $('#props'); box.innerHTML = '';
  const t = cur(), l = t.layers[state.sel]; if (!l) return;
  const title = document.createElement('p'); title.className = 'group-title'; title.textContent = 'Camada: ' + layerLabel(l)[1].slice(0, 40); box.append(title);
  if (l.type === 'text') {
    const ta = document.createElement('textarea'); ta.rows = 2; ta.value = l.text; ta.id = 'propText';
    ta.addEventListener('input', () => mutateLayer((x) => { x.text = ta.value; })); ta.addEventListener('change', () => fillLayerList());
    box.append(field('Texto (use os campos abaixo)', ta));
    const chips = document.createElement('div'); chips.className = 'chips';
    ['descricao', 'unidade', 'de', 'por', 'economia', 'pct', 'validade', 'extra', 'loja', 'contato', 'codigo'].forEach((k) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = '{' + k + '}';
      b.addEventListener('click', () => { const p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + '{' + k + '}' + ta.value.slice(ta.selectionEnd ?? p); ta.dispatchEvent(new Event('input')); fillLayerList(); ta.focus(); });
      chips.append(b);
    });
    box.append(chips);
    box.append(grid(2, field('Fonte', fontSel(l)), field('Peso', weightSel(l))));
    box.append(grid(3, field('Cor', inp('color', l.color, (v) => mutateLayer((x) => { x.color = v; }))),
      field('Máx. linhas', num(l.maxLines, (v) => mutateLayer((x) => { x.maxLines = Math.max(1, Math.round(v)); }), 1)),
      field('Cor do risco', inp('color', l.strikeColor || l.color, (v) => mutateLayer((x) => { x.strikeColor = v; })))));
    box.append(field('Alinhamento', segAlign(l.align, (v) => mutateLayer((x) => { x.align = v; }))));
    box.append(grid(2, chk('Maiúsculas', l.upper, (v) => mutateLayer((x) => { x.upper = v; })), chk('Riscado', l.strike, (v) => mutateLayer((x) => { x.strike = v; }))));
  }
  if (l.type === 'price') {
    box.append(grid(2, field('Valor', sel([['por', 'Valor atual (Por)'], ['de', 'Valor antigo (De)']], l.field, (v) => mutateLayer((x) => { x.field = v; }, true))), field('Fonte', fontSel(l))));
    box.append(grid(3, field('Cor', inp('color', l.color, (v) => mutateLayer((x) => { x.color = v; }))),
      field('Cor do R$', inp('color', l.symColor || l.color, (v) => mutateLayer((x) => { x.symColor = v; }))), field('Peso', weightSel(l))));
    box.append(field('Alinhamento', segAlign(l.align, (v) => mutateLayer((x) => { x.align = v; }))));
    box.append(field('Texto sob os centavos (ex.: cada, /m², {unidade})', inp('text', l.suffix, (v) => mutateLayer((x) => { x.suffix = v; }))));
    box.append(chk('Mostrar R$', l.showSym, (v) => mutateLayer((x) => { x.showSym = v; })));
  }
  if (l.type === 'shape') {
    box.append(field('Forma', sel(Object.entries(SHAPE_NAMES), l.shape, (v) => { mutateLayer((x) => { x.shape = v; }, true); buildProps(); })));
    box.append(grid(2, field('Preenchimento', inp('color', l.fill, (v) => mutateLayer((x) => { x.fill = v; }))), field('Cor da borda', inp('color', l.stroke, (v) => mutateLayer((x) => { x.stroke = v; })))));
    box.append(grid(2, field('Borda (% larg.)', num(l.strokeW, (v) => mutateLayer((x) => { x.strokeW = Math.max(0, v); }), 0.1)),
      field('Cantos (% larg.)', num(l.radius, (v) => mutateLayer((x) => { x.radius = Math.max(0, v); }), 0.5))));
    if (l.shape === 'burst') box.append(grid(2, field('Pontas', num(l.points, (v) => mutateLayer((x) => { x.points = Math.max(5, Math.round(v)); }), 1)),
      field('Profundidade (0,3–0,98)', num(l.inner, (v) => mutateLayer((x) => { x.inner = v; }), 0.02))));
    if (l.shape === 'stripes') box.append(grid(2, field('Cor da listra', inp('color', l.c2, (v) => mutateLayer((x) => { x.c2 = v; }))),
      field('Largura da listra (%)', num(l.stripe, (v) => mutateLayer((x) => { x.stripe = Math.max(0.5, v); }), 0.5))));
    if (l.shape !== 'stripes') box.append(chk('Sem preenchimento (só borda)', l.noFill, (v) => mutateLayer((x) => { x.noFill = v; })));
  }
  if (l.type === 'image') {
    const origem = l.useLogo ? 'logo' : l.useFoto ? 'foto' : ehMascote(l.src) ? 'mascote' : 'arquivo';
    box.append(field('Imagem', sel([['mascote', 'Mascote ROMANO'], ['foto', 'Foto do produto'], ['logo', 'Logo da loja'], ['arquivo', 'Arquivo enviado']], origem, (v) => {
      mutateLayer((x) => {
        x.useLogo = v === 'logo'; x.useFoto = v === 'foto';
        if (v === 'mascote' && !ehMascote(x.src)) x.src = MASCOTES[0].src;
        if (v === 'arquivo' && ehMascote(x.src)) x.src = '';
      }, true);
      buildProps();
    })));
    if (origem === 'mascote') {
      box.append(field('Pose do mascote', sel(MASCOTES.map((m) => [m.src, m.nome]), l.src, (v) => mutateLayer((x) => { x.src = v; }, true))));
    }
    if (origem === 'arquivo') {
      const f = inp('file', '', async (v, e) => {
        const file = e.files[0]; e.value = ''; if (!file) return;
        try { const src = await readImage(file, 1400, 'image/png'); mutateLayer((x) => { x.src = src; }); } catch (err) { toast(err.message); }
      }, { accept: 'image/*', id: 'propImgFile' });
      box.append(field('Arquivo de imagem', f));
    }
    box.append(grid(2, field('Ajuste', sel([['contain', 'Caber inteira'], ['cover', 'Preencher']], l.fit, (v) => mutateLayer((x) => { x.fit = v; }))),
      field('Opacidade (0–1)', num(l.opacity, (v) => mutateLayer((x) => { x.opacity = Math.max(0, Math.min(1, v)); }), 0.05))));
  }
  const pos = document.createElement('p'); pos.className = 'group-title'; pos.textContent = 'Posição (% da placa)'; box.append(pos);
  box.append(grid(4,
    field('X', num(l.x, (v) => mutateLayer((x) => { x.x = v; }), 0.5)), field('Y', num(l.y, (v) => mutateLayer((x) => { x.y = v; }), 0.5)),
    field('Largura', num(l.w, (v) => mutateLayer((x) => { x.w = Math.max(0.5, v); }), 0.5)), field('Altura', num(l.h, (v) => mutateLayer((x) => { x.h = Math.max(0.3, v); }), 0.5))));
  $$('#props input[type=number]').slice(-4).forEach((e, i) => { e.dataset.pos = ['x', 'y', 'w', 'h'][i]; });
  box.append(grid(2, field('Rotação (°)', num(l.rot, (v) => mutateLayer((x) => { x.rot = v; }), 1)),
    field(' ', chk('Só aparece com valor antigo', l.requireDe, (v) => mutateLayer((x) => { x.requireDe = v; })))));
}
function syncPosInputs() { const l = cur().layers[state.sel]; if (!l) return; $$('#props [data-pos]').forEach((e) => { if (document.activeElement !== e) e.value = l[e.dataset.pos]; }); }

/* Seleção e arraste na placa */
function updateSel() {
  const s = $('#sel'), l = cur().layers[state.sel];
  if (state.tab !== 'modelo' || !l) { s.hidden = true; return; }
  const W = paper.clientWidth, H = paper.clientHeight;
  s.hidden = false; s.style.left = l.x / 100 * W + 'px'; s.style.top = l.y / 100 * H + 'px'; s.style.width = l.w / 100 * W + 'px'; s.style.height = l.h / 100 * H + 'px';
}
let drag = null;
function ptPct(e) { const r = paper.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100]; }
paper.addEventListener('pointerdown', (e) => {
  if (state.tab !== 'modelo') return;
  const [px, py] = ptPct(e), t = cur(), d = makeData(state.data);
  if (e.target.id === 'handle' && t.layers[state.sel]) { drag = { mode: 'resize', px, py, l0: { ...t.layers[state.sel] }, moved: false }; }
  else {
    let hit = null;
    for (let i = t.layers.length - 1; i >= 0; i--) {
      const l = t.layers[i]; if (!l.visible || (l.requireDe && !d.hasDe)) continue;
      if (px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h) { hit = i; break; }
    }
    state.sel = hit; fillLayerList(); buildProps(); updateSel();
    if (hit == null) return;
    drag = { mode: 'move', px, py, l0: { ...t.layers[hit] }, moved: false };
  }
  paper.setPointerCapture(e.pointerId); e.preventDefault();
});
paper.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [px, py] = ptPct(e), dx = px - drag.px, dy = py - drag.py;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 0.4) return;
  if (!drag.moved) { drag.moved = true; ensureEditable(); }
  const l = cur().layers[state.sel]; if (!l) return;
  if (drag.mode === 'move') { l.x = r2(drag.l0.x + dx); l.y = r2(drag.l0.y + dy); }
  else { l.w = Math.max(1, r2(drag.l0.w + dx)); l.h = Math.max(0.5, r2(drag.l0.h + dy)); }
  updateSel(); syncPosInputs(); scheduleRender();
});
const endDrag = () => { if (drag && drag.moved) { save(); fillLayerList(); agendarMiniaturas(); } drag = null; };
paper.addEventListener('pointerup', endDrag); paper.addEventListener('pointercancel', endDrag);
document.addEventListener('keydown', (e) => {
  if (state.tab !== 'modelo' || state.sel == null) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const st = e.shiftKey ? 2 : 0.5, map = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
  if (!map[e.key]) return; e.preventDefault();
  mutateLayer((l) => { l.x = r2(l.x + map[e.key][0]); l.y = r2(l.y + map[e.key][1]); }); updateSel(); syncPosInputs();
});

/* ---------- Tamanho ---------- */
function fillSizePanel() {
  const ps = $('#sizePreset');
  if (!ps.options.length) { SIZES.forEach((s) => ps.append(new Option(`${s[0]} — ${s[1]} × ${s[2]} mm`, s[0]))); ps.append(new Option('Personalizado', 'custom')); }
  const { w, h } = state.size; const m = SIZES.find((s) => (s[1] === w && s[2] === h) || (s[2] === w && s[1] === h));
  ps.value = m ? m[0] : 'custom'; $('#sizeW').value = w; $('#sizeH').value = h;
  $('#outSheet').value = state.out.sheet; $('#outMargin').value = state.out.margin; $('#outCopies').value = state.out.copies;
  $('#outOverlap').value = state.out.overlap; $('#outCut').checked = state.out.cut; $('#outDpi').value = String(state.out.dpi);
  updateSheetInfo();
}
$('#sizePreset').addEventListener('change', (e) => {
  const s = SIZES.find((x) => x[0] === e.target.value); if (!s) return;
  const land = state.size.w > state.size.h;
  state.size.w = land ? s[2] : s[1]; state.size.h = land ? s[1] : s[2]; fillSizePanel(); scheduleRender(); save();
});
['sizeW', 'sizeH'].forEach((id) => $('#' + id).addEventListener('change', (e) => {
  const n = Math.max(20, Math.min(3000, parseFloat(e.target.value) || 0)); state.size[id === 'sizeW' ? 'w' : 'h'] = n; fillSizePanel(); scheduleRender(); save();
}));
$('#sizeSwap').addEventListener('click', () => { const { w, h } = state.size; state.size.w = h; state.size.h = w; fillSizePanel(); scheduleRender(); save(); });
$('#outSheet').addEventListener('change', (e) => { state.out.sheet = e.target.value; updateSheetInfo(); save(); });
$('#outMargin').addEventListener('change', (e) => { state.out.margin = Math.max(0, Math.min(30, +e.target.value || 0)); updateSheetInfo(); save(); });
$('#outCopies').addEventListener('change', (e) => { state.out.copies = Math.max(1, Math.min(200, Math.round(+e.target.value || 1))); updateSheetInfo(); save(); });
$('#outOverlap').addEventListener('change', (e) => { state.out.overlap = Math.max(0, Math.min(40, +e.target.value || 0)); updateSheetInfo(); save(); });
$('#outCut').addEventListener('change', (e) => { state.out.cut = e.target.checked; updateSheetInfo(); save(); });
$('#outDpi').addEventListener('change', (e) => { state.out.dpi = +e.target.value; save(); });
function updateSheetInfo() {
  const el = $('#sheetInfo'); el.innerHTML = '';
  const p = planSheets(state.out.copies); const c = document.createElement('span'); c.className = 'chip'; c.textContent = p.info; el.append(c);
}

/* ---------- Montagem de folhas (imposição e divisão) ---------- */
function layoutFor(sw, sh) {
  const { w: pw, h: ph } = state.size, m = state.out.margin, gap = state.out.cut ? 8 : 3;
  const cols = Math.floor((sw - 2 * m + gap) / (pw + gap)), rows = Math.floor((sh - 2 * m + gap) / (ph + gap));
  return { cols: Math.max(0, cols), rows: Math.max(0, rows), gap, sw, sh };
}
/** total = número de placas a imprimir (já contando as cópias) */
function planSheets(total) {
  const { w: pw, h: ph } = state.size, out = state.out;
  if (out.sheet === 'placa') return { mode: 'same', info: `${total} página(s) de ${fmtMM(pw)} × ${fmtMM(ph)} mm` };
  const [a, b] = SHEETS[out.sheet];
  const P = layoutFor(a, b), L = layoutFor(b, a);
  const best = (L.cols * L.rows > P.cols * P.rows) ? L : P;
  const per = best.cols * best.rows;
  if (per >= 1) { const n = Math.ceil(total / per); return { mode: 'grid', lay: best, per, info: `${per} por folha ${out.sheet} · ${n} folha(s)` }; }
  const m = out.margin, ov = Math.min(out.overlap, Math.min(a, b) / 3);
  const tiles = (sw, sh) => { const uw = sw - 2 * m, uh = sh - 2 * m; const nx = Math.max(1, Math.ceil((pw - ov) / (uw - ov))), ny = Math.max(1, Math.ceil((ph - ov) / (uh - ov))); return { nx, ny, uw, uh, sw, sh, ov }; };
  const tp = tiles(a, b), tl = tiles(b, a); const t = (tl.nx * tl.ny < tp.nx * tp.ny) ? tl : tp;
  return { mode: 'tile', tile: t, info: `Dividida em ${t.nx * t.ny} folhas ${out.sheet} (${t.nx} × ${t.ny}) por placa · sobreposição ${fmtMM(t.ov)} mm` };
}
function buildSheets(datas) {
  const tpl = cur(), { w: pw, h: ph } = state.size, out = state.out;
  // Cópias: as da aba Tamanho × as da coluna Cópias da planilha
  const list = []; datas.forEach((d) => { for (let i = 0; i < out.copies * (d.copias || 1); i++) list.push(d); });
  const plan = planSheets(list.length); const sheets = [];
  const placaDe = []; datas.forEach((d, i) => { for (let j = 0; j < out.copies * (d.copias || 1); j++) placaDe.push(i + 1); });
  if (plan.mode === 'same') {
    list.forEach((d) => sheets.push({ w: pw, h: ph, draw: (ctx, k) => renderPoster(ctx, tpl, d, pw * k, ph * k) }));
  } else if (plan.mode === 'grid') {
    const L = plan.lay, bw = L.cols * pw + (L.cols - 1) * L.gap, bh = L.rows * ph + (L.rows - 1) * L.gap;
    const ox = (L.sw - bw) / 2, oy = (L.sh - bh) / 2;
    for (let s = 0; s < list.length; s += plan.per) {
      const chunk = list.slice(s, s + plan.per);
      sheets.push({
        w: L.sw, h: L.sh, draw: (ctx, k) => {
          chunk.forEach((d, i) => {
            const c = i % L.cols, r = Math.floor(i / L.cols); const x = (ox + c * (pw + L.gap)) * k, y = (oy + r * (ph + L.gap)) * k;
            ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, pw * k, ph * k); ctx.clip(); renderPoster(ctx, tpl, d, pw * k, ph * k); ctx.restore();
            if (out.cut) cutMarks(ctx, x, y, pw * k, ph * k, k);
          });
        },
      });
    }
  } else {
    const T = plan.tile, n = T.nx * T.ny, m = out.margin;
    list.forEach((d, idx) => {
      for (let r = 0; r < T.ny; r++) for (let c = 0; c < T.nx; c++) {
        const ox = c * (T.uw - T.ov), oy = r * (T.uh - T.ov), part = r * T.nx + c + 1;
        sheets.push({
          w: T.sw, h: T.sh, draw: (ctx, k) => {
            const vw = Math.min(T.uw, pw - ox), vh = Math.min(T.uh, ph - oy);
            ctx.save(); ctx.beginPath(); ctx.rect(m * k, m * k, vw * k, vh * k); ctx.clip();
            ctx.translate((m - ox) * k, (m - oy) * k); renderPoster(ctx, tpl, d, pw * k, ph * k); ctx.restore();
            ctx.save(); ctx.strokeStyle = '#777'; ctx.lineWidth = Math.max(1, 0.25 * k); ctx.setLineDash([2 * k, 1.5 * k]);
            if (c > 0) { ctx.beginPath(); ctx.moveTo((m + T.ov) * k, m * k); ctx.lineTo((m + T.ov) * k, (m + vh) * k); ctx.stroke(); }
            if (r > 0) { ctx.beginPath(); ctx.moveTo(m * k, (m + T.ov) * k); ctx.lineTo((m + vw) * k, (m + T.ov) * k); ctx.stroke(); }
            ctx.setLineDash([]); ctx.strokeRect(m * k, m * k, vw * k, vh * k);
            if (m >= 3) {
              ctx.fillStyle = '#444'; ctx.font = `500 ${Math.min(2.6, m * 0.6) * k}px "IBM Plex Mono", monospace`; ctx.textBaseline = 'middle';
              ctx.fillText(`Placa ${placaDe[idx]} · parte ${part}/${n} · linha ${r + 1}, coluna ${c + 1} · cole sobre a linha tracejada`, m * k, (T.sh - m / 2) * k);
            }
            ctx.restore();
          },
        });
      }
    });
  }
  return sheets;
}
function cutMarks(ctx, x, y, w, h, k) {
  const L = 3 * k, o = 1 * k; ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, 0.2 * k); ctx.beginPath();
  [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]].forEach(([cx, cy, sx, sy]) => {
    ctx.moveTo(cx + sx * o, cy); ctx.lineTo(cx + sx * (o + L), cy); ctx.moveTo(cx, cy + sy * o); ctx.lineTo(cx, cy + sy * (o + L));
  });
  ctx.stroke(); ctx.restore();
}
function canvasFor(wMm, hMm, dpi, draw) {
  let k = dpi / 25.4;
  while (wMm * k * hMm * k > 70e6) k *= 0.85;
  const c = document.createElement('canvas'); c.width = Math.round(wMm * k); c.height = Math.round(hMm * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); draw(ctx, c.width / wMm); return c;
}

/* ---------- Saída de arquivos ---------- */
async function saveFile(name, blob) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000); toast(`Arquivo gerado: ${name}`);
}
const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
const tick = () => new Promise((r) => setTimeout(r, 0));
function setStatus(t) { $('#status').textContent = t || ''; }
const currentDatas = () => [makeData(state.data)];
function checkReady(datas) {
  if (datas.some((d) => !isFinite(d.porN))) { toast('Informe o valor atual antes de gerar.'); setTab('dados'); $('#f-por').focus(); return false; }
  return true;
}
// Se uma foto de outro domínio bloquear a exportação, avisa em vez de falhar calado
async function exportarComSeguranca(fn) {
  try { await fn(); }
  catch (err) {
    setStatus('');
    if (err && err.name === 'SecurityError') toast('A foto do produto bloqueou a exportação. Remova a camada “Foto do produto” ou envie a imagem como arquivo.');
    else toast('Não foi possível gerar o arquivo. Tente de novo.');
  }
}
async function exportImage(type) {
  const d = makeData(state.data); if (!checkReady([d])) return;
  setStatus('Gerando imagem…'); await tick();
  const { w, h } = state.size;
  const c = canvasFor(w, h, state.out.dpi, (ctx, k) => renderPoster(ctx, cur(), d, w * k, h * k));
  const blob = await toBlob(c, type === 'png' ? 'image/png' : 'image/jpeg', 0.93);
  setStatus('');
  if (!blob) throw Object.assign(new Error('bloqueado'), { name: 'SecurityError' });
  await saveFile(`cartaz-${slug(state.data.descricao)}.${type === 'png' ? 'png' : 'jpg'}`, blob);
}
async function makePdf(datas) {
  if (!window.jspdf) { toast('A biblioteca de PDF não carregou. Verifique a conexão e recarregue a página.'); return null; }
  const sheets = buildSheets(datas); const { jsPDF } = window.jspdf; let doc = null;
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]; setStatus(`Gerando PDF: página ${i + 1} de ${sheets.length}…`); await tick();
    const c = canvasFor(s.w, s.h, state.out.dpi, s.draw);
    const o = s.w > s.h ? 'landscape' : 'portrait';
    if (!doc) doc = new jsPDF({ unit: 'mm', format: [s.w, s.h], orientation: o, compress: true }); else doc.addPage([s.w, s.h], o);
    doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, s.w, s.h, undefined, 'FAST');
  }
  setStatus(''); return doc ? doc.output('blob') : null;
}
async function exportPdf(datas, name) {
  if (!checkReady(datas)) return;
  const blob = await makePdf(datas); if (blob) await saveFile(name, blob);
}
async function printSheets(datas) {
  if (!checkReady(datas)) return;
  const sheets = buildSheets(datas), area = $('#printArea'); area.innerHTML = '';
  const dpi = Math.min(state.out.dpi, 200), imgs = [];
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]; setStatus(`Preparando impressão: ${i + 1} de ${sheets.length}…`); await tick();
    const c = canvasFor(s.w, s.h, dpi, s.draw); const im = new Image(); im.src = c.toDataURL('image/jpeg', 0.92);
    im.style.width = s.w + 'mm'; im.style.height = s.h + 'mm'; area.append(im); imgs.push(im);
  }
  $('#pageStyle').textContent = `@page{size:${sheets[0].w}mm ${sheets[0].h}mm;margin:0}`;
  await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  setStatus(''); window.print();
}

$('#btnPng').addEventListener('click', () => exportarComSeguranca(() => exportImage('png')));
$('#btnJpg').addEventListener('click', () => exportarComSeguranca(() => exportImage('jpg')));
$('#btnPdf').addEventListener('click', () => exportarComSeguranca(() => exportPdf(currentDatas(), `cartaz-${slug(state.data.descricao)}.pdf`)));
$('#btnPrint').addEventListener('click', () => exportarComSeguranca(() => printSheets(currentDatas())));

/* ---------- Lote ---------- */
/* Produto do catálogo correspondente a um item (pelo código ou pelo nome): traz a foto */
function produtoDoItem(it) {
  return catalogo.produtos.find((p) => it.codigo && String(p.sku) === String(it.codigo)) || catalogo.produtos.find((p) => p.nome === it.descricao);
}
/* Dados de uma placa do lote: validade em branco usa a da aba Oferta */
function dadosDoItem(it) {
  const extra = { ...it, foto: produtoDoItem(it)?.foto_url || '' };
  if (!String(it.validade || '').trim()) delete extra.validade;
  return makeData({ ...state.data, ...extra });
}
const txt = (v) => String(v ?? '').trim();
const precoTxt = (v) => { const n = typeof v === 'number' ? v : parseBR(v); return isFinite(n) && n > 0 ? fmtBR(n) : ''; };

function renderLote() {
  const box = $('#loteList'); box.innerHTML = '';
  const itens = state.loteItens;
  let semPreco = 0, totalPlacas = 0;
  itens.forEach((it) => {
    const d = dadosDoItem(it);
    if (!isFinite(d.porN)) semPreco++;
    totalPlacas += d.copias;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lote-item' + (!isFinite(d.porN) ? ' bad' : '');
    const n = document.createElement('span'); n.textContent = it.descricao + (it.unidade ? ' · ' + it.unidade : '');
    if (d.copias > 1) { const q = document.createElement('span'); q.className = 'q'; q.textContent = `× ${d.copias}`; n.append(q); }
    const p = document.createElement('span'); p.className = 'p';
    if (isFinite(d.porN)) { if (d.hasDe) p.append(`R$ ${d.tokens.de} → `); const bb = document.createElement('b'); bb.textContent = 'R$ ' + d.tokens.por; p.append(bb); }
    else p.textContent = 'sem valor atual';
    b.append(n, p);
    b.addEventListener('click', () => {
      Object.assign(state.data, { descricao: it.descricao, de: it.de, por: it.por, unidade: it.unidade, codigo: it.codigo || '', foto: d.foto });
      if (txt(it.validade)) state.data.validade = it.validade;
      preencherFormulario(); aoMudarDados();
    });
    box.append(b);
  });
  const resumo = $('#loteResumo'); resumo.innerHTML = '';
  resumo.hidden = !itens.length; $('#loteDica').hidden = !itens.length; $('#loteLimpar').hidden = !itens.length;
  if (itens.length) {
    const chip = (t, c) => { const s = document.createElement('span'); s.className = 'chip ' + (c || ''); s.textContent = t; resumo.append(s); };
    chip(`${itens.length} produto(s)`, 'ok');
    if (totalPlacas !== itens.length) chip(`${totalPlacas} placas com as cópias`);
    if (semPreco) chip(`${semPreco} sem valor atual`, 'warn');
  }
}

/* Planilha modelo e importação */
$('#planilhaModelo').addEventListener('click', () => exportarComSeguranca(async () => {
  const exemplos = [
    { codigo: '100101', descricao: 'Cimento CP II-E-32 50 kg', unidade: 'saco 50 kg', de: 44.9, por: 39.9, validade: '', copias: 2 },
    { codigo: '100401', descricao: 'Tinta acrílica fosca branco neve 18 L', unidade: 'lata 18 L', de: 339.9, por: 289.9, validade: '', copias: 1 },
    { codigo: '', descricao: 'Jogo de chaves combinadas 12 peças', unidade: 'jogo', de: '', por: 89.9, validade: 'Só neste sábado', copias: 1 },
  ];
  await saveFile('cartazes-modelo.xlsx', await planilhaDoLote(exemplos));
}));
$('#planilhaCatalogo').addEventListener('click', () => exportarComSeguranca(async () => {
  const lista = catalogo.produtos.filter((p) => p.preco_de > p.preco);
  const itens = (lista.length ? lista : catalogo.produtos).map((p) => ({
    codigo: p.sku || '', descricao: p.nome, unidade: p.unidade || '', de: p.preco_de > p.preco ? p.preco_de : '', por: p.preco, validade: '', copias: 1,
  }));
  if (!lista.length) toast('Nenhum produto em oferta: a planilha saiu com todos os produtos.');
  await saveFile('cartazes-catalogo.xlsx', await planilhaDoLote(itens));
}));
async function importarPlanilha(arquivo) {
  if (!arquivo) return;
  setStatus('Lendo a planilha…');
  try {
    const { itens, ignoradas } = await lerPlanilha(arquivo);
    if (!itens.length) { toast('A planilha não tem nenhum produto preenchido.'); return; }
    state.loteItens = itens.map((it) => ({
      codigo: txt(it.codigo), descricao: txt(it.descricao), unidade: txt(it.unidade),
      de: precoTxt(it.de), por: precoTxt(it.por), validade: txt(it.validade), copias: txt(it.copias) || 1,
    }));
    renderLote(); save(); setTab('lote');
    toast(`${itens.length} produto(s) importado(s)${ignoradas ? ` · ${ignoradas} linha(s) sem descrição ignorada(s)` : ''}`);
  } catch (err) {
    toast(err.message || 'Não foi possível ler a planilha.');
  } finally { setStatus(''); }
}
$('#planilhaImportar').addEventListener('click', () => $('#planilhaArquivo').click());
$('#planilhaArquivo').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; importarPlanilha(f); });
const areaLote = $('#tab-lote');
['dragenter', 'dragover'].forEach((ev) => areaLote.addEventListener(ev, (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); areaLote.classList.add('arrastando'); } }));
['dragleave', 'drop'].forEach((ev) => areaLote.addEventListener(ev, () => areaLote.classList.remove('arrastando')));
areaLote.addEventListener('drop', (e) => { e.preventDefault(); importarPlanilha(e.dataTransfer.files[0]); });
let limparArmado = null;
$('#loteLimpar').addEventListener('click', (e) => {
  if (!limparArmado) { e.target.textContent = 'Confirmar'; limparArmado = setTimeout(() => { e.target.textContent = 'Limpar lista'; limparArmado = null; }, 3500); return; }
  clearTimeout(limparArmado); limparArmado = null; e.target.textContent = 'Limpar lista';
  state.loteItens = []; renderLote(); save();
});

// Itens sem valor atual ficam de fora (com aviso), para não travar o lote inteiro
const loteDatas = () => {
  const todos = state.loteItens.map(dadosDoItem), ok = todos.filter((d) => isFinite(d.porN));
  if (ok.length < todos.length) toast(`${todos.length - ok.length} item(ns) sem valor atual ficaram de fora.`);
  return ok;
};
const loteVazio = () => { toast('Importe uma planilha ou monte a lista pelo catálogo primeiro.'); };
$('#lotePdf').addEventListener('click', () => { const d = loteDatas(); if (!d.length) return loteVazio(); exportarComSeguranca(() => exportPdf(d, 'cartazes-lote.pdf')); });
$('#lotePrint').addEventListener('click', () => { const d = loteDatas(); if (!d.length) return loteVazio(); exportarComSeguranca(() => printSheets(d)); });
$('#loteZip').addEventListener('click', () => exportarComSeguranca(async () => {
  const ds = loteDatas(); if (!ds.length) return loteVazio(); if (!checkReady(ds)) return;
  if (!window.JSZip) return toast('A biblioteca de ZIP não carregou. Recarregue a página.');
  const zip = new window.JSZip(), { w, h } = state.size;
  for (let i = 0; i < ds.length; i++) {
    setStatus(`Gerando imagem ${i + 1} de ${ds.length}…`); await tick();
    const c = canvasFor(w, h, state.out.dpi, (ctx, k) => renderPoster(ctx, cur(), ds[i], w * k, h * k));
    const blob = await toBlob(c, 'image/png');
    if (!blob) throw Object.assign(new Error('bloqueado'), { name: 'SecurityError' });
    zip.file(`${String(i + 1).padStart(2, '0')}-${slug(ds[i].tokens.descricao)}.png`, blob);
  }
  setStatus('Compactando…'); const blob = await zip.generateAsync({ type: 'blob' }); setStatus('');
  await saveFile('cartazes-lote.zip', blob);
}));

/* ---------- Loja ---------- */
$('#lojaNome').addEventListener('input', (e) => { state.loja.nome = e.target.value; scheduleRender(); agendarMiniaturas(); save(); });
$('#lojaContato').addEventListener('input', (e) => { state.loja.contato = e.target.value; scheduleRender(); agendarMiniaturas(); save(); });
$('#logoBtn').addEventListener('click', () => $('#logoFile').click());
$('#logoFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { state.loja.logo = await readImage(f, 700, 'image/png'); scheduleRender(); agendarMiniaturas(); save(); toast('Logo atualizada'); } catch (err) { toast(err.message); }
});
$('#logoDel').addEventListener('click', () => { state.loja.logo = ''; scheduleRender(); agendarMiniaturas(); save(); toast('Usando a logo da ROMANO'); });

/* ---------- Aviso ---------- */
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }

/* ---------- Início ---------- */
load();
preencherFormulario();
$('#lojaNome').value = state.loja.nome; $('#lojaContato').value = state.loja.contato;
refreshTplSelects(); fillSizePanel(); updateChips();
renderLote();
new ResizeObserver(() => scheduleRender()).observe(stage);
render();
// Pré-carrega mascotes e logo para as miniaturas aparecerem completas
[...MASCOTES.map((m) => m.src), LOGO_PADRAO].forEach(getImg);
const loads = []; FONTS.forEach((f) => WEIGHTS.forEach((w) => loads.push(document.fonts.load(fontStr(f, w, 40)).catch(() => {}))));
Promise.all(loads).then(() => { render(); desenharMiniaturas(); updateSheetInfo(); });
if (document.fonts) document.fonts.ready.then(() => { render(); desenharMiniaturas(); });

// Avisa o /adm que está pronto para receber os produtos
if (EMBUTIDO) window.parent.postMessage({ tipo: 'romano-cartaz:pronto' }, location.origin);
