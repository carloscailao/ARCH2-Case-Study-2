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

The default configuration used for analysis:

| Setting | Default Value |
|---------|---------------|
| Block Size | 8 words |
| Cache Blocks | 16 (4 sets × 4 ways) |
| Main Memory | 1024 blocks |
| Associativity | 4-way |
| Read Policy | Non-Load-Through (also tested: Load-Through) |

---

## How to Run

### Web Simulator

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
| AMAT (cycles) | 20.00 | 15.25 |
| Total Time (cycles) | 1,280 | 976 |

**Analysis:**

- For this configuration, **LRU produced no cache hits during the sequential test, while MRU recorded 16 hits**. Since each set only has four ways but receives eight different blocks during each pass, blocks are continuously replaced before they can be reused
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
| AMAT (cycles) | 18.10 | 11.93 |
| Total Time (cycles) | 2,896 | 1,908 |

**Analysis:**

- **MRU recorded 68 cache hits**, compared to 16 hits for LRU. The repeated forward and reverse access pattern allows older cache entries to remain useful, which benefits MRU's replacement strategy.
- **LRU replaces blocks that are no longer the most recently used**, causing some blocks needed during the reverse sequence to be evicted before they are accessed again.
- **AMAT improvement**: MRU reduces the average memory access time from 18.10 cycles to 11.93 cycles, lowering the total memory access time from 2,896 cycles to 1,908 cycles.
- **Conclusion:** The **repeated and reverse access pattern** resulted in better performance for **MRU**.

---

### Test Case C — Random Sequence (64 accesses)
#### Test 1
**Access pattern:** 64 uniformly random block indices in [0, 1023].

| Metric | LRU | MRU |
|--------|-----|-----|
| Hits | 1 | 0 |
| Misses | 63 | 64 |
| Hit Rate | 1.6% | 0.0% |
| Miss Rate | 98.4% | 100% |
| AMAT (cycles) | 19.70 | 20.00 |
| Total Time (cycles) | 1261 | 1280 |

#### Test 2
**Access pattern:** 64 uniformly random block indices in [0, 1023].

| Metric | LRU | MRU |
|--------|-----|-----|
| Hits | 1 | 2 |
| Misses | 63 | 62 |
| Hit Rate | 1.6% | 3.1% |
| Miss Rate | 98.4% | 96.9% |
| AMAT (cycles) | 19.70 | 19.41 |
| Total Time (cycles) | 1261 | 1242 |

#### Test 3
**Access pattern:** 64 uniformly random block indices in [0, 1023].

| Metric | LRU | MRU |
|--------|-----|-----|
| Hits | 0 | 0 |
| Misses | 64 | 64 |
| Hit Rate | 0.0% | 0.0% |
| Miss Rate | 100.0% | 100.0% |
| AMAT (cycles) | 20.00 | 20.00 |
| Total Time (cycles) | 1280 | 1280 |

**Analysis:**
- All results of running the random sequence lead to results similar to the tests above.
- After 30 runs, LRU performed better 9 times, MRU performed better 8 times, and both tied 13 times. 
- With 1024 memory blocks mapped to only 4 sets (16 cache blocks), random access has **very low locality**. The probability of re-accessing a block still resident in cache is extremely small.
- **LRU and MRU perform identically**, both achieve only 1 hit in 64 accesses. Since only one cache hit occurred throughout the 64 accesses, there was almost no temporal locality to exploit. As a result, both replacement policies produced identical statistics.
- **Conclusion:** For random/uniform workloads, **replacement policy choice does not matter**, cache size and the lack of locality have a greater impact than the replacement policy.

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
| Sequential | 20.00 / 12.00 | 15.25 / 9.25 |
| Mid-Repeat | 18.10 / 10.90 | 11.93 / 7.30 |
| Random | 18.81 / 11.83 | 19.11 / 11.83 |

**Analysis:**

- **Load-Through reduces AMAT by 1 cycle per miss** (11 vs. 12 cycles) because the CPU receives data directly from memory without waiting for a second cache read.
- The **relative ranking** of LRU vs. MRU is unchanged between read policies — only absolute times shift.
- **Non-Load-Through** is simpler to implement but adds one extra cycle per miss.
- **Load-Through** is preferred when miss latency dominates, and parallel memory-to-CPU paths exist.

### Overall Recommendations

| Workload Type | Recommended Policy | Recommended Read Policy |
|---------------|-------------------|------------------------|
| Sequential scan | MRU | Load-Through |
| Repeated/reverse patterns | MRU | Load-Through |
| Random/uniform access | Either (no difference) | Load-Through |
| General-purpose | LRU  | Depends on hardware |

---
## Video Walkthrough
https://youtu.be/g6I7iwLIKbU
