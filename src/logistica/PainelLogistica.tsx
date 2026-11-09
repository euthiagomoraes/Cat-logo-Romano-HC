import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../lib/icons';
import { brl, fmtTelefone, waLink } from '../lib/format';
import { Aviso, BotaoConfirmar, Campo, copiarTexto } from '../adm/ui';
import { reiniciarDemo, simularVendaCaixa } from './demo';
import { diaHora, haQuanto, hora, linkRastreio, progressoRota, type EstadoConexao, type FonteLogistica } from './fonte';
import { ORIGEM, PROXIMO, STATUS, TRANSICOES, type DadosSaida, type EventoPedido, type Pedido, type StatusPedido } from './tipos';

type Coluna = 'pago' | 'em_separacao' | 'saiu_para_entrega' | 'entregue';
const COLUNAS: { id: Coluna; titulo: string; vazio: string }[] = [
  { id: 'pago', titulo: 'A separar', vazio: 'Nenhum pedido pago esperando separação.' },
  { id: 'em_separacao', titulo: 'Em separação', vazio: 'Ninguém separando agora.' },
  { id: 'saiu_para_entrega', titulo: 'Saiu para entrega', vazio: 'Nenhum caminhão na rua.' },
  { id: 'entregue', titulo: 'Entregues', vazio: 'Nenhuma entrega concluída hoje.' },
];

/** Momento em que o pedido entrou na etapa atual (para o "há x min"). */
function desdeQuando(p: Pedido) {
  switch (p.status) {
    case 'pago': return p.pago_em;
    case 'em_separacao': return p.separacao_em;
    case 'saiu_para_entrega': return p.saiu_em;
    case 'entregue': return p.entregue_em;
    case 'cancelado': return p.cancelado_em;
    default: return p.criado_em;
  }
}

const resumoItens = (p: Pedido) => `${p.itens.length} ${p.itens.length === 1 ? 'item' : 'itens'} · ${brl(p.total)}`;

function mensagemCliente(p: Pedido) {
  const primeiro = p.cliente_nome.split(' ')[0];
  const etapa: Record<StatusPedido, string> = {
    pago: 'está confirmado e já está na fila da logística',
    em_separacao: 'está sendo separado no nosso depósito',
    saiu_para_entrega: `saiu para entrega${p.previsao_entrega ? ` e deve chegar até ${hora(p.previsao_entrega)}` : ''}`,
    entregue: 'foi entregue. Obrigado pela preferência',
    cancelado: 'foi cancelado',
  };
  return `Olá, ${primeiro}! Seu pedido ${p.numero} ${etapa[p.status]}.\n\nAcompanhe em tempo real: ${linkRastreio(p.codigo_rastreio)}`;
}

