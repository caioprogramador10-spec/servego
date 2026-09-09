/* ==========================================================================
   ServeGo — Tema claro / escuro
   --------------------------------------------------------------------------
   Regras:
   - sem escolha do usuário, seguimos o sistema (prefers-color-scheme);
   - a escolha explícita vira o atributo data-theme no <html> e é lembrada;
   - o snippet inline no <head> de index.html e app.html aplica o tema ANTES
     da primeira pintura, para não haver "flash" branco ao carregar.
   ========================================================================== */
(function (SG) {
  var KEY = "servego.theme";
  var root = document.documentElement;
  var listeners = [];

  var theme = {};

  /* ---- Leitura / escrita da preferência ---------------------------------- */
  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) { return null; }
  }

  function remember(mode) {
    try {
      if (mode) localStorage.setItem(KEY, mode);
      else localStorage.removeItem(KEY);
    } catch (e) { /* modo privado: o tema vale só nesta aba */ }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light" : "dark";
  }

  /** Tema realmente em uso agora ("light" | "dark"). */
  theme.current = function () {
    var attr = root.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    return systemTheme();
  };

  /** Há escolha explícita? (false = seguindo o sistema) */
  theme.isExplicit = function () { return !!stored(); };

  /* ---- Aplicação ---------------------------------------------------------- */
  function paintMeta(mode) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", mode === "light" ? "#f7f4ef" : "#070706");
  }

  /**
   * Define o tema.
   * @param {"light"|"dark"|"system"} mode
   * @param {boolean} animate  suaviza a transição de fundo/texto
   */
  theme.set = function (mode, animate) {
    if (mode === "system") {
      remember(null);
      root.removeAttribute("data-theme");
    } else {
      mode = mode === "light" ? "light" : "dark";
      remember(mode);
      root.setAttribute("data-theme", mode);
    }

    var effective = theme.current();
    paintMeta(effective);

    if (animate !== false) {
      root.classList.add("sg-theme-animating");
      clearTimeout(theme._t);
      theme._t = setTimeout(function () {
        root.classList.remove("sg-theme-animating");
      }, 520);
    }

    listeners.forEach(function (fn) {
      try { fn(effective); } catch (e) { console.error(e); }
    });
    return effective;
  };

  /** Alterna entre claro e escuro. */
  theme.toggle = function () {
    return theme.set(theme.current() === "dark" ? "light" : "dark");
  };

  /** Volta a seguir o sistema. */
  theme.followSystem = function () { return theme.set("system"); };

  theme.onChange = function (fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  };

  /* ---- Botão pronto ------------------------------------------------------- */
  function iconFor(mode, size) {
    // mostramos o destino do clique: no escuro, oferecemos o sol
    return SG.icon(mode === "dark" ? "sun" : "moon", size || 19);
  }

  function labelFor(mode) {
    return mode === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  }

  /**
   * Cria o botão de troca de tema.
   * @param {string} className  classe do botão (padrão: app-iconbtn)
   */
  theme.button = function (className) {
    var mode = theme.current();
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = className || "app-iconbtn";
    btn.setAttribute("aria-label", labelFor(mode));
    btn.setAttribute("data-tip", mode === "dark" ? "Tema claro" : "Tema escuro");
    btn.innerHTML = iconFor(mode);

    function refresh(next) {
      btn.innerHTML = iconFor(next);
      btn.setAttribute("aria-label", labelFor(next));
      btn.setAttribute("data-tip", next === "dark" ? "Tema claro" : "Tema escuro");
    }

    btn.addEventListener("click", function () { theme.toggle(); });
    theme.onChange(refresh);
    return btn;
  };

  /** Insere o botão dentro de um elemento (ou seletor). */
  theme.mount = function (target, className) {
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) return null;
    var btn = theme.button(className);
    host.appendChild(btn);
    return btn;
  };

  /* ---- Sincronia com o sistema ------------------------------------------- */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onSystem = function () {
      if (theme.isExplicit()) return; // escolha do usuário tem prioridade
      var effective = theme.current();
      paintMeta(effective);
      listeners.forEach(function (fn) { fn(effective); });
    };
    if (mq.addEventListener) mq.addEventListener("change", onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  }

  paintMeta(theme.current());

  SG.theme = theme;
})(window.SG || (window.SG = {}));
