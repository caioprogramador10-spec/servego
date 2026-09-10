/* ==========================================================================
   ServeGo — Roteador por hash
   Simples, sem dependências, com suporte a parâmetros e guardas de papel.
   ========================================================================== */
(function (SG) {
  var routes = [];
  var notFound = null;
  var current = null;
  var beforeEach = null;

  function parse(hash) {
    var raw = (hash || location.hash || "#/").replace(/^#/, "");
    var qIndex = raw.indexOf("?");
    var query = {};
    if (qIndex >= 0) {
      raw.slice(qIndex + 1).split("&").forEach(function (pair) {
        if (!pair) return;
        var kv = pair.split("=");
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
      });
      raw = raw.slice(0, qIndex);
    }
    var parts = raw.split("/").filter(Boolean);
    return { path: "/" + parts.join("/"), parts: parts, query: query };
  }

  function match(route, loc) {
    var rp = route.path.split("/").filter(Boolean);
    if (rp.length !== loc.parts.length) return null;
    var params = {};
    for (var i = 0; i < rp.length; i++) {
      if (rp[i][0] === ":") params[rp[i].slice(1)] = decodeURIComponent(loc.parts[i]);
      else if (rp[i] !== loc.parts[i]) return null;
    }
    return params;
  }

  var router = {
    add: function (path, handler, opts) {
      routes.push(Object.assign({ path: path, handler: handler }, opts || {}));
      return router;
    },
    setNotFound: function (fn) { notFound = fn; return router; },
    before: function (fn) { beforeEach = fn; return router; },
    go: function (path, replace) {
      if (replace) location.replace("#" + path);
      else location.hash = path;
    },
    current: function () { return current; },
    resolve: function () {
      var loc = parse();
      for (var i = 0; i < routes.length; i++) {
        var params = match(routes[i], loc);
        if (params) {
          current = { route: routes[i], params: params, query: loc.query, path: loc.path };
          if (beforeEach && beforeEach(current) === false) return;
          routes[i].handler(params, loc.query);
          return;
        }
      }
      if (notFound) notFound(loc);
    },
    start: function () {
      window.addEventListener("hashchange", function () {
        SG.ui.closePopovers();
        router.resolve();
        window.scrollTo({ top: 0 });
      });
      router.resolve();
    }
  };

  SG.router = router;
})(window.SG);
