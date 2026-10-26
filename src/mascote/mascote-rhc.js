/*!
 * Mascote RHC — entrada animada (anda da esquerda, para e acena)
 * Toca os quadros do vídeo original num <canvas> a partir de 3 folhas de sprites WebP.
 * Funciona igual em Chrome, Edge, Firefox, Safari e iPhone (não depende de <video> nem de autoplay).
 *
 * Uso mínimo:
 *   <div data-rhc-mascote data-midia-base="/mascote/"></div>
 *   + mascote-rhc.css no <head> e mascote-rhc.js com defer
 *
 * Arquivos esperados em data-midia-base:
 *   mascote-quadros-1.webp  mascote-quadros-2.webp  mascote-quadros-3.webp
 *
 * Atributos opcionais (data-*):
 *   titulo       1ª linha do balão           (padrão "Olá!")
 *   mensagem     2ª linha do balão           (padrão "Confira as ofertas da semana.")
 *   link         href do botão do balão      (sem link = sem botão)
 *   link-texto   texto do botão              (padrão "Ver ofertas")
 *   modo         "fixo" (canto inferior esquerdo) | "inline" (dentro do layout)
 *   atraso       ms antes de entrar          (padrão 600)
 *   uma-vez      "sessao" = só aparece 1x por sessão do navegador
 *   sem-balao    presente = não mostra o balão
 *   movimento    "respeitar" = se o sistema pedir "reduzir movimento", mostra o mascote já parado
 *
 * API: window.RHCMascote.repetir() · .acenar() · .fechar()
 */
