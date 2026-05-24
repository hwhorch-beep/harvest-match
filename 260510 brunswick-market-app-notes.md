# Brunswick Farmers Market Recipe App — Project Notes

A working document capturing the concept, decisions, and build plan for a small web app that takes a weekly local produce list and returns curated recipe suggestions from a set of preferred cookbooks and food sites.

---

## The Concept

Each week, the Brunswick farmers market (and Six River Farm in particular) brings a different mix of produce. Some of it is "blink and you miss it" — sprouting broccoli, kale raab, Hakurei salad turnips, the first asparagus, overwintered leeks at the end of their run. Some of it is storage stock that's available for months. A good cook prioritizes the fleeting items.

The app takes the week's produce list as input and returns 4-6 recipes that:

- Prioritize the truly fleeting items
- Draw from a curated set of trusted recipe sites
- Fall back to other reputable sources only when the curated sites have nothing
- Honestly flag gaps (e.g., "I couldn't find a Hakurei recipe on your sites, here's one from Bon Appétit")
- Use multiple market items per recipe where possible to maximize the haul's efficiency

The app is for the user and their friends and neighbors in Maine. It is not a venture-scale product.

---

## Recipe Curation Framework

### Preferred sites (in rough priority order)

- Smitten Kitchen — smittenkitchen.com
- Better Food Guru — betterfoodguru.com
- Ottolenghi — ottolenghi.co.uk/pages/recipes
- Samin Nosrat's NYT Cooking page — cooking.nytimes.com/68861692-nyt-cooking/12685156-samin-nosrat-recipes
- Barefoot Contessa — barefootcontessa.com/recipes
- America's Test Kitchen — americastestkitchen.com/recipes (paywalled, but a known favorite)

### The "fleeting produce" lens

Not all market produce is equal. The app should weigh items by how short their season is.

**Truly fleeting (May in Maine):**
- Kale raab — flowering kale tops, ~2-week window before plants bolt
- Sprouting broccoli — once-a-year item
- Hakurei salad turnips — early spring window
- Asparagus — six-week window
- Overwintered leeks — end of season; different from fall leeks
- Bok choi — bolts as soon as it warms up
- Spicy/mustard greens — peak only while it's cool

**Long-season or storage:**
- Potatoes (yellow, red, russet)
- Carrots, parsnips, celeriac
- Beets, kohlrabi, purple top turnips
- Most kales, swiss chard, spinach
- Green cabbage
- Cucumbers (greenhouse year-round)

The app should anchor recipes around the fleeting items first, treat storage produce as supporting cast, and honestly tell the user that beets/celeriac/cabbage will keep — they don't need to be the focus this week.

### Format conventions for output

Each recipe should include:
1. Title and source site
2. Direct link to the recipe
3. 1-2 sentence pitch explaining why it fits this week
4. Which market items it uses

Plus an honest "notes" section at the end about gaps, substitutions, or items not covered.

---

## Sample Output — Week of 5/8/2026

These are the five recipes the curation produced when focused on fleeting items:

1. **Pasta with Garlicky Broccoli Rabe — Smitten Kitchen** (kale raab substitute)
   smittenkitchen.com/2012/04/pasta-with-garlicky-broccoli-rabe

2. **Char-grilled Sprouting Broccoli with Sweet Tahini — Ottolenghi**
   ottolenghi.co.uk/pages/recipes/char-grilled-sprouting-broccoli-sweet-tahini

3. **Glazed Hakurei Turnips — Bon Appétit / Anita Lo** (off-list fallback; preferred sites had nothing)
   bonappetit.com/recipe/glazed-hakurei-turnips

4. **Spring Asparagus Galette — Smitten Kitchen** (uses asparagus + leeks)
   smittenkitchen.com/2021/04/spring-asparagus-galette

5. **Asparagus & Egg Salad with Walnuts and Mint — Smitten Kitchen** (uses asparagus + mint)
   smittenkitchen.com/2018/04/asparagus-and-egg-salad-with-walnuts-and-mint

