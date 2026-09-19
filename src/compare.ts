import { runExperiment } from "./experiment";

await runExperiment("lifo");
console.log("\n----------------------------------------\n");
await runExperiment("fifo");
