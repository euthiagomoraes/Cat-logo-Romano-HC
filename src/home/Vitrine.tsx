import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Banner, Catalogo, Categoria, Produto } from '../lib/types';
import { Icon } from '../lib/icons';
import { brl, desconto, fmtTelefone, norm, num, waLink } from '../lib/format';
import { GavetaOrcamento, Qtd, limitar, useOrcamento } from './Orcamento';
import MascoteRHC from '../mascote/MascoteRHC';

const LOGO_PADRAO = '/logo.jpg';
type Ordem = 'relevancia' | 'menor' | 'maior' | 'desconto' | 'az';

interface Props {
  dados: Catalogo;
  /** Mostra a faixa de pré-visualização (usado dentro do editor). */
  previa?: boolean;
}

export default function Vitrine({ dados, previa }: Props) {
  const { loja } = dados;
  const produtos = useMemo(() => dados.produtos.filter((p) => p.ativo), [dados.produtos]);
  const banners = useMemo(() => dados.banners.filter((b) => b.ativo), [dados.banners]);
  const catPorId = useMemo(() => new Map(dados.categorias.map((c) => [c.id, c])), [dados.categorias]);

  const [cat, setCat] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('relevancia');
  const [aberto, setAberto] = useState<Produto | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const [aviso, setAviso] = useState('');
  const avisoT = useRef(0);
  const raizRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const orc = useOrcamento(produtos, !previa);

  const adicionar = useCallback((p: Produto, qtd = 1) => {
    orc.adicionar(p.id, qtd);
    setAviso(`${p.nome} adicionado ao orçamento`);
    window.clearTimeout(avisoT.current);
    avisoT.current = window.setTimeout(() => setAviso(''), 3500);
  }, [orc.adicionar]);
  useEffect(() => () => window.clearTimeout(avisoT.current), []);

  const abrirGaveta = () => { setAberto(null); setAviso(''); setGaveta(true); };

  const logo = loja.logo_url || LOGO_PADRAO;
  const wa = useCallback((texto: string) => waLink(loja.whatsapp, texto), [loja.whatsapp]);
  const waProduto = useCallback(
    (p: Produto) => wa(`Olá! Vi no catálogo e quero saber mais sobre: ${p.nome} (Cód. ${p.sku}) - ${brl(p.preco)}${p.unidade ? ` / ${p.unidade}` : ''}`),
    [wa],
  );

  const irPara = useCallback((id: string) => {
    const el = raizRef.current?.querySelector<HTMLElement>(`[data-secao="${id}"]`);
    if (!el) return;
    const fixo = headerRef.current && getComputedStyle(headerRef.current).position === 'sticky' ? headerRef.current.offsetHeight : 0;
    const y = el.getBoundingClientRect().top + window.scrollY - fixo - 12;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: y, behavior: suave ? 'smooth' : 'auto' });
  }, []);

  const escolherCat = (id: string, rolar = true) => {
    setCat(id);
    if (rolar) requestAnimationFrame(() => irPara('catalogo'));
  };

  const ofertas = useMemo(() => produtos.filter((p) => desconto(p) > 0).sort((a, b) => desconto(b) - desconto(a)), [produtos]);
  const destaques = useMemo(() => produtos.filter((p) => p.destaque), [produtos]);

  const lista = useMemo(() => {
    const q = norm(busca);
    const pos = new Map(produtos.map((p, i) => [p.id, i]));
    const filtrados = produtos.filter((p) => {
      if (cat !== 'todos' && p.categoria_id !== cat) return false;
      if (!q) return true;
      const c = p.categoria_id ? catPorId.get(p.categoria_id) : undefined;
      return norm([p.nome, p.sku, p.marca, p.descricao, c?.nome ?? ''].join(' ')).includes(q);
    });
    const ordenar: Record<Ordem, (a: Produto, b: Produto) => number> = {
      relevancia: (a, b) => Number(b.destaque) - Number(a.destaque) || pos.get(a.id)! - pos.get(b.id)!,
      menor: (a, b) => a.preco - b.preco,
      maior: (a, b) => b.preco - a.preco,
      desconto: (a, b) => desconto(b) - desconto(a),
      az: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
    };
    return filtrados.sort(ordenar[ordem]);
  }, [produtos, cat, busca, ordem, catPorId]);

  const clicarBanner = (b: Banner) => {
    if (b.link.startsWith('cat:')) escolherCat(b.link.slice(4));
    else {
      if (b.link === '#catalogo') setCat('todos');
      irPara(b.link.replace('#', ''));
    }
  };

  const enviarBusca = (e: FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    irPara('catalogo');
  };

  const catAtual = catPorId.get(cat);
  const card = (p: Produto) => (
    <CardProduto
      key={p.id} p={p} categoria={p.categoria_id ? catPorId.get(p.categoria_id) : undefined} onAbrir={setAberto}
      qtd={orc.qtdDe(p.id)} onAdicionar={() => adicionar(p)} onMudar={(n) => orc.definir(p.id, n)}
    />
  );
  const nItens = orc.itens.length;

  return (
    <div className={`vitrine${previa ? ' previa' : ''}`} ref={raizRef}>
      {previa && (
        <div className="faixa-previa"><div className="wrap"><Icon name="eye" /> Pré-visualização do rascunho. Os clientes só veem estas alterações depois que você publicar.</div></div>
      )}
      {loja.mostrar_aviso_demo && (
        <div className="faixa-demo"><div className="wrap">Catálogo de demonstração: produtos, preços e contatos são exemplos.</div></div>
      )}
      <div className="topbar">
        <div className="wrap topbar-in">
          {loja.horario && <span><Icon name="clock" />{loja.horario}</span>}
          {loja.endereco && <span className="so-largo"><Icon name="pin" />{loja.endereco}</span>}
        </div>
      </div>

      <header className="hdr" ref={headerRef}>
        <div className="wrap hdr-in">
          <a className="marca" href="#topo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <img src={logo} alt={`Logo ${loja.nome}`} />
            <span><b>{loja.nome}</b><small>{loja.slogan}</small></span>
          </a>
          <form className="busca" role="search" onSubmit={enviarBusca}>
            <label className="sr" htmlFor="busca">Buscar produtos</label>
            <input id="busca" type="search" placeholder="O que você precisa para a sua obra?" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
            <button type="submit" aria-label="Buscar"><Icon name="search" /></button>
          </form>
          <div className="hdr-acoes">
            {loja.whatsapp && (
              <a className="hdr-wa" href={wa('Olá! Vim pelo catálogo digital.')} target="_blank" rel="noopener noreferrer" aria-label="Fale conosco no WhatsApp">
                <Icon name="chat" /><span>Fale conosco<b>{fmtTelefone(loja.whatsapp)}</b></span>
              </a>
            )}
            <button className="hdr-orc" onClick={abrirGaveta} aria-label={`Ver orçamento: ${nItens} ${nItens === 1 ? 'item' : 'itens'}`}>
              <Icon name="cart" /><span className="rot">Orçamento</span><span className="cont">{nItens}</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="deptos" aria-label="Departamentos">
        <div className="wrap deptos-in">
          <button className={cat === 'todos' ? 'on' : ''} onClick={() => escolherCat('todos')}>Todos os produtos</button>
          {dados.categorias.map((c) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => escolherCat(c.id)}>{c.nome}</button>
          ))}
        </div>
      </nav>

      <main>
        {banners.length > 0 && <Carrossel banners={banners} linkWa={(b) => wa(`Olá! Vi o banner "${b.titulo}" no catálogo.`)} onClicar={clicarBanner} />}

        {dados.categorias.length > 0 && (
          <section className="wrap sec">
            <div className="sec-head"><h2>Departamentos</h2></div>
            <div className="cats">
              {dados.categorias.map((c) => {
                const n = produtos.filter((p) => p.categoria_id === c.id).length;
                return (
                  <button key={c.id} className="cat" onClick={() => escolherCat(c.id)}>
                    <span className="cat-ico"><Icon name={c.icone} /></span>
                    <span>{c.nome}</span>
                    <small>{n} {n === 1 ? 'item' : 'itens'}</small>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <Prateleira id="ofertas" titulo="Ofertas da semana" sub="Preços especiais enquanto durarem os estoques" faixa produtos={ofertas} render={card} />
        <Prateleira id="destaques" titulo="Mais procurados" sub="Os itens que mais saem para obra e reforma" produtos={destaques} render={card} />

        <section className="wrap sec" data-secao="catalogo">
          <div className="sec-head">
            <div>
              <h2>Catálogo completo</h2>
              <p>
                {lista.length} {lista.length === 1 ? 'produto' : 'produtos'}
                {catAtual ? ` em ${catAtual.nome}` : ''}
                {busca && <> para “{busca}” <button className="limpar" onClick={() => setBusca('')}>limpar busca</button></>}
              </p>
            </div>
          </div>
          <div className="barra-cat">
            <div className="chips">
              <button className={`chip${cat === 'todos' ? ' on' : ''}`} onClick={() => escolherCat('todos', false)}>Todos</button>
              {dados.categorias.map((c) => (
                <button key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => escolherCat(c.id, false)}>{c.nome}</button>
              ))}
            </div>
            <label className="ordem" htmlFor="ordem">
              <span>Ordenar por</span>
              <select id="ordem" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                <option value="relevancia">Destaques</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
                <option value="desconto">Maior desconto</option>
                <option value="az">Nome (A–Z)</option>
              </select>
            </label>
          </div>
          {lista.length ? (
            <div className="grade">{lista.map(card)}</div>
          ) : (
            <div className="vazio">
              <b>Nenhum produto encontrado</b>
              Tente outra palavra{loja.whatsapp ? <> ou fale com a gente no WhatsApp: <span className="sel">{fmtTelefone(loja.whatsapp)}</span></> : '.'}
            </div>
          )}
        </section>

        {dados.servicos.length > 0 && (
          <section className="faixa">
            <div className="wrap servicos">
              {dados.servicos.map((s) => (
                <div className="svc" key={s.id}>
                  <Icon name={s.icone} />
                  <div><b>{s.titulo}</b><span>{s.texto}</span></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="ftr">
        <div className="wrap ftr-in">
          <div>
            <div className="marca"><img src={logo} alt="" /><span><b>{loja.nome}</b><small>{loja.slogan}</small></span></div>
          </div>
          <div>
            <h4>Departamentos</h4>
            <ul>{dados.categorias.map((c) => <li key={c.id}><button onClick={() => escolherCat(c.id)}>{c.nome}</button></li>)}</ul>
          </div>
          <div>
            <h4>Atendimento</h4>
            <ul>
              {loja.whatsapp && <li><Icon name="chat" /><span>WhatsApp <span className="sel">{fmtTelefone(loja.whatsapp)}</span></span></li>}
              {loja.telefone && <li><Icon name="phone" /><span className="sel">{loja.telefone}</span></li>}
              {loja.endereco && <li><Icon name="pin" /><span>{loja.endereco}</span></li>}
              {loja.horario && <li><Icon name="clock" /><span>{loja.horario}</span></li>}
            </ul>
          </div>
        </div>
        <div className="wrap ftr-nota"><span>{loja.aviso}</span><span>© {new Date().getFullYear()} {loja.nome}</span></div>
      </footer>

      {aberto && (
        <ModalProduto
          p={aberto}
          categoria={aberto.categoria_id ? catPorId.get(aberto.categoria_id) : undefined}
          linkWa={waProduto(aberto)}
          whatsapp={loja.whatsapp}
          noOrcamento={orc.qtdDe(aberto.id)}
          onAdicionar={(qtd) => { adicionar(aberto, qtd); setAberto(null); }}
          onVerOrcamento={abrirGaveta}
          onFechar={() => setAberto(null)}
        />
      )}

      {gaveta && (
        <GavetaOrcamento
          loja={loja} logo={logo} itens={orc.itens} total={orc.total}
          definir={orc.definir} limpar={orc.limpar} onFechar={() => setGaveta(false)}
        />
      )}

      {!previa && (
        <MascoteRHC
          mensagem={`Bem-vindo ao catálogo ${loja.nome}! Confira as ofertas da semana.`}
          onLink={ofertas.length ? () => irPara('ofertas') : undefined}
        />
      )}

      <div className="toast" role="status">
        {aviso && <div><Icon name="check" /><span>{aviso}</span><button onClick={abrirGaveta}>Ver orçamento</button></div>}
      </div>
    </div>
  );
}

/* ---------- partes ---------- */

function Midia({ p, categoria }: { p: Produto; categoria?: Categoria }) {
  if (p.foto_url) return <img src={p.foto_url} alt={p.nome} loading="lazy" />;
  return <span className="ph"><Icon name={categoria?.icone ?? 'tag'} /></span>;
}

function Preco({ p }: { p: Produto }) {
  return (
    <div className="preco">
      <s>{p.preco_de > p.preco ? `de ${brl(p.preco_de)}` : ''}</s>
      <strong><small>R$</small>{num(p.preco)}</strong>
      <span className="parc">{p.parcelas > 1 ? `ou ${p.parcelas}x de ${brl(p.preco / p.parcelas)} sem juros` : 'preço à vista'}</span>
    </div>
  );
}

function CardProduto({ p, categoria, onAbrir, qtd, onAdicionar, onMudar }: {
  p: Produto; categoria?: Categoria; onAbrir: (p: Produto) => void; qtd: number; onAdicionar: () => void; onMudar: (n: number) => void;
}) {
  const d = desconto(p);
  return (
    <article className="card">
      <button className="card-media" onClick={() => onAbrir(p)} aria-label={`Ver detalhes de ${p.nome}`}>
        <Midia p={p} categoria={categoria} />
        {d > 0 && <span className="badge-off">-{d}%</span>}
        {p.destaque && <span className="badge-hot">Destaque</span>}
      </button>
      <div className="card-body">
        <span className="sku">Cód. {p.sku}</span>
        <h3><button onClick={() => onAbrir(p)}>{p.nome}</button></h3>
        <span className="unid">{p.unidade}{p.marca ? ` · ${p.marca}` : ''}</span>
        <Preco p={p} />
        {qtd > 0
          ? <Qtd valor={qtd} rotulo={p.nome} onMudar={onMudar} />
          : <button className="btn-wa" onClick={onAdicionar}><Icon name="cart" /> Adicionar</button>}
      </div>
    </article>
  );
}

function Prateleira({ id, titulo, sub, produtos, render, faixa }: {
  id: string; titulo: string; sub: string; produtos: Produto[]; render: (p: Produto) => JSX.Element; faixa?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!produtos.length) return null;
  const rolar = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: 'smooth' });
  return (
    <section className={faixa ? 'faixa' : ''} data-secao={id}>
      <div className="wrap sec">
        <div className="sec-head">
          <div><h2>{titulo}</h2><p>{sub}</p></div>
          <div className="tools so-largo">
            <button className="trilho-btn" onClick={() => rolar(-1)} aria-label="Rolar para a esquerda"><Icon name="left" /></button>
            <button className="trilho-btn" onClick={() => rolar(1)} aria-label="Rolar para a direita"><Icon name="right" /></button>
          </div>
        </div>
        <div className="trilho" ref={ref}>{produtos.map(render)}</div>
      </div>
    </section>
  );
}

function Barras() {
  return (
    <svg className="barras" viewBox="0 0 400 320" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <polygon className="a" points="40,0 112,0 302,320 230,320" />
      <polygon className="b" points="140,0 236,0 426,320 330,320" />
      <polygon className="a" points="264,0 324,0 514,320 454,320" />
    </svg>
  );
}

function Carrossel({ banners, linkWa, onClicar }: { banners: Banner[]; linkWa: (b: Banner) => string; onClicar: (b: Banner) => void }) {
  const [atual, setAtual] = useState(0);
  const pausado = useRef(false);
  const toqueX = useRef<number | null>(null);
  const total = banners.length;
  const ir = useCallback((i: number) => setAtual(((i % total) + total) % total), [total]);

  useEffect(() => { if (atual >= total) setAtual(0); }, [atual, total]);
  useEffect(() => {
    if (total < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      if (!pausado.current && !document.hidden) setAtual((a) => (a + 1) % total);
    }, 6500);
    return () => window.clearInterval(t);
  }, [total]);

  return (
    <section className="wrap hero" aria-label="Destaques">
      <div
        className="hero-box"
        onMouseEnter={() => { pausado.current = true; }}
        onMouseLeave={() => { pausado.current = false; }}
        onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (toqueX.current == null) return;
          const dx = e.changedTouches[0].clientX - toqueX.current;
          toqueX.current = null;
          if (Math.abs(dx) > 45) ir(atual + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="slides">
          {banners.map((b, i) => (
            <div key={b.id} className={`slide s-${b.estilo}${i === atual ? ' on' : ''}`} aria-hidden={i !== atual}>
              <div className="slide-txt">
                {b.selo && <span className="eyebrow">{b.selo}</span>}
                <h2>{b.titulo}</h2>
                {b.subtitulo && <p>{b.subtitulo}</p>}
                {b.cta && (b.link === 'whatsapp' ? (
                  <a className="slide-cta" href={linkWa(b)} target="_blank" rel="noopener noreferrer" tabIndex={i === atual ? 0 : -1}>{b.cta} <Icon name="right" /></a>
                ) : (
                  <a className="slide-cta" href="#catalogo" tabIndex={i === atual ? 0 : -1} onClick={(e) => { e.preventDefault(); onClicar(b); }}>{b.cta} <Icon name="right" /></a>
                ))}
              </div>
              <div className="slide-art">
                {b.imagem_url ? <img src={b.imagem_url} alt="" /> : <Barras />}
                {b.destaque && <span className="selo">{b.destaque}</span>}
              </div>
            </div>
          ))}
        </div>
        {total > 1 && (
          <>
            <button className="hero-nav prev" onClick={() => ir(atual - 1)} aria-label="Banner anterior"><Icon name="left" /></button>
            <button className="hero-nav next" onClick={() => ir(atual + 1)} aria-label="Próximo banner"><Icon name="right" /></button>
            <div className="pontos">
              {banners.map((b, i) => (
                <button key={b.id} className={i === atual ? 'on' : ''} onClick={() => ir(i)} aria-label={`Ir para o banner ${i + 1}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ModalProduto({ p, categoria, linkWa, whatsapp, noOrcamento, onAdicionar, onVerOrcamento, onFechar }: {
  p: Produto; categoria?: Categoria; linkWa: string; whatsapp: string;
  noOrcamento: number; onAdicionar: (qtd: number) => void; onVerOrcamento: () => void; onFechar: () => void;
}) {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [qtd, setQtd] = useState(1);
  const d = desconto(p);

  useEffect(() => {
    document.body.classList.add('travado');
    fecharRef.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => { document.body.classList.remove('travado'); window.removeEventListener('keydown', tecla); };
  }, [onFechar]);

  const copiar = () => {
    navigator.clipboard.writeText(fmtTelefone(whatsapp)).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    }, () => undefined);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={p.nome}>
      <div className="modal-fundo" onClick={onFechar} />
      <div className="modal-caixa">
        <button className="modal-x" ref={fecharRef} onClick={onFechar} aria-label="Fechar"><Icon name="x" /></button>
        <div className="modal-media">
          <Midia p={p} categoria={categoria} />
          {d > 0 && <span className="badge-off">-{d}%</span>}
        </div>
        <div className="modal-info">
          {categoria && <span className="trilha">{categoria.nome}</span>}
          <h2>{p.nome}</h2>
          <span className="sku">Cód. {p.sku} · {p.unidade}{p.marca ? ` · ${p.marca}` : ''}</span>
          <Preco p={p} />
          {p.descricao && <p>{p.descricao}</p>}
          <div className="modal-add">
            <Qtd valor={qtd} min={1} rotulo={p.nome} onMudar={(n) => setQtd(limitar(n))} />
            <button className="btn-wa lg" onClick={() => onAdicionar(qtd)}><Icon name="cart" /> Adicionar ao orçamento</button>
          </div>
          {noOrcamento > 0 && (
            <p className="wa-num">Você já tem {noOrcamento} no orçamento.<button onClick={onVerOrcamento}>Ver orçamento</button></p>
          )}
          {whatsapp && (
            <>
              <a className="btn-wa" href={linkWa} target="_blank" rel="noopener noreferrer"><Icon name="chat" /> Tirar dúvida pelo WhatsApp</a>
              <p className="wa-num">Ou chame no número <span className="sel">{fmtTelefone(whatsapp)}</span><button onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
