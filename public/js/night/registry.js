/* ============================================================================
   LoveBot — BEFEHL- & FEATURE-REGISTRY
   Single Source of Truth: Web-Dashboard UND Bot lesen dieselbe Liste.
   status: 'live' = im Bot aktiv · 'plan' = registriert, Implementierung folgt
   ==========================================================================*/
(function (root) {
  'use strict';

  const FEATURES = [
    { key: 'autodl',     emoji: '📥', label: 'Auto-Download',    desc: 'YouTube-, TikTok- & Instagram-Links automatisch laden', on: true },
    { key: 'welcome',    emoji: '👋', label: 'Welcome',          desc: 'Willkommensnachricht für neue Mitglieder', on: true },
    { key: 'goodbye',    emoji: '🚪', label: 'Goodbye',          desc: 'Abschiedsnachricht beim Verlassen', on: true },
    { key: 'kickmsg',    emoji: '🦵', label: 'Kick-News',        desc: 'Nachricht, wenn jemand gekickt wird', on: true },
    { key: 'promotemsg', emoji: '⭐', label: 'Promote-News',     desc: 'Nachricht bei Admin-Beförderung', on: true },
    { key: 'demotemsg',  emoji: '⬇️', label: 'Demote-News',      desc: 'Nachricht bei Admin-Entfernung', on: true },
    { key: 'liebe',      emoji: '💍', label: 'Liebe & Marry',    desc: 'marry, divorce, ship, kiss, hug, compliment, lovecalc …', on: true },
    { key: 'fun',        emoji: '🎉', label: 'Fun & Spiele',     desc: 'witz, fakt, 8ball, rps, slot, truth, dare, dice …', on: true },
    { key: 'media',      emoji: '🎨', label: 'Media & Play',     desc: '$play, $audio und Musik-/Video-Downloads', on: true },
    { key: 'tools',      emoji: '🧰', label: 'Werkzeuge',        desc: 'calc, b64, reverse, flip, upper, lower, length …', on: true },
    { key: 'badwords',   emoji: '🤬', label: 'Badword-Filter',   desc: 'Beleidigungen löschen + verwarnen (3 = Kick & Ban)', on: true },
    { key: 'antilink',   emoji: '🔗', label: 'Anti-Link',        desc: 'Gruppen-Einladungslinks von Nicht-Admins löschen', on: false },
    { key: 'night',      emoji: '☾',  label: 'Night & Mood',     desc: 'goodnight, goodmorning, mood, nightquote — Nacht-Features', on: true, neu: true },
    { key: 'afk',        emoji: '😴', label: 'AFK-System',       desc: 'AFK-Status + Auto-Comeback-Nachricht', on: true, neu: true }
  ];

  const C = (cat, name, desc, opts) => Object.assign({ cat, name, desc, perm: 'user', feature: null, status: 'live', aliases: [] }, opts || {});

  const COMMANDS = [
    /* ---------- 💍 Love & Social ---------- */
    C('love', 'marry',      'Jemandem einen Heiratsantrag machen', { aliases: ['heiraten', 'propose'] }),
    C('love', 'divorce',    'Scheidung einreichen', { aliases: ['scheidung'] }),
    C('love', 'ship',       'Zwei Personen matchen (@user @user)', { aliases: ['lovetest', 'loveometer'] }),
    C('love', 'lovecalc',   'Love-Compatibility in % berechnen', { status: 'plan', neu: true }),
    C('love', 'kiss',       'Jemanden küssen', { aliases: ['kuss'] }),
    C('love', 'hug',        'Jemanden umarmen', { aliases: ['umarmen'] }),
    C('love', 'slap',       'Jemanden ohrfeigen', { aliases: ['ohrfeige'] }),
    C('love', 'compliment', 'Ein Kompliment machen', { aliases: ['lob', 'kompliment'] }),
    C('love', 'flirt',      'Flirtspruch senden', { status: 'plan', neu: true }),
    C('love', 'confess',    'Liebesgeständnis generieren', { status: 'plan', neu: true }),
    C('love', 'crush',      'Heimlichen Crush markieren', { status: 'plan', neu: true }),
    C('love', 'date',       'Date-Idee vorschlagen', { status: 'plan', neu: true }),
    C('love', 'romantic',   'Romantischen Text senden', { status: 'plan', neu: true }),
    C('love', 'breakup',    'Respektvolle Trennungsnachricht', { status: 'plan', neu: true }),

    /* ---------- ☾ Night & Mood ---------- */
    C('night', 'goodmorning', 'Guten-Morgen-Nachricht', { status: 'plan', neu: true, feature: 'night' }),
    C('night', 'goodnight',   'Gute-Nacht-Nachricht', { status: 'plan', neu: true, feature: 'night' }),
    C('night', 'mood',        'Aktuelle Night-Mood anzeigen / setzen', { status: 'plan', neu: true, feature: 'night' }),
    C('night', 'nightquote',  'Melancholisches Nacht-Zitat', { status: 'plan', neu: true, feature: 'night' }),

    /* ---------- 💎 Profil & XP ---------- */
    C('profile', 'register',     'Profil registrieren: Name.Alter.Status.Stadt'),
    C('profile', 'profile',      'Eigenes oder fremdes Profil anzeigen', { status: 'plan', neu: true }),
    C('profile', 'me',           'Bot-Info anzeigen'),
    C('profile', 'level',        'Love-Level anzeigen', { status: 'plan', neu: true }),
    C('profile', 'rank',         'Rank-Karte anzeigen', { status: 'plan', neu: true }),
    C('profile', 'leaderboard',  'Love-Level-Rangliste', { status: 'plan', neu: true, aliases: ['lb', 'top'] }),
    C('profile', 'daily',        'Tägliche XP abholen', { status: 'plan', neu: true }),
    C('profile', 'streak',       'Aktuelle Tages-Serie anzeigen', { status: 'plan', neu: true }),
    C('profile', 'achievements', 'Freigeschaltete Achievements', { status: 'plan', neu: true, aliases: ['badges'] }),
    C('profile', 'title',        'Titel setzen/anzeigen', { status: 'plan', neu: true }),
    C('profile', 'setbio',       'Profil-Bio setzen', { status: 'plan', neu: true }),

    /* ---------- 🎉 Fun ---------- */
    C('fun', 'witz',     'Einen Witz erzählen', { aliases: ['joke'], feature: 'fun' }),
    C('fun', 'fakt',     'Einen Fakt erzählen', { aliases: ['fact'], feature: 'fun' }),
    C('fun', '8ball',    'Magischer 8-Ball', { aliases: ['achtball', 'magie'], feature: 'fun' }),
    C('fun', 'rps',      'Schere Stein Papier', { feature: 'fun' }),
    C('fun', 'slot',     'Mini-Slotmaschine', { aliases: ['slotmini', 'automaten'], feature: 'fun' }),
    C('fun', 'dice',     'Würfeln', { aliases: ['dice2'], feature: 'fun' }),
    C('fun', 'coin',     'Münzwurf', { aliases: ['münze'], feature: 'fun' }),
    C('fun', 'truth',    'Wahrheit-Frage', { feature: 'fun' }),
    C('fun', 'dare',     'Pflicht-Aufgabe', { feature: 'fun' }),
    C('fun', 'wouldyou', 'Would you rather …', { status: 'plan', neu: true, feature: 'fun' }),
    C('fun', 'rate',     'Etwas bewerten (1–100)', { status: 'plan', neu: true, feature: 'fun' }),
    C('fun', 'roast',    'Jemanden (lieb) roasten', { status: 'plan', neu: true, feature: 'fun' }),
    C('fun', 'quote',    'Zufälliges Zitat', { status: 'plan', neu: true, feature: 'fun' }),

    /* ---------- 🎨 Media ---------- */
    C('media', 'play',  'Musik/Video suchen & senden', { feature: 'media' }),
    C('media', 'audio', 'Nur Audio senden', { feature: 'media' }),

    /* ---------- 🧰 Tools ---------- */
    C('tools', 'calc',    'Rechnen: $calc 2+2*10', { feature: 'tools' }),
    C('tools', 'b64',     'Base64 encodieren/decodieren', { feature: 'tools' }),
    C('tools', 'reverse', 'Text umdrehen', { feature: 'tools' }),
    C('tools', 'flip',    'Text flippen', { aliases: ['upside'], feature: 'tools' }),
    C('tools', 'upper',   'GROSSBUCHSTABEN', { aliases: ['uppercase'], feature: 'tools' }),
    C('tools', 'lower',   'kleinbuchstaben', { aliases: ['lowercase'], feature: 'tools' }),
    C('tools', 'length',  'Textlänge zählen', { aliases: ['len'], feature: 'tools' }),

    /* ---------- 👥 Gruppe & Admin ---------- */
    C('group', 'gi',        'Feature-Übersicht der Gruppe', { aliases: ['features', 'featurelist'] }),
    C('group', 'an',        'Feature einschalten: $an welcome', { perm: 'admin', aliases: ['enable'] }),
    C('group', 'aus',       'Feature ausschalten: $aus antilink', { perm: 'admin', aliases: ['disable'] }),
    C('group', 'tagall',    'Alle Mitglieder markieren', { perm: 'admin', status: 'plan', neu: true }),
    C('group', 'warn',      'Verwarnung aussprechen', { perm: 'admin', status: 'plan', neu: true }),
    C('group', 'warnings',  'Verwarnungen anzeigen', { status: 'plan', neu: true }),
    C('group', 'kick',      'Mitglied entfernen', { perm: 'admin' }),
    C('group', 'promote',   'Zum Admin befördern', { perm: 'admin' }),
    C('group', 'demote',    'Admin entfernen', { perm: 'admin' }),
    C('group', 'slowmode',  'Slowmode setzen', { perm: 'admin', status: 'plan', neu: true }),
    C('group', 'lock',      'Gruppe nur-Admins schalten', { perm: 'admin', status: 'plan', neu: true }),
    C('group', 'unlock',    'Gruppe öffnen', { perm: 'admin', status: 'plan', neu: true }),
    C('group', 'groupinfo', 'Gruppen-Infos anzeigen', { status: 'plan', neu: true, aliases: ['admins', 'members'] }),

    /* ---------- 🛡️ Owner & System ---------- */
    C('owner', 'owner',    'Owner-Kontakt anzeigen'),
    C('owner', 'ping',     'Latenz messen'),
    C('owner', 'help',     'Hilfe-Kategorien anzeigen', { aliases: ['hilfe'] }),
    C('owner', 'ban',      'Nutzer bannen', { perm: 'owner' }),
    C('owner', 'unban',    'Ban aufheben', { perm: 'owner' }),
    C('owner', 'banlist',  'Ban-Liste anzeigen', { perm: 'owner' }),
    C('owner', 'broadcast','Broadcast an alle Gruppen', { perm: 'owner' }),
    C('owner', 'nightmode','Bot-Nachtmodus umschalten', { perm: 'owner', status: 'plan', neu: true })
  ];

  const CATS = [
    { id: 'love',    icon: '💍', label: 'Love & Social' },
    { id: 'night',   icon: '☾',  label: 'Night & Mood' },
    { id: 'profile', icon: '💎', label: 'Profil & XP' },
    { id: 'fun',     icon: '🎉', label: 'Fun' },
    { id: 'media',   icon: '🎨', label: 'Media' },
    { id: 'tools',   icon: '🧰', label: 'Werkzeuge' },
    { id: 'group',   icon: '👥', label: 'Gruppe & Admin' },
    { id: 'owner',   icon: '🛡️', label: 'Owner & System' }
  ];

  const reg = { COMMANDS, FEATURES, CATS };
  if (typeof window !== 'undefined') {
    window.LOVE_COMMANDS = COMMANDS;
    window.LOVE_FEATURES = FEATURES;
    window.LOVE_CATS = CATS;
    window.LOVE_REGISTRY = reg;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = reg;
})(typeof window !== 'undefined' ? window : globalThis);
