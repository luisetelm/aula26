import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aula26",
  description: "Aula virtual",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {user && (
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-semibold">Aula26</Link>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span>{user.email}</span>
                <form action={logout}>
                  <button className="hover:text-slate-900">Salir</button>
                </form>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
