import { useCallback, useEffect, useRef, useState } from 'react';
import type { Administrador, Rascunho } from '../lib/types';
import { carregarRascunho, ErroConflito, publicar, salvarRascunho } from '../lib/api';
import { dataHora } from '../lib/format';
import { Icon } from '../lib/icons';
import { Aviso } from './ui';
import Vitrine from '../home/Vitrine';
import AbaProdutos from './abas/Produtos';
import AbaBanners from './abas/Banners';
import AbaDepartamentos from './abas/Departamentos';
import AbaLoja from './abas/Loja';
import AbaPrecos from './abas/Precos';
import AbaPublicacoes from './abas/Publicacoes';
import AbaAdministradores from './abas/Administradores';
import AbaConta from './abas/Conta';

export type Alterar = (fn: (d: Rascunho) => void) => void;

type Aba = 'produtos' | 'banners' | 'departamentos' | 'loja' | 'precos' | 'previa' | 'publicacoes' | 'administradores' | 'conta';
const ABAS: { id: Aba; rotulo: string; icone: string; grupo: 'conteudo' | 'site' | 'conta' }[] = [
  { id: 'produtos', rotulo: 'Produtos', icone: 'box', grupo: 'conteudo' },
  { id: 'banners', rotulo: 'Banners', icone: 'image', grupo: 'conteudo' },
  { id: 'departamentos', rotulo: 'Departamentos', icone: 'grid', grupo: 'conteudo' },
  { id: 'loja', rotulo: 'Dados da loja', icone: 'store', grupo: 'conteudo' },
  { id: 'precos', rotulo: 'Preços em lote', icone: 'tag', grupo: 'conteudo' },
  { id: 'previa', rotulo: 'Pré-visualizar', icone: 'eye', grupo: 'site' },
  { id: 'publicacoes', rotulo: 'Publicações', icone: 'history', grupo: 'site' },
  { id: 'administradores', rotulo: 'Administradores', icone: 'users', grupo: 'conta' },
  { id: 'conta', rotulo: 'Minha conta', icone: 'user', grupo: 'conta' },
];

type Msg = { tipo: 'ok' | 'erro' | 'info'; texto: string; link?: boolean } | null;

interface Props {
  admin: Administrador;
  onSair: () => void;
  onAdminAtualizado: (a: Administrador) => void;
}

