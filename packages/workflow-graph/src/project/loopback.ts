import type { Workflow } from "@cyoda/workflow-core";

/**
 * Compute loopback set for a workflow per spec §10.2.6.
 *
 * Approach: BFS spanning tree rooted at initialState. Any outgoing transition
 * whose target has already been discovered at the time we attempt to visit it
 * is a back-edge → loopback. Self-transitions are always loopback.
 *
 * The returned set contains keys of the form `${fromState}::${transitionIndex}`
 * so parallel transitions between the same pair are each classified
 * independently.
 */
export function computeLoopbackSet(wf: Workflow): Set<string> {
  const loopbacks = new Set<string>();
  if (!(wf.initialState in wf.states)) return loopbacks;

  const discovered = new Set<string>([wf.initialState]);
  const queue: string[] = [wf.initialState];

  while (queue.length > 0) {
    const from = queue.shift()!;
    const state = wf.states[from];
    if (!state) continue;
    state.transitions.forEach((t, idx) => {
      const key = `${from}::${idx}`;
      if (t.next === from) {
        loopbacks.add(key);
        return;
      }
      if (discovered.has(t.next)) {
        loopbacks.add(key);
      } else {
        discovered.add(t.next);
        queue.push(t.next);
      }
    });
  }
  return loopbacks;
}
