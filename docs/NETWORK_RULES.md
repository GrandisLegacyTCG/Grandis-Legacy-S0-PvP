# Grandis Legacy Season 0 PvP — Mandatory Network Rules

**Status:** Normative engineering contract for the publicly distributed PvP backend.  
**No version dependency:** These are invariants required for every PvP update, not a changelog or instructions to copy a past implementation.  
**Ownership:** PvP owns WebSocket, identity, session, ACK, reconnect, authorization, privacy, liveness and release gates. The approved VS AI donor provides gameplay semantics and selected visual references only.

**Release rule:** Never change multiplayer transport or canonical authority as a side effect of adopting VS AI UI or effects. Any required protocol change needs a separate diff, test matrix and both-seat network regression. Changes are not Stable without live two-browser and native WSS acceptance.

## Scope, review and non-regression obligations

- Accept gameplay commands only as validated, authenticated, revision-bound *intents* to the authoritative server.
- Distinguish rejected actions from completed actions and those waiting on server continuation or a human decision.
- Do not unblock a player by guessing the pending owner, replaying an action as new, or making hidden data visible in the browser.
- Preserve all previously working behaviors with independent regression tests for both seats, including interrupted Attack → Response → Mana/choice continuations.
- Keep true private game state, raw tokens, production credentials, debug dumps, incident reports and donor update notes **out of the public repository**.
- Do not push or deploy automatically; manual release and production validation belong to the project owner.

---

## 2. Architecture: one canonical engine, a separate PvP network

```text
Approved VS AI gameplay rules and state transitions (NO AI strategies)
                         |
                 PvP ENGINE ADAPTER
        seat perspective | pending | outcome semantics
                         |
            SERVER-AUTHORITATIVE MATCH
       canonical state + revision + pending + ledger
                         |
             PvP ACTION ADMISSION LAYER
      actor / phase / revision / identity / privacy
                         |
             PvP WEBSOCKET PROTOCOL
       session / ordering / ACK / reconnect / health
                  /      |       \
                Seat 1 Seat 2  Spectator
                  \      |       /
              VIEWER-SAFE PROJECTIONS
                         |
         PvP CLIENT (UI + LOCAL VISUAL DRAFTS)
                /                     \
         Standalone UI           Website /pvp/ UI
```

**Critical separation:** Network determines **who may request** an action, in **which order**, with **which expected state** and **how the result is delivered**. The engine determines **whether the game action is legal and what it does**. The UI determines **how the player sees and chooses it**. Do not combine these responsibilities to work around a deadlock.

### 2.1. Always-true invariants

1. One authoritative canonical match state per room; no independent browser-owned game state for each player.
2. Two real human seats; internal donor labels such as `AI` never cause AI autoplay.
3. Only the server executes gameplay mutations and randomness. Clients can highlight or stage choices, never set HP, Mana totals, card identity or winner.
4. Every accepted gameplay intent produces at most **one** state transition, **one** ledger entry and **one** increment of revision.
5. Every accepted/rejected gameplay intent yields a correlated terminal response to its submitting client, or is recoverable by reconnect/status lookup and idempotent retry.
6. Both players and spectators receive **separately constructed viewer-safe** data. Never broadcast the full canonical state.
7. A pending choice has a stable identity, one authorized decision owner, legal domain and durable continuation context.
8. A completed choice cannot become “illegal” merely because a low-level engine helper returned a terminal/no-more-pending sentinel.
9. UI render, image decode, audio and animation cannot hold the authoritative network transaction open.
10. Reconnect cannot duplicate effects, reuse a lost seat incorrectly, or permit an old socket to mutate state.
11. No upgrade may remove a regression-tested behavior without a separately approved change and replacement test.

---

## 3. State model and authoritative lifecycle

### 3.1. Logical state per room

The following is a **conceptual contract**; discover the actual code fields before modifying an implementation.

```ts
interface PvPRoom {
  roomId: string;                         // stable scope, even when only one room exists
  matchEpoch: string;                     // changes when a new match replaces the old
  stage: 'SETUP' | 'COIN' | 'OPENING' | 'STARTED' | 'FINISHED' | 'CLEANUP';
  seats: { one: SeatSession | null; two: SeatSession | null };
  spectators: Map<string, SpectatorSession>;
  canonical: CanonicalGameState | null;    // server-private
  revision: number;                       // monotonic within matchEpoch
  pending: PendingDecision | null;        // owner, identity, context, legal inputs
  actionLedger: Map<string, CommittedActionRecord>;
  lastProgressAt: number;
  deadlines: RoomDeadlines;
  actionSerialQueue: ServerSideQueue;     // only one authoritative mutation at a time
}
```

