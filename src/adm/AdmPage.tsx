import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { admins, meuCadastro } from '../lib/api';
import type { Administrador } from '../lib/types';
import { Icon } from '../lib/icons';
import { Aviso, Campo } from './ui';
import Editor from './Editor';

type Fase = 'carregando' | 'login' | 'primeiro' | 'esqueci' | 'nova-senha' | 'sem-acesso' | 'editor';

export default function AdmPage() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [admin, setAdmin] = useState<Administrador | null>(null);
  const [email, setEmail] = useState('');
  const recuperando = useRef(false);

  useEffect(() => { document.title = 'Editor do catálogo'; }, []);

  const avaliar = useCallback(async (s: Session | null) => {
    if (recuperando.current) return;
    if (!s) {
      setAdmin(null);
      try {
        const st = await admins.status();
        setFase(st.primeiro_acesso ? 'primeiro' : 'login');
      } catch {
        setFase('login');
      }
      return;
    }
    setEmail(s.user.email ?? '');
    const cad = await meuCadastro(s.user.id);
    if (!cad || !cad.ativo) {
      setAdmin(null);
      setFase('sem-acesso');
      return;
    }
    setAdmin(cad);
    setFase('editor');
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') {
        recuperando.current = true;
        setFase('nova-senha');
        return;
      }
      if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') {
        // Fora do callback, para não travar o cliente do Supabase
        window.setTimeout(() => { void avaliar(s); }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [avaliar]);

  const sair = async () => {
    recuperando.current = false;
    await supabase.auth.signOut();
  };

  if (fase === 'editor' && admin) {
    return <Editor admin={admin} onSair={sair} onAdminAtualizado={setAdmin} />;
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
          <h1>Editor do catálogo</h1>
          <p>Atualize preços, fotos e banners. As mudanças só vão para o site quando você publicar.</p>
        </div>
      </aside>
      <main className="login-form">
        <div className="login-caixa">
          {fase === 'carregando' && <p className="hint">Carregando…</p>}
          {fase === 'login' && <Login onEsqueci={() => setFase('esqueci')} />}
          {fase === 'esqueci' && <Esqueci onVoltar={() => setFase('login')} />}
          {fase === 'primeiro' && <PrimeiroAcesso />}
          {fase === 'nova-senha' && (
            <NovaSenha
              onConcluir={async () => {
                recuperando.current = false;
                const { data } = await supabase.auth.getSession();
                await avaliar(data.session);
              }}
            />
          )}
          {fase === 'sem-acesso' && (
            <Bloco titulo="Sem acesso ao editor">
              <p className="hint">A conta <b>{email}</b> não está cadastrada como administrador ou foi desativada. Peça acesso a um administrador da loja.</p>
              <button className="btn" onClick={sair}><Icon name="logout" /> Sair e entrar com outra conta</button>
            </Bloco>
          )}
          <a className="login-link" href="/home"><Icon name="left" /> Ver o catálogo publicado</a>
        </div>
      </main>
    </div>
  );
}

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <div className="login-bloco">
      <div><h2>{titulo}</h2>{sub && <p className="hint">{sub}</p>}</div>
      {children}
    </div>
  );
}

function Login({ onEsqueci }: { onEsqueci: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente de novo.');
  };

  return (
    <Bloco titulo="Entrar" sub="Use o e-mail e a senha cadastrados pelo administrador.">
      <form className="login-campos" onSubmit={entrar}>
        <Campo rotulo="E-mail"><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        <Campo rotulo="Senha"><input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="btn primary lg" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="btn ghost" onClick={onEsqueci}>Esqueci minha senha</button>
      </form>
    </Bloco>
  );
}

function Esqueci({ onVoltar }: { onVoltar: () => void }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/adm` });
    setEnviando(false);
    if (error) setErro(error.message.includes('rate limit') ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' : 'Não foi possível enviar o e-mail. Tente de novo.');
    else setEnviado(true);
  };

  return (
    <Bloco titulo="Recuperar senha" sub="Enviamos um link para você criar uma senha nova.">
      {enviado ? (
        <Aviso tipo="ok">Se <b>{email}</b> tiver acesso ao editor, o link chega em alguns minutos. Confira também a caixa de spam.</Aviso>
      ) : (
        <form className="login-campos" onSubmit={enviar}>
          <Campo rotulo="E-mail"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <button className="btn primary lg" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
        </form>
      )}
      <button type="button" className="btn ghost" onClick={onVoltar}><Icon name="left" /> Voltar para o login</button>
    </Bloco>
  );
}

function NovaSenha({ onConcluir }: { onConcluir: () => void }) {
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== conf) return setErro('As duas senhas não são iguais.');
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) setErro('Não foi possível salvar a senha. Peça um novo link e tente de novo.');
    else onConcluir();
  };

  return (
    <Bloco titulo="Criar senha nova">
      <form className="login-campos" onSubmit={salvar}>
        <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres."><input type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
        <Campo rotulo="Repita a senha"><input type="password" autoComplete="new-password" required value={conf} onChange={(e) => setConf(e.target.value)} /></Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="btn primary lg" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar e entrar'}</button>
      </form>
    </Bloco>
  );
}

function PrimeiroAcesso() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== conf) return setErro('As duas senhas não são iguais.');
    setErro('');
    setEnviando(true);
    try {
      await admins.primeiroAcesso(nome.trim(), email.trim(), senha);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw new Error('Cadastro criado. Faça login com o e-mail e a senha que você definiu.');
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <Bloco titulo="Primeiro acesso" sub="Ainda não há nenhum administrador. Crie a sua conta principal; depois você cadastra a equipe pelo editor.">
      <form className="login-campos" onSubmit={criar}>
        <Campo rotulo="Seu nome"><input required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <Campo rotulo="E-mail"><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        <Campo rotulo="Senha" dica="Mínimo de 8 caracteres."><input type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
        <Campo rotulo="Repita a senha"><input type="password" autoComplete="new-password" required value={conf} onChange={(e) => setConf(e.target.value)} /></Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="btn primary lg" disabled={enviando}>{enviando ? 'Criando…' : 'Criar conta de administrador'}</button>
      </form>
    </Bloco>
  );
}
