/* ==========================================================================
   ServeGo — Biblioteca de ícones (SVG inline, traço 1.7, 24x24)
   Um único sistema de ícones: nada de ícones aleatórios de fontes diferentes.
   ========================================================================== */
(function (SG) {
  var P = {
    home: '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    wrench: '<path d="M15.7 3.3a5.5 5.5 0 0 0-6.9 6.9L3 16v5h5l5.8-5.8a5.5 5.5 0 0 0 6.9-6.9l-3.1 3.1-2.9-.4-.4-2.9z"/>',
    pin: '<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16 9.5"/>',
    shield: '<path d="M12 3 5 6v6c0 4.3 2.9 7.9 7 9 4.1-1.1 7-4.7 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    verified: '<path d="m12 2.6 2.3 1.7 2.8-.3 1 2.7 2.4 1.6-.9 2.7.9 2.7-2.4 1.6-1 2.7-2.8-.3L12 21.4l-2.3-1.7-2.8.3-1-2.7-2.4-1.6.9-2.7-.9-2.7 2.4-1.6 1-2.7 2.8.3z"/><path d="m9.2 12.2 2 2 3.6-4"/>',
    chat: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
    send: '<path d="M4.5 12 20 4.5 15.5 20l-3.6-5.4z"/><path d="m11.9 14.6 8.1-10.1"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.6 3.5-5.5 7-5.5s6.3 1.9 7 5.5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-4.9 6-4.9s5.4 1.7 6 4.9"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"/><path d="M18 14.5c2.1.6 3.4 2.2 3.8 4.5"/>',
    briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
    activity: '<path d="M3 12.5h4l2.5-6.5 4 13 2.5-6.5h5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevronRight: '<path d="m9.5 5 7 7-7 7"/>',
    chevronLeft: '<path d="m14.5 5-7 7 7 7"/>',
    chevronDown: '<path d="m5 9.5 7 7 7-7"/>',
    arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    arrowLeft: '<path d="M20 12H5"/><path d="m11 6-6 6 6 6"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.6" cy="10" r="1.6"/><path d="m4 17 5-4.6 4.5 4 2.6-2.2L20 18"/>',
    camera: '<path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.4"/>',
    heart: '<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5"/><path d="M16 15.5 20 12l-4-3.5"/><path d="M20 12H9.5"/>',
    wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5"/><rect x="3" y="7.5" width="18" height="12" rx="2"/><circle cx="16.5" cy="13.5" r="1.3"/>',
    trending: '<path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15.5 5H21v5.5"/>',
    alert: '<path d="M12 4.5 2.8 20h18.4z"/><path d="M12 10v4"/><path d="M12 17.2h.01"/>',
    flag: '<path d="M5 21V4"/><path d="M5 5h11l-1.6 3.5L16 12H5z"/>',
    car: '<path d="M5 16.5h14"/><path d="M6.5 16.5V19a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2.5"/><path d="M20.5 16.5V19a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2.5"/><path d="M3.5 16.5v-4l2-5.5h13l2 5.5v4z"/><circle cx="7.5" cy="13" r="1"/><circle cx="16.5" cy="13" r="1"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    filter: '<path d="M4 6h16l-6.2 7.3V19l-3.6 2v-7.7z"/>',
    more: '<circle cx="12" cy="5.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18.5" r="1.2"/>',
    doc: '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.8 6.5 8.2 6 8.2-6"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
    sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/>',
    refresh: '<path d="M20 11.5a8 8 0 1 0-1.3 5.5"/><path d="M20 4.5v7h-7"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    power: '<path d="M12 3.5V12"/><path d="M17.5 6.5a8 8 0 1 1-11 0"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
    zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    tag: '<path d="M3.5 11.2V4.5a1 1 0 0 1 1-1h6.7a2 2 0 0 1 1.4.6l7.3 7.3a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0L4.1 12.6a2 2 0 0 1-.6-1.4z"/><circle cx="8" cy="8" r="1.2"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
    moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>'
  };

  SG.icons = P;

  /** Retorna markup SVG de um ícone. */
  SG.icon = function (name, size, cls) {
    var d = P[name];
    if (!d) return "";
    var s = size || 20;
    return (
      '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"' + (cls ? ' class="' + cls + '"' : "") + ">" + d + "</svg>"
    );
  };

  /** Estrela preenchida (usada em ratings). */
  SG.starIcon = function (filled, size) {
    var s = size || 14;
    return (
      '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' +
      'fill="' + (filled ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linejoin="round" aria-hidden="true">' + P.star + "</svg>"
    );
  };

  /* Caminho da logo oficial. Ajuste apenas aqui se mover a pasta assets. */
  SG.brandAsset = "assets/logo-mark.png";

  /** Marca oficial do ServeGo (ícone do app). */
  SG.brandMark = function (size) {
    var s = size || 24;
    return (
      '<img class="sg-mark" src="' + SG.brandAsset + '" alt="ServeGo" ' +
      'width="' + s + '" height="' + s + '" style="width:' + s + "px;height:" + s + 'px">'
    );
  };

  /** Lockup completo (marca + wordmark). */
  SG.brandLogo = function (opts) {
    opts = opts || {};
    var big = opts.size === "lg";
    return (
      '<span class="sg-logo' + (big ? " sg-logo--lg" : "") + '">' +
      '<img class="sg-logo__mark" src="' + SG.brandAsset + '" alt="ServeGo">' +
      (opts.markOnly ? "" : '<span class="sg-logo__type">Serve<b>Go</b></span>') +
      "</span>"
    );
  };
})(window.SG || (window.SG = {}));
