import type { Banner, Estilo, Rascunho } from '../../lib/types';
import type { Alterar } from '../Editor';
import { Icon } from '../../lib/icons';
import { novoId } from '../../lib/format';
import { BotaoConfirmar, Campo, Marcar, SeletorImagem } from '../ui';

interface Props { rascunho: Rascunho; alterar: Alterar }

export default function AbaBanners({ rascunho, alterar }: Props) {
  const mudar = (id: string, campos: Partial<Banner>) =>
    alterar((d) => { const b = d.banners.find((x) => x.id === id); if (b) Object.assign(b, campos); });

  const mover = (i: number, dir: number) => alterar((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.banners.length) return;
    [d.banners[i], d.banners[j]] = [d.banners[j], d.banners[i]];
  });

  const novo = () => alterar((d) => {
    d.banners.push({
      id: novoId(), ativo: true, estilo: 'azul', selo: 'Novidade', titulo: 'Título do banner',
      subtitulo: 'Escreva aqui a oferta ou o recado para o cliente.', destaque: '', cta: 'Ver ofertas', link: '#ofertas', imagem_url: null,
    });
  });

  const destinos: [string, string][] = [
    ['#ofertas', 'Ofertas da semana'], ['#destaques', 'Mais procurados'], ['#catalogo', 'Catálogo completo'],
    ...rascunho.categorias.map((c) => [`cat:${c.id}`, `Departamento: ${c.nome}`] as [string, string]),
    ['whatsapp', 'Abrir conversa no WhatsApp'],
  ];

  return (
    <section className="aba">
      <div className="aba-head">
        <div>
          <h1>Banners</h1>
          <p className="hint">Aparecem no carrossel do topo, nesta ordem. Sem imagem, o banner usa as barras diagonais da marca. Imagem ideal: 1200 × 600 px.</p>
        </div>
        <button className="btn sun" onClick={novo}><Icon name="plus" /> Novo banner</button>
      </div>

      {rascunho.banners.length === 0 && <p className="lista-vazia">Nenhum banner. O carrossel fica escondido no site até você criar um.</p>}

      {rascunho.banners.map((b, i) => (
        <div className={`caixa${b.ativo ? '' : ' oculto'}`} key={b.id}>
          <div className="caixa-head">
            <h2>Banner {i + 1}{b.ativo ? '' : ' (oculto)'}</h2>
            <div className="row-act">
              <button className="btn icon" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para cima"><Icon name="up" /></button>
              <button className="btn icon" onClick={() => mover(i, 1)} disabled={i === rascunho.banners.length - 1} aria-label="Mover para baixo"><Icon name="down" /></button>
              <BotaoConfirmar className="btn icon danger" rotuloAria="Excluir banner" pergunta="Excluir banner?"
                onConfirmar={() => alterar((d) => { d.banners = d.banners.filter((x) => x.id !== b.id); })}>
                <Icon name="trash" />
              </BotaoConfirmar>
            </div>
          </div>
          <Marcar rotulo="Mostrar no carrossel" valor={b.ativo} onValor={(v) => mudar(b.id, { ativo: v })} />
          <div className="grade-campos">
            <Campo rotulo="Chamada pequena"><input value={b.selo} placeholder="Ex.: Semana da Obra" onChange={(e) => mudar(b.id, { selo: e.target.value })} /></Campo>
            <Campo rotulo="Selo redondo"><input value={b.destaque} placeholder="Ex.: até 15% off" onChange={(e) => mudar(b.id, { destaque: e.target.value })} /></Campo>
            <Campo rotulo="Título" full><input value={b.titulo} onChange={(e) => mudar(b.id, { titulo: e.target.value })} /></Campo>
            <Campo rotulo="Texto" full><textarea rows={2} value={b.subtitulo} onChange={(e) => mudar(b.id, { subtitulo: e.target.value })} /></Campo>
            <Campo rotulo="Texto do botão" dica="Deixe vazio para esconder o botão."><input value={b.cta} onChange={(e) => mudar(b.id, { cta: e.target.value })} /></Campo>
            <Campo rotulo="O botão leva para">
              <select value={b.link} onChange={(e) => mudar(b.id, { link: e.target.value })}>
                {!destinos.some(([v]) => v === b.link) && <option value={b.link}>Destino removido — escolha outro</option>}
                {destinos.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Cores">
              <select value={b.estilo} onChange={(e) => mudar(b.id, { estilo: e.target.value as Estilo })}>
                <option value="azul">Azul da marca</option>
                <option value="amarelo">Amarelo da marca</option>
                <option value="escuro">Azul escuro</option>
              </select>
            </Campo>
          </div>
          <SeletorImagem url={b.imagem_url} onUrl={(u) => mudar(b.id, { imagem_url: u })} pasta="banners" larguraMax={1400} largo
            dica="Opcional. Aparece do lado direito, recortada na diagonal." />
        </div>
      ))}
    </section>
  );
}
