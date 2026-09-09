/* ==========================================================================
   ServeGo — Perfil público do profissional
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  SG.views.professionalProfile = function (params) {
    var id = params.id;
    var isClient = app.state.role === "client";
    app.setHeader("Perfil do profissional");
    app.view(ui.skeletonCard(2));

    Promise.all([
      api.professionals.get(id),
      api.reviews.listByProfessional(id),
      isClient ? api.favorites.has(app.state.me.id, id) : Promise.resolve(false)
    ]).then(function (res) {
      var p = res[0], reviews = res[1], isFav = res[2];
      if (!p) {
        return app.view(ui.empty("🔍", "Profissional não encontrado", "Este perfil não está mais disponível."));
      }
      app.setHeader(p.full_name, p.headline || "");
      render(p, reviews, isFav);
    });

    function dist(reviews) {
      var d = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach(function (r) { d[r.rating] = (d[r.rating] || 0) + 1; });
      return d;
    }

    function render(p, reviews, isFav) {
      var d = dist(reviews);
      var total = reviews.length || 1;

      app.view(
        '<button class="sg-btn sg-btn--ghost sg-btn--sm" onclick="history.back()" style="margin-bottom:16px">' +
          SG.icon("arrowLeft", 15) + "Voltar</button>" +

        '<div class="profile-hero">' +
          '<div class="profile-hero__row">' +
            ui.avatar(p, "xl") +
            '<div style="flex:1;min-width:220px">' +
              '<div class="sg-row sg-row--wrap" style="gap:10px">' +
                "<h1 style=\"font-size:1.85rem\">" + ui.esc(p.full_name) + "</h1>" +
                (p.verified ? '<span class="sg-badge sg-badge--brand sg-badge--lg">' + SG.icon("verified", 13) +
                  "Profissional verificado</span>" : "") +
              "</div>" +
              '<p class="sg-lead" style="margin-top:6px">' + ui.esc(p.headline || "") + "</p>" +
              '<div class="sg-row sg-row--wrap" style="gap:8px;margin-top:16px">' +
                (p.categories || []).map(function (c) {
                  return '<span class="sg-badge">' + c.icon + " " + ui.esc(c.name) + "</span>";
                }).join("") +
              "</div>" +
              '<div class="sg-row sg-row--wrap" style="gap:18px;margin-top:16px">' +
                '<span class="sg-row sg-xs sg-dim" style="gap:6px">' + SG.icon("pin", 13) +
                  ui.esc((p.neighborhood ? p.neighborhood + " · " : "") + (p.city || "") + "/" + (p.state || "")) + "</span>" +
                '<span class="sg-row sg-xs sg-dim" style="gap:6px">' + SG.icon("globe", 13) +
                  "Atende até " + p.service_radius_km + " km</span>" +
                '<span class="sg-row sg-xs sg-dim" style="gap:6px">' + SG.icon("clock", 13) +
                  "Responde em ~" + p.response_time_min + " min</span>" +
              "</div>" +
            "</div>" +
            '<div class="sg-col" style="gap:10px;min-width:200px">' +
              (isClient
                ? '<a class="sg-btn sg-btn--primary sg-btn--lg" href="#/solicitar' +
                  ((p.categories && p.categories[0]) ? "?cat=" + p.categories[0].id : "") + '">Solicitar serviço</a>' +
                  '<div class="sg-row" style="gap:8px">' +
                    '<button class="sg-btn sg-btn--secondary" style="flex:1" data-fav>' +
                      SG.icon("heart", 16) + (isFav ? "Favoritado" : "Favoritar") + "</button>" +
                  "</div>"
                : "") +
            "</div>" +
          "</div>" +

          '<div class="profile-stats">' +
            stat(ui.stars(p.rating, 18) + '<span class="sg-display" style="font-size:1.35rem;margin-left:8px">' +
              ui.rating(p.rating) + "</span>", ui.num(p.reviews_count) + " avaliações") +
            stat('<span class="sg-display" style="font-size:1.35rem">' + ui.num(p.jobs_count) + "</span>", "serviços realizados") +
            stat('<span class="sg-display" style="font-size:1.35rem">' + p.experience_years + " anos</span>", "de experiência") +
            stat('<span class="sg-display" style="font-size:1.35rem">' + Math.round(p.completion_rate) + "%</span>", "taxa de conclusão") +
          "</div>" +
        "</div>" +

        '<div class="sg-grid" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:24px;margin-top:24px" id="profGrid">' +
          "<div>" +
            '<div class="sg-card">' +
              '<div class="sg-card__head"><span class="sg-card__title">Sobre o profissional</span></div>' +
              '<p class="sg-muted" style="line-height:1.7">' + ui.esc(p.bio || "Este profissional ainda não escreveu uma apresentação.") + "</p>" +
              '<div class="sg-divider"></div>' +
              '<div class="sg-grid sg-grid--2" style="gap:12px">' +
                trust("shield", "Documentos verificados", p.verified ? "Aprovado pela equipe ServeGo" : "Em análise") +
                trust("checkCircle", "Garantia de serviço", "90 dias em mão de obra") +
                trust("clock", "Tempo médio de resposta", "~" + p.response_time_min + " minutos") +
                trust("wallet", "Preço a partir de", ui.money(p.base_price)) +
              "</div>" +
            "</div>" +

            '<div class="sg-card" style="margin-top:16px">' +
              '<div class="sg-card__head"><span class="sg-card__title">Trabalhos realizados</span></div>' +
              '<div class="gallery">' + (p.portfolio || []).map(function (src) {
                return '<img src="' + src + '" alt="Trabalho realizado" loading="lazy">';
              }).join("") + "</div>" +
            "</div>" +

            '<div class="sg-card" style="margin-top:16px">' +
              '<div class="sg-card__head"><span class="sg-card__title">Avaliações dos clientes</span>' +
                '<span class="sg-badge">' + reviews.length + "</span></div>" +
              (reviews.length ? reviews.map(reviewItem).join("")
                : ui.empty("⭐", "Ainda sem avaliações", "Este profissional ainda não recebeu avaliações no ServeGo.")) +
            "</div>" +
          "</div>" +

          "<div>" +
            '<div class="sg-card">' +
              '<div class="sg-card__head"><span class="sg-card__title">Nota geral</span></div>' +
              '<div class="sg-row" style="gap:18px;margin-bottom:18px">' +
                '<div><div class="sg-display" style="font-size:2.6rem;line-height:1">' +
                  ui.rating(p.rating) + "</div>" +
                  ui.stars(p.rating, 16) +
                  '<div class="sg-xs sg-dim" style="margin-top:4px">' + ui.num(p.reviews_count) + " avaliações</div></div>" +
                '<div class="rating-breakdown" style="flex:1">' +
                  [5, 4, 3, 2, 1].map(function (n) {
                    var pct = Math.round((d[n] / total) * 100);
                    return '<div class="rating-breakdown__row"><span>' + n + "★</span>" +
                      '<span class="sg-bar"><span class="sg-bar__fill" style="width:' + pct + '%"></span></span>' +
                      "<span>" + pct + "%</span></div>";
                  }).join("") +
                "</div>" +
              "</div>" +
            "</div>" +

            '<div class="sg-card" style="margin-top:16px">' +
              '<div class="sg-card__head"><span class="sg-card__title">Área de atendimento</span></div>' +
              '<div class="sg-map" style="height:190px">' +
                '<div class="sg-map__grid"></div>' +
                '<div class="sg-map__radar"></div><div class="sg-map__radar sg-map__radar--2"></div>' +
                '<div class="sg-map__pin" style="left:50%;top:52%">' +
                  '<div class="sg-map__pin-dot">' + SG.icon("briefcase", 14) + "</div>" +
                  '<div class="sg-map__pin-label">' + ui.esc(p.neighborhood || p.city || "") + "</div></div>" +
              "</div>" +
              '<p class="sg-xs sg-faint" style="margin-top:12px">Raio de ' + p.service_radius_km +
                " km a partir da base do profissional.</p>" +
            "</div>" +

            '<div class="sg-card" style="margin-top:16px">' +
              '<div class="sg-card__head"><span class="sg-card__title">Selos de confiança</span></div>' +
              '<div class="sg-row sg-row--wrap" style="gap:8px">' +
                (p.verified ? '<span class="sg-badge sg-badge--brand">' + SG.icon("verified", 12) + "Verificado</span>" : "") +
                (p.rating >= 4.8 ? '<span class="sg-badge sg-badge--success">★ Nota de excelência</span>' : "") +
                (p.jobs_count > 200 ? '<span class="sg-badge sg-badge--info">Alto volume</span>' : "") +
                (p.response_time_min <= 12 ? '<span class="sg-badge sg-badge--warn">Resposta rápida</span>' : "") +
                (p.experience_years >= 10 ? '<span class="sg-badge">Veterano</span>' : "") +
              "</div>" +
            "</div>" +

            (isClient ? '<button class="sg-btn sg-btn--ghost sg-btn--sm sg-btn--block" style="margin-top:16px" data-report>' +
              SG.icon("flag", 15) + "Denunciar este perfil</button>" : "") +
          "</div>" +
        "</div>",
        { className: "app-view--wide" }
      );

      if (window.innerWidth < 1000) ui.$("#profGrid").style.gridTemplateColumns = "minmax(0,1fr)";

      var favBtn = ui.$("[data-fav]");
      if (favBtn) {
        favBtn.addEventListener("click", function () {
          ui.busy(favBtn, true);
          api.favorites.toggle(app.state.me.id, p.id).then(function (added) {
            ui.busy(favBtn, false);
            favBtn.innerHTML = SG.icon("heart", 16) + (added ? "Favoritado" : "Favoritar");
            ui.toast(added ? "Adicionado aos favoritos" : "Removido dos favoritos", { type: "success" });
          });
        });
      }

      var rep = ui.$("[data-report]");
      if (rep) {
        rep.addEventListener("click", function () {
          var m = ui.modal({
            title: "Denunciar perfil",
            body: '<div class="sg-field"><label class="sg-field__label">Motivo</label>' +
              '<select class="sg-select" id="rpReason2">' +
              ["Perfil falso", "Informações enganosas", "Conduta inadequada", "Outro"]
                .map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select></div>" +
              '<div class="sg-field" style="margin-top:16px"><label class="sg-field__label">Detalhes</label>' +
              '<textarea class="sg-textarea" id="rpDesc2"></textarea></div>',
            footer: '<button class="sg-btn sg-btn--ghost" data-close>Cancelar</button>' +
              '<button class="sg-btn sg-btn--danger" data-send>Enviar</button>'
          });
          m.el.querySelector("[data-send]").addEventListener("click", function () {
            ui.busy(this, true);
            api.reports.create({
              reporter_id: app.state.me.id, target_user_id: p.id, booking_id: null,
              reason: ui.$("#rpReason2").value, description: ui.$("#rpDesc2").value.trim()
            }).then(function () {
              m.close();
              ui.toast("Denúncia registrada", { type: "success" });
            });
          });
        });
      }
    }

    function stat(value, label) {
      return '<div class="profile-stat"><div class="sg-row">' + value + "</div>" +
        '<div class="sg-xs sg-dim" style="margin-top:6px">' + label + "</div></div>";
    }

    function trust(icon, title, sub) {
      return '<div class="sg-row sg-row--top" style="gap:10px">' +
        '<span style="color:var(--sg-brand);margin-top:2px">' + SG.icon(icon, 16) + "</span>" +
        '<div><div class="sg-sm sg-strong">' + title + "</div>" +
        '<div class="sg-xs sg-dim">' + ui.esc(sub) + "</div></div></div>";
    }

    function reviewItem(r) {
      return '<div class="review">' +
        '<div class="sg-row sg-row--between">' +
          '<div class="sg-row">' + ui.avatar(r.client, "sm") +
            '<div><div class="sg-sm sg-strong">' + ui.esc((r.client && r.client.full_name) || "Cliente ServeGo") + "</div>" +
            '<div class="sg-xs sg-faint">' + ui.date(r.created_at) + "</div></div></div>" +
          ui.stars(r.rating, 14) +
        "</div>" +
        (r.comment ? '<p class="sg-md sg-muted" style="margin-top:12px">' + ui.esc(r.comment) + "</p>" : "") +
        (r.tags && r.tags.length ? '<div class="sg-row sg-row--wrap" style="gap:6px;margin-top:10px">' +
          r.tags.map(function (t) { return '<span class="sg-badge">' + ui.esc(t) + "</span>"; }).join("") + "</div>" : "") +
        (r.reply ? '<div style="margin-top:12px;padding:12px;border-left:2px solid var(--sg-brand-line);background:var(--sg-surface-2);border-radius:0 var(--sg-r-sm) var(--sg-r-sm) 0">' +
          '<div class="sg-xs sg-brand-text sg-strong">Resposta do profissional</div>' +
          '<div class="sg-sm sg-muted" style="margin-top:4px">' + ui.esc(r.reply) + "</div></div>" : "") +
        "</div>";
    }
  };
})(window.SG);