- `roomId`, `matchEpoch`, `seat`, `revision` and `pendingId` are distinct. Do not use displayed turn number or a client action ID as a substitute for another identity.
- Canonical state includes physical card and Mana identifiers, hidden deck order, the exact Response chain and continuation context. None of these are freely exposed to browser clients.
- A match reset creates a **new epoch** and invalidates old pending handles, old match actions and old timers. A reconnect within the same epoch does **not** reset the revision or ledger.
- If the implementation supports only one in-memory room, document that as an explicit limitation. Never run multiple replicas against independent in-memory room states and pretend they are synchronized. Add a shared, transactional room owner/storage strategy **before** horizontal scaling.

### 3.2. Stage transition rules

| From | To | Required condition and effect |
|---|---|---|
| SETUP | COIN | Both authenticated seats present; validated deck/formation; both Ready; server records first-player process. |
| COIN | OPENING | Correct chooser/acknowledgements or documented bounded grace; server records authoritative turn order. |
| OPENING | STARTED | Both players' opening setup completed by authority; each receives own private opening cards. |
| STARTED | FINISHED | Donor engine says game ended, or valid authoritative surrender/timeout policy applies. |
| FINISHED | CLEANUP/SETUP | Result visible and acknowledged as required; server cleans sockets/state/ledgers safely. |

- Transitions must be idempotent; duplicate Ready, coin acknowledgements and START commands cannot start two matches.
- **Animations are advisory.** An animation acknowledgement can improve UX but must not be an unbounded prerequisite for server progress. Use a measured, configurable grace period with a documented fallback.
- A new READY action invalidates only what is appropriate in SETUP; never reset a started match because a late lobby packet arrives.
- Browser tab changes, iframe navigation or page reload must not open a second independent match.
- One room's timer must not mutate another room. Record stage change timestamps and actor-controlled deadlines.

### 3.3. Deck import is a protocol, not JSON string equality

1. Client supplies a deck export to the **server validation endpoint/intent**, not a trusted deck state.
2. Server normalizes the supported export schema, validates card/catalog/quantity/formation legality, and returns a typed result with a **server-approved normalized deck identity or digest** and descriptive errors.
3. Client correlates the result with the current request ID and deck selection generation; it must not require the server's normalized JSON bytes to equal the original export JSON bytes.
4. The seat's Ready flag may become true only for the **latest confirmed validated deck/formation**; changing decks invalidates stale Ready.
5. Lost response/reconnect must recover the server-confirmed deck state. A prior import ACK must not confirm a subsequent import.
6. Deck metadata or name must never be treated as a unique physical card identity or an authorization token.
7. Test invalid imports, revisions, two rapid imports, duplicate submit, reconnect during import and both seats.

---

## 4. Connection ownership, authentication and browser lifecycle

### 4.1. Browser and seat identity

- Use unpredictable **server-issued** session/seat credentials, bound to the correct room and seat; store secrets on the server as hashes where applicable.
- Identify each tab/session separately. Do not let two browser tabs silently share one mutable live-seat session because a global storage key was reused.
- Each authenticated seat has one **active socket generation/owner**. When a verified connection takes over, invalidate the old generation **before** accepting further gameplay messages.
- In the message handler, check that the receiving socket is still the **currently owned** socket for that seat. Reject/ignore stale-socket gameplay before dispatching.
- Reconnect reclaims only the **same** seat; it must never upgrade a spectator, switch seats or reveal the opponent's private cards.
- Spectators never submit gameplay intents, Ready, deck import for a player's seat or a surrender on behalf of a player.
- Do not rely on `Origin` alone as authentication. Enforce an explicit allowed-Origin policy **and** seat credentials/authorization. Handle non-browser clients accordingly.

### 4.2. One logical client session across Lobby and Battlefield

