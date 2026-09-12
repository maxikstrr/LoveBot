<pre align="center">
💖 Neelegirly Ecosystem Clean Stability Update 💖
4 Packages · 1 App · PM2 only runs the app
</pre>

# 💫 @neelegirly/downloader

Optional media downloader toolkit for bot apps.

## Clean Architecture

```text
@neelegirly/libsignal
        ↓
@neelegirly/baileys
        ↓
@neelegirly/wa-api
        ↓
App (PM2 managed)
        ↓
@neelegirly/downloader (optional utility)
```

## Official Package Role

- Optional utility package
- Not part of session lifecycle
- Works alongside the app

## PM2 Rule

> WA-API handles sessions internally. PM2 only runs the app.

Start your app with PM2 like this:

```bash
pm2 start index.js --name bot
```

Do not start one PM2 process per session. Sessions belong inside the app through `@neelegirly/wa-api`.

## Install

```bash
npm install @neelegirly/downloader
```

## Clean Stability Release

This release clarifies the ecosystem structure and removes workspace/core confusion from the documentation.


---

<div align="center">

<img src="https://files.catbox.moe/045t3c.jpeg" width="620" alt="Neelegirly Downloader Hero" />

# ✨ @neelegirly/downloader

### Soft-glow Media-Downloader für TikTok, Instagram, YouTube, Spotify, SoundCloud, Threads & mehr

[![npm version](https://img.shields.io/npm/v/@neelegirly/downloader?style=for-the-badge&color=ff69b4&logo=npm)](https://www.npmjs.com/package/@neelegirly/downloader)
[![npm downloads](https://img.shields.io/npm/dw/@neelegirly/downloader?style=for-the-badge&color=f472b6&logo=npm)](https://www.npmjs.com/package/@neelegirly/downloader)
[![Node](https://img.shields.io/badge/Node-16%2B-22c55e?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Scope](https://img.shields.io/badge/Scope-@neelegirly-f9a8d4?style=for-the-badge)](https://www.npmjs.com/package/@neelegirly/downloader)
[![Maintained by Neelegirly](https://img.shields.io/badge/Maintained%20by-Neelegirly-f5bde6?style=for-the-badge)](https://github.com/neelegirly)

**Release `0.1.65`** · Hero image live · Promise-basiert · leichtgewichtig · botfreundlich

</div>

---

## 💖 Warum dieses Paket?

`@neelegirly/downloader` bündelt kleine, direkte Download- und Search-Helper in einer API, die sich super für Bots, Utilities und Automationen eignet.
Wenn du Links schnell auflösen oder Medien-Infos in Kommandos weiterreichen willst, ist das hier die süße kleine Abkürzung.

### 🌈 Glow-Highlights

- 📸 Hero-Bild jetzt sichtbar auf GitHub **und** npm
- ⚡ Promise-basierte Einzeiler für Bot-Commands
- 🎧 Download- und Search-Endpoints in einem Paket
- 🫧 Konsistente Fallback-Antworten statt harter Crashes
- 🧁 Perfekt für Onimai, Darkbot und andere Media-Workflows

---

## 📦 Installation

```bash
npm install @neelegirly/downloader@0.1.65 --save-exact
```

---

## 🚀 Quickstart

```js
const { instagram, tikdown, alldown, spotifySearch } = require('@neelegirly/downloader')

async function demo() {
  const insta = await instagram('https://www.instagram.com/p/example/')
  console.log('Instagram:', insta)

  const tiktok = await tikdown('https://vm.tiktok.com/example/')
  console.log('TikTok:', tiktok)

  const mixed = await alldown('https://example.com/media-link')
  console.log('AllDown:', mixed)

  const tracks = await spotifySearch('lofi anime', 3)
  console.log('Spotify Search:', tracks)
}

demo().catch(console.error)
```

---

## 🧩 Verfügbare Helper

| Helper | Zweck |
|---|---|
| `ndown(url)` | generischer Download-Endpunkt |
| `instagram(url)` | Instagram-Links auflösen |
| `tikdown(url)` | TikTok-Downloads |
| `ytdown(url)` | YouTube-Downloads |
| `threads(url)` | Threads-Links auflösen |
| `twitterdown(url)` | Twitter/X-Medien laden |
| `fbdown2(url, key)` | Facebook-Downloads |
| `GDLink(url)` | Google-Drive-Dateien auflösen |
| `pintarest(url)` | Pinterest-Downloads |
| `capcut(url)` | CapCut-Links auflösen |
| `likee(url)` | Likee-Downloads |
| `alldown(url)` | universeller Multi-Downloader |
| `spotifySearch(name, limit)` | Spotify-Suche |
| `soundcloudSearch(name, limit)` | SoundCloud-Suche |
| `spotifyDl(url)` | Spotify-Download-Metadaten |
| `soundcloud(url)` | SoundCloud-Download |
| `terabox(url)` | Terabox-Links auflösen |

---

## 🌐 Unterstützte Plattformen

- TikTok
- Instagram
- YouTube
- Threads
- Twitter / X
- Facebook
- Pinterest
- CapCut
- Likee
- Google Drive
- Spotify
- SoundCloud
- Terabox

---

## ⚠️ Verhalten bei Fehlern

Das Paket ist bewusst bot-freundlich gehalten:
Wenn ein Upstream-Endpunkt fehlschlägt, wird ein Objekt wie dieses zurückgegeben, statt direkt einen Fehler zu werfen:

```js
{
  developer: 'MOHAMMAD NAYAN',
  status: false,
  msg: 'Instagram API error'
}
```

Das macht Retry-Logik, Fallbacks und Logging in Bots deutlich entspannter.

---

## 📝 Release Notes `0.1.65`

- Hero-Bild im README ergänzt
- README visuell stärker im Glow-up-Stil überarbeitet
- npm- und GitHub-Präsentation auf denselben Look gebracht
- bereit für frische Reinstalls in Onimai und Darkbot

---

## 💫 Support

- npm: [`@neelegirly/downloader`](https://www.npmjs.com/package/@neelegirly/downloader)
- GitHub: [`neelegirly/downloader`](https://github.com/neelegirly/downloader)
- Issues: [`neelegirly/downloader/issues`](https://github.com/neelegirly/downloader/issues)

<div align="center">

<img src="https://files.catbox.moe/045t3c.jpeg" width="260" alt="Neelegirly Downloader Accent" />

**Stay cute, ship fast, download smarter. 🌸**

</div>
