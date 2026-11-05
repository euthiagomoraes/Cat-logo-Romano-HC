import { useEffect, useRef } from 'react';
import type { Rascunho } from '../../lib/types';
import { Icon } from '../../lib/icons';

/**
 * Gerador de placas de oferta (/cartaz.html) dentro do editor.
 * Ele roda isolado num iframe; o editor envia os produtos e os dados da loja
 * do rascunho atual para preencher as placas com um clique.
 */
export default function AbaCartazes({ rascunho }: { rascunho: Rascunho }) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const dados = useRef(rascunho);
  dados.current = rascunho;

  const enviar = () => {
    const r = dados.current;
    quadro.current?.contentWindow?.postMessage({
      tipo: 'romano-cartaz:catalogo',
      loja: { nome: r.loja.nome, whatsapp: r.loja.whatsapp || r.loja.telefone, endereco: r.loja.endereco, logo_url: r.loja.logo_url },
      produtos: r.produtos
        .filter((p) => p.ativo && p.nome.trim())
        .map((p) => ({
          sku: p.sku, nome: p.nome, unidade: p.unidade, marca: p.marca, preco: p.preco, preco_de: p.preco_de,
          destaque: p.destaque, foto_url: p.foto_url,
        })),
    }, window.location.origin);
  };

  // O gerador avisa quando terminou de carregar; aí recebe os dados
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === quadro.current?.contentWindow && e.data?.tipo === 'romano-cartaz:pronto') enviar();
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  // Produtos ou loja mudaram no editor: atualiza o gerador
  useEffect(() => { enviar(); }, [rascunho.produtos, rascunho.loja]);

  return (
    <section className="aba">
      <div className="aba-head">
        <div>
          <h1>Cartazes</h1>
          <p className="hint">
            Placas de oferta para imprimir na loja. Busque o produto do catálogo, escolha o modelo (inclusive Black Friday e Natal) e baixe em PNG, PDF ou imprima.
            Os preços usados são os do rascunho atual.
          </p>
        </div>
        <span className="cartaz-dica"><Icon name="print" />Imprima sempre em 100% / tamanho real</span>
      </div>
      <iframe ref={quadro} className="cartaz-quadro" src="/cartaz.html" title="Gerador de cartazes" />
    </section>
  );
}