- Lobby and Battlefield must not compete to own the same player session or create two authoritative network clients.
- If a battlefield iframe is used, define **one** socket owner and a restricted same-origin messaging bridge (`source`, `origin`, channel, message type and lifecycle checked). Alternatively, explicitly and atomically hand off ownership while preventing overlap.
- Unmounting a hidden iframe, preloading a page or reopening a Card Review must not change match ownership or execute an intent.
- Client reconnect resumes with its last known `matchEpoch`, last revision and outstanding action IDs. Server replies with its actual authoritative status and current viewer-safe snapshot.
- On unrecoverable compatibility/authentication mismatch, show a readable recovery message; do **not** loop endlessly, silently swap seats or clear the last known action outcome.

### 4.3. Socket requirements

- Production uses verified native WebSocket transport over WSS with a valid TLS endpoint and the correct `/ws` route or centrally configured equivalent.
- Set limits on message size, JSON depth/schema, incoming intent rate, outgoing buffer size, spectators and pending queues. Reject malformed payloads without crashing the room.
- Use ping/pong, activity tracking and explicitly scoped timeouts. A heartbeat is not automatically proof that a human has made gameplay progress.
- When a slow client exceeds the outgoing buffer threshold, close that socket safely and allow fresh snapshot resynchronization; do not accumulate an infinite queue of stale snapshots.
- Serve `/health` with nonsecret readiness, actual transport type, runtime/gameplay compatibility fingerprint and deployment identity. A successful HTTP response does not prove a two-seat match.

---

## 5. The network transaction contract (MUST implement)

### 5.1. Every gameplay command is a correlated intent

The wire schema may evolve, but **every gameplay-changing intent** must carry equivalent fields:

```json
{
  "type": "runtime-intent",
  "protocolIdentity": "<current agreed protocol fingerprint>",
  "clientActionId": "<stable unique request ID>",
  "roomId": "<authorized room>",
  "matchEpoch": "<current match>",
  "expectedRevision": 123,
  "intent": "<approved action name>",
  "args": ["<validated arguments>"]
}
```

A narrow pregame command may use a different envelope, but it **still** requires correlation, validation and replay-safe transitions when it changes server state. Never allow a mutating path to bypass its defined admission rules because it uses a special message name.

**Validation order:**

1. Parse bounded message; validate schema and compatibility.
2. Resolve and authenticate the connection's room, match and active socket owner.
3. Validate seat/role, current stage, actor/decision owner and allowed action type.
4. Require a valid `clientActionId` before any mutation. Missing/invalid ID means **reject, zero state change**. Return a typed error and current safe snapshot even if the request ID itself is invalid.
5. Check the **idempotency ledger before stale-revision rejection**: an identical previously committed request can legitimately be retried after a later revision or the match has finished.
6. For a new ID, validate `expectedRevision`, current pending identity, exact physical resources and user-visible authorization.
7. Execute one serialized server-side engine transaction, normalize its result, then commit or roll back.
8. Persist the action outcome in the ledger, build a seat-specific result, and publish to the actor and other viewers.

### 5.2. Strong idempotency and ACK/revision rules

**Ledger key:** at least `(roomId, matchEpoch, authenticatedSeatOrClientId, clientActionId)`. Store a canonical **payload fingerprint**, outcome (`APPLIED` / `REJECTED`), applied revision, and enough response data to reconstruct the actor's result. Define retention as at least the permitted retry/reconnect window; if eviction can invalidate that guarantee, use a persisted receipt or an explicit reconciliation mechanism. A tiny in-memory cache is not an eternal exactly-once guarantee.

| Situation | Mandatory server behavior |
|---|---|
| Valid new intent | Apply at most once; increment revision once on an accepted state mutation; record outcome; send correlated result. |
| Duplicate ID + identical actor/payload | **Do not execute again.** Return prior `appliedRevision` and a fresh viewer-safe current snapshot. |
| Duplicate ID + different payload | Reject with `ACTION_ID_CONFLICT`, no mutation. |
| Missing/malformed ID | Reject with typed error + safe snapshot; no mutation, no silent drop. |
| New ID + stale expected revision | Reject `STALE_REVISION` with authoritative current revision/safe snapshot; no mutation. |
| Wrong seat/spectator/old socket | Reject/no-op with a typed reason; do not apply and do not expose private details. |
| ACK lost after server commit | Client retries **same ID and same payload** or queries status; server returns stored applied result, never replays gameplay. |
| Match ended between commit and retry | Previously committed ID still resolves to original result; genuinely new gameplay intents are rejected. |
| Unknown result after reconnect | Server provides authoritative receipt or enough state for safe reconciliation; client must not invent a new ID for the same action without knowing prior result. |

