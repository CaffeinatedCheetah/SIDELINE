// One-off admin utility, run manually against a real database:
// `npx tsx prisma/scripts/promote-user-role.ts <handle-or-email> <MODERATOR|ADMIN>`
//
// Confirmed via this project's own launch-readiness audit: the UserRole
// enum (USER/MODERATOR/ADMIN) and every permission check that reads it are
// correctly implemented, but nothing anywhere in the codebase -- no UI, no
// API endpoint, no script -- ever sets a user's role to MODERATOR or ADMIN.
// The only way to grant moderator access today is an unaudited, direct
// database edit. This script makes that same action auditable (it prints
// exactly what it changed) and repeatable, without building a full
// role-management UI, which is real product/feature work out of this
// audit's "fix what's broken or incomplete" scope.
import { PrismaClient, UserRole } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [identifier, role] = process.argv.slice(2);
  if (!identifier || !role || !(role in UserRole)) {
    console.error(
      "Usage: npx tsx prisma/scripts/promote-user-role.ts <handle-or-email> <MODERATOR|ADMIN>",
    );
    process.exitCode = 1;
    return;
  }
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { normalizedHandle: identifier.toLowerCase() },
      ],
    },
    select: { id: true, handle: true, email: true, role: true },
  });
  if (!user) {
    console.error(`No user found matching "${identifier}".`);
    process.exitCode = 1;
    return;
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: { role: role as UserRole },
    select: { handle: true, email: true, role: true },
  });
  console.log(
    `@${updated.handle} (${updated.email}): ${user.role} -> ${updated.role}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
