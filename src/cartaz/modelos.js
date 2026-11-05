/*
 * Modelos prontos de placas da ROMANO.
 * Posições e tamanhos em % da placa, então o mesmo modelo serve para qualquer formato.
 * As imagens do mascote ficam em /public/cartaz (endereço fixo), para que cópias
 * salvas no navegador continuem funcionando depois de um novo deploy.
 */

export const uid = () => Math.random().toString(36).slice(2, 9);

export const LOGO_PADRAO = '/logo.jpg';

export const MASCOTES = [
  { id: 'acenando', nome: 'Acenando', src: '/cartaz/mascote-acenando.png' },
  { id: 'joinha', nome: 'Joinha', src: '/cartaz/mascote-joinha.png' },
  { id: 'natal-acenando', nome: 'Natal · acenando', src: '/cartaz/mascote-natal-acenando.png' },
  { id: 'natal-joinha', nome: 'Natal · joinha', src: '/cartaz/mascote-natal-joinha.png' },
];
const M = Object.fromEntries(MASCOTES.map((m) => [m.id, m.src]));
export const ehMascote = (src) => typeof src === 'string' && src.startsWith('/cartaz/mascote-');

/* Cores da marca */
const AZUL = '#0F3E86', AZUL_ESC = '#0A2C63', AMARELO = '#F5B623', TINTA = '#12213F', CINZA = '#5B6A86', VERMELHO = '#D6001C';

export const TX = (o) => Object.assign({ id: uid(), type: 'text', visible: true, rot: 0, text: '', font: 'Oswald', weight: 600, color: '#111111', align: 'center', maxLines: 1, upper: false, strike: false, strikeColor: '', requireDe: false }, o);
export const PR = (o) => Object.assign({ id: uid(), type: 'price', visible: true, rot: 0, field: 'por', font: 'Anton', weight: 400, color: AZUL, symColor: '', align: 'center', showSym: true, suffix: '', requireDe: false }, o);
export const SH = (o) => Object.assign({ id: uid(), type: 'shape', visible: true, rot: 0, shape: 'rect', fill: AZUL, noFill: false, stroke: '#111111', strokeW: 0, radius: 0, points: 16, inner: 0.8, c2: '#111111', stripe: 4, requireDe: false }, o);
export const IM = (o) => Object.assign({ id: uid(), type: 'image', visible: true, rot: 0, src: '', useLogo: false, useFoto: false, fit: 'contain', opacity: 1, requireDe: false }, o);

/* Flocos de neve (círculos; a altura compensa o formato retrato A4) */
const neve = (pontos) => pontos.map(([x, y, w]) => SH({ x, y, w, h: w * 0.707, shape: 'ellipse', fill: '#FFFFFF' }));

