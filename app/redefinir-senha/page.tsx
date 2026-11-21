"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") || "");
    const confirmPassword = String(values.get("confirmPassword") || "");

    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível salvar a nova senha.");
        setLoading(false);
        return;
      }
      window.location.replace("/gestao");
    } catch {
      setError("Não foi possível concluir agora. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#07150f] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur md:p-9">
        <Link href="/" aria-label="Voltar ao site" className="mb-8 block">
          <span className="text-3xl font-extrabold tracking-[-0.07em]">
            <span className="text-[#c6f054]">Nexo</span>Fab
          </span>
        </Link>
        <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c6f054]">NOVA SENHA</p>
        <h1 className="text-3xl font-bold">Escolha sua nova senha</h1>
        <p className="mt-2 text-sm text-white/60">Use pelo menos 8 caracteres para proteger sua conta.</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold">
            Nova senha
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3">
              <LockKeyhole className="size-4 text-white/45" />
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
              />
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Confirmar nova senha
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3">
              <LockKeyhole className="size-4 text-white/45" />
              <Input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
              />
            </span>
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-[#c6f054] font-bold text-[#07150f] hover:bg-[#d8ff70]"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>

        <Link href="/login" className="mt-7 block text-center text-sm text-white/55 hover:text-white">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
