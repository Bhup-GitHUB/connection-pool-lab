import { backends, type BackendConfig } from "./config";

type RunningBackend = {
  config: BackendConfig;
  server: ReturnType<typeof Bun.serve>;
};

export function startBackends(): RunningBackend[] {
  return backends.map((config) => ({
    config,
    server: Bun.serve({
      hostname: "127.0.0.1",
      port: config.port,
      fetch: async (request) => {
        const url = new URL(request.url);

        if (url.pathname !== "/work") {
          return new Response("Not found", { status: 404 });
        }

        const startedAt = performance.now();
        await Bun.sleep(config.delayMs);

        return Response.json({
          backend: config.name,
          durationMs: Math.round(performance.now() - startedAt),
        });
      },
    }),
  }));
}

export function stopBackends(runningBackends: RunningBackend[]) {
  for (const backend of runningBackends) {
    backend.server.stop(true);
  }
}
