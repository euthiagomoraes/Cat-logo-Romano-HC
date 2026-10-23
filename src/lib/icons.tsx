const IC: Record<string, string> = {
  cimento: '<path d="M6 4h12l1.5 3L18 20H6L4.5 7z"/><path d="M4.5 7h15"/><path d="M9 12h6M9 15h4"/>',
  tinta: '<path d="M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M5 8c0-2.2 3.1-3.5 7-3.5s7 1.3 7 3.5"/><path d="M9 4.6V3.5h6v1.1"/><path d="M8 13h8v4H8z"/>',
  ferramentas: '<path d="M13 4.5 19.5 11l-2 2L11 6.5z"/><path d="m12.2 7.7-8 8a2.1 2.1 0 0 0 3 3l8-8"/>',
  eletrica: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  hidraulica: '<path d="M3.5 10H13a3 3 0 0 1 3 3v1.5"/><path d="M3.5 7v6"/><path d="M8 10V6M5.5 6h5"/><path d="M16 18v.5M16 21v.5"/>',
  pisos: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  banheiro: '<path d="M5 21V8a4 4 0 0 1 8 0"/><path d="M9.5 10h7"/><path d="M11 14v1M13 14v2M15 14v1M12 18v1M14 18v1"/>',
  jardim: '<path d="M12 21v-9"/><path d="M12 12C12 7.5 8.5 5 4 5c0 4.2 3.2 7 8 7z"/><path d="M12 15c0-4 3-6.5 8-6.5 0 4-3.3 6.5-8 6.5z"/>',
  casa: '<path d="M3 12 12 4l9 8"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>',
  madeira: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v10M3 12h4M11 10c2 0 3 1 3 2s-1 2-3 2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  store: '<path d="M5 11v9h14v-9"/><path d="M3 9l2-5h14l2 5z"/><path d="M10 20v-5h4v5"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M9 10.5c.3 1.6 1.9 3.3 3.6 3.8"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  rocket: '<path d="M12 15c4-2 7-6 7-11-5 0-9 3-11 7"/><path d="m8 11-3 1-2 3h4M12 15l-1 3-3 2v-4"/><circle cx="14.5" cy="8.5" r="1.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v4h16v-4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
};

export const GLIFOS_DEPARTAMENTO: [string, string][] = [
  ['cimento', 'Saco de cimento'], ['tinta', 'Lata de tinta'], ['ferramentas', 'Martelo'],
  ['eletrica', 'Lâmpada'], ['hidraulica', 'Torneira'], ['pisos', 'Piso'], ['banheiro', 'Chuveiro'],
  ['jardim', 'Planta'], ['casa', 'Casa'], ['madeira', 'Madeira'], ['tag', 'Etiqueta'],
];

export const ICONES_SERVICO: [string, string][] = [
  ['truck', 'Caminhão'], ['store', 'Loja'], ['card', 'Cartão'], ['chat', 'Conversa'],
  ['shield', 'Garantia'], ['clock', 'Relógio'], ['tag', 'Etiqueta'],
];

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      className={`ico ${className ?? ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: IC[name] ?? IC.tag }}
    />
  );
}
