/* ==========================================================================
   ServeGo — Perfil e configurações da conta
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  SG.views.profile = function () {
    var me = app.state.me;
    var isPro = me.role === "professional";
    var pro = me.professional || {};
    var selectedCats = [];

    app.setHeader("Meu perfil", isPro ? "Dados profissionais e atendimento" : "Seus dados no ServeGo");
    app.view(
      '<div class="app-page-head"><h1>Meu perfil</h1><p>Mantenha seus dados atualizados — isso aumenta a confiança na plataforma.</p></div>' +
      '<div class="sg-grid" style="grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:24px" id="profGrid2">' +
        "<div>" +
          '<div class="sg-card" style="text-align:center">' +
            '<div style="display:inline-block;position:relative" id="avatarWrap">' + ui.avatar(me, "xl") + "</div>" +
            '<div class="sg-strong" style="margin-top:14px">' + ui.esc(me.full_name) + "</div>" +
            '<div class="sg-xs sg-dim">' + ui.esc(me.email || "") + "</div>" +
            '<div class="sg-row" style="justify-content:center;margin-top:12px">' +
              '<span class="sg-badge">' + (isPro ? "Profissional" : me.role === "admin" ? "Administrador" : "Cliente") + "</span>" +
              (isPro && pro.verified ? '<span class="sg-badge sg-badge--brand">' + SG.icon("verified", 12) + "Verificado</span>" : "") +
            "</div>" +
            '<input type="file" id="avatarFile" accept="image/*" hidden>' +
            '<button class="sg-btn sg-btn--secondary sg-btn--sm sg-btn--block" style="margin-top:18px" id="btnAvatar">' +
              SG.icon("camera", 15) + "Trocar foto</button>" +
          "</div>" +
          (isPro ? proSideCard() : clientSideCard()) +
        "</div>" +
        '<div id="profForms"></div>' +
      "</div>",
      { className: "app-view--wide" }
    );
    if (window.innerWidth < 900) ui.$("#profGrid2").style.gridTemplateColumns = "minmax(0,1fr)";

    renderForms();
    bindAvatar();

    function clientSideCard() {
      return '<div class="sg-card" style="margin-top:16px">' +
        '<div class="sg-card__head"><span class="sg-card__title">Conta</span></div>' +
        '<div class="sg-row sg-row--between" style="padding:6px 0"><span class="sg-md sg-dim">Membro desde</span>' +
          '<span class="sg-md">' + ui.date(me.created_at) + "</span></div>" +
        '<div class="sg-divider"></div>' +
        '<button class="sg-btn sg-btn--ghost sg-btn--sm sg-btn--block" id="btnLogout">' +
          SG.icon("logout", 15) + "Sair da conta</button></div>";
    }

    function proSideCard() {
      return '<div class="sg-card" style="margin-top:16px">' +
        '<div class="sg-card__head"><span class="sg-card__title">Reputação</span></div>' +
        '<div class="sg-row" style="gap:18px">' +
          '<div><div class="sg-display" style="font-size:1.7rem">' + ui.rating(pro.rating || 0) + "</div>" +
          ui.stars(pro.rating || 0, 14) + "</div>" +
          '<div><div class="sg-display" style="font-size:1.7rem">' + ui.num(pro.jobs_count || 0) + "</div>" +
          '<div class="sg-xs sg-dim">serviços</div></div></div>' +
        '<div class="sg-divider"></div>' +
        '<div class="sg-row sg-row--between" style="padding:4px 0"><span class="sg-md sg-dim">Verificação</span>' +
          '<span class="sg-badge sg-badge--' + ui.statusTone(pro.verification_status) + '">' +
          (ui.labels.verification[pro.verification_status] || "—") + "</span></div>" +
        '<div class="sg-row sg-row--between" style="padding:4px 0"><span class="sg-md sg-dim">Disponibilidade</span>' +
          '<span class="sg-badge ' + (pro.is_available ? "sg-badge--success" : "") + '">' +
          (pro.is_available ? "Online" : "Offline") + "</span></div>" +
        '<div class="sg-divider"></div>' +
        '<a class="sg-btn sg-btn--outline sg-btn--sm sg-btn--block" href="#/profissional/' + me.id + '">Ver meu perfil público</a>' +
        '<button class="sg-btn sg-btn--ghost sg-btn--sm sg-btn--block" style="margin-top:8px" id="btnLogout">' +
          SG.icon("logout", 15) + "Sair da conta</button></div>";
    }

    function renderForms() {
      var host = ui.$("#profForms");
      host.innerHTML =
        '<div class="sg-card">' +
          '<div class="sg-card__head"><span class="sg-card__title">Dados pessoais</span></div>' +
          '<div class="sg-grid sg-grid--2">' +
            field("pName", "Nome completo", me.full_name) +
            field("pPhone", "Celular / WhatsApp", me.phone) +
            field("pCity", "Cidade", me.city) +
            field("pState", "Estado (UF)", me.state) +
          "</div>" +
          '<button class="sg-btn sg-btn--primary" style="margin-top:20px" id="saveProfile">Salvar alterações</button>' +
        "</div>" +
        (isPro ? proForms() : "") +
        '<div class="sg-card" style="margin-top:16px">' +
          '<div class="sg-card__head"><span class="sg-card__title">Privacidade e segurança</span></div>' +
          '<p class="sg-sm sg-dim">Seus dados são protegidos por Row Level Security no Supabase: nenhum outro usuário consegue ler suas informações privadas, mesmo conhecendo o endereço da API.</p>' +
          '<div class="sg-row sg-row--wrap" style="gap:8px;margin-top:14px">' +
            '<span class="sg-badge">' + SG.icon("lock", 12) + "RLS ativo</span>" +
            '<span class="sg-badge">' + SG.icon("shield", 12) + "Chat auditável</span>" +
            '<span class="sg-badge">' + SG.icon("doc", 12) + "LGPD</span>" +
          "</div></div>";

      ui.$("#saveProfile").addEventListener("click", saveProfile);
      var logout = ui.$("#btnLogout");
      if (logout) logout.addEventListener("click", function () {
        api.auth.signOut().then(function () { location.reload(); });
      });
      if (isPro) bindProForms();
    }

    function proForms() {
      return '<div class="sg-card" style="margin-top:16px">' +
          '<div class="sg-card__head"><span class="sg-card__title">Perfil profissional</span></div>' +
          field("pHeadline", "Título / especialidade", pro.headline) +
          '<div class="sg-field" style="margin-top:16px"><label class="sg-field__label">Sobre você</label>' +
            '<textarea class="sg-textarea" id="pBio" placeholder="Conte sua experiência, diferenciais e garantias.">' +
            ui.esc(pro.bio || "") + "</textarea></div>" +
          '<div class="sg-grid sg-grid--3" style="margin-top:16px">' +
            field("pExp", "Anos de experiência", pro.experience_years, "number") +
            field("pBase", "Preço base (R$)", pro.base_price, "number") +
            field("pRadius", "Raio de atendimento (km)", pro.service_radius_km, "number") +
          "</div>" +
          '<button class="sg-btn sg-btn--primary" style="margin-top:20px" id="savePro">Salvar perfil profissional</button>' +
        "</div>" +
        '<div class="sg-card" style="margin-top:16px">' +
          '<div class="sg-card__head"><span class="sg-card__title">Especialidades</span>' +
            '<span class="sg-xs sg-dim">Selecione as categorias que você atende</span></div>' +
          '<div class="sg-row sg-row--wrap" id="catPicker" style="gap:8px">' + ui.skeletonCard(1) + "</div>" +
          '<button class="sg-btn sg-btn--secondary" style="margin-top:18px" id="saveCats">Salvar especialidades</button>' +
        "</div>" +
        '<div class="sg-card" style="margin-top:16px">' +
          '<div class="sg-card__head"><span class="sg-card__title">Documentos</span>' +
            '<span class="sg-badge sg-badge--' + ui.statusTone(pro.verification_status) + '">' +
            (ui.labels.verification[pro.verification_status] || "—") + "</span></div>" +
          '<p class="sg-sm sg-dim">Envie documento com foto, comprovante de residência e certificações. A análise leva até 48 horas.</p>' +
          '<div class="sg-dropzone" id="docDrop" style="margin-top:14px">' +
            SG.icon("doc", 24) +
            '<div class="sg-md sg-strong" style="margin-top:10px">Enviar documento</div>' +
            '<div class="sg-xs sg-dim" style="margin-top:4px">PDF, JPG ou PNG · bucket privado <b>' +
              SG.config.buckets.documents + "</b></div></div>" +
        "</div>";
    }

    function field(id, label, value, type) {
      return '<div class="sg-field"><label class="sg-field__label" for="' + id + '">' + label + "</label>" +
        '<input class="sg-input" id="' + id + '" type="' + (type || "text") + '" value="' +
        ui.esc(value === null || value === undefined ? "" : value) + '"></div>';
    }

    function saveProfile() {
      var btn = ui.$("#saveProfile");
      ui.busy(btn, true);
      api.profiles.update(me.id, {
        full_name: ui.$("#pName").value.trim(),
        phone: ui.$("#pPhone").value.trim(),
        city: ui.$("#pCity").value.trim(),
        state: ui.$("#pState").value.trim().toUpperCase()
      }).then(function (p) {
        ui.busy(btn, false);
        Object.assign(app.state.me, p);
        ui.toast("Perfil atualizado", { type: "success" });
      }).catch(function (e) {
        ui.busy(btn, false);
        ui.toast(SG.explainError(e), { type: "error" });
      });
    }

    function bindProForms() {
      api.categories.list().then(function (cats) {
        selectedCats = (pro.categories || []).map(function (c) { return c.id; });
        if (!selectedCats.length && me.professional && me.professional.categories) {
          selectedCats = me.professional.categories.map(function (c) { return c.id; });
        }
        ui.$("#catPicker").innerHTML = cats.map(function (c) {
          return '<button class="sg-chip ' + (selectedCats.indexOf(c.id) >= 0 ? "is-active" : "") + '" data-cat="' + c.id + '">' +
            c.icon + " " + ui.esc(c.name) + "</button>";
        }).join("");
        ui.on(ui.$("#catPicker"), "click", "[data-cat]", function (e, el) {
          var id = el.getAttribute("data-cat");
          var i = selectedCats.indexOf(id);
          if (i >= 0) { selectedCats.splice(i, 1); el.classList.remove("is-active"); }
          else { selectedCats.push(id); el.classList.add("is-active"); }
        });
      });

      ui.$("#savePro").addEventListener("click", function () {
        var btn = this;
        ui.busy(btn, true);
        api.professionals.update(me.id, {
          headline: ui.$("#pHeadline").value.trim(),
          bio: ui.$("#pBio").value.trim(),
          experience_years: Number(ui.$("#pExp").value) || 0,
          base_price: Number(ui.$("#pBase").value) || 0,
          service_radius_km: Number(ui.$("#pRadius").value) || 10
        }).then(function (p) {
          ui.busy(btn, false);
          app.state.me.professional = Object.assign(app.state.me.professional || {}, p);
          ui.toast("Perfil profissional atualizado", { type: "success" });
        }).catch(function (e) {
          ui.busy(btn, false);
          ui.toast(SG.explainError(e), { type: "error" });
        });
      });

      ui.$("#saveCats").addEventListener("click", function () {
        var btn = this;
        ui.busy(btn, true);
        api.professionals.setCategories(me.id, selectedCats, Number(ui.$("#pBase").value) || null)
          .then(function () {
            ui.busy(btn, false);
            ui.toast("Especialidades salvas", { type: "success", text: "Você já aparece nas buscas dessas categorias." });
          }).catch(function (e) {
            ui.busy(btn, false);
            ui.toast(SG.explainError(e), { type: "error" });
          });
      });

      ui.$("#docDrop").addEventListener("click", function () {
        ui.toast("Envio de documentos", {
          type: "info",
          text: "No ambiente conectado ao Supabase, o arquivo vai para o bucket privado professional-documents."
        });
      });
    }

    function bindAvatar() {
      var input = ui.$("#avatarFile");
      ui.$("#btnAvatar").addEventListener("click", function () { input.click(); });
      input.addEventListener("change", function () {
        if (!input.files[0]) return;
        api.photos.uploadAvatar(me.id, input.files[0])
          .then(function (url) { return api.profiles.update(me.id, { avatar_url: url }); })
          .then(function (p) {
            app.state.me.avatar_url = p.avatar_url;
            ui.$("#avatarWrap").innerHTML = ui.avatar(app.state.me, "xl");
            ui.toast("Foto atualizada", { type: "success" });
          })
          .catch(function (e) { ui.toast(SG.explainError(e), { type: "error" }); });
      });
    }
  };
})(window.SG);
