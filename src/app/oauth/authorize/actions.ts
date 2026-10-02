"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createCode } from "@/lib/oauth";
import { checkAuthorizeRequest, canUseConnector } from "./request";

function back(redirectUri: string, params: Record<string, string>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  redirect(u.toString());
}

export async function decide(formData: FormData) {
  const user = await requireUser();
  const req = await checkAuthorizeRequest(Object.fromEntries(formData));
  if (!req.ok) redirect("/");
  const { clientId, redirectUri, codeChallenge, state } = req;
  if (!req.valid) back(redirectUri, { error: "invalid_request", state });
  if (formData.get("decision") !== "allow" || !(await canUseConnector(user))) {
    back(redirectUri, { error: "access_denied", state });
  }
  const code = await createCode({ clientId, userId: user.id, redirectUri, codeChallenge });
  back(redirectUri, { code, state });
}
