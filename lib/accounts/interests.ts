import { z } from "zod";
import { db } from "@/lib/db/client";

export async function validInterests(sports: string[], teams: string[]) {
  if (
    !z.array(z.string().uuid()).max(10).safeParse(sports).success ||
    !z.array(z.string().uuid()).max(20).safeParse(teams).success
  )
    return false;
  const [sportCount, teamCount] = await Promise.all([
    db.sport.count({ where: { id: { in: sports }, active: true } }),
    db.team.count({ where: { id: { in: teams } } }),
  ]);
  return (
    sportCount === new Set(sports).size && teamCount === new Set(teams).size
  );
}
