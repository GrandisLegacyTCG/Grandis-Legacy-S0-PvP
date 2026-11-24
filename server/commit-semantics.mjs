/**
 * PvP-only adapter for the VS AI donor's return-value convention.
 * A completed post-Attack Mana interaction can return false to mean
 * "there is no further optional choice" AFTER its effect committed.
 * Do not modify the donor engine or convert arbitrary false results to success.
 */
export function isCompletedOpponentManaContinuation({pending, before, after, error}) {
  if (error !== 'Runtime action was not legal or no pending choice accepted: commitOpponentManaSelection') return false;
  if (!pending || pending.type !== 'opponent_mana_selection' || pending.decision_side !== 'PLAYER' ||
      !pending.continuation?.action || !before || !after ||
      before.pending?.type !== 'opponent_mana_selection' || after.pending != null) return false;
  const side = pending.target_side;
  if (side !== 'PLAYER' && side !== 'AI') return false;
  const poolKey = side === 'AI' ? 'aiManaPoolCards' : 'playerManaPoolCards';
  const source = before[poolKey], destination = after[poolKey];
  if (!Array.isArray(source) || !Array.isArray(destination)) return false;
  const count = Math.min(Number(pending.required_count || 1), pending.candidates?.length || 0);
  const selected = pending.selected_indices;
  if (!Number.isInteger(count) || count < 1 || count > 12 ||
      !Array.isArray(selected) || selected.length !== count || new Set(selected).size !== count) return false;
  const chosen = [];
  for (const idx of selected) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= pending.candidates.length) return false;
    const uid = pending.candidates[idx]?.uid;
    if (typeof uid !== 'string' || !uid || chosen.includes(uid)) return false;
    chosen.push(uid);
  }
  const previousUids = source.map(x => x?.uid);
  const nextUids = destination.map(x => x?.uid);
  if (previousUids.some(x => typeof x !== 'string' || !x) ||
      nextUids.some(x => typeof x !== 'string' || !x) ||
      new Set(previousUids).size !== previousUids.length ||
      new Set(nextUids).size !== nextUids.length ||
      previousUids.length - nextUids.length !== count) return false;
  // Prove that EXACTLY the chosen physical Shards left the opponent's pool.
  if (!chosen.every(uid => previousUids.includes(uid) && !nextUids.includes(uid))) return false;
  if (!nextUids.every(uid => previousUids.includes(uid) && !chosen.includes(uid))) return false;
  return true;
}
