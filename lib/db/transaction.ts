import type { Prisma, PrismaClient } from "@prisma/client";

export type TransactionClient = Prisma.TransactionClient;

export function inTransaction<T>(
  db: PrismaClient,
  work: (transaction: TransactionClient) => Promise<T>,
) {
  return db.$transaction((transaction) => work(transaction), {
    isolationLevel: "Serializable",
  });
}
