/* ==========================================================================
   ServeGo — Telas do cliente
   Início, categorias, atividade, matching de profissionais, acompanhamento.
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  function firstName(n) { return String(n || "").split(" ")[0]; }
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }

  /* ---- Cartão de categoria ------------------------------------------------ */
  function catTile(c) {
    return '<a class="cat-tile" href="#/solicitar?cat=' + c.id + '">' +
      '<span class="cat-tile__ic">' + c.icon + "</span>" +
      '<span><span class="cat-tile__name" style="display:block">' + ui.esc(c.name) + "</span>" +
      '<span class="cat-tile__price">a partir de ' + ui.money(c.price_from, true) + "</span></span></a>";
  }

  /* ---- Cartão de solicitação ---------------------------------------------- */
  function requestCard(r) {
    var link = r.booking ? "#/acompanhar/" + r.booking.id : "#/solicitacao/" + r.id;
    var status = r.booking ? ui.statusBadge(r.booking.status) : ui.statusBadge(r.status, ui.labels.requestStatus);
    return '<a class="sg-card sg-card--hover" href="' + link + '" style="display:block">' +
      '<div class="sg-row sg-row--between" style="align-items:flex-start">' +
        '<div class="sg-row" style="min-width:0">' +
          '<span class="sg-avatar sg-avatar--lg" style="font-size:22px">' + ((r.category && r.category.icon) || "🛠") + "</span>" +
          '<div style="min-width:0">' +
            '<div class="sg-strong sg-truncate">' + ui.esc(r.title) + "</div>" +
            '<div class="sg-xs sg-dim" style="margin-top:3px">' +
              ui.esc((r.category && r.category.name) || "") + " · " + ui.timeAgo(r.created_at) + "</div>" +
          "</div></div>" +
        status +
      "</div>" +
      '<div class="sg-row sg-row--between" style="margin-top:16px">' +
        '<div class="sg-row" style="gap:16px">' +
          badgeMini("tag", (r.offers_count || 0) + " orçamento" + (r.offers_count === 1 ? "" : "s")) +
          badgeMini("clock", ui.labels.urgency[r.urgency] || "") +
        "</div>" +
        '<span class="sg-row sg-xs sg-brand-text sg-strong">Abrir ' + SG.icon("chevronRight", 14) + "</span>" +
      "</div></a>";
  }

  function badgeMini(icon, text) {
    return '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon(icon, 13) + ui.esc(text) + "</span>";
  }

  /* ==========================================================================
     INÍCIO DO CLIENTE
     ========================================================================== */
  SG.views.clientHome = function () {
    var me = app.state.me;
    app.setHeader("Início", greeting() + ", " + firstName(me.full_name));
    app.view(
      '<div class="app-page-head">' +
        '<h1>' + greeting() + ", " + ui.esc(firstName(me.full_name)) + ' 👋</h1>' +
        "<p>O que você precisa resolver hoje?</p>" +
      "</div>" +
      '<div class="sg-input-group" style="max-width:520px;margin-bottom:32px">' +
        '<span class="sg-input-group__icon">' + SG.icon("search", 17) + "</span>" +
        '<input class="sg-input" id="homeSearch" placeholder="Busque por serviço: elétrica, vazamento, pintura…">' +
        '<div id="searchResults"></div>' +
      "</div>" +
      '<div id="homeActive"></div>' +
      '<div class="app-section-title"><h3>Categorias</h3>' +
        '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/categorias">Ver todas ' + SG.icon("chevronRight", 14) + "</a></div>" +
      '<div class="cat-grid" id="homeCats">' + ui.skeletonCard(1) + "</div>" +
      '<div id="homeRecommended"></div>' +
      '<div id="homeHistory"></div>'
    );

    // categorias
    api.categories.list().then(function (cats) {
      app.state.categories = cats;
      ui.$("#homeCats").innerHTML = cats.slice(0, 10).map(catTile).join("") +
        '<a class="cat-tile" href="#/categorias" style="justify-content:center;align-items:center;text-align:center">' +
        '<span class="cat-tile__ic" style="margin:0 auto">' + SG.icon("grid", 18) + "</span>" +
        '<span class="cat-tile__name">Ver todas</span></a>';

      var input = ui.$("#homeSearch");
      input.addEventListener("input", ui.debounce(function () {
        var q = input.value.toLowerCase().trim();
        var box = ui.$("#searchResults");
        if (!q) { box.innerHTML = ""; return; }
        var hits = cats.filter(function (c) {
          return (c.name + " " + c.description).toLowerCase().indexOf(q) >= 0;
        }).slice(0, 5);
        box.innerHTML = hits.length
          ? '<div class="sg-card sg-card--tight" style="position:absolute;z-index:20;left:0;right:0;margin-top:8px">' +
            hits.map(function (c) {
              return '<a class="sg-list__item" href="#/solicitar?cat=' + c.id + '">' +
                '<span style="font-size:18px">' + c.icon + "</span><span>" + ui.esc(c.name) +
                '<span class="sg-xs sg-dim" style="display:block">' + ui.esc(c.description) + "</span></span></a>";
            }).join("") + "</div>"
          : "";
      }, 180));
    });

    // serviços em andamento
    api.requests.listMine(me.id).then(function (list) {
      var active = list.filter(function (r) {
        return ["matching", "open", "assigned", "in_progress"].indexOf(r.status) >= 0;
      });
      var host = ui.$("#homeActive");
      if (!active.length) { host.innerHTML = ""; return; }
      host.innerHTML =
        '<div class="app-section-title"><h3>Em andamento</h3>' +
        '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/atividade">Ver tudo</a></div>' +
        '<div class="sg-grid sg-grid--2">' + active.slice(0, 2).map(requestCard).join("") + "</div>";
    });

    // recomendados + favoritos
    api.favorites.list(me.id).then(function (favs) {
      if (!favs.length) return;
      ui.$("#homeRecommended").innerHTML =
        '<div class="app-section-title"><h3>Seus profissionais de confiança</h3>' +
        '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/favoritos">Ver favoritos</a></div>' +
        '<div class="sg-grid sg-grid--3">' + favs.slice(0, 3).map(miniProCard).join("") + "</div>";
    });

    // repetir serviço
    api.bookings.listForUser(me.id, "client").then(function (bks) {
      var done = bks.filter(function (b) { return b.status === "completed"; });
      if (!done.length) return;
      ui.$("#homeHistory").innerHTML =
        '<div class="app-section-title"><h3>Repetir um serviço</h3></div>' +
        '<div class="sg-grid sg-grid--2">' + done.slice(0, 2).map(function (b) {
          return '<div class="sg-card sg-row sg-row--between">' +
            '<div class="sg-row" style="min-width:0">' + ui.avatar(b.professional, "lg") +
            '<div style="min-width:0"><div class="sg-strong sg-truncate">' + ui.esc(b.request.title) + "</div>" +
            '<div class="sg-xs sg-dim">' + ui.esc(b.professional.full_name) + " · " + ui.date(b.completed_at) + "</div></div></div>" +
            '<a class="sg-btn sg-btn--outline sg-btn--sm" href="#/solicitar?cat=' + b.request.category_id + '">Repetir</a></div>';
        }).join("") + "</div>";
    });
  };

  function miniProCard(p) {
    return '<a class="sg-card sg-card--hover" href="#/profissional/' + p.id + '" style="display:block">' +
      '<div class="sg-row">' + ui.avatar(p, "lg") +
      '<div style="min-width:0"><div class="sg-strong sg-truncate">' + ui.esc(p.full_name) + "</div>" +
      '<div class="sg-xs sg-dim sg-truncate">' + ui.esc(p.headline || "") + "</div></div></div>" +
      '<div class="sg-row sg-row--between" style="margin-top:14px">' +
      '<span class="sg-row sg-xs" style="gap:6px">' + ui.stars(p.rating) +
      '<span class="sg-dim">' + ui.rating(p.rating) + "</span></span>" +
      '<span class="sg-xs sg-dim">' + ui.num(p.jobs_count) + " serviços</span></div></a>";
  }

  /* ==========================================================================
     TODAS AS CATEGORIAS
     ========================================================================== */
  SG.views.categories = function () {
    app.setHeader("Categorias", "Escolha o tipo de serviço");
    app.view('<div class="app-page-head"><h1>Todas as categorias</h1>' +
      "<p>Profissionais verificados em 14 especialidades.</p></div>" +
      '<div class="cat-grid" id="allCats">' + ui.skeletonCard(1) + "</div>");
    api.categories.list().then(function (cats) {
      ui.$("#allCats").innerHTML = cats.map(catTile).join("");
    });
  };

  /* ==========================================================================
     MINHAS SOLICITAÇÕES
     ========================================================================== */
  SG.views.clientActivity = function () {
    app.setHeader("Minhas solicitações", "Histórico e serviços em andamento");
    app.view('<div class="app-page-head"><h1>Minhas solicitações</h1>' +
      "<p>Acompanhe tudo o que você pediu no ServeGo.</p></div>" +
      '<div class="sg-row" id="actFilters" style="margin-bottom:20px;gap:8px;flex-wrap:wrap">' +
        chip("all", "Todas", true) + chip("active", "Em andamento") +
        chip("completed", "Concluídas") + chip("cancelled", "Canceladas") + "</div>" +
      '<div id="actList">' + ui.skeletonCard(3) + "</div>");

    var all = [];
    function paint(filter) {
      var list = all.filter(function (r) {
        if (filter === "active") return ["open", "matching", "assigned", "in_progress"].indexOf(r.status) >= 0;
        if (filter === "completed") return r.status === "completed";
        if (filter === "cancelled") return r.status === "cancelled";
        return true;
      });
      ui.$("#actList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(requestCard).join("") + "</div>"
        : ui.empty("📋", "Nenhuma solicitação por aqui",
            "Quando você pedir um serviço, ele aparece nesta lista.",
            '<a class="sg-btn sg-btn--primary" href="#/solicitar">Solicitar um serviço</a>');
    }

    api.requests.listMine(app.state.me.id).then(function (list) {
      all = list;
      paint("all");
    });

    ui.on(ui.$("#actFilters"), "click", "[data-chip]", function (e, el) {
      ui.$$("#actFilters .sg-chip").forEach(function (c) { c.classList.remove("is-active"); });
      el.classList.add("is-active");
      paint(el.getAttribute("data-chip"));
    });
  };

  function chip(value, label, active) {
    return '<button class="sg-chip ' + (active ? "is-active" : "") + '" data-chip="' + value + '">' + label + "</button>";
  }

  /* ==========================================================================
     DETALHE DA SOLICITAÇÃO + MATCHING DE PROFISSIONAIS
     ========================================================================== */
  SG.views.requestDetail = function (params) {
    var id = params.id;
    app.setHeader("Solicitação", "Comparando profissionais");
    app.view(ui.skeletonCard(3));

    api.requests.get(id).then(function (req) {
      if (!req) return SG.router.go("/atividade", true);
      if (req.booking) return SG.router.go("/acompanhar/" + req.booking.id, true);

      app.setHeader(req.title, ui.labels.requestStatus[req.status]);
      app.view(
        '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/atividade" style="margin-bottom:16px">' +
          SG.icon("arrowLeft", 15) + "Minhas solicitações</a>" +
        '<div class="sg-grid" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:24px" id="reqGrid">' +
          '<div><div id="offersArea"></div></div>' +
          '<div><div id="reqSummary"></div></div>' +
        "</div>",
        { className: "app-view--wide" }
      );
      if (window.innerWidth < 1000) ui.$("#reqGrid").style.gridTemplateColumns = "minmax(0,1fr)";

      renderSummary(req);
      loadOffers(req);
    });

    function renderSummary(req) {
      ui.$("#reqSummary").innerHTML =
        '<div class="sg-card">' +
          '<div class="sg-row" style="margin-bottom:16px">' +
            '<span class="sg-avatar sg-avatar--lg" style="font-size:22px">' + (req.category ? req.category.icon : "🛠") + "</span>" +
            "<div><div class=\"sg-strong\">" + ui.esc(req.category ? req.category.name : "") + "</div>" +
            '<div class="sg-xs sg-dim">Criada ' + ui.since(req.created_at) + "</div></div></div>" +
          '<p class="sg-md sg-muted">' + ui.esc(req.description) + "</p>" +
          '<div class="sg-divider"></div>' +
          infoRow("pin", "Local", req.address) +
          infoRow("clock", "Quando", ui.labels.urgency[req.urgency] +
            (req.scheduled_for ? " · " + ui.dateTime(req.scheduled_for) : "")) +
          (req.budget_hint ? infoRow("wallet", "Orçamento previsto", ui.money(req.budget_hint)) : "") +
          (req.photos && req.photos.length
            ? '<div class="sg-divider"></div><div class="sg-field__label" style="margin-bottom:10px">Fotos enviadas</div>' +
              '<div class="sg-thumbs">' + req.photos.map(function (p) {
                return '<div class="sg-thumb"><img src="' + p.url + '" alt=""></div>';
              }).join("") + "</div>"
            : "") +
          '<div class="sg-divider"></div>' +
          '<button class="sg-btn sg-btn--ghost sg-btn--sm sg-btn--block" data-cancel>Cancelar solicitação</button>' +
        "</div>" +
        '<div class="sg-card" style="margin-top:16px">' +
          '<div class="sg-row" style="margin-bottom:12px">' + SG.icon("shield", 18) +
          '<strong class="sg-md">Proteção ServeGo</strong></div>' +
          '<p class="sg-sm sg-dim">Pagamento liberado ao profissional apenas após a conclusão do serviço. Em caso de problema, você tem 7 dias para abrir uma disputa.</p>' +
        "</div>";

      ui.$("[data-cancel]").addEventListener("click", function () {
        ui.confirm({
          title: "Cancelar solicitação?",
          text: "Os profissionais que enviaram orçamento serão avisados.",
          okText: "Sim, cancelar", danger: true
        }).then(function (ok) {
          if (!ok) return;
          api.requests.cancel(req.id).then(function () {
            ui.toast("Solicitação cancelada", { type: "info" });
            SG.router.go("/atividade");
          });
        });
      });
    }

    function infoRow(icon, label, value) {
      return '<div class="sg-row sg-row--top" style="margin-bottom:12px">' +
        '<span style="color:var(--sg-text-4);margin-top:2px">' + SG.icon(icon, 16) + "</span>" +
        '<div><div class="sg-xs sg-faint">' + label + "</div>" +
        '<div class="sg-md">' + ui.esc(value || "—") + "</div></div></div>";
    }

    function loadOffers(req) {
      var area = ui.$("#offersArea");
      var offers = [];

      function paintSearching() {
        area.innerHTML =
          '<div class="sg-card sg-card--pad-lg" style="text-align:center">' +
            '<div class="radar">' +
              '<span class="radar__wave"></span><span class="radar__wave"></span>' +
              '<span class="radar__wave"></span><span class="radar__wave"></span>' +
              '<div class="radar__core">' + SG.brandMark(40) + "</div>" +
              blip("⚡", "18%", "22%") + blip("🔧", "78%", "30%") +
              blip("💧", "24%", "72%") + blip("❄️", "72%", "76%") +
            "</div>" +
            "<h3>Encontrando profissionais próximos…</h3>" +
            '<p class="sg-muted sg-md" style="margin-top:8px;max-width:44ch;margin-inline:auto">' +
              "Estamos avisando os profissionais verificados da sua região. Os primeiros orçamentos costumam chegar em poucos minutos.</p>" +
            '<div class="sg-progress" style="max-width:280px;margin:24px auto 0">' +
              '<div class="sg-progress__fill" style="width:35%"></div></div>' +
          "</div>";
      }

      function blip(emoji, left, top) {
        return '<span class="radar__blip" style="left:' + left + ';top:' + top + '">' + emoji + "</span>";
      }

      function paintOffers() {
        var sorted = offers.slice();
        area.innerHTML =
          '<div class="sg-row sg-row--between" style="margin-bottom:16px">' +
            "<div><h3>" + sorted.length + " " +
              ui.plural(sorted.length, "profissional interessado", "profissionais interessados") + "</h3>" +
            '<p class="sg-sm sg-dim">Compare preço, avaliação e tempo de chegada.</p></div>' +
            '<div class="sg-segment" id="offerSort">' +
              '<button class="sg-segment__item is-active" data-sort="best">Melhores</button>' +
              '<button class="sg-segment__item" data-sort="price">Preço</button>' +
              '<button class="sg-segment__item" data-sort="eta">Chegada</button>' +
            "</div></div>" +
          '<div class="sg-stack" id="offerList"></div>';
        sortAndPaint("best");
        ui.on(ui.$("#offerSort"), "click", "[data-sort]", function (e, el) {
          ui.$$("#offerSort .sg-segment__item").forEach(function (b) { b.classList.remove("is-active"); });
          el.classList.add("is-active");
          sortAndPaint(el.getAttribute("data-sort"));
        });
      }

      function sortAndPaint(mode) {
        var list = offers.slice().sort(function (a, b) {
          if (mode === "price") return a.price - b.price;
          if (mode === "eta") return a.eta_minutes - b.eta_minutes;
          return (b.professional.rating || 0) - (a.professional.rating || 0);
        });
        ui.$("#offerList").innerHTML = list.map(function (o, i) {
          return offerCard(o, mode === "best" && i === 0);
        }).join("");
        ui.$$("#offerList [data-accept]").forEach(function (b) {
          b.addEventListener("click", function () { accept(b.getAttribute("data-accept"), b); });
        });
      }

      function offerCard(o, best) {
        var p = o.professional;
        return '<div class="pro-card ' + (best ? "pro-card--best" : "") + '" style="position:relative">' +
          (best ? '<span class="pro-card__ribbon">Melhor combinação</span>' : "") +
          ui.avatar(p, "lg") +
          '<div style="min-width:0">' +
            '<div class="sg-row" style="gap:8px">' +
              '<span class="sg-strong sg-truncate">' + ui.esc(p.full_name) + "</span>" +
              (p.verified ? '<span class="sg-badge sg-badge--brand">' + SG.icon("verified", 12) + "Verificado</span>" : "") +
            "</div>" +
            '<div class="sg-xs sg-dim" style="margin-top:2px">' + ui.esc(p.headline || "") + "</div>" +
            '<div class="pro-card__meta">' +
              '<span>' + ui.stars(p.rating, 13) + " " + ui.rating(p.rating) + "</span>" +
              "<span>" + SG.icon("briefcase", 13) + ui.num(p.jobs_count) + " serviços</span>" +
              "<span>" + SG.icon("pin", 13) + ui.km(p.distance_km) + "</span>" +
              "<span>" + SG.icon("car", 13) + "chega em " + ui.eta(o.eta_minutes) + "</span>" +
              "<span>" + SG.icon("shield", 13) + p.experience_years + " anos de experiência</span>" +
            "</div>" +
            (o.message ? '<p class="sg-sm sg-muted" style="margin-top:12px;padding-left:12px;border-left:2px solid var(--sg-line)">' +
              ui.esc(o.message) + "</p>" : "") +
          "</div>" +
          '<div class="pro-card__price">' +
            '<div><div class="sg-xs sg-faint">Orçamento</div>' +
            '<div class="pro-card__value">' + ui.money(o.price) + "</div></div>" +
            '<div class="sg-row" style="gap:8px">' +
              '<a class="sg-btn sg-btn--secondary sg-btn--sm" href="#/profissional/' + p.id + '">Ver perfil</a>' +
              '<button class="sg-btn sg-btn--primary sg-btn--sm" data-accept="' + o.id + '">Escolher</button>' +
            "</div>" +
          "</div></div>";
      }

      function accept(offerId, btn) {
        var o = offers.filter(function (x) { return x.id === offerId; })[0];
        ui.confirm({
          title: "Contratar " + o.professional.full_name + "?",
          text: "Valor combinado: " + ui.money(o.price) + ". Os outros orçamentos serão recusados automaticamente.",
          okText: "Confirmar contratação"
        }).then(function (ok) {
          if (!ok) return;
          ui.busy(btn, true);
          api.offers.accept(offerId).then(function (bk) {
            ui.toast("Profissional contratado!", { type: "success", text: "Acompanhe o serviço em tempo real." });
            SG.router.go("/acompanhar/" + bk.id);
          }).catch(function (e) {
            ui.busy(btn, false);
            ui.toast(SG.explainError(e), { type: "error" });
          });
        });
      }

      paintSearching();
      api.offers.listByRequest(req.id).then(function (list) {
        offers = list;
        if (offers.length) paintOffers();
      });

      app.track(api.bus.on("offers:" + req.id, function (o) {
        if (offers.some(function (x) { return x.id === o.id; })) return;
        offers.push(o);
        paintOffers();
        ui.toast("Novo orçamento de " + o.professional.full_name, { type: "success", text: ui.money(o.price) });
      }));

      if (!api.isDemo) {
        var ch = SG.supabase.channel("offers-" + req.id)
          .on("postgres_changes",
            { event: "INSERT", schema: "public", table: "service_offers", filter: "request_id=eq." + req.id },
            function () {
              api.offers.listByRequest(req.id).then(function (list) {
                offers = list;
                paintOffers();
              });
            }).subscribe();
        app.track(function () { SG.supabase.removeChannel(ch); });
      }
    }
  };

  /* ==========================================================================
     ACOMPANHAMENTO DO SERVIÇO (cliente e profissional)
     ========================================================================== */
  var TIMELINE = [
    { status: "created", label: "Solicitação criada" },
    { status: "matched", label: "Profissional encontrado" },
    { status: "accepted", label: "Profissional aceitou" },
    { status: "on_the_way", label: "A caminho" },
    { status: "arrived", label: "Chegou ao local" },
    { status: "in_progress", label: "Serviço em andamento" },
    { status: "completed", label: "Serviço concluído" }
  ];

  SG.views.tracking = function (params) {
    var id = params.id;
    var isPro = app.state.role === "professional";
    app.setHeader("Acompanhamento", "Status em tempo real");
    app.view(ui.skeletonCard(2));

    function load() {
      api.bookings.get(id).then(function (bk) {
        if (!bk) return SG.router.go(isPro ? "/servicos" : "/atividade", true);
        render(bk);
      });
    }

    function stepIndex(bk) {
      var map = { accepted: 2, on_the_way: 3, arrived: 4, in_progress: 5, completed: 6, cancelled: 6 };
      return map[bk.status] !== undefined ? map[bk.status] : 2;
    }

    function render(bk) {
      var other = isPro ? bk.client : bk.professional;
      var idx = stepIndex(bk);
      var eventByStatus = {};
      (bk.events || []).forEach(function (e) { eventByStatus[e.status] = e; });

      app.setHeader(bk.request.title, ui.labels.bookingStatus[bk.status]);
      app.view(
        '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#' + (isPro ? "/servicos" : "/atividade") + '" style="margin-bottom:16px">' +
          SG.icon("arrowLeft", 15) + "Voltar</a>" +
        '<div class="sg-grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:24px" id="trkGrid">' +
          "<div>" +
            '<div class="sg-card" style="margin-bottom:16px">' +
              '<div class="sg-row sg-row--between" style="margin-bottom:20px">' +
                "<div>" +
                  '<div class="sg-eyebrow">' + ui.esc(bk.request.category ? bk.request.category.name : "") + "</div>" +
                  '<h3 style="margin-top:6px">' + ui.esc(bk.request.title) + "</h3>" +
                "</div>" + ui.statusBadge(bk.status) +
              "</div>" +
              '<div class="sg-map" style="height:220px;margin-bottom:20px">' +
                '<div class="sg-map__grid"></div>' +
                '<div class="sg-map__badge">' + SG.icon("pin", 12) + " " + ui.esc((bk.request.address || "").split("—")[0]) + "</div>" +
                (idx >= 4 ? "" : '<div class="sg-map__radar"></div><div class="sg-map__radar sg-map__radar--2"></div>') +
                '<div class="sg-map__pin sg-map__pin--me" style="left:34%;top:64%">' +
                  '<div class="sg-map__pin-dot">' + SG.icon("home", 15) + "</div>" +
                  '<div class="sg-map__pin-label">Você</div></div>' +
                '<div class="sg-map__pin" style="left:' + (idx >= 4 ? "40%" : "68%") + ';top:' + (idx >= 4 ? "60%" : "36%") + '">' +
                  '<div class="sg-map__pin-dot">' + (isPro ? "🧑" : "🔧") + "</div>" +
                  '<div class="sg-map__pin-label">' + ui.esc(String(other.full_name).split(" ")[0]) + "</div></div>" +
              "</div>" +
              '<div class="sg-timeline">' + TIMELINE.map(function (s, i) {
                var done = i < idx, current = i === idx;
                var ev = eventByStatus[s.status];
                return '<div class="sg-timeline__item ' + (done ? "is-done" : "") + (current ? " is-current" : "") + '">' +
                  '<div class="sg-timeline__title">' + s.label + "</div>" +
                  '<div class="sg-timeline__time">' +
                    (ev ? ui.dateTime(ev.created_at) : i === 0 ? ui.dateTime(bk.request.created_at) : done ? "concluído" : "aguardando") +
                  "</div></div>";
              }).join("") + "</div>" +
            "</div>" +
            '<div id="trkActions"></div>' +
          "</div>" +
          "<div>" +
            '<div class="sg-card">' +
              '<div class="sg-eyebrow" style="margin-bottom:14px">' + (isPro ? "Cliente" : "Profissional") + "</div>" +
              '<div class="sg-row">' + ui.avatar(other, "lg") +
                '<div style="min-width:0"><div class="sg-strong">' + ui.esc(other.full_name) + "</div>" +
                '<div class="sg-xs sg-dim">' + ui.esc(isPro ? (bk.request.address || "") : (other.headline || "")) + "</div></div></div>" +
              (!isPro ? '<div class="sg-row" style="gap:16px;margin-top:14px">' +
                '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + ui.stars(other.rating, 12) + ui.rating(other.rating) + "</span>" +
                '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon("briefcase", 12) + ui.num(other.jobs_count) + " serviços</span></div>" : "") +
              '<div class="sg-row" style="gap:8px;margin-top:18px">' +
                '<a class="sg-btn sg-btn--secondary sg-btn--sm" style="flex:1" href="#/mensagens/' + bk.request_id + '">' +
                  SG.icon("chat", 15) + "Conversar</a>" +
                (!isPro ? '<a class="sg-btn sg-btn--outline sg-btn--sm" href="#/profissional/' + other.id + '">Perfil</a>' : "") +
              "</div>" +
              '<div class="sg-divider"></div>' +
              '<div class="sg-row sg-row--between"><span class="sg-md sg-dim">Valor combinado</span>' +
                '<span class="sg-display" style="font-size:1.25rem">' + ui.money(bk.price) + "</span></div>" +
              (isPro ? '<div class="sg-row sg-row--between" style="margin-top:8px">' +
                '<span class="sg-sm sg-faint">Taxa ServeGo (' + SG.config.app.platformFeePercent + "%)</span>" +
                '<span class="sg-sm sg-faint">− ' + ui.money(bk.price * SG.config.app.platformFeePercent / 100) + "</span></div>" +
                '<div class="sg-row sg-row--between" style="margin-top:6px"><span class="sg-md sg-strong">Você recebe</span>' +
                '<span class="sg-md sg-strong sg-brand-text">' +
                ui.money(bk.price * (1 - SG.config.app.platformFeePercent / 100)) + "</span></div>" : "") +
            "</div>" +
            '<div class="sg-card" style="margin-top:16px">' +
              '<div class="sg-row" style="margin-bottom:10px">' + SG.icon("shield", 17) + '<strong class="sg-md">Segurança</strong></div>' +
              '<p class="sg-sm sg-dim">Combine tudo pelo chat do ServeGo. Isso garante seu histórico em caso de disputa.</p>' +
              '<button class="sg-btn sg-btn--ghost sg-btn--sm sg-btn--block" style="margin-top:12px" data-report>' +
                SG.icon("flag", 15) + "Denunciar um problema</button>" +
            "</div>" +
          "</div>" +
        "</div>",
        { className: "app-view--wide" }
      );
      if (window.innerWidth < 1000) ui.$("#trkGrid").style.gridTemplateColumns = "minmax(0,1fr)";

      renderActions(bk);
      bindReport(bk);
    }

    function renderActions(bk) {
      var host = ui.$("#trkActions");
      if (bk.status === "cancelled") {
        host.innerHTML = '<div class="sg-card"><div class="sg-row">' + SG.icon("ban", 18) +
          "<div><strong>Serviço cancelado</strong>" +
          (bk.cancel_reason ? '<div class="sg-sm sg-dim">' + ui.esc(bk.cancel_reason) + "</div>" : "") +
          "</div></div></div>";
        return;
      }

      if (isPro) {
        var next = { accepted: "on_the_way", on_the_way: "arrived", arrived: "in_progress", in_progress: "completed" }[bk.status];
        var labels = {
          on_the_way: "Estou a caminho", arrived: "Cheguei ao local",
          in_progress: "Iniciar o serviço", completed: "Concluir serviço"
        };
        host.innerHTML = '<div class="sg-card">' +
          '<div class="sg-row sg-row--between" style="gap:12px;flex-wrap:wrap">' +
            '<div><strong class="sg-md">Atualize o cliente</strong>' +
            '<div class="sg-sm sg-dim">Manter o status atualizado aumenta sua nota de confiança.</div></div>' +
            '<div class="sg-row" style="gap:8px">' +
              (next ? '<button class="sg-btn sg-btn--primary" data-next="' + next + '">' + labels[next] + "</button>" : "") +
              (bk.status !== "completed" ? '<button class="sg-btn sg-btn--ghost sg-btn--sm" data-cancel>Cancelar</button>' : "") +
            "</div></div></div>";
      } else if (bk.status === "completed" && !bk.review) {
        host.innerHTML = '<div class="sg-card sg-card--brand">' +
          '<div class="sg-row sg-row--between" style="gap:12px;flex-wrap:wrap">' +
            "<div><strong>Como foi o serviço?</strong>" +
            '<div class="sg-sm sg-dim">Sua avaliação ajuda outros clientes a escolherem melhor.</div></div>' +
            '<button class="sg-btn sg-btn--primary" data-review>Avaliar profissional</button></div></div>';
      } else if (bk.status === "completed" && bk.review) {
        host.innerHTML = '<div class="sg-card"><div class="sg-row" style="gap:12px">' +
          ui.stars(bk.review.rating, 18) +
          '<span class="sg-md sg-muted">' + ui.esc(bk.review.comment || "Você já avaliou este serviço.") + "</span></div></div>";
      } else {
        host.innerHTML = '<div class="sg-card">' +
          '<div class="sg-row sg-row--between" style="gap:12px;flex-wrap:wrap">' +
            "<div><strong class=\"sg-md\">Precisa de algo?</strong>" +
            '<div class="sg-sm sg-dim">Fale com o profissional ou cancele se não precisar mais.</div></div>' +
            '<div class="sg-row" style="gap:8px">' +
              '<a class="sg-btn sg-btn--secondary sg-btn--sm" href="#/mensagens/' + bk.request_id + '">Abrir chat</a>' +
              '<button class="sg-btn sg-btn--ghost sg-btn--sm" data-cancel>Cancelar serviço</button>' +
            "</div></div></div>";
      }

      var nextBtn = ui.$("[data-next]", host);
      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          ui.busy(nextBtn, true);
          api.bookings.updateStatus(bk.id, nextBtn.getAttribute("data-next")).then(function () {
            ui.toast("Status atualizado", { type: "success" });
            load();
          });
        });
      }
      var cancelBtn = ui.$("[data-cancel]", host);
      if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
          ui.confirm({
            title: "Cancelar este serviço?",
            text: "Cancelamentos frequentes afetam sua reputação no ServeGo.",
            okText: "Sim, cancelar", danger: true
          }).then(function (ok) {
            if (!ok) return;
            api.bookings.cancel(bk.id, "Cancelado pelo " + (isPro ? "profissional" : "cliente")).then(function () {
              ui.toast("Serviço cancelado", { type: "info" });
              load();
            });
          });
        });
      }
      var reviewBtn = ui.$("[data-review]", host);
      if (reviewBtn) reviewBtn.addEventListener("click", function () { openReview(bk); });
    }

    function openReview(bk) {
      var rating = 5;
      var tags = [];
      var TAGS = ["Pontual", "Caprichoso", "Preço justo", "Educado", "Resolutivo", "Limpo"];
      var m = ui.modal({
        title: "Avaliar " + bk.professional.full_name,
        body:
          '<div style="text-align:center">' +
            '<div class="sg-rate" id="rateStars"></div>' +
            '<div class="sg-md sg-dim" id="rateLabel" style="margin-top:10px">Excelente</div>' +
          "</div>" +
          '<div class="sg-divider"></div>' +
          '<div class="sg-field__label" style="margin-bottom:10px">O que se destacou?</div>' +
          '<div class="sg-row sg-row--wrap" id="rateTags" style="gap:8px">' +
            TAGS.map(function (t) { return '<button class="sg-chip" data-tag="' + t + '">' + t + "</button>"; }).join("") +
          "</div>" +
          '<div class="sg-field" style="margin-top:20px"><label class="sg-field__label">Comentário (opcional)</label>' +
          '<textarea class="sg-textarea" id="rateComment" placeholder="Conte como foi o atendimento…"></textarea></div>',
        footer: '<button class="sg-btn sg-btn--ghost" data-close>Agora não</button>' +
          '<button class="sg-btn sg-btn--primary" data-send>Enviar avaliação</button>'
      });

      function paintStars() {
        ui.$("#rateStars").innerHTML = [1, 2, 3, 4, 5].map(function (i) {
          return '<button class="' + (i <= rating ? "is-on" : "") + '" data-star="' + i + '">' + SG.starIcon(i <= rating, 34) + "</button>";
        }).join("");
        var labels = { 1: "Ruim", 2: "Regular", 3: "Bom", 4: "Muito bom", 5: "Excelente" };
        ui.$("#rateLabel").textContent = labels[rating];
        ui.$$("#rateStars [data-star]").forEach(function (b) {
          b.addEventListener("click", function () { rating = +b.getAttribute("data-star"); paintStars(); });
        });
      }
      paintStars();

      ui.on(m.el, "click", "[data-tag]", function (e, el) {
        var t = el.getAttribute("data-tag");
        var i = tags.indexOf(t);
        if (i >= 0) { tags.splice(i, 1); el.classList.remove("is-active"); }
        else { tags.push(t); el.classList.add("is-active"); }
      });

      m.el.querySelector("[data-send]").addEventListener("click", function () {
        var btn = this;
        ui.busy(btn, true);
        api.reviews.create({
          booking_id: bk.id, request_id: bk.request_id, client_id: bk.client_id,
          professional_id: bk.professional_id, rating: rating,
          comment: ui.$("#rateComment").value.trim() || null, tags: tags
        }).then(function () {
          m.close();
          ui.toast("Avaliação enviada. Obrigado!", { type: "success" });
          load();
        });
      });
    }

    function bindReport(bk) {
      ui.$("[data-report]").addEventListener("click", function () {
        var m = ui.modal({
          title: "Denunciar um problema",
          body:
            '<div class="sg-field"><label class="sg-field__label">Motivo</label>' +
            '<select class="sg-select" id="rpReason">' +
              ["Não compareceu", "Serviço mal executado", "Cobrança indevida", "Comportamento inadequado", "Outro"]
                .map(function (r) { return "<option>" + r + "</option>"; }).join("") +
            "</select></div>" +
            '<div class="sg-field" style="margin-top:16px"><label class="sg-field__label">Descreva o que aconteceu</label>' +
            '<textarea class="sg-textarea" id="rpDesc" placeholder="Quanto mais detalhes, mais rápido conseguimos ajudar."></textarea></div>',
          footer: '<button class="sg-btn sg-btn--ghost" data-close>Cancelar</button>' +
            '<button class="sg-btn sg-btn--danger" data-send>Enviar denúncia</button>'
        });
        m.el.querySelector("[data-send]").addEventListener("click", function () {
          ui.busy(this, true);
          api.reports.create({
            reporter_id: app.state.me.id,
            target_user_id: isPro ? bk.client_id : bk.professional_id,
            booking_id: bk.id,
            reason: ui.$("#rpReason").value,
            description: ui.$("#rpDesc").value.trim()
          }).then(function () {
            m.close();
            ui.toast("Denúncia registrada", { type: "success", text: "Nossa equipe vai analisar em até 24h." });
          });
        });
      });
    }

    load();
    app.track(api.bookings.subscribe(id, function () { load(); }));
  };

  /* ==========================================================================
     FAVORITOS
     ========================================================================== */
  SG.views.favorites = function () {
    app.setHeader("Favoritos", "Profissionais que você salvou");
    app.view('<div class="app-page-head"><h1>Profissionais favoritos</h1>' +
      "<p>Chame de novo quem já resolveu bem.</p></div>" +
      '<div id="favList">' + ui.skeletonCard(2) + "</div>");
    api.favorites.list(app.state.me.id).then(function (list) {
      ui.$("#favList").innerHTML = list.length
        ? '<div class="sg-grid sg-grid--3">' + list.map(miniProCard).join("") + "</div>"
        : ui.empty("♡", "Nenhum favorito ainda",
            "Salve um profissional no perfil dele para chamá-lo com um toque na próxima vez.",
            '<a class="sg-btn sg-btn--primary" href="#/categorias">Explorar categorias</a>');
    });
  };

  /* ==========================================================================
     AJUDA
     ========================================================================== */
  SG.views.help = function () {
    app.setHeader("Ajuda e suporte", "Estamos por aqui");
    var faqs = [
      ["Como funciona o pagamento?", "O valor combinado é liberado ao profissional somente após a conclusão do serviço. A ServeGo retém uma taxa de " + SG.config.app.platformFeePercent + "% sobre cada serviço."],
      ["E se o profissional não aparecer?", "Você pode cancelar sem custo e abrir uma denúncia. O profissional perde pontos de confiança e pode ser suspenso."],
      ["Como sei que o profissional é confiável?", "Todo profissional passa por verificação de documentos. O selo Verificado só aparece após aprovação da nossa equipe."],
      ["Posso remarcar um serviço?", "Sim. Combine a nova data pelo chat — o histórico fica registrado para sua segurança."],
      ["Como me torno um profissional ServeGo?", "Crie uma conta escolhendo “Sou profissional”, envie seus documentos e escolha suas especialidades."]
    ];
    app.view('<div class="app-page-head"><h1>Ajuda e suporte</h1><p>Dúvidas frequentes e canais de atendimento.</p></div>' +
      '<div class="sg-grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:24px">' +
        '<div class="sg-stack">' + faqs.map(function (f) {
          return '<div class="sg-card"><strong class="sg-md">' + f[0] + "</strong>" +
            '<p class="sg-sm sg-dim" style="margin-top:8px">' + f[1] + "</p></div>";
        }).join("") + "</div>" +
        '<div><div class="sg-card">' +
          '<div class="sg-row" style="margin-bottom:12px">' + SG.icon("mail", 18) + "<strong>Fale com a gente</strong></div>" +
          '<p class="sg-sm sg-dim">Respondemos em até 24 horas úteis.</p>' +
          '<a class="sg-btn sg-btn--primary sg-btn--block" style="margin-top:16px" href="mailto:' +
            SG.config.app.supportEmail + '">' + SG.config.app.supportEmail + "</a>" +
        "</div>" +
        '<div class="sg-card" style="margin-top:16px"><div class="sg-row" style="margin-bottom:12px">' +
          SG.icon("alert", 18) + "<strong>Emergência</strong></div>" +
          '<p class="sg-sm sg-dim">Para riscos imediatos (vazamento de gás, curto-circuito, alagamento), marque a urgência como “Agora” ao solicitar — priorizamos o envio para profissionais de plantão.</p></div></div>' +
      "</div>", { className: "app-view--wide" });
  };
})(window.SG);
