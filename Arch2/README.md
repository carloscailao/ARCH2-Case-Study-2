# Cache Memory Machine

A web-based cache memory simulator implementing **4-Way Block Set Associative (BSA)** caching with configurable parameters. The system runs side-by-side comparisons of **LRU** and **MRU** replacement policies under two read policies (**Non-Load-Through** and **Load-Through**).


## System Specifications

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Cache Organization** | 4-Way Block Set Associative (BSA) | Fixed associativity |
| **Block Size** | Parameterized (2, 4, 8, 16, 32 words) | Power of 2, minimum 2 |
| **Number of Cache Blocks** | Parameterized (4, 8, 16, 32, 64) | Power of 2, minimum 4, divisible by 4 |
| **Main Memory Size** | **1024 blocks** (fixed) | Block indices 0–1023 |
| **Read Policy** | Non-Load-Through **or** Load-Through | User-selectable |
| **Replacement Policies** | LRU **vs** MRU | Compared simultaneously |

### Address Mapping (4-Way BSA)

For a memory block address `B`:

```
set_index = B mod num_sets
tag       = floor(B / num_sets)
num_sets  = num_cache_blocks / 4
```

### Replacement Policies

- **LRU (Least Recently Used):** On a cache miss with a full set, evict the block that was accessed least recently.
- **MRU (Most Recently Used):** On a cache miss with a full set, evict the block that was accessed most recently.

---

## Machine Configuration

The default configuration used for analysis in this document:

| Setting | Default Value |
|---------|---------------|
| Block Size | 8 words |
| Cache Blocks | 16 (4 sets × 4 ways) |
| Main Memory | 1024 blocks |
| Associativity | 4-way |
| Read Policy | Non-Load-Through (also tested: Load-Through) |

---

## How to Run

### Web Simulator (Recommended)

1. Open a terminal in the project directory.
2. Start a local HTTP server (required for ES module imports):

```bash
npm start
# or: npx serve .
```

3. Open `http://localhost:3000` (or the port shown) in your browser.
4. Select a **test case**, configure parameters, then click **Run Both Policies**.

### Command-Line Analysis

Generate numerical results for all test cases:

```bash
npm run analyze
```

---

## Test Cases

Let **n** = total number of cache blocks.

### a. Sequential Sequence

Access blocks `0` through `2n − 1`, then repeat the entire sequence.

**Example** (n = 4):  
`0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7`  
(32 accesses for n = 16)

### b. Mid-Repeat Blocks

1. Access blocks `0` to `n − 1`
2. Repeat blocks `0` to `2n − 1` **twice**
3. Reverse blocks `n − 1` down to `0`
4. Reverse blocks `2n − 1` down to `0` **twice**

**Example** (n = 4):  
`0,1,2,3, 0,1,2,3,4,5,6,7, 0,1,2,3,4,5,6,7, 3,2,1,0, 7,6,5,4,3,2,1,0, 7,6,5,4,3,2,1,0`

### c. Random Sequence

64 random block accesses with indices uniformly distributed in `[0, 1023]`.  
Uses seed `42` for reproducibility.

---


## Analysis & Results

All results below use the default configuration: **16 cache blocks**, **8-word blocks**, **4 sets × 4 ways**, **1024 main memory blocks**.

### Test Case A — Sequential Sequence (64 accesses)

**Access pattern:** Blocks 0–31, repeated twice. Each set receives 8 distinct tags per pass (tags 0–7), but only 4 ways are available, causing continuous evictions in a streaming pattern.

| Metric | LRU | MRU |
|--------|-----|-----|
| Hits | 0 | 16 |
| Misses | 64 | 48 |
| Hit Rate | 0.0% | 25.0% |
| Miss Rate | 100.0% | 75.0% |
| AMAT (non-load-through) | 12.00 | 9.25 |
| Total Time (non-load-through) | 768 | 592 |

**Analysis:**

- **LRU performs poorly** on pure sequential scans. As the simulator streams through blocks 0, 4, 8, 12, 16, 20, 24, 28 (all mapping to set 0), LRU evicts the oldest entries. When the second pass revisits block 0, it was evicted long ago → **0% hit rate**.
- **MRU performs better** because evicting the *most recently used* block preserves older entries. On the second pass through blocks 0–15, several blocks remain cached from the first pass, yielding **25% hit rate**.
- **Conclusion:** For sequential/streaming workloads that exceed cache capacity per set, **MRU outperforms LRU**.

