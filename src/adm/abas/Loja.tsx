import type { Loja, Rascunho, Servico } from '../../lib/types';
import type { Alterar } from '../Editor';
import { ICONES_SERVICO, Icon } from '../../lib/icons';
import { digitos, fmtTelefone, novoId } from '../../lib/format';
import { BotaoConfirmar, Campo, Marcar, SeletorImagem } from '../ui';

interface Props { rascunho: Rascunho; alterar: Alterar }

export default function AbaLoja({ rascunho, alterar }: Props) {
  const L = rascunho.loja;
  const mudar = (c: Partial<Loja>) => alterar((d) => { Object.assign(d.loja, c); });
  const mudarSvc = (id: string, c: Partial<Servico>) =>
    alterar((d) => { const s = d.servicos.find((x) => x.id === id); if (s) Object.assign(s, c); });
  const wa = digitos(L.whatsapp);
  const waOk = wa.length >= 12 && wa.startsWith('55');

  return (
    <section className="aba">
      <div className="aba-head"><div><h1>Dados da loja</h1><p className="hint">Nome, logo e contatos que aparecem no topo e no rodapé do site.</p></div></div>

      <div className="caixa">
        <h2>Identidade</h2>
        <SeletorImagem url={L.logo_url} onUrl={(u) => mudar({ logo_url: u })} pasta="loja" larguraMax={400}
          dica="Sem logo enviada, o site usa a logo padrão do projeto." />
        <div className="grade-campos">
          <Campo rotulo="Nome da loja"><input value={L.nome} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
          <Campo rotulo="Frase de apoio"><input value={L.slogan} onChange={(e) => mudar({ slogan: e.target.value })} /></Campo>
        </div>
        <Marcar rotulo="Mostrar o aviso “catálogo de demonstração” no topo do site" valor={L.mostrar_aviso_demo} onValor={(v) => mudar({ mostrar_aviso_demo: v })} />
      </div>

      <div className="caixa">
        <h2>Contato</h2>
        <div className="grade-campos">
          <Campo rotulo="WhatsApp (com 55 e DDD)" dica={L.whatsapp && !waOk ? <span className="erro-txt">Use o formato 55 + DDD + número, ex.: 5591999999999</span> : waOk ? `Aparece como ${fmtTelefone(L.whatsapp)}. Recebe os orçamentos e as dúvidas dos clientes.` : 'Recebe os orçamentos e as dúvidas dos clientes.'}>
            <input inputMode="tel" value={L.whatsapp} placeholder="5591999999999" onChange={(e) => mudar({ whatsapp: e.target.value })} />
          </Campo>
          <Campo rotulo="Telefone fixo"><input value={L.telefone} onChange={(e) => mudar({ telefone: e.target.value })} /></Campo>
          <Campo rotulo="Endereço" full><input value={L.endereco} onChange={(e) => mudar({ endereco: e.target.value })} /></Campo>
          <Campo rotulo="Horário de funcionamento" full><input value={L.horario} onChange={(e) => mudar({ horario: e.target.value })} /></Campo>
          <Campo rotulo="Aviso do rodapé" full><textarea rows={2} value={L.aviso} onChange={(e) => mudar({ aviso: e.target.value })} /></Campo>
        </div>
      </div>

      <div className="caixa">
        <div className="caixa-head">
          <h2>Faixa de serviços</h2>
          <button className="btn" onClick={() => alterar((d) => { d.servicos.push({ id: novoId(), icone: 'tag', titulo: 'Novo serviço', texto: '' }); })}>
            <Icon name="plus" /> Adicionar
          </button>
        </div>
        <p className="hint">Aparece no fim da página, antes do rodapé. Quatro itens costumam caber bem.</p>
        {rascunho.servicos.map((s) => (
          <div className="svc-linha" key={s.id}>
            <span className="cat-ico pequeno"><Icon name={s.icone} /></span>
            <div className="grade-campos">
              <Campo rotulo="Ícone">
                <select value={s.icone} onChange={(e) => mudarSvc(s.id, { icone: e.target.value })}>
                  {ICONES_SERVICO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Título"><input value={s.titulo} onChange={(e) => mudarSvc(s.id, { titulo: e.target.value })} /></Campo>
              <Campo rotulo="Texto" full><input value={s.texto} onChange={(e) => mudarSvc(s.id, { texto: e.target.value })} /></Campo>
            </div>
            <BotaoConfirmar className="btn icon danger" rotuloAria="Remover serviço" pergunta="Remover?"
              onConfirmar={() => alterar((d) => { d.servicos = d.servicos.filter((x) => x.id !== s.id); })}>
              <Icon name="trash" />
            </BotaoConfirmar>
          </div>
        ))}
      </div>
    </section>
  );
}
