/*
 * Planilha do lote de cartazes: gera um .xlsx modelo e lê .xlsx / .csv.
 * Feito sobre o JSZip (já carregado pela página), sem biblioteca de planilha:
 * um .xlsx é um .zip de arquivos XML.
 */

/* Colunas da planilha, na ordem em que aparecem */
export const COLUNAS = [
  { campo: 'codigo', titulo: 'Código', largura: 12, exemplo: '100101' },
  { campo: 'descricao', titulo: 'Descrição', largura: 46, exemplo: 'Cimento CP II-E-32 50 kg' },
  { campo: 'unidade', titulo: 'Unidade', largura: 14, exemplo: 'saco 50 kg' },
  { campo: 'de', titulo: 'Valor antigo (De)', largura: 17, numero: true, exemplo: 44.9 },
  { campo: 'por', titulo: 'Valor atual (Por)', largura: 17, numero: true, exemplo: 39.9 },
  { campo: 'validade', titulo: 'Validade', largura: 40, exemplo: 'Válido até 30/11 ou enquanto durarem os estoques' },
  { campo: 'copias', titulo: 'Cópias', largura: 9, numero: true, inteiro: true, exemplo: 1 },
];

/* Nomes aceitos no cabeçalho ao importar (sem acento, minúsculo) */
const APELIDOS = {
  codigo: ['codigo', 'cod', 'sku', 'referencia', 'ref'],
  descricao: ['descricao', 'produto', 'nome', 'item', 'descricao do produto'],
  unidade: ['unidade', 'un', 'und', 'complemento', 'embalagem'],
  de: ['valor antigo (de)', 'valor antigo', 'de', 'preco de', 'preco antigo', 'preco_de', 'antes'],
  por: ['valor atual (por)', 'valor atual', 'por', 'preco', 'preco por', 'preco atual', 'valor', 'oferta'],
  validade: ['validade', 'rodape', 'observacao', 'obs'],
  copias: ['copias', 'quantidade', 'qtd', 'qtde'],
};
const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function campoDoTitulo(t) {
  const n = normal(t);
  for (const [campo, nomes] of Object.entries(APELIDOS)) if (nomes.includes(n)) return campo;
  return null;
}

