import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Administrador, Papel } from '../../lib/types';
import { admins } from '../../lib/api';
import { dataHora, gerarSenha } from '../../lib/format';
import { Icon } from '../../lib/icons';
import { Aviso, BotaoConfirmar, Campo, copiarTexto } from '../ui';

const PAPEIS: Record<Papel, string> = {
  administrador: 'Administrador — edita, publica e gerencia a equipe',
  editor: 'Editor — edita e publica',
};

export default function AbaAdministradores({ eu }: { eu: Administrador }) {
  const gestor = eu.papel === 'administrador';
  const [lista, setLista] = useState<Administrador[] | null>(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);

  const carregar = useCallback(() => {
    admins.listar().then(setLista, (e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const executar = async (fn: () => Promise<unknown>, sucesso: string) => {
    setErro('');
    setOk('');
    try {
      await fn();
      setOk(sucesso);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <section className="aba">
      <div className="aba-head">
        <div>
          <h1>Administradores</h1>
          <p className="hint">Quem pode entrar em /adm. Clientes não precisam de cadastro: eles só acessam /home.</p>
        </div>
      </div>

      {!gestor && <Aviso tipo="info">Você é editor. Só administradores podem cadastrar ou alterar acessos.</Aviso>}
      {erro && <Aviso tipo="erro" onFechar={() => setErro('')}>{erro}</Aviso>}
      {ok && <Aviso tipo="ok" onFechar={() => setOk('')}>{ok}</Aviso>}
      {criado && (
        <Aviso tipo="ok" onFechar={() => setCriado(null)}>
          <b>Acesso criado.</b> Envie estes dados para a pessoa por um canal seguro; ela pode trocar a senha em “Minha conta”.
          <div className="credencial">
            <span>Endereço: <b className="sel">{window.location.origin}/adm</b></span>
            <span>E-mail: <b className="sel">{criado.email}</b></span>
            <span>Senha provisória: <b className="sel">{criado.senha}</b></span>
          </div>
          <button className="btn" onClick={() => void copiarTexto(`Acesso ao editor do catálogo\nEndereço: ${window.location.origin}/adm\nE-mail: ${criado.email}\nSenha provisória: ${criado.senha}`)}>
            <Icon name="copy" /> Copiar dados de acesso
          </button>
        </Aviso>
      )}

      {gestor && <NovoAdmin onCriado={(email, senha) => { setCriado({ email, senha }); setErro(''); carregar(); }} onErro={setErro} />}

      <div className="caixa">
        <h2>Equipe</h2>
        {!lista && !erro && <p className="hint">Carregando…</p>}
        <div className="lista">
          {lista?.map((a) => (
            <LinhaAdmin key={a.user_id} a={a} eu={eu} gestor={gestor} executar={executar} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NovoAdmin({ onCriado, onErro }: { onCriado: (email: string, senha: string) => void; onErro: (m: string) => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState(() => gerarSenha());
  const [papel, setPapel] = useState<Papel>('editor');
  const [enviando, setEnviando] = useState(false);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await admins.criar({ nome: nome.trim(), email: email.trim(), senha, papel });
      onCriado(email.trim(), senha);
      setNome(''); setEmail(''); setSenha(gerarSenha()); setPapel('editor');
    } catch (err) {
      onErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="caixa" onSubmit={criar}>
      <h2>Cadastrar administrador</h2>
      <div className="grade-campos">
        <Campo rotulo="Nome"><input required value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <Campo rotulo="E-mail"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        <Campo rotulo="Senha provisória" dica="Mínimo de 8 caracteres. Já vem uma senha gerada; você pode trocar.">
          <span className="campo-com-botao">
            <input required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button type="button" className="btn" onClick={() => setSenha(gerarSenha())}><Icon name="key" /> Gerar</button>
          </span>
        </Campo>
        <Campo rotulo="Tipo de acesso">
          <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            <option value="editor">{PAPEIS.editor}</option>
            <option value="administrador">{PAPEIS.administrador}</option>
          </select>
        </Campo>
      </div>
      <div className="row-act"><button className="btn primary" disabled={enviando}><Icon name="plus" />{enviando ? 'Cadastrando…' : 'Cadastrar'}</button></div>
    </form>
  );
}

function LinhaAdmin({ a, eu, gestor, executar }: {
  a: Administrador; eu: Administrador; gestor: boolean; executar: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
}) {
  const souEu = a.user_id === eu.user_id;
  const [novaSenha, setNovaSenha] = useState<string | null>(null);
  const podeMexer = gestor && !souEu;

  return (
    <div className={`adm-linha${a.ativo ? '' : ' oculto'}`}>
      <div className="adm-linha-meta">
        <b>{a.nome || a.email} {souEu && <span className="etiqueta">você</span>} {!a.ativo && <span className="etiqueta alerta">desativado</span>}</b>
        <span className="hint">{a.email} · último acesso: {dataHora(a.ultimo_acesso)}</span>
      </div>
      {podeMexer ? (
        <div className="row-act">
          <select className="input compacto" value={a.papel} aria-label={`Tipo de acesso de ${a.nome}`}
            onChange={(e) => void executar(() => admins.atualizar(a.user_id, { papel: e.target.value as Papel }), `Acesso de ${a.nome || a.email} atualizado.`)}>
            <option value="editor">Editor</option>
            <option value="administrador">Administrador</option>
          </select>
          <button className="btn" onClick={() => void executar(() => admins.atualizar(a.user_id, { ativo: !a.ativo }), a.ativo ? `${a.nome || a.email} não consegue mais entrar.` : `${a.nome || a.email} pode entrar de novo.`)}>
            {a.ativo ? 'Desativar' : 'Reativar'}
          </button>
          {novaSenha === null ? (
            <button className="btn" onClick={() => setNovaSenha(gerarSenha())}><Icon name="key" /> Nova senha</button>
          ) : (
            <span className="campo-com-botao">
              <input className="input compacto" value={novaSenha} aria-label="Nova senha" onChange={(e) => setNovaSenha(e.target.value)} />
              <button className="btn primary" onClick={() => { const s = novaSenha; setNovaSenha(null); void executar(() => admins.redefinirSenha(a.user_id, s), `Senha de ${a.nome || a.email} redefinida para: ${s}`); }}>Salvar</button>
              <button className="btn" onClick={() => setNovaSenha(null)}>Cancelar</button>
            </span>
          )}
          <BotaoConfirmar className="btn icon danger" rotuloAria={`Remover ${a.nome}`} pergunta="Remover o acesso?" sim="Remover"
            onConfirmar={() => void executar(() => admins.remover(a.user_id), `${a.nome || a.email} foi removido.`)}>
            <Icon name="trash" />
          </BotaoConfirmar>
        </div>
      ) : (
        <span className="etiqueta">{a.papel === 'administrador' ? 'Administrador' : 'Editor'}</span>
      )}
    </div>
  );
}
