import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Loja, Produto } from '../lib/types';
import { Icon } from '../lib/icons';
import { brl, fmtTelefone, waLink } from '../lib/format';

const CHAVE = 'catalogo-orcamento';
const MAX = 9999;

type Linha = { id: string; qtd: number };
export interface ItemOrcamento { p: Produto; qtd: number }

export const limitar = (n: number) => Math.min(MAX, Math.max(1, Math.round(n) || 1));

function ler(): Linha[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((l): l is Linha => typeof l?.id === 'string' && Number.isInteger(l?.qtd) && l.qtd > 0) : [];
  } catch {
    return [];
  }
}

/** Itens escolhidos pelo cliente. Ficam no navegador dele (exceto na pré-visualização do editor). */
export function useOrcamento(produtos: Produto[], persistir: boolean) {
  const [linhas, setLinhas] = useState<Linha[]>(() => (persistir ? ler() : []));

  useEffect(() => {
    if (!persistir) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(linhas));
    } catch {
      /* navegador sem armazenamento: o orçamento vale só enquanto a página estiver aberta */
    }
  }, [linhas, persistir]);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  // Produto que saiu do catálogo some do orçamento; o preço é sempre o publicado agora
  const itens = useMemo<ItemOrcamento[]>(
    () => linhas.flatMap((l) => { const p = porId.get(l.id); return p ? [{ p, qtd: l.qtd }] : []; }),
    [linhas, porId],
  );
  const total = useMemo(() => itens.reduce((s, i) => s + i.p.preco * i.qtd, 0), [itens]);
  const qtdDe = useCallback((id: string) => linhas.find((l) => l.id === id)?.qtd ?? 0, [linhas]);

  const adicionar = useCallback((id: string, qtd = 1) => setLinhas((ls) =>
    ls.some((l) => l.id === id)
      ? ls.map((l) => (l.id === id ? { ...l, qtd: limitar(l.qtd + qtd) } : l))
      : [...ls, { id, qtd: limitar(qtd) }]), []);
  const definir = useCallback((id: string, qtd: number) => setLinhas((ls) =>
    qtd <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qtd: limitar(qtd) } : l))), []);
  const limpar = useCallback(() => setLinhas([]), []);

  return { itens, total, qtdDe, adicionar, definir, limpar };
}

/** Seletor de quantidade. Com min 0, o "−" na quantidade 1 remove o item. */
export function Qtd({ valor, onMudar, rotulo, min = 0 }: { valor: number; onMudar: (n: number) => void; rotulo: string; min?: number }) {
  const [txt, setTxt] = useState(String(valor));
  useEffect(() => setTxt(String(valor)), [valor]);

  const confirmar = () => {
    const n = parseInt(txt, 10);
    if (Number.isFinite(n) && n >= min) onMudar(n);
    else setTxt(String(valor));
  };

  return (
    <div className="qtd">
      <button type="button" onClick={() => onMudar(valor - 1)} disabled={min > 0 && valor <= min} aria-label={valor <= 1 && min === 0 ? `Remover ${rotulo}` : `Diminuir quantidade de ${rotulo}`}>
        <Icon name={valor <= 1 && min === 0 ? 'trash' : 'minus'} />
      </button>
      <input
        inputMode="numeric" value={txt} aria-label={`Quantidade de ${rotulo}`}
        onChange={(e) => setTxt(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }}
      />
      <button type="button" onClick={() => onMudar(valor + 1)} disabled={valor >= MAX} aria-label={`Aumentar quantidade de ${rotulo}`}><Icon name="plus" /></button>
    </div>
  );
}

const dois = (n: number) => String(n).padStart(2, '0');
const numeroOrcamento = (d: Date) =>
  `ORC-${String(d.getFullYear()).slice(2)}${dois(d.getMonth() + 1)}${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}`;
const precoUnid = (p: Produto) => `${brl(p.preco)}${p.unidade ? ` / ${p.unidade}` : ''}`;