Plus a note that bok choi can be sautéed simply rather than chasing a recipe, and a flag that overwintered leeks are at end-of-season.

---

## Competitive Landscape

### What exists
- **Generic "what's in my fridge" apps**: SuperCook, Yummly, Mealime, MyFridgeFood, Plant Jammer, Let's Foodie, plus dozens of AI recipe generator apps. None of these care about *which* recipe sites the recipes come from.
- **Cook With What You Have** (cookwithwhatyouhave.com) — closest competitor. Curated recipe database (~1,000 recipes) sold to CSA farms as a member benefit. Editorial, manual, paywalled per-farm.
- **Static seasonal roundups** — Mill City Farmers Market, MIFMA recipe cards, food-blog "50 farmers market recipes" listicles. These are SEO content, not weekly tools.
- **CSA newsletters** — Many CSAs send weekly emails with recipes. Six River doesn't seem to do this.

### What doesn't exist
- A tool where the *user* picks the recipe sources
- LLM-powered curation that reasons about fleeting vs. storage produce
- Hyper-local framing — "what's at *your* market this week"
- A free, low-friction, shareable version

The space the app sits in does not appear to be occupied. That cuts both ways: it might be a real gap, or the audience might be too small to support a venture product. For a small community tool, neither matters.

---

## Architecture Decisions

### Stack
- **Frontend**: static HTML/CSS/JS or simple Vite + React, served from GitHub Pages
- **Backend**: none
- **API key handling**: each user supplies their own Anthropic API key, stored in browser localStorage
- **Domain**: starts as username.github.io/repo-name; can buy a custom domain later
- **Deploy**: `git push` to main branch

### Why user-supplied keys
- GitHub Pages is free and works for static sites only — it can't safely hold an API key
- Vercel/Netlify would solve that with serverless functions, but adds complexity
- For a small audience of friends already comfortable with AI tools, asking them to make an Anthropic account and paste a key is a 10-minute one-time setup
- Cost stays with the user (pennies per query); no risk of someone abusing a shared key
- Truly zero-maintenance architecture

### When to revisit this decision
If the audience grows to include people who won't set up an API key (a neighbor at the farmers market who just wants to try it on their phone), the app needs a backend. At that point, switch to Vercel or Netlify and have the app hold the key. Don't pre-optimize for that.

### Security notes for v1
- Store the key in localStorage (stays on the device)
- Only send the key to api.anthropic.com — never log it, never include it in error messages
- Make this explicit in the code so it's easy to verify

---

## Build Plan

### Step 0 — Decisions before opening Claude Code (~30 min)
- App name and GitHub repo name
- Confirm input shape: produce list only for v1, no extra fields
- Confirm output shape: 4-6 numbered recipes, each with title/source/link/pitch
- **Draft the system prompt** — this is the highest-leverage piece and the only thing Claude Code can't really do for you. It needs the fleeting-produce framework, the preferred-sites list, the fallback rule, the format conventions, and the "be honest about gaps" instruction.

### Step 1 — Accounts and tools (~30 min)
- GitHub account
- Install Claude Code locally (docs.claude.com)
- Anthropic API account at console.anthropic.com — generate a key, add $5
- Verify git push works to GitHub

### Step 2 — Scaffold with Claude Code (1-2 hours)
Tell Claude Code: build a single-page static web app where the user pastes an Anthropic API key (stored in localStorage) and a produce list. On submit, call the Claude API directly from the browser with the system prompt, and render the response as formatted markdown. No backend, no build step beyond what GitHub Pages can serve.

Things to verify in the scaffold:
- API key storage and handling is safe
- System prompt is in a clearly marked variable so it can be iterated on
- Errors handled gracefully (bad key, network failure, rate limit)
- Mobile-friendly — it'll be used on phones at the market

### Step 3 — Iterate on the system prompt (the real work)
Test with real produce lists. Output will probably be worse than the conversations the prompt was based on. Likely additions:
- Stronger fleeting-produce framing with explicit examples
- Instructions to use web search, not just training knowledge
- Format examples (few-shot)
- Explicit honesty rules ("if you can't find a recipe on the listed sites, say so before falling back")

