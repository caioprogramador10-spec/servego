/* ==========================================================================
   ServeGo — Base de demonstração (modo demo)
   --------------------------------------------------------------------------
   Enquanto o Supabase não estiver configurado em js/config.js, esta base em
   memória alimenta o app inteiro com dados realistas, mantendo EXATAMENTE o
   mesmo formato das tabelas do Postgres. Assim a camada de API (js/api.js)
   troca de fonte sem que nenhuma tela precise mudar.
   ========================================================================== */
(function (SG) {
  var uid = (function () {
    var n = 0;
    return function (p) { n++; return (p || "id") + "-" + n + "-" + Math.random().toString(36).slice(2, 8); };
  })();

  var now = Date.now();
  var hours = function (h) { return new Date(now - h * 3600e3).toISOString(); };
  var days = function (d) { return new Date(now - d * 86400e3).toISOString(); };

  /* ---- Imagem placeholder (sem depender de rede) -------------------------- */
  function photo(seed, label) {
    var palette = [["#1b1f24", "#2b323a"], ["#20252b", "#39424c"], ["#181c20", "#2f3740"], ["#22262c", "#434c56"]];
    var p = palette[seed % palette.length];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs>' +
      '<rect width="480" height="360" fill="url(#g)"/>' +
      '<g stroke="rgba(255,255,255,.05)" stroke-width="1">' +
      '<path d="M0 90h480M0 180h480M0 270h480M120 0v360M240 0v360M360 0v360"/></g>' +
      '<circle cx="' + (120 + (seed % 3) * 90) + '" cy="150" r="54" fill="rgba(255,195,26,.10)"/>' +
      '<text x="50%" y="52%" text-anchor="middle" font-family="Inter,Arial" font-size="46">' + (label || "🛠") + "</text>" +
      '<text x="50%" y="72%" text-anchor="middle" fill="rgba(255,255,255,.34)" font-family="Inter,Arial" ' +
      'font-size="15" letter-spacing="3">SERVEGO</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---- Categorias --------------------------------------------------------- */
  var categories = [
    ["eletricista", "Eletricista", "⚡", 90, 350, "Instalações, quadros, tomadas e curtos"],
    ["encanador", "Encanador", "💧", 100, 420, "Vazamentos, desentupimento e hidráulica"],
    ["mecanico", "Mecânico", "🔧", 120, 800, "Revisão, socorro e manutenção veicular"],
    ["pintor", "Pintor", "🎨", 150, 1200, "Pintura residencial e comercial"],
    ["pedreiro", "Pedreiro", "🧱", 180, 1500, "Alvenaria, reformas e acabamentos"],
    ["ar-condicionado", "Ar-condicionado", "❄️", 140, 600, "Instalação, limpeza e recarga de gás"],
    ["montador", "Montador de móveis", "🪑", 80, 400, "Montagem e desmontagem de móveis"],
    ["jardinagem", "Jardinagem", "🌳", 90, 500, "Poda, corte de grama e paisagismo"],
    ["informatica", "Informática", "💻", 80, 450, "Formatação, redes e manutenção"],
    ["limpeza", "Limpeza", "🧹", 120, 350, "Faxina comum e pós-obra"],
    ["marceneiro", "Marceneiro", "🪚", 200, 2000, "Móveis sob medida e reparos"],
    ["serralheiro", "Serralheiro", "🔩", 180, 1600, "Portões, grades e estruturas"],
    ["chaveiro", "Chaveiro", "🔑", 70, 300, "Abertura, troca e cópia de chaves"],
    ["instalacoes", "Instalação / TV", "📺", 80, 350, "Suportes, antenas e eletrônicos"]
  ].map(function (c, i) {
    return {
      id: "cat-" + c[0], slug: c[0], name: c[1], icon: c[2],
      price_from: c[3], price_to: c[4], description: c[5],
      sort_order: i + 1, active: true, created_at: days(120)
    };
  });

  function catId(slug) { return "cat-" + slug; }

  /* ---- Usuários ----------------------------------------------------------- */
  var demoClient = {
    id: "user-client", full_name: "Leane Oliveira", email: "cliente@servego.com.br",
    phone: "(11) 98888-1010", avatar_url: null, city: "São Paulo", state: "SP",
    role: "client", status: "active", created_at: days(210)
  };
  /* Administrador = conta proprietária definida em js/config.js.
     Não existe nenhum outro perfil com role 'admin' nesta base. */
  var demoAdmin = {
    id: "user-admin",
    full_name: (SG.config.owner && SG.config.owner.name) || "Administrador",
    email: (SG.config.owner && SG.config.owner.email) || "admin@servego.com.br",
    phone: null, avatar_url: null, city: "São Paulo", state: "SP",
    role: "admin", status: "active", created_at: days(400)
  };

  var proSeed = [
    ["Carlos Mendes", "eletricista", 4.9, 247, 12, 120, 2.4, "Eletricista industrial e residencial", true, "Vila Mariana"],
    ["Rafael Souza", "eletricista", 4.7, 132, 7, 105, 4.1, "Instalações e automação residencial", true, "Ipiranga"],
    ["Marina Lopes", "eletricista", 5.0, 88, 5, 145, 1.2, "Quadros de distribuição e laudos", true, "Moema"],
    ["Diego Ramos", "encanador", 4.8, 311, 15, 130, 3.3, "Hidráulica e caça-vazamento", true, "Santana"],
    ["Paulo Vieira", "encanador", 4.6, 96, 6, 110, 5.8, "Desentupimento 24h", false, "Tatuapé"],
    ["Anderson Melo", "mecanico", 4.9, 402, 18, 190, 6.2, "Mecânica geral e socorro móvel", true, "Lapa"],
    ["Juliana Costa", "pintor", 4.9, 174, 9, 220, 2.9, "Pintura fina e texturas", true, "Pinheiros"],
    ["Marcos Antunes", "pedreiro", 4.7, 205, 20, 260, 7.4, "Reformas completas", true, "Guarulhos"],
    ["Thiago Nunes", "ar-condicionado", 4.8, 268, 11, 160, 3.7, "Split, multi-split e PMOC", true, "Barra Funda"],
    ["Bruno Farias", "montador", 4.8, 521, 8, 90, 1.8, "Montagem de móveis planejados", true, "Vila Prudente"],
    ["Camila Reis", "limpeza", 4.9, 389, 6, 150, 2.2, "Faxina residencial e pós-obra", true, "Saúde"],
    ["Eduardo Pinto", "informatica", 4.7, 143, 10, 120, 4.6, "Redes, servidores e suporte", true, "Bela Vista"],
    ["Sandra Kimura", "jardinagem", 5.0, 77, 13, 130, 5.1, "Paisagismo e manutenção de jardins", true, "Morumbi"],
    ["Roberto Alencar", "marceneiro", 4.8, 61, 22, 380, 8.9, "Móveis sob medida", true, "Osasco"],
    ["Felipe Cardoso", "chaveiro", 4.6, 214, 9, 95, 1.5, "Abertura e troca de segredo", false, "Consolação"]
  ];

  var profiles = [demoClient, demoAdmin];
  var professionals = [];
  var professionalCategories = [];

  proSeed.forEach(function (p, i) {
    var id = "pro-" + (i + 1);
    profiles.push({
      id: id, full_name: p[0], email: p[0].toLowerCase().replace(/\s+/g, ".") + "@servego.com.br",
      phone: "(11) 9" + (7000 + i) + "-" + (1000 + i * 7), avatar_url: null,
      city: "São Paulo", state: "SP", role: "professional", status: "active", created_at: days(180 - i * 4)
    });
    professionals.push({
      id: id, headline: p[7],
      bio: "Profissional com " + p[4] + " anos de experiência, atendimento pontual e garantia de 90 dias em todos os serviços executados. Trabalho com materiais de primeira linha e envio de relatório fotográfico ao final do atendimento.",
      experience_years: p[4], base_price: p[5], hourly_rate: Math.round(p[5] * 0.6),
      service_radius_km: 15 + (i % 3) * 5, lat: -23.55 + (i % 7) * 0.012, lng: -46.63 + (i % 5) * 0.014,
      city: "São Paulo", state: "SP", is_available: p[8], verified: p[8],
      verification_status: i === 4 || i === 14 ? "pending" : "approved",
      rating: p[2], reviews_count: Math.round(p[3] * 0.42), jobs_count: p[3],
      response_time_min: 8 + (i % 5) * 3, completion_rate: 94 + (i % 6),
      neighborhood: p[9], distance_km: p[6], created_at: days(180 - i * 4)
    });
    professionalCategories.push({ professional_id: id, category_id: catId(p[1]), price_from: p[5] });
    // um segundo nicho para alguns profissionais
    if (i % 4 === 0) professionalCategories.push({ professional_id: id, category_id: catId("instalacoes"), price_from: p[5] + 20 });
  });

  /* ---- Solicitações, ofertas, contratos ----------------------------------- */
  var serviceRequests = [
    {
      id: "req-1", client_id: demoClient.id, category_id: catId("ar-condicionado"),
      title: "Instalação de ar-condicionado split 12.000 BTUs",
      description: "Comprei um split 12.000 BTUs e preciso instalar na sala. A parede é de alvenaria e já existe ponto de energia a cerca de 2 metros. Preciso de suporte e tubulação.",
      address: "Rua Vergueiro, 1200 — Vila Mariana, São Paulo/SP",
      lat: -23.578, lng: -46.634, urgency: "tomorrow", scheduled_for: null,
      budget_hint: 350, status: "matching", created_at: hours(3), updated_at: hours(3)
    },
    {
      id: "req-2", client_id: demoClient.id, category_id: catId("eletricista"),
      title: "Tomadas da cozinha sem energia",
      description: "As tomadas da cozinha pararam de funcionar depois de uma queda de energia. O disjuntor não está desarmado.",
      address: "Rua Vergueiro, 1200 — Vila Mariana, São Paulo/SP",
      lat: -23.578, lng: -46.634, urgency: "now", scheduled_for: null,
      budget_hint: 200, status: "in_progress", created_at: days(1), updated_at: hours(2)
    },
    {
      id: "req-3", client_id: demoClient.id, category_id: catId("montador"),
      title: "Montagem de guarda-roupa 6 portas",
      description: "Guarda-roupa novo, ainda na caixa. Preciso de montagem e fixação na parede.",
      address: "Rua Vergueiro, 1200 — Vila Mariana, São Paulo/SP",
      lat: -23.578, lng: -46.634, urgency: "scheduled", scheduled_for: days(-3),
      budget_hint: 180, status: "completed", created_at: days(14), updated_at: days(12)
    },
    {
      id: "req-4", client_id: "user-other-1", category_id: catId("eletricista"),
      title: "Troca de chuveiro elétrico + disjuntor",
      description: "Chuveiro queimou e o disjuntor desarma. Preciso trocar os dois.",
      address: "Av. Paulista, 900 — Bela Vista, São Paulo/SP",
      lat: -23.564, lng: -46.652, urgency: "today", scheduled_for: null,
      budget_hint: 250, status: "open", created_at: hours(1), updated_at: hours(1)
    },
    {
      id: "req-5", client_id: "user-other-2", category_id: catId("eletricista"),
      title: "Instalação de 6 luminárias de embutir",
      description: "Apartamento novo, forro de gesso já com recortes prontos.",
      address: "Rua Domingos de Morais, 300 — Vila Mariana, São Paulo/SP",
      lat: -23.588, lng: -46.638, urgency: "tomorrow", scheduled_for: null,
      budget_hint: 400, status: "open", created_at: hours(5), updated_at: hours(5)
    }
  ];

  profiles.push(
    { id: "user-other-1", full_name: "Fernanda Alves", email: "fernanda@exemplo.com", phone: "(11) 97777-2020", city: "São Paulo", state: "SP", role: "client", status: "active", created_at: days(60) },
    { id: "user-other-2", full_name: "Ricardo Tavares", email: "ricardo@exemplo.com", phone: "(11) 97777-3030", city: "São Paulo", state: "SP", role: "client", status: "active", created_at: days(35) },
    { id: "user-other-3", full_name: "Patrícia Gomes", email: "patricia@exemplo.com", phone: "(11) 97777-4040", city: "São Paulo", state: "SP", role: "client", status: "blocked", created_at: days(22) }
  );

  var servicePhotos = [
    { id: uid("ph"), request_id: "req-1", uploaded_by: demoClient.id, storage_path: "demo/1.svg", url: photo(1, "❄️"), created_at: hours(3) },
    { id: uid("ph"), request_id: "req-1", uploaded_by: demoClient.id, storage_path: "demo/2.svg", url: photo(2, "🧰"), created_at: hours(3) },
    { id: uid("ph"), request_id: "req-2", uploaded_by: demoClient.id, storage_path: "demo/3.svg", url: photo(3, "⚡"), created_at: days(1) }
  ];

  var serviceOffers = [
    { id: "off-1", request_id: "req-1", professional_id: "pro-9", price: 320, message: "Incluso suporte, tubulação de 3m, vácuo e teste. Garantia de 1 ano na instalação.", eta_minutes: 35, status: "pending", created_at: hours(2.4), updated_at: hours(2.4) },
    { id: "off-2", request_id: "req-1", professional_id: "pro-1", price: 380, message: "Faço a instalação completa com material incluso e emissão de nota fiscal.", eta_minutes: 22, status: "pending", created_at: hours(2.1), updated_at: hours(2.1) },
    { id: "off-3", request_id: "req-1", professional_id: "pro-3", price: 295, message: "Consigo atender amanhã pela manhã. Material por conta do cliente.", eta_minutes: 18, status: "pending", created_at: hours(1.6), updated_at: hours(1.6) },
    { id: "off-4", request_id: "req-2", professional_id: "pro-1", price: 180, message: "Faço o diagnóstico e troco o que for necessário no mesmo atendimento.", eta_minutes: 18, status: "accepted", created_at: days(1), updated_at: days(1) },
    { id: "off-5", request_id: "req-3", professional_id: "pro-10", price: 200, message: "Monto e fixo na parede no mesmo dia.", eta_minutes: 25, status: "accepted", created_at: days(14), updated_at: days(14) }
  ];

  var bookings = [
    {
      id: "bk-1", request_id: "req-2", offer_id: "off-4", client_id: demoClient.id, professional_id: "pro-1",
      price: 180, status: "in_progress", accepted_at: days(1), started_at: hours(2), arrived_at: hours(2.4),
      completed_at: null, cancelled_at: null, cancel_reason: null, created_at: days(1), updated_at: hours(2)
    },
    {
      id: "bk-2", request_id: "req-3", offer_id: "off-5", client_id: demoClient.id, professional_id: "pro-10",
      price: 200, status: "completed", accepted_at: days(14), started_at: days(12.4), arrived_at: days(12.5),
      completed_at: days(12), cancelled_at: null, cancel_reason: null, created_at: days(14), updated_at: days(12)
    }
  ];

  var bookingEvents = [
    { id: uid("ev"), booking_id: "bk-1", status: "accepted", note: null, created_at: days(1) },
    { id: uid("ev"), booking_id: "bk-1", status: "on_the_way", note: null, created_at: hours(3) },
    { id: uid("ev"), booking_id: "bk-1", status: "arrived", note: null, created_at: hours(2.4) },
    { id: uid("ev"), booking_id: "bk-1", status: "in_progress", note: null, created_at: hours(2) },
    { id: uid("ev"), booking_id: "bk-2", status: "accepted", note: null, created_at: days(14) },
    { id: uid("ev"), booking_id: "bk-2", status: "in_progress", note: null, created_at: days(12.4) },
    { id: uid("ev"), booking_id: "bk-2", status: "completed", note: null, created_at: days(12) }
  ];

  var messages = [
    { id: uid("msg"), request_id: "req-2", booking_id: "bk-1", sender_id: "pro-1", recipient_id: demoClient.id, content: "Boa tarde, Leane! Recebi sua solicitação. Já estou a caminho, chego em cerca de 15 minutos.", image_url: null, read_at: hours(3), created_at: hours(3.2) },
    { id: uid("msg"), request_id: "req-2", booking_id: "bk-1", sender_id: demoClient.id, recipient_id: "pro-1", content: "Perfeito, Carlos. Vou deixar o portão aberto.", image_url: null, read_at: hours(3), created_at: hours(3.1) },
    { id: uid("msg"), request_id: "req-2", booking_id: "bk-1", sender_id: "pro-1", recipient_id: demoClient.id, content: "Cheguei. Já identifiquei o problema: é o disjuntor do circuito da cozinha. Vou trocar agora.", image_url: null, read_at: null, created_at: hours(2.3) },
    { id: uid("msg"), request_id: "req-1", booking_id: null, sender_id: "pro-9", recipient_id: demoClient.id, content: "Olá! Enviei meu orçamento. Qualquer dúvida sobre o material, é só chamar.", image_url: null, read_at: null, created_at: hours(2.3) }
  ];

  var reviews = [
    { id: uid("rv"), booking_id: "bk-2", request_id: "req-3", client_id: demoClient.id, professional_id: "pro-10", rating: 5, comment: "Montagem impecável e muito rápida. Deixou tudo limpo no final.", tags: ["Pontual", "Caprichoso"], reply: "Obrigado, Leane! Volte sempre.", replied_at: days(11), created_at: days(12) },
    { id: uid("rv"), booking_id: "bk-x1", request_id: "req-x1", client_id: "user-other-1", professional_id: "pro-1", rating: 5, comment: "Resolveu um problema que dois eletricistas não conseguiram. Explicou tudo com paciência.", tags: ["Explicativo", "Resolutivo"], reply: null, replied_at: null, created_at: days(6) },
    { id: uid("rv"), booking_id: "bk-x2", request_id: "req-x2", client_id: "user-other-2", professional_id: "pro-1", rating: 5, comment: "Chegou antes do horário e cobrou exatamente o que foi orçado.", tags: ["Pontual", "Preço justo"], reply: null, replied_at: null, created_at: days(19) },
    { id: uid("rv"), booking_id: "bk-x3", request_id: "req-x3", client_id: "user-other-1", professional_id: "pro-1", rating: 4, comment: "Serviço bom, só demorou um pouco para conseguir a peça.", tags: ["Educado"], reply: null, replied_at: null, created_at: days(34) },
    { id: uid("rv"), booking_id: "bk-x4", request_id: "req-x4", client_id: "user-other-2", professional_id: "pro-9", rating: 5, comment: "Instalação do split perfeita, sem sujeira e sem barulho.", tags: ["Limpo", "Pontual"], reply: null, replied_at: null, created_at: days(9) }
  ];

  var notifications = [
    { id: uid("nt"), user_id: demoClient.id, type: "offer", title: "Você recebeu 3 orçamentos", body: "Instalação de ar-condicionado split 12.000 BTUs", link: "#/solicitacao/req-1", read_at: null, created_at: hours(2.1) },
    { id: uid("nt"), user_id: demoClient.id, type: "message", title: "Nova mensagem de Carlos Mendes", body: "Cheguei. Já identifiquei o problema…", link: "#/mensagens/req-2", read_at: null, created_at: hours(2.3) },
    { id: uid("nt"), user_id: demoClient.id, type: "status", title: "Profissional chegou ao local", body: "Tomadas da cozinha sem energia", link: "#/acompanhar/bk-1", read_at: hours(2), created_at: hours(2.4) },
    { id: uid("nt"), user_id: "pro-1", type: "request", title: "Nova solicitação por perto", body: "Troca de chuveiro elétrico + disjuntor — 1,8 km", link: "#/oportunidades", read_at: null, created_at: hours(1) },
    { id: uid("nt"), user_id: "pro-1", type: "review", title: "Você recebeu uma avaliação 5 estrelas", body: "“Resolveu um problema que dois eletricistas não conseguiram.”", link: "#/avaliacoes", read_at: null, created_at: days(6) }
  ];

  var favorites = [{ client_id: demoClient.id, professional_id: "pro-1", created_at: days(10) }];

  var transactions = [];
  (function seedTransactions() {
    var pros = ["pro-1", "pro-1", "pro-1", "pro-9", "pro-10", "pro-1", "pro-1"];
    var vals = [180, 240, 150, 320, 200, 420, 190];
    pros.forEach(function (p, i) {
      var amount = vals[i];
      var fee = Math.round(amount * 0.1 * 100) / 100;
      transactions.push({
        id: uid("tx"), booking_id: "bk-seed-" + i, professional_id: p, client_id: demoClient.id,
        amount: amount, platform_fee: fee, net_amount: amount - fee,
        status: i < 5 ? "released" : "pending", created_at: days(i * 1.1)
      });
    });
  })();

  var professionalDocuments = [
    { id: uid("doc"), professional_id: "pro-5", doc_type: "Documento com foto", storage_path: "demo/doc1", status: "pending", created_at: days(2) },
    { id: uid("doc"), professional_id: "pro-5", doc_type: "Comprovante de residência", storage_path: "demo/doc2", status: "pending", created_at: days(2) },
    { id: uid("doc"), professional_id: "pro-15", doc_type: "Certificado NR-10", storage_path: "demo/doc3", status: "pending", created_at: days(1) }
  ];

  var reports = [
    { id: uid("rp"), reporter_id: "user-other-1", target_user_id: "pro-5", booking_id: null, reason: "Não compareceu", description: "Marcou o atendimento e não apareceu, sem aviso.", status: "open", created_at: days(3) },
    { id: uid("rp"), reporter_id: demoClient.id, target_user_id: "user-other-3", booking_id: null, reason: "Comportamento inadequado", description: "Mensagens fora do contexto do serviço.", status: "resolved", created_at: days(20) }
  ];

  var portfolio = {};
  professionals.forEach(function (p, i) {
    portfolio[p.id] = [photo(i, "🛠"), photo(i + 1, "🔧"), photo(i + 2, "✅"), photo(i + 3, "🏠")];
  });

  SG.mock = {
    photo: photo,
    uid: uid,
    data: {
      profiles: profiles,
      professionals: professionals,
      categories: categories,
      professional_categories: professionalCategories,
      service_requests: serviceRequests,
      service_photos: servicePhotos,
      service_offers: serviceOffers,
      bookings: bookings,
      booking_events: bookingEvents,
      messages: messages,
      reviews: reviews,
      notifications: notifications,
      favorites: favorites,
      transactions: transactions,
      professional_documents: professionalDocuments,
      reports: reports,
      portfolio: portfolio
    },
    accounts: {
      client: { email: demoClient.email, id: demoClient.id },
      professional: { email: "carlos.mendes@servego.com.br", id: "pro-1" },
      admin: { email: demoAdmin.email, id: demoAdmin.id }
    }
  };
})(window.SG);
