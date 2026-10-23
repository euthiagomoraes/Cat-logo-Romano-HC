import { Link, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './home/HomePage';
import AdmPage from './adm/AdmPage';
import { supabaseConfigurado } from './lib/supabase';

export default function App() {
  if (!supabaseConfigurado) {
    return (
      <div className="estado">
        <div>
          <img src="/logo.jpg" alt="" />
          <h1>Falta configurar o Supabase</h1>
          <p>
            Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente
            (arquivo <code>.env.local</code> ou painel da Vercel) e faça um novo deploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/adm" element={<AdmPage />} />
      <Route
        path="*"
        element={
          <div className="estado">
            <div>
              <img src="/logo.jpg" alt="" />
              <h1>Página não encontrada</h1>
              <p>O endereço que você abriu não existe.</p>
              <Link className="btn primary" to="/home">Ir para o catálogo</Link>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
