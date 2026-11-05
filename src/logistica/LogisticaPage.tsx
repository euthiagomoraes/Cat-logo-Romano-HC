import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { meuCadastro } from '../lib/api';
import type { Administrador } from '../lib/types';
import { Icon } from '../lib/icons';
import { FormLogin } from '../adm/AdmPage';
import PainelLogistica from './PainelLogistica';
import { fonteSupabase } from './fonte';
import { fonteDemo } from './demo';

export const podeLogistica = (a: Administrador | null) => Boolean(a?.ativo && (a.papel === 'administrador' || a.papel === 'logistica'));

/** /logistica/demo — sem login e sem banco, para conferir as telas. */
export function LogisticaDemoPage() {
  return <PainelLogistica fonte={fonteDemo} usuario={{ nome: 'Demonstração', papel: 'logistica' }} />;
}

type Fase = 'carregando' | 'login' | 'sem-acesso' | 'painel';

export default function LogisticaPage() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [cad, setCad] = useState<Administrador | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => { document.title = 'Logística · ROMANO'; }, []);

  const avaliar = useCallback(async (s: Session | null) => {
    if (!s) { setCad(null); setFase('login'); return; }
    setEmail(s.user.email ?? '');
    const c = await meuCadastro(s.user.id);
    setCad(c);
    setFase(podeLogistica(c) ? 'painel' : 'sem-acesso');
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') {
        window.setTimeout(() => { void avaliar(s); }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [avaliar]);

  const sair = () => { void supabase.auth.signOut(); };

  if (fase === 'painel' && cad) {
    return <PainelLogistica fonte={fonteSupabase} usuario={{ nome: cad.nome || cad.email, papel: cad.papel }} onSair={sair} />;
  }

  return (
    <div className="login">
      <aside className="login-marca">
        <svg className="login-barras" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <polygon points="40,0 120,0 420,600 340,600" fill="rgba(255,255,255,.9)" />
          <polygon points="160,0 270,0 570,600 460,600" fill="#F5B623" />
          <polygon points="300,0 370,0 670,600 600,600" fill="rgba(255,255,255,.9)" />
        </svg>
        <div className="login-marca-txt">
          <img src="/logo.jpg" alt="" />
          <h1>Logística</h1>
          <p>Receba os pedidos pagos, separe, despache e acompanhe as entregas em tempo real.</p>
        </div>
      </aside>
      <main className="login-form">
        <div className="login-caixa">
          {fase === 'carregando' && <p className="hint">Carregando…</p>}
          {fase === 'login' && (
            <div className="login-bloco">
              <div><h2>Entrar na logística</h2><p className="hint">Use o e-mail e a senha cadastrados pelo administrador.</p></div>
              <FormLogin />
            </div>
          )}
          {fase === 'sem-acesso' && (
            <div className="login-bloco">
              <div><h2>Sem acesso à logística</h2></div>
              <p className="hint">A conta <b>{email}</b> não tem acesso ao painel de logística. Peça a um administrador para mudar o tipo de acesso para “Logística”.</p>
              {cad?.ativo && (cad.papel === 'editor') && <a className="btn" href="/adm"><Icon name="edit" /> Ir para o editor do catálogo</a>}
              <button className="btn" onClick={sair}><Icon name="logout" /> Sair e entrar com outra conta</button>
            </div>
          )}
          <a className="login-link" href="/logistica/demo"><Icon name="eye" /> Ver a demonstração sem login</a>
        </div>
      </main>
    </div>
  );
}
