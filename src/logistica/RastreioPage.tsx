import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { fmtTelefone, waLink } from '../lib/format';
import { CenaEntrega } from './Caminhao';
import { fonteDemo } from './demo';
import { fonteSupabase, haQuanto, hora, kmAteCliente, progressoRota, diaHora, type EstadoConexao } from './fonte';
import { ETAPAS_CLIENTE, STATUS, type Rastreio, type StatusPedido } from './tipos';

const TITULO: Record<StatusPedido, (r: Rastreio) => string> = {
  pago: () => 'Pedido confirmado! Ele já está na fila da logística',
  em_separacao: () => 'Estamos separando seus produtos',
  saiu_para_entrega: () => 'Seu pedido está a caminho',
  entregue: () => 'Pedido entregue',
  cancelado: () => 'Este pedido foi cancelado',
};

const QUANDO: Partial<Record<StatusPedido, keyof Rastreio>> = {
  pago: 'pago_em', em_separacao: 'separacao_em', saiu_para_entrega: 'saiu_em', entregue: 'entregue_em',
};

export default function RastreioPage() {
  const { codigo = '' } = useParams();
  const fonte = codigo.startsWith('demo-') ? fonteDemo : fonteSupabase;
  const [r, setR] = useState<Rastreio | null | undefined>(undefined);
  const [erro, setErro] = useState('');
  const [conexao, setConexao] = useState<EstadoConexao>('conectando');
  const [agora, setAgora] = useState(Date.now());

  const carregar = useCallback(async () => {
    try {
      setR(await fonte.rastreio(codigo));
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [fonte, codigo]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => fonte.assinarRastreio(codigo, () => void carregar(), setConexao), [fonte, codigo, carregar]);
  // Relógio: move o caminhão entre uma posição de GPS e outra e atualiza os "há x min"
  useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 5000); return () => window.clearInterval(t); }, []);

  useEffect(() => {
    document.title = r ? `Pedido ${r.numero} · ${STATUS[r.status].cliente}` : 'Acompanhe seu pedido';
  }, [r]);

  const logo = r?.loja?.logo_url || '/logo.jpg';
  const nomeLoja = r?.loja?.nome || 'ROMANO Home Center';

  if (r === undefined && !erro) {
    return <div className="estado"><div><img src="/logo.jpg" alt="" /><p>Carregando seu pedido…</p></div></div>;
  }
  if (!r) {
    return (
      <div className="estado"><div>
        <img src="/logo.jpg" alt="" />
        <h1>Pedido não encontrado</h1>
        <p>{erro || 'Confira se o link está completo. Ele chega pelo WhatsApp depois da compra.'}</p>
        <Link className="btn primary" to="/home">Ir para o catálogo</Link>
      </div></div>
    );
  }

  const andando = r.status === 'saiu_para_entrega';
  const progresso = progressoRota(r, agora);
  const km = kmAteCliente(r);
  const cancelado = r.status === 'cancelado';
  const idxAtual = ETAPAS_CLIENTE.indexOf(r.status);
  const ultimo = r.eventos[r.eventos.length - 1];

  return (
    <div className="rastreio">
      <header className="rastreio-topo">
        <div className="rastreio-topo-in">
          <img src={logo} alt="" />
          <span><b>{nomeLoja}</b><small>Acompanhe sua entrega</small></span>
          <span className={`aovivo ${conexao}`} title={conexao === 'ao-vivo' ? 'Atualiza sozinho' : 'Reconectando'}>
            <i />{conexao === 'ao-vivo' ? 'Ao vivo' : conexao === 'conectando' ? 'Conectando' : 'Reconectando'}
          </span>
        </div>
      </header>

      <main className="rastreio-corpo">
        {fonte.demo && <p className="demo-faixa"><Icon name="eye" /> Demonstração: os dados são de exemplo e ficam só neste navegador.</p>}

        <section className={`rastreio-hero st-${r.status}`}>
          <span className="rastreio-num">Pedido {r.numero}{r.cliente_nome ? ` · ${r.cliente_nome}` : ''}</span>
          <h1>{TITULO[r.status](r)}</h1>
          <p className="rastreio-sub">
            {andando && r.previsao_entrega && <>Previsão de chegada: <b>até {hora(r.previsao_entrega)}</b>{km != null && <> · faltam cerca de <b>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`}</b></>}</>}
            {andando && !r.previsao_entrega && 'O motorista já está a caminho do seu endereço.'}
            {r.status === 'entregue' && `Entregue ${diaHora(r.entregue_em)}. Obrigado pela preferência!`}
            {r.status === 'em_separacao' && 'Assim que o caminhão sair, você acompanha a rota por aqui.'}
            {r.status === 'pago' && 'Em breve começamos a separar seus produtos.'}
            {cancelado && 'Se tiver dúvidas, fale com a loja.'}
          </p>

          {!cancelado && (
            <CenaEntrega progresso={progresso} andando={andando} logo={logo} nome="ROMANO" entregue={r.status === 'entregue'} />
          )}

          {andando && (r.motorista || r.veiculo_placa) && (
            <div className="rastreio-motorista">
              <span className="avatar"><Icon name="truck" /></span>
              <span>
                <b>{r.motorista ? `${r.motorista} está levando seu pedido` : 'Seu pedido está no caminhão'}</b>
                <small>
                  {r.veiculo_placa && <>Placa <b className="placa">{r.veiculo_placa}</b></>}
                  {r.posicao_em && <> · localização {haQuanto(r.posicao_em, agora)}</>}
                </small>
              </span>
              {r.posicao_lat != null && r.posicao_lng != null && (
                <a className="btn" href={`https://www.google.com/maps?q=${r.posicao_lat},${r.posicao_lng}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="pin" /> Ver no mapa
                </a>
              )}
            </div>
          )}
        </section>

        {!cancelado && (
          <section className="rastreio-caixa">
            <h2>Etapas</h2>
            <ol className="etapas">
              {ETAPAS_CLIENTE.map((s, i) => {
                const feito = idxAtual >= i;
                const atual = idxAtual === i && s !== 'entregue';
                const quando = QUANDO[s] ? (r[QUANDO[s]!] as string | null) : null;
                return (
                  <li key={s} className={`${feito ? 'feito' : ''}${atual ? ' atual' : ''}`}>
                    <span className="etapa-ico"><Icon name={feito && !atual ? 'check' : STATUS[s].icone} /></span>
                    <span className="etapa-txt">
                      <b>{STATUS[s].cliente}</b>
                      <small>{quando ? diaHora(quando) : atual ? 'agora' : feito ? '' : 'a seguir'}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <div className="rastreio-grade">
          <section className="rastreio-caixa">
            <h2>Entrega</h2>
            <p className="rastreio-linha"><Icon name="pin" /><span>{[r.entrega_bairro, r.entrega_cidade].filter(Boolean).join(' · ') || 'Endereço informado na compra'}</span></p>
            {ultimo && <p className="rastreio-linha"><Icon name="clock" /><span>Última atualização {haQuanto(ultimo.criado_em, agora)}</span></p>}
            {r.loja?.whatsapp && (
              <a className="btn-wa" href={waLink(r.loja.whatsapp, `Olá! Quero falar sobre o pedido ${r.numero}.`)} target="_blank" rel="noopener noreferrer">
                <Icon name="chat" /> Falar com a loja · {fmtTelefone(r.loja.whatsapp)}
              </a>
            )}
          </section>

          <section className="rastreio-caixa">
            <h2>Itens ({r.itens.length})</h2>
            <ul className="rastreio-itens">
              {r.itens.map((i, k) => (
                <li key={k}><span>{i.nome}</span><b>{String(i.qtd).replace('.', ',')} {i.unidade}</b></li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rastreio-caixa">
          <h2>Histórico</h2>
          <ol className="linha-tempo">
            {[...r.eventos].reverse().map((e, k) => (
              <li key={k} className={k === 0 ? 'recente' : ''}>
                <time>{diaHora(e.criado_em)}</time>
                <b>{STATUS[e.status]?.cliente ?? e.status}</b>
                <span>{e.descricao}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="rastreio-rodape hint">Esta página se atualiza sozinha. <Link to="/home">Ver o catálogo da loja</Link></p>
      </main>
    </div>
  );
}