---

### Test Case B — Mid-Repeat Blocks (160 accesses)

**Access pattern:** Partial warm-up (0–15), two full passes (0–31), then reversed sequences. This creates strong temporal locality with repeated sub-sequences.

| Metric | LRU | MRU |
|--------|-----|-----|
| Hits | 16 | 68 |
| Misses | 144 | 92 |
| Hit Rate | 10.0% | 42.5% |
| Miss Rate | 90.0% | 57.5% |
| AMAT (non-load-through) | 10.90 | 7.33 |
| Total Time (non-load-through) | 1,744 | 1,172 |

**Analysis:**

- This test case is designed to expose replacement policy differences under **repeated and reversed access patterns**.
- **MRU dominates** with 68 hits vs. LRU's 16. The mid-repeat structure re-accesses blocks 0–15 early, then repeats larger patterns. MRU's tendency to keep older blocks aligns well with the repeated sub-sequences.
- **LRU evicts blocks** that will be needed again soon when the reverse pass (`15, 14, …, 0`) occurs, because recent forward-scanned blocks occupy all ways.
- **AMAT improvement:** MRU reduces average access time by ~33% (10.90 → 7.33 cycles) compared to LRU.
- **Conclusion:** Workloads with **repeated working sets** and **reverse scans** strongly favor MRU in this 4-way BSA configuration.

---

### Test Case C — Random Sequence (64 accesses)

**Access pattern:** 64 uniformly random block indices in [0, 1023] (seed = 42).

| Metric | LRU | MRU |
|--------|-----|-----|
| Hits | 1 | 1 |
| Misses | 63 | 63 |
| Hit Rate | 1.56% | 1.56% |
| Miss Rate | 98.44% | 98.44% |
| AMAT (non-load-through) | 11.83 | 11.83 |
| Total Time (non-load-through) | 757 | 757 |

**Analysis:**

- With 1024 memory blocks mapped to only 4 sets (16 cache blocks), random access has **very low locality**. The probability of re-accessing a block still resident in cache is extremely small.
- **LRU and MRU perform identically** — both achieve only 1 hit in 64 accesses. Replacement policy has negligible impact when accesses are uniformly random across a large address space.
- **Conclusion:** For random/uniform workloads, **replacement policy choice does not matter**; cache size and associativity dominate performance.

---

## Policy Comparison Summary

### LRU vs. MRU (Non-Load-Through)

| Test Case | Winner | Key Reason |
|-----------|--------|------------|
| Sequential | **MRU** | Streaming evictions favor keeping older blocks for second pass |
| Mid-Repeat | **MRU** | Repeated sub-sequences match MRU's retention of older entries |
| Random | **Tie** | No locality; both policies equivalent |

### Non-Load-Through vs. Load-Through

| Test Case | LRU AMAT (NL/T / LT) | MRU AMAT (NL/T / LT) |
|-----------|----------------------|----------------------|
| Sequential | 12.00 / 11.00 | 9.25 / 8.50 |
| Mid-Repeat | 10.90 / 10.00 | 7.33 / 6.75 |
| Random | 11.83 / 10.84 | 11.83 / 10.84 |

**Analysis:**

- **Load-Through reduces AMAT by 1 cycle per miss** (11 vs. 12 cycles) because the CPU receives data directly from memory without waiting for a second cache read.
- The **relative ranking** of LRU vs. MRU is unchanged between read policies — only absolute times shift.
- **Non-Load-Through** is simpler to implement but adds one extra cycle per miss.
- **Load-Through** is preferred when miss latency dominates and parallel memory-to-CPU paths exist.

### Overall Recommendations

| Workload Type | Recommended Policy | Recommended Read Policy |
|---------------|-------------------|------------------------|
| Sequential scan | MRU | Load-Through |
| Repeated/reverse patterns | MRU | Load-Through |
| Random/uniform access | Either (no difference) | Load-Through |
| General-purpose | LRU (industry standard) | Depends on hardware |

> **Note:** While MRU wins on structured test patterns in this simulation, **LRU remains the industry default** because real workloads typically exhibit recency-based locality (loops, stacks, recent data structures) where LRU excels. MRU is specialized for specific access patterns like sequential scans through data larger than cache.