/* ---------- Gerar .xlsx ---------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const letra = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** abas: [{ nome, colunas: [{titulo, largura}], linhas: [[valor...]], estilos?: [idx do estilo por coluna], cabecalho?: bool }] */
function folhaXml(aba) {
  const cols = aba.colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 14}" customWidth="1"/>`).join('');
  const linhas = [];
  const todas = aba.cabecalho === false ? aba.linhas : [aba.colunas.map((c) => c.titulo), ...aba.linhas];
  todas.forEach((linha, r) => {
    const cab = aba.cabecalho !== false && r === 0;
    const cells = linha.map((v, c) => {
      const ref = `${letra(c)}${r + 1}`;
      if (v === '' || v == null) return cab ? '' : `<c r="${ref}" s="${aba.estilos?.[c] ?? 0}"/>`;
      if (cab) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${esc(v)}</t></is></c>`;
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${aba.estilos?.[c] ?? 0}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr" s="${aba.estilos?.[c] ?? 0}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    linhas.push(`<row r="${r + 1}">${cells}</row>`);
  });
  const congelar = aba.cabecalho === false ? '' : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${congelar}<cols>${cols}</cols><sheetData>${linhas.join('')}</sheetData></worksheet>`;
}

// Estilos: 0 normal · 1 cabeçalho (negrito, fundo amarelo) · 2 dinheiro 0,00 · 3 inteiro · 4 texto em negrito
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF12213F"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5B623"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export async function criarXlsx(abas) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('A biblioteca de ZIP não carregou. Recarregue a página.');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${esc(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', ESTILOS);
  abas.forEach((a, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, folhaXml(a)));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Planilha modelo do lote. itens: [{codigo, descricao, unidade, de, por, validade, copias}] (números em de/por/copias). */
export function planilhaDoLote(itens) {
  const estilos = COLUNAS.map((c) => (c.inteiro ? 3 : c.numero ? 2 : 0));
  const linhas = itens.map((it) => COLUNAS.map((c) => it[c.campo] ?? ''));
  const instrucoes = [
    ['Como preencher a planilha de cartazes'],
    [''],
    ['• Uma linha por cartaz. Não mude os nomes das colunas da primeira linha.'],
    ['• Obrigatórios: Descrição e Valor atual (Por).'],
    ['• Valor antigo (De): preencha só quando houver promoção. Deve ser maior que o Valor atual.'],
    ['• Validade: texto do rodapé. Em branco, usa o texto da aba Oferta do gerador.'],
    ['• Cópias: quantas placas iguais imprimir (em branco = 1).'],
    ['• Valores podem ser digitados como 39,90 ou 39.90.'],
    [''],
    ['Depois de salvar, volte ao gerador, aba Lote, e clique em “Importar planilha”.'],
  ];
  return criarXlsx([
    { nome: 'Cartazes', colunas: COLUNAS, linhas, estilos },
    { nome: 'Como preencher', colunas: [{ titulo: '', largura: 95 }], linhas: instrucoes, cabecalho: false, estilos: [0] },
  ]);
}

/* ---------- Ler .xlsx / .csv ---------- */
function xml(texto) { return new DOMParser().parseFromString(texto, 'application/xml'); }
const filhos = (el, nome) => Array.from(el.getElementsByTagName(nome));
function colunaDaRef(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

async function linhasDoXlsx(arquivo) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error('A biblioteca de ZIP não carregou. Recarregue a página.');
  let zip;
  try { zip = await JSZip.loadAsync(arquivo); } catch { throw new Error('Esse arquivo não é uma planilha .xlsx válida.'); }
  const ler = async (caminho) => { const f = zip.file(caminho); return f ? f.async('string') : null; };
  const wb = await ler('xl/workbook.xml');
  if (!wb) throw new Error('Não encontrei as abas da planilha. Salve como “Pasta de Trabalho do Excel (.xlsx)”.');
  // Primeira aba do arquivo
  const primeira = filhos(xml(wb), 'sheet')[0];
  const rid = primeira?.getAttribute('r:id') || primeira?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  let caminho = 'xl/worksheets/sheet1.xml';
  const rels = await ler('xl/_rels/workbook.xml.rels');
  if (rels && rid) {
    const rel = filhos(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    const alvo = rel?.getAttribute('Target');
    if (alvo) caminho = alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo.replace(/^\.\//, '');
  }
  const folha = await ler(caminho);
  if (!folha) throw new Error('Não consegui ler a primeira aba da planilha.');
  const compartilhadas = [];
  const ss = await ler('xl/sharedStrings.xml');
  if (ss) filhos(xml(ss), 'si').forEach((si) => compartilhadas.push(filhos(si, 't').map((t) => t.textContent).join('')));
  const linhas = [];
  for (const row of filhos(xml(folha), 'row')) {
    const r = Number(row.getAttribute('r')) - 1;
    const linha = [];
    for (const c of filhos(row, 'c')) {
      const i = colunaDaRef(c.getAttribute('r')); if (i < 0) continue;
      const t = c.getAttribute('t'); const v = filhos(c, 'v')[0]?.textContent ?? '';
      let valor;
      if (t === 's') valor = compartilhadas[Number(v)] ?? '';
      else if (t === 'inlineStr') valor = filhos(c, 't').map((x) => x.textContent).join('');
      else if (t === 'str' || t === 'b' || t === 'e') valor = v;
      else valor = v === '' ? '' : Number(v);
      linha[i] = valor;
    }
    linhas[r >= 0 ? r : linhas.length] = linha;
  }
  return linhas.filter(Boolean);
}

function linhasDoCsv(texto) {
  const primeira = texto.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : (primeira.includes('\t') ? '\t' : ',');
  const linhas = []; let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) { if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch; continue; }
    if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); }
  return linhas;
}

/**
 * Lê a planilha e devolve { itens, ignoradas } — itens com os campos do lote.
 * A primeira linha precisa ter os títulos das colunas.
 */
export async function lerPlanilha(arquivo) {
  const nome = (arquivo.name || '').toLowerCase();
  let linhas;
  if (nome.endsWith('.csv') || arquivo.type === 'text/csv') {
    let texto = await arquivo.text();
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(await arquivo.arrayBuffer()); // CSV salvo pelo Excel em ANSI
    linhas = linhasDoCsv(texto.replace(/^﻿/, ''));
  } else if (nome.endsWith('.xls')) {
    throw new Error('Formato .xls antigo não é aceito. No Excel, use “Salvar como” → “Pasta de Trabalho do Excel (.xlsx)”.');
  } else {
    linhas = await linhasDoXlsx(arquivo);
  }
  // Acha a linha de cabeçalho (a primeira que tenha Descrição e Valor atual)
  let cab = -1, mapa = [];
  for (let r = 0; r < Math.min(linhas.length, 10); r++) {
    const m = (linhas[r] || []).map(campoDoTitulo);
    if (m.includes('descricao') && m.includes('por')) { cab = r; mapa = m; break; }
  }
  if (cab < 0) throw new Error('Não encontrei as colunas “Descrição” e “Valor atual (Por)”. Use a planilha modelo.');
  const itens = []; let ignoradas = 0;
  for (let r = cab + 1; r < linhas.length; r++) {
    const linha = linhas[r] || [];
    const it = {};
    mapa.forEach((campo, i) => { if (campo) it[campo] = linha[i] ?? ''; });
    const vazio = Object.values(it).every((v) => String(v ?? '').trim() === '');
    if (vazio) continue;
    if (!String(it.descricao ?? '').trim()) { ignoradas++; continue; }
    itens.push(it);
  }
  return { itens, ignoradas };
}
