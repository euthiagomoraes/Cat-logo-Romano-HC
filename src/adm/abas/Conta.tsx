import { useState, type FormEvent } from 'react';
import type { Administrador } from '../../lib/types';
import { admins } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Aviso, Campo } from '../ui';

export default function AbaConta({ eu, onAtualizado }: { eu: Administrador; onAtualizado: (a: Administrador) => void }) {
  const [nome, setNome] = useState(eu.nome);
  const [msgNome, setMsgNome] = useState<{ tipo: 'ok' | 'erro'; t: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'ok' | 'erro'; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const salvarNome = async (e: FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    try {
      await admins.atualizar(eu.user_id, { nome: nome.trim() });
      onAtualizado({ ...eu, nome: nome.trim() });
      setMsgNome({ tipo: 'ok', t: 'Nome atualizado.' });
    } catch (err) {
      setMsgNome({ tipo: 'erro', t: (err as Error).message });
    } finally {
      setOcupado(false);
    }
  };

  const salvarSenha = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) return setMsgSenha({ tipo: 'erro', t: 'A senha precisa ter pelo menos 8 caracteres.' });
    if (senha !== conf) return setMsgSenha({ tipo: 'erro', t: 'As duas senhas não são iguais.' });
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) setMsgSenha({ tipo: 'erro', t: error.message.includes('different') ? 'A nova senha precisa ser diferente da atual.' : 'Não foi possível trocar a senha. Tente de novo.' });
    else { setSenha(''); setConf(''); setMsgSenha({ tipo: 'ok', t: 'Senha trocada. Use a nova senha no próximo login.' }); }
  };

  return (
    <section className="aba">
      <div className="aba-head"><div><h1>Minha conta</h1><p className="hint">{eu.email} · {eu.papel === 'administrador' ? 'Administrador' : 'Editor'}</p></div></div>

      <form className="caixa" onSubmit={salvarNome}>
        <h2>Nome</h2>
        <p className="hint">Aparece no histórico de publicações.</p>
        <Campo rotulo="Seu nome"><input required value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        {msgNome && <Aviso tipo={msgNome.tipo}>{msgNome.t}</Aviso>}
        <div className="row-act"><button className="btn primary" disabled={ocupado || !nome.trim() || nome.trim() === eu.nome}>Salvar nome</button></div>
      </form>

      <form className="caixa" onSubmit={salvarSenha}>
        <h2>Trocar senha</h2>
        <div className="grade-campos">
          <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres."><input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
          <Campo rotulo="Repita a nova senha"><input type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} /></Campo>
        </div>
        {msgSenha && <Aviso tipo={msgSenha.tipo}>{msgSenha.t}</Aviso>}
        <div className="row-act"><button className="btn primary" disabled={ocupado || !senha}>Trocar senha</button></div>
      </form>
    </section>
  );
}
