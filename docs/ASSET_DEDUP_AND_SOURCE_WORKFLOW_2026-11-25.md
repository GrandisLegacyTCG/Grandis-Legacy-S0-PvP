# PvP Standalone — byte-identical asset deduplication and source workflow

## Authority and boundaries

- **PvP source baseline:** the last owner-approved PvP standalone + website `/pvp/` pair supplied to the conversation. This change starts from **UI Sync 1 S3**. Do not replace it with a GitHub snapshot; the owner's GitHub publication intentionally lags development.
- **VS AI donor:** inspect the owner's **latest supplied VS AI standalone** package only for new gameplay/UI candidates. Do not assume a website repository contains those changes. Donor UI/gameplay changes require a **separate, explicitly reviewed** engine/UI adaptation, not an unconditional copy.
- **Owner's website workflow:** Website, Deck Builder and VS AI are maintained independently, then merged into **Website without PvP**. PvP produces a separate self-contained backend and a website-root `pvp/`-only overlay. Other website subtrees are immutable in the PvP artifact.
- This patch alters **only** the standalone asset distribution/installation tooling and documentation. No donor gameplay, AI, PvP rules, WebSocket, ACK, reconnect, server authority or frontend network/HTML/CSS is changed.

## Why and how

One standalone package must supply assets locally while the website `/pvp/` overlay may use shared website-root assets. However, binary assets with **identical SHA-256** had been stored multiple times under standalone paths for Lobby and Battlefield. Names alone are never sufficient: files sharing a name but with different bytes must remain separate.

**Implementation**:

1. Generate `scripts/asset-dedup-manifest.json` from complete baseline bytes, grouping only identical `.png`, `.webp`, `.mp3`, `.wav`, `.woff2`, `.ico`, `.jpg` and `.jpeg` binaries. Never group by filename or visual similarity.
2. Ship one canonical binary per group in the ZIP. The list of additional legacy URL paths is retained as a manifest, rather than re-bundling identical bytes.
3. Before the standalone starts, `npm start` invokes `npm run prepare:assets`, which **hardlinks** the identical files to their original public URL paths. On platforms without working hardlinks the script falls back to copying bytes. This is strictly local and does not access another domain or website.
4. `Dockerfile` restores these paths during image build, **before** precompression and before switching to its unprivileged runtime user. Northflank can use the existing Dockerfile, without any URL or WebSocket changes.
5. The script checks SHA-256, size, canonical paths, and collisions; it refuses to overwrite a different file. All browser URLs, relative CSS references, Node tests and offline standalone artwork paths remain unchanged **after hydration**.
6. To inspect standalone ZIP extracted without serving it, run `npm run prepare:assets` once. Directly running `node server.js` or serving the unpacked raw ZIP without hydration is **unsupported**; `npm start` and the included Dockerfile hydrate automatically.

### Measured effect

- 88 identical-binary groups.
- 102 duplicate binary copies omitted from distribution.
- 29.75 MiB of byte-identical raw payload removed from the ZIP source. The measured **ZIP** saving is reported separately in the final QA audit.
- **Protected:** 250 original Season 0 card faces, card-accurate thumbnail-first logic and its fallback; same-name but content-different audio or card backs; exact gameplay/runtime/authority/network files; JS/CSS catalog/dependency paths; and all website root assets.
- **No claim of RAM saving:** Hardlinks reduce disk and archive duplication, not necessarily browser image decode caches. RAM/frame-time improvements need independent browser measurements.

## Commands

```sh
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm start                          # automatically restores local URL paths
npm run prepare:assets             # optional manual hydration
npm run verify:assets              # SHA-256 and all 102 aliases
npm run test:dedup-http            # real server GET/HEAD/range checks
npm run check:rc42                 # regular networking/gameplay source QA
```

Run `npm run prepare:assets` before `npm run test:dedup-http` on a fresh extraction when not starting via `npm start`.

## Verification requirements

1. Extract the packed ZIP to a clean folder; ensure omitted aliases are genuinely absent in the archive, not truncated or corrupt.
2. Run hydration in the clean folder; verify all grouped aliases recreate **exact baseline bytes** and all originals remain included.
3. Start the actual standalone server and test HTTP HEAD for **all 102 alias URLs**, GET with byte/hash verification on representative PNG, WebP, font and audio, and HTTP Range for MP3. Include `/pvp/` routing.
4. Assert bit-identical `server.js`, all of `server/`, PvP network, gameplay engines, static data, player UI and website `pvp/` compared with the baseline.
5. Re-run two-seat ACK/revision/reconnect/Mana continuation, Import Deck, artwork and mobile contract tests.
6. Test a **native ws Northflank deployment** and two real browsers before claiming production-ready; these are not implied by local fallback-WebSocket tests.

## Rollback

Use the immutable previous standalone ZIP and the unchanged website overlay. No player records, protocol version, WSS configuration or build ID were migrated. The new install-time hardlink manifest can be removed with its tooling to restore the previous fully duplicated distribution.
