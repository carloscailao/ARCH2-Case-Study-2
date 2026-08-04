/**
 * Test case sequence generators for cache simulation.
 */

export function sequentialSequence(numCacheBlocks) {
  const n = numCacheBlocks;
  const firstPass = Array.from({ length: 2 * n }, (_, i) => i);
  return [...firstPass, ...firstPass];
}

export function midRepeatSequence(numCacheBlocks) {
  const n = numCacheBlocks;
  const part1 = Array.from({ length: n }, (_, i) => i); // blocks 0..n-1
  const part2 = Array.from({ length: 2 * n }, (_, i) => i); // blocks 0..2n-1

  // Forward pattern: 0..n-1, then 0..2n-1 twice.
  const forward = [...part1, ...part2, ...part2];

  // Backward pattern: 2n-1..0, 2n-1..0, n-1..0
  const reversed = [...forward].reverse();

  return [...forward, ...reversed];
}

export function randomSequence(length = 64, memoryBlocks = 1024, seed = null) {
  const rng = seed !== null ? mulberry32(seed) : Math.random;
  return Array.from({ length }, () => Math.floor(rng() * memoryBlocks));
}

function mulberry32(seed) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TEST_CASES = {
  sequential: {
    id: 'sequential',
    name: 'Sequential',
    description: 'Access blocks 0 to 2n−1, repeated twice.',
    generate: sequentialSequence,
  },
  midRepeat: {
    id: 'midRepeat',
    name: 'Mid-Repeat Blocks',
    description: 'Partial repeat, full repeat twice, then reversed patterns.',
    generate: midRepeatSequence,
  },
  random: {
    id: 'random',
    name: 'Random',
    description: '64 random block accesses (indices 0–1023).',
    generate: (n) => randomSequence(64, 1024, 42),
  },
};

export function getTestCase(id, numCacheBlocks) {
  const testCase = TEST_CASES[id];
  if (!testCase) throw new Error(`Unknown test case: ${id}`);
  return {
    ...testCase,
    sequence: testCase.generate(numCacheBlocks),
  };
}
