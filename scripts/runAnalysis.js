/**
 * CLI runner to generate analysis statistics for README documentation.
 * Usage: node scripts/runAnalysis.js
 */

import { CacheSimulator } from '../js/cache.js';
import { getTestCase } from '../js/testCases.js';

const DEFAULT_CONFIG = {
  blockSize: 8,
  numCacheBlocks: 16,
  ways: 4,
  memoryBlocks: 1024,
};

function runTest(testId, readPolicy) {
  const testCase = getTestCase(testId, DEFAULT_CONFIG.numCacheBlocks);

  const lru = new CacheSimulator({
    ...DEFAULT_CONFIG,
    readPolicy,
    replacementPolicy: 'LRU',
  });
  const mru = new CacheSimulator({
    ...DEFAULT_CONFIG,
    readPolicy,
    replacementPolicy: 'MRU',
  });

  lru.runSequence(testCase.sequence);
  mru.runSequence(testCase.sequence);

  return {
    test: testCase.name,
    sequenceLength: testCase.sequence.length,
    lru: lru.getStatistics(),
    mru: mru.getStatistics(),
  };
}

function printResults(readPolicy) {
  console.log(`\n=== Read Policy: ${readPolicy} ===\n`);

  for (const testId of ['sequential', 'midRepeat', 'random']) {
    const result = runTest(testId, readPolicy);
    console.log(`--- ${result.test} (${result.sequenceLength} accesses) ---`);
    console.log('LRU:', JSON.stringify(result.lru, null, 2));
    console.log('MRU:', JSON.stringify(result.mru, null, 2));
    console.log('');
  }
}

printResults('non-load-through');
printResults('load-through');
