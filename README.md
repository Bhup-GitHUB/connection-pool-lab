# When Connection Pools Become Load Balancers

A connection pool normally sounds like a performance optimization. But when a reusable connection is already associated with a backend, choosing which connection to reuse can also influence where the next request goes.

This small experiment demonstrates how LIFO and FIFO reuse policies can produce very different traffic patterns.

This project is an educational experiment inspired by a production incident described by OpenAI. It is not a reproduction of OpenAI's infrastructure.

## Architecture

```text
                     +--> backend A (20ms)
                     |
client -> pool ------+--> backend B (30ms)
                     |
                     +--> backend C (200ms)
```

The runner starts three local Bun HTTP servers:

```text
backend A  http://127.0.0.1:4001/work
backend B  http://127.0.0.1:4002/work
backend C  http://127.0.0.1:4003/work
```

Each response identifies the backend and its measured service duration.

The pool begins with one logical connection per backend. A connection is permanently associated with its backend. Borrowing it sends an actual local HTTP request to that backend; returning it makes that same logical connection available again.

This is deliberately not a raw TCP socket pool. Bun and the underlying HTTP implementation may manage sockets independently. The explicit pool models the important educational property: backend-affine reusable connections and a visible reuse policy.

## LIFO and FIFO

The warm-up sends one concurrent request through each connection. Since A and B are quick and C is slow, they normally return to the idle pool in this order:

```text
[A, B, C]
```

LIFO borrows the most recently returned idle connection. It picks C, and when C completes it is returned as the newest idle connection again:

```text
idle: [A, B, C]
request 1 -> C
request 2 -> C
request 3 -> C
```

FIFO borrows the connection that has been idle longest. Returning each completed connection to the end rotates the traffic:

```text
idle: [A, B, C]
request 1 -> A
request 2 -> B
request 3 -> C
request 4 -> A
```

The policies are implemented directly in `src/pool.ts`: LIFO uses the end of the idle list and FIFO uses the front. There is no connection-pool library hiding the behavior.

## Run the experiment

Requirements: Bun 1.3 or newer.

```bash
bun install
bun run experiment:lifo
bun run experiment:fifo
bun run compare
```

The runner starts and stops the three backends itself. Run the tests with:

```bash
bun test
```

Backend ports and latency are centralized in `src/config.ts`. C is intentionally slow; A and B differ slightly so their warm-up completion order is easy to observe consistently.

## What to expect

Each run logs the warm-up order, every follow-up request, and a summary containing total requests, backend counts, average latency, p50, p95, and p99.

One local run produced:

```text
LIFO
selection: C C C C C C C C C C
requests handled by A: 1
requests handled by B: 1
requests handled by C: 11
average latency: 178.4ms

FIFO
selection: A B C A B C A B C A
requests handled by A: 5
requests handled by B: 4
requests handled by C: 4
average latency: 82.3ms
```

The totals include the three warm-up requests. Timing values will vary slightly by machine, but the selection pattern should remain clear.

## Limitations

Real systems can include proxies, HTTP/2 multiplexing, service meshes, per-request load balancing, health-aware routing, and many connections per backend. This project intentionally excludes those details so the scheduling effect is easy to inspect.

The point is not that LIFO is always bad or FIFO is always good. Connection reuse policy can become part of traffic distribution, and it deserves the same care as other routing decisions.
