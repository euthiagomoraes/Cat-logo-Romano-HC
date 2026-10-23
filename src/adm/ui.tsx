import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../lib/icons';
import { num, parseBRL } from '../lib/format';
import { enviarImagem } from '../lib/api';

export function Campo({ rotulo, dica, full, children }: { rotulo: string; dica?: ReactNode; full?: boolean; children: ReactNode }) {
  return (
    <label className={`fld${full ? ' full' : ''}`}>
      <span>{rotulo}</span>
      {children}
      {dica && <small className="hint">{dica}</small>}
    </label>
  );
}

export function Marcar({ rotulo, valor, onValor }: { rotulo: string; valor: boolean; onValor: (v: boolean) => void }) {
  return (
    <label className="chk">
      <input type="checkbox" checked={valor} onChange={(e) => onValor(e.target.checked)} />
      {rotulo}
    </label>
  );
}

/** Campo de valor em reais. Aceita "1.299,90", "39,9" etc. e confirma ao sair do campo. */
export function CampoDinheiro({ valor, onValor, vazioPermitido, rotuloAria, className }: {
  valor: number; onValor: (v: number) => void; vazioPermitido?: boolean; rotuloAria?: string; className?: string;
}) {
  const formatar = (v: number) => (v ? num(v) : vazioPermitido ? '' : '0,00');
  const [txt, setTxt] = useState(formatar(valor));
  const foco = useRef(false);

  useEffect(() => {
    if (!foco.current) setTxt(formatar(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const invalido = Number.isNaN(parseBRL(txt));
  return (
    <input
      className={`${className ?? ''}${invalido ? ' bad' : ''}`}
      inputMode="decimal"
      value={txt}
      placeholder={vazioPermitido ? '—' : '0,00'}
      aria-label={rotuloAria}
      aria-invalid={invalido}
      onFocus={() => { foco.current = true; }}
      onChange={(e) => {
        setTxt(e.target.value);
        const v = parseBRL(e.target.value);
        if (!Number.isNaN(v) && v !== valor) onValor(v);
      }}
      onBlur={() => {
        foco.current = false;
        const v = parseBRL(txt);
        setTxt(formatar(Number.isNaN(v) ? valor : v));
      }}
    />
  );
}

export function SeletorImagem({ url, onUrl, pasta, larguraMax, icone = 'image', largo, dica }: {
  url: string | null; onUrl: (u: string | null) => void; pasta: 'produtos' | 'banners' | 'loja';
  larguraMax: number; icone?: string; largo?: boolean; dica?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const escolher = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro('');
    setEnviando(true);
    try {
      onUrl(await enviarImagem(arquivo, pasta, larguraMax));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="imgbox">
      <span className={`thumb${largo ? ' wide' : ''}`}>{url ? <img src={url} alt="" /> : <Icon name={icone} />}</span>
      <div className="imgbox-txt">
        <div className="row-act">
          <button type="button" className="btn" onClick={() => ref.current?.click()} disabled={enviando}>
            <Icon name="upload" />{enviando ? 'Enviando…' : url ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          {url && !enviando && <button type="button" className="btn danger" onClick={() => onUrl(null)}>Remover</button>}
        </div>
        {dica && <p className="hint">{dica}</p>}
        {erro && <p className="erro-txt">{erro}</p>}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void escolher(f); }}
      />
    </div>
  );
}

export function BotaoConfirmar({ onConfirmar, pergunta = 'Excluir?', sim = 'Sim', className = 'btn danger', rotuloAria, children }: {
  onConfirmar: () => void; pergunta?: string; sim?: string; className?: string; rotuloAria?: string; children: ReactNode;
}) {
  const [confirmando, setConfirmando] = useState(false);
  if (confirmando) {
    return (
      <span className="confirm">
        {pergunta}
        <button type="button" className="btn danger" onClick={() => { setConfirmando(false); onConfirmar(); }}>{sim}</button>
        <button type="button" className="btn" onClick={() => setConfirmando(false)}>Não</button>
      </span>
    );
  }
  return <button type="button" className={className} aria-label={rotuloAria} onClick={() => setConfirmando(true)}>{children}</button>;
}

export function Aviso({ tipo, children, onFechar }: { tipo: 'ok' | 'erro' | 'info'; children: ReactNode; onFechar?: () => void }) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <Icon name={tipo === 'ok' ? 'check' : tipo === 'erro' ? 'alert' : 'eye'} />
      <div className="aviso-txt">{children}</div>
      {onFechar && <button className="btn icon ghost" onClick={onFechar} aria-label="Fechar aviso"><Icon name="x" /></button>}
    </div>
  );
}

export function copiarTexto(texto: string) {
  return navigator.clipboard.writeText(texto);
}
