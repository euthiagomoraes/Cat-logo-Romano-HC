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
 *   mascote-quadros-1.webp … mascote-quadros-3.webp   (entrada)
 *   mascote-saida-1.webp   … mascote-saida-5.webp     (saída — carregadas em segundo plano)
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
 *   whatsapp-mensagem  texto do balão da saída (padrão "Nosso time de vendedores está no WhatsApp…")
 *   whatsapp           número com DDI e DDD, só dígitos (ex.: 5591999999999) → mostra o botão "Chamar no WhatsApp"
 *   whatsapp-texto     mensagem já preenchida no WhatsApp (padrão "Olá! Vim pelo catálogo…")
 *
 * Botão "Ver ofertas" (data-link): ao clicar, a página já rola até a âncora (#ofertas) enquanto
 * o mascote faz 👍, mostra o balão do WhatsApp, olha pra cima, confirma com a cabeça e sai correndo
 * pela esquerda. Se o link for outra página (ex.: /ofertas), ela abre quando ele termina de sair.
 * No clique é disparado o evento cancelável "rhcmascote:ofertas" (detail.href) no elemento —
 * chame event.preventDefault() para navegar você mesmo (ex.: router do Next.js).
 * Ao terminar de sair é disparado "rhcmascote:saiu".
 *
 * API: window.RHCMascote.repetir() · .acenar() · .fechar() · .irParaOfertas()
 */
(function () {
  'use strict';

  var FPS = 24;                    // o vídeo da entrada tem 24 quadros únicos por segundo
  var VEL_SAIDA = 1.01;            // saída 1% mais rápida
  var QW = 512, QH = 450;          // tamanho de cada quadro na folha
  var COLS = 7, POR_FOLHA = 35;    // 7×5 quadros por folha
  var TOTAL = 90;                  // quadros na folha da entrada
  // quadros repetidos do vídeo original (conversão 24→30 fps) — pulados para o movimento não "engasgar"
  var REPETIDOS = [5, 10, 14, 20, 25, 29, 35, 39, 44, 50, 55, 59, 64, 65, 68, 69, 70, 74, 80, 85, 88];
  var FOLHAS = ['mascote-quadros-1.webp', 'mascote-quadros-2.webp', 'mascote-quadros-3.webp'];
  var QUADRO_ACENO = 53;           // quadro em que ele começa a acenar → balão aparece

  // Clipe de saída (👍, olha pra cima, confirma com a cabeça e sai correndo pela esquerda) — 24 fps.
  // Os quadros 0–4 da folha são uma transição antiga (não usada): a fusão agora é feita ao vivo, a partir do quadro 5.
  // Se as folhas não carregarem, entra a saída provisória (animação CSS).
  var SAIDA = {
    folhas: ['mascote-saida-1.webp', 'mascote-saida-2.webp', 'mascote-saida-3.webp', 'mascote-saida-4.webp', 'mascote-saida-5.webp'],
    total: 166,
    fps: 24,
    inicio: 5,       // 1º quadro real do vídeo da saída
    fusao: 8,        // quadros de fusão entre a entrada (quadro 40) e a saída
    ajuste: [4, -5], // deslocamento (px) que alinha o rosto/corpo da saída com a entrada durante a fusão
    balaoEm: 10,      // quadro em que o balão do WhatsApp aparece (ele faz 👍)
    balaoAte: 136    // quadro em que o balão some (ele vira para correr)
  };
  var MSG_WHATS = 'Nosso time de vendedores está no WhatsApp. Qualquer coisa, é só chamar! 💬';
  var TXT_WHATS = 'Olá! Vim pelo catálogo do Home Center e gostaria de falar com um vendedor.';
  var CHAVE_SESSAO = 'rhc-mascote-visto';
  var instancias = [];

  var USAR = []; var i;
  for (i = 0; i < TOTAL; i++) USAR[i] = REPETIDOS.indexOf(i) < 0;
  function faixa(de, ate) {             // quadros únicos de "de" até "ate" (em qualquer direção)
    var r = [], p = de <= ate ? 1 : -1;
    for (var q = de; p > 0 ? q <= ate : q >= ate; q += p) if (USAR[q]) r.push(q);
    return r;
  }
  // entrada: 0..89 ; aceno extra: 89→56→89 (começa e termina no mesmo quadro)
  var SEQ_ENTRADA = faixa(0, TOTAL - 1);
  var SEQ_ACENO = faixa(89, 56).concat(faixa(57, 89));
  var QUADRO_JUNCAO = 40;               // pose da entrada que casa com o 1º quadro da saída
  function suave(x) { return x * x * (3 - 2 * x); }
  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

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
  // decodifica a folha fora da thread principal: sem isso o navegador decodifica no 1º desenho
  // de cada folha e a animação "trava" ~200 ms na troca de folha
  function carregarFolha(src) {
    return carregarImagem(src).then(function (img) {
      if (!window.createImageBitmap) return img;
      return createImageBitmap(img).then(function (bmp) { return bmp; }, function () { return img; });
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
        '</div>') +
      (semBalao ? '' :
        '<div class="rhc-mascote__balao rhc-mascote__balao--whats" role="status">' +
          '<button type="button" class="rhc-mascote__fechar" aria-label="Fechar">&times;</button>' +
          '<span>' + esc(d.whatsappMensagem || MSG_WHATS) + '</span>' +
          (d.whatsapp ? '<br><a class="rhc-mascote__whats" target="_blank" rel="noopener" href="https://wa.me/' +
            esc(String(d.whatsapp).replace(/\D/g, '')) + '?text=' + encodeURIComponent(d.whatsappTexto || TXT_WHATS) +
            '">Chamar no WhatsApp</a>' : '') +
        '</div>');

    var canvas = el.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var folhas = null, folhasSaida = null;
    var raf = 0, geracao = 0, ocupado = false, saindo = false;
    var quadroAtual = TOTAL - 1;        // último quadro da entrada desenhado

    function pintar(fs, q, ox, oy) {
      var f = Math.floor(q / POR_FOLHA), n = q % POR_FOLHA;
      ctx.drawImage(fs[f], (n % COLS) * QW, Math.floor(n / COLS) * QH, QW, QH, ox || 0, oy || 0, QW, QH);
    }
    // item = número (quadro de "jogo") ou { a, b, t }: fusão do quadro a (entrada) com b (saída)
    function desenhar(item, jogo) {
      ctx.clearRect(0, 0, QW, QH);
      if (typeof item === 'number') {
        pintar(jogo || folhas, item);
        if (!jogo || jogo === folhas) quadroAtual = item;
        return;
      }
      // soma em alfa pré-multiplicado ("lighter") = mistura exata, sem ficar transparente no meio
      // as duas imagens se movem juntas (entrada → posição da saída), então não aparece "fantasma"
      var dx = item.dx || 0, dy = item.dy || 0, t = item.t;
      ctx.globalAlpha = 1 - t; pintar(folhas, item.a, -dx * t, -dy * t);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t; pintar(folhasSaida, item.b, dx * (1 - t), dy * (1 - t));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }

    // toca uma sequência de quadros (24 fps por padrão); aoQuadro(q) é chamado a cada quadro novo
    function tocar(seq, aoQuadro, jogo, fps) {
      cancelAnimationFrame(raf);
      var g = geracao, inicio = null, ultimo = -1, dt = 1000 / (fps || FPS);
      return new Promise(function (ok) {
        function passo(t) {
          if (g !== geracao) return ok(false);
          if (inicio === null) inicio = t;
          // limita saltos (ex.: aba em segundo plano) a no máximo 2 quadros por vez
          var alvo = Math.min(seq.length - 1, Math.floor((t - inicio) / dt));
          if (alvo > ultimo + 2) { inicio = t - (ultimo + 2) * dt; alvo = ultimo + 2; }
          if (alvo !== ultimo) {
            for (var k = ultimo + 1; k <= alvo; k++) if (aoQuadro) aoQuadro(typeof seq[k] === 'number' ? seq[k] : seq[k].b);
            desenhar(seq[alvo], jogo);
            ultimo = alvo;
          }
          if (alvo >= seq.length - 1) return ok(true);
          raf = requestAnimationFrame(passo);
        }
        raf = requestAnimationFrame(passo);
      });
    }

    function animarCSS(classe, ms) {
      el.classList.add(classe);
      return esperar(ms).then(function () { el.classList.remove(classe); });
    }

    // avisa a página do clique; false = a página cancelou e vai navegar sozinha (ex.: router)
    function avisarOfertas(href) {
      var ev;
      try { ev = new CustomEvent('rhcmascote:ofertas', { cancelable: true, bubbles: true, detail: { href: href } }); }
      catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('rhcmascote:ofertas', true, true, { href: href }); }
      return el.dispatchEvent(ev);
    }
    function navegar(href) {
      if (href.charAt(0) === '#') {
        var alvo = href.length > 1 && document.getElementById(decodeURIComponent(href.slice(1)));
        if (alvo) {
          alvo.scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth', block: 'start' });
          // atualizar a URL é opcional: em iframes/sandbox (about:srcdoc) o navegador bloqueia
          try { if (history.replaceState) history.replaceState(null, '', href); } catch (e) { /* ignora */ }
        } else {
          try { location.hash = href; } catch (e) { /* ignora */ }
        }
      } else {
        try { location.assign(href); } catch (e) { window.open(href, '_top'); }
      }
    }

    function terminarSaida() {
      cancelAnimationFrame(raf);
      el.hidden = true;
      el.classList.remove('is-indo', 'is-confirmando', 'is-saindo-ofertas', 'is-whats');
      saindo = false; ocupado = false;
      try { el.dispatchEvent(new CustomEvent('rhcmascote:saiu', { bubbles: true })); } catch (e) { /* IE */ }
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
        saindo = false;
        el.classList.remove('is-pronto', 'is-falando', 'is-saindo', 'is-saindo-ofertas', 'is-confirmando', 'is-indo', 'is-whats');
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
      irParaOfertas: function (href) {
        href = href || d.link || '#';
        if (saindo) return;
        var seguir = avisarOfertas(href);          // false = a página cuida da navegação
        var interno = href.charAt(0) === '#';
        if (seguir && interno) navegar(href);      // âncora: já rola enquanto ele se despede
        var depois = seguir && !interno;           // outra página: abre quando ele terminar de sair
        if (!folhas || semMovimento || el.hidden) { if (folhas) terminarSaida(); if (depois) navegar(href); return; }

        var g = ++geracao;
        saindo = true; ocupado = true;
        cancelAnimationFrame(raf);
        el.classList.remove('is-falando', 'is-pronto');
        el.classList.add('is-saindo-ofertas');

        // abaixa a mão a partir de onde ele estiver (no meio de um aceno, inclusive)
        var abaixa = faixa(Math.max(quadroAtual, QUADRO_JUNCAO), QUADRO_JUNCAO);
        var sequencia = tocar(abaixa, null, null, FPS * VEL_SAIDA);
        if (folhasSaida) {
          // fusão entre duas poses paradas (entrada 40 → 1º quadro da saída), alinhadas, e depois a saída inteira
          var seqS = [], k, aj = SAIDA.ajuste || [0, 0];
          for (k = 0; k < SAIDA.fusao; k++) {
            seqS.push({ a: QUADRO_JUNCAO, b: SAIDA.inicio, t: suave((k + 1) / (SAIDA.fusao + 1)), dx: aj[0], dy: aj[1] });
          }
          for (k = SAIDA.inicio; k < SAIDA.total; k++) seqS.push(k);
          sequencia = sequencia.then(function (ok) {
            if (!ok) return false;
            return tocar(seqS, function (q) {
              if (q === SAIDA.balaoEm) el.classList.add('is-whats');
              if (q === SAIDA.balaoAte) el.classList.remove('is-whats');
            }, folhasSaida, SAIDA.fps * VEL_SAIDA);
          });
        } else {
          // provisória (folhas da saída indisponíveis): confirma com o corpo e sai pela esquerda
          sequencia = sequencia
            .then(function (ok) {
              if (!ok) return false;
              el.classList.add('is-whats');
              return animarCSS('is-confirmando', 820).then(function () { return esperar(2200); })
                .then(function () { el.classList.remove('is-whats'); return g === geracao; });
            })
            .then(function (ok) { return ok && animarCSS('is-indo', 1150).then(function () { return g === geracao; }); });
        }
        sequencia.then(function (ok) {
          if (g !== geracao) return;
          terminarSaida();
          if (ok && depois) navegar(href);
        });
      },
      fechar: function () {
        geracao++;
        saindo = false;
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
    var btnFechar = el.querySelector('.rhc-mascote__balao:not(.rhc-mascote__balao--whats) .rhc-mascote__fechar');
    if (btnFechar) btnFechar.addEventListener('click', function (e) { e.stopPropagation(); api.fechar(); });
    var btnFecharWhats = el.querySelector('.rhc-mascote__balao--whats .rhc-mascote__fechar');
    if (btnFecharWhats) btnFecharWhats.addEventListener('click', function (e) { e.stopPropagation(); el.classList.remove('is-whats'); });
    var btnLink = el.querySelector('.rhc-mascote__balao:not(.rhc-mascote__balao--whats) a');
    if (btnLink) btnLink.addEventListener('click', function (e) {
      // Ctrl/⌘/Shift/botão do meio = abrir em nova aba normalmente
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      api.irParaOfertas(btnLink.getAttribute('href'));
    });

    var atraso = parseInt(d.atraso, 10);
    if (isNaN(atraso)) atraso = 600;

    function disparar() {
      Promise.all(FOLHAS.map(function (n) { return carregarFolha(arq(n)); }))
        .then(function (imgs) {
          folhas = imgs;
          setTimeout(api.iniciar, atraso);
          // a saída só é necessária depois: carrega em segundo plano
          if (SAIDA && SAIDA.folhas && SAIDA.folhas.length) {
            Promise.all(SAIDA.folhas.map(function (n) { return carregarFolha(arq(n)); }))
              .then(function (fs) { folhasSaida = fs; }, function () { /* usa a provisória */ });
          }
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
    fechar: function () { instancias.forEach(function (m) { m.fechar(); }); },
    irParaOfertas: function (href) { instancias.forEach(function (m) { m.irParaOfertas(href); }); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
