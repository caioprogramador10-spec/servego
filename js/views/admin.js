/* ==========================================================================
   ServeGo — Telas do administrador
   Métricas, usuários, profissionais, solicitações, avaliações, denúncias
   e categorias. Tudo consome SG.api (nunca o SDK direto).
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  /* Dicionário local: ui.labels não tem rótulos de denúncia. */
  var REPORT_STATUS = {
    open: "Aberta",
    reviewing: "Em análise",
    resolved: "Resolvida",
    dismissed: "Descartada"
  };

  var ROLE_LABEL = { client: "Cliente", professional: "Profissional", admin: "Administrador" };

  /* ==========================================================================
     HELPERS COMPARTILHADOS
     ========================================================================== */

  /** Chip de filtro (mesmo padrão das telas do cliente). */
  function chip(value, label, active) {
    return '<button class="sg-chip ' + (active ? "is-active" : "") + '" data-chip="' + ui.esc(value) + '">' +
      ui.esc(label) + "</button>";
  }

  /** Linha de chips já com o container. */
  function chipRow(id, items, activeValue) {
    return '<div class="sg-row sg-row--wrap" id="' + id + '" style="gap:8px;margin-bottom:20px">' +
      items.map(function (it) { return chip(it[0], it[1], it[0] === activeValue); }).join("") +
      "</div>";
  }

  /** Liga a troca de chips de um container a um callback. */
  function bindChips(id, onChange) {
    var host = ui.$("#" + id);
    if (!host) return;
    ui.on(host, "click", "[data-chip]", function (e, el) {
      ui.$$("#" + id + " .sg-chip").forEach(function (c) { c.classList.remove("is-active"); });
      el.classList.add("is-active");
      onChange(el.getAttribute("data-chip"));
    });
  }

  /** Cartão de métrica. */
  function metricCard(label, value, hint) {
    return '<div class="sg-card"><div class="sg-metric">' +
      '<span class="sg-metric__label">' + ui.esc(label) + "</span>" +
      '<span class="sg-metric__value">' + value + "</span>" +
      (hint ? '<span class="sg-xs sg-faint">' + ui.esc(hint) + "</span>" : "") +
      "</div></div>";
  }

  /** Badge de verificação do profissional. */
  function verificationBadge(status) {
    var tone = ui.statusTone(status);
    return '<span class="sg-badge' + (tone ? " sg-badge--" + tone : "") + '">' +
      ui.esc(ui.labels.verification[status] || status || "—") + "</span>";
  }

  /** Badge de status de conta. */
  function accountBadge(status) {
    return status === "blocked"
      ? '<span class="sg-badge sg-badge--danger">Bloqueado</span>'
      : '<span class="sg-badge sg-badge--success">Ativo</span>';
  }

  /** Chave AAAA-MM-DD de uma data. */
  function dayKey(v) {
    var d = new Date(v);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  /** Série dos últimos 7 dias a partir das solicitações. */
  function requestsSeries(requests) {
    var counts = {};
    (requests || []).forEach(function (r) {
      var k = dayKey(r.created_at);
      counts[k] = (counts[k] || 0) + 1;
    });
    var serie = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      var k2 = dayKey(d);
      serie.push({
        chave: k2,
        rotulo: d.toLocaleDateString(SG.config.app.locale, { weekday: "short" }).replace(".", ""),
        valor: counts[k2] || 0
      });
    }
    return serie;
  }

  /** Gráfico de barras em SVG puro (sem dependências externas). */
  function barChart(serie) {
    var W = 700, H = 190, topPad = 14, bottomPad = 26;
    var area = H - topPad - bottomPad;
    var max = 1;
    serie.forEach(function (d) { if (d.valor > max) max = d.valor; });

    var grid = "";
    for (var g = 0; g <= 3; g++) {
      var gy = topPad + (area / 3) * g;
      grid += '<line class="chart__grid" x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '"></line>';
    }

    var slot = W / serie.length;
    var barW = Math.min(52, Math.round(slot * 0.46));
    var bars = serie.map(function (d, i) {
      var h = Math.max(4, Math.round((area * d.valor) / max));
      var x = Math.round(slot * i + (slot - barW) / 2);
      var y = topPad + area - h;
      return '<rect class="chart__bar" x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="6">' +
        "<title>" + ui.esc(d.rotulo + ": " + d.valor + " solicitação" + (d.valor === 1 ? "" : "ões")) + "</title>" +
        "</rect>" +
        '<text class="chart__label" x="' + (x + barW / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' +
        ui.esc(d.rotulo) + "</text>";
    }).join("");

    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Solicitações dos últimos 7 dias">' +
      '<defs><linearGradient id="sgBarGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--sg-brand-2)"></stop>' +
      '<stop offset="100%" stop-color="var(--sg-brand)"></stop>' +
      "</linearGradient></defs>" +
      grid + bars + "</svg>";
  }

  /* ==========================================================================
     1. VISÃO GERAL (MÉTRICAS)
     ========================================================================== */
  SG.views.adminMetrics = function () {
    app.setHeader("Visão geral", "Saúde do marketplace ServeGo");
    app.view(
      '<div class="app-page-head"><h1>Visão geral</h1>' +
        "<p>Como o ServeGo está performando hoje.</p></div>" +
      '<div id="mtCards">' + ui.skeletonCard(2) + "</div>" +
      '<div id="mtChart"></div>' +
      '<div id="mtAttention"></div>',
      { className: "app-view--wide" }
    );

    api.admin.metrics().then(function (m) {
      m = m || {};
      var taxa = Number(m.taxa_conclusao || 0);
      ui.$("#mtCards").innerHTML =
        '<div class="sg-grid sg-grid--4">' +
          metricCard("Usuários", ui.num(m.total_usuarios), ui.num(m.total_clientes) + " clientes cadastrados") +
          metricCard("Profissionais", ui.num(m.total_profissionais), "Prestadores na plataforma") +
          metricCard("Serviços concluídos", ui.num(m.servicos_concluidos), "Desde o lançamento") +
          metricCard("Receita da plataforma", ui.money(m.receita_plataforma),
            "Volume de " + ui.money(m.volume_transacionado, true)) +
        "</div>" +
        '<div class="sg-grid sg-grid--4" style="margin-top:16px">' +
          metricCard("Solicitações totais", ui.num(m.total_solicitacoes), "Pedidos criados por clientes") +
          metricCard("Solicitações abertas", ui.num(m.solicitacoes_abertas), "Aguardando profissional") +
          metricCard("Taxa de conclusão", ui.rating(taxa) + "%", "Serviços finalizados com sucesso") +
          metricCard("Profissionais pendentes", ui.num(m.profissionais_pendentes), "Esperando aprovação") +
        "</div>";
    }).catch(function (e) {
      ui.$("#mtCards").innerHTML = ui.empty("⚠️", "Não foi possível carregar as métricas", SG.explainError(e));
    });

    // Gráfico: solicitações por dia (últimos 7 dias)
    api.requests.listAll().then(function (list) {
      var serie = requestsSeries(list);
      var total = serie.reduce(function (s, d) { return s + d.valor; }, 0);
      ui.$("#mtChart").innerHTML =
        '<div class="app-section-title"><h3>Solicitações por dia</h3></div>' +
        '<div class="sg-card">' +
          '<div class="sg-row sg-row--between" style="margin-bottom:18px">' +
            '<div><div class="sg-eyebrow">Últimos 7 dias</div>' +
            '<div class="sg-display" style="font-size:1.5rem;margin-top:6px">' + ui.num(total) + " solicitações</div></div>" +
            '<span class="sg-badge sg-badge--brand">' + SG.icon("trending", 12) + "Tempo real</span>" +
          "</div>" +
          barChart(serie) +
        "</div>";
    });

    // Painel "Precisa da sua atenção"
    var host = ui.$("#mtAttention");
    host.innerHTML =
      '<div class="app-section-title"><h3>Precisa da sua atenção</h3></div>' +
      '<div class="sg-grid sg-grid--2">' +
        '<div class="sg-panel"><div class="sg-panel__head">' +
          '<strong class="sg-md">Profissionais em análise</strong>' +
          '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/admin/profissionais">Ver todos</a></div>' +
          '<div class="sg-panel__body" id="mtPending">' + ui.skeletonCard(2) + "</div></div>" +
        '<div class="sg-panel"><div class="sg-panel__head">' +
          '<strong class="sg-md">Denúncias abertas</strong>' +
          '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/admin/denuncias">Ver todas</a></div>' +
          '<div class="sg-panel__body" id="mtReports">' + ui.skeletonCard(2) + "</div></div>" +
      "</div>";

    api.professionals.listAll({ status: "pending" }).then(function (list) {
      ui.$("#mtPending").innerHTML = list.length
        ? '<div class="sg-stack">' + list.slice(0, 5).map(function (p) {
            return '<div class="sg-row sg-row--between">' +
              '<div class="sg-row" style="min-width:0">' + ui.avatar(p, "sm") +
                '<div style="min-width:0"><div class="sg-md sg-strong sg-truncate">' + ui.esc(p.full_name) + "</div>" +
                '<div class="sg-xs sg-dim sg-truncate">' + ui.esc(p.headline || "") + "</div></div></div>" +
              '<a class="sg-btn sg-btn--outline sg-btn--sm" href="#/admin/profissionais">Analisar</a></div>';
          }).join("") + "</div>"
        : ui.empty("✅", "Nenhum cadastro pendente", "Todos os profissionais já foram analisados.");
    });

    api.admin.listReports().then(function (list) {
      var abertas = list.filter(function (r) { return r.status === "open" || r.status === "reviewing"; });
      ui.$("#mtReports").innerHTML = abertas.length
        ? '<div class="sg-stack">' + abertas.slice(0, 5).map(function (r) {
            return '<div class="sg-row sg-row--between">' +
              '<div style="min-width:0"><div class="sg-md sg-strong sg-truncate">' + ui.esc(r.reason) + "</div>" +
                '<div class="sg-xs sg-dim sg-truncate">' +
                ui.esc((r.target && r.target.full_name) || "Usuário") + " · " + ui.timeAgo(r.created_at) + "</div></div>" +
              '<a class="sg-btn sg-btn--outline sg-btn--sm" href="#/admin/denuncias">Revisar</a></div>';
          }).join("") + "</div>"
        : ui.empty("🛡", "Sem denúncias abertas", "A moderação está em dia.");
    });
  };

  /* ==========================================================================
     2. USUÁRIOS
     ========================================================================== */
  SG.views.adminUsers = function () {
    app.setHeader("Usuários", "Contas de clientes, profissionais e administradores");
    app.view(
      '<div class="app-page-head"><h1>Usuários</h1>' +
        "<p>Busque, filtre por papel e bloqueie contas com comportamento abusivo.</p></div>" +
      '<div class="sg-input-group" style="max-width:420px;margin-bottom:18px">' +
        '<span class="sg-input-group__icon">' + SG.icon("search", 17) + "</span>" +
        '<input class="sg-input" id="usrSearch" placeholder="Buscar por nome ou e-mail…">' +
      "</div>" +
      chipRow("usrFilters", [
        ["all", "Todos"], ["client", "Clientes"], ["professional", "Profissionais"], ["admin", "Admins"]
      ], "all") +
      '<div id="usrList">' + ui.skeletonCard(3) + "</div>",
      { className: "app-view--wide" }
    );

    var all = [];
    var role = "all";
    var query = "";

    function filtered() {
      var q = query.toLowerCase();
      return all.filter(function (u) {
        if (role !== "all" && u.role !== role) return false;
        if (!q) return true;
        return (u.full_name || "").toLowerCase().indexOf(q) >= 0 ||
          (u.email || "").toLowerCase().indexOf(q) >= 0;
      });
    }

    function actionCell(u) {
      var blocked = u.status === "blocked";
      return '<button class="sg-btn ' + (blocked ? "sg-btn--outline" : "sg-btn--danger") + ' sg-btn--sm" ' +
        'data-toggle="' + ui.esc(u.id) + '">' +
        SG.icon(blocked ? "check" : "ban", 14) + (blocked ? "Desbloquear" : "Bloquear") + "</button>";
    }

    function row(u) {
      return '<tr data-row="' + ui.esc(u.id) + '">' +
        '<td><div class="sg-row" style="min-width:0">' + ui.avatar(u, "sm") +
          '<div style="min-width:0"><div class="sg-md sg-strong sg-truncate">' + ui.esc(u.full_name || "—") + "</div>" +
          '<div class="sg-xs sg-dim sg-truncate">' + ui.esc(u.email || "") + "</div></div></div></td>" +
        '<td><span class="sg-badge">' + ui.esc(ROLE_LABEL[u.role] || u.role || "—") + "</span></td>" +
        '<td class="sg-md sg-dim">' + ui.esc((u.city || "—") + (u.state ? " · " + u.state : "")) + "</td>" +
        '<td class="sg-md sg-dim">' + ui.date(u.created_at) + "</td>" +
        '<td data-cell="status">' + accountBadge(u.status) + "</td>" +
        '<td data-cell="acao">' + actionCell(u) + "</td>" +
        "</tr>";
    }

    function paint() {
      var list = filtered();
      ui.$("#usrList").innerHTML = list.length
        ? '<div class="sg-table-wrap"><table class="sg-table"><thead><tr>' +
            "<th>Usuário</th><th>Papel</th><th>Cidade</th><th>Cadastro</th><th>Status</th><th>Ações</th>" +
            "</tr></thead><tbody>" + list.map(row).join("") + "</tbody></table></div>" +
          '<div class="sg-xs sg-faint" style="margin-top:12px">' + ui.num(list.length) +
            " usuário" + (list.length === 1 ? "" : "s") + " listado" + (list.length === 1 ? "" : "s") + "</div>"
        : ui.empty("🔍", "Nenhum usuário encontrado", "Tente outro termo de busca ou remova os filtros.");
    }

    api.admin.listUsers().then(function (list) {
      all = list;
      paint();
    });

    var input = ui.$("#usrSearch");
    input.addEventListener("input", ui.debounce(function () {
      query = input.value.trim();
      paint();
    }, 200));

    bindChips("usrFilters", function (value) {
      role = value;
      paint();
    });

    // Bloquear / desbloquear (delegação: sobrevive aos repaints)
    ui.on(ui.$("#usrList"), "click", "[data-toggle]", function (e, btn) {
      var id = btn.getAttribute("data-toggle");
      var u = all.filter(function (x) { return x.id === id; })[0];
      if (!u) return;
      var blocked = u.status === "blocked";
      var next = blocked ? "active" : "blocked";
      ui.confirm({
        title: blocked ? "Desbloquear conta?" : "Bloquear conta?",
        text: blocked
          ? u.full_name + " poderá entrar no ServeGo novamente."
          : u.full_name + " perderá o acesso imediatamente e não poderá contratar nem atender.",
        okText: blocked ? "Sim, desbloquear" : "Sim, bloquear",
        danger: !blocked
      }).then(function (ok) {
        if (!ok) return;
        ui.busy(btn, true);
        api.admin.setUserStatus(id, next).then(function () {
          u.status = next;
          var tr = ui.$('[data-row="' + id + '"]', ui.$("#usrList"));
          if (tr) {
            ui.$('[data-cell="status"]', tr).innerHTML = accountBadge(u.status);
            ui.$('[data-cell="acao"]', tr).innerHTML = actionCell(u);
          }
          ui.toast(blocked ? "Conta desbloqueada" : "Conta bloqueada", {
            type: blocked ? "success" : "info",
            text: u.full_name
          });
        }).catch(function (err) {
          ui.busy(btn, false);
          ui.toast(SG.explainError(err), { type: "error" });
        });
      });
    });
  };

  /* ==========================================================================
     3. PROFISSIONAIS
     ========================================================================== */
  SG.views.adminProfessionals = function () {
    app.setHeader("Profissionais", "Verificação e curadoria dos prestadores");
    app.view(
      '<div class="app-page-head"><h1>Profissionais</h1>' +
        "<p>Aprove cadastros, confira documentos e acompanhe a reputação.</p></div>" +
      chipRow("proFilters", [
        ["all", "Todos"], ["pending", "Em análise"], ["approved", "Aprovados"], ["rejected", "Rejeitados"]
      ], "all") +
      '<div class="sg-grid" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:24px" id="proGrid">' +
        '<div id="proList">' + ui.skeletonCard(3) + "</div>" +
        '<div id="proDocs"></div>' +
      "</div>",
      { className: "app-view--wide" }
    );
    if (window.innerWidth < 1000) ui.$("#proGrid").style.gridTemplateColumns = "minmax(0,1fr)";

    var all = [];
    var filter = "all";

    function card(p) {
      var pending = p.verification_status === "pending";
      return '<div class="sg-card" data-pro="' + ui.esc(p.id) + '">' +
        '<div class="sg-row sg-row--top sg-row--between" style="gap:14px">' +
          '<div class="sg-row sg-row--top" style="min-width:0">' + ui.avatar(p, "lg") +
            '<div style="min-width:0">' +
              '<div class="sg-row" style="gap:8px">' +
                '<span class="sg-strong sg-truncate">' + ui.esc(p.full_name || "—") + "</span>" +
                (p.verified ? '<span class="sg-badge sg-badge--brand">' + SG.icon("verified", 12) + "Verificado</span>" : "") +
              "</div>" +
              '<div class="sg-xs sg-dim sg-truncate" style="margin-top:3px">' + ui.esc(p.headline || "") + "</div>" +
              '<div class="sg-row sg-row--wrap" style="gap:14px;margin-top:10px">' +
                '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + ui.stars(p.rating, 13) +
                  ui.rating(p.rating || 0) + "</span>" +
                '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon("briefcase", 13) +
                  ui.num(p.jobs_count) + " serviços</span>" +
                '<span class="sg-row sg-xs sg-dim" style="gap:5px">' + SG.icon("pin", 13) +
                  ui.esc((p.city || "—") + (p.state ? " · " + p.state : "")) + "</span>" +
              "</div>" +
            "</div></div>" +
          '<div data-cell="verif">' + verificationBadge(p.verification_status) + "</div>" +
        "</div>" +
        '<div class="sg-row sg-row--wrap" style="gap:8px;margin-top:16px;justify-content:flex-end" data-cell="acoes">' +
          '<a class="sg-btn sg-btn--secondary sg-btn--sm" href="#/profissional/' + ui.esc(p.id) + '">Ver perfil</a>' +
          (p.verification_status !== "rejected"
            ? '<button class="sg-btn sg-btn--ghost sg-btn--sm" data-verify="rejected" data-id="' + ui.esc(p.id) + '">' +
              SG.icon("x", 14) + "Rejeitar</button>" : "") +
          (p.verification_status !== "approved"
            ? '<button class="sg-btn ' + (pending ? "sg-btn--primary" : "sg-btn--outline") + ' sg-btn--sm" ' +
              'data-verify="approved" data-id="' + ui.esc(p.id) + '">' + SG.icon("check", 14) + "Aprovar</button>" : "") +
        "</div></div>";
    }

    function paint() {
      var list = all.filter(function (p) {
        return filter === "all" || p.verification_status === filter;
      });
      ui.$("#proList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(card).join("") + "</div>"
        : ui.empty("🧰", "Nenhum profissional neste filtro", "Troque o filtro para ver outros cadastros.");
    }

    function load() {
      api.professionals.listAll().then(function (list) {
        all = list;
        paint();
      });
    }
    load();

    bindChips("proFilters", function (value) {
      filter = value;
      paint();
    });

    ui.on(ui.$("#proList"), "click", "[data-verify]", function (e, btn) {
      var id = btn.getAttribute("data-id");
      var status = btn.getAttribute("data-verify");
      var p = all.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var aprovar = status === "approved";
      ui.confirm({
        title: aprovar ? "Aprovar cadastro?" : "Rejeitar cadastro?",
        text: aprovar
          ? p.full_name + " passará a receber solicitações e ganha o selo Verificado."
          : p.full_name + " será avisado para revisar os documentos enviados.",
        okText: aprovar ? "Aprovar" : "Rejeitar",
        danger: !aprovar
      }).then(function (ok) {
        if (!ok) return;
        ui.busy(btn, true);
        api.admin.setVerification(id, status).then(function () {
          p.verification_status = status;
          p.verified = aprovar;
          paint();
          ui.toast(aprovar ? "Profissional aprovado" : "Cadastro rejeitado", {
            type: aprovar ? "success" : "info",
            text: p.full_name
          });
        }).catch(function (err) {
          ui.busy(btn, false);
          ui.toast(SG.explainError(err), { type: "error" });
        });
      });
    });

    // Documentos enviados, agrupados por profissional
    ui.$("#proDocs").innerHTML =
      '<div class="sg-panel"><div class="sg-panel__head">' +
        '<strong class="sg-md">Documentos enviados</strong>' +
        '<span class="sg-badge">' + SG.icon("doc", 12) + "Verificação</span></div>" +
        '<div class="sg-panel__body" id="proDocsBody">' + ui.skeletonCard(2) + "</div></div>";

    api.admin.listDocuments().then(function (docs) {
      var groups = [];
      var index = {};
      docs.forEach(function (d) {
        var key = d.professional_id;
        if (!index[key]) {
          index[key] = { id: key, professional: d.professional, items: [] };
          groups.push(index[key]);
        }
        index[key].items.push(d);
      });

      ui.$("#proDocsBody").innerHTML = groups.length
        ? '<div class="sg-stack">' + groups.map(function (g) {
            var nome = (g.professional && g.professional.full_name) || "Profissional";
            return "<div>" +
              '<div class="sg-row sg-row--between" style="margin-bottom:10px">' +
                '<div class="sg-row" style="min-width:0">' + ui.avatar(g.professional, "sm") +
                  '<div style="min-width:0"><div class="sg-md sg-strong sg-truncate">' + ui.esc(nome) + "</div>" +
                  '<div class="sg-xs sg-dim">' + ui.num(g.items.length) + " documento" +
                    (g.items.length === 1 ? "" : "s") + "</div></div></div>" +
                '<a class="sg-btn sg-btn--ghost sg-btn--sm" href="#/profissional/' + ui.esc(g.id) + '">' +
                  SG.icon("eye", 14) + "Perfil</a>" +
              "</div>" +
              '<div class="sg-stack-sm">' + g.items.map(function (d) {
                var tone = ui.statusTone(d.status);
                return '<div class="sg-row sg-row--between" style="gap:10px">' +
                  '<span class="sg-row sg-xs sg-dim" style="gap:6px;min-width:0">' + SG.icon("doc", 13) +
                    '<span class="sg-truncate">' + ui.esc(d.doc_type || "Documento") + "</span></span>" +
                  '<span class="sg-row" style="gap:8px">' +
                    '<span class="sg-xs sg-faint">' + ui.date(d.created_at, { day: "2-digit", month: "short" }) + "</span>" +
                    '<span class="sg-badge' + (tone ? " sg-badge--" + tone : "") + '">' +
                      ui.esc(ui.labels.verification[d.status] || d.status || "—") + "</span>" +
                  "</span></div>";
              }).join("") + "</div>" +
              '<div class="sg-divider"></div>' +
              "</div>";
          }).join("") + "</div>"
        : ui.empty("📄", "Nenhum documento enviado", "Os arquivos de verificação aparecem aqui.");
    });
  };

  /* ==========================================================================
     4. SOLICITAÇÕES
     ========================================================================== */
  SG.views.adminRequests = function () {
    app.setHeader("Solicitações", "Todos os pedidos de serviço da plataforma");
    app.view(
      '<div class="app-page-head"><h1>Solicitações</h1>' +
        "<p>Acompanhe a demanda por categoria, urgência e status.</p></div>" +
      chipRow("reqFilters", [
        ["all", "Todas"], ["open", "Abertas"], ["in_progress", "Em andamento"],
        ["completed", "Concluídas"], ["cancelled", "Canceladas"]
      ], "all") +
      '<div id="reqList">' + ui.skeletonCard(3) + "</div>",
      { className: "app-view--wide" }
    );

    var all = [];
    var filter = "all";

    function matches(r) {
      if (filter === "all") return true;
      if (filter === "open") return ["open", "matching"].indexOf(r.status) >= 0;
      if (filter === "in_progress") return ["assigned", "in_progress"].indexOf(r.status) >= 0;
      return r.status === filter;
    }

    function row(r) {
      var cat = r.category || {};
      return "<tr>" +
        '<td><div class="sg-row" style="min-width:0">' +
          '<span class="sg-avatar sg-avatar--sm" style="font-size:16px">' + ui.esc(cat.icon || "🛠") + "</span>" +
          '<div style="min-width:0"><div class="sg-md sg-strong sg-truncate">' + ui.esc(r.title) + "</div>" +
          '<div class="sg-xs sg-dim sg-truncate">' + ui.esc(r.address || "") + "</div></div></div></td>" +
        '<td class="sg-md">' + ui.esc((r.client && r.client.full_name) || "—") + "</td>" +
        '<td class="sg-md sg-dim">' + ui.esc(cat.name || "—") + "</td>" +
        '<td><span class="sg-badge">' + ui.esc(ui.labels.urgency[r.urgency] || r.urgency || "—") + "</span></td>" +
        "<td>" + ui.statusBadge(r.status, ui.labels.requestStatus) + "</td>" +
        '<td class="sg-md sg-dim">' + ui.timeAgo(r.created_at) + "</td>" +
        "</tr>";
    }

    function paint() {
      var list = all.filter(matches);
      ui.$("#reqList").innerHTML = list.length
        ? '<div class="sg-table-wrap"><table class="sg-table"><thead><tr>' +
            "<th>Serviço</th><th>Cliente</th><th>Categoria</th><th>Urgência</th><th>Status</th><th>Criada</th>" +
            "</tr></thead><tbody>" + list.map(row).join("") + "</tbody></table></div>" +
          '<div class="sg-xs sg-faint" style="margin-top:12px">' + ui.num(list.length) +
            " solicitação" + (list.length === 1 ? "" : "ões") + "</div>"
        : ui.empty("📋", "Nenhuma solicitação neste filtro", "Troque o filtro para ver outros pedidos.");
    }

    api.requests.listAll().then(function (list) {
      all = list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      paint();
    });

    bindChips("reqFilters", function (value) {
      filter = value;
      paint();
    });
  };

  /* ==========================================================================
     5. AVALIAÇÕES
     ========================================================================== */
  SG.views.adminReviews = function () {
    app.setHeader("Avaliações", "Qualidade percebida pelos clientes");
    app.view(
      '<div class="app-page-head"><h1>Avaliações</h1>' +
        "<p>Nota média da plataforma e o que os clientes estão comentando.</p></div>" +
      '<div id="rvSummary">' + ui.skeletonCard(1) + "</div>" +
      '<div id="rvList">' + ui.skeletonCard(3) + "</div>"
    );

    api.admin.listReviews().then(function (list) {
      var total = list.length;
      var soma = list.reduce(function (s, r) { return s + Number(r.rating || 0); }, 0);
      var media = total ? Math.round((soma / total) * 10) / 10 : 0;

      var dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      list.forEach(function (r) {
        var n = Math.round(Number(r.rating || 0));
        if (dist[n] !== undefined) dist[n] += 1;
      });

      var linhas = "";
      for (var i = 5; i >= 1; i--) {
        var qtd = dist[i];
        var pct = total ? Math.round((qtd / total) * 100) : 0;
        linhas +=
          '<div class="rating-breakdown__row">' +
            "<span>" + i + "★</span>" +
            '<span class="sg-bar"><span class="sg-bar__fill" style="width:' + pct + '%"></span></span>' +
            '<span class="sg-numeric">' + ui.num(qtd) + "</span>" +
          "</div>";
      }

      ui.$("#rvSummary").innerHTML =
        '<div class="sg-card" style="margin-bottom:24px">' +
          '<div class="sg-row sg-row--top sg-row--wrap" style="gap:32px">' +
            '<div style="min-width:180px">' +
              '<div class="sg-eyebrow">Nota média geral</div>' +
              '<div class="sg-display" style="font-size:2.6rem;margin:8px 0 6px">' +
                ui.rating(media) + "</div>" +
              ui.stars(media, 20) +
              '<div class="sg-xs sg-dim" style="margin-top:8px">' + ui.num(total) +
                " avaliação" + (total === 1 ? "" : "ões") + "</div>" +
            "</div>" +
            '<div class="rating-breakdown" style="flex:1;min-width:240px">' + linhas + "</div>" +
          "</div></div>";

      ui.$("#rvList").innerHTML = total
        ? '<div class="app-section-title"><h3>Últimas avaliações</h3></div>' +
          '<div class="sg-card">' + list.map(function (r) {
            var cliente = (r.client && r.client.full_name) || "Cliente";
            var pro = (r.professional && r.professional.full_name) || "Profissional";
            return '<div class="review">' +
              '<div class="sg-row sg-row--between sg-row--wrap" style="gap:10px">' +
                '<div class="sg-row" style="min-width:0">' + ui.avatar(r.client, "sm") +
                  '<div style="min-width:0"><div class="sg-md sg-strong sg-truncate">' + ui.esc(cliente) + "</div>" +
                  '<div class="sg-xs sg-dim sg-truncate">avaliou ' + ui.esc(pro) + "</div></div></div>" +
                '<div class="sg-row" style="gap:10px">' + ui.stars(r.rating, 14) +
                  '<span class="sg-xs sg-faint">' + ui.date(r.created_at) + "</span></div>" +
              "</div>" +
              (r.comment ? '<p class="sg-md sg-muted" style="margin-top:12px">' + ui.esc(r.comment) + "</p>" : "") +
              (r.tags && r.tags.length
                ? '<div class="sg-row sg-row--wrap" style="gap:6px;margin-top:12px">' + r.tags.map(function (t) {
                    return '<span class="sg-badge">' + ui.esc(t) + "</span>";
                  }).join("") + "</div>"
                : "") +
              "</div>";
          }).join("") + "</div>"
        : ui.empty("⭐", "Nenhuma avaliação ainda", "As avaliações dos serviços concluídos aparecem aqui.");
    });
  };

  /* ==========================================================================
     6. DENÚNCIAS
     ========================================================================== */
  SG.views.adminReports = function () {
    app.setHeader("Denúncias", "Moderação e segurança da comunidade");
    app.view(
      '<div class="app-page-head"><h1>Denúncias</h1>' +
        "<p>Analise os relatos e tome uma decisão. Casos graves podem gerar bloqueio de conta.</p></div>" +
      chipRow("rpFilters", [
        ["all", "Todas"], ["open", "Abertas"], ["reviewing", "Em análise"],
        ["resolved", "Resolvidas"], ["dismissed", "Descartadas"]
      ], "all") +
      '<div id="rpList">' + ui.skeletonCard(3) + "</div>"
    );

    var all = [];
    var filter = "all";

    function statusBadge(status) {
      var tone = status === "resolved" ? "success" : status === "dismissed" ? "danger"
        : status === "reviewing" ? "brand" : "info";
      return '<span class="sg-badge sg-badge--' + tone + '">' +
        ui.esc(REPORT_STATUS[status] || status || "—") + "</span>";
    }

    function card(r) {
      var aberta = r.status === "open" || r.status === "reviewing";
      return '<div class="sg-card">' +
        '<div class="sg-row sg-row--between sg-row--wrap" style="gap:12px">' +
          '<div class="sg-row" style="min-width:0">' +
            '<span class="sg-avatar sg-avatar--lg" style="font-size:20px">' + SG.icon("flag", 20) + "</span>" +
            '<div style="min-width:0">' +
              '<div class="sg-strong sg-truncate">' + ui.esc(r.reason || "Denúncia") + "</div>" +
              '<div class="sg-xs sg-dim" style="margin-top:3px">' + ui.dateTime(r.created_at) + "</div>" +
            "</div></div>" +
          statusBadge(r.status) +
        "</div>" +
        '<div class="sg-grid sg-grid--2" style="margin-top:16px;gap:12px">' +
          '<div><div class="sg-xs sg-faint">Denunciante</div>' +
            '<div class="sg-md sg-strong">' + ui.esc((r.reporter && r.reporter.full_name) || "Usuário removido") + "</div></div>" +
          '<div><div class="sg-xs sg-faint">Denunciado</div>' +
            '<div class="sg-md sg-strong">' + ui.esc((r.target && r.target.full_name) || "Usuário removido") + "</div></div>" +
        "</div>" +
        (r.description
          ? '<p class="sg-md sg-muted" style="margin-top:16px;padding-left:12px;border-left:2px solid var(--sg-line)">' +
            ui.esc(r.description) + "</p>"
          : "") +
        (aberta
          ? '<div class="sg-row" style="gap:8px;margin-top:18px;justify-content:flex-end">' +
              '<button class="sg-btn sg-btn--ghost sg-btn--sm" data-resolve="dismissed" data-id="' + ui.esc(r.id) + '">' +
                SG.icon("x", 14) + "Descartar</button>" +
              '<button class="sg-btn sg-btn--primary sg-btn--sm" data-resolve="resolved" data-id="' + ui.esc(r.id) + '">' +
                SG.icon("checkCircle", 14) + "Resolver</button>" +
            "</div>"
          : '<div class="sg-row sg-xs sg-faint" style="gap:6px;margin-top:18px;justify-content:flex-end">' +
            SG.icon("check", 13) + "Caso encerrado" + (r.resolved_at ? " em " + ui.date(r.resolved_at) : "") + "</div>") +
        "</div>";
    }

    function paint() {
      var list = all.filter(function (r) { return filter === "all" || r.status === filter; });
      ui.$("#rpList").innerHTML = list.length
        ? '<div class="sg-stack">' + list.map(card).join("") + "</div>"
        : ui.empty("🛡", "Nenhuma denúncia neste filtro", "A moderação está em dia por aqui.");
    }

    api.admin.listReports().then(function (list) {
      all = list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      paint();
    });

    bindChips("rpFilters", function (value) {
      filter = value;
      paint();
    });

    ui.on(ui.$("#rpList"), "click", "[data-resolve]", function (e, btn) {
      var id = btn.getAttribute("data-id");
      var status = btn.getAttribute("data-resolve");
      var r = all.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      var resolver = status === "resolved";
      ui.confirm({
        title: resolver ? "Marcar como resolvida?" : "Descartar denúncia?",
        text: resolver
          ? "Registre a decisão. O denunciante será considerado atendido."
          : "A denúncia será arquivada sem penalidade ao usuário denunciado.",
        okText: resolver ? "Sim, resolver" : "Sim, descartar",
        danger: !resolver
      }).then(function (ok) {
        if (!ok) return;
        ui.busy(btn, true);
        api.admin.resolveReport(id, status).then(function () {
          r.status = status;
          r.resolved_at = new Date().toISOString();
          paint();
          ui.toast(resolver ? "Denúncia resolvida" : "Denúncia descartada", {
            type: resolver ? "success" : "info"
          });
        }).catch(function (err) {
          ui.busy(btn, false);
          ui.toast(SG.explainError(err), { type: "error" });
        });
      });
    });
  };

  /* ==========================================================================
     7. CATEGORIAS
     ========================================================================== */
  SG.views.adminCategories = function () {
    app.setHeader("Categorias", "Catálogo de serviços do ServeGo");
    app.view(
      '<div class="app-page-head"><h1>Categorias</h1>' +
        "<p>Defina os tipos de serviço, o emoji e a faixa de preço sugerida.</p></div>" +
      '<div class="sg-row sg-row--between" style="margin-bottom:20px">' +
        '<span class="sg-md sg-dim" id="catCount">Carregando…</span>' +
        '<button class="sg-btn sg-btn--primary sg-btn--sm" id="catNew">' + SG.icon("plus", 15) + "Nova categoria</button>" +
      "</div>" +
      '<div id="catList">' + ui.skeletonCard(3) + "</div>"
    );

    var all = [];

    function card(c) {
      var ativa = c.active !== false;
      return '<div class="sg-card" data-cat="' + ui.esc(c.id) + '">' +
        '<div class="sg-row sg-row--between sg-row--top">' +
          '<div class="sg-row" style="min-width:0">' +
            '<span class="sg-avatar sg-avatar--lg" style="font-size:24px">' + ui.esc(c.icon || "🛠") + "</span>" +
            '<div style="min-width:0"><div class="sg-strong sg-truncate">' + ui.esc(c.name) + "</div>" +
            '<div class="sg-xs sg-dim sg-clamp-2" style="margin-top:3px">' + ui.esc(c.description || "") + "</div></div>" +
          "</div>" +
          '<span class="sg-badge' + (ativa ? " sg-badge--success" : "") + '">' + (ativa ? "Ativa" : "Inativa") + "</span>" +
        "</div>" +
        '<div class="sg-divider"></div>' +
        '<div class="sg-row sg-row--between">' +
          "<div><div class=\"sg-xs sg-faint\">Faixa de preço</div>" +
            '<div class="sg-md sg-strong sg-numeric">' +
              ui.money(c.price_from, true) + " – " + ui.money(c.price_to, true) + "</div></div>" +
          '<div class="sg-row" style="gap:8px">' +
            '<button class="sg-switch ' + (ativa ? "is-on" : "") + '" data-active="' + ui.esc(c.id) + '" ' +
              'title="' + (ativa ? "Desativar categoria" : "Ativar categoria") + '">' +
              '<span class="sg-switch__track"><span class="sg-switch__thumb"></span></span></button>' +
            '<button class="sg-btn sg-btn--outline sg-btn--sm" data-edit="' + ui.esc(c.id) + '">' +
              SG.icon("settings", 14) + "Editar</button>" +
          "</div>" +
        "</div></div>";
    }

    function paint() {
      ui.$("#catCount").textContent = ui.num(all.length) + " categoria" + (all.length === 1 ? "" : "s") + " no catálogo";
      ui.$("#catList").innerHTML = all.length
        ? '<div class="sg-grid sg-grid--3">' + all.map(card).join("") + "</div>"
        : ui.empty("🗂", "Nenhuma categoria cadastrada",
            "Crie a primeira categoria para que os clientes possam solicitar serviços.");
    }

    function load() {
      return api.categories.list().then(function (list) {
        all = list;
        paint();
      });
    }
    load();

    /* Modal de criação/edição ------------------------------------------------ */
    function openCategoryModal(cat) {
      var c = cat || {};
      var m = ui.modal({
        title: cat ? "Editar categoria" : "Nova categoria",
        body:
          '<div class="sg-grid sg-grid--2" style="gap:16px">' +
            '<div class="sg-field"><label class="sg-field__label" for="catName">Nome</label>' +
              '<input class="sg-input" id="catName" value="' + ui.esc(c.name || "") + '" placeholder="Ex.: Eletricista"></div>' +
            '<div class="sg-field"><label class="sg-field__label" for="catIcon">Emoji</label>' +
              '<input class="sg-input" id="catIcon" value="' + ui.esc(c.icon || "") + '" placeholder="⚡" maxlength="4"></div>' +
          "</div>" +
          '<div class="sg-field" style="margin-top:16px"><label class="sg-field__label" for="catDesc">Descrição</label>' +
            '<textarea class="sg-textarea" id="catDesc" placeholder="O que esta categoria cobre?">' +
              ui.esc(c.description || "") + "</textarea></div>" +
          '<div class="sg-grid sg-grid--2" style="gap:16px;margin-top:16px">' +
            '<div class="sg-field"><label class="sg-field__label" for="catFrom">Preço mínimo (R$)</label>' +
              '<input class="sg-input" id="catFrom" type="number" min="0" step="10" value="' +
              ui.esc(c.price_from === undefined || c.price_from === null ? "" : c.price_from) + '"></div>' +
            '<div class="sg-field"><label class="sg-field__label" for="catTo">Preço máximo (R$)</label>' +
              '<input class="sg-input" id="catTo" type="number" min="0" step="10" value="' +
              ui.esc(c.price_to === undefined || c.price_to === null ? "" : c.price_to) + '"></div>' +
          "</div>",
        footer:
          '<button class="sg-btn sg-btn--ghost" data-close>Cancelar</button>' +
          '<button class="sg-btn sg-btn--primary" data-save>' + (cat ? "Salvar alterações" : "Criar categoria") + "</button>"
      });

      m.el.querySelector("[data-save]").addEventListener("click", function () {
        var btn = this;
        var nome = ui.$("#catName", m.el).value.trim();
        var emoji = ui.$("#catIcon", m.el).value.trim();
        var desc = ui.$("#catDesc", m.el).value.trim();
        var de = Number(ui.$("#catFrom", m.el).value || 0);
        var ate = Number(ui.$("#catTo", m.el).value || 0);

        if (!nome) {
          ui.toast("Informe o nome da categoria", { type: "error" });
          return;
        }
        if (ate && de && ate < de) {
          ui.toast("O preço máximo deve ser maior que o mínimo", { type: "error" });
          return;
        }

        var payload = {
          name: nome,
          icon: emoji || "🛠",
          description: desc,
          price_from: de,
          price_to: ate
        };
        if (c.id) payload.id = c.id;

        ui.busy(btn, true);
        api.categories.upsert(payload).then(function () {
          m.close();
          ui.toast(cat ? "Categoria atualizada" : "Categoria criada", { type: "success", text: nome });
          load();
        }).catch(function (err) {
          ui.busy(btn, false);
          ui.toast(SG.explainError(err), { type: "error" });
        });
      });
    }

    ui.$("#catNew").addEventListener("click", function () { openCategoryModal(null); });

    ui.on(ui.$("#catList"), "click", "[data-edit]", function (e, btn) {
      var c = all.filter(function (x) { return x.id === btn.getAttribute("data-edit"); })[0];
      if (c) openCategoryModal(c);
    });

    ui.on(ui.$("#catList"), "click", "[data-active]", function (e, btn) {
      var id = btn.getAttribute("data-active");
      var c = all.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      var next = c.active === false;
      ui.confirm({
        title: next ? "Ativar categoria?" : "Desativar categoria?",
        text: next
          ? c.name + " voltará a aparecer para os clientes."
          : c.name + " deixará de aparecer no catálogo e nas buscas.",
        okText: next ? "Sim, ativar" : "Sim, desativar",
        danger: !next
      }).then(function (ok) {
        if (!ok) return;
        api.categories.setActive(id, next).then(function () {
          c.active = next;
          paint();
          ui.toast(next ? "Categoria ativada" : "Categoria desativada", {
            type: next ? "success" : "info",
            text: c.name
          });
        }).catch(function (err) {
          ui.toast(SG.explainError(err), { type: "error" });
        });
      });
    });
  };
})(window.SG);