This is where most of the time goes. Plan for several sessions.

### Step 4 — Deploy to GitHub Pages (~30 min)
Push, enable Pages in repo settings, point at main branch. Test from a fresh browser and a phone with a real key.

### Step 5 — Write a "how to use this" page
Walk through making an Anthropic account, generating a key, expected costs (pennies per query), pasting it in. Include a screenshot of the Anthropic console. Non-negotiable for user-supplied keys.

### Step 6 — Share with 2-3 trusted friends
Frame as: "I'm trying to figure out if this is actually useful or just clever. Use it for a real week of cooking and tell me what broke or what felt awkward." Iterate on what they say, not on what you imagined.

### Things to skip in v1
- Authentication, accounts, saved preferences
- Database
- "Save this week's list" feature
- Social/sharing/rating features

These all turn a weekend project into ongoing software maintenance. The whole point of user-supplied keys + GitHub Pages is that there is nothing to maintain.

---

## Data Source — Where the Produce List Comes From

The list almost certainly comes from **Six River Farm** in Bowdoinham (Nate Drummond and Gabrielle Gosselin). They sell at all three Brunswick markets — downtown Tuesday/Friday and Crystal Spring Saturday — plus the Brunswick Winter Market. The produce mix on the 5/8 list matches their MOFGA-certified organic catalog precisely.

### Where they post their lists
1. **Email newsletter** — twice a week, lists what's available at the farm stand and farmers markets. Sign up at sixriverfarm.com.
2. **Instagram** — @sixriverfarm, 1,600+ posts. Produce lists in captions.
3. **Facebook** — also used for product lists per the Merrymeeting Food Council.

### What's *not* available
- A clean public archive of last year's weekly lists. The emails go to subscribers; Instagram and Facebook are public but not structured as archives. Reconstructing last year would mean scrolling through 100+ posts.
- The Brunswick-Topsham Land Trust monthly e-newsletter does not include weekly produce lists.

### Implications for the app
- The simplest input pipeline is the Six River email — copy-paste from the email into the app each week.
- Automating ingestion (scraping Instagram or parsing emails) is technically possible but much bigger. Skip for v1.
- Worth a five-minute conversation with Nate and Gabrielle on a Saturday morning. They might love the app and want to point their customers to it; they might prefer to keep their newsletter as the only channel. Either is fine to know early.

---

## Strategic Framing

If Six River is already sending the list to subscribers, the app's value isn't "tell people what's at the market" — the email does that. The app's value is:

> **Given this list, here are the recipes worth making this week — prioritizing fleeting items, drawn from these specific cooks I trust.**

That's a tighter and more defensible value proposition than "produce-to-recipes app." It's editorial. It's about taste and curation. The LLM is doing the work that a thoughtful friend would do if you texted them the list.

Keep this framing in mind when writing the system prompt. The app is not a generic recipe finder. It's a small editorial tool with a point of view.

---

## Open Questions / Things to Decide

- [ ] App and repo name
- [ ] Whether to talk to Six River Farm before or after building v1
- [ ] Whether to support multiple weeks (storing past lists) — probably not for v1
- [ ] Whether to add a "this week's pick" — one recipe the user is likely to actually make tonight — vs. just a list of 5
- [ ] Whether to display estimated cost per query in the UI for transparency
- [ ] How to handle the user pasting a list in a wildly different format (e.g., from a different farm or a different market)

---

## Notes from the Conversation

- The "fleeting produce" framing was developed in conversation with Claude. It's not a standard concept in food writing, but it produces noticeably better recipe picks. Make sure it survives into the system prompt.
- The user's listed sites have uneven coverage. Smitten and Ottolenghi are deep; Better Food Guru skews vegan/summer; Samin's NYT page is paywalled. The fallback-to-reputable-sources rule is essential — without it, weeks where the listed sites don't have what's needed will produce thin output.
- America's Test Kitchen is paywalled. Recipes there are still worth surfacing if they're the best fit, but the link will hit a paywall. Worth flagging in the output when this happens.
