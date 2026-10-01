import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Portada } from "@/components/portada";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <Portada>
      <h2 className="text-2xl font-semibold">Entra con tu correo</h2>
      <p className="mt-2 mb-6 text-gris">Te enviamos un enlace para entrar, sin contraseña.</p>
      <LoginForm />
    </Portada>
  );
}
