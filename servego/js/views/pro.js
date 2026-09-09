/* ==========================================================================
   ServeGo — Telas do profissional
   Painel, oportunidades, orçamentos, serviços, ganhos e avaliações.
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  function firstName(n) { return String(n || "").split(" ")[0]; }
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }

  function metric(label, value, sub, tone) {
    return '<div class="sg-card"><div class="sg-metric">' +
      '<span class="sg-metric__label">' + label + "</span>" +
      '<span class="sg-metric__value' + (tone === "brand" ? " sg-brand-text" : "") + '">' + value + "</span>" +
      (sub ? '<span class="sg-xs sg-dim">' + sub + "</span>" : "") +
      "</div></div>";
  }

  function opportunityCard(r) {
    var urg = r.urgency === "now";
    return '<div class="sg-card sg-card--hover' + (urg ? " sg-card--brand" : "") + '">' +
      '<div class="sg-row sg-row--between" style="align-items:flex-start">' +
        '<div class="sg-row" style="min-width:0">' +
          '<span class="sg-avatar sg-avatar--lg" style="font-size:22px">' + ((r.category && r.category.icon) || "🛠") + "</span>" +
          '<div style="min-width:0">' +
            '<div class="sg-row" style="gap:8px"><span class="sg-strong sg-truncate">' + ui.esc(r.title) + "</span>" +
              (urg ? '<span class="sg-badge sg-badge--brand">⚡ Urgente</span>' : "") + "</div>" +
            '<div class="sg-xs sg-dim" style="margin-top:3px">' + ui.since(r.created_at) + " · " +
              ui.esc((r.category && r.category.name) || "") + "</div>" +
          "</div></div>" +
        (r.my_offer ? '<span class="sg-badge sg-badge--info">Orçamento enviado</span>' : "") +
      "</div>" +
      '<p class="sg-sm sg-muted sg-clamp-2" style="margin-top:14px">' + ui.esc(r.description) + "</p>" +
      '<div class="sg-row sg-row--between" style="margin-top:16px;flex-wrap:wrap;gap:12px">' +
        '<div class="sg-row" style="gap:16px;flex-wrap:wrap">' +
          '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon("pin", 13) + ui.km(r.distance_km) + "</span>" +
          '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon("clock", 13) +
            (ui.labels.urgency[r.urgency] || "") + "</span>" +
          (r.budget_hint ? '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon("wallet", 13) +
            "cliente prevê " + ui.money(r.budget_hint) + "</span>" : "") +
        "</div>" +
        '<a class="sg-btn ' + (r.my_offer ? "sg-btn--secondary" : "sg-btn--primary") + ' sg-btn--sm" href="#/oportunidade/' + r.id + '">' +
          (r.my_offer ? "Ver solicitação" : "Enviar orçamento") + "</a>" +
      "</div></div>";
  }

  /* ==========================================================================
     PAINEL DO PROFISSIONAL
     ========================================================================== */
  SG.views.proHome = function () {
    var me = app.state.me;
    var pro = me.professional || {};
    app.setHeader("Painel", greeting() + ", " + firstName(me.full_name));

    app.view(
      '<div class="app-page-head">' +
        "<h1>" + greeting() + ", " + ui.esc(firstName(me.full_name)) + ".</h1>" +
        "<p id=\"availText\">" + (pro.is_available
          ? "Você está disponível para novos serviços."
          : "Você está offline — ative a disponibilidade para receber solicitações.") + "</p>" +
      "</div>" +
      (pro.verification_status !== "approved"
        ? '<div class="sg-card sg-card--brand" style="margin-bottom:24px"><div class="sg-row">' +
          SG.icon("shield", 20) + "<div><strong>Cadastro em análise</strong>" +
          '<div class="sg-sm sg-dim">Assim que aprovarmos seus documentos, você passa a aparecer nas buscas com o selo Verificado.</div>' +
          "</div></div></div>"
        : "") +
      '<div class="sg-grid sg-grid--4" id="proMetrics">' + ui.skeletonCard(1) + "</div>" +
      '<div class="sg-grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px;margin-top:24px" id="proGrid">' +
        '<div><div class="app-section-title"><h3>Solicitações próximas</h3>' +
          '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/oportunidades">Ver todas</a></div>' +
          '<div id="proOpps">' + ui.skeletonCard(2) + "</div></div>" +
        '<div><div class="app-section-title"><h3>Sua agenda</h3></div>' +
          '<div id="proAgenda">' + ui.skeletonCard(1) + "</div>" +
          '<div class="app-section-title"><h3>Mapa de oportunidades</h3></div>' +
          '<div class="sg-map" style="height:262px">' +
            '<div class="sg-map__grid"></div>' +
            '<div class="sg-map__badge">' + SG.icon("zap", 12) + ' <span id="mapCount">0</span> solicitações próximas</div>' +
            '<div class="sg-map__radar"></div><div class="sg-map__radar sg-map__radar--2"></div>' +
            '<div class="sg-map__pin sg-map__pin--me" style="left:48%;top:54%">' +
              '<div class="sg-map__pin-dot">' + SG.icon("briefcase", 14) + "</div>" +
              '<div class="sg-map__pin-label">Você</div></div>' +
            '<div class="sg-map__pin" style="left:24%;top:32%"><div class="sg-map__pin-dot">⚡</div>' +
              '<div class="sg-map__pin-label">1,8 km</div></div>' +
            '<div class="sg-map__pin" style="left:76%;top:38%"><div class="sg-map__pin-dot">💧</div>' +
              '<div class="sg-map__pin-label">3,2 km</div></div>' +
            '<div class="sg-map__pin" style="left:64%;top:66%"><div class="sg-map__pin-dot">❄️</div>' +
              '<div class="sg-map__pin-label">4,5 km</div></div>' +
          "</div></div>" +
      "</div>",
      { className: "app-view--wide" }
    );
    if (window.innerWidth < 1000) ui.$("#proGrid").style.gridTemplateColumns = "minmax(0,1fr)";

    Promise.all([
      api.earnings.get(me.id),
      api.requests.listOpportunities(me.id),
      api.bookings.listForUser(me.id, "professional")
    ]).then(function (res) {
      var earn = res[0], opps = res[1], bks = res[2];
      var today = bks.filter(function (b) {
        return ["accepted", "on_the_way", "arrived", "in_progress"].indexOf(b.status) >= 0;
      });

      ui.$("#proMetrics").innerHTML =
        metric("Solicitações próximas", ui.num(opps.length), opps.length ? "novas na sua região" : "") +
        metric("Serviços ativos", ui.num(today.length), today.length ? "em andamento agora" : "") +
        metric("Ganhos do mês", ui.money(earn.mes), "líquido após taxa", "brand") +
        metric("Sua nota", ui.rating(pro.rating || 0), ui.num(pro.reviews_count || 0) + " avaliações");

      ui.$("#mapCount").textContent = opps.length;

      ui.$("#proOpps").innerHTML = opps.length
        ? '<div class="sg-stack">' + opps.slice(0, 4).map(opportunityCard).join("") + "</div>"
        : ui.empty("📭", "Nenhuma solicitação agora",
            pro.is_available
              ? "Assim que alguém pedir um serviço da sua especialidade por perto, aparece aqui."
              : "Ative sua disponibilidade no topo da tela para receber solicitações.");

      ui.$("#proAgenda").innerHTML = today.length
        ? '<div class="sg-stack-sm">' + today.map(function (b) {
            return '<a class="sg-card sg-card--tight sg-card--hover" href="#/servico/' + b.id + '" style="display:block">' +
              '<div class="sg-row sg-row--between"><div class="sg-row" style="min-width:0">' +
              ui.avatar(b.client, "sm") + '<div style="min-width:0">' +
              '<div class="sg-sm sg-strong sg-truncate">' + ui.esc(b.request.title) + "</div>" +
              '<div class="sg-xs sg-dim">' + ui.esc(b.client.full_name) + "</div></div></div>" +
              ui.statusBadge(b.status) + "</div></a>";
          }).join("") + "</div>"
        : '<div class="sg-card"><p class="sg-sm sg-dim">Nenhum serviço agendado. Envie orçamentos para preencher sua agenda.</p></div>';
    });
  };

  /* ==========================================================================
     OPORTUNIDADES
     ========================================================================== */
  SG.views.proOpportunities = function () {
    app.setHeader("Oportunidades", "Solicitações abertas na sua região");
    app.view('<div class="app-page-head"><h1>Oportunidades</h1>' +
      "<p>Solicitações abertas compatíveis com suas especialidades.</p></div>" +
      '<div class="sg-row" id="oppFilters" style="margin-bottom:20px;gap:8px;flex-wrap:wrap">' +
        '<button class="sg-chip is-active" data-f="all">Todas</button>' +
        '<button class="sg-chip" data-f="now">⚡ Urgentes</button>' +
        '<button class="sg-chip" data-f="new">Sem orçamento meu</button>' +
        '<button class="sg-chip" data-f="near">Até 5 km</button>' +
      "</div>" +
      '<div id="oppList">' + ui.skeletonCard(3) + "</div>");

    var all = [];
    function paint(f) {
      var list = all.filter(function (r) {
        if (f === "now") return r.urgency === "now";
        if (f === "new") return !r.my_offer;
        if (f === "near") return r.distance_km <= 5;
        return true;
      });
      ui.$("#oppList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(opportunityCard).join("") + "</div>"
        : ui.empty("📭", "Nada por aqui agora", "Ajuste seus filtros ou amplie seu raio de atendimento no perfil.");
    }

    api.requests.listOpportunities(app.state.me.id).then(function (list) { all = list; paint("all"); });
    ui.on(ui.$("#oppFilters"), "click", "[data-f]", function (e, el) {
      ui.$$("#oppFilters .sg-chip").forEach(function (c) { c.classList.remove("is-active"); });
      el.classList.add("is-active");
      paint(el.getAttribute("data-f"));
    });
  };

  /* ==========================================================================
     DETALHE DA OPORTUNIDADE + ENVIO DE ORÇAMENTO
     ========================================================================== */
  SG.views.proOpportunity = function (params) {
    var me = app.state.me;
    app.setHeader("Solicitação");
    app.view(ui.skeletonCard(2));

    Promise.all([api.requests.get(params.id), api.offers.listMine(me.id)]).then(function (res) {
      var r = res[0];
      if (!r) return SG.router.go("/oportunidades", true);
      var mine = res[1].filter(function (o) { return o.request_id === r.id; })[0];
      app.setHeader(r.title, ui.esc(r.category ? r.category.name : ""));

      app.view(
        '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/oportunidades" style="margin-bottom:16px">' +
          SG.icon("arrowLeft", 15) + "Oportunidades</a>" +
        '<div class="sg-grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px" id="oppGrid">' +
          "<div>" +
            '<div class="sg-card">' +
              '<div class="sg-row sg-row--between" style="margin-bottom:18px">' +
                '<div class="sg-row"><span class="sg-avatar sg-avatar--lg" style="font-size:22px">' +
                  (r.category ? r.category.icon : "🛠") + "</span>" +
                  "<div><h3>" + ui.esc(r.title) + "</h3>" +
                  '<div class="sg-xs sg-dim">' + ui.since(r.created_at) + "</div></div></div>" +
                (r.urgency === "now" ? '<span class="sg-badge sg-badge--brand">⚡ Urgente</span>' : "") +
              "</div>" +
              '<p class="sg-muted" style="line-height:1.7">' + ui.esc(r.description) + "</p>" +
              (r.photos && r.photos.length
                ? '<div class="sg-divider"></div><div class="sg-field__label" style="margin-bottom:10px">Fotos do cliente</div>' +
                  '<div class="gallery">' + r.photos.map(function (p) {
                    return '<img src="' + p.url + '" alt="Foto do serviço" loading="lazy">';
                  }).join("") + "</div>"
                : "") +
              '<div class="sg-divider"></div>' +
              '<div class="sg-grid sg-grid--2" style="gap:14px">' +
                info("pin", "Local", r.address) +
                info("clock", "Quando", ui.labels.urgency[r.urgency] +
                  (r.scheduled_for ? " · " + ui.dateTime(r.scheduled_for) : "")) +
                info("wallet", "Orçamento previsto", r.budget_hint ? ui.money(r.budget_hint) : "Não informado") +
                info("users", "Concorrência", (r.offers_count || 0) + " orçamento(s) enviado(s)") +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div><div id="offerBox"></div>' +
            '<div class="sg-card" style="margin-top:16px">' +
              '<div class="sg-row" style="margin-bottom:10px">' + SG.icon("sparkle", 17) +
              '<strong class="sg-md">Orçamento inteligente</strong></div>' +
              '<p class="sg-sm sg-dim" id="smartHint">Calculando sugestão…</p>' +
            "</div></div>" +
        "</div>",
        { className: "app-view--wide" }
      );
      if (window.innerWidth < 1000) ui.$("#oppGrid").style.gridTemplateColumns = "minmax(0,1fr)";

      renderOfferBox(r, mine);
      renderSmartHint(r);
    });

    function info(icon, label, value) {
      return '<div class="sg-row sg-row--top" style="gap:10px">' +
        '<span style="color:var(--sg-text-4);margin-top:2px">' + SG.icon(icon, 16) + "</span>" +
        '<div><div class="sg-xs sg-faint">' + label + "</div>" +
        '<div class="sg-md">' + ui.esc(value || "—") + "</div></div></div>";
    }

    function renderSmartHint(r) {
      var pro = app.state.me.professional || {};
      var base = (r.category && r.category.price_from) || pro.base_price || 120;
      var top = (r.category && r.category.price_to) || base * 2;
      var suggestion = Math.round(((base + top) / 2.6 + (r.urgency === "now" ? 40 : 0)) / 5) * 5;
      ui.$("#smartHint").innerHTML =
        "Para esta categoria, orçamentos entre <b>" + ui.money(base, true) + "</b> e <b>" + ui.money(top, true) +
        "</b> são os mais aceitos. Considerando a urgência e sua nota, sugerimos <b class=\"sg-brand-text\">" +
        ui.money(suggestion) + "</b>.";
      var input = ui.$("#offPrice");
      if (input && !input.value) input.value = suggestion;
    }

    function renderOfferBox(r, mine) {
      var host = ui.$("#offerBox");
      if (mine) {
        host.innerHTML = '<div class="sg-card">' +
          '<div class="sg-card__head"><span class="sg-card__title">Seu orçamento</span>' +
            '<span class="sg-badge sg-badge--' + ui.statusTone(mine.status) + '">' +
            ui.labels.offerStatus[mine.status] + "</span></div>" +
          '<div class="sg-display" style="font-size:1.9rem">' + ui.money(mine.price) + "</div>" +
          '<p class="sg-sm sg-muted" style="margin-top:10px">' + ui.esc(mine.message || "") + "</p>" +
          '<div class="sg-divider"></div>' +
          '<a class="sg-btn sg-btn--secondary sg-btn--block" href="#/mensagens/' + r.id + '">' +
            SG.icon("chat", 16) + "Falar com o cliente</a></div>";
        return;
      }
      host.innerHTML = '<div class="sg-card">' +
        '<div class="sg-card__head"><span class="sg-card__title">Enviar orçamento</span></div>' +
        '<div class="sg-field"><label class="sg-field__label">Valor do serviço (R$)</label>' +
          '<input class="sg-input" id="offPrice" type="number" min="0" step="5" placeholder="0,00"></div>' +
        '<div class="sg-field" style="margin-top:14px"><label class="sg-field__label">Tempo até chegar (min)</label>' +
          '<input class="sg-input" id="offEta" type="number" min="5" step="5" value="30"></div>' +
        '<div class="sg-field" style="margin-top:14px"><label class="sg-field__label">Mensagem ao cliente</label>' +
          '<textarea class="sg-textarea" id="offMsg" placeholder="O que está incluso, garantia, material…"></textarea></div>' +
        '<button class="sg-btn sg-btn--primary sg-btn--block" id="offSend" style="margin-top:16px">Enviar orçamento</button>' +
        '<p class="sg-xs sg-faint" style="margin-top:12px">Taxa ServeGo de ' + SG.config.app.platformFeePercent +
          "% aplicada apenas quando o serviço é concluído.</p></div>";

      ui.$("#offSend").addEventListener("click", function () {
        var btn = this;
        var price = Number(ui.$("#offPrice").value);
        if (!price || price <= 0) return ui.toast("Informe o valor do orçamento", { type: "error" });
        ui.busy(btn, true);
        api.offers.create({
          request_id: r.id, professional_id: app.state.me.id, price: price,
          eta_minutes: Number(ui.$("#offEta").value) || 30,
          message: ui.$("#offMsg").value.trim() || null
        }).then(function () {
          ui.toast("Orçamento enviado!", { type: "success", text: "Você será avisado se o cliente aceitar." });
          SG.router.go("/orcamentos");
        }).catch(function (e) {
          ui.busy(btn, false);
          ui.toast(SG.explainError(e), { type: "error" });
        });
      });
    }
  };

  /* ==========================================================================
     MEUS ORÇAMENTOS
     ========================================================================== */
  SG.views.proOffers = function () {
    app.setHeader("Meus orçamentos", "Propostas enviadas");
    app.view('<div class="app-page-head"><h1>Meus orçamentos</h1>' +
      "<p>Acompanhe o que foi aceito, recusado ou ainda aguarda resposta.</p></div>" +
      '<div id="offList">' + ui.skeletonCard(3) + "</div>");

    api.offers.listMine(app.state.me.id).then(function (list) {
      ui.$("#offList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(function (o) {
            var r = o.request || {};
            return '<div class="sg-card sg-row sg-row--between" style="gap:16px;flex-wrap:wrap">' +
              '<div class="sg-row" style="min-width:0">' +
                '<span class="sg-avatar sg-avatar--lg" style="font-size:22px">' +
                  ((r.category && r.category.icon) || "🛠") + "</span>" +
                '<div style="min-width:0"><div class="sg-strong sg-truncate">' + ui.esc(r.title || "Solicitação") + "</div>" +
                '<div class="sg-xs sg-dim">Enviado ' + ui.since(o.created_at) + " · " +
                  ui.esc((r.category && r.category.name) || "") + "</div></div></div>" +
              '<div class="sg-row" style="gap:16px">' +
                '<div style="text-align:right"><div class="sg-xs sg-faint">Valor</div>' +
                  '<div class="sg-strong">' + ui.money(o.price) + "</div></div>" +
                '<span class="sg-badge sg-badge--' + ui.statusTone(o.status) + '">' +
                  ui.labels.offerStatus[o.status] + "</span>" +
                '<a class="sg-btn sg-btn--secondary sg-btn--sm" href="#/oportunidade/' + o.request_id + '">Abrir</a>' +
              "</div></div>";
          }).join("") + "</div>"
        : ui.empty("🧾", "Nenhum orçamento enviado",
            "Vá em Oportunidades e envie sua primeira proposta.",
            '<a class="sg-btn sg-btn--primary" href="#/oportunidades">Ver oportunidades</a>');
    });
  };

  /* ==========================================================================
     SERVIÇOS DO PROFISSIONAL
     ========================================================================== */
  SG.views.proBookings = function () {
    app.setHeader("Serviços", "Contratos ativos e histórico");
    app.view('<div class="app-page-head"><h1>Meus serviços</h1>' +
      "<p>Tudo o que você já executou ou está executando pelo ServeGo.</p></div>" +
      '<div class="sg-row" id="bkFilters" style="margin-bottom:20px;gap:8px;flex-wrap:wrap">' +
        '<button class="sg-chip is-active" data-f="active">Ativos</button>' +
        '<button class="sg-chip" data-f="completed">Concluídos</button>' +
        '<button class="sg-chip" data-f="all">Todos</button></div>' +
      '<div id="bkList">' + ui.skeletonCard(3) + "</div>");

    var all = [];
    function paint(f) {
      var list = all.filter(function (b) {
        if (f === "active") return ["accepted", "on_the_way", "arrived", "in_progress"].indexOf(b.status) >= 0;
        if (f === "completed") return b.status === "completed";
        return true;
      });
      ui.$("#bkList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(function (b) {
            return '<a class="sg-card sg-card--hover" href="#/servico/' + b.id + '" style="display:block">' +
              '<div class="sg-row sg-row--between" style="gap:16px;flex-wrap:wrap">' +
                '<div class="sg-row" style="min-width:0">' + ui.avatar(b.client, "lg") +
                  '<div style="min-width:0"><div class="sg-strong sg-truncate">' + ui.esc(b.request.title) + "</div>" +
                  '<div class="sg-xs sg-dim">' + ui.esc(b.client.full_name) + " · " + ui.dateTime(b.accepted_at) + "</div></div></div>" +
                '<div class="sg-row" style="gap:16px">' +
                  '<div style="text-align:right"><div class="sg-xs sg-faint">Você recebe</div>' +
                    '<div class="sg-strong">' + ui.money(b.price * (1 - SG.config.app.platformFeePercent / 100)) + "</div></div>" +
                  ui.statusBadge(b.status) + "</div></div></a>";
          }).join("") + "</div>"
        : ui.empty("🧰", "Nenhum serviço nesta aba", "Envie orçamentos para conseguir novos contratos.");
    }

    api.bookings.listForUser(app.state.me.id, "professional").then(function (list) { all = list; paint("active"); });
    ui.on(ui.$("#bkFilters"), "click", "[data-f]", function (e, el) {
      ui.$$("#bkFilters .sg-chip").forEach(function (c) { c.classList.remove("is-active"); });
      el.classList.add("is-active");
      paint(el.getAttribute("data-f"));
    });
  };

  /* ==========================================================================
     GANHOS
     ========================================================================== */
  SG.views.proEarnings = function () {
    app.setHeader("Ganhos", "Sua carteira no ServeGo");
    app.view('<div class="app-page-head"><h1>Ganhos</h1>' +
      "<p>Valores líquidos, já descontada a taxa de " + SG.config.app.platformFeePercent + "%.</p></div>" +
      '<div class="sg-grid sg-grid--4" id="earnMetrics">' + ui.skeletonCard(1) + "</div>" +
      '<div class="sg-grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px;margin-top:24px" id="earnGrid">' +
        '<div class="sg-card"><div class="sg-card__head"><span class="sg-card__title">Últimos 7 dias</span>' +
          '<span class="sg-badge" id="earnWeekBadge">—</span></div>' +
          '<div id="earnChart"><div class="sg-skel sg-skel--block"></div></div></div>' +
        '<div class="sg-card"><div class="sg-card__head"><span class="sg-card__title">Resumo</span></div>' +
          '<div id="earnSummary">' + ui.skeletonCard(1) + "</div></div>" +
      "</div>" +
      '<div class="app-section-title"><h3>Lançamentos</h3></div>' +
      '<div id="earnTx">' + ui.skeletonCard(2) + "</div>",
      { className: "app-view--wide" });
    if (window.innerWidth < 1000) ui.$("#earnGrid").style.gridTemplateColumns = "minmax(0,1fr)";

    Promise.all([api.earnings.get(app.state.me.id), api.earnings.transactions(app.state.me.id)])
      .then(function (res) {
        var e = res[0], tx = res[1];
        ui.$("#earnMetrics").innerHTML =
          metric("Hoje", ui.money(e.hoje)) +
          metric("Esta semana", ui.money(e.semana)) +
          metric("Este mês", ui.money(e.mes), "", "brand") +
          metric("Serviços concluídos", ui.num(e.servicos_concluidos));

        ui.$("#earnWeekBadge").textContent = ui.money(e.semana);
        ui.$("#earnChart").innerHTML = chart(e.ultimos_7_dias || []);

        ui.$("#earnSummary").innerHTML =
          row("Total recebido", ui.money(e.total)) +
          row("A receber", ui.money(e.a_receber)) +
          row("Taxa ServeGo", SG.config.app.platformFeePercent + "%") +
          '<div class="sg-divider"></div>' +
          '<p class="sg-xs sg-faint">Os repasses são liberados em até 2 dias úteis após a conclusão do serviço. ' +
          "A estrutura já está pronta para integrar um provedor de pagamentos (split, antecipação e assinatura).</p>";

        ui.$("#earnTx").innerHTML = tx.length
          ? '<div class="sg-table-wrap"><table class="sg-table"><thead><tr>' +
            "<th>Data</th><th>Serviço</th><th>Valor</th><th>Taxa</th><th>Líquido</th><th>Status</th>" +
            "</tr></thead><tbody>" + tx.map(function (t) {
              return "<tr><td>" + ui.date(t.created_at) + "</td>" +
                "<td>" + ui.esc(t.booking_id) + "</td>" +
                "<td>" + ui.money(t.amount) + "</td>" +
                '<td class="sg-dim">− ' + ui.money(t.platform_fee) + "</td>" +
                '<td class="sg-strong">' + ui.money(t.net_amount) + "</td>" +
                '<td><span class="sg-badge sg-badge--' + (t.status === "released" ? "success" : "info") + '">' +
                  (t.status === "released" ? "Liberado" : t.status === "pending" ? "Pendente" : "Estornado") +
                "</span></td></tr>";
            }).join("") + "</tbody></table></div>"
          : ui.empty("💳", "Sem lançamentos ainda", "Conclua um serviço para ver seus repasses aqui.");
      });

    function row(label, value) {
      return '<div class="sg-row sg-row--between" style="padding:9px 0">' +
        '<span class="sg-md sg-dim">' + label + '</span><span class="sg-md sg-strong">' + value + "</span></div>";
    }

    function chart(serie) {
      if (!serie.length) return ui.empty("📈", "Sem dados", "");
      var w = 620, h = 190, pad = 26;
      var max = Math.max.apply(null, serie.map(function (d) { return Number(d.valor) || 0; })) || 1;
      var bw = (w - pad * 2) / serie.length;
      var bars = serie.map(function (d, i) {
        var v = Number(d.valor) || 0;
        var bh = Math.max(3, (v / max) * (h - pad * 2));
        var x = pad + i * bw + bw * 0.22;
        var y = h - pad - bh;
        var label = new Date(d.dia + "T12:00:00").toLocaleDateString(SG.config.app.locale, { weekday: "short" });
        return '<rect class="chart__bar" x="' + x + '" y="' + y + '" width="' + (bw * 0.56) + '" height="' + bh + '" rx="4">' +
          "<title>" + label + ": " + ui.money(v) + "</title></rect>" +
          '<text class="chart__label" x="' + (x + bw * 0.28) + '" y="' + (h - 8) + '" text-anchor="middle">' +
          label.replace(".", "") + "</text>";
      }).join("");
      var grid = [0, 0.25, 0.5, 0.75, 1].map(function (t) {
        var y = pad + t * (h - pad * 2);
        return '<line class="chart__grid" x1="' + pad + '" y1="' + y + '" x2="' + (w - pad) + '" y2="' + y + '"/>';
      }).join("");
      return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none">' +
        '<defs><linearGradient id="sgBarGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#ffc31a"/><stop offset="100%" stop-color="#f5a800"/></linearGradient></defs>' +
        grid + bars + "</svg>";
    }
  };

  /* ==========================================================================
     AVALIAÇÕES RECEBIDAS
     ========================================================================== */
  SG.views.proReviews = function () {
    var me = app.state.me;
    var pro = me.professional || {};
    app.setHeader("Avaliações", "O que os clientes dizem");
    app.view('<div class="app-page-head"><h1>Suas avaliações</h1>' +
      "<p>Responder avaliações aumenta sua taxa de contratação.</p></div>" +
      '<div class="sg-grid" style="grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:24px" id="revGrid">' +
        '<div><div class="sg-card" id="revSummary">' + ui.skeletonCard(1) + "</div></div>" +
        '<div id="revList">' + ui.skeletonCard(3) + "</div>" +
      "</div>", { className: "app-view--wide" });
    if (window.innerWidth < 900) ui.$("#revGrid").style.gridTemplateColumns = "minmax(0,1fr)";

    api.reviews.listByProfessional(me.id).then(function (list) {
      var d = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      list.forEach(function (r) { d[r.rating] = (d[r.rating] || 0) + 1; });
      var total = list.length || 1;
      var avg = list.length
        ? Math.round((list.reduce(function (s, r) { return s + r.rating; }, 0) / list.length) * 100) / 100
        : (pro.rating || 0);

      ui.$("#revSummary").innerHTML =
        '<div style="text-align:center;padding:8px 0 16px">' +
          '<div class="sg-display" style="font-size:3rem;line-height:1">' + ui.rating(avg) + "</div>" +
          '<div style="margin:8px 0">' + ui.stars(avg, 18) + "</div>" +
          '<div class="sg-xs sg-dim">' + list.length + " avaliações</div></div>" +
        '<div class="rating-breakdown">' + [5, 4, 3, 2, 1].map(function (n) {
          var pct = Math.round((d[n] / total) * 100);
          return '<div class="rating-breakdown__row"><span>' + n + "★</span>" +
            '<span class="sg-bar"><span class="sg-bar__fill" style="width:' + pct + '%"></span></span>' +
            "<span>" + d[n] + "</span></div>";
        }).join("") + "</div>";

      ui.$("#revList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(function (r) {
            return '<div class="sg-card" data-review="' + r.id + '">' +
              '<div class="sg-row sg-row--between">' +
                '<div class="sg-row">' + ui.avatar(r.client, "sm") +
                  '<div><div class="sg-sm sg-strong">' + ui.esc((r.client && r.client.full_name) || "Cliente") + "</div>" +
                  '<div class="sg-xs sg-faint">' + ui.date(r.created_at) + "</div></div></div>" +
                ui.stars(r.rating, 14) + "</div>" +
              (r.comment ? '<p class="sg-md sg-muted" style="margin-top:12px">' + ui.esc(r.comment) + "</p>" : "") +
              (r.reply
                ? '<div style="margin-top:12px;padding:12px;border-left:2px solid var(--sg-brand-line);background:var(--sg-surface-2);border-radius:0 8px 8px 0">' +
                  '<div class="sg-xs sg-brand-text sg-strong">Sua resposta</div>' +
                  '<div class="sg-sm sg-muted" style="margin-top:4px">' + ui.esc(r.reply) + "</div></div>"
                : '<button class="sg-btn sg-btn--ghost sg-btn--sm" style="margin-top:12px" data-reply="' + r.id + '">' +
                  SG.icon("chat", 15) + "Responder</button>") +
              "</div>";
          }).join("") + "</div>"
        : ui.empty("⭐", "Nenhuma avaliação ainda", "Conclua serviços para começar a construir sua reputação.");

      ui.$$("[data-reply]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-reply");
          var m = ui.modal({
            title: "Responder avaliação",
            body: '<div class="sg-field"><label class="sg-field__label">Sua resposta pública</label>' +
              '<textarea class="sg-textarea" id="replyText" placeholder="Agradeça e esclareça o que for necessário."></textarea></div>',
            footer: '<button class="sg-btn sg-btn--ghost" data-close>Cancelar</button>' +
              '<button class="sg-btn sg-btn--primary" data-send>Publicar resposta</button>'
          });
          m.el.querySelector("[data-send]").addEventListener("click", function () {
            var text = ui.$("#replyText").value.trim();
            if (!text) return;
            ui.busy(this, true);
            api.reviews.reply(id, text).then(function () {
              m.close();
              ui.toast("Resposta publicada", { type: "success" });
              SG.views.proReviews();
            });
          });
        });
      });
    });
  };
})(window.SG);
