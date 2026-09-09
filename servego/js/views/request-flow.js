/* ==========================================================================
   ServeGo — Fluxo de solicitação de serviço (6 etapas)
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  var STEPS = [
    { key: "category", label: "Serviço", title: "O que você precisa?", sub: "Escolha a categoria mais próxima do seu problema." },
    { key: "describe", label: "Detalhes", title: "Conte o que aconteceu", sub: "Quanto mais claro, mais precisos serão os orçamentos." },
    { key: "location", label: "Local", title: "Onde será o serviço?", sub: "Usamos o endereço para encontrar profissionais próximos." },
    { key: "photos", label: "Fotos", title: "Adicione fotos", sub: "Opcional, mas reduz muito o vai e vem com o profissional." },
    { key: "when", label: "Quando", title: "Quando você precisa?", sub: "Urgências são priorizadas para profissionais de plantão." },
    { key: "review", label: "Revisão", title: "Revise sua solicitação", sub: "Confira os dados antes de enviar aos profissionais." }
  ];

  SG.views.requestFlow = function (params, query) {
    var step = 0;
    var files = [];
    var previews = [];
    var form = {
      category_id: (query && query.cat) || null,
      title: "", description: "",
      address: (app.state.me.city ? "" : ""),
      address_complement: "",
      urgency: "today", scheduled_for: null, budget_hint: null
    };
    var categories = [];

    app.setHeader("Solicitar serviço", "Passo a passo");
    app.view('<div id="flowRoot">' + ui.skeletonCard(2) + "</div>");

    api.categories.list().then(function (cats) {
      categories = cats;
      if (form.category_id) step = 1;
      render();
    });

    function stepper() {
      return '<div class="sg-stepper" style="margin-bottom:28px">' + STEPS.map(function (s, i) {
        return (i ? '<span class="sg-stepper__line ' + (i <= step ? "is-done" : "") + '"></span>' : "") +
          '<span class="sg-stepper__step ' + (i === step ? "is-active" : i < step ? "is-done" : "") + '">' +
          '<span class="sg-stepper__bullet">' + (i < step ? "✓" : i + 1) + "</span>" +
          '<span class="sg-stepper__label">' + s.label + "</span></span>";
      }).join("") + "</div>";
    }

    function render() {
      var s = STEPS[step];
      ui.$("#flowRoot").innerHTML =
        '<div style="max-width:720px">' +
          stepper() +
          '<div class="app-page-head" style="margin-bottom:24px"><h1>' + s.title + "</h1><p>" + s.sub + "</p></div>" +
          '<div id="stepBody" class="sg-anim">' + body() + "</div>" +
          '<div class="sg-row sg-row--between" style="margin-top:32px;gap:12px">' +
            '<button class="sg-btn sg-btn--ghost" id="btnBack" ' + (step === 0 ? "disabled" : "") + ">" +
              SG.icon("arrowLeft", 16) + "Voltar</button>" +
            '<button class="sg-btn sg-btn--primary sg-btn--lg" id="btnNext">' +
              (step === STEPS.length - 1 ? "Encontrar profissionais" : "Continuar") +
              SG.icon("arrowRight", 16) + "</button>" +
          "</div>" +
        "</div>";
      bind();
    }

    function body() {
      var s = STEPS[step].key;
      if (s === "category") {
        return '<div class="cat-grid">' + categories.map(function (c) {
          return '<button class="cat-tile ' + (form.category_id === c.id ? "is-selected" : "") + '" data-cat="' + c.id + '" ' +
            'style="' + (form.category_id === c.id ? "border-color:var(--sg-brand-line);background:var(--sg-brand-softer)" : "") + '">' +
            '<span class="cat-tile__ic">' + c.icon + "</span>" +
            '<span><span class="cat-tile__name" style="display:block">' + ui.esc(c.name) + "</span>" +
            '<span class="cat-tile__price">' + ui.money(c.price_from, true) + " – " + ui.money(c.price_to, true) + "</span></span></button>";
        }).join("") + "</div>";
      }

      if (s === "describe") {
        var cat = categories.filter(function (c) { return c.id === form.category_id; })[0] || {};
        return '<div class="sg-card sg-row" style="margin-bottom:20px">' +
            '<span class="sg-avatar sg-avatar--lg" style="font-size:22px">' + (cat.icon || "🛠") + "</span>" +
            "<div><strong>" + ui.esc(cat.name || "") + "</strong>" +
            '<div class="sg-xs sg-dim">' + ui.esc(cat.description || "") + "</div></div></div>" +
          '<div class="sg-field"><label class="sg-field__label">Resumo do serviço</label>' +
            '<input class="sg-input" id="fTitle" maxlength="90" value="' + ui.esc(form.title) + '" ' +
            'placeholder="Ex.: Tomadas da cozinha sem energia"></div>' +
          '<div class="sg-field" style="margin-top:18px"><label class="sg-field__label">Descrição detalhada</label>' +
            '<textarea class="sg-textarea" id="fDesc" style="min-height:150px" ' +
            'placeholder="Descreva o problema, o que já tentou, marca/modelo do equipamento…">' + ui.esc(form.description) + "</textarea>" +
            '<span class="sg-field__hint">Dica: cite se o material será por sua conta ou do profissional.</span></div>' +
          '<div class="sg-field" style="margin-top:18px"><label class="sg-field__label">Quanto pretende gastar? (opcional)</label>' +
            '<input class="sg-input" id="fBudget" type="number" min="0" step="10" value="' + (form.budget_hint || "") + '" ' +
            'placeholder="Ex.: 250"><span class="sg-field__hint">Serve apenas como referência para o profissional.</span></div>';
      }

      if (s === "location") {
        return '<div class="sg-field"><label class="sg-field__label">Endereço do serviço</label>' +
            '<div class="sg-input-group"><span class="sg-input-group__icon">' + SG.icon("pin", 17) + "</span>" +
            '<input class="sg-input" id="fAddress" value="' + ui.esc(form.address) + '" ' +
            'placeholder="Rua, número, bairro, cidade"></div></div>' +
          '<div class="sg-field" style="margin-top:18px"><label class="sg-field__label">Complemento / referência</label>' +
            '<input class="sg-input" id="fComp" value="' + ui.esc(form.address_complement) + '" ' +
            'placeholder="Apto, bloco, ponto de referência"></div>' +
          '<button class="sg-btn sg-btn--secondary sg-btn--sm" id="btnGeo" style="margin-top:14px">' +
            SG.icon("globe", 15) + "Usar minha localização atual</button>" +
          '<div class="sg-map" style="height:250px;margin-top:20px">' +
            '<div class="sg-map__grid"></div>' +
            '<div class="sg-map__badge">' + SG.icon("pin", 12) + " Área de atendimento</div>" +
            '<div class="sg-map__radar"></div><div class="sg-map__radar sg-map__radar--2"></div>' +
            '<div class="sg-map__radar sg-map__radar--3"></div>' +
            '<div class="sg-map__pin sg-map__pin--me" style="left:50%;top:52%">' +
              '<div class="sg-map__pin-dot">' + SG.icon("home", 15) + "</div>" +
              '<div class="sg-map__pin-label" id="mapLabel">Seu endereço</div></div>' +
          "</div>" +
          '<p class="sg-xs sg-faint" style="margin-top:12px">Mapa ilustrativo. A arquitetura já está preparada para Mapbox ou Google Maps — basta preencher <b>config.maps</b>.</p>';
      }

      if (s === "photos") {
        return '<div class="sg-dropzone" id="drop">' +
            '<div style="font-size:26px;margin-bottom:10px">' + SG.icon("camera", 26) + "</div>" +
            '<strong class="sg-md">Arraste fotos aqui ou clique para escolher</strong>' +
            '<div class="sg-xs sg-dim" style="margin-top:6px">JPG ou PNG, até 5 fotos</div>' +
            '<input type="file" id="fFiles" accept="image/*" multiple hidden></div>' +
          '<div class="sg-thumbs" id="thumbs" style="margin-top:18px">' + previews.map(function (src, i) {
            return '<div class="sg-thumb"><img src="' + src + '" alt="">' +
              '<button class="sg-thumb__remove" data-rm="' + i + '">✕</button></div>';
          }).join("") + "</div>" +
          '<p class="sg-xs sg-faint" style="margin-top:16px">Fotos são enviadas para o Supabase Storage no bucket <b>' +
            SG.config.buckets.servicePhotos + "</b> e ficam visíveis apenas para você e os profissionais da solicitação.</p>";
      }

      if (s === "when") {
        var opts = [
          ["now", "Agora", "Emergência — priorizamos profissionais de plantão", "⚡"],
          ["today", "Ainda hoje", "Atendimento no mesmo dia", "🕐"],
          ["tomorrow", "Amanhã", "Você combina o horário no chat", "📅"],
          ["scheduled", "Escolher data", "Agende para o dia que preferir", "🗓"]
        ];
        return '<div class="sg-stack-sm">' + opts.map(function (o) {
          return '<button class="sg-choice ' + (form.urgency === o[0] ? "is-selected" : "") + '" data-urg="' + o[0] + '">' +
            '<span class="sg-choice__radio"></span>' +
            '<span style="font-size:20px">' + o[3] + "</span>" +
            '<span style="text-align:left"><span class="sg-choice__title" style="display:block">' + o[1] + "</span>" +
            '<span class="sg-choice__sub">' + o[2] + "</span></span></button>";
        }).join("") + "</div>" +
          (form.urgency === "scheduled"
            ? '<div class="sg-field" style="margin-top:18px"><label class="sg-field__label">Data e hora</label>' +
              '<input class="sg-input" id="fWhen" type="datetime-local" value="' + (form.scheduled_for || "") + '"></div>'
            : "");
      }

      // review
      var cat2 = categories.filter(function (c) { return c.id === form.category_id; })[0] || {};
      return '<div class="sg-card">' +
          '<div class="sg-row" style="margin-bottom:20px">' +
            '<span class="sg-avatar sg-avatar--lg" style="font-size:22px">' + (cat2.icon || "🛠") + "</span>" +
            "<div><strong>" + ui.esc(form.title || cat2.name) + "</strong>" +
            '<div class="sg-xs sg-dim">' + ui.esc(cat2.name || "") + "</div></div></div>" +
          reviewRow("Descrição", form.description || "—") +
          reviewRow("Endereço", (form.address || "—") + (form.address_complement ? " · " + form.address_complement : "")) +
          reviewRow("Quando", ui.labels.urgency[form.urgency] + (form.scheduled_for ? " · " + ui.dateTime(form.scheduled_for) : "")) +
          reviewRow("Orçamento previsto", form.budget_hint ? ui.money(form.budget_hint) : "Não informado") +
          reviewRow("Fotos", previews.length ? previews.length + " foto(s)" : "Nenhuma") +
        "</div>" +
        '<div class="sg-card sg-card--brand" style="margin-top:16px">' +
          '<div class="sg-row">' + SG.icon("zap", 18) +
          "<div><strong class=\"sg-md\">O que acontece agora</strong>" +
          '<div class="sg-sm sg-dim">Avisamos os profissionais verificados da sua região. Você recebe os orçamentos aqui e escolhe quem quiser — sem compromisso.</div></div></div></div>';
    }

    function reviewRow(label, value) {
      return '<div class="sg-row sg-row--top" style="padding:10px 0;border-top:1px solid var(--sg-line-soft)">' +
        '<div class="sg-xs sg-faint" style="width:150px;flex:none">' + label + "</div>" +
        '<div class="sg-md" style="min-width:0">' + ui.esc(value) + "</div></div>";
    }

    function collect() {
      var s = STEPS[step].key;
      if (s === "describe") {
        form.title = (ui.$("#fTitle").value || "").trim();
        form.description = (ui.$("#fDesc").value || "").trim();
        var b = ui.$("#fBudget").value;
        form.budget_hint = b ? Number(b) : null;
      }
      if (s === "location") {
        form.address = (ui.$("#fAddress").value || "").trim();
        form.address_complement = (ui.$("#fComp").value || "").trim();
      }
      if (s === "when" && form.urgency === "scheduled") {
        var w = ui.$("#fWhen");
        form.scheduled_for = w && w.value ? new Date(w.value).toISOString() : null;
      }
    }

    function validate() {
      var s = STEPS[step].key;
      if (s === "category" && !form.category_id) { ui.toast("Escolha uma categoria", { type: "error" }); return false; }
      if (s === "describe") {
        if (!form.title) { ui.toast("Dê um título ao serviço", { type: "error" }); return false; }
        if (form.description.length < 12) { ui.toast("Descreva um pouco mais o problema", { type: "error" }); return false; }
      }
      if (s === "location" && form.address.length < 8) { ui.toast("Informe o endereço do serviço", { type: "error" }); return false; }
      if (s === "when" && form.urgency === "scheduled" && !form.scheduled_for) {
        ui.toast("Escolha a data e a hora", { type: "error" }); return false;
      }
      return true;
    }

    function bind() {
      ui.$$("[data-cat]").forEach(function (b) {
        b.addEventListener("click", function () {
          form.category_id = b.getAttribute("data-cat");
          step = 1; render();
        });
      });
      ui.$$("[data-urg]").forEach(function (b) {
        b.addEventListener("click", function () { form.urgency = b.getAttribute("data-urg"); render(); });
      });

      var geo = ui.$("#btnGeo");
      if (geo) {
        geo.addEventListener("click", function () {
          if (!navigator.geolocation) return ui.toast("Geolocalização indisponível neste navegador", { type: "error" });
          ui.busy(geo, true);
          navigator.geolocation.getCurrentPosition(function (pos) {
            ui.busy(geo, false);
            form.lat = pos.coords.latitude; form.lng = pos.coords.longitude;
            ui.$("#mapLabel").textContent = "Localização capturada";
            ui.toast("Localização capturada", { type: "success", text: "Coordenadas salvas com a solicitação." });
          }, function () {
            ui.busy(geo, false);
            ui.toast("Não conseguimos obter sua localização", { type: "error", text: "Digite o endereço manualmente." });
          });
        });
      }

      var drop = ui.$("#drop");
      if (drop) {
        var input = ui.$("#fFiles");
        drop.addEventListener("click", function () { input.click(); });
        drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("is-over"); });
        drop.addEventListener("dragleave", function () { drop.classList.remove("is-over"); });
        drop.addEventListener("drop", function (e) {
          e.preventDefault(); drop.classList.remove("is-over");
          addFiles(e.dataTransfer.files);
        });
        input.addEventListener("change", function () { addFiles(input.files); });
        ui.$$("[data-rm]").forEach(function (b) {
          b.addEventListener("click", function () {
            var i = +b.getAttribute("data-rm");
            files.splice(i, 1); previews.splice(i, 1);
            render();
          });
        });
      }

      ui.$("#btnBack").addEventListener("click", function () {
        if (step === 0) return;
        collect(); step--; render();
      });
      ui.$("#btnNext").addEventListener("click", function () {
        collect();
        if (!validate()) return;
        if (step < STEPS.length - 1) { step++; render(); return; }
        submit(this);
      });
    }

    function addFiles(list) {
      Array.prototype.slice.call(list).slice(0, 5 - files.length).forEach(function (f) {
        if (!/^image\//.test(f.type)) return;
        files.push(f);
        var fr = new FileReader();
        fr.onload = function () { previews.push(fr.result); render(); };
        fr.readAsDataURL(f);
      });
    }

    function submit(btn) {
      ui.busy(btn, true);
      var payload = {
        client_id: app.state.me.id,
        category_id: form.category_id,
        title: form.title,
        description: form.description,
        address: form.address,
        address_complement: form.address_complement || null,
        urgency: form.urgency,
        scheduled_for: form.scheduled_for,
        budget_hint: form.budget_hint,
        status: "matching"
      };
      if (form.lat) { payload.lat = form.lat; payload.lng = form.lng; }

      api.requests.create(payload).then(function (req) {
        if (!files.length) return req;
        return api.photos.upload(req.id, app.state.me.id, files).then(function () { return req; });
      }).then(function (req) {
        ui.toast("Solicitação enviada!", { type: "success", text: "Estamos chamando os profissionais da sua região." });
        SG.router.go("/solicitacao/" + req.id);
      }).catch(function (e) {
        ui.busy(btn, false);
        ui.toast(SG.explainError(e), { type: "error" });
      });
    }
  };
})(window.SG);
