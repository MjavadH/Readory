# Cache Management Layer Proposal

## Scope and refactor strategy

1. Create a centralized `CacheManager` to encapsulate all Redis operations.
2. Add domain cache services (`ChapterCache`, `UserAccessCache`) that own cache key semantics.
3. Move cache read/write/invalidate logic out of services (starting with `ChaptersService`) into domain cache services.
4. Keep business services agnostic of Redis internals.

## Core definitions

- `CacheManager`
  - Secure key construction with input sanitization.
  - Safe serialization/deserialization for `Decimal`, `BigInt`, and `Date`.
  - Request collapsing (`singleflight`) for concurrent cache misses.
  - Jittered TTL support.
  - Probabilistic early recomputation support.
  - Version-key APIs using atomic `INCR`.
  - Structured observability logs: hit, miss, set, invalidate, error.

- `ChapterCache`
  - List version key ownership (`chapters:list:version:{bookId}`).
  - Version bump for bulk invalidation.
  - Hashed list key generation for query payloads.

- `UserAccessCache`
  - Access key conventions for user/chapter permissions.

## Stampede protection logic

1. Resolve cache key from sanitized namespace and payload.
2. Attempt cache read.
3. On miss, call `singleflight(key)`.
4. First request executes database loader and writes cache.
5. Concurrent requests await same promise and reuse loaded value.
6. On Redis errors, bypass cache and return loader result.

## Invalidation approach

- List/search keys use version suffixes instead of wildcard deletes.
- Data mutation calls `INCR` on version key.
- Future reads compose keys with new version and naturally bypass stale entries.

## Service refactor next step

- Replace direct Redis usage in `ChaptersService` with:
  - `ChapterCache` for versioning and list key generation.
  - `CacheManager.getOrSet(...)` for list caching and miss collapse.
  - Keep service focused on Prisma queries and domain validation only.
