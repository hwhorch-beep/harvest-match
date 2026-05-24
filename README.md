# Harvest Match

A small web app that turns a weekly local produce list into curated recipe suggestions, drawn from a hand-picked set of trusted cookbooks and food sites.

Built for the Brunswick, Maine farmers market (and Six River Farm in particular) — it's a community tool for the author and their friends and neighbors, not a venture-scale product.

> **Status:** Design stage. This repository currently holds the project notes ([`260510 brunswick-market-app-notes.md`](260510%20brunswick-market-app-notes.md)). The app itself is not built yet.

## The idea

Each week the market brings a different mix of produce. Some of it is "blink and you miss it" — sprouting broccoli, kale raab, Hakurei salad turnips, the first asparagus, overwintered leeks. Some is storage stock available for months. A good cook prioritizes the fleeting items.

You paste in the week's produce list, and the app returns 4–6 recipes that:

- Prioritize the truly fleeting items over long-season/storage produce
- Draw from a curated set of trusted recipe sites
- Fall back to other reputable sources only when the curated sites have nothing
- Honestly flag gaps (e.g. "I couldn't find a Hakurei recipe on your sites, here's one from Bon Appétit")
- Use multiple market items per recipe where possible

The value isn't "tell me what's at the market" — the farm's newsletter already does that. The value is editorial: *given this list, here are the recipes worth making this week, prioritizing fleeting items, drawn from these specific cooks I trust.* It's the work a thoughtful friend would do if you texted them the list.

## How it works

The "fleeting produce" lens is the core idea: weigh produce by how short its season is, anchor recipes around the fleeting items first, and treat storage produce (beets, celeriac, cabbage, potatoes) as supporting cast that will keep.

Each recipe in the output includes a title and source site, a direct link, a 1–2 sentence pitch for why it fits this week, and which market items it uses — plus an honest notes section about gaps and substitutions.

### Preferred recipe sources (rough priority order)

- [Smitten Kitchen](https://smittenkitchen.com)
- [Better Food Guru](https://betterfoodguru.com)
- [Ottolenghi](https://ottolenghi.co.uk/pages/recipes)
- Samin Nosrat's NYT Cooking page
- [Barefoot Contessa](https://barefootcontessa.com/recipes)
- [America's Test Kitchen](https://americastestkitchen.com/recipes) (paywalled, but a known favorite)

## Architecture

A deliberately zero-maintenance design:

- **Frontend:** static HTML/CSS/JS (or simple Vite + React), served from GitHub Pages
- **Backend:** none
- **API keys:** each user supplies their own Anthropic API key, stored in browser `localStorage`. The key is only ever sent to `api.anthropic.com` — never logged, never put in error messages.
- **Deploy:** `git push` to `main`

### Why user-supplied keys

GitHub Pages is free but static-only, so it can't safely hold a shared API key. For a small audience of friends already comfortable with AI tools, a one-time 10-minute setup (make an Anthropic account, paste a key) keeps costs with each user, removes any shared-key abuse risk, and leaves nothing to maintain.

This is worth revisiting only if the audience grows to include people who won't set up a key — at which point the app would need a backend (Vercel/Netlify serverless functions). Not worth pre-optimizing for.

## Roadmap

The build plan, in brief (see the notes for detail):

0. **Decide** the app/repo name, input shape (produce list only), output shape (4–6 numbered recipes), and **draft the system prompt** — the highest-leverage piece.
1. **Set up** accounts and tools (GitHub, Claude Code, Anthropic API key).
2. **Scaffold** the single-page static app — paste key + produce list, call the Claude API from the browser, render the response as markdown.
3. **Iterate on the system prompt** — this is where most of the time goes. Stronger fleeting-produce framing, web search, few-shot format examples, explicit honesty rules.
4. **Deploy** to GitHub Pages and test from a fresh browser and a phone.
5. **Write a "how to use this" page** walking through Anthropic account setup, key generation, and expected costs (pennies per query).
6. **Share** with 2–3 trusted friends and iterate on real feedback.

### Out of scope for v1

Authentication, accounts, saved preferences, a database, saved/past lists, and social/sharing/rating features — all of which would turn a weekend project into ongoing maintenance.

### Future versions

Ideas worth picking up once v1 is in real use and the core editorial loop has earned its keep:

- **User-supplied recipe sources.** Let each user paste in their own list of trusted sites (and optionally remove ones from the default). The curated set reflects one cook's taste; other cooks have other shelves, and the app gets meaningfully more useful when the source list is yours.
- **User-managed produce lists.** Go beyond paste-once-per-visit: save weekly lists for later reference, support inputs from farms or markets other than Six River, and allow a personal "what's in my garden / CSA box / fridge right now" list that can stand in for — or be combined with — the market list.
- **Pantry-aware suggestions.** Optional input for staples already on hand (eggs, anchovies, miso, good olive oil, a half-bunch of parsley) so the recipes returned can prefer ones that lean on what's already in the kitchen.

These are listed roughly in order of how much state they imply. A custom source list is essentially a longer text input; saved produce lists start to require real persistence (localStorage at minimum, probably a lightweight account once devices are in play); pantry awareness adds a small but real settings surface. Each one is worth doing only if v1 proves the core idea is useful enough that the extra machinery earns its weight.

## Data source

The produce list comes from [Six River Farm](https://sixriverfarm.com) in Bowdoinham (MOFGA-certified organic), which sells at the Brunswick markets and posts availability via a twice-weekly email newsletter, Instagram ([@sixriverfarm](https://instagram.com/sixriverfarm)), and Facebook. For v1 the input pipeline is simply copy-paste from the email; automated ingestion (scraping/parsing) is out of scope.
