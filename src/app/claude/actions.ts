"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { revokeConnection } from "@/lib/oauth";

export async function disconnect(clientId: string) {
  const user = await requireUser();
  await revokeConnection(user.id, clientId);
  revalidatePath("/claude");
}
