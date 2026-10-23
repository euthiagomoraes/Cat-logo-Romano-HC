import type { Rascunho } from '../../lib/types';
import type { Alterar } from '../Editor';
import { GLIFOS_DEPARTAMENTO, Icon } from '../../lib/icons';
import { novoId } from '../../lib/format';
import { BotaoConfirmar } from '../ui';

interface Props { rascunho: Rascunho; alterar: Alterar }

export default function AbaDepartamentos({ rascunho, alterar }: Props) {
  const mover = (i: number, dir: number) => alterar((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.categorias.length) return;
    [d.categorias[i], d.categorias[j]] = [d.categorias[j], d.categorias[i]];
  });

  return (
    <section className="aba">
      <div className="aba-head">
        <div>
          <h1>Departamentos</h1>
          <p className="hint">Aparecem no menu, nos atalhos e nos filtros do catálogo, nesta ordem. Só dá para excluir um departamento sem produtos.</p>
        </div>
        <button className="btn sun" onClick={() => alterar((d) => { d.categorias.push({ id: novoId(), nome: 'Novo departamento', icone: 'tag' }); })}>
          <Icon name="plus" /> Novo departamento
        </button>
      </div>

      <div className="lista">
        {rascunho.categorias.length === 0 && <p className="lista-vazia">Nenhum departamento cadastrado.</p>}
        {rascunho.categorias.map((c, i) => {
          const n = rascunho.produtos.filter((p) => p.categoria_id === c.id).length;
          return (
            <div className="depto-linha" key={c.id}>
              <span className="cat-ico pequeno"><Icon name={c.icone} /></span>
              <input className={`input${c.nome.trim() ? '' : ' bad'}`} aria-label="Nome do departamento" value={c.nome}
                onChange={(e) => alterar((d) => { const x = d.categorias.find((y) => y.id === c.id); if (x) x.nome = e.target.value; })} />
              <select className="input" aria-label="Ícone" value={c.icone}
                onChange={(e) => alterar((d) => { const x = d.categorias.find((y) => y.id === c.id); if (x) x.icone = e.target.value; })}>
                {GLIFOS_DEPARTAMENTO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <div className="row-act">
                <span className="hint">{n} {n === 1 ? 'produto' : 'produtos'}</span>
                <button className="btn icon" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para cima"><Icon name="up" /></button>
                <button className="btn icon" onClick={() => mover(i, 1)} disabled={i === rascunho.categorias.length - 1} aria-label="Mover para baixo"><Icon name="down" /></button>
                {n === 0 ? (
                  <BotaoConfirmar className="btn icon danger" rotuloAria={`Excluir ${c.nome}`}
                    onConfirmar={() => alterar((d) => { d.categorias = d.categorias.filter((x) => x.id !== c.id); })}>
                    <Icon name="trash" />
                  </BotaoConfirmar>
                ) : (
                  <button className="btn icon" disabled title="Mova ou exclua os produtos antes" aria-label="Exclusão indisponível: há produtos neste departamento"><Icon name="trash" /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
