/**
 * 4-Way Block Set Associative Cache Simulator
 * Supports LRU and MRU replacement policies, load-through and non-load-through read policies.
 */

const TIMING = {
  CACHE_HIT_TIME: 1,
  MEMORY_BLOCK_TIME: 10,
  WORD_TRANSFER_TIME: 1,
};

export class CacheSlot {
  constructor() {
    this.valid = false;
    this.tag = -1;
    this.blockIndex = -1;
    this.lastUsed = 0;
  }

  reset() {
    this.valid = false;
    this.tag = -1;
    this.blockIndex = -1;
    this.lastUsed = 0;
  }
}

export class CacheSet {
  constructor(ways) {
    this.ways = ways;
    this.slots = Array.from({ length: ways }, () => new CacheSlot());
  }

  reset() {
    this.slots.forEach((slot) => slot.reset());
  }

  findHit(tag) {
    return this.slots.findIndex((slot) => slot.valid && slot.tag === tag);
  }

  findEmpty() {
    return this.slots.findIndex((slot) => !slot.valid);
  }

  selectVictim(replacementPolicy) {
    const validSlots = this.slots.filter((s) => s.valid);
    if (validSlots.length === 0) return 0;

    if (replacementPolicy === 'LRU') {
      let minUsed = Infinity;
      let victim = 0;
      this.slots.forEach((slot, i) => {
        if (slot.valid && slot.lastUsed < minUsed) {
          minUsed = slot.lastUsed;
          victim = i;
        }
      });
      return victim;
    }

    // MRU: evict the most recently used block
    let maxUsed = -1;
    let victim = 0;
    this.slots.forEach((slot, i) => {
      if (slot.valid && slot.lastUsed > maxUsed) {
        maxUsed = slot.lastUsed;
        victim = i;
      }
    });
    return victim;
  }
}

export class CacheSimulator {
  constructor(config) {
    this.configure(config);
  }

  configure(config) {
    this.blockSize = config.blockSize;
    this.numCacheBlocks = config.numCacheBlocks;
    this.ways = config.ways || 4;
    this.replacementPolicy = config.replacementPolicy;
    this.readPolicy = config.readPolicy;
    this.memoryBlocks = config.memoryBlocks || 1024;

    if (this.numCacheBlocks % this.ways !== 0) {
      throw new Error('Number of cache blocks must be divisible by associativity (4).');
    }

    this.numSets = this.numCacheBlocks / this.ways;
    this.sets = Array.from({ length: this.numSets }, () => new CacheSet(this.ways));
    this.useCounter = 0;
    this.resetStats();
    this.trace = [];
  }

  resetStats() {
    this.stats = {
      totalAccesses: 0,
      hits: 0,
      misses: 0,
      totalTime: 0,
    };
    this.trace = [];
    this.useCounter = 0;
  }

  reset() {
    this.sets.forEach((set) => set.reset());
    this.useCounter = 0;
    this.resetStats();
  }

  getSetIndex(blockIndex) {
    return blockIndex % this.numSets;
  }

  getTag(blockIndex) {
    return Math.floor(blockIndex / this.numSets);
  }

  computeAccessTime(isHit) {
    if (isHit) {
      return TIMING.CACHE_HIT_TIME;
    }

    if (this.readPolicy === 'load-through') {
      // Miss: check cache + fetch from memory in parallel; CPU gets data from memory
      return TIMING.CACHE_HIT_TIME + TIMING.MEMORY_BLOCK_TIME + TIMING.WORD_TRANSFER_TIME;
    }

    const blockTransferTime = TIMING.MEMORY_BLOCK_TIME + this.blockSize * TIMING.WORD_TRANSFER_TIME

    // Non-load-through: miss penalty = cache check + full block fetch + cache read
    return (
      TIMING.CACHE_HIT_TIME +
      blockTransferTime +
      TIMING.CACHE_HIT_TIME
    );
  }