**Result envelope (conceptual):**

```json
{
  "type": "intent-result",
  "clientActionId": "<same request ID>",
  "ok": true,
  "code": null,
  "appliedRevision": 124,
  "currentRevision": 126,
  "snapshot": "<viewer-safe authoritative current view>"
}
```

`appliedRevision` records **where the action committed**; `currentRevision` may be higher because another valid action happened later. Never use the current revision to pretend the action was committed multiple times. Sending an ACK and the resulting snapshot together to the actor avoids an ACK/snapshot race; broadcasting separate safe views to other clients is still required.

### 5.3. Serialized room authority and atomicity

**The server has exactly one mutation lane per room** (synchronous serialization or explicit queue/lock). Do not let two socket handlers commit from the same revision concurrently.

```text
receive intent
  → authenticate and check live socket
  → check existing action receipt / fingerprint
  → validate stage, seat, pending identity and expected revision
  → take rollback-safe canonical state/continuation checkpoint
  → map acting seat to engine perspective
  → execute donor engine via PvP adapter
  → normalize adapter result to typed outcome
     → REJECTED: restore checkpoint; no revision increase
     → COMMITTED: normalize to canonical; revision +1; store receipt
     → WAITING_FOR_HUMAN: persist the new pending + parent continuation once
     → MATCH_COMPLETE: commit terminal canonical outcome once
  → build separate safe views and send correlated result
```

- An engine exception may not publish partial damage, Mana spending, Hand changes, private reveals or turn advance. Restore the entire canonical transaction checkpoint and pending context.
- A multi-message gameplay sequence has **one atomic step per accepted final intent**, with a saved pending/continuation between steps. Do not replay earlier costs/damage on the next intent; do not require an entire interrupted multi-step sequence to roll back after an unrelated later user choice.
- If a command makes a visible no-change decision permitted by the rules, return a committed/successful typed result as designed; do not confuse “no new pending work” with “illegal.”
- A rejected or forged decision must leave the canonical state, revision, pending owner and public event ledger unchanged.
- Maintain correct physical card and Mana instance identity even with duplicate printed card IDs.

### 5.4. Engine continuation semantics — distinct from network ACK

**A helper return value is not the transport outcome.** The adapter must normalize donor behavior to these meanings:

| Adapter outcome | Meaning | Host action |
|---|---|---|
| `REJECTED` | Action/choice invalid; no completed transaction | Roll back, typed rejection, unchanged revision. |
| `COMMITTED` | Legal action resolved; no further pending choice | Commit once, ACK, publish safe views. |
| `CONTINUE_SERVER` | More deterministic engine-only work remains | Continue under server control within the correct transaction/continuation context. |
| `WAITING_FOR_HUMAN` | A precise human-owned decision is required | Persist pending identity/owner/context; publish legal safe options. |
| `MATCH_COMPLETE` | Legal resolution reached a terminal outcome | Commit end state, emit result once and stop further new gameplay. |

**Never treat an engine helper's `false`, `null` or empty pending indicator as rejection by itself.** It may mean **no further continuation** after a legal action. Inspect the known precondition, canonical post-state, expected removed/paid physical resources, pending ownership and adapter result. Conversely, never treat every `false` as success: illegal or ambiguous return values must remain rejected until explicitly mapped and tested.

Specific invariants: an Attack that triggers a later Mana Burn/Steal selection must resume that Attack exactly once, deduct the selected physical Shards exactly once, clear pending, publish result and accept the next legal action. The same standard applies to Response, Counter, Search, Return, Swap, Status choice, Rank, Legacy, Draw and End Phase continuations.

### 5.5. Pending decision lifecycle

```text
server engine opens pendingId P, owned by seat S, at revision R
 → authorized projection exposes P's safe choices ONLY to owner S
 → browser toggles/highlights local draft; canonical state unchanged
 → owner submits ONE final intent with pendingId P and expectedRevision
 → server verifies S + P + R + legal domain + physical identity
 → engine resolves true canonical resources and continuation
 → server commits, ACKs, publishes next pending or no pending
```

