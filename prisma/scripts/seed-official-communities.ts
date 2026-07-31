import { PrismaClient } from "@prisma/client";

import { seedOfficialCommunities } from "./seed-official-communities.shared";

const db = new PrismaClient();

async function main() {
  const result = await seedOfficialCommunities(db);
  for (const slug of result.communities) {
    console.log(`OK  ${slug}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
