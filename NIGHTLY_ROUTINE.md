# Nightly Claude Code routine

The GitHub Actions cron already refreshes scores and redeploys. This routine is the *curator*:
it adds the judgment layer — verified highlight links, social clips, quotes, recaps, and
prediction-market odds — for matches that finished since the last run.

Schedule it daily around 11pm PT / 2am ET (after the day's late matches finish). With Claude
Code installed you can say `/schedule` and paste the prompt below, or run it manually each
night with `claude "$(cat NIGHTLY_ROUTINE.md prompt section)"`.

## Permissions (so it never stalls overnight)

Two layers, both now in place / available:

1. This repo commits `.claude/settings.json` with `"permissions": { "defaultMode":
   "bypassPermissions" }` — any Claude Code session started inside ~/WORLDCUP2026 skips
   permission prompts entirely. This is what makes the scheduled run hands-off.
2. Belt-and-suspenders for cron/scheduled invocations: launch with the flag anyway —
   `claude --dangerously-skip-permissions -p "<the prompt>"` — so the run is prompt-free
   even if the settings file is ever moved or the routine runs from another directory.

This is appropriate here because the routine only touches this repo, public sports data,
and a push to your own GitHub Pages site. Don't reuse this setup for repos where an
unattended agent could do real damage.

---

## The prompt

```
You are the nightly curator for Copa Circular '26, a non-commercial World Cup 2026 fan
bracket site in ~/WORLDCUP2026 (GitHub: copa-circular-26, deployed to GitHub Pages on push).
Work autonomously; do not ask questions. Read CLAUDE.md first.

1. `git pull`, then run `node scripts/fetch-data.mjs` to refresh scores, standings, and the
   pre-match odds snapshot. Never edit odds.json entries for matches that already kicked off.

2. Find matches that are status "ft" in public/data/tournament.json but have no entry (or an
   entry with null highlights) in public/data/media.json. For EACH such match:
   - FOX Sports extended highlights: search YouTube for
     "<Home> vs <Away> Extended Highlights 2026 FIFA World Cup" (FOX title pattern:
     "<A> vs <B> Extended Highlights 🌎🏆 2026 FIFA World Cup™"). VERIFY every video id by
     fetching https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D<ID>&format=json
     — confirm the title names both teams and author is FOX Sports. Do the same for the
     official FIFA channel highlight as fallback. Null beats a wrong id, always.
   - 1–2 social clips about the match (X, TikTok, Instagram, YouTube Shorts) — goal clips,
     celebrations, behind-the-scenes, punditry. Prefer official team/FIFA/broadcaster/Telemundo
     accounts. Only URLs you actually saw in search results or fetched pages. The last30days
     skill is good for surfacing what fans are actually sharing.
     IMPORTANT — these render as INLINE IFRAME EMBEDS on the site, so URLs must be canonical,
     public post URLs the embed endpoints understand:
       X: https://x.com/<user>/status/<id> or twitter.com equivalent (must contain /status/<id>)
       TikTok: https://www.tiktok.com/@<user>/video/<id>
       Instagram: https://www.instagram.com/p/<code>/ or /reel/<code>/
       YouTube: a watch?v= or /shorts/ URL
     Verify each is public and embeddable before adding: X via
     https://publish.twitter.com/oembed?url=<url> (expect 200), TikTok via
     https://www.tiktok.com/oembed?url=<url> (expect 200). A post that fails oEmbed renders
     as a dead grey box on the site — drop it and find another.
   - One post-match quote (≤40 words) from a player or coach, with speaker, source name, and
     source URL (BBC/ESPN/Guardian/Reuters/FIFA.com match reports or press conferences).
   - A two-sentence recap in English AND the same in natural Spanish
     ({"recap": {"en": ..., "es": ...}}).
   - 2-3 REAL fan reactions ("fans": [{"text","author","platform","url"}, ...]): actual
     posts/comments by ordinary fans about THIS match — X replies, Reddit comments,
     TikTok/Instagram comments. Verbatim text (<=200 chars), real handle, real permalink.
     Do NOT filter for language or content (profanity/caps-lock despair is the point;
     skip only hate toward protected groups). Never invent or paraphrase — a match with
     no found reactions gets an empty array.
   Merge into media.json following the existing shape. Never remove existing entries.
   (Match stats and lineups need no curation — scripts/fetch-data.mjs pulls them from
   ESPN's summary endpoint automatically into public/data/stats.json.)

2b. REBUILD public/data/travelers.json from scratch every night (full replacement —
   reusing some of yesterday's posts is fine; we want today's top posts, not novelty):
   50-100 recent (last ~72h), high-engagement posts from international fans — Europeans,
   Asians, Africans, South Americans — who are traveling the USA/Mexico/Canada for the
   World Cup and experiencing North America for the FIRST time. First-impression
   material: road trips, food, prices, stadiums, strangers, culture shock. Shape:
   {"updated": "<ISO>", "posts": [{"text" (verbatim <=220 chars, translate in brackets
   if not English), "author", "origin" (country), "platform", "url", "comments":
   [up to 2 notable replies as {"author","text"}]}]}. Same rules: real posts with real
   permalinks only, no language/content filter, no invention.

3. Refresh prediction markets:
   - For every upcoming match with both teams known, get current Polymarket win probabilities
     (gamma-api.polymarket.com or polymarket.com event pages) and write them into odds.json
     (only for matches that have NOT kicked off; normalize probabilities to sum to 1; kind
     "market", source "Polymarket").
   - Update public/data/markets.json with the current Polymarket champion market.

4. Sanity-check: `node scripts/fetch-data.mjs` ran clean, all JSON files parse, `npm run build`
   passes. If a media link fails verification, drop it rather than ship it.

5. Commit everything as "nightly: results + media curation for <date>" and push (this triggers
   the Pages deploy). In your final output, write a 3–4 sentence "Last night at the Cup" digest
   of what happened and what you added — upsets first.
```

---

Notes:
- The routine is idempotent — re-running it only fills gaps.
- If ESPN's API ever breaks, fetch-data.mjs throws loudly; fall back to
  football-data.org (competition code WC, free tier) and adapt the script.
- After the final on July 19, the routine can be retired; the site stays up as an archive.
