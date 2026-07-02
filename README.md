# ⚽ Copa Circular '26

An unofficial, non-commercial World Cup 2026 fan bracket — 48 teams arranged in a circle,
working inward through the Round of 32 to the final at the center.

- **Circle view**: 12 group sectors on the outer ring, knockout rounds spiraling inward, team-path
  highlighting ("the road of Paraguay"), semantic zoom.
- **Picks**: pick every knockout winner, weight them with confidence stars, call exact scores for
  bonus points. Picks lock at kickoff and score themselves as real results land.
- **Prediction markets**: every match shows pre-match win probabilities (Polymarket where
  available); finished matches are tagged as expected wins or upsets (minor / big / shock).
- **Media**: every played match links extended highlights (FOX Sports / FIFA official YouTube
  embeds), social clips, and a post-match quote — curated nightly.
- **Extras**: time-travel slider (replay the tournament day by day), retro bracket, EN/ES toggle,
  share-to-X/WhatsApp/Reddit with a comparable bracket link.

## Develop

```sh
npm install
npm run dev          # local dev server
npm run fetch-data   # refresh public/data/*.json from ESPN
npm run build        # type-check + production build
```

## Data pipeline

`scripts/fetch-data.mjs` pulls the ESPN scoreboard + standings (no key needed), normalizes into
`public/data/tournament.json`, and snapshots pre-match odds into `public/data/odds.json`
(entries are never overwritten after kickoff — the last pre-match line is the record).
`media.json` (highlights/clips/quotes/recaps) and `markets.json` (champion market) are curated by
a nightly Claude routine — see [NIGHTLY_ROUTINE.md](NIGHTLY_ROUTINE.md).

A GitHub Actions cron refreshes data and redeploys nightly.

Unofficial fan project. Not affiliated with FIFA or any broadcaster. No ads, no profit.
All video plays through official YouTube embeds; nothing is rehosted.
