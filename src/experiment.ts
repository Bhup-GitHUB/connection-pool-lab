import { startBackends, stopBackends } from "./backends";
import { backends, followUpRequests, type BackendName } from "./config";
import { ConnectionPool, type Policy, type PoolConnection } from "./pool";

type RequestResult = {
  backend: BackendName;
  latencyMs: number;
};

function percentile(latencies: number[], value: number) {
  const sorted = [...latencies].sort((left, right) => left - right);
  const index = Math.ceil((value / 100) * sorted.length) - 1;
  return sorted[index];
}

async function sendRequest(pool: ConnectionPool, connection?: PoolConnection): Promise<RequestResult> {
  const selectedConnection = connection ?? pool.borrow();
  const startedAt = performance.now();

  try {
    const response = await fetch(selectedConnection.url);

    if (!response.ok) {
      throw new Error(`Backend ${selectedConnection.backend} returned ${response.status}`);
    }

    const body = (await response.json()) as { backend: BackendName };

    return {
      backend: body.backend,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    pool.release(selectedConnection);
  }
}

function printSummary(policy: Policy, results: RequestResult[], selection: BackendName[]) {
  const counts = new Map<BackendName, number>(backends.map((backend) => [backend.name, 0]));

  for (const result of results) {
    counts.set(result.backend, (counts.get(result.backend) ?? 0) + 1);
  }

  const latencies = results.map((result) => result.latencyMs);
  const average = latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;

  console.log(`\n${policy.toUpperCase()} summary`);
  console.log(`selection: ${selection.join(" ")}`);
  console.log(`total requests: ${results.length}`);
  console.log(`requests handled by A: ${counts.get("A")}`);
  console.log(`requests handled by B: ${counts.get("B")}`);
  console.log(`requests handled by C: ${counts.get("C")}`);
  console.log(`average latency: ${average.toFixed(1)}ms`);
  console.log(`p50 latency: ${percentile(latencies, 50)}ms`);
  console.log(`p95 latency: ${percentile(latencies, 95)}ms`);
  console.log(`p99 latency: ${percentile(latencies, 99)}ms`);
}

export async function runExperiment(policy: Policy) {
  const runningBackends = startBackends();
  const pool = new ConnectionPool(policy, backends);

  try {
    const warmUp = await Promise.all([
      sendRequest(pool),
      sendRequest(pool),
      sendRequest(pool),
    ]);
    const warmUpOrder = [...warmUp].sort((left, right) => left.latencyMs - right.latencyMs);
    const results = [...warmUp];
    const selection: BackendName[] = [];

    console.log(`${policy.toUpperCase()} warm-up completion: ${warmUpOrder.map((result) => result.backend).join(" ")}`);

    for (let request = 1; request <= followUpRequests; request += 1) {
      const result = await sendRequest(pool);
      selection.push(result.backend);
      results.push(result);
      console.log(`request=${request} backend=${result.backend} latency=${result.latencyMs}ms policy=${policy}`);
    }

    printSummary(policy, results, selection);
  } finally {
    stopBackends(runningBackends);
  }
}

function readPolicy(): Policy {
  const policy = process.argv.find((argument) => argument.startsWith("--policy="))?.split("=")[1];

  if (policy === "lifo" || policy === "fifo") {
    return policy;
  }

  throw new Error("Use --policy=lifo or --policy=fifo");
}

if (import.meta.main) {
  await runExperiment(readPolicy());
}
