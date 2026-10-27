// Mascote RHC: entra andando pela esquerda, para e acena (quadros desenhados num <canvas>).
// O script original (mascote-rhc.js) é empacotado pelo Vite e as folhas WebP saem com hash no build.
import { useEffect, type MouseEvent } from 'react';
import './mascote-rhc.css';
import './mascote-rhc.js';
import quadros1 from './mascote-quadros-1.webp';
import quadros2 from './mascote-quadros-2.webp';
import quadros3 from './mascote-quadros-3.webp';

declare global {
  interface Window {
    RHCMascote?: { init(): void; repetir(): void; acenar(): void; fechar(): void };
    RHCMascoteArquivos?: Record<string, string>;
  }
}

window.RHCMascoteArquivos = {
  'mascote-quadros-1.webp': quadros1,
  'mascote-quadros-2.webp': quadros2,
  'mascote-quadros-3.webp': quadros3,
};

interface Props {
  titulo?: string;
  mensagem?: string;
  linkTexto?: string;
  /** Mostra o botão no balão; o clique é tratado aqui (sem recarregar a página). */
  onLink?: () => void;
  umaVezPorSessao?: boolean;
  atrasoMs?: number;
}

export default function MascoteRHC({
  titulo = 'Olá! 👋',
  mensagem = 'Confira as ofertas da semana.',
  linkTexto = 'Ver ofertas',
  onLink,
  umaVezPorSessao = false,
  atrasoMs = 800,
}: Props) {
  // O script só monta elementos ainda não montados, então chamar init() de novo (StrictMode) é seguro.
  useEffect(() => { window.RHCMascote?.init(); }, []);

  const clicar = (e: MouseEvent) => {
    if (!onLink || !(e.target as HTMLElement).closest('.rhc-mascote__balao a')) return;
    e.preventDefault();
    onLink();
  };

  return (
    <div
      onClick={clicar}
      data-rhc-mascote=""
      data-titulo={titulo}
      data-mensagem={mensagem}
      data-link={onLink ? '#ofertas' : undefined}
      data-link-texto={linkTexto}
      data-atraso={atrasoMs}
      data-movimento="respeitar"
      {...(umaVezPorSessao ? { 'data-uma-vez': 'sessao' } : {})}
    />
  );
}
