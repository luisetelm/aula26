import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Portada } from "@/components/portada";
import { safeNext } from "@/lib/next-path";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <Portada>
      <h2 className="text-2xl font-semibold">Entra con tu correo</h2>
      <p className="mt-2 mb-6 text-gris">Te enviamos un enlace para entrar, sin contraseña.</p>
      <LoginForm next={next} />
    </Portada>
  );
}