  access(blockIndex) {
    if (blockIndex < 0 || blockIndex >= this.memoryBlocks) {
      throw new Error(`Block index ${blockIndex} out of range [0, ${this.memoryBlocks - 1}]`);
    }

    this.useCounter++;
    this.stats.totalAccesses++;

    const setIndex = this.getSetIndex(blockIndex);
    const tag = this.getTag(blockIndex);
    const set = this.sets[setIndex];
    const hitIndex = set.findHit(tag);
    const isHit = hitIndex !== -1;

    let action;
    let evictedBlock = null;
    let slotIndex;

    if (isHit) {
      this.stats.hits++;
      set.slots[hitIndex].lastUsed = this.useCounter;
      slotIndex = hitIndex;
      action = 'HIT';
    } else {
      this.stats.misses++;
      const emptyIndex = set.findEmpty();

      if (emptyIndex !== -1) {
        slotIndex = emptyIndex;
        action = 'MISS (fill empty)';
      } else {
        slotIndex = set.selectVictim(this.replacementPolicy);
        const victim = set.slots[slotIndex];
        evictedBlock = victim.blockIndex;
        action = `MISS (evict block ${evictedBlock} via ${this.replacementPolicy})`;
      }

      set.slots[slotIndex].valid = true;
      set.slots[slotIndex].tag = tag;
      set.slots[slotIndex].blockIndex = blockIndex;
      set.slots[slotIndex].lastUsed = this.useCounter;
    }

    const accessTime = this.computeAccessTime(isHit);
    this.stats.totalTime += accessTime;

    const snapshot = this.getSnapshot();

    this.trace.push({
      step: this.stats.totalAccesses,
      blockIndex,
      setIndex,
      tag,
      slotIndex,
      isHit,
      action,
      evictedBlock,
      accessTime,
      cumulativeTime: this.stats.totalTime,
      snapshot: structuredClone(snapshot),
    });

    return this.trace[this.trace.length - 1];
  }

  runSequence(blockIndices) {
    this.reset();
    return blockIndices.map((blockIndex) => this.access(blockIndex));
  }

  getSnapshot() {
    return {
      numSets: this.numSets,
      ways: this.ways,
      sets: this.sets.map((set, setIndex) => ({
        setIndex,
        slots: set.slots.map((slot, wayIndex) => ({
          wayIndex,
          valid: slot.valid,
          tag: slot.tag,
          blockIndex: slot.blockIndex,
          lastUsed: slot.lastUsed,
        })),
      })),
    };
  }

  getStatistics() {
    const { totalAccesses, hits, misses, totalTime } = this.stats;
    const hitRate = totalAccesses > 0 ? hits / totalAccesses : 0;
    const missRate = totalAccesses > 0 ? misses / totalAccesses : 0;
    const amat = totalAccesses > 0 ? totalTime / totalAccesses : 0;

    return {
      totalAccesses,
      hits,
      misses,
      hitRate,
      missRate,
      amat,
      totalTime,
    };
  }
}

export function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

export function validateConfig(config) {
  const errors = [];

  if (!isPowerOfTwo(config.blockSize) || config.blockSize < 2) {
    errors.push('Block size must be a power of 2 and at least 2 words.');
  }
  if (!isPowerOfTwo(config.numCacheBlocks) || config.numCacheBlocks < 4) {
    errors.push('Number of cache blocks must be a power of 2 and at least 4.');
  }
  if (config.numCacheBlocks % 4 !== 0) {
    errors.push('Number of cache blocks must be divisible by 4 (4-way associativity).');
  }
  if (!['LRU', 'MRU'].includes(config.replacementPolicy)) {
    errors.push('Replacement policy must be LRU or MRU.');
  }
  if (!['load-through', 'non-load-through'].includes(config.readPolicy)) {
    errors.push('Read policy must be load-through or non-load-through.');
  }

  return errors;
}
