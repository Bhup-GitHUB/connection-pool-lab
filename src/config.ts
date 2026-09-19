export type BackendName = "A" | "B" | "C";

export type BackendConfig = {
  name: BackendName;
  port: number;
  delayMs: number;
};

export const backends: BackendConfig[] = [
  { name: "A", port: 4001, delayMs: 20 },
  { name: "B", port: 4002, delayMs: 30 },
  { name: "C", port: 4003, delayMs: 200 },
];

export const followUpRequests = 10;
