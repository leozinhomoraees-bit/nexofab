"use client";

import { FormEvent, MouseEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function goToSignup(event: MouseEvent<HTMLAnchorElement>) {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
      event.preventDefault();
      router.push(`/cadastro?next=${encodeURIComponent(next)}`);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      email: String(values.get("email") || ""),
      password: String(values.get("password") || ""),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível entrar.");
      setLoading(false);
      return;
    }

    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/gestao";
    window.location.replace(nextPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#07150f] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur md:p-9">
        <Link href="/" aria-label="Voltar ao site" className="mb-10 block">
          <span className="text-3xl font-extrabold tracking-[-0.07em]"><span className="text-[#c6f054]">Nexo</span>Fab</span>
        </Link>
        <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c6f054]">ÁREA INTERNA</p>
        <h1 className="text-3xl font-bold">Acessar gestão</h1>
        <p className="mt-2 text-sm text-white/60">Entre com o usuário vinculado à sua empresa.</p>
        <form method="post" action="/auth/login" onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-semibold">E-mail
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3"><Mail className="size-4 text-white/45" /><Input name="email" type="email" autoComplete="email" required className="border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0" /></span>
          </label>
          <label className="block text-sm font-semibold">
            <span className="flex items-center justify-between">
              <span>Senha</span>
              <Link href="/esqueci-senha" className="text-xs font-medium text-[#c6f054] hover:underline">Esqueci minha senha</Link>
            </span>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3"><LockKeyhole className="size-4 text-white/45" /><Input name="password" type="password" autoComplete="current-password" required className="border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0" /></span>
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <Button type="submit" disabled={loading} className="h-12 w-full bg-[#c6f054] font-bold text-[#07150f] hover:bg-[#d8ff70]">{loading ? "Entrando..." : "Entrar"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-white/60">
          Ainda não tem conta? <Link href="/cadastro" onClick={goToSignup} className="font-semibold text-[#c6f054] hover:underline">Testar 7 dias grátis</Link>
        </p>
        <Link href="/" className="mt-4 block text-center text-sm text-white/55 hover:text-white">Voltar ao site</Link>
      </section>
    </main>
  );
}
