import { useMemo, useState } from 'react';
import type { Produto, Rascunho } from '../../lib/types';
import type { Alterar } from '../Editor';
import { Icon } from '../../lib/icons';
import { novoId, norm } from '../../lib/format';
import { BotaoConfirmar, Campo, CampoDinheiro, Marcar, SeletorImagem } from '../ui';

interface Props { rascunho: Rascunho; alterar: Alterar }

export default function AbaProdutos({ rascunho, alterar }: Props) {
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState('todos');
  const [editando, setEditando] = useState<string | null>(null);

  const catPorId = useMemo(() => new Map(rascunho.categorias.map((c) => [c.id, c])), [rascunho.categorias]);
  const skusRepetidos = useMemo(() => {
    const cont = new Map<string, number>();
    rascunho.produtos.forEach((p) => cont.set(p.sku.trim(), (cont.get(p.sku.trim()) ?? 0) + 1));
    return new Set([...cont].filter(([, n]) => n > 1).map(([s]) => s));
  }, [rascunho.produtos]);

  const mudar = (id: string, campos: Partial<Produto>) =>
    alterar((d) => { const p = d.produtos.find((x) => x.id === id); if (p) Object.assign(p, campos); });

  const novo = () => {
    const maior = rascunho.produtos.reduce((m, p) => Math.max(m, Number.parseInt(p.sku, 10) || 0), 0);
    const p: Produto = {
      id: novoId(), sku: String(maior ? maior + 1 : 100001), nome: 'Novo produto',
      categoria_id: filtroCat !== 'todos' ? filtroCat : rascunho.categorias[0]?.id ?? null,
      marca: '', unidade: 'un', preco: 0, preco_de: 0, parcelas: 1, destaque: false, ativo: false, foto_url: null, descricao: '',
    };
    alterar((d) => { d.produtos.unshift(p); });
    setEditando(p.id);
  };

  const remover = (id: string) => {
    alterar((d) => { d.produtos = d.produtos.filter((p) => p.id !== id); });
    setEditando(null);
  };

  const p = editando ? rascunho.produtos.find((x) => x.id === editando) : undefined;
  if (p) return <FormProduto p={p} rascunho={rascunho} repetido={skusRepetidos.has(p.sku.trim())} mudar={(c) => mudar(p.id, c)} onVoltar={() => setEditando(null)} onRemover={() => remover(p.id)} />;

  const q = norm(busca);
  const lista = rascunho.produtos.filter((x) =>
    (filtroCat === 'todos' || x.categoria_id === filtroCat) && (!q || norm(`${x.nome} ${x.sku} ${x.marca}`).includes(q)));
  const visiveis = rascunho.produtos.filter((x) => x.ativo).length;

  return (
    <section className="aba">
      <div className="aba-head">
        <div>
          <h1>Produtos</h1>
          <p className="hint">{rascunho.produtos.length} cadastrados · {visiveis} visíveis no site. Altere os preços direto na lista; deixe “De” vazio quando não houver promoção.</p>
        </div>
        <button className="btn sun" onClick={novo}><Icon name="plus" /> Novo produto</button>
      </div>

      <div className="ferramentas">
        <input className="input" type="search" placeholder="Buscar por nome, código ou marca" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        <select className="input" value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)} aria-label="Filtrar por departamento">
          <option value="todos">Todos os departamentos</option>
          {rascunho.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {skusRepetidos.size > 0 && (
        <p className="erro-txt">Códigos repetidos: {[...skusRepetidos].join(', ')}. Corrija antes de gravar.</p>
      )}

      <div className="lista">
        {lista.length === 0 && <p className="lista-vazia">Nenhum produto encontrado.</p>}
        {lista.map((x) => {
          const c = x.categoria_id ? catPorId.get(x.categoria_id) : undefined;
          return (
            <div key={x.id} className={`prod-linha${x.ativo ? '' : ' oculto'}`}>
              <button className="prod-thumb" onClick={() => setEditando(x.id)} aria-label={`Editar ${x.nome}`}>
                {x.foto_url ? <img src={x.foto_url} alt="" /> : <Icon name={c?.icone ?? 'tag'} />}
              </button>
              <div className="prod-meta">
                <button className="prod-nome" onClick={() => setEditando(x.id)}>{x.nome}</button>
                <span className={skusRepetidos.has(x.sku.trim()) ? 'erro-txt' : ''}>Cód. {x.sku} · {c?.nome ?? 'Sem departamento'}{x.destaque ? ' · Destaque' : ''}</span>
              </div>
              <div className="prod-ctl">
                <label className="mini">Por<CampoDinheiro valor={x.preco} onValor={(v) => mudar(x.id, { preco: v })} rotuloAria={`Preço de ${x.nome}`} /></label>
                <label className="mini">De<CampoDinheiro valor={x.preco_de} vazioPermitido onValor={(v) => mudar(x.id, { preco_de: v })} rotuloAria={`Preço anterior de ${x.nome}`} /></label>
                <label className="sw"><input type="checkbox" checked={x.ativo} onChange={(e) => mudar(x.id, { ativo: e.target.checked })} />Visível</label>
                <span className="prod-acoes">
                  <button className="btn icon ghost" onClick={() => setEditando(x.id)} aria-label={`Editar ${x.nome}`}><Icon name="edit" /></button>
                  <BotaoConfirmar className="btn icon ghost" rotuloAria={`Excluir ${x.nome}`} onConfirmar={() => remover(x.id)}><Icon name="trash" /></BotaoConfirmar>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FormProduto({ p, rascunho, repetido, mudar, onVoltar, onRemover }: {
  p: Produto; rascunho: Rascunho; repetido: boolean; mudar: (c: Partial<Produto>) => void; onVoltar: () => void; onRemover: () => void;
}) {
  const c = rascunho.categorias.find((x) => x.id === p.categoria_id);
  return (
    <section className="aba">
      <div className="aba-head">
        <button className="btn" onClick={onVoltar}><Icon name="left" /> Voltar para a lista</button>
        <BotaoConfirmar pergunta="Excluir este produto?" sim="Sim, excluir" onConfirmar={onRemover}><Icon name="trash" /> Excluir produto</BotaoConfirmar>
      </div>
      <h1>{p.nome || 'Produto sem nome'}</h1>
      {!p.ativo && <p className="hint">Este produto está oculto. Marque “Visível no site” quando ele estiver pronto.</p>}

      <div className="caixa">
        <h2>Foto</h2>
        <SeletorImagem url={p.foto_url} onUrl={(u) => mudar({ foto_url: u })} pasta="produtos" larguraMax={900} icone={c?.icone ?? 'tag'}
          dica="Fotos quadradas, com fundo claro, ficam melhores. A imagem é reduzida automaticamente." />
      </div>

      <div className="caixa">
        <h2>Dados do produto</h2>
        <div className="grade-campos">
          <Campo rotulo="Nome" full><input value={p.nome} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
          <Campo rotulo="Código (SKU)" dica={repetido ? <span className="erro-txt">Outro produto já usa este código.</span> : undefined}>
            <input value={p.sku} className={repetido ? 'bad' : ''} onChange={(e) => mudar({ sku: e.target.value })} />
          </Campo>
          <Campo rotulo="Departamento">
            <select value={p.categoria_id ?? ''} onChange={(e) => mudar({ categoria_id: e.target.value || null })}>
              <option value="">Sem departamento</option>
              {rascunho.categorias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Unidade de venda"><input value={p.unidade} placeholder="Ex.: saco 50 kg, m², un" onChange={(e) => mudar({ unidade: e.target.value })} /></Campo>
          <Campo rotulo="Marca"><input value={p.marca} onChange={(e) => mudar({ marca: e.target.value })} /></Campo>
          <Campo rotulo="Descrição" full><textarea rows={3} value={p.descricao} onChange={(e) => mudar({ descricao: e.target.value })} /></Campo>
        </div>
      </div>

      <div className="caixa">
        <h2>Preço e exibição</h2>
        <div className="grade-campos">
          <Campo rotulo="Preço atual (R$)"><CampoDinheiro valor={p.preco} onValor={(v) => mudar({ preco: v })} /></Campo>
          <Campo rotulo="Preço “de” (R$)" dica="Vazio = sem promoção. Precisa ser maior que o preço atual para mostrar o desconto.">
            <CampoDinheiro valor={p.preco_de} vazioPermitido onValor={(v) => mudar({ preco_de: v })} />
          </Campo>
          <Campo rotulo="Parcelamento" full>
            <select value={p.parcelas} onChange={(e) => mudar({ parcelas: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? 'À vista (sem parcelamento)' : `${n}x sem juros`}</option>
              ))}
            </select>
          </Campo>
        </div>
        <Marcar rotulo="Visível no site" valor={p.ativo} onValor={(v) => mudar({ ativo: v })} />
        <Marcar rotulo="Mostrar em “Mais procurados”" valor={p.destaque} onValor={(v) => mudar({ destaque: v })} />
      </div>
    </section>
  );
}
