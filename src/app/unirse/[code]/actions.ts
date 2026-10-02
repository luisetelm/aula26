"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Forbidden } from "@/lib/content";
import { claimSeat } from "@/lib/seats";

export type ClaimState = { error?: string };

export async function claimSeatAction(code: string, _prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const user = await requireUser();
  let subjectId: string;
  try {
    subjectId = (await claimSeat(user, code, String(formData.get("seat") ?? ""))).id;
  } catch (e) {
    return { error: e instanceof Forbidden ? `${e.message}.` : "No se ha podido guardar. Inténtalo otra vez." };
  }
  redirect(`/asignaturas/${subjectId}`);
}
