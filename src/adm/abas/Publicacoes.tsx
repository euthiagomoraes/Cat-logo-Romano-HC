import { useCallback, useEffect, useState } from 'react';
import type { Publicacao } from '../../lib/types';
import { listarPublicacoes, republicar } from '../../lib/api';
import { dataHora } from '../../lib/format';
import { Icon } from '../../lib/icons';
import { Aviso, BotaoConfirmar } from '../ui';

export default function AbaPublicacoes({ publicadoEm, onRepublicado }: { publicadoEm: string | null; onRepublicado: () => void }) {
  const [lista, setLista] = useState<Publicacao[] | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);

  const carregar = useCallback(() => {
    setErro('');
    listarPublicacoes().then(setLista, (e: Error) => setErro(e.message));
  }, []);
  // recarrega quando o rascunho é publicado de novo
  useEffect(carregar, [carregar, publicadoEm]);

  const voltar = async (id: number) => {
    setOcupado(id);
    try {
      await republicar(id);
      onRepublicado();
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className="aba">
      <div className="aba-head">
        <div>
          <h1>Publicações</h1>
          <p className="hint">Cada publicação fica guardada. Se algo saiu errado, coloque uma versão anterior de volta no ar; o rascunho não é alterado.</p>
        </div>
        <a className="btn" href="/home" target="_blank" rel="noopener noreferrer"><Icon name="external" /> Abrir /home</a>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!lista && !erro && <p className="hint">Carregando…</p>}
      {lista && lista.length === 0 && <p className="lista-vazia">Nada publicado ainda. Use o botão Publicar no topo para colocar o catálogo no ar.</p>}
      {lista && lista.length > 0 && (
        <div className="lista">
          {lista.map((p, i) => (
            <div className="pub-linha" key={p.id}>
              <div className="pub-meta">
                <b>Versão nº {p.id} {i === 0 && <span className="etiqueta ok">No ar</span>}</b>
                <span className="hint">{dataHora(p.publicado_em)} · {p.publicado_por_nome || '—'}</span>
                {p.observacao && <span>{p.observacao}</span>}
              </div>
              {i > 0 && (
                <BotaoConfirmar className="btn" pergunta="Colocar esta versão no ar?" sim="Sim, voltar" onConfirmar={() => voltar(p.id)}>
                  <Icon name="history" /> {ocupado === p.id ? 'Voltando…' : 'Voltar para esta versão'}
                </BotaoConfirmar>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
