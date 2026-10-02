import type { Metadata } from "next";
import Link from "next/link";
import { Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-work-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Aula26",
  description: "Aula virtual",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="es" className={`${workSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {user && (
          <header className="bg-tinta text-papel">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-semibold tracking-tight">Aula26</Link>
              <div className="flex items-center gap-4 text-sm text-niebla">
                <span>{user.email}</span>
                <form action={logout}>
                  <button className="font-medium text-papel hover:text-ocre">Salir</button>
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
