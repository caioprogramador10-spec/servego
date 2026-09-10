/* ==========================================================================
   ServeGo — Cliente Supabase
   Cria o client apenas com a chave anon/public. Se não houver credenciais em
   js/config.js, o app assume o modo demo (base em memória).
   ========================================================================== */
(function (SG) {
  SG.supabase = null;

  SG.initSupabase = function () {
    if (SG.isDemo()) {
      console.info("[ServeGo] Modo demonstração ativo — configure js/config.js para conectar ao Supabase.");
      return null;
    }
    if (!window.supabase || !window.supabase.createClient) {
      console.error("[ServeGo] SDK do Supabase não carregado. Verifique a tag <script> do supabase-js.");
      return null;
    }
    SG.supabase = window.supabase.createClient(SG.config.supabaseUrl, SG.config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 8 } },
      global: { headers: { "x-application-name": "servego-web" } }
    });
    return SG.supabase;
  };

  /** Normaliza mensagens de erro do Supabase para o português do produto. */
  SG.explainError = function (error) {
    if (!error) return "Algo deu errado. Tente novamente.";
    var msg = error.message || String(error);
    var map = {
      "Invalid login credentials":
        "E-mail ou senha incorretos. Se esta é a primeira vez, crie o usuário em " +
        "Authentication → Users no painel do Supabase (marcando Auto Confirm User).",
      "User already registered": "Este e-mail já possui conta no ServeGo.",
      "Email not confirmed": "Confirme seu e-mail antes de entrar.",
      "Password should be at least 6 characters": "A senha precisa ter ao menos 6 caracteres.",
      "For security purposes, you can only request this after 60 seconds":
        "Aguarde alguns segundos antes de tentar novamente."
    };
    if (map[msg]) return map[msg];
    if (/row-level security|permission denied|42501/i.test(msg)) return "Você não tem permissão para esta ação.";
    if (/duplicate key/i.test(msg)) return "Este registro já existe.";
    if (/Failed to fetch|NetworkError/i.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
    return msg;
  };
})(window.SG);
