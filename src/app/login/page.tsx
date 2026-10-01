import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <h1 className="mb-2 text-2xl font-semibold">Aula26</h1>
      <p className="mb-6 text-slate-600">Te enviaremos un enlace a tu correo para entrar, sin contraseña.</p>
      <LoginForm />
    </main>
  );
}
