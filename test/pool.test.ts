import { describe, expect, test } from "bun:test";
import { backends } from "../src/config";
import { ConnectionPool } from "../src/pool";

function returnInCompletionOrder(pool: ConnectionPool) {
  const connections = [pool.borrow(), pool.borrow(), pool.borrow()];

  pool.release(connections.find((connection) => connection.backend === "A")!);
  pool.release(connections.find((connection) => connection.backend === "B")!);
  pool.release(connections.find((connection) => connection.backend === "C")!);
}

describe("ConnectionPool", () => {
  test("LIFO keeps selecting the most recently returned connection", () => {
    const pool = new ConnectionPool("lifo", backends);
    returnInCompletionOrder(pool);

    const selection = Array.from({ length: 4 }, () => {
      const connection = pool.borrow();
      pool.release(connection);
      return connection.backend;
    });

    expect(selection).toEqual(["C", "C", "C", "C"]);
  });

  test("FIFO rotates through connections in idle order", () => {
    const pool = new ConnectionPool("fifo", backends);
    returnInCompletionOrder(pool);

    const selection = Array.from({ length: 4 }, () => {
      const connection = pool.borrow();
      pool.release(connection);
      return connection.backend;
    });

    expect(selection).toEqual(["A", "B", "C", "A"]);
  });
});