(function () {
  'use strict';

  var FPS = 30;
  var QW = 512, QH = 450;          // tamanho de cada quadro na folha
  var COLS = 7, POR_FOLHA = 35;    // 7×5 quadros por folha
  var TOTAL = 90;                  // quadros da entrada (3,0 s)
  var FOLHAS = ['mascote-quadros-1.webp', 'mascote-quadros-2.webp', 'mascote-quadros-3.webp'];
  var QUADRO_ACENO = 53;           // quadro em que ele começa a acenar → balão aparece
  var CHAVE_SESSAO = 'rhc-mascote-visto';
  var instancias = [];

  // sequência de entrada: 0..89 ; aceno extra: 89→56→89 (começa e termina no mesmo quadro)
  var SEQ_ENTRADA = [], SEQ_ACENO = [], i;
  for (i = 0; i < TOTAL; i++) SEQ_ENTRADA.push(i);
  for (i = 89; i >= 56; i--) SEQ_ACENO.push(i);
  for (i = 57; i <= 89; i++) SEQ_ACENO.push(i);

  function lerSessao() { try { return sessionStorage.getItem(CHAVE_SESSAO) === '1'; } catch (e) { return false; } }
  function gravarSessao() { try { sessionStorage.setItem(CHAVE_SESSAO, '1'); } catch (e) { /* modo privado */ } }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function carregarImagem(src) {
    return new Promise(function (ok, falha) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (img.decode) img.decode().then(function () { ok(img); }, function () { ok(img); });
        else ok(img);
      };
      img.onerror = function () { falha(new Error('Falha ao carregar ' + src)); };
      img.src = src;
    });
  }
  function quandoVisivel() {
    if (document.visibilityState !== 'hidden') return Promise.resolve();
    return new Promise(function (ok) {
      var f = function () {
        if (document.visibilityState !== 'hidden') { document.removeEventListener('visibilitychange', f); ok(); }
      };
      document.addEventListener('visibilitychange', f);
    });
  }

  function montar(el) {
    var d = el.dataset;
    if (d.umaVez === 'sessao' && lerSessao()) { el.hidden = true; return; }

    var base = d.midiaBase || 'mascote/';
    if (base.slice(-1) !== '/') base += '/';
    var mapa = window.RHCMascoteArquivos || {}; // opcional: { 'mascote-quadros-1.webp': 'https://cdn/...' }
    function arq(nome) { return mapa[nome] || base + nome; }
    var semBalao = 'semBalao' in d;
    var semMovimento = d.movimento === 'respeitar' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.classList.add('rhc-mascote');
    if (d.modo === 'inline') el.classList.add('rhc-mascote--inline');
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Mascote de boas-vindas');

    el.innerHTML =
      '<div class="rhc-mascote__palco">' +
        '<canvas class="rhc-mascote__midia" width="' + QW + '" height="' + QH + '" role="img" aria-label="Mascote acenando"></canvas>' +
        '<button type="button" class="rhc-mascote__toque" aria-label="Acenar"></button>' +
      '</div>' +
      (semBalao ? '' :
        '<div class="rhc-mascote__balao" role="status">' +
          '<button type="button" class="rhc-mascote__fechar" aria-label="Fechar">&times;</button>' +
          '<strong>' + esc(d.titulo || 'Olá!') + '</strong>' +
          '<span>' + esc(d.mensagem || 'Confira as ofertas da semana.') + '</span>' +
          (d.link ? '<br><a href="' + esc(d.link) + '">' + esc(d.linkTexto || 'Ver ofertas') + '</a>' : '') +
        '</div>');

    var canvas = el.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var folhas = null;
    var raf = 0, geracao = 0, ocupado = false;

    function desenhar(q) {
      var f = Math.floor(q / POR_FOLHA), n = q % POR_FOLHA;
      var sx = (n % COLS) * QW, sy = Math.floor(n / COLS) * QH;
      ctx.clearRect(0, 0, QW, QH);
      ctx.drawImage(folhas[f], sx, sy, QW, QH, 0, 0, QW, QH);
    }

    // toca uma sequência de quadros a 30 fps; aoQuadro(q) é chamado a cada quadro novo
    function tocar(seq, aoQuadro) {
      cancelAnimationFrame(raf);
      var g = geracao, inicio = null, ultimo = -1;
      return new Promise(function (ok) {
        function passo(t) {
          if (g !== geracao) return ok(false);
          if (inicio === null) inicio = t;
          // limita saltos (ex.: aba em segundo plano) a no máximo 2 quadros por vez
          var alvo = Math.min(seq.length - 1, Math.floor((t - inicio) / (1000 / FPS)));
          if (alvo > ultimo + 2) { inicio = t - (ultimo + 2) * (1000 / FPS); alvo = ultimo + 2; }
          if (alvo !== ultimo) {
            for (var k = ultimo + 1; k <= alvo; k++) if (aoQuadro) aoQuadro(seq[k]);
            desenhar(seq[alvo]);
            ultimo = alvo;
          }
          if (alvo >= seq.length - 1) return ok(true);
          raf = requestAnimationFrame(passo);
        }
        raf = requestAnimationFrame(passo);
      });
    }

    function parado() {
      desenhar(TOTAL - 1);
      el.classList.add('is-pronto', 'is-falando');
      ocupado = false;
    }

    var api = {
      el: el,
      iniciar: function () {
        if (!folhas) return;
        geracao++;
        el.hidden = false;
        el.classList.remove('is-pronto', 'is-falando', 'is-saindo');
        if (d.umaVez === 'sessao') gravarSessao();
        if (semMovimento) { parado(); return; }
        ocupado = true;
        desenhar(0);
        quandoVisivel().then(function () {
          return tocar(SEQ_ENTRADA, function (q) {
            if (q === QUADRO_ACENO) el.classList.add('is-falando');
          });
        }).then(function (completo) { if (completo) parado(); });
      },
      acenar: function () {
        if (!folhas || ocupado || semMovimento || !el.classList.contains('is-pronto')) return;
        ocupado = true;
        tocar(SEQ_ACENO).then(function (completo) { if (completo) ocupado = false; });
      },
      fechar: function () {
        geracao++;
        cancelAnimationFrame(raf);
        ocupado = false;
        el.classList.remove('is-falando');
        el.classList.add('is-saindo');
        setTimeout(function () { el.hidden = true; el.classList.remove('is-saindo'); }, 600);
      }
    };

    var toque = el.querySelector('.rhc-mascote__toque');
    toque.addEventListener('click', api.acenar);
    toque.addEventListener('mouseenter', api.acenar);
    var btnFechar = el.querySelector('.rhc-mascote__fechar');
    if (btnFechar) btnFechar.addEventListener('click', function (e) { e.stopPropagation(); api.fechar(); });

    var atraso = parseInt(d.atraso, 10);
    if (isNaN(atraso)) atraso = 600;

    function disparar() {
      Promise.all(FOLHAS.map(function (n) { return carregarImagem(arq(n)); }))
        .then(function (imgs) {
          folhas = imgs;
          setTimeout(api.iniciar, atraso);
        })
        .catch(function (e) {
          if (window.console) console.warn('[RHCMascote]', e.message);
          el.hidden = true;
        });
    }

    if (d.modo === 'inline' && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ent) {
        if (ent[0].isIntersecting) { io.disconnect(); disparar(); }
      }, { threshold: 0.4 });
      io.observe(el);
    } else {
      disparar();
    }

    instancias.push(api);
  }

  function init() {
    var els = document.querySelectorAll('[data-rhc-mascote]:not(.rhc-mascote)');
    for (var i = 0; i < els.length; i++) montar(els[i]);
  }

  window.RHCMascote = {
    init: init,
    repetir: function () { instancias.forEach(function (m) { m.iniciar(); }); },
    acenar: function () { instancias.forEach(function (m) { m.acenar(); }); },
    fechar: function () { instancias.forEach(function (m) { m.fechar(); }); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
