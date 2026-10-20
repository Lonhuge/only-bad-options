# ONLY BAD OPTIONS — easy easy store

Static storefront for the band **easy easy** (ONLY BAD OPTIONS), styled after plz.world.

- `index.html` — home (hero, product grid with shop filter, tickets/tour, newsletter)
- `product.html` — data-driven product detail page (`product.html?p=<id>`)
- `images/` — optimized product photos & logo
- `fonts/` — drop the licensed **Sequel 100 Black** webfont here (`Sequel100Black.woff2`)

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Payments are not wired yet (SumUp integration is the next step).
