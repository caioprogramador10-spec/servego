/* ==========================================================================
   ServeGo — Camada de dados
   --------------------------------------------------------------------------
   Cada função tem duas implementações: Supabase (produção) e base em memória
   (modo demo). As telas consomem SEMPRE esta camada — nunca o SDK direto.
   ========================================================================== */
(function (SG) {
  var ui = SG.ui;
  var api = {};
  var DEMO = SG.isDemo();
  var db = SG.mock.data;

  /* ---- Infra ------------------------------------------------------------- */
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms === undefined ? 240 : ms); }); }
  function uid(p) { return SG.mock.uid(p); }
  function nowIso() { return new Date().toISOString(); }

  var bus = {
    map: {},
    on: function (evt, fn) {
      (this.map[evt] = this.map[evt] || []).push(fn);
      var self = this;
      return function () { self.map[evt] = self.map[evt].filter(function (f) { return f !== fn; }); };
    },
    emit: function (evt, payload) { (this.map[evt] || []).forEach(function (f) { try { f(payload); } catch (e) { console.error(e); } }); }
  };
  api.bus = bus;
  api.isDemo = DEMO;

  function sb() {
    if (!SG.supabase) throw new Error("Supabase não inicializado.");
    return SG.supabase;
  }
  function unwrap(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  /* Armazenamento leve da sessão demo (degrada para memória) ---------------- */
  var memSession = null;
  function saveDemoSession(v) {
    memSession = v;
    try { localStorage.setItem("servego.demo.session", JSON.stringify(v)); } catch (e) { /* modo privado */ }
  }
  function readDemoSession() {
    if (memSession) return memSession;
    try {
      var raw = localStorage.getItem("servego.demo.session");
      memSession = raw ? JSON.parse(raw) : null;
    } catch (e) { memSession = null; }
    return memSession;
  }
  function clearDemoSession() {
    memSession = null;
    try { localStorage.removeItem("servego.demo.session"); } catch (e) {}
  }

  function findProfile(id) { return db.profiles.filter(function (p) { return p.id === id; })[0]; }
  function findPro(id) { return db.professionals.filter(function (p) { return p.id === id; })[0]; }
  function findCat(id) { return db.categories.filter(function (c) { return c.id === id; })[0]; }

  function hydrateRequest(r) {
    var out = clone(r);
    out.category = clone(findCat(r.category_id));
    out.client = clone(findProfile(r.client_id));
    out.photos = db.service_photos.filter(function (p) { return p.request_id === r.id; }).map(clone);
    out.offers_count = db.service_offers.filter(function (o) { return o.request_id === r.id && o.status !== "withdrawn"; }).length;
    var bk = db.bookings.filter(function (b) { return b.request_id === r.id; })[0];
    out.booking = bk ? clone(bk) : null;
    return out;
  }

  function hydrateProfessional(id) {
    var pro = findPro(id), prof = findProfile(id);
    if (!pro || !prof) return null;
    var out = clone(pro);
    out.full_name = prof.full_name;
    out.avatar_url = prof.avatar_url;
    out.email = prof.email;
    out.phone = prof.phone;
    out.status = prof.status;
    out.categories = db.professional_categories
      .filter(function (pc) { return pc.professional_id === id; })
      .map(function (pc) { return clone(findCat(pc.category_id)); })
      .filter(Boolean);
    out.portfolio = clone(db.portfolio[id] || []);
    return out;
  }

  /* ==========================================================================
     AUTENTICAÇÃO
     ========================================================================== */
  api.auth = {};

  /* O cadastro público só cria cliente ou profissional. O papel de admin nunca
     vem do formulário: quem define é o banco (sql/05_admin.sql), que promove
     apenas o e-mail proprietário configurado em js/config.js. */
  function publicRole(role) {
    return role === "professional" ? "professional" : "client";
  }

  api.auth.signUp = function (payload) {
    payload = Object.assign({}, payload, { role: publicRole(payload.role) });
    if (DEMO) {
      return delay(600).then(function () {
        var exists = db.profiles.filter(function (p) { return p.email === payload.email; })[0];
        if (exists) throw new Error("Este e-mail já possui conta no ServeGo.");
        var id = uid("user");
        var profile = {
          id: id, full_name: payload.full_name, email: payload.email, phone: payload.phone || null,
          avatar_url: null, city: payload.city || "São Paulo", state: payload.state || "SP",
          role: payload.role || "client", status: "active", created_at: nowIso()
        };
        db.profiles.push(profile);
        if (profile.role === "professional") {
          db.professionals.push({
            id: id, headline: payload.headline || "Profissional ServeGo", bio: "",
            experience_years: 0, base_price: 120, hourly_rate: 80, service_radius_km: 15,
            lat: -23.55, lng: -46.63, city: profile.city, state: profile.state,
            is_available: false, verified: false, verification_status: "pending",
            rating: 0, reviews_count: 0, jobs_count: 0, response_time_min: 15,
            completion_rate: 100, neighborhood: "", distance_km: 0, created_at: nowIso()
          });
        }
        saveDemoSession({ user_id: id });
        return clone(profile);
      });
    }
    return sb().auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.full_name,
          phone: payload.phone || null,
          role: payload.role || "client"
        }
      }
    }).then(unwrap);
  };

  api.auth.signIn = function (email, password) {
    if (DEMO) {
      return delay(520).then(function () {
        var mail = String(email).toLowerCase().trim();
        var profile = db.profiles.filter(function (p) { return String(p.email).toLowerCase().trim() === mail; })[0];
        if (!profile) {
          // No modo demo não existe senha: só o e-mail identifica a conta fictícia.
          throw new Error(
            "Esta conta não existe na base de demonstração. Use " +
            SG.config.owner.email + " para entrar como administrador, " +
            "ou os atalhos Cliente / Profissional."
          );
        }
        // No modo demo o painel administrativo só abre para a conta proprietária.
        if (profile.role === "admin" && mail !== String(SG.config.owner.email).toLowerCase()) {
          throw new Error("Acesso administrativo restrito.");
        }
        if (profile.status === "blocked") throw new Error("Esta conta está bloqueada. Fale com o suporte.");
        saveDemoSession({ user_id: profile.id });
        return clone(profile);
      });
    }
    return sb().auth.signInWithPassword({ email: email, password: password }).then(unwrap);
  };

  /** Atalho do modo demo: entra direto como cliente, profissional ou admin. */
  api.auth.demoLogin = function (kind) {
    var acc = SG.mock.accounts[kind] || SG.mock.accounts.client;
    return api.auth.signIn(acc.email, "demo");
  };

  api.auth.signOut = function () {
    if (DEMO) { clearDemoSession(); return delay(180); }
    return sb().auth.signOut().then(function (r) { if (r && r.error) throw r.error; });
  };

  api.auth.currentUserId = function () {
    if (DEMO) {
      var s = readDemoSession();
      return Promise.resolve(s ? s.user_id : null);
    }
    return sb().auth.getSession().then(function (r) {
      return r.data && r.data.session ? r.data.session.user.id : null;
    });
  };

  api.auth.me = function () {
    return api.auth.currentUserId().then(function (id) {
      if (!id) return null;
      return api.profiles.get(id);
    });
  };

  api.auth.resetPassword = function (email) {
    if (DEMO) return delay(500);
    return sb().auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(unwrap);
  };

  /* ==========================================================================
     PERFIS
     ========================================================================== */
  api.profiles = {};

  api.profiles.get = function (id) {
    if (DEMO) {
      return delay(150).then(function () {
        var p = clone(findProfile(id));
        if (p && p.role === "professional") p.professional = hydrateProfessional(id);
        return p;
      });
    }
    return sb().from("profiles").select("*").eq("id", id).maybeSingle().then(unwrap).then(function (p) {
      if (!p) return null;
      if (p.role !== "professional") return p;
      return sb().from("professionals").select("*").eq("id", id).maybeSingle().then(unwrap).then(function (pro) {
        p.professional = pro;
        return p;
      });
    });
  };

  api.profiles.update = function (id, patch) {
    if (DEMO) {
      return delay(300).then(function () {
        var p = findProfile(id);
        Object.assign(p, patch, { updated_at: nowIso() });
        return clone(p);
      });
    }
    return sb().from("profiles").update(patch).eq("id", id).select().single().then(unwrap);
  };

  /* ==========================================================================
     CATEGORIAS
     ========================================================================== */
  api.categories = {};

  api.categories.list = function () {
    if (DEMO) {
      return delay(120).then(function () {
        return clone(db.categories.filter(function (c) { return c.active; })
          .sort(function (a, b) { return a.sort_order - b.sort_order; }));
      });
    }
    return sb().from("categories").select("*").eq("active", true).order("sort_order").then(unwrap);
  };

  api.categories.upsert = function (payload) {
    if (DEMO) {
      return delay(260).then(function () {
        var existing = payload.id && findCat(payload.id);
        if (existing) { Object.assign(existing, payload); return clone(existing); }
        var c = Object.assign({ id: uid("cat"), active: true, sort_order: db.categories.length + 1, created_at: nowIso() }, payload);
        db.categories.push(c);
        return clone(c);
      });
    }
    return sb().from("categories").upsert(payload).select().single().then(unwrap);
  };

  api.categories.setActive = function (id, active) {
    if (DEMO) {
      return delay(200).then(function () { findCat(id).active = active; });
    }
    return sb().from("categories").update({ active: active }).eq("id", id).then(unwrap);
  };

  /* ==========================================================================
     PROFISSIONAIS
     ========================================================================== */
  api.professionals = {};

  api.professionals.get = function (id) {
    if (DEMO) return delay(220).then(function () { return hydrateProfessional(id); });
    return sb().from("professionals")
      .select("*, profile:profiles!professionals_id_fkey(full_name, avatar_url, city, state, status), professional_categories(category:categories(*))")
      .eq("id", id).maybeSingle().then(unwrap).then(function (p) {
        if (!p) return null;
        p.full_name = p.profile && p.profile.full_name;
        p.avatar_url = p.profile && p.profile.avatar_url;
        p.categories = (p.professional_categories || []).map(function (pc) { return pc.category; });
        return p;
      });
  };

  api.professionals.search = function (opts) {
    opts = opts || {};
    if (DEMO) {
      return delay(500).then(function () {
        var ids = db.professional_categories
          .filter(function (pc) { return !opts.category_id || pc.category_id === opts.category_id; })
          .map(function (pc) { return pc.professional_id; });
        var seen = {};
        var list = ids.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; })
          .map(hydrateProfessional)
          .filter(function (p) { return p && p.status === "active" && p.verification_status === "approved"; })
          .map(function (p) {
            var pc = db.professional_categories.filter(function (x) {
              return x.professional_id === p.id && (!opts.category_id || x.category_id === opts.category_id);
            })[0];
            p.price_from = (pc && pc.price_from) || p.base_price;
            p.eta_minutes = Math.round(8 + p.distance_km * 3);
            return p;
          })
          .filter(function (p) { return p.distance_km <= (opts.radius_km || SG.config.app.defaultRadiusKm); })
          .sort(function (a, b) {
            if (opts.sort === "price") return a.price_from - b.price_from;
            if (opts.sort === "distance") return a.distance_km - b.distance_km;
            return b.rating - a.rating || a.distance_km - b.distance_km;
          });
        return clone(list.slice(0, opts.limit || 20));
      });
    }
    return sb().rpc("search_professionals", {
      p_category_id: opts.category_id,
      p_lat: opts.lat, p_lng: opts.lng,
      p_radius_km: opts.radius_km || SG.config.app.defaultRadiusKm,
      p_limit: opts.limit || 20
    }).then(unwrap);
  };

  api.professionals.update = function (id, patch) {
    if (DEMO) {
      return delay(300).then(function () {
        Object.assign(findPro(id), patch);
        return hydrateProfessional(id);
      });
    }
    return sb().from("professionals").update(patch).eq("id", id).select().single().then(unwrap);
  };

  api.professionals.setAvailability = function (id, available) {
    return api.professionals.update(id, { is_available: available });
  };

  api.professionals.setCategories = function (id, categoryIds, basePrice) {
    if (DEMO) {
      return delay(280).then(function () {
        db.professional_categories = db.professional_categories.filter(function (pc) { return pc.professional_id !== id; });
        categoryIds.forEach(function (c) {
          db.professional_categories.push({ professional_id: id, category_id: c, price_from: basePrice || findPro(id).base_price });
        });
      });
    }
    return sb().from("professional_categories").delete().eq("professional_id", id).then(function () {
      if (!categoryIds.length) return null;
      return sb().from("professional_categories").insert(categoryIds.map(function (c) {
        return { professional_id: id, category_id: c, price_from: basePrice || null };
      })).then(unwrap);
    });
  };

  api.professionals.listAll = function (filter) {
    if (DEMO) {
      return delay(260).then(function () {
        return db.professionals.map(function (p) { return hydrateProfessional(p.id); })
          .filter(function (p) { return !filter || !filter.status || p.verification_status === filter.status; });
      });
    }
    var q = sb().from("professionals").select("*, profile:profiles!professionals_id_fkey(full_name, email, phone, status)");
    if (filter && filter.status) q = q.eq("verification_status", filter.status);
    return q.order("created_at", { ascending: false }).then(unwrap).then(function (rows) {
      return rows.map(function (r) { r.full_name = r.profile && r.profile.full_name; return r; });
    });
  };

  /* ==========================================================================
     SOLICITAÇÕES
     ========================================================================== */
  api.requests = {};

  api.requests.create = function (payload) {
    if (DEMO) {
      return delay(600).then(function () {
        var r = Object.assign({
          id: uid("req"), status: "matching", created_at: nowIso(), updated_at: nowIso(),
          scheduled_for: null, budget_hint: null, lat: -23.578, lng: -46.634
        }, payload);
        db.service_requests.unshift(r);
        scheduleDemoOffers(r);
        return hydrateRequest(r);
      });
    }
    return sb().from("service_requests").insert(payload).select().single().then(unwrap);
  };

  api.requests.get = function (id) {
    if (DEMO) return delay(220).then(function () {
      var r = db.service_requests.filter(function (x) { return x.id === id; })[0];
      return r ? hydrateRequest(r) : null;
    });
    return sb().from("service_requests")
      .select("*, category:categories(*), client:profiles!service_requests_client_id_fkey(id, full_name, avatar_url, phone), photos:service_photos(*)")
      .eq("id", id).maybeSingle().then(unwrap);
  };

  api.requests.listMine = function (clientId) {
    if (DEMO) {
      return delay(240).then(function () {
        return db.service_requests.filter(function (r) { return r.client_id === clientId; }).map(hydrateRequest);
      });
    }
    return sb().from("service_requests")
      .select("*, category:categories(*), offers:service_offers(count), booking:bookings(*)")
      .eq("client_id", clientId).order("created_at", { ascending: false }).then(unwrap);
  };

  /** Feed do profissional: solicitações abertas nas suas categorias. */
  api.requests.listOpportunities = function (professionalId) {
    if (DEMO) {
      return delay(320).then(function () {
        var cats = db.professional_categories
          .filter(function (pc) { return pc.professional_id === professionalId; })
          .map(function (pc) { return pc.category_id; });
        return db.service_requests
          .filter(function (r) {
            if (["open", "matching"].indexOf(r.status) < 0) return false;
            if (cats.indexOf(r.category_id) < 0) return false;
            return true;
          })
          .map(function (r) {
            var h = hydrateRequest(r);
            h.distance_km = Math.round((1 + Math.random() * 6) * 10) / 10;
            h.my_offer = db.service_offers.filter(function (o) {
              return o.request_id === r.id && o.professional_id === professionalId;
            })[0] || null;
            return h;
          })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      });
    }
    return sb().from("professional_categories").select("category_id").eq("professional_id", professionalId)
      .then(unwrap).then(function (cats) {
        var ids = cats.map(function (c) { return c.category_id; });
        if (!ids.length) return [];
        return sb().from("service_requests")
          .select("*, category:categories(*), photos:service_photos(*), my_offer:service_offers(*)")
          .in("category_id", ids).in("status", ["open", "matching"])
          .order("created_at", { ascending: false }).limit(40).then(unwrap);
      });
  };

  api.requests.updateStatus = function (id, status) {
    if (DEMO) {
      return delay(240).then(function () {
        var r = db.service_requests.filter(function (x) { return x.id === id; })[0];
        r.status = status; r.updated_at = nowIso();
        return hydrateRequest(r);
      });
    }
    return sb().from("service_requests").update({ status: status }).eq("id", id).select().single().then(unwrap);
  };

  api.requests.cancel = function (id) { return api.requests.updateStatus(id, "cancelled"); };

  api.requests.listAll = function () {
    if (DEMO) return delay(260).then(function () { return db.service_requests.map(hydrateRequest); });
    return sb().from("service_requests")
      .select("*, category:categories(*), client:profiles!service_requests_client_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(100).then(unwrap);
  };

  /* ---- Fotos -------------------------------------------------------------- */
  api.photos = {};

  api.photos.upload = function (requestId, userId, files) {
    if (DEMO) {
      return Promise.all(Array.prototype.map.call(files, function (f) {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () { resolve(fr.result); };
          fr.onerror = function () { resolve(SG.mock.photo(3, "📷")); };
          fr.readAsDataURL(f);
        });
      })).then(function (urls) {
        return urls.map(function (url) {
          var rec = { id: uid("ph"), request_id: requestId, uploaded_by: userId, storage_path: "demo", url: url, created_at: nowIso() };
          db.service_photos.push(rec);
          return clone(rec);
        });
      });
    }
    var bucket = SG.config.buckets.servicePhotos;
    return Promise.all(Array.prototype.map.call(files, function (file) {
      var path = userId + "/" + requestId + "/" + Date.now() + "-" + file.name.replace(/[^\w.\-]/g, "_");
      return sb().storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false })
        .then(function (res) {
          if (res.error) throw res.error;
          var pub = sb().storage.from(bucket).getPublicUrl(path);
          return { request_id: requestId, uploaded_by: userId, storage_path: path, url: pub.data.publicUrl };
        });
    })).then(function (rows) {
      return sb().from("service_photos").insert(rows).select().then(unwrap);
    });
  };

  api.photos.uploadChatImage = function (userId, file) {
    if (DEMO) {
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.readAsDataURL(file);
      });
    }
    var bucket = SG.config.buckets.chatImages;
    var path = userId + "/" + Date.now() + "-" + file.name.replace(/[^\w.\-]/g, "_");
    return sb().storage.from(bucket).upload(path, file).then(function (res) {
      if (res.error) throw res.error;
      return sb().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    });
  };

  api.photos.uploadAvatar = function (userId, file) {
    if (DEMO) {
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.readAsDataURL(file);
      });
    }
    var bucket = SG.config.buckets.avatars;
    var path = userId + "/avatar-" + Date.now() + "." + (file.name.split(".").pop() || "jpg");
    return sb().storage.from(bucket).upload(path, file, { upsert: true }).then(function (res) {
      if (res.error) throw res.error;
      return sb().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    });
  };

  /* ==========================================================================
     ORÇAMENTOS (OFERTAS)
     ========================================================================== */
  api.offers = {};

  function hydrateOffer(o) {
    var out = clone(o);
    out.professional = hydrateProfessional(o.professional_id);
    return out;
  }

  api.offers.listByRequest = function (requestId) {
    if (DEMO) {
      return delay(260).then(function () {
        return db.service_offers.filter(function (o) { return o.request_id === requestId && o.status !== "withdrawn"; })
          .map(hydrateOffer)
          .sort(function (a, b) { return (b.professional.rating || 0) - (a.professional.rating || 0); });
      });
    }
    return sb().from("service_offers")
      .select("*, professional:professionals(*, profile:profiles!professionals_id_fkey(full_name, avatar_url))")
      .eq("request_id", requestId).neq("status", "withdrawn")
      .order("created_at", { ascending: true }).then(unwrap).then(function (rows) {
        rows.forEach(function (r) {
          if (r.professional && r.professional.profile) {
            r.professional.full_name = r.professional.profile.full_name;
            r.professional.avatar_url = r.professional.profile.avatar_url;
          }
        });
        return rows;
      });
  };

  api.offers.create = function (payload) {
    if (DEMO) {
      return delay(420).then(function () {
        var o = Object.assign({ id: uid("off"), status: "pending", created_at: nowIso(), updated_at: nowIso() }, payload);
        db.service_offers.push(o);
        var req = db.service_requests.filter(function (r) { return r.id === payload.request_id; })[0];
        if (req && req.status === "open") req.status = "matching";
        pushDemoNotification(req.client_id, "offer", "Novo orçamento recebido",
          (hydrateProfessional(payload.professional_id) || {}).full_name + " enviou " + ui.money(payload.price),
          "#/solicitacao/" + payload.request_id);
        bus.emit("offers:" + payload.request_id, hydrateOffer(o));
        return hydrateOffer(o);
      });
    }
    return sb().from("service_offers").insert(payload).select().single().then(unwrap);
  };

  api.offers.listMine = function (professionalId) {
    if (DEMO) {
      return delay(240).then(function () {
        return db.service_offers.filter(function (o) { return o.professional_id === professionalId; })
          .map(function (o) {
            var out = clone(o);
            var r = db.service_requests.filter(function (x) { return x.id === o.request_id; })[0];
            out.request = r ? hydrateRequest(r) : null;
            return out;
          })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      });
    }
    return sb().from("service_offers")
      .select("*, request:service_requests(*, category:categories(*))")
      .eq("professional_id", professionalId).order("created_at", { ascending: false }).then(unwrap);
  };

  /** Aceitar orçamento → cria o contrato (booking) e recusa os demais. */
  api.offers.accept = function (offerId) {
    if (DEMO) {
      return delay(620).then(function () {
        var offer = db.service_offers.filter(function (o) { return o.id === offerId; })[0];
        var req = db.service_requests.filter(function (r) { return r.id === offer.request_id; })[0];
        db.service_offers.forEach(function (o) {
          if (o.request_id === offer.request_id) o.status = o.id === offerId ? "accepted" : "rejected";
        });
        req.status = "assigned"; req.updated_at = nowIso();
        var bk = {
          id: uid("bk"), request_id: req.id, offer_id: offer.id, client_id: req.client_id,
          professional_id: offer.professional_id, price: offer.price, status: "accepted",
          accepted_at: nowIso(), started_at: null, arrived_at: null, completed_at: null,
          cancelled_at: null, cancel_reason: null, created_at: nowIso(), updated_at: nowIso()
        };
        db.bookings.unshift(bk);
        db.booking_events.push({ id: uid("ev"), booking_id: bk.id, status: "accepted", note: null, created_at: nowIso() });
        pushDemoNotification(offer.professional_id, "booking", "Seu orçamento foi aceito!",
          req.title, "#/servico/" + bk.id);
        scheduleDemoBookingProgress(bk);
        return clone(bk);
      });
    }
    return sb().from("service_offers").select("*, request:service_requests(*)").eq("id", offerId).single()
      .then(unwrap).then(function (offer) {
        return sb().from("service_offers").update({ status: "accepted" }).eq("id", offerId).then(function () {
          return sb().from("service_offers").update({ status: "rejected" })
            .eq("request_id", offer.request_id).neq("id", offerId);
        }).then(function () {
          return sb().from("bookings").insert({
            request_id: offer.request_id, offer_id: offer.id, client_id: offer.request.client_id,
            professional_id: offer.professional_id, price: offer.price, status: "accepted"
          }).select().single().then(unwrap);
        }).then(function (bk) {
          return sb().from("service_requests").update({ status: "assigned" }).eq("id", offer.request_id)
            .then(function () { return bk; });
        });
      });
  };

  api.offers.reject = function (offerId) {
    if (DEMO) {
      return delay(240).then(function () {
        db.service_offers.filter(function (o) { return o.id === offerId; })[0].status = "rejected";
      });
    }
    return sb().from("service_offers").update({ status: "rejected" }).eq("id", offerId).then(unwrap);
  };

  /* ==========================================================================
     CONTRATOS (BOOKINGS)
     ========================================================================== */
  api.bookings = {};

  function hydrateBooking(b) {
    var out = clone(b);
    var req = db.service_requests.filter(function (r) { return r.id === b.request_id; })[0];
    out.request = req ? hydrateRequest(req) : null;
    out.professional = hydrateProfessional(b.professional_id);
    out.client = clone(findProfile(b.client_id));
    out.events = db.booking_events.filter(function (e) { return e.booking_id === b.id; })
      .sort(function (a, b2) { return new Date(a.created_at) - new Date(b2.created_at); }).map(clone);
    out.review = db.reviews.filter(function (r) { return r.booking_id === b.id; })[0] || null;
    return out;
  }

  api.bookings.get = function (id) {
    if (DEMO) return delay(240).then(function () {
      var b = db.bookings.filter(function (x) { return x.id === id; })[0];
      return b ? hydrateBooking(b) : null;
    });
    return sb().from("bookings")
      .select("*, request:service_requests(*, category:categories(*), photos:service_photos(*)), " +
        "professional:professionals(*, profile:profiles!professionals_id_fkey(full_name, avatar_url, phone)), " +
        "client:profiles!bookings_client_id_fkey(full_name, avatar_url, phone), events:booking_events(*), review:reviews(*)")
      .eq("id", id).maybeSingle().then(unwrap);
  };

  api.bookings.listForUser = function (userId, role) {
    if (DEMO) {
      return delay(260).then(function () {
        return db.bookings.filter(function (b) {
          return role === "professional" ? b.professional_id === userId : b.client_id === userId;
        }).map(hydrateBooking);
      });
    }
    var col = role === "professional" ? "professional_id" : "client_id";
    return sb().from("bookings")
      .select("*, request:service_requests(*, category:categories(*)), " +
        "professional:professionals(*, profile:profiles!professionals_id_fkey(full_name, avatar_url)), " +
        "client:profiles!bookings_client_id_fkey(full_name, avatar_url), review:reviews(*)")
      .eq(col, userId).order("created_at", { ascending: false }).then(unwrap);
  };

  api.bookings.updateStatus = function (id, status, note) {
    if (DEMO) {
      return delay(340).then(function () {
        var b = db.bookings.filter(function (x) { return x.id === id; })[0];
        b.status = status; b.updated_at = nowIso();
        if (status === "on_the_way") b.started_at = b.started_at || nowIso();
        if (status === "arrived") b.arrived_at = nowIso();
        if (status === "completed") {
          b.completed_at = nowIso();
          var req = db.service_requests.filter(function (r) { return r.id === b.request_id; })[0];
          if (req) req.status = "completed";
          var pro = findPro(b.professional_id);
          if (pro) pro.jobs_count += 1;
          var fee = Math.round(b.price * (SG.config.app.platformFeePercent / 100) * 100) / 100;
          db.transactions.unshift({
            id: uid("tx"), booking_id: b.id, professional_id: b.professional_id, client_id: b.client_id,
            amount: b.price, platform_fee: fee, net_amount: b.price - fee, status: "pending", created_at: nowIso()
          });
        }
        if (status === "in_progress") {
          var reqq = db.service_requests.filter(function (r) { return r.id === b.request_id; })[0];
          if (reqq) reqq.status = "in_progress";
        }
        db.booking_events.push({ id: uid("ev"), booking_id: id, status: status, note: note || null, created_at: nowIso() });
        pushDemoNotification(b.client_id, "status", ui.labels.bookingStatus[status], "", "#/acompanhar/" + b.id);
        bus.emit("booking:" + id, hydrateBooking(b));
        return hydrateBooking(b);
      });
    }
    return sb().from("bookings").update({ status: status }).eq("id", id).select().single().then(unwrap);
  };

  api.bookings.cancel = function (id, reason) {
    if (DEMO) {
      return delay(340).then(function () {
        var b = db.bookings.filter(function (x) { return x.id === id; })[0];
        b.status = "cancelled"; b.cancelled_at = nowIso(); b.cancel_reason = reason || null;
        var req = db.service_requests.filter(function (r) { return r.id === b.request_id; })[0];
        if (req) req.status = "cancelled";
        db.booking_events.push({ id: uid("ev"), booking_id: id, status: "cancelled", note: reason, created_at: nowIso() });
        return hydrateBooking(b);
      });
    }
    return sb().from("bookings")
      .update({ status: "cancelled", cancelled_at: nowIso(), cancel_reason: reason || null })
      .eq("id", id).select().single().then(unwrap);
  };

  api.bookings.subscribe = function (id, cb) {
    if (DEMO) return bus.on("booking:" + id, cb);
    var ch = sb().channel("booking-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: "id=eq." + id }, function () {
        api.bookings.get(id).then(cb);
      }).subscribe();
    return function () { sb().removeChannel(ch); };
  };

  /* ==========================================================================
     MENSAGENS
     ========================================================================== */
  api.messages = {};

  api.messages.listConversations = function (userId) {
    if (DEMO) {
      return delay(240).then(function () {
        var byReq = {};
        db.messages.forEach(function (m) {
          if (m.sender_id !== userId && m.recipient_id !== userId) return;
          var other = m.sender_id === userId ? m.recipient_id : m.sender_id;
          var key = m.request_id;
          if (!byReq[key] || new Date(m.created_at) > new Date(byReq[key].last.created_at)) {
            byReq[key] = { request_id: key, other_id: other, last: m, unread: 0 };
          }
        });
        Object.keys(byReq).forEach(function (k) {
          byReq[k].unread = db.messages.filter(function (m) {
            return m.request_id === k && m.recipient_id === userId && !m.read_at;
          }).length;
          var r = db.service_requests.filter(function (x) { return x.id === k; })[0];
          byReq[k].request = r ? hydrateRequest(r) : null;
          var other = findProfile(byReq[k].other_id);
          byReq[k].other = other ? clone(other) : null;
          var pro = findPro(byReq[k].other_id);
          if (pro && byReq[k].other) byReq[k].other.is_available = pro.is_available;
        });
        return Object.keys(byReq).map(function (k) { return byReq[k]; })
          .sort(function (a, b) { return new Date(b.last.created_at) - new Date(a.last.created_at); });
      });
    }
    return sb().from("messages")
      .select("*, request:service_requests(id, title, category:categories(icon, name))")
      .or("sender_id.eq." + userId + ",recipient_id.eq." + userId)
      .order("created_at", { ascending: false }).limit(200).then(unwrap).then(function (rows) {
        var byReq = {};
        rows.forEach(function (m) {
          if (byReq[m.request_id]) return;
          byReq[m.request_id] = {
            request_id: m.request_id, request: m.request,
            other_id: m.sender_id === userId ? m.recipient_id : m.sender_id,
            last: m, unread: 0
          };
        });
        rows.forEach(function (m) {
          if (m.recipient_id === userId && !m.read_at && byReq[m.request_id]) byReq[m.request_id].unread++;
        });
        var list = Object.keys(byReq).map(function (k) { return byReq[k]; });
        var ids = list.map(function (c) { return c.other_id; });
        if (!ids.length) return list;
        return sb().from("profiles").select("id, full_name, avatar_url").in("id", ids).then(unwrap)
          .then(function (people) {
            list.forEach(function (c) {
              c.other = people.filter(function (p) { return p.id === c.other_id; })[0] || null;
            });
            return list;
          });
      });
  };

  api.messages.list = function (requestId) {
    if (DEMO) {
      return delay(200).then(function () {
        return db.messages.filter(function (m) { return m.request_id === requestId; })
          .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }).map(clone);
      });
    }
    return sb().from("messages").select("*").eq("request_id", requestId)
      .order("created_at", { ascending: true }).then(unwrap);
  };

  api.messages.send = function (payload) {
    if (DEMO) {
      return delay(180).then(function () {
        var m = Object.assign({ id: uid("msg"), image_url: null, read_at: null, created_at: nowIso() }, payload);
        db.messages.push(m);
        bus.emit("messages:" + payload.request_id, clone(m));
        scheduleDemoReply(m);
        return clone(m);
      });
    }
    return sb().from("messages").insert(payload).select().single().then(unwrap);
  };

  api.messages.markRead = function (requestId, userId) {
    if (DEMO) {
      return delay(80).then(function () {
        db.messages.forEach(function (m) {
          if (m.request_id === requestId && m.recipient_id === userId && !m.read_at) m.read_at = nowIso();
        });
      });
    }
    return sb().from("messages").update({ read_at: nowIso() })
      .eq("request_id", requestId).eq("recipient_id", userId).is("read_at", null).then(unwrap);
  };

  api.messages.subscribe = function (requestId, cb) {
    if (DEMO) return bus.on("messages:" + requestId, cb);
    var ch = sb().channel("chat-" + requestId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "request_id=eq." + requestId },
        function (p) { cb(p.new); })
      .subscribe();
    return function () { sb().removeChannel(ch); };
  };

  /** Indicador "digitando…" via broadcast (não persiste no banco). */
  api.messages.typingChannel = function (requestId, onTyping) {
    if (DEMO) {
      return { send: function () {}, close: bus.on("typing:" + requestId, onTyping) };
    }
    var ch = sb().channel("typing-" + requestId, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, function (p) { onTyping(p.payload); })
      .subscribe();
    return {
      send: function (userId) { ch.send({ type: "broadcast", event: "typing", payload: { user_id: userId } }); },
      close: function () { sb().removeChannel(ch); }
    };
  };

  api.messages.unreadCount = function (userId) {
    if (DEMO) {
      return delay(60).then(function () {
        return db.messages.filter(function (m) { return m.recipient_id === userId && !m.read_at; }).length;
      });
    }
    return sb().from("messages").select("id", { count: "exact", head: true })
      .eq("recipient_id", userId).is("read_at", null)
      .then(function (r) { if (r.error) throw r.error; return r.count || 0; });
  };

  /* ==========================================================================
     AVALIAÇÕES
     ========================================================================== */
  api.reviews = {};

  api.reviews.listByProfessional = function (professionalId) {
    if (DEMO) {
      return delay(240).then(function () {
        return db.reviews.filter(function (r) { return r.professional_id === professionalId; })
          .map(function (r) { var o = clone(r); o.client = clone(findProfile(r.client_id)); return o; })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      });
    }
    return sb().from("reviews")
      .select("*, client:profiles!reviews_client_id_fkey(full_name, avatar_url)")
      .eq("professional_id", professionalId).order("created_at", { ascending: false }).then(unwrap);
  };

  api.reviews.create = function (payload) {
    if (DEMO) {
      return delay(420).then(function () {
        var r = Object.assign({ id: uid("rv"), reply: null, replied_at: null, created_at: nowIso() }, payload);
        db.reviews.unshift(r);
        var pro = findPro(payload.professional_id);
        if (pro) {
          var all = db.reviews.filter(function (x) { return x.professional_id === pro.id; });
          pro.reviews_count = all.length;
          pro.rating = Math.round((all.reduce(function (s, x) { return s + x.rating; }, 0) / all.length) * 100) / 100;
        }
        pushDemoNotification(payload.professional_id, "review", "Você recebeu uma avaliação",
          payload.rating + " estrelas", "#/avaliacoes");
        return clone(r);
      });
    }
    return sb().from("reviews").insert(payload).select().single().then(unwrap);
  };

  api.reviews.reply = function (id, reply) {
    if (DEMO) {
      return delay(280).then(function () {
        var r = db.reviews.filter(function (x) { return x.id === id; })[0];
        r.reply = reply; r.replied_at = nowIso();
        return clone(r);
      });
    }
    return sb().from("reviews").update({ reply: reply, replied_at: nowIso() }).eq("id", id).select().single().then(unwrap);
  };

  /* ==========================================================================
     NOTIFICAÇÕES
     ========================================================================== */
  api.notifications = {};

  function pushDemoNotification(userId, type, title, body, link) {
    var n = { id: uid("nt"), user_id: userId, type: type, title: title, body: body, link: link, read_at: null, created_at: nowIso() };
    db.notifications.unshift(n);
    bus.emit("notifications:" + userId, clone(n));
    return n;
  }
  api._notify = pushDemoNotification;

  api.notifications.list = function (userId) {
    if (DEMO) {
      return delay(160).then(function () {
        return db.notifications.filter(function (n) { return n.user_id === userId; })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
          .slice(0, 30).map(clone);
      });
    }
    return sb().from("notifications").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(30).then(unwrap);
  };

  api.notifications.markAllRead = function (userId) {
    if (DEMO) {
      return delay(120).then(function () {
        db.notifications.forEach(function (n) { if (n.user_id === userId) n.read_at = nowIso(); });
      });
    }
    return sb().from("notifications").update({ read_at: nowIso() })
      .eq("user_id", userId).is("read_at", null).then(unwrap);
  };

  api.notifications.subscribe = function (userId, cb) {
    if (DEMO) return bus.on("notifications:" + userId, cb);
    var ch = sb().channel("notif-" + userId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + userId },
        function (p) { cb(p.new); })
      .subscribe();
    return function () { sb().removeChannel(ch); };
  };

  /* ==========================================================================
     FAVORITOS
     ========================================================================== */
  api.favorites = {};

  api.favorites.list = function (clientId) {
    if (DEMO) {
      return delay(180).then(function () {
        return db.favorites.filter(function (f) { return f.client_id === clientId; })
          .map(function (f) { return hydrateProfessional(f.professional_id); }).filter(Boolean);
      });
    }
    return sb().from("favorites")
      .select("professional:professionals(*, profile:profiles!professionals_id_fkey(full_name, avatar_url))")
      .eq("client_id", clientId).then(unwrap).then(function (rows) {
        return rows.map(function (r) {
          var p = r.professional;
          if (p && p.profile) { p.full_name = p.profile.full_name; p.avatar_url = p.profile.avatar_url; }
          return p;
        });
      });
  };

  api.favorites.toggle = function (clientId, professionalId) {
    if (DEMO) {
      return delay(180).then(function () {
        var i = db.favorites.findIndex(function (f) { return f.client_id === clientId && f.professional_id === professionalId; });
        if (i >= 0) { db.favorites.splice(i, 1); return false; }
        db.favorites.push({ client_id: clientId, professional_id: professionalId, created_at: nowIso() });
        return true;
      });
    }
    return sb().from("favorites").select("client_id").eq("client_id", clientId)
      .eq("professional_id", professionalId).maybeSingle().then(unwrap).then(function (row) {
        if (row) {
          return sb().from("favorites").delete().eq("client_id", clientId)
            .eq("professional_id", professionalId).then(function () { return false; });
        }
        return sb().from("favorites").insert({ client_id: clientId, professional_id: professionalId })
          .then(function () { return true; });
      });
  };

  api.favorites.has = function (clientId, professionalId) {
    if (DEMO) {
      return delay(60).then(function () {
        return db.favorites.some(function (f) { return f.client_id === clientId && f.professional_id === professionalId; });
      });
    }
    return sb().from("favorites").select("client_id").eq("client_id", clientId)
      .eq("professional_id", professionalId).maybeSingle().then(unwrap).then(Boolean);
  };

  /* ==========================================================================
     GANHOS / FINANCEIRO
     ========================================================================== */
  api.earnings = {};

  api.earnings.get = function (professionalId) {
    if (DEMO) {
      return delay(300).then(function () {
        var tx = db.transactions.filter(function (t) { return t.professional_id === professionalId && t.status !== "refunded"; });
        var startOf = function (unit) {
          var d = new Date();
          d.setHours(0, 0, 0, 0);
          if (unit === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          if (unit === "month") d.setDate(1);
          return d;
        };
        var sum = function (from) {
          return tx.filter(function (t) { return new Date(t.created_at) >= from; })
            .reduce(function (s, t) { return s + t.net_amount; }, 0);
        };
        var serie = [];
        for (var i = 6; i >= 0; i--) {
          var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
          var next = new Date(d); next.setDate(next.getDate() + 1);
          serie.push({
            dia: d.toISOString().slice(0, 10),
            valor: tx.filter(function (t) { var c = new Date(t.created_at); return c >= d && c < next; })
              .reduce(function (s, t) { return s + t.net_amount; }, 0)
          });
        }
        return {
          hoje: sum(startOf("day")), semana: sum(startOf("week")), mes: sum(startOf("month")),
          total: tx.reduce(function (s, t) { return s + t.net_amount; }, 0),
          a_receber: tx.filter(function (t) { return t.status === "pending"; })
            .reduce(function (s, t) { return s + t.net_amount; }, 0),
          servicos_concluidos: db.bookings.filter(function (b) {
            return b.professional_id === professionalId && b.status === "completed";
          }).length,
          ultimos_7_dias: serie
        };
      });
    }
    return sb().rpc("professional_earnings", { p_professional_id: professionalId }).then(unwrap);
  };

  api.earnings.transactions = function (professionalId) {
    if (DEMO) {
      return delay(200).then(function () {
        return db.transactions.filter(function (t) { return t.professional_id === professionalId; }).map(clone);
      });
    }
    return sb().from("transactions").select("*").eq("professional_id", professionalId)
      .order("created_at", { ascending: false }).limit(50).then(unwrap);
  };

  /* ==========================================================================
     ADMINISTRAÇÃO
     ========================================================================== */
  api.admin = {};

  api.admin.metrics = function () {
    if (DEMO) {
      return delay(320).then(function () {
        var completed = db.bookings.filter(function (b) { return b.status === "completed"; }).length;
        return {
          total_usuarios: db.profiles.length,
          total_clientes: db.profiles.filter(function (p) { return p.role === "client"; }).length,
          total_profissionais: db.professionals.length,
          profissionais_pendentes: db.professionals.filter(function (p) { return p.verification_status === "pending"; }).length,
          total_solicitacoes: db.service_requests.length,
          solicitacoes_abertas: db.service_requests.filter(function (r) { return ["open", "matching"].indexOf(r.status) >= 0; }).length,
          servicos_concluidos: completed + 128,
          volume_transacionado: db.transactions.reduce(function (s, t) { return s + t.amount; }, 0) + 48260,
          receita_plataforma: db.transactions.reduce(function (s, t) { return s + t.platform_fee; }, 0) + 4826,
          taxa_conclusao: db.bookings.length ? Math.round((completed / db.bookings.length) * 1000) / 10 : 0
        };
      });
    }
    return sb().rpc("admin_metrics").then(unwrap);
  };

  api.admin.listUsers = function (filter) {
    if (DEMO) {
      return delay(240).then(function () {
        return db.profiles.filter(function (p) {
          if (filter && filter.role && p.role !== filter.role) return false;
          if (filter && filter.q) {
            var q = filter.q.toLowerCase();
            return (p.full_name || "").toLowerCase().indexOf(q) >= 0 || (p.email || "").toLowerCase().indexOf(q) >= 0;
          }
          return true;
        }).map(clone);
      });
    }
    var q = sb().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter && filter.role) q = q.eq("role", filter.role);
    return q.then(unwrap);
  };

  api.admin.setUserStatus = function (id, status) {
    if (DEMO) {
      return delay(240).then(function () { findProfile(id).status = status; });
    }
    return sb().from("profiles").update({ status: status }).eq("id", id).then(unwrap);
  };

  api.admin.setVerification = function (professionalId, status) {
    if (DEMO) {
      return delay(280).then(function () {
        var p = findPro(professionalId);
        p.verification_status = status;
        p.verified = status === "approved";
        pushDemoNotification(professionalId, "verification",
          status === "approved" ? "Cadastro aprovado" : "Cadastro reprovado",
          status === "approved" ? "Você já pode receber solicitações." : "Revise seus documentos.", "#/perfil");
      });
    }
    return sb().from("professionals")
      .update({ verification_status: status, verified: status === "approved" })
      .eq("id", professionalId).then(unwrap);
  };

  api.admin.listReports = function () {
    if (DEMO) {
      return delay(200).then(function () {
        return db.reports.map(function (r) {
          var o = clone(r);
          o.reporter = clone(findProfile(r.reporter_id));
          o.target = clone(findProfile(r.target_user_id));
          return o;
        });
      });
    }
    return sb().from("reports")
      .select("*, reporter:profiles!reports_reporter_id_fkey(full_name), target:profiles!reports_target_user_id_fkey(full_name)")
      .order("created_at", { ascending: false }).then(unwrap);
  };

  api.admin.resolveReport = function (id, status) {
    if (DEMO) {
      return delay(220).then(function () {
        var r = db.reports.filter(function (x) { return x.id === id; })[0];
        r.status = status; r.resolved_at = nowIso();
      });
    }
    return sb().from("reports").update({ status: status, resolved_at: nowIso() }).eq("id", id).then(unwrap);
  };

  api.admin.listDocuments = function () {
    if (DEMO) {
      return delay(200).then(function () {
        return db.professional_documents.map(function (d) {
          var o = clone(d);
          o.professional = hydrateProfessional(d.professional_id);
          return o;
        });
      });
    }
    return sb().from("professional_documents")
      .select("*, professional:professionals(id, profile:profiles!professionals_id_fkey(full_name))")
      .order("created_at", { ascending: false }).then(unwrap);
  };

  api.admin.listReviews = function () {
    if (DEMO) {
      return delay(200).then(function () {
        return db.reviews.map(function (r) {
          var o = clone(r);
          o.client = clone(findProfile(r.client_id));
          o.professional = hydrateProfessional(r.professional_id);
          return o;
        });
      });
    }
    return sb().from("reviews")
      .select("*, client:profiles!reviews_client_id_fkey(full_name), professional:professionals(id, profile:profiles!professionals_id_fkey(full_name))")
      .order("created_at", { ascending: false }).limit(100).then(unwrap);
  };

  /* ==========================================================================
     DENÚNCIAS
     ========================================================================== */
  api.reports = {};

  api.reports.create = function (payload) {
    if (DEMO) {
      return delay(320).then(function () {
        var r = Object.assign({ id: uid("rp"), status: "open", created_at: nowIso() }, payload);
        db.reports.unshift(r);
        return clone(r);
      });
    }
    return sb().from("reports").insert(payload).select().single().then(unwrap);
  };

  /* ==========================================================================
     SIMULAÇÕES DO MODO DEMO
     Fazem o marketplace parecer vivo: orçamentos chegando, respostas no chat,
     profissional avançando o status do serviço.
     ========================================================================== */
  function scheduleDemoOffers(request) {
    if (!DEMO) return;
    var candidates = db.professional_categories
      .filter(function (pc) { return pc.category_id === request.category_id; })
      .map(function (pc) { return pc.professional_id; })
      .filter(function (id) { var p = findPro(id); return p && p.verification_status === "approved"; });
    candidates.slice(0, 4).forEach(function (proId, i) {
      setTimeout(function () {
        var pro = findPro(proId);
        if (!pro) return;
        var base = (db.professional_categories.filter(function (pc) {
          return pc.professional_id === proId && pc.category_id === request.category_id;
        })[0] || {}).price_from || pro.base_price;
        var price = Math.round((base * (0.85 + Math.random() * 0.5)) / 5) * 5;
        var msgs = [
          "Consigo atender no horário informado. Preço já com mão de obra.",
          "Tenho disponibilidade e levo o material necessário. Garantia de 90 dias.",
          "Posso passar hoje para avaliar sem custo e já executar o serviço.",
          "Faço o serviço completo com emissão de nota fiscal."
        ];
        var o = {
          id: uid("off"), request_id: request.id, professional_id: proId, price: price,
          message: msgs[i % msgs.length], eta_minutes: Math.round(8 + pro.distance_km * 3),
          status: "pending", created_at: nowIso(), updated_at: nowIso()
        };
        db.service_offers.push(o);
        bus.emit("offers:" + request.id, hydrateOffer(o));
        pushDemoNotification(request.client_id, "offer", "Novo orçamento recebido",
          findProfile(proId).full_name + " — " + ui.money(price), "#/solicitacao/" + request.id);
      }, 1400 + i * 1100);
    });
  }

  function scheduleDemoBookingProgress(bk) {
    if (!DEMO) return;
    var steps = ["on_the_way", "arrived", "in_progress"];
    steps.forEach(function (s, i) {
      setTimeout(function () {
        var live = db.bookings.filter(function (b) { return b.id === bk.id; })[0];
        if (!live || live.status === "cancelled" || live.status === "completed") return;
        if (["on_the_way", "arrived", "in_progress"].indexOf(live.status) > i) return;
        live.status = s; live.updated_at = nowIso();
        if (s === "arrived") live.arrived_at = nowIso();
        if (s === "on_the_way") live.started_at = nowIso();
        db.booking_events.push({ id: uid("ev"), booking_id: bk.id, status: s, note: null, created_at: nowIso() });
        pushDemoNotification(bk.client_id, "status", ui.labels.bookingStatus[s],
          "Acompanhe em tempo real", "#/acompanhar/" + bk.id);
        bus.emit("booking:" + bk.id, hydrateBooking(live));
      }, 9000 + i * 12000);
    });
  }

  function scheduleDemoReply(msg) {
    if (!DEMO) return;
    var responder = msg.recipient_id;
    if (!findProfile(responder)) return;
    bus.emit("typing:" + msg.request_id, { user_id: responder });
    setTimeout(function () {
      var replies = [
        "Perfeito, anotado!",
        "Certo. Já estou organizando aqui e te aviso assim que sair.",
        "Combinado. Qualquer mudança eu aviso por aqui.",
        "Obrigado pela informação, isso ajuda bastante."
      ];
      var m = {
        id: uid("msg"), request_id: msg.request_id, booking_id: msg.booking_id,
        sender_id: responder, recipient_id: msg.sender_id,
        content: replies[Math.floor(Math.random() * replies.length)],
        image_url: null, read_at: null, created_at: nowIso()
      };
      db.messages.push(m);
      bus.emit("messages:" + msg.request_id, clone(m));
      pushDemoNotification(msg.sender_id, "message", "Nova mensagem", m.content, "#/mensagens/" + msg.request_id);
    }, 2400 + Math.random() * 2200);
  }

  SG.api = api;
})(window.SG);
