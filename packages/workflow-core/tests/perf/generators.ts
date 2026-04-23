import type { ImportPayload, Transition } from "../../src/index.js";

/**
 * Grid of states wired with `fanOut` outgoing transitions each, pointing at
 * the next row. Produces roughly `states * fanOut` transitions.
 */
export function generateGrid(states: number, fanOut: number): ImportPayload {
  const stateMap: Record<string, { transitions: Transition[] }> = {};
  for (let i = 0; i < states; i++) {
    const code = `s${i}`;
    const transitions: Transition[] = [];
    for (let j = 0; j < fanOut; j++) {
      const target = (i + 1 + j) % states;
      transitions.push({
        name: `t_${i}_${j}`,
        next: `s${target}`,
        manual: false,
        disabled: false,
      });
    }
    stateMap[code] = { transitions };
  }
  return {
    importMode: "MERGE",
    workflows: [
      {
        version: "1.0",
        name: "grid",
        initialState: "s0",
        active: true,
        states: stateMap,
      },
    ],
  };
}

/** Single linear chain s0 → s1 → … → s(length-1). */
export function generateChain(length: number): ImportPayload {
  const stateMap: Record<string, { transitions: Transition[] }> = {};
  for (let i = 0; i < length; i++) {
    const transitions: Transition[] =
      i < length - 1
        ? [
            {
              name: `t${i}`,
              next: `s${i + 1}`,
              manual: false,
              disabled: false,
            },
          ]
        : [];
    stateMap[`s${i}`] = { transitions };
  }
  return {
    importMode: "MERGE",
    workflows: [
      {
        version: "1.0",
        name: "chain",
        initialState: "s0",
        active: true,
        states: stateMap,
      },
    ],
  };
}

/** Chain with `loopCount` back-edges from evenly spaced states to s0. */
export function generateLoopHeavy(states: number, loopCount: number): ImportPayload {
  const payload = generateChain(states);
  const wf = payload.workflows[0]!;
  const step = Math.max(1, Math.floor(states / (loopCount + 1)));
  for (let i = 1; i <= loopCount; i++) {
    const fromCode = `s${Math.min(states - 1, i * step)}`;
    const state = wf.states[fromCode];
    if (!state) continue;
    state.transitions.push({
      name: `loop_${i}`,
      next: "s0",
      manual: false,
      disabled: false,
    });
  }
  return payload;
}
