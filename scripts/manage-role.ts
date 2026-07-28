import { UserRole } from "@prisma/client";

import { db } from "../lib/db/client";

const [targetEmail, requestedRole, ...reasonParts] = process.argv.slice(2);
const reason = reasonParts.filter((part) => part !== "--confirm").join(" ").trim();
const confirmed = process.argv.includes("--confirm");
const operatorEmail = process.env.MODERATION_OPERATOR_EMAIL;

if (!operatorEmail) throw new Error("MODERATION_OPERATOR_EMAIL is required.");
if (!targetEmail || !requestedRole || !reason)
  throw new Error(
    "Usage: npm run role:manage -- <target-email> <USER|MODERATOR|ADMIN> <reason> --confirm",
  );
if (!confirmed) throw new Error("Role changes require --confirm.");
if (!Object.values(UserRole).includes(requestedRole as UserRole))
  throw new Error("Role must be USER, MODERATOR, or ADMIN.");
if (operatorEmail.toLowerCase() === targetEmail.toLowerCase())
  throw new Error("Operators cannot change their own role.");

const [operator, target] = await Promise.all([
  db.user.findUnique({ where: { email: operatorEmail } }),
  db.user.findUnique({ where: { email: targetEmail } }),
]);
if (!operator || operator.role !== "ADMIN")
  throw new Error("The named operator is not an active administrator.");
if (!target) throw new Error("Target user was not found.");

const previousRole = target.role;
await db.$transaction([
  db.user.update({
    where: { id: target.id },
    data: { role: requestedRole as UserRole },
  }),
  db.operationalJobRun.create({
    data: {
      jobKey: "role-management",
      status: "SUCCEEDED",
      finishedAt: new Date(),
      processedCount: 1,
      metadata: {
        operatorId: operator.id,
        targetId: target.id,
        previousRole,
        newRole: requestedRole,
        reason,
      },
    },
  }),
]);
console.info(
  JSON.stringify({
    ok: true,
    targetId: target.id,
    previousRole,
    newRole: requestedRole,
  }),
);
await db.$disconnect();
