import { HallPeriod } from "@prisma/client";

import { db } from "../lib/db/client";
import { runHallOfFlameJob } from "../lib/services/hall-of-flame-job";

const value = process.argv[2]?.toUpperCase() ?? "ALL_TIME";
if (!Object.values(HallPeriod).includes(value as HallPeriod)) {
  throw new Error("Use DAILY, WEEKLY, MONTHLY, or ALL_TIME.");
}

const result = await runHallOfFlameJob(db, value as HallPeriod);
console.info(JSON.stringify({ period: value, ...result }));
await db.$disconnect();
