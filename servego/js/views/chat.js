/* ==========================================================================
   ServeGo — Mensagens (Supabase Realtime)
   ========================================================================== */
(function (SG) {
  var ui = SG.ui, api = SG.api, app = SG.app;
  SG.views = SG.views || {};

  SG.views.chat = function (params) {
    var me = app.state.me;
    var activeId = params && params.id ? params.id : null;
    var conversations = [];
    var typingTimer = null;
    var typingChannel = null;

    app.setHeader("Mensagens", "Converse com segurança pelo ServeGo");
    app.view(
      '<div class="chat-layout' + (activeId ? " has-active" : "") + '" id="chatLayout">' +
        '<div class="chat-layout__list" id="convList">' + ui.skeletonCard(3) + "</div>" +
        '<div class="chat-layout__panel" id="chatPanel"></div>' +
      "</div>",
      { className: "app-view--flush" }
    );

    api.messages.listConversations(me.id).then(function (list) {
      conversations = list;
      paintList();
      if (activeId) openConversation(activeId);
      else if (!list.length) paintEmptyPanel();
      else paintEmptyPanel();
    });

    function paintList() {
      var host = ui.$("#convList");
      if (!conversations.length) {
        host.innerHTML = ui.empty("💬", "Nenhuma conversa",
          "As conversas aparecem quando você contrata ou recebe um serviço.");
        return;
      }
      host.innerHTML =
        '<div style="padding:16px 16px 8px"><strong class="sg-md">Conversas</strong></div>' +
        '<div class="sg-list sg-list--divided">' + conversations.map(function (c) {
          var other = c.other || {};
          return '<a class="sg-list__item ' + (c.request_id === activeId ? "is-active" : "") + '" href="#/mensagens/' + c.request_id + '">' +
            ui.avatar(other, null, true) +
            '<div style="min-width:0;flex:1">' +
              '<div class="sg-row sg-row--between"><span class="sg-md sg-strong sg-truncate">' +
                ui.esc(other.full_name || "Conversa") + "</span>" +
                '<span class="sg-xs sg-faint">' + ui.timeAgo(c.last.created_at) + "</span></div>" +
              '<div class="sg-row sg-row--between" style="gap:8px">' +
                '<span class="sg-xs sg-dim sg-truncate">' +
                  ui.esc(c.last.image_url ? "📷 Foto" : c.last.content) + "</span>" +
                (c.unread ? '<span class="app-nav__count">' + c.unread + "</span>" : "") +
              "</div>" +
              '<div class="sg-xs sg-faint sg-truncate" style="margin-top:2px">' +
                ui.esc(c.request ? (c.request.category ? c.request.category.icon + " " : "") + c.request.title : "") + "</div>" +
            "</div></a>";
        }).join("") + "</div>";
    }

    function paintEmptyPanel() {
      ui.$("#chatPanel").innerHTML =
        '<div style="display:grid;place-items:center;height:100%">' +
        ui.empty("✉️", "Escolha uma conversa", "Selecione ao lado para ver as mensagens.") + "</div>";
    }

    function openConversation(requestId) {
      activeId = requestId;
      ui.$("#chatLayout").classList.add("has-active");
      paintList();

      var conv = conversations.filter(function (c) { return c.request_id === requestId; })[0];
      var other = (conv && conv.other) || {};

      ui.$("#chatPanel").innerHTML =
        '<div class="sg-chat">' +
          '<div class="sg-chat__head">' +
            '<a class="app-iconbtn sg-only-md" href="#/mensagens">' + SG.icon("chevronLeft", 18) + "</a>" +
            ui.avatar(other, null, true) +
            '<div style="min-width:0;flex:1">' +
              '<div class="sg-md sg-strong sg-truncate">' + ui.esc(other.full_name || "Conversa") + "</div>" +
              '<div class="sg-xs sg-dim" id="chatStatus">' +
                (other.is_available ? '<span class="sg-row" style="gap:5px"><span class="sg-dot sg-dot--live"></span>Online agora</span>' : "Visto recentemente") +
              "</div>" +
            "</div>" +
            (conv && conv.request ? '<a class="sg-btn sg-btn--secondary sg-btn--sm sg-hide-sm" href="#' +
              (conv.request.booking ? "/acompanhar/" + conv.request.booking.id : "/solicitacao/" + conv.request.id) +
              '">Ver serviço</a>' : "") +
          "</div>" +
          '<div class="sg-chat__body" id="chatBody"><div class="sg-row" style="justify-content:center;padding:20px">' +
            '<span class="sg-spinner"></span></div></div>' +
          '<div class="sg-chat__foot">' +
            '<button class="app-iconbtn" id="btnImg" title="Enviar foto">' + SG.icon("image", 19) + "</button>" +
            '<input type="file" id="chatFile" accept="image/*" hidden>' +
            '<textarea class="sg-textarea" id="chatInput" rows="1" placeholder="Escreva uma mensagem…" ' +
              'style="min-height:44px;max-height:120px;resize:none;flex:1"></textarea>' +
            '<button class="sg-btn sg-btn--primary sg-btn--icon" id="btnSend" style="width:44px;height:44px">' +
              SG.icon("send", 18) + "</button>" +
          "</div>" +
        "</div>";

      api.messages.list(requestId).then(function (msgs) {
        paintMessages(msgs);
        api.messages.markRead(requestId, me.id).then(function () { app.refreshUnread(); });
      });

      app.track(api.messages.subscribe(requestId, function (m) {
        appendMessage(m);
        if (m.recipient_id === me.id) {
          api.messages.markRead(requestId, me.id).then(function () { app.refreshUnread(); });
        }
      }));

      typingChannel = api.messages.typingChannel(requestId, function (payload) {
        if (payload && payload.user_id === me.id) return;
        showTyping();
      });
      app.track(function () {
        if (typingChannel && typingChannel.close) typingChannel.close();
      });

      bindComposer(requestId, other);
    }

    function paintMessages(msgs) {
      var body = ui.$("#chatBody");
      if (!msgs.length) {
        body.innerHTML =
          '<div style="margin:auto;text-align:center;max-width:320px">' +
          '<div class="sg-empty__icon" style="margin-inline:auto">🤝</div>' +
          '<p class="sg-sm sg-dim">Combine tudo por aqui. O histórico fica salvo e protege você em caso de disputa.</p></div>';
        return;
      }
      var lastDay = "";
      body.innerHTML = msgs.map(function (m) {
        var day = ui.dayLabel(m.created_at);
        var sep = day !== lastDay ? '<div class="sg-msg__day">' + day + "</div>" : "";
        lastDay = day;
        return sep + bubble(m);
      }).join("") + '<div id="typingSlot"></div>';
      body.scrollTop = body.scrollHeight;
    }

    function bubble(m) {
      var out = m.sender_id === app.state.me.id;
      return '<div class="sg-msg sg-msg--' + (out ? "out" : "in") + '">' +
        '<div class="sg-msg__bubble">' +
          (m.image_url ? '<img src="' + m.image_url + '" alt="Foto enviada">' : "") +
          (m.content ? ui.esc(m.content) : "") +
        "</div>" +
        '<div class="sg-msg__meta">' + ui.time(m.created_at) +
          (out ? (m.read_at ? SG.icon("checkCircle", 12) : SG.icon("check", 12)) : "") + "</div></div>";
    }

    function appendMessage(m) {
      var body = ui.$("#chatBody");
      if (!body) return;
      var slot = ui.$("#typingSlot");
      var node = ui.node(bubble(m));
      if (slot) body.insertBefore(node, slot);
      else body.appendChild(node);
      hideTyping();
      body.scrollTop = body.scrollHeight;
    }

    function showTyping() {
      var slot = ui.$("#typingSlot");
      if (!slot || ui.$("#typingBubble")) return;
      slot.innerHTML = '<div class="sg-msg sg-msg--in" id="typingBubble">' +
        '<div class="sg-msg__bubble" style="padding:4px 8px"><span class="sg-typing">' +
        "<span></span><span></span><span></span></span></div></div>";
      var body = ui.$("#chatBody");
      body.scrollTop = body.scrollHeight;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(hideTyping, 5000);
    }

    function hideTyping() {
      var t = ui.$("#typingBubble");
      if (t) t.remove();
    }

    function bindComposer(requestId, other) {
      var input = ui.$("#chatInput");
      var send = ui.$("#btnSend");
      var fileBtn = ui.$("#btnImg");
      var file = ui.$("#chatFile");

      input.addEventListener("input", function () {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";
        if (typingChannel && typingChannel.send) typingChannel.send(app.state.me.id);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
      send.addEventListener("click", doSend);
      fileBtn.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function () {
        if (!file.files[0]) return;
        api.photos.uploadChatImage(app.state.me.id, file.files[0]).then(function (url) {
          return api.messages.send({
            request_id: requestId, booking_id: null,
            sender_id: app.state.me.id, recipient_id: other.id,
            content: null, image_url: url
          });
        }).then(function (m) {
          if (api.isDemo) return; // o bus já emite
          appendMessage(m);
        }).catch(function (e) { ui.toast(SG.explainError(e), { type: "error" }); });
        file.value = "";
      });

      function doSend() {
        var text = input.value.trim();
        if (!text) return;
        input.value = ""; input.style.height = "auto";
        api.messages.send({
          request_id: requestId, booking_id: null,
          sender_id: app.state.me.id, recipient_id: other.id,
          content: text, image_url: null
        }).then(function (m) {
          if (api.isDemo) return;
          appendMessage(m);
        }).catch(function (e) { ui.toast(SG.explainError(e), { type: "error" }); });
      }
    }
  };
})(window.SG);