export function builtins() {
  return [
    {
      id: 'classica', name: 'Oferta ROMANO', builtin: true, orient: 'retrato',
      bg: { c1: '#FFFFFF', c2: '#E6EEFA', gradient: true, img: '' },
      layers: [
        SH({ x: 0, y: 0, w: 100, h: 15, fill: AZUL }),
        SH({ x: 0, y: 15, w: 100, h: 2.2, shape: 'stripes', fill: AMARELO, c2: AZUL, stripe: 2.5 }),
        TX({ x: 4, y: 2, w: 56, h: 11, text: 'OFERTA', font: 'Anton', weight: 400, color: '#FFFFFF', align: 'left' }),
        IM({ x: 82, y: 2.3, w: 14, h: 10.4, useLogo: true }),
        TX({ x: 5, y: 20, w: 60, h: 18, text: '{descricao}', font: 'Archivo Black', weight: 400, color: AZUL, align: 'left', maxLines: 3, upper: true }),
        TX({ x: 5, y: 38.5, w: 60, h: 4.5, text: '{unidade}', font: 'Oswald', weight: 500, color: CINZA, align: 'left' }),
        TX({ x: 5, y: 45, w: 37, h: 6, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: TINTA, align: 'left', strike: true, strikeColor: VERMELHO, requireDe: true }),
        TX({ x: 5, y: 52, w: 37, h: 5, text: 'POR APENAS', font: 'Oswald', weight: 700, color: VERMELHO, align: 'left' }),
        SH({ x: 45, y: 43, w: 20, h: 14, shape: 'burst', fill: AMARELO, points: 16, inner: 0.8, requireDe: true }),
        TX({ x: 47.5, y: 46.4, w: 15, h: 7.2, text: '-{pct}%', font: 'Anton', weight: 400, color: AZUL, requireDe: true }),
        IM({ x: 67, y: 18, w: 31, h: 40, src: M.acenando }),
        PR({ x: 4, y: 59, w: 92, h: 28, color: AZUL }),
        SH({ x: 0, y: 90, w: 100, h: 10, fill: AZUL }),
        TX({ x: 4, y: 91.6, w: 92, h: 6.8, text: '{validade}', font: 'Oswald', weight: 500, color: AMARELO, maxLines: 2 }),
      ],
    },
    {
      id: 'obra', name: 'Faixa de Obra', builtin: true, orient: 'retrato',
      bg: { c1: '#FFFFFF', c2: '#EEEEEE', gradient: false, img: '' },
      layers: [
        SH({ x: 0, y: 0, w: 100, h: 7, shape: 'stripes', fill: AMARELO, c2: TINTA, stripe: 4 }),
        SH({ x: 0, y: 93, w: 100, h: 7, shape: 'stripes', fill: AMARELO, c2: TINTA, stripe: 4 }),
        TX({ x: 5, y: 9.5, w: 90, h: 9, text: 'PREÇO BAIXO NA OBRA', font: 'Anton', weight: 400, color: AZUL }),
        TX({ x: 6, y: 20.5, w: 88, h: 15, text: '{descricao}', font: 'Archivo Black', weight: 400, color: TINTA, maxLines: 3, upper: true }),
        TX({ x: 6, y: 36, w: 88, h: 4.5, text: '{unidade}', font: 'Oswald', weight: 500, color: CINZA }),
        SH({ x: 5, y: 43, w: 64, h: 41, fill: AMARELO, radius: 3 }),
        TX({ x: 8, y: 45.5, w: 40, h: 6.5, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: TINTA, align: 'left', strike: true, strikeColor: VERMELHO, requireDe: true }),
        TX({ x: 50, y: 45.5, w: 16, h: 6.5, text: 'por', font: 'Oswald', weight: 600, color: TINTA, align: 'right' }),
        PR({ x: 7, y: 53, w: 60, h: 28, color: AZUL }),
        IM({ x: 68, y: 38, w: 31, h: 47, src: M.joinha }),
        TX({ x: 5, y: 86, w: 64, h: 5, text: '{validade}', font: 'Oswald', weight: 500, color: '#333333', maxLines: 2 }),
      ],
    },
    {
      id: 'splash', name: 'Splash Azul', builtin: true, orient: 'retrato',
      bg: { c1: '#1452A8', c2: AZUL_ESC, gradient: true, img: '' },
      layers: [
        TX({ x: 5, y: 3, w: 90, h: 12, text: 'SUPER OFERTA', font: 'Anton', weight: 400, color: AMARELO }),
        TX({ x: 6, y: 16.5, w: 88, h: 17, text: '{descricao}', font: 'Archivo Black', weight: 400, color: '#FFFFFF', maxLines: 3, upper: true }),
        TX({ x: 6, y: 34, w: 88, h: 4.5, text: '{unidade}', font: 'Oswald', weight: 500, color: '#C9D8F2' }),
        SH({ x: 24, y: 39, w: 73, h: 50, shape: 'burst', fill: AMARELO, points: 20, inner: 0.86 }),
        TX({ x: 38, y: 49, w: 45, h: 5.5, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: AZUL_ESC, strike: true, strikeColor: VERMELHO, requireDe: true }),
        PR({ x: 33, y: 55, w: 55, h: 20, color: AZUL }),
        TX({ x: 38, y: 76.5, w: 45, h: 4.5, text: 'ECONOMIZE R$ {economia}', font: 'Oswald', weight: 700, color: VERMELHO, requireDe: true }),
        IM({ x: 0.5, y: 47, w: 30, h: 45, src: M.acenando }),
        TX({ x: 5, y: 92, w: 90, h: 6, text: '{validade}', font: 'Oswald', weight: 500, color: '#FFFFFF', maxLines: 2 }),
      ],
    },
    {
      id: 'gondola', name: 'Gôndola Horizontal', builtin: true, orient: 'paisagem',
      bg: { c1: '#FFFFFF', c2: '#F2F2F2', gradient: false, img: '' },
      layers: [
        SH({ x: 0, y: 0, w: 37, h: 100, fill: AZUL }),
        SH({ x: 37, y: 0, w: 1.6, h: 100, shape: 'stripes', fill: AMARELO, c2: AZUL, stripe: 1.4 }),
        TX({ x: 3, y: 6, w: 31, h: 18, text: 'OFERTA', font: 'Anton', weight: 400, color: '#FFFFFF' }),
        TX({ x: 3, y: 32, w: 31, h: 10, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: '#FFFFFF', strike: true, strikeColor: AMARELO, requireDe: true }),
        SH({ x: 5, y: 50, w: 27, h: 42, shape: 'burst', fill: AMARELO, points: 14, inner: 0.8, requireDe: true }),
        TX({ x: 8, y: 62, w: 21, h: 18, text: '-{pct}%', font: 'Anton', weight: 400, color: AZUL, requireDe: true }),
        TX({ x: 42, y: 6, w: 55, h: 28, text: '{descricao}', font: 'Archivo Black', weight: 400, color: TINTA, align: 'left', maxLines: 3, upper: true }),
        TX({ x: 42, y: 35, w: 40, h: 8, text: '{unidade}', font: 'Oswald', weight: 500, color: CINZA, align: 'left' }),
        PR({ x: 41, y: 46, w: 39, h: 38, color: AZUL, align: 'left' }),
        IM({ x: 82, y: 38, w: 17, h: 57, src: M.joinha }),
        TX({ x: 42, y: 88, w: 40, h: 7, text: '{validade}', font: 'Oswald', weight: 500, color: CINZA, align: 'left' }),
      ],
    },
    {
      id: 'preto', name: 'Preto e Amarelo', builtin: true, orient: 'retrato',
      bg: { c1: '#141414', c2: '#262626', gradient: false, img: '' },
      layers: [
        TX({ x: 6, y: 5, w: 50, h: 8, text: 'OFERTA', font: 'Anton', weight: 400, color: AMARELO, align: 'left' }),
        SH({ x: 6, y: 15, w: 22, h: 0.9, fill: AMARELO }),
        TX({ x: 6, y: 19, w: 57, h: 21, text: '{descricao}', font: 'Archivo Black', weight: 400, color: '#FFFFFF', align: 'left', maxLines: 3, upper: true }),
        TX({ x: 6, y: 41, w: 57, h: 5, text: '{unidade}', font: 'Oswald', weight: 500, color: '#AAAAAA', align: 'left' }),
        IM({ x: 64, y: 8, w: 33, h: 48, src: M.joinha }),
        TX({ x: 6, y: 50, w: 55, h: 7, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: '#BBBBBB', align: 'left', strike: true, strikeColor: AMARELO, requireDe: true }),
        PR({ x: 5, y: 58, w: 90, h: 26, color: AMARELO, align: 'left', symColor: '#FFFFFF' }),
        TX({ x: 6, y: 89, w: 88, h: 5, text: '{validade}', font: 'Oswald', weight: 500, color: '#888888', align: 'left', maxLines: 2 }),
      ],
    },
    {
      id: 'blackfriday', name: 'Black Friday', builtin: true, sazonal: true, orient: 'retrato',
      bg: { c1: '#050505', c2: '#1E1E1E', gradient: true, img: '' },
      layers: [
        SH({ x: 0, y: 0, w: 100, h: 2.6, shape: 'stripes', fill: AMARELO, c2: '#050505', stripe: 2 }),
        TX({ x: 5, y: 5, w: 57, h: 13, text: 'BLACK', font: 'Anton', weight: 400, color: '#FFFFFF', align: 'left' }),
        TX({ x: 5, y: 17.5, w: 57, h: 13, text: 'FRIDAY', font: 'Anton', weight: 400, color: AMARELO, align: 'left' }),
        TX({ x: 5, y: 31.5, w: 57, h: 3.5, text: '{loja}', font: 'Oswald', weight: 600, color: '#9A9A9A', align: 'left', upper: true }),
        IM({ x: 63, y: 4, w: 34, h: 45, src: M.joinha }),
        SH({ x: 4, y: 36.5, w: 22, h: 14, shape: 'burst', fill: AMARELO, points: 18, inner: 0.82, requireDe: true }),
        TX({ x: 6, y: 40, w: 18, h: 7, text: '-{pct}%', font: 'Anton', weight: 400, color: '#050505', requireDe: true }),
        TX({ x: 28, y: 40, w: 34, h: 7, text: 'ECONOMIZE R$ {economia}', font: 'Oswald', weight: 700, color: AMARELO, align: 'left', requireDe: true }),
        TX({ x: 5, y: 51.5, w: 90, h: 11, text: '{descricao}', font: 'Archivo Black', weight: 400, color: '#FFFFFF', align: 'left', maxLines: 2, upper: true }),
        TX({ x: 5, y: 63, w: 90, h: 3.6, text: '{unidade}', font: 'Oswald', weight: 500, color: '#9A9A9A', align: 'left' }),
        TX({ x: 5, y: 67, w: 60, h: 5.5, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: '#9A9A9A', align: 'left', strike: true, strikeColor: AMARELO, requireDe: true }),
        PR({ x: 4, y: 72.5, w: 92, h: 18, color: AMARELO, align: 'left', symColor: '#FFFFFF' }),
        SH({ x: 0, y: 92, w: 100, h: 8, fill: AMARELO }),
        TX({ x: 4, y: 93.2, w: 92, h: 5.6, text: '{validade}', font: 'Oswald', weight: 600, color: '#050505', maxLines: 2 }),
      ],
    },
    {
      id: 'natal', name: 'Natal', builtin: true, sazonal: true, orient: 'retrato',
      bg: { c1: '#D0142C', c2: '#7A0A19', gradient: true, img: '' },
      layers: [
        ...neve([[6, 3, 1.4], [18, 9, 1], [31, 2.5, 1.2], [44, 7.5, 1.5], [55, 2.5, 0.9], [4, 31, 1], [24, 34, 1.3], [49, 32, 1.1], [57, 21, 0.9], [37, 28.5, 0.8]]),
        TX({ x: 5, y: 9, w: 55, h: 11, text: 'FELIZ NATAL', font: 'Anton', weight: 400, color: AMARELO, align: 'left' }),
        TX({ x: 5, y: 20.5, w: 55, h: 5, text: 'Ofertas {loja}', font: 'Oswald', weight: 600, color: '#FFFFFF', align: 'left', upper: true }),
        IM({ x: 61, y: 1.5, w: 37, h: 42, src: M['natal-acenando'] }),
        SH({ x: 5, y: 42, w: 90, h: 47, fill: '#FFFFFF', radius: 3, stroke: AMARELO, strokeW: 0.6 }),
        SH({ x: 8, y: 43.4, w: 84, h: 1.8, shape: 'stripes', fill: '#D0142C', c2: '#FFFFFF', stripe: 1.6 }),
        TX({ x: 9, y: 47, w: 82, h: 11.5, text: '{descricao}', font: 'Archivo Black', weight: 400, color: '#7A0A19', maxLines: 2, upper: true }),
        TX({ x: 9, y: 58.8, w: 82, h: 4, text: '{unidade}', font: 'Oswald', weight: 500, color: CINZA }),
        TX({ x: 9, y: 63.5, w: 50, h: 5.5, text: 'De R$ {de}', font: 'Oswald', weight: 600, color: CINZA, align: 'left', strike: true, strikeColor: '#D0142C', requireDe: true }),
        SH({ x: 73, y: 64, w: 19, h: 12.5, shape: 'burst', fill: '#0B6B3A', points: 16, inner: 0.82, requireDe: true }),
        TX({ x: 75, y: 67, w: 15, h: 6.5, text: '-{pct}%', font: 'Anton', weight: 400, color: '#FFFFFF', requireDe: true }),
        PR({ x: 7, y: 69.5, w: 65, h: 18, color: '#D0142C' }),
        SH({ x: 0, y: 91, w: 100, h: 9, fill: '#0B6B3A' }),
        TX({ x: 4, y: 92.3, w: 92, h: 6.4, text: '{validade}', font: 'Oswald', weight: 500, color: '#FFFFFF', maxLines: 2 }),
      ],
    },
  ];
}
