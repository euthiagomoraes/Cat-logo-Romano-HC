import { useCallback, useEffect, useState } from 'react';
import Vitrine from './Vitrine';
import { carregarPublicado } from '../lib/api';
import type { CatalogoPublicado } from '../lib/types';

type Estado = { fase: 'carregando' } | { fase: 'ok'; dados: CatalogoPublicado } | { fase: 'vazio' } | { fase: 'erro'; msg: string };

export default function HomePage() {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  const carregar = useCallback(() => {
    setEstado({ fase: 'carregando' });
    carregarPublicado()
      .then((dados) => {
        if (!dados) return setEstado({ fase: 'vazio' });
        document.title = dados.loja.nome || 'Catálogo';
        setEstado({ fase: 'ok', dados });
      })
      .catch((e: Error) => setEstado({ fase: 'erro', msg: e.message }));
  }, []);

  useEffect(carregar, [carregar]);

  if (estado.fase === 'ok') return <Vitrine dados={estado.dados} />;
  if (estado.fase === 'carregando') return <Esqueleto />;

  return (
    <div className="estado">
      <div>
        <img src="/logo.jpg" alt="" />
        {estado.fase === 'vazio' ? (
          <>
            <h1>Catálogo em preparação</h1>
            <p>Estamos montando nossa vitrine digital. Volte em breve.</p>
          </>
        ) : (
          <>
            <h1>Não foi possível carregar</h1>
            <p>Verifique sua conexão e tente de novo.</p>
            <button className="btn primary" onClick={carregar}>Tentar de novo</button>
          </>
        )}
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="vitrine" aria-busy="true" aria-label="Carregando catálogo">
      <div className="hdr" style={{ position: 'static' }}>
        <div className="wrap hdr-in"><div className="marca"><img src="/logo.jpg" alt="" /></div></div>
      </div>
      <div className="wrap hero"><div className="esqueleto" style={{ height: 'clamp(300px, 32vw, 380px)' }} /></div>
      <div className="wrap sec">
        <div className="grade">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="esqueleto" style={{ aspectRatio: '3 / 4' }} />)}
        </div>
      </div>
    </div>
  );
}
