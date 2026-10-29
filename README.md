# jj-engine — the Jackpot Junction game engines' maths modules

The large, self-contained maths modules of the game servers (jj-money-game, jj-game, jj-money-worker): pure functions
and pay/weight tables — the same maths the site's client bundles already serve, minified — with no request handling,
policy, caps or settlement in them (those stay inside the functions). Authored in `fn/engine/` of the platform repo and
published here file for file (`tools/perf/engine_publish.sh`); the functions import each module pinned to a commit,
`https://raw.githubusercontent.com/raisonsllc-bot/jj-engine/<commit>/<name>.js`, which Supabase's deploy bundler
resolves and bundles at deploy time (nothing is fetched while a round is played). `basinmath.js` is
phoenix-basin-platform-1.2 (docs/BASIN-MATH-PROPOSAL.md in the platform repo). A maths change is: edit, publish (new
commit), one small deploy per function with the new pin (`tools/perf/engine_mirror.py`).
