import { useRef, useState } from 'react';
import type { Rascunho } from '../../lib/types';
import type { Alterar } from '../Editor';
import { Icon } from '../../lib/icons';
import { num, parseBRL } from '../../lib/format';
import { Aviso, copiarTexto } from '../ui';

interface Props { rascunho: Rascunho; alterar: Alterar }
type Resultado = { ok: number; naoEncontrados: string[]; invalidos: string[] };

/** Lê linhas "código;preço;preço de" ou colunas coladas do Excel (tab). Aceita também a planilha exportada (código;nome;preço;preço de). */
function interpretar(texto: string, skus: Set<string>) {
  const atualizacoes: { sku: string; preco: number; preco_de: number }[] = [];
  const naoEncontrados: string[] = [];
  const invalidos: string[] = [];
  texto.split(/\r?\n/).forEach((linha) => {
    if (!linha.trim()) return;
    const cols = linha.split(/\t|;/).map((s) => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) return;
    const sku = cols[0];
    const iPreco = cols.length >= 4 ? 2 : 1; // formato exportado tem a coluna nome
    const preco = parseBRL(cols[iPreco]);
    if (!/\d/.test(cols[iPreco] ?? '') || Number.isNaN(preco)) {
      if (!/^c[oó]d/i.test(sku)) invalidos.push(sku || '(sem código)'); // ignora o cabeçalho
      return;
    }
    if (!skus.has(sku)) return void naoEncontrados.push(sku);
    const de = cols[iPreco + 1] ? parseBRL(cols[iPreco + 1]) : 0;
    atualizacoes.push({ sku, preco, preco_de: Number.isNaN(de) ? 0 : de });
  });
  return { atualizacoes, naoEncontrados, invalidos };
}

export default function AbaPrecos({ rascunho, alterar }: Props) {
  const [texto, setTexto] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLTextAreaElement>(null);

  const planilha = ['codigo;nome;preco;preco_de',
    ...rascunho.produtos.map((p) => [p.sku, p.nome.replace(/;/g, ','), num(p.preco), p.preco_de ? num(p.preco_de) : ''].join(';'))].join('\n');

  const aplicar = (conteudo: string) => {
    const { atualizacoes, naoEncontrados, invalidos } = interpretar(conteudo, new Set(rascunho.produtos.map((p) => p.sku.trim())));
    if (atualizacoes.length) {
      const porSku = new Map(atualizacoes.map((a) => [a.sku, a]));
      alterar((d) => d.produtos.forEach((p) => {
        const a = porSku.get(p.sku.trim());
        if (a) { p.preco = a.preco; p.preco_de = a.preco_de; }
      }));
    }
    setRes({ ok: atualizacoes.length, naoEncontrados, invalidos });
  };

  const baixar = () => {
    const blob = new Blob(['﻿' + planilha], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiar = () => {
    copiarTexto(planilha).then(
      () => { setCopiado(true); window.setTimeout(() => setCopiado(false), 1500); },
      () => exportRef.current?.select(),
    );
  };

  return (
    <section className="aba">
      <div className="aba-head"><div><h1>Preços em lote</h1><p className="hint">Atualize muitos preços de uma vez a partir de uma planilha.</p></div></div>

      <div className="caixa">
        <h2>1. Baixe a tabela atual</h2>
        <p className="hint">Abra no Excel ou no Google Planilhas, altere as colunas de preço e salve como CSV (separado por ponto e vírgula).</p>
        <div className="row-act">
          <button className="btn" onClick={baixar}><Icon name="download" /> Baixar planilha (CSV)</button>
          <button className="btn" onClick={copiar}><Icon name="copy" /> {copiado ? 'Copiado' : 'Copiar tabela'}</button>
        </div>
        <textarea ref={exportRef} className="input mono" rows={5} readOnly value={planilha} aria-label="Tabela de preços atual" />
      </div>

      <div className="caixa">
        <h2>2. Envie ou cole os preços novos</h2>
        <p className="hint">
          Uma linha por produto: <code>código;preço;preço de</code>. O “preço de” é opcional. Também funciona colando colunas do Excel
          ou enviando a planilha baixada acima.
        </p>
        <textarea className="input mono" rows={8} value={texto} placeholder={'100101;39,90;44,90\n100401;289,90'} onChange={(e) => setTexto(e.target.value)} aria-label="Preços para importar" />
        <div className="row-act">
          <button className="btn primary" onClick={() => aplicar(texto)} disabled={!texto.trim()}>Aplicar preços colados</button>
          <button className="btn" onClick={() => arquivo.current?.click()}><Icon name="upload" /> Enviar arquivo CSV</button>
          <input ref={arquivo} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) aplicar(await f.text()); }} />
        </div>
        {res && (
          <Aviso tipo={res.ok && !res.naoEncontrados.length && !res.invalidos.length ? 'ok' : res.ok ? 'info' : 'erro'}>
            {res.ok} {res.ok === 1 ? 'preço atualizado' : 'preços atualizados'} no rascunho.
            {res.naoEncontrados.length > 0 && <> Códigos não encontrados: {res.naoEncontrados.slice(0, 15).join(', ')}{res.naoEncontrados.length > 15 ? '…' : ''}.</>}
            {res.invalidos.length > 0 && <> Linhas com preço inválido: {res.invalidos.slice(0, 15).join(', ')}.</>}
            {res.ok > 0 && <> Grave e publique para os clientes verem.</>}
          </Aviso>
        )}
      </div>
    </section>
  );
}
