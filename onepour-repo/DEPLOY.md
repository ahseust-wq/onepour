# One Pour website — deploy notes

Live address: **https://ahseust-wq.github.io/onepour/** (GitHub Pages project site, repository `ahseust-wq/onepour`).

Plain static files, no build step.

## 1. Before publishing
1. **Contact email**: every page uses the placeholder `__CONTACT_EMAIL__`. Replace it once:
   ```
   CONTACT_EMAIL='you@example.com' ./set-contact-email.sh
   ```
2. **Impressum** (`impressum.html`): fill in your name and postal address (required in Germany).

## 2. Publish the site (repository `onepour`)
1. Create the public repository `onepour` under `ahseust-wq`.
2. Push the contents of this folder to the root of the `main` branch.
3. Settings › Pages › Build and deployment › Deploy from a branch › `main` / `/ (root)`.
4. After a minute the site is live at https://ahseust-wq.github.io/onepour/.

## 3. Domain-root files (repository `ahseust-wq.github.io`)
AdMob and Android only look for these files at the **root of the domain**, not under `/onepour/`. They are in the separate `root-site/` folder:
- `app-ads.txt` → must be reachable at `https://ahseust-wq.github.io/app-ads.txt`
- `.well-known/assetlinks.json` → `https://ahseust-wq.github.io/.well-known/assetlinks.json` (optional, for verified App Links)
- `index.html` → redirects the bare domain to `/onepour/`
- `.nojekyll` → needed so GitHub serves the `.well-known` folder

Create a second public repository named exactly **`ahseust-wq.github.io`**, push the contents of `root-site/`, and enable Pages on `main` / root.

## 4. Play Console
- Store listing › Website: `https://ahseust-wq.github.io/onepour/`
  (AdMob looks for app-ads.txt on the root of this domain, i.e. `https://ahseust-wq.github.io/app-ads.txt`.)
- App content › Privacy policy: `https://ahseust-wq.github.io/onepour/privacy.html`
- Store listing › Email: your support address.
- After the app is live: AdMob › Apps › One Pour › app-ads.txt shows a green check within a day or two.

## 5. Ghost links
The app shares links as `https://ahseust-wq.github.io/onepour/g/#<code>`. The page at `g/` opens the app (or the Play Store).
For verified App Links (link opens the app directly, no page): put your app-signing SHA-256 (Play Console › Test and release › App integrity) into `root-site/.well-known/assetlinks.json` and add `android:autoVerify="true"` to the https intent filter in `AndroidManifest.xml`.

## Data safety form (matches privacy.html)
- Data collected: **Device or other IDs** (advertising ID) — shared with Google for advertising and fraud prevention; **App interactions** — collected by the ads SDK.
- Encrypted in transit: Yes. Deletion: game data is on-device (clear storage / uninstall).
- No account, location, personal or financial info handled by the app (Google Play handles payment).
