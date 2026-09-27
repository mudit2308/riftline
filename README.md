# Riftline server — made by Mudit Pathak

One small Node.js program that does two jobs:
1. **Hosts the game** as an installable web app (open the address → play, "Install app" works on phones and PCs).
2. **Runs online matches** — create a room, share the 4-letter code, friends join. Up to 8 players per room; the host can add bots.

It has **no dependencies** (only Node.js 18+), so there is nothing to `npm install`.

## Play on your home Wi-Fi (quickest)
1. Install Node.js LTS from https://nodejs.org
2. In this folder run: `node server.js`
3. On your PC open http://localhost:8080 — friends on the same Wi-Fi open `http://YOUR-PC-IP:8080`
   (find the IP with `ipconfig` → "IPv4 Address", e.g. `http://192.168.1.7:8080`).
4. Click **Play online** → **Create a room** → share the code. The server address fills in by itself.

## Put it on the internet for free (Render)
1. Create a free GitHub account and a new repository, then upload the contents of this folder
   (`server.js`, `package.json`, `README.md` and the `public` folder).
2. Create a free account at https://render.com → **New → Web Service** → pick your repository.
3. Settings: Runtime **Node**, Build command *(leave empty)*, Start command `node server.js`, Instance type **Free**.
4. After it deploys you get an address like `https://riftline-mudit.onrender.com`.
   - Open it to play. Chrome shows **Install app**, which puts Riftline on the home screen / Start menu and makes it work offline.
   - **Play online** fills in the server by itself. Friends just open the same address.
   - From anywhere else (the downloaded HTML file, the desktop app, itch.io), paste `wss://riftline-mudit.onrender.com/ws` into **Play online → Server**.
5. Free Render services sleep after ~15 minutes without visitors; the first visit after that takes about a minute to wake up.

## Android app (APK)
Once the game is online at an https address:
1. Go to https://www.pwabuilder.com and paste your address (e.g. `https://riftline-mudit.onrender.com`).
2. Choose **Package for stores → Android → Generate**, download the zip.
3. Copy the `.apk` inside to your phone and open it (allow "install unknown apps" when asked).
   The same package also contains the `.aab` file the Google Play Store needs if you publish there later.

Health check: `/health` returns `ok` and the number of open rooms.
