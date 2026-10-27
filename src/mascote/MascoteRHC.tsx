// Mascote RHC: entra andando pela esquerda, para e acena; em "Ver ofertas" faz 👍, mostra o balão
// do WhatsApp e sai correndo (quadros desenhados num <canvas>).
// O script original (mascote-rhc.js) é empacotado pelo Vite e as folhas WebP saem com hash no build.
import { useEffect, useRef } from 'react';
import './mascote-rhc.css';
import './mascote-rhc.js';
import quadros1 from './mascote-quadros-1.webp';
import quadros2 from './mascote-quadros-2.webp';
import quadros3 from './mascote-quadros-3.webp';
import saida1 from './mascote-saida-1.webp';
import saida2 from './mascote-saida-2.webp';
import saida3 from './mascote-saida-3.webp';
import saida4 from './mascote-saida-4.webp';
import saida5 from './mascote-saida-5.webp';

declare global {
  interface Window {
    RHCMascote?: { init(): void; repetir(): void; acenar(): void; fechar(): void; irParaOfertas(href?: string): void };
    RHCMascoteArquivos?: Record<string, string>;
  }
}

window.RHCMascoteArquivos = {
  'mascote-quadros-1.webp': quadros1,
  'mascote-quadros-2.webp': quadros2,
  'mascote-quadros-3.webp': quadros3,
  'mascote-saida-1.webp': saida1,
  'mascote-saida-2.webp': saida2,
  'mascote-saida-3.webp': saida3,
  'mascote-saida-4.webp': saida4,
  'mascote-saida-5.webp': saida5,
};

interface Props {
  titulo?: string;
  mensagem?: string;
  linkTexto?: string;
  /** Mostra o botão no balão; a página rola por aqui (sem recarregar) enquanto o mascote se despede. */
  onLink?: () => void;
  /** Texto do balão da saída. */
  whatsappMensagem?: string;
  /** Número com DDD (só dígitos ou formatado); mostra o botão "Chamar no WhatsApp" na saída. */
  whatsapp?: string;
  /** Mensagem que já chega digitada no WhatsApp. */
  whatsappTexto?: string;
  umaVezPorSessao?: boolean;
  atrasoMs?: number;
}

export default function MascoteRHC({
  titulo = 'Olá! 👋',
  mensagem = 'Confira as ofertas da semana.',
  linkTexto = 'Ver ofertas',
  onLink,
  whatsappMensagem = 'Nosso time de vendedores está no WhatsApp. Qualquer coisa, é só chamar! 💬',
  whatsapp,
  whatsappTexto,
  umaVezPorSessao = false,
  atrasoMs = 800,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const linkRef = useRef(onLink);
  linkRef.current = onLink;

  // O script só monta elementos ainda não montados, então chamar init() de novo (StrictMode) é seguro.
  useEffect(() => { window.RHCMascote?.init(); }, []);

  // "Ver ofertas": cancela a rolagem do script (que não desconta o cabeçalho fixo) e rola pela vitrine
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ofertas = (e: Event) => {
      if (!linkRef.current) return;
      e.preventDefault();
      linkRef.current();
    };
    el.addEventListener('rhcmascote:ofertas', ofertas);
    return () => el.removeEventListener('rhcmascote:ofertas', ofertas);
  }, []);

  return (
    <div
      ref={ref}
      data-rhc-mascote=""
      data-titulo={titulo}
      data-mensagem={mensagem}
      data-link={onLink ? '#ofertas' : undefined}
      data-link-texto={linkTexto}
      data-whatsapp-mensagem={whatsappMensagem}
      data-whatsapp={whatsapp || undefined}
      data-whatsapp-texto={whatsappTexto}
      data-atraso={atrasoMs}
      data-movimento="respeitar"
      {...(umaVezPorSessao ? { 'data-uma-vez': 'sessao' } : {})}
    />
  );
}
