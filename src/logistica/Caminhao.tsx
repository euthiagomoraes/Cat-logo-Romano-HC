import { useId } from 'react';

/**
 * Caminhão de entrega com a identidade da ROMANO: cabine azul, baú branco com as
 * faixas diagonais do logo (amarelo e branco) e o logo aplicado na lateral.
 * Rodas: duas atrás (sob o baú) e uma na frente (sob a cabine).
 */
const RODAS = [34, 72, 228];

export function Caminhao({ logo = '/logo.jpg', andando = false, nome = 'ROMANO', className = '' }: {
  logo?: string; andando?: boolean; nome?: string; className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const bau = `bau-${id}`;
  const lg = `lg-${id}`;

  return (
    <svg className={`caminhao${andando ? ' andando' : ''} ${className}`} viewBox="0 0 280 132" role="img" aria-label={`Caminhão de entrega ${nome}`}>
      <defs>
        <clipPath id={bau}><rect x="6" y="10" width="170" height="84" rx="7" /></clipPath>
        <clipPath id={lg}><rect x="20" y="24" width="50" height="50" rx="9" /></clipPath>
      </defs>

      {/* fumaça (só aparece em movimento) */}
      <g className="fumaca" aria-hidden="true">
        <circle cx="4" cy="104" r="5" />
        <circle cx="-6" cy="100" r="7" />
        <circle cx="-18" cy="96" r="9" />
      </g>

      <g className="carroceria">
        {/* baú */}
        <rect x="6" y="10" width="170" height="84" rx="7" fill="#FFFFFF" stroke="#C9D4E8" strokeWidth="2" />
        <g clipPath={`url(#${bau})`}>
          {/* faixas diagonais inspiradas no "R" */}
          <polygon points="142,10 162,10 212,94 192,94" fill="#F5B623" />
          <polygon points="168,10 178,10 228,94 218,94" fill="#0F3E86" opacity=".14" />
          <polygon points="120,10 129,10 179,94 170,94" fill="#0F3E86" opacity=".10" />
          <rect x="6" y="80" width="170" height="14" fill="#0F3E86" />
          <rect x="6" y="77" width="170" height="3" fill="#F5B623" />
        </g>
        {/* logo */}
        <rect x="18" y="22" width="54" height="54" rx="10" fill="#0F3E86" />
        <image href={logo} x="20" y="24" width="50" height="50" clipPath={`url(#${lg})`} preserveAspectRatio="xMidYMid slice" />
        {/* largura fixa: o nome sempre cabe antes da faixa amarela */}
        <text x="79" y="50" className="cam-nome" textLength={nome.length > 3 ? 70 : undefined} lengthAdjust="spacingAndGlyphs">{nome}</text>
        <text x="81" y="66" className="cam-sub">HOME CENTER</text>
        {/* na faixa azul, entre o para-lama traseiro e o fim do baú */}
        <text x="100" y="90.5" className="cam-entrega" textLength="70" lengthAdjust="spacingAndGlyphs">ENTREGA RÁPIDA</text>

        {/* cabine */}
        <path d="M180 30 h46 q6 0 9 5 l20 28 q3 4 9 5 q8 2 8 10 v22 h-92 z" fill="#0F3E86" />
        <path d="M190 37 h33 q3 0 5 3 l15 22 h-53 z" fill="#CFE0FA" />
        <path d="M190 37 h12 l-6 25 h-6 z" fill="#FFFFFF" opacity=".35" />
        <rect x="180" y="74" width="92" height="6" fill="#F5B623" />
        <rect x="200" y="66" width="12" height="3" rx="1.5" fill="#0A2C63" />
        <rect x="264" y="80" width="10" height="8" rx="2" fill="#FFE08A" className="farol" />
        <rect x="262" y="92" width="14" height="8" rx="2" fill="#0A2C63" />
        <rect x="176" y="22" width="4" height="72" fill="#0A2C63" />

        {/* chassi */}
        <rect x="6" y="94" width="266" height="8" rx="2" fill="#0A2C63" />

        {/* para-lamas: par traseiro e roda dianteira */}
        <path d="M12 96 a41 12 0 0 1 82 0 z" fill="#0A2C63" />
        <path d="M204 96 a24 12 0 0 1 48 0 z" fill="#0A2C63" />
      </g>

      {/* rodas: 2 atrás + 2 na frente */}
      {RODAS.map((cx) => (
        <g key={cx} className="roda" style={{ transformOrigin: `${cx}px 108px` }}>
          <circle cx={cx} cy="108" r="17" fill="#1A2233" />
          <circle cx={cx} cy="108" r="9" fill="#D8DFEB" />
          <path d={`M${cx - 9} 108 h18 M${cx} 99 v18`} stroke="#8D99B3" strokeWidth="2.5" />
          <circle cx={cx} cy="108" r="3" fill="#0F3E86" />
        </g>
      ))}
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
