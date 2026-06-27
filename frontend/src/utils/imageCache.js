/**
 * ImageCacheManager — Priority-aware browser image prefetch controller.
 *
 * Problems solved vs. raw `new Image()` calls:
 *   - Limits concurrent downloads to `maxConcurrent` (default 4)
 *   - Skips players already loaded or in-flight
 *   - Priority-upgrades in-flight items when a higher-priority round enqueues them
 *   - Cancels lower-priority downloads when a new current-round arrives
 *   - Clean reset on game end
 *
 * Priority levels (lower number = served first):
 *   PRIORITY.CURRENT  = 0   Visible cards this round
 *   PRIORITY.NEXT     = 1   Next round (r1 prefetch)
 *   PRIORITY.PREFETCH = 2   Round after next (r2 prefetch)
 */

export const PRIORITY = Object.freeze({
  CURRENT:  0,
  NEXT:     1,
  PREFETCH: 2,
});

/** Builds the primary SoFIFA CDN portrait URL for a player ID. */
function buildUrl(playerId) {
  const idStr = String(playerId).padStart(6, '0');
  return `https://cdn.sofifa.net/players/${idStr.slice(0, 3)}/${idStr.slice(3, 6)}/23_120.png`;
}

class ImageCacheManager {
  /** Set of player IDs whose primary portrait has been successfully cached. */
  loaded = new Set();

  /**
   * Pending download queue, sorted ascending by priority (0 = most urgent).
   * Each entry: { id: number, url: string, priority: number }
   */
  queue = [];

  /** Maximum simultaneous Image downloads. */
  maxConcurrent = 4;

  /** Map of id -> { img: HTMLImageElement, priority: number } for in-flight downloads. */
  #inFlight = new Map();

  /** Current active download count. */
  #active = 0;

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  /**
   * Add players to the download queue.
   *
   * @param {Array<{id: number}>} players  - Player objects (must have .id)
   * @param {number}              priority - PRIORITY.CURRENT | NEXT | PREFETCH
   */
  enqueue(players = [], priority = PRIORITY.PREFETCH) {
    let needsSort = false;

    for (const player of players) {
      const id = player?.id;
      if (!id) continue;

      // ① Already in browser cache — skip entirely
      if (this.loaded.has(id)) continue;

      // ② In-flight — upgrade priority if needed (cancel + re-queue at front)
      if (this.#inFlight.has(id)) {
        const entry = this.#inFlight.get(id);
        if (entry.priority > priority) {
          // Cancel current download, reclaim the slot, re-queue at higher priority
          entry.img.src = '';        // Cancels pending network request
          this.#inFlight.delete(id);
          this.#active = Math.max(0, this.#active - 1);
          this.#pushQueue(id, priority);
          needsSort = true;
        }
        // Otherwise already at same/higher priority — leave it
        continue;
      }

      // ③ Already in queue — upgrade priority if needed
      const queued = this.queue.find(q => q.id === id);
      if (queued) {
        if (queued.priority > priority) {
          queued.priority = priority;
          needsSort = true;
        }
        continue;
      }

      // ④ New item — add to queue
      this.#pushQueue(id, priority);
      needsSort = true;
    }

    if (needsSort) {
      // Stable sort ascending by priority
      this.queue.sort((a, b) => a.priority - b.priority);
    }

    this.#drain();
  }

  /**
   * Cancel all in-flight and queued items at or below `minPriority`.
   * Call before enqueuing a new current round to immediately free slots.
   *
   * Example:
   *   imageCache.cancelBelow(PRIORITY.NEXT);   // cancel NEXT and PREFETCH
   *   imageCache.enqueue(currentPlayers, PRIORITY.CURRENT);
   *
   * @param {number} minPriority - Items with priority >= minPriority are cancelled
   */
  cancelBelow(minPriority) {
    // Cancel active downloads at lower priority
    for (const [id, entry] of this.#inFlight) {
      if (entry.priority >= minPriority) {
        entry.img.src = '';
        this.#inFlight.delete(id);
        this.#active = Math.max(0, this.#active - 1);
      }
    }

    // Flush queue items at lower priority
    this.queue = this.queue.filter(q => q.priority < minPriority);

    // Re-drain with freed slots
    this.#drain();
  }

  /**
   * Full reset — cancels everything and clears the loaded set.
   * Call on game reset / room exit.
   */
  reset() {
    for (const [, entry] of this.#inFlight) {
      entry.img.src = '';
    }
    this.#inFlight.clear();
    this.queue  = [];
    this.loaded.clear();
    this.#active = 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  #pushQueue(id, priority) {
    this.queue.push({ id, url: buildUrl(id), priority });
  }

  /** Pull items from the queue and start downloads up to the concurrency limit. */
  #drain() {
    while (this.#active < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();

      // Double-check — may have been loaded or cancelled while queued
      if (this.loaded.has(item.id) || this.#inFlight.has(item.id)) continue;

      this.#download(item);
    }
  }

  /** Start a single Image download and wire up lifecycle hooks. */
  #download(item) {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';

    this.#inFlight.set(item.id, { img, priority: item.priority });
    this.#active++;

    img.onload = () => {
      this.loaded.add(item.id); // Mark as successfully cached
      this.#finish(item.id);
    };

    img.onerror = () => {
      // Primary URL failed — component will handle fallbacks on actual render
      // Do NOT add to loaded; it will retry naturally
      this.#finish(item.id);
    };

    // Setting src starts the download
    img.src = item.url;
  }

  #finish(id) {
    this.#inFlight.delete(id);
    this.#active = Math.max(0, this.#active - 1);
    this.#drain(); // Pick up the next queued item
  }
}

/** Singleton — shared across the entire frontend app. */
export const imageCache = new ImageCacheManager();
