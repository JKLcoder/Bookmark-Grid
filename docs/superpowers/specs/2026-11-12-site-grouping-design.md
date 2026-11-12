# Site-adjacent bookmark ordering

User confirmed: keep pinned bookmarks first; other bookmarks from the same site are adjacent in the existing flat grid. Site groups rank by total recorded clicks of all bookmarks belonging to that site, members by individual usage. No headers, cards, collapsing or classification system.

Implementation choices: HTTP(S) hostname lowercased with leading www. stripped; ports/protocol/path do not split one hostname, other subdomains remain distinct (no unreliable public-suffix guessing). Non-web/malformed URLs keep independent groups by bookmark ID. Sum the existing frozen page frequency snapshot, including pinned bookmarks' counts. Pinned items retain prior count/recency/name ordering. Site totals tie by most recent usage, then existing Chinese-friendly name order; members retain count/recency/name ordering. Rank the complete list before search so filtering preserves group ranking. Pins update immediately; frequency changes wait for reload as before. Duplicates are preserved; no data migration, network, new permission or dependency.

Approaches: domain adjacency meets the user's confirmed request; content categories require new classification and were excluded. Group headers/collapsing were excluded to preserve the compact flat grid.