export default function PainelLogistica({ fonte, usuario, onSair }: {
  fonte: FonteLogistica; usuario: { nome: string; papel: string } | null; onSair?: () => void;
}) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [conexao, setConexao] = useState<EstadoConexao>('conectando');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [saindo, setSaindo] = useState<Pedido | null>(null);
  const [colunaMobile, setColunaMobile] = useState<Coluna>('pago');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [destaque, setDestaque] = useState<Set<string>>(new Set());
  const anteriores = useRef<Map<string, string>>(new Map());

  const carregar = useCallback(async () => {
    try {
      const lista = await fonte.listar();
      // Destaca por alguns segundos o que mudou desde a última carga (ex.: pedido novo vindo do ERP)
      const mudou = new Set<string>();
      if (anteriores.current.size) {
        for (const p of lista) if (anteriores.current.get(p.id) !== p.status) mudou.add(p.id);
      }
      anteriores.current = new Map(lista.map((p) => [p.id, p.status]));
      setPedidos(lista);
      setErroCarga('');
      if (mudou.size) {
        setDestaque(mudou);
        window.setTimeout(() => setDestaque(new Set()), 4000);
      }
    } catch (e) {
      setErroCarga((e as Error).message);
    }
  }, [fonte]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    let t = 0;
    const aoMudar = () => { window.clearTimeout(t); t = window.setTimeout(() => void carregar(), 250); };
    const cancelar = fonte.assinar(aoMudar, setConexao);
    return () => { window.clearTimeout(t); cancelar(); };
  }, [fonte, carregar]);
  useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 20000); return () => window.clearInterval(t); }, []);
  useEffect(() => { document.title = 'Logística · ROMANO'; }, []);

  const mover = useCallback(async (p: Pedido, status: StatusPedido, descricao = '', saida?: DadosSaida) => {
    if (status === 'saiu_para_entrega' && !saida) { setSaindo(p); return; }
    setOcupado(p.id);
    setMsg(null);
    try {
      await fonte.mudarStatus(p.id, status, descricao, saida);
      setMsg({ tipo: 'ok', texto: `${p.numero}: ${STATUS[status].rotulo.toLowerCase()}.` });
      await carregar();
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message });
      await carregar();
    } finally {
      setOcupado(null);
    }
  }, [fonte, carregar]);

  const porStatus = useMemo(() => {
    const m: Record<StatusPedido, Pedido[]> = { pago: [], em_separacao: [], saiu_para_entrega: [], entregue: [], cancelado: [] };
    for (const p of pedidos ?? []) m[p.status].push(p);
    m.entregue.sort((a, b) => (b.entregue_em ?? '').localeCompare(a.entregue_em ?? ''));
    return m;
  }, [pedidos]);

  const aberto = pedidos?.find((p) => p.id === abertoId) ?? null;

  return (
    <div className="logi">
      <header className="logi-topo">
        <div className="logi-topo-in">
          <a className="logi-marca" href="/home" target="_blank" rel="noopener noreferrer" title="Abrir o catálogo">
            <img src="/logo.jpg" alt="" />
            <span><b>Logística</b><small>ROMANO Home Center</small></span>
          </a>
          <span className={`aovivo ${conexao}`}><i />{conexao === 'ao-vivo' ? 'Ao vivo' : conexao === 'conectando' ? 'Conectando' : 'Sem conexão'}</span>
          <div className="logi-topo-acoes">
            {fonte.demo && (
              <BotaoConfirmar className="btn ghost claro" pergunta="Voltar aos dados de exemplo?" sim="Reiniciar" onConfirmar={reiniciarDemo}>
                <Icon name="history" /><span className="some-pequeno">Reiniciar demo</span>
              </BotaoConfirmar>
            )}
            {fonte.demo && (
              <button className="btn sun" title="Só na demonstração: imita uma venda paga no caixa (PDV) chegando para entrega"
                onClick={() => {
                  const { pedido, caixa } = simularVendaCaixa();
                  setMsg({ tipo: 'ok', texto: `${pedido.numero} · ${pedido.cliente_nome}: venda paga no caixa ${caixa} chegou para separar (simulação).` });
                }}>
                <Icon name="cart" /><span className="some-pequeno">Simular venda do caixa</span>
              </button>
            )}
            {usuario && (
              <span className="logi-user">
                <span><b>{usuario.nome}</b><small>{usuario.papel === 'administrador' ? 'Administrador' : 'Logística'}</small></span>
                {usuario.papel === 'administrador' && <a className="btn icon ghost claro" href="/adm" title="Editor do catálogo" aria-label="Editor do catálogo"><Icon name="edit" /></a>}
                {onSair && <button className="btn icon ghost claro" onClick={onSair} title="Sair" aria-label="Sair"><Icon name="logout" /></button>}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="logi-corpo">
        {fonte.demo && (
          <Aviso tipo="info">
            <b>Modo demonstração.</b> Os pedidos são de exemplo e ficam só neste navegador. Abra um link de rastreio em outra aba
            (botão <Icon name="external" /> no pedido) e mude o status aqui para ver o cliente acompanhando ao vivo.
          </Aviso>
        )}
        {msg && <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>{msg.texto}</Aviso>}
        {erroCarga && (
          <Aviso tipo="erro">{erroCarga}<button className="btn" onClick={() => void carregar()}>Tentar de novo</button></Aviso>
        )}

        <section className="logi-resumo" aria-label="Resumo">
          <Contador rotulo="A separar" valor={porStatus.pago.length} icone="card" forte={porStatus.pago.length > 0} />
          <Contador rotulo="Em separação" valor={porStatus.em_separacao.length} icone="box" />
          <Contador rotulo="Em rota" valor={porStatus.saiu_para_entrega.length} icone="truck" />
          <Contador rotulo="Entregues" valor={porStatus.entregue.length} icone="check" />
        </section>

        <div className="logi-abas" role="tablist" aria-label="Etapas">
          {COLUNAS.map((c) => (
            <button key={c.id} role="tab" aria-selected={colunaMobile === c.id} className={colunaMobile === c.id ? 'on' : ''} onClick={() => setColunaMobile(c.id)}>
              {c.titulo}<span className="cont">{porStatus[c.id].length}</span>
            </button>
          ))}
        </div>

        {!pedidos && !erroCarga ? <p className="hint">Carregando pedidos…</p> : (
          <div className="logi-quadro">
            {COLUNAS.map((c) => (
              <section key={c.id} className={`logi-col col-${c.id}${colunaMobile === c.id ? ' ativa' : ''}`} aria-label={c.titulo}>
                <h2><Icon name={STATUS[c.id].icone} />{c.titulo}<span className="cont">{porStatus[c.id].length}</span></h2>
                <div className="logi-col-lista">
                  {porStatus[c.id].length === 0 && <p className="logi-vazio">{c.vazio}</p>}
                  {porStatus[c.id].map((p) => (
                    <CartaoPedido key={p.id} p={p} agora={agora} ocupado={ocupado === p.id} novo={destaque.has(p.id)}
                      onAbrir={() => setAbertoId(p.id)} onAvancar={(s) => void mover(p, s)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {porStatus.cancelado.length > 0 && (
          <p className="hint logi-cancelados">
            {porStatus.cancelado.length} {porStatus.cancelado.length === 1 ? 'pedido cancelado' : 'pedidos cancelados'} recentemente:{' '}
            {porStatus.cancelado.map((p, i) => <span key={p.id}>{i > 0 && ', '}<button className="link" onClick={() => setAbertoId(p.id)}>{p.numero}</button></span>)}
          </p>
        )}
      </main>

      {aberto && (
        <Detalhe p={aberto} fonte={fonte} agora={agora} ocupado={ocupado === aberto.id}
          onFechar={() => setAbertoId(null)} onMover={(s, d) => void mover(aberto, s, d)} onMsg={setMsg} />
      )}
      {saindo && (
        <ModalSaida p={saindo} onFechar={() => setSaindo(null)}
          onConfirmar={(d) => { const p = saindo; setSaindo(null); void mover(p, 'saiu_para_entrega', '', d); }} />
      )}
    </div>
  );
}

function Contador({ rotulo, valor, icone, forte }: { rotulo: string; valor: number; icone: string; forte?: boolean }) {
  return (
    <div className={`logi-contador${forte ? ' forte' : ''}`}>
      <Icon name={icone} />
      <span><b>{valor}</b><small>{rotulo}</small></span>
    </div>
  );
}

function CartaoPedido({ p, agora, ocupado, novo, onAbrir, onAvancar }: {
  p: Pedido; agora: number; ocupado: boolean; novo: boolean; onAbrir: () => void; onAvancar: (s: StatusPedido) => void;
}) {
  const prox = PROXIMO[p.status];
  const desde = desdeQuando(p);
  const minutos = desde ? (agora - new Date(desde).getTime()) / 60000 : 0;
  const atrasado = (p.status === 'pago' && minutos > 60) || (p.status === 'em_separacao' && minutos > 90)
    || (p.status === 'saiu_para_entrega' && p.previsao_entrega != null && agora > new Date(p.previsao_entrega).getTime());
  const prog = p.status === 'saiu_para_entrega' ? progressoRota(p, agora) : 0;

  return (
    <article className={`cartao${novo ? ' novo' : ''}${atrasado ? ' atrasado' : ''}`}>
      <button className="cartao-corpo" onClick={onAbrir} aria-label={`Abrir pedido ${p.numero}`}>
        <span className="cartao-topo">
          <b>{p.numero}</b>
          {p.origem !== 'erp' && <span className={`origem o-${p.origem}`}>{ORIGEM[p.origem]}</span>}
          <span className={`cartao-tempo${atrasado ? ' alerta' : ''}`} title={diaHora(desde)}>
            {p.status === 'entregue' ? hora(p.entregue_em) : haQuanto(desde, agora)}
          </span>
        </span>
        <span className="cartao-cliente">{p.cliente_nome}</span>
        <span className="cartao-linha"><Icon name="pin" />{[p.entrega_bairro, p.entrega_cidade].filter(Boolean).join(' · ') || 'Sem endereço'}</span>
        <span className="cartao-linha"><Icon name="box" />{resumoItens(p)}</span>
        {p.status === 'saiu_para_entrega' && (
          <>
            <span className="cartao-linha"><Icon name="truck" />{p.motorista || 'Motorista'}{p.veiculo_placa ? ` · ${p.veiculo_placa}` : ''}{p.previsao_entrega ? ` · até ${hora(p.previsao_entrega)}` : ''}</span>
            <span className="cartao-rota" aria-hidden="true"><i style={{ width: `${Math.round(prog * 100)}%` }} /></span>
          </>
        )}
      </button>
      {prox && (
        <button className={`btn ${p.status === 'saiu_para_entrega' ? 'primary' : ''} cartao-acao`} disabled={ocupado} onClick={() => onAvancar(prox.status)}>
          <Icon name={prox.icone} />{ocupado ? 'Salvando…' : prox.acao}
        </button>
      )}
    </article>
  );
}

/* ---------- detalhe do pedido ---------- */

function useCompartilharPosicao(fonte: FonteLogistica, pedidoId: string, ativo: boolean) {
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const ultimoEnvio = useRef(0);
  useEffect(() => {
    if (!ativo) { setEstado(null); return; }
    if (!('geolocation' in navigator)) { setEstado({ ok: false, texto: 'Este aparelho não informa a localização.' }); return; }
    setEstado({ ok: true, texto: 'Buscando o GPS…' });
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const t = Date.now();
        if (t - ultimoEnvio.current < 15000) return; // no máximo a cada 15 s
        ultimoEnvio.current = t;
        fonte.registrarPosicao(pedidoId, pos.coords.latitude, pos.coords.longitude).then(
          () => setEstado({ ok: true, texto: `Localização enviada às ${hora(new Date().toISOString())}` }),
          (e: Error) => setEstado({ ok: false, texto: e.message }),
        );
      },
      (e) => setEstado({ ok: false, texto: e.code === e.PERMISSION_DENIED ? 'Permita o acesso à localização no navegador.' : 'Não foi possível ler o GPS.' }),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [fonte, pedidoId, ativo]);
  return estado;
}

function Detalhe({ p, fonte, agora, ocupado, onFechar, onMover, onMsg }: {
  p: Pedido; fonte: FonteLogistica; agora: number; ocupado: boolean;
  onFechar: () => void; onMover: (s: StatusPedido, descricao?: string) => void; onMsg: (m: { tipo: 'ok' | 'erro'; texto: string }) => void;
}) {
  const [eventos, setEventos] = useState<EventoPedido[] | null>(null);
  const [gps, setGps] = useState(false);
  const posicao = useCompartilharPosicao(fonte, p.id, gps && p.status === 'saiu_para_entrega');
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => { fonte.eventos(p.id).then(setEventos, () => setEventos([])); }, [fonte, p.id, p.atualizado_em]);
  useEffect(() => {
    document.body.classList.add('travado');
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => { document.body.classList.remove('travado'); window.removeEventListener('keydown', tecla); };
  }, [onFechar]);

  const prox = PROXIMO[p.status];
  const voltar = TRANSICOES[p.status].find((s) => s !== prox?.status && s !== 'cancelado');
  const podeCancelar = TRANSICOES[p.status].includes('cancelado');
  const link = linkRastreio(p.codigo_rastreio);

  return (
    <div className="modal gaveta" role="dialog" aria-modal="true" aria-labelledby="ped-titulo">
      <div className="modal-fundo" onClick={onFechar} />
      <div className="gaveta-caixa logi-detalhe">
        <div className="gaveta-topo">
          <div>
            <h2 id="ped-titulo">{p.numero}</h2>
            <span className={`selo-status s-${p.status}`}><Icon name={STATUS[p.status].icone} />{STATUS[p.status].rotulo}</span>
            <span className={`origem o-${p.origem}`}>{ORIGEM[p.origem]}{p.externo_id ? ` · ${p.externo_id}` : ''}</span>
          </div>
          <button className="modal-x" ref={fechar} onClick={onFechar} aria-label="Fechar"><Icon name="x" /></button>
        </div>

        <div className="logi-detalhe-corpo">
          <div className="logi-acoes">
            {prox && (
              <button className="btn lg primary" disabled={ocupado} onClick={() => onMover(prox.status)}>
                <Icon name={prox.icone} />{prox.acao}
              </button>
            )}
            {voltar && (
              <BotaoConfirmar className="btn" pergunta={`Voltar para “${STATUS[voltar].rotulo}”?`} sim="Voltar" onConfirmar={() => onMover(voltar, voltar === 'em_separacao' ? 'Pedido voltou ao depósito.' : 'Separação reiniciada.')}>
                <Icon name="left" />Voltar etapa
              </BotaoConfirmar>
            )}
            {podeCancelar && (
              <BotaoConfirmar className="btn danger" pergunta="Cancelar o pedido?" sim="Cancelar pedido" onConfirmar={() => onMover('cancelado')}>
                <Icon name="x" />Cancelar
              </BotaoConfirmar>
            )}
          </div>

          {p.status === 'saiu_para_entrega' && (
            <div className="logi-bloco gps">
              <div>
                <b>Rastreio pelo GPS</b>
                <p className="hint">Abra este pedido no celular do motorista e ligue para o cliente ver o caminhão andando. Sem GPS, o rastreio estima a posição pela previsão de chegada.</p>
                {posicao && <p className={posicao.ok ? 'gps-ok' : 'erro-txt'}>{posicao.texto}</p>}
              </div>
              <button className={`btn ${gps ? 'primary' : ''}`} onClick={() => setGps((v) => !v)} aria-pressed={gps}>
                <Icon name="pin" />{gps ? 'Parar de enviar' : 'Enviar minha localização'}
              </button>
            </div>
          )}

          <div className="logi-bloco">
            <b>Link de rastreio do cliente</b>
            <div className="logi-link">
              <code className="sel">{link}</code>
            </div>
            <div className="row-act">
              <button className="btn" onClick={() => copiarTexto(link).then(() => onMsg({ tipo: 'ok', texto: 'Link copiado.' }), () => onMsg({ tipo: 'erro', texto: 'Não foi possível copiar.' }))}><Icon name="copy" />Copiar</button>
              <a className="btn" href={`/rastreio/${p.codigo_rastreio}`} target="_blank" rel="noopener noreferrer"><Icon name="external" />Abrir</a>
              {p.cliente_telefone && (
                <a className="btn-wa" href={waLink(p.cliente_telefone.length <= 11 ? `55${p.cliente_telefone}` : p.cliente_telefone, mensagemCliente(p))} target="_blank" rel="noopener noreferrer">
                  <Icon name="chat" />Avisar no WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="logi-bloco duas">
            <div>
              <b>Cliente</b>
              <p>{p.cliente_nome}</p>
              {p.cliente_telefone && <p className="hint">{fmtTelefone(p.cliente_telefone)}</p>}
            </div>
            <div>
              <b>Entrega</b>
              <p>{p.entrega_endereco || '—'}</p>
              <p className="hint">{[p.entrega_bairro, p.entrega_cidade].filter(Boolean).join(' · ')}{p.entrega_referencia ? ` · ${p.entrega_referencia}` : ''}</p>
              {p.entrega_endereco && (
                <a className="link-mapa" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.entrega_endereco, p.entrega_bairro, p.entrega_cidade].filter(Boolean).join(', '))}`} target="_blank" rel="noopener noreferrer"><Icon name="pin" />Abrir no mapa</a>
              )}
            </div>
            {p.status === 'saiu_para_entrega' && (
              <div>
                <b>Caminhão</b>
                <p>{p.motorista || '—'}{p.veiculo_placa ? ` · ${p.veiculo_placa}` : ''}</p>
                <p className="hint">Saiu {diaHora(p.saiu_em)}{p.previsao_entrega ? ` · previsão ${hora(p.previsao_entrega)}` : ''}{p.posicao_em ? ` · GPS ${haQuanto(p.posicao_em, agora)}` : ''}</p>
              </div>
            )}
            <div>
              <b>Pagamento</b>
              <p>{brl(p.total)}{p.forma_pagamento ? ` · ${p.forma_pagamento}` : ''}</p>
              <p className="hint">Pago · chegou na logística {diaHora(p.pago_em)}</p>
            </div>
          </div>

          {p.observacao && <div className="logi-bloco"><b>Observações</b><p>{p.observacao}</p></div>}

          <div className="logi-bloco">
            <b>Itens para separar</b>
            <table className="logi-itens">
              <thead><tr><th>Cód.</th><th>Produto</th><th className="n">Qtd.</th></tr></thead>
              <tbody>
                {p.itens.map((i, k) => (
                  <tr key={k}><td className="cod">{i.sku || '—'}</td><td>{i.nome}</td><td className="n"><b>{String(i.qtd).replace('.', ',')}</b> {i.unidade}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="logi-bloco">
            <b>Histórico</b>
            {!eventos ? <p className="hint">Carregando…</p> : (
              <ol className="linha-tempo">
                {[...eventos].reverse().map((e) => (
                  <li key={e.id}>
                    <time>{diaHora(e.criado_em)}</time>
                    <b>{STATUS[e.status]?.rotulo ?? e.status}</b>
                    <span>{e.descricao}{e.autor_nome ? ` · ${e.autor_nome === 'erp' ? 'Sistema de gestão' : e.autor_nome}` : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- modais ---------- */

function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);
  return (
    <div className="modal logi-modal" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="modal-fundo" onClick={onFechar} />
      <div className="logi-modal-caixa">
        <div className="gaveta-topo"><h2>{titulo}</h2><button className="modal-x" onClick={onFechar} aria-label="Fechar"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

const MEMO_SAIDA = 'romano-logistica-ultima-saida';

function ModalSaida({ p, onFechar, onConfirmar }: { p: Pedido; onFechar: () => void; onConfirmar: (d: DadosSaida) => void }) {
  const lembrado = (() => { try { return JSON.parse(localStorage.getItem(MEMO_SAIDA) ?? '{}') as { motorista?: string; placa?: string }; } catch { return {}; } })();
  const [motorista, setMotorista] = useState(p.motorista || lembrado.motorista || '');
  const [placa, setPlaca] = useState(p.veiculo_placa || lembrado.placa || '');
  const [prazo, setPrazo] = useState('60');
  const [horaFixa, setHoraFixa] = useState('');

  const confirmar = (e: FormEvent) => {
    e.preventDefault();
    let previsao: string | null = null;
    if (prazo === 'hora' && horaFixa) {
      const [h, m] = horaFixa.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      previsao = d.toISOString();
    } else if (prazo !== 'hora' && prazo !== '') {
      previsao = new Date(Date.now() + Number(prazo) * 60000).toISOString();
    }
    try { localStorage.setItem(MEMO_SAIDA, JSON.stringify({ motorista: motorista.trim(), placa: placa.trim() })); } catch { /* opcional */ }
    onConfirmar({ motorista: motorista.trim(), placa: placa.trim(), previsao });
  };

  return (
    <Modal titulo={`Saída para entrega · ${p.numero}`} onFechar={onFechar}>
      <form className="logi-form" onSubmit={confirmar}>
        <p className="hint">O cliente passa a ver o caminhão a caminho, com o nome do motorista e a previsão.</p>
        <div className="grade-campos">
          <Campo rotulo="Motorista"><input required value={motorista} onChange={(e) => setMotorista(e.target.value)} autoComplete="off" /></Campo>
          <Campo rotulo="Placa do caminhão"><input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC-1D23" autoComplete="off" /></Campo>
          <Campo rotulo="Previsão de chegada">
            <select value={prazo} onChange={(e) => setPrazo(e.target.value)}>
              <option value="30">Em até 30 min</option>
              <option value="60">Em até 1 hora</option>
              <option value="120">Em até 2 horas</option>
              <option value="240">Em até 4 horas</option>
              <option value="hora">Até um horário…</option>
              <option value="">Sem previsão</option>
            </select>
          </Campo>
          {prazo === 'hora' && <Campo rotulo="Horário"><input type="time" required value={horaFixa} onChange={(e) => setHoraFixa(e.target.value)} /></Campo>}
        </div>
        <div className="row-act">
          <button className="btn primary lg"><Icon name="truck" />Confirmar saída</button>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
