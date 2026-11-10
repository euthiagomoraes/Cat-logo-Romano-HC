/**
 * Caminhão de entrega da ROMANO (arte oficial, recortada com fundo transparente
 * em /public/caminhao-romano.webp). Em movimento: fumaça no escapamento e um leve balanço.
 * O parâmetro `logo` é aceito por compatibilidade; a arte já traz o logo.
 */
const ARTE = '/caminhao-romano.webp';
const ARTE_W = 900, ARTE_H = 439;

export function Caminhao({ andando = false, nome = 'ROMANO', className = '' }: {
  logo?: string; andando?: boolean; nome?: string; className?: string;
}) {
  return (
    <svg className={`caminhao caminhao-arte${andando ? ' andando' : ''} ${className}`} viewBox={`0 0 ${ARTE_W} ${ARTE_H}`} role="img" aria-label={`Caminhão de entrega ${nome}`}>
      {/* fumaça saindo do escapamento, atrás do para-choque traseiro (só em movimento) */}
      <g className="fumaca" aria-hidden="true">
        <circle cx="10" cy="372" r="16" />
        <circle cx="-22" cy="360" r="22" />
        <circle cx="-60" cy="345" r="28" />
      </g>
      <g className="carroceria">
        <image href={ARTE} x="0" y="0" width={ARTE_W} height={ARTE_H} preserveAspectRatio="xMidYMid meet" />
      </g>
    </svg>
  );
}

function Loja({ logo }: { logo: string }) {
  return (
    <svg className="cena-loja" viewBox="0 0 120 110" aria-hidden="true">
      <rect x="8" y="34" width="104" height="72" fill="#FFFFFF" stroke="#C9D4E8" strokeWidth="2" />
      <path d="M2 36 L14 12 H106 L118 36 Z" fill="#0F3E86" />
      <path d="M2 36 h116 v8 H2z" fill="#F5B623" />
      <rect x="44" y="64" width="32" height="42" fill="#0F3E86" />
      <rect x="16" y="56" width="20" height="18" fill="#CFE0FA" />
      <rect x="84" y="56" width="20" height="18" fill="#CFE0FA" />
      <image href={logo} x="49" y="15" width="22" height="18" preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}

function Casa() {
  return (
    <svg className="cena-casa" viewBox="0 0 110 110" aria-hidden="true">
      <path d="M10 52 L55 14 L100 52" fill="none" stroke="#C2362B" strokeWidth="8" strokeLinejoin="round" />
      <rect x="20" y="50" width="70" height="56" fill="#FFF7E6" stroke="#E7C98A" strokeWidth="2" />
      <rect x="47" y="72" width="18" height="34" fill="#8A5A2B" />
      <rect x="28" y="62" width="14" height="14" fill="#CFE0FA" />
      <rect x="70" y="62" width="14" height="14" fill="#CFE0FA" />
    </svg>
  );
}

/** Estrada com a loja à esquerda, a casa do cliente à direita e o caminhão na posição atual. */
export function CenaEntrega({ progresso, andando, logo = '/logo.jpg', nome, entregue }: {
  progresso: number; andando: boolean; logo?: string; nome?: string; entregue?: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progresso)) * 1000) / 10;
  return (
    <div className={`cena${andando ? ' em-rota' : ''}${entregue ? ' concluida' : ''}`}>
      <div className="cena-ceu" aria-hidden="true">
        <span className="nuvem n1" /><span className="nuvem n2" /><span className="nuvem n3" />
      </div>
      <Loja logo={logo} />
      <Casa />
      {entregue && <span className="cena-check" aria-hidden="true">✓</span>}
      <div className="cena-estrada" aria-hidden="true">
        <div className="cena-faixa" />
        <div className="cena-feito" style={{ width: `${pct}%` }} />
      </div>
      <div className="cena-veiculo" style={{ left: `${pct}%` }}>
        <Caminhao logo={logo} andando={andando} nome={nome} />
      </div>
    </div>
  );
}
