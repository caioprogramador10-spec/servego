/* ==========================================================================
   ServeGo — Autenticação (entrar / criar conta)
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api;
  SG.views = SG.views || {};

  SG.views.auth = function (opts) {
    opts = opts || {};
    var mode = "signin";
    var role = "client";

    function aside() {
      return (
        '<aside class="auth__aside">' +
          "<div>" + SG.brandLogo({ size: "lg" }) + "</div>" +
          "<div>" +
            '<div class="sg-eyebrow" style="margin-bottom:18px">Marketplace de serviços</div>' +
            '<h2 style="max-width:14ch;font-size:2.4rem">O profissional que você precisa, <span class="sg-brand-text">quando precisa</span>.</h2>' +
            '<p class="sg-lead" style="margin-top:18px;max-width:42ch">Profissionais verificados, orçamentos em minutos e acompanhamento do serviço em tempo real.</p>' +
            '<div class="sg-row" style="gap:28px;margin-top:40px;flex-wrap:wrap">' +
              stat("12.400+", "profissionais ativos") +
              stat("4,9", "avaliação média") +
              stat("8 min", "1º orçamento") +
            "</div>" +
          "</div>" +
          '<div class="sg-row sg-xs sg-faint">' + SG.icon("lock", 14) +
          "<span>Conexão protegida · Row Level Security no Supabase</span></div>" +
        "</aside>"
      );
    }
    function stat(v, l) {
      return '<div><div class="sg-display" style="font-size:1.5rem">' + v + "</div>" +
        '<div class="sg-xs sg-dim">' + l + "</div></div>";
    }

    function formHtml() {
      var isSignup = mode === "signup";
      return (
        '<div class="auth__form">' +
          '<div class="sg-only-md" style="margin-bottom:28px">' + SG.brandLogo() + "</div>" +
          '<h2 style="font-size:1.75rem">' + (isSignup ? "Criar sua conta" : "Bem-vindo de volta") + "</h2>" +
          '<p class="sg-muted sg-md" style="margin-top:8px">' +
            (isSignup ? "Leva menos de um minuto." : "Entre para continuar no ServeGo.") + "</p>" +

          '<div class="sg-segment" style="margin:24px 0 20px;width:100%">' +
            '<button class="sg-segment__item ' + (!isSignup ? "is-active" : "") + '" data-mode="signin" style="flex:1">Entrar</button>' +
            '<button class="sg-segment__item ' + (isSignup ? "is-active" : "") + '" data-mode="signup" style="flex:1">Criar conta</button>' +
          "</div>" +

          '<form id="authForm" class="sg-stack" novalidate>' +
            (isSignup ?
              '<div class="sg-grid sg-grid--2" style="gap:10px">' +
                choiceCard("client", "Sou cliente", "Preciso contratar", role === "client") +
                choiceCard("professional", "Sou profissional", "Quero receber serviços", role === "professional") +
              "</div>" +
              field("full_name", "Nome completo", "text", "Como você se chama?") : "") +
            field("email", "E-mail", "email", "voce@email.com") +
            (isSignup ? field("phone", "Celular / WhatsApp", "tel", "(11) 90000-0000") : "") +
            field("password", "Senha", "password", isSignup ? "Mínimo de 6 caracteres" : "Sua senha") +
            '<div id="authError" class="sg-field__error sg-hide"></div>' +
            '<button class="sg-btn sg-btn--primary sg-btn--lg sg-btn--block" type="submit" style="margin-top:8px">' +
              (isSignup ? "Criar conta" : "Entrar") + "</button>" +
          "</form>" +

          (!isSignup ? '<button class="sg-btn sg-btn--ghost sg-btn--sm sg-btn--block" id="forgot" style="margin-top:12px">Esqueci minha senha</button>' : "") +

          (api.isDemo ?
            '<div style="margin-top:28px;padding-top:22px;border-top:1px solid var(--sg-line)">' +
              '<div class="sg-xs sg-faint" style="text-align:center;margin-bottom:12px">Acesso rápido de demonstração</div>' +
              '<div class="sg-row" style="gap:8px">' +
                '<button class="sg-btn sg-btn--secondary sg-btn--sm" data-demo="client" style="flex:1">Cliente</button>' +
                '<button class="sg-btn sg-btn--secondary sg-btn--sm" data-demo="professional" style="flex:1">Profissional</button>' +
                '<button class="sg-btn sg-btn--secondary sg-btn--sm" data-demo="admin" style="flex:1">Administrador</button>' +
              "</div>" +
              '<div class="sg-xs sg-faint" style="text-align:center;margin-top:12px;line-height:1.6">' +
                "No modo demonstração não há servidor de autenticação: qualquer senha entra.<br>" +
                "O painel administrativo é exclusivo de <b>" + ui.esc(SG.config.owner.email) + "</b>.</div>" +
              "</div>" : "") +

          '<p class="sg-xs sg-faint" style="margin-top:24px;text-align:center">' +
            "Ao continuar você concorda com os Termos de Uso e a Política de Privacidade do ServeGo.</p>" +
        "</div>"
      );
    }

    function field(name, label, type, placeholder) {
      return '<div class="sg-field"><label class="sg-field__label" for="f_' + name + '">' + label + "</label>" +
        '<input class="sg-input" id="f_' + name + '" name="' + name + '" type="' + type + '" ' +
        'placeholder="' + placeholder + '" autocomplete="' + (type === "password" ? "current-password" : type) + '"></div>';
    }

    function choiceCard(value, title, sub, selected) {
      return '<button type="button" class="sg-choice ' + (selected ? "is-selected" : "") + '" data-role="' + value + '">' +
        '<span class="sg-choice__radio"></span><span style="text-align:left">' +
        '<span class="sg-choice__title" style="display:block">' + title + "</span>" +
        '<span class="sg-choice__sub">' + sub + "</span></span></button>";
    }

    function render() {
      var root = ui.$("#root");
      root.innerHTML = '<div class="auth">' + aside() +
        '<div class="auth__form-wrap">' + formHtml() + "</div>" +
        '<div id="themeSlot" style="position:fixed;top:20px;right:20px;z-index:20;display:flex"></div>' +
        "</div>";
      bind();
      if (opts.blocked) showError("Sua conta está bloqueada. Fale com o suporte do ServeGo.");
      if (opts.error) showError(opts.error);
    }

    function showError(msg) {
      var el = ui.$("#authError");
      if (!el) return;
      el.textContent = msg;
      el.classList.remove("sg-hide");
    }

    function bind() {
      if (SG.theme) SG.theme.mount("#themeSlot", "app-iconbtn");
      ui.$$("[data-mode]").forEach(function (b) {
        b.addEventListener("click", function () { mode = b.getAttribute("data-mode"); render(); });
      });
      ui.$$("[data-role]").forEach(function (b) {
        b.addEventListener("click", function () { role = b.getAttribute("data-role"); render(); });
      });
      ui.$$("[data-demo]").forEach(function (b) {
        b.addEventListener("click", function () {
          ui.busy(b, true);
          api.auth.demoLogin(b.getAttribute("data-demo"))
            .then(function () { location.hash = "#/inicio"; SG.app.start(); })
            .catch(function (e) { ui.busy(b, false); showError(SG.explainError(e)); });
        });
      });
      var forgot = ui.$("#forgot");
      if (forgot) {
        forgot.addEventListener("click", function () {
          var email = (ui.$("#f_email") || {}).value;
          if (!email) return ui.toast("Informe seu e-mail primeiro", { type: "error" });
          api.auth.resetPassword(email).then(function () {
            ui.toast("Link enviado", { type: "success", text: "Confira sua caixa de entrada." });
          });
        });
      }

      ui.$("#authForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = this.querySelector('button[type="submit"]');
        var data = {};
        ui.$$("input", this).forEach(function (i) { data[i.name] = i.value.trim(); });
        ui.$("#authError").classList.add("sg-hide");

        if (!data.email || !data.password) return showError("Preencha e-mail e senha.");
        if (mode === "signup" && !data.full_name) return showError("Informe seu nome completo.");
        if (mode === "signup" && data.password.length < 6) return showError("A senha precisa ter ao menos 6 caracteres.");

        ui.busy(btn, true);
        var p = mode === "signup"
          ? api.auth.signUp({
              email: data.email, password: data.password, full_name: data.full_name,
              phone: data.phone, role: role
            })
          : api.auth.signIn(data.email, data.password);

        p.then(function () {
          if (mode === "signup" && !api.isDemo) {
            ui.busy(btn, false);
            ui.toast("Conta criada!", { type: "success", text: "Confirme seu e-mail e faça login." });
            mode = "signin"; render();
            return;
          }
          location.hash = "#/inicio";
          SG.app.start();
        }).catch(function (err) {
          ui.busy(btn, false);
          showError(SG.explainError(err));
        });
      });
    }

    render();
  };
})(window.SG);
