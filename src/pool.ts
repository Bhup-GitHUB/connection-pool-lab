import type { BackendConfig, BackendName } from "./config";

export type Policy = "lifo" | "fifo";

export type PoolConnection = {
  backend: BackendName;
  url: string;
};

export class ConnectionPool {
  private idle: PoolConnection[];

  constructor(
    private readonly policy: Policy,
    backends: BackendConfig[],
  ) {
    this.idle = backends.map((backend) => ({
      backend: backend.name,
      url: `http://127.0.0.1:${backend.port}/work`,
    }));
  }

  borrow(): PoolConnection {
    const connection = this.policy === "lifo" ? this.idle.pop() : this.idle.shift();

    if (!connection) {
      throw new Error("No idle connections available");
    }

    return connection;
  }

  release(connection: PoolConnection) {
    this.idle.push(connection);
  }

  idleBackends(): BackendName[] {
    return this.idle.map((connection) => connection.backend);
  }
}
