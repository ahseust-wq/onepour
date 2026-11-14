# One Pour website — deploy notes

Plain static files, no build step. Host anywhere that serves a folder (GitHub Pages, Netlify, Cloudflare Pages).

## Before publishing
1. **Impressum** (`impressum.html`): fill in your name and postal address. This is required in Germany for a site connected to a commercial app.
2. **Email**: `support@onepour.app` is used throughout. If you don't own that domain, search-and-replace it with your support address.
3. **Domain**: the app shares ghost links as `https://onepour.app/g#<code>`. If you use another domain, change `SHARE_BASE` in `app.js`, the `<data android:host>` in `AndroidManifest.xml`, and the URLs in `robots.txt`, `sitemap.xml` and the `og:image` tags.
4. **App Links (optional)**: put your app-signing SHA-256 fingerprint (Play Console › Setup › App integrity) into `.well-known/assetlinks.json` and add `android:autoVerify="true"` to the https intent filter, so ghost links open the app directly.

## Deploy on GitHub Pages
1. Create a repository, push the contents of this folder to the root (keep `.nojekyll` so `.well-known/` is served).
2. Settings › Pages › Deploy from branch `main` / root.
3. Settings › Pages › Custom domain → `onepour.app`, then set the DNS records GitHub shows. Enable HTTPS.

## Play Console fields
- Privacy policy URL: `https://onepour.app/privacy.html`
- Website: `https://onepour.app`
- Email: your support address
- AdMob › Apps › One Pour › app-ads.txt: AdMob checks `https://onepour.app/app-ads.txt` (the domain must match the website set in Play).

## Data safety form (matches privacy.html)
- Data collected: **Device or other IDs** (advertising ID) — collected, shared with Google for advertising/fraud prevention; **App interactions** — collected by the ads SDK for analytics/advertising.
- Data encrypted in transit: Yes. Users can request deletion: game data is on-device (clear storage).
- No account, no location, no personal info, no financial info handled by the app (Google Play handles payment).