- `pendingId` must be unique within the match epoch or otherwise unambiguously tied to its active continuation. Old handles expire when a different pending is opened.
- Verify **every** decision's true owner; donor-internal `PLAYER`/`AI` labels are view orientation, not authentication.
- For concealed cards, use server-issued opaque handles or authorized safe indices bound to the pending/revision/seat. Resolve them against server-only physical deck/Hand/Mana state.
- Do not send the real hidden deck merely to make the donor browser-side validator accept a choice. A masked client may stage selections visually, but only the server performs the true validation.
- A user cannot advance phase, end turn, PASS for the other seat or select a new action while a mandatory pending choice is unresolved.
- CANCEL/SKIP are accepted only if that exact pending type and donor rules permit them. An optional SKIP is an actual authoritative intent, not merely closing a popup.
- Timeout/reconnect must re-present the exact remaining decision to its owner, not silently create a fresh selection or repeat the parent effect.

### 5.6. Response, Counter and nested chains

- Response ownership is determined from the **canonical attack/response state**, not the local turn label, button brightness or browser perspective.
- Only the responding seat can submit PASS/Defense/Reaction/Counter. PASS must be usable immediately when legal, visually enabled, and accepted only by the authoritative server.
- On a multi-target Attack, handle each target's legal Response in donor-defined order; a negated target does not automatically negate unrelated targets.
- Preserve source Hero, target position, optional effects, original action and resource payment when entering nested decisions.
- Unwind nested chains once and in order. The client may show effects, but must not invoke follow-up resolution from animation callbacks.
- For every Response closure, assert that both clients agree on current owner, pending ID, revision, HP/Mana, Status and next legal action.

---

## 6. Client state machine and liveness: never leave a player stuck

### 6.1. Required UI/network state machine

```text
DISCONNECTED → CONNECTING → SYNCING → READY
                                  │        │
                                  │        ├─ local selection (UI only; no socket)
                                  │        └─ submit final intent → AWAITING_RESULT
                                  │                                    │
                                  │                correlated ACK/reject + safe snapshot
                                  │                                    │
                                  └────────────────────────────────── READY

Any state → network error/timeout → RECOVERING → reconnect → SYNCING
Any state → incompatible build/auth → EXPLICIT_RECOVERABLE_ERROR
Any state → authoritative terminal match → FINISHED
```

- The client must retain `clientActionId`, exact sent payload, pending identity and expected revision while an action is unresolved. Disable additional conflicting submits while awaiting the result; **do not** permanently disable the UI.
- A delayed ACK is matched by ID and match epoch. Never clear a different in-flight action because any arbitrary snapshot or unrelated error arrived.
- A retry must reuse the **same** action ID/payload. Generating a new ID for an uncertain action risks duplicate damage, cost or turn advancement.
- A timed-out response enters **RECOVERING**: request status/resync and reconcile prior action receipt before enabling conflicting new inputs. Do not repeatedly auto-submit indefinitely.
- Apply snapshots monotonically per match epoch. A late snapshot cannot overwrite a newer revision or revive a finished/cleared pending decision.
- A stale snapshot and a lost ACK must not leave local selection highlights active against a different pending ID. Preserve only drafts matching the current authorized pending identity and safe domain.
- On a true rejection, show a reason and current safe state, clear or revise only the rejected draft, and enable the next appropriate action.
- On safe recovery, show an explicit connection state; no permanent full-screen “loading” overlay without a timeout, exit or retry path.

### 6.2. Independent liveness watches

Different clocks have different meanings. Define and test them separately:

| Clock | Reset when | What expiry means |
|---|---|---|
| Socket heartbeat | Ping/pong or connection activity | Connection may be dead; close/resynchronize safely. |
| Client ACK wait | Correlated terminal action result arrives | Investigate lost result; reconcile, **do not auto-replay as new action**. |
| Active decision progress | Authorized owner commits a game decision or does permitted activity | Decision owner may be idle; apply documented policy only to that owner. |
| Disconnect grace | Authenticated seat reconnects | Resume same seat or apply documented abandonment policy. |
| Coin/opening stage | Required stage resolution/acknowledgements | Use bounded recovery/grace; never wait for animation forever. |
| Postmatch cleanup | Result is terminal and retention window ends | Clean state without discarding needed retry receipts prematurely. |