export default function Editor({ admin, onSair, onAdminAtualizado }: Props) {
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [sujo, setSujo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [painelPublicar, setPainelPublicar] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [conflito, setConflito] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [aba, setAba] = useState<Aba>('produtos');
  const edicoes = useRef(0);
  const atual = useRef<Rascunho | null>(null);
  atual.current = rascunho;

  const carregar = useCallback(async () => {
    setErroCarga('');
    try {
      const r = await carregarRascunho();
      setRascunho(r);
      setSujo(false);
      setConflito(false);
      edicoes.current = 0;
    } catch (e) {
      setErroCarga((e as Error).message);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const alterar: Alterar = useCallback((fn) => {
    setRascunho((ant) => {
      if (!ant) return ant;
      const novo = structuredClone(ant);
      fn(novo);
      return novo;
    });
    edicoes.current += 1;
    setSujo(true);
  }, []);

  const gravar = useCallback(async (silencioso = false): Promise<boolean> => {
    const r = atual.current;
    if (!r) return false;
    const marca = edicoes.current;
    setGravando(true);
    try {
      const res = await salvarRascunho(r);
      setRascunho((ant) => (ant ? { ...ant, versao: res.versao, alterado_em: res.alterado_em } : ant));
      if (edicoes.current === marca) setSujo(false);
      if (!silencioso) setMsg({ tipo: 'ok', texto: 'Rascunho gravado. Publique quando quiser que os clientes vejam.' });
      return true;
    } catch (e) {
      if (e instanceof ErroConflito) setConflito(true);
      else setMsg({ tipo: 'erro', texto: (e as Error).message });
      return false;
    } finally {
      setGravando(false);
    }
  }, []);

  const confirmarPublicacao = async () => {
    setPublicando(true);
    setMsg(null);
    try {
      if (sujo && !(await gravar(true))) return;
      const res = await publicar(observacao.trim());
      setRascunho((ant) => (ant ? { ...ant, publicado_em: res.publicado_em } : ant));
      setPainelPublicar(false);
      setObservacao('');
      setMsg({ tipo: 'ok', texto: 'Publicado! Os clientes já veem a nova versão em /home.', link: true });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setPublicando(false);
    }
  };

  // Atalho Ctrl+S / Cmd+S para gravar
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!gravando) void gravar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [gravar, gravando]);

  // Aviso ao fechar a aba com alterações não gravadas
  useEffect(() => {
    if (!sujo) return;
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [sujo]);

  if (erroCarga) {
    return (
      <div className="estado"><div>
        <img src="/logo.jpg" alt="" />
        <h1>Não foi possível abrir o editor</h1>
        <p>{erroCarga}</p>
        <div className="row-act"><button className="btn primary" onClick={carregar}>Tentar de novo</button><button className="btn" onClick={onSair}>Sair</button></div>
      </div></div>
    );
  }
  if (!rascunho) return <div className="estado"><div><img src="/logo.jpg" alt="" /><p>Carregando o rascunho…</p></div></div>;

  const pendente = !rascunho.publicado_em || (rascunho.alterado_em !== null && rascunho.alterado_em > rascunho.publicado_em);
  const status = sujo
    ? { cls: 'st-sujo', txt: 'Alterações não gravadas' }
    : pendente
      ? { cls: 'st-pendente', txt: 'Gravado, ainda não publicado' }
      : { cls: 'st-ok', txt: 'Site atualizado' };
  const ehGestor = admin.papel === 'administrador';

  return (
    <div className="adm">
      <aside className="adm-lateral">
        <a className="adm-marca" href="/home" target="_blank" rel="noopener noreferrer" title="Abrir o site publicado">
          <img src={rascunho.loja.logo_url || '/logo.jpg'} alt="" />
          <span><b>{rascunho.loja.nome || 'Catálogo'}</b><small>Editor do catálogo</small></span>
        </a>
        <nav className="adm-nav" aria-label="Seções do editor">
          {(['conteudo', 'site', 'conta'] as const).map((g) => (
            <div className="adm-nav-grupo" key={g}>
              <span className="adm-nav-titulo">{g === 'conteudo' ? 'Conteúdo' : g === 'site' ? 'Site' : 'Equipe e conta'}</span>
              {ABAS.filter((a) => a.grupo === g).map((a) => (
                <button key={a.id} className={aba === a.id ? 'on' : ''} aria-current={aba === a.id ? 'page' : undefined} onClick={() => { setAba(a.id); window.scrollTo({ top: 0 }); }}>
                  <Icon name={a.icone} />{a.rotulo}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="adm-nav-user">
          <span><b>{admin.nome || admin.email}</b><small>{ehGestor ? 'Administrador' : 'Editor'}</small></span>
          <button className="btn icon ghost" onClick={onSair} title="Sair" aria-label="Sair"><Icon name="logout" /></button>
        </div>
      </aside>

      <div className="adm-principal">
        <header className="adm-top">
          <div className="adm-top-in">
            <span className={`status ${status.cls}`}><i />{status.txt}</span>
            <div className="adm-acoes">
              <button className="btn" onClick={() => gravar()} disabled={!sujo || gravando || publicando} title="Ctrl+S">
                <Icon name="save" />{gravando ? 'Gravando…' : 'Gravar'}
              </button>
              <button className="btn sun" onClick={() => setPainelPublicar((v) => !v)} disabled={publicando || (!sujo && !pendente)}>
                <Icon name="rocket" />Publicar
              </button>
              <a className="btn ghost adm-ver" href="/home" target="_blank" rel="noopener noreferrer"><Icon name="external" /><span>Ver site</span></a>
            </div>
          </div>
          {painelPublicar && (
            <div className="publicar-painel">
              <div className="publicar-in">
                <div>
                  <b>Publicar no site</b>
                  <p className="hint">{sujo ? 'As alterações não gravadas serão gravadas antes. ' : ''}Os clientes passam a ver o conteúdo atual do rascunho em /home.</p>
                </div>
                <label className="fld">
                  <span>O que mudou? (opcional, aparece no histórico)</span>
                  <input value={observacao} maxLength={200} placeholder="Ex.: Preços de cimento e banner da Semana da Obra" onChange={(e) => setObservacao(e.target.value)} />
                </label>
                <div className="row-act">
                  <button className="btn sun" onClick={confirmarPublicacao} disabled={publicando}><Icon name="rocket" />{publicando ? 'Publicando…' : 'Confirmar publicação'}</button>
                  <button className="btn" onClick={() => setPainelPublicar(false)} disabled={publicando}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </header>

          <main className="adm-painel">
            {conflito && (
              <Aviso tipo="erro">
                <b>Outro administrador gravou alterações enquanto você editava.</b> Para não apagar o trabalho dele, suas alterações não foram gravadas.
                Recarregue o rascunho para ver a versão atual e refaça suas mudanças.
                <div className="row-act" style={{ marginTop: 8 }}><button className="btn" onClick={carregar}>Recarregar rascunho</button></div>
              </Aviso>
            )}
            {msg && (
              <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>
                {msg.texto}{msg.link && <> <a href="/home" target="_blank" rel="noopener noreferrer">Abrir o site</a></>}
              </Aviso>
            )}
            {!sujo && pendente && rascunho.publicado_em === null && rascunho.alterado_em && (
              <Aviso tipo="info">O site está mostrando uma versão anterior. Publique para colocar o rascunho atual no ar.</Aviso>
            )}

            {aba === 'produtos' && <AbaProdutos rascunho={rascunho} alterar={alterar} />}
            {aba === 'banners' && <AbaBanners rascunho={rascunho} alterar={alterar} />}
            {aba === 'departamentos' && <AbaDepartamentos rascunho={rascunho} alterar={alterar} />}
            {aba === 'loja' && <AbaLoja rascunho={rascunho} alterar={alterar} />}
            {aba === 'precos' && <AbaPrecos rascunho={rascunho} alterar={alterar} />}
            {aba === 'previa' && <div className="previa-moldura"><Vitrine dados={rascunho} previa /></div>}
            {aba === 'publicacoes' && (
              <AbaPublicacoes
                publicadoEm={rascunho.publicado_em}
                onRepublicado={() => {
                  setRascunho((ant) => (ant ? { ...ant, publicado_em: null } : ant));
                  setMsg({ tipo: 'ok', texto: 'O site voltou para a versão escolhida. O rascunho não foi alterado.', link: true });
                }}
              />
            )}
            {aba === 'administradores' && <AbaAdministradores eu={admin} />}
            {aba === 'conta' && <AbaConta eu={admin} onAtualizado={onAdminAtualizado} />}

            <p className="adm-rodape hint">
              Última gravação: {dataHora(rascunho.alterado_em)} · Última publicação: {dataHora(rascunho.publicado_em)}
            </p>
          </main>
      </div>
    </div>
  );
}