/** Duas etapas: o cliente monta a lista e gera o orçamento; só o orçamento gerado vai para o WhatsApp da loja. */
export function GavetaOrcamento({ loja, logo, itens, total, definir, limpar, onFechar }: {
  loja: Loja; logo: string; itens: ItemOrcamento[]; total: number;
  definir: (id: string, qtd: number) => void; limpar: () => void; onFechar: () => void;
}) {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const [nome, setNome] = useState('');
  const [obs, setObs] = useState('');
  const [confirmaLimpar, setConfirmaLimpar] = useState(false);
  const [gerado, setGerado] = useState<Date | null>(null);

  useEffect(() => {
    document.body.classList.add('travado');
    fecharRef.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => { document.body.classList.remove('travado'); window.removeEventListener('keydown', tecla); };
  }, [onFechar]);

  const n = itens.length;
  useEffect(() => { if (n === 0) setGerado(null); }, [n]);

  const mensagem = (numero: string, data: Date) => {
    const partes = [
      `Olá${loja.nome ? `, ${loja.nome}` : ''}! Segue meu orçamento pelo catálogo:`,
      '',
      `*Orçamento ${numero}* · ${data.toLocaleDateString('pt-BR')}`,
      '',
      ...itens.map((i, k) => `${k + 1}. ${i.p.nome} (Cód. ${i.p.sku})\n    ${i.qtd} × ${precoUnid(i.p)} = ${brl(i.p.preco * i.qtd)}`),
      '',
      `*Total: ${brl(total)}*`,
    ];
    const cliente = [nome.trim() && `Nome: ${nome.trim()}`, obs.trim() && `Observações: ${obs.trim()}`].filter(Boolean);
    if (cliente.length) partes.push('', ...cliente);
    return partes.join('\n');
  };

  const doc = gerado && (
    <DocOrcamento loja={loja} logo={logo} numero={numeroOrcamento(gerado)} data={gerado} itens={itens} total={total} nome={nome.trim()} obs={obs.trim()} />
  );

  return (
    <div className="modal gaveta" role="dialog" aria-modal="true" aria-labelledby="orc-titulo">
      <div className="modal-fundo" onClick={onFechar} />
      <div className="gaveta-caixa">
        <div className="gaveta-topo">
          <h2 id="orc-titulo">{gerado ? 'Orçamento gerado' : 'Seu orçamento'}</h2>
          <button className="modal-x" ref={fecharRef} onClick={onFechar} aria-label="Fechar"><Icon name="x" /></button>
        </div>

        {n === 0 ? (
          <div className="gaveta-vazio">
            <Icon name="cart" />
            <b>Nenhum item ainda</b>
            <span>Toque em “Adicionar” nos produtos para montar seu orçamento.</span>
            <button className="btn" onClick={onFechar}>Ver produtos</button>
          </div>
        ) : gerado ? (
          <>
            <div className="orc-gerado">
              <div className="orc-papel">{doc}</div>
            </div>

            <div className="gaveta-rodape">
              {loja.whatsapp ? (
                <>
                  <a className="btn-wa lg" href={waLink(loja.whatsapp, mensagem(numeroOrcamento(gerado), gerado))} target="_blank" rel="noopener noreferrer">
                    <Icon name="chat" /> Enviar para o WhatsApp da loja
                  </a>
                  <p className="hint">Abre o WhatsApp com o orçamento já escrito para <b>{fmtTelefone(loja.whatsapp)}</b>. É só tocar em enviar.</p>
                </>
              ) : (
                <p className="hint">A loja ainda não informou um WhatsApp. Imprima ou salve o orçamento em PDF.</p>
              )}
              <div className="orc-acoes">
                <button className="btn" onClick={() => setGerado(null)}><Icon name="left" /> Alterar itens</button>
                <button className="btn" onClick={() => window.print()}><Icon name="print" /> Imprimir ou PDF</button>
              </div>
            </div>

            {createPortal(doc, document.body)}
          </>
        ) : (
          <>
            <ul className="orc-itens">
              {itens.map(({ p, qtd }) => (
                <li key={p.id}>
                  <span className="orc-foto">{p.foto_url ? <img src={p.foto_url} alt="" /> : <Icon name="tag" />}</span>
                  <div className="orc-info">
                    <b>{p.nome}</b>
                    <span className="sku">Cód. {p.sku} · {precoUnid(p)}</span>
                    <div className="orc-linha">
                      <Qtd valor={qtd} rotulo={p.nome} onMudar={(q) => definir(p.id, q)} />
                      <strong>{brl(p.preco * qtd)}</strong>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="gaveta-rodape">
              <div className="orc-total"><span>Total · {n} {n === 1 ? 'item' : 'itens'}</span><strong>{brl(total)}</strong></div>
              <label className="fld">Seu nome (opcional)<input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></label>
              <label className="fld">Observações (opcional)<textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: bairro para entrega, prazo, dúvidas" /></label>
              <button className="btn-wa lg" onClick={() => setGerado(new Date())}><Icon name="check" /> Gerar orçamento</button>
              <div className="orc-acoes">
                <button
                  className="btn ghost danger"
                  onClick={() => { if (confirmaLimpar) { limpar(); setConfirmaLimpar(false); } else setConfirmaLimpar(true); }}
                  onBlur={() => setConfirmaLimpar(false)}
                >
                  <Icon name="trash" /> {confirmaLimpar ? 'Confirmar limpeza' : 'Limpar itens'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** O orçamento em si: aparece na gaveta depois de gerado e é o que vai para o papel / PDF. */
function DocOrcamento({ loja, logo, numero, data, itens, total, nome, obs }: {
  loja: Loja; logo: string; numero: string; data: Date; itens: ItemOrcamento[]; total: number; nome: string; obs: string;
}) {
  const contatos = [loja.whatsapp && `WhatsApp ${fmtTelefone(loja.whatsapp)}`, loja.telefone].filter(Boolean).join(' · ');
  return (
    <div className="orc-doc">
      <header>
        <img src={logo} alt="" />
        <div className="orc-doc-loja">
          <b>{loja.nome}</b>
          {loja.endereco && <span>{loja.endereco}</span>}
          {contatos && <span>{contatos}</span>}
        </div>
        <div className="orc-doc-n">
          <b>Orçamento</b>
          <span>{numero}</span>
          <span>{data.toLocaleDateString('pt-BR')}</span>
        </div>
      </header>
      {nome && <p>Cliente: <b>{nome}</b></p>}
      <table>
        <thead>
          <tr><th className="c-cod">Cód.</th><th>Produto</th><th className="n">Qtd.</th><th className="n c-preco">Preço</th><th className="n">Total</th></tr>
        </thead>
        <tbody>
          {itens.map(({ p, qtd }) => (
            <tr key={p.id}>
              <td className="c-cod">{p.sku}</td>
              <td>{p.nome}{p.marca ? ` · ${p.marca}` : ''}<small className="so-tela">Cód. {p.sku} · {precoUnid(p)}</small></td>
              <td className="n">{qtd}</td>
              <td className="n c-preco">{precoUnid(p)}</td>
              <td className="n">{brl(p.preco * qtd)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td className="c-cod" /><td colSpan={2}>Total</td><td className="c-preco" /><td className="n">{brl(total)}</td></tr>
        </tfoot>
      </table>
      {obs && <p>Observações: {obs}</p>}
      {loja.aviso && <p className="orc-doc-aviso">{loja.aviso}</p>}
    </div>
  );
}