**Never time out the waiting opponent for the acting player's inactivity.** Avoid countdown resets from spectators, reconnect ping storms or cosmetic animation messages. Timers must be scoped to room, match epoch and expected stage so an old callback cannot mutate a new match.

### 6.3. Reconnect procedure (normative)

1. Create a new socket with existing per-tab identity and server-issued seat credential.
2. Server authenticates it and atomically replaces the previous active socket generation; stale message handlers lose mutation permission immediately.
3. Server returns the actual match epoch, stage, revision, pending owner and the connecting viewer's **fresh private-safe snapshot**.
4. Client matches outstanding action IDs with receipts/authoritative state; only then finalizes old pending UI.
5. Client restores controls based on **server-side decision ownership**, not its pre-disconnect guess.
6. Repeated old packets, duplicate reconnects, out-of-order snapshots, interrupted Response and payment must not change state twice.
7. If the server restarted and lost an in-memory match, announce the lost session with a clear recovery path. Do not pretend the match is still playable from stale browser state.

---

## 7. Privacy, spectator and information-release contract

**Enforce privacy before serialization**, on the server. Use an independent projection for each Seat 1, Seat 2 and spectator. Reconnection, ACK, action errors, debug endpoints, logs and battle history must use the same privacy policy.

| Information | Own seat | Opponent seat | Spectator |
|---|---|---|---|
| Own revealed Hand identities | As rules permit | Hidden unless made public by rule | Only permitted public information |
| Hidden Main Deck identity/order | Hidden unless rule reveals | Hidden | Hidden |
| Blind opponent Mana Shards | Safe choices/opaque handles as permitted, **not** true hidden identity | Viewer-safe only | Hidden |
| Pending choice legal details | Decision owner sees authorized options | Only public pending type/progress | Public status only |
| Public Card Played, committed Search/Return | Revealed exactly when rule permits | Same public committed event | Same public committed event |
| Private Draw / private inspection | Only entitled seat | Hidden | Hidden |

- Do not reveal private data by embedding it invisibly in the DOM, CSS, source attributes, thumbnail prefetch URLs, client logs or WebSocket payloads.
- A public artwork catalog may contain every image; **which card is in a hidden zone** remains private. Never select/fetch an opponent hidden card image from private IDs unavailable in the projection.
- Client cannot supply arbitrary hidden resource IDs, raw deck indexes or physical order to probe the engine. Pending handles bind to the authorized decision scope.
- Sanitize import data, displayed names, history and error messages. Diagnostic traces must avoid tokens, private card identities and raw serialized canonical state.
- Replay, surrender and match cleanup must not leave stale private snapshots accessible to a new occupant of the seat.

---

---

## 11. Mandatory regression matrix: prove no more stuck gameplay

**For every significant gameplay or network patch**, test both seats, normal and adversarial timing, both deployment modes, and the real browser UI. Automated unit tests are necessary but **not sufficient**.

| ID | Requirement | Minimum acceptance evidence |
|---|---|---|
| NET-01 | Connect/host/join/seat ownership | Two distinct browser sessions acquire correct seats; spectator cannot act. |
| NET-02 | Ready/deck/formation | Valid and invalid imports; normalized server confirmation; no stale Ready. |
| NET-03 | Coin/opening stages | First-player selection, both acknowledgements, delayed/missing presentation ACK, correct opening privacy. |
| NET-04 | Basic actions and turn progression | Both seats play/pay/advance turns; no duplicate action or stuck phase. |
| NET-05 | Response PASS/Defense/Reaction/Counter | Both seats, initiator/defender roles swapped, nested Response, no invisible/unusable PASS. |
| NET-06 | Direct Mana Burn/Steal | Select physical face-down choices, confirm, ACK, true Mana change and next legal action for each seat. |
| NET-07 | Attack-follow-up Mana Burn/Steal | Same as above **after Attack/Response**, no invalid terminal-continuation rejection. |
| NET-08 | Exact Mana payment | Multiple identical/value-different Shards, color matching, response payment and return order. |
| NET-09 | Hidden Search/Discard/Return | Masked client drafts safely; server validates real deck/Hand, no false rejection or leak. |
| NET-10 | Rank/Legacy/Defeat/Revive | Costs, EXP, choices, retained statuses and both-seat perspective. |
| NET-11 | Swap/Reposition/Casting | Manual and effect-based position swaps, mandatory/optional choices, correct targets and phase controls. |
| NET-12 | End Phase/Status/trigger chains | Delayed triggers, turn auto-end, nested pending decisions, correct next actor. |
| NET-13 | Missing ID | Server rejects without canonical mutation or revision increase; actor receives typed error. |
| NET-14 | Duplicate/lost ACK | Retry identical ID returns previous commit; no duplicate payment, damage, Draw or turn advance. |
| NET-15 | Conflicting duplicate/stale revision | Reject safely with actual revision/snapshot and no partial mutation. |
| NET-16 | Reconnect/old socket | Old socket loses authority, new one reclaims same seat and pending state; no double action. |
| NET-17 | Disconnect at every boundary | Before send, after commit/before ACK, during Response/payment/coin/result; no deadlock. |
| NET-18 | Wrong actor/spectator/forged handles | Server rejects every unauthorized intent without exposing hidden identity. |
| NET-19 | Full match and replay | Real two-browser match to victory/surrender; rematch/reset and ledger epoch separation. |
| NET-20 | Slow client/backpressure | Safe disconnect/resync rather than unbounded buffer; other seat remains playable. |
| NET-21 | Liveness and timeouts | Correct active player deadline; waiting opponent not forfeited; stale timers cannot touch new match. |
| NET-22 | Privacy | Snapshots, ACK, errors, logs, spectator, history and artwork requests leak no hidden cards. |
| NET-23 | Website vs standalone routing | All UI, engine, font, art, VFX, audio, favicon and WSS references resolve in each mode. |
| NET-24 | Production native WSS | Actual host health, transport, website origin, HTTPS/WSS and two-browser communication. |
| NET-25 | Long-run stability | Extended gameplay/reconnect, repeated matches, memory and queue metrics do not grow unbounded. |

**Artwork gates** are additionally mandatory: revealed exact-card thumbnail, original failure retaining thumb, stable card instance DOM, rapid identity change, no private prefetch, current backs, cold/warm cache, and both standalone/Website asset parity.

**Special acceptance rule:** For every pending type, the test must run `choice → server commit/ACK → viewer-safe snapshot → client render → next legal action` for Seat 1 and Seat 2. A test that stops immediately after a successful engine helper does **not** prove absence of a stuck multiplayer flow.

### 11.1. Test levels and honest status

Report each level separately:

1. **SOURCE AUDITED:** hashes, change allowlist, syntax, protocol/property review.
2. **ENGINE TESTED:** deterministic donor parity and both-seat headless tests.
3. **TRANSPORT TESTED:** real two-client WebSocket + spectator against local authority.
4. **BROWSER TESTED:** actual two independent browsers, including mobile layout/controls as applicable.
5. **PRODUCTION TESTED:** actual deployed native WSS and complete match with reconnect.

Use `PASS`, `FAIL` or `NOT TESTED` for each required gate. **Never turn a timeout, skipped test, archival fixture failure or unverified Northflank connection into PASS**. Release can be marked *Stable* only when all critical security, action/ACK, continuation, browser and production tests pass. Otherwise label it *QA Candidate* and list blockers.

### 11.2. Traceability and no-leak observability

For each accepted/rejected action, structured server logs should expose only nonsecret IDs and phase metadata:

`roomId, matchEpoch, seat, activeSocketGeneration, actionId, expectedRevision, appliedRevision, pendingType, pendingIdHash, outcomeKind, executionMs, queueMs, wsBufferedBytes, correlationId`.

Never log raw seat tokens, unmasked Hands/decks, blind Mana UIDs, full uploaded deck data or canonical state. Maintain counters for rejected stale action, duplicate replay, timeouts, reconnects, unresolved pending age, slow clients, image fallback and memory high-water mark. Inspect trends during soak tests; no telemetry may itself cause a hidden-information leak.

---

---

## Completion requirement

A passing unit test is not proof of a production WebSocket match. A release may be called **Stable** only when native WSS, two independent live browser clients, reconnect, both-seat decisions and privacy have been verified. All untested items must be identified as NOT TESTED.
