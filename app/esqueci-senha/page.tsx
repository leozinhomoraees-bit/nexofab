"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const values = new FormData(event.currentTarget);

    try {
      const response = await fetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(values.get("email") || "") }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível enviar o link.");
        setLoading(false);
        return;
      }
      setMessage(payload.message ?? "Se existir uma conta com este e-mail, enviamos um link para redefinir sua senha.");
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
    } finally {
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
        <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c6f054]">RECUPERAÇÃO DE ACESSO</p>
        <h1 className="text-3xl font-bold">Redefinir senha</h1>
        <p className="mt-2 text-sm text-white/60">
          Informe o e-mail da sua conta para receber um link seguro de redefinição.
        </p>

        {message ? (
          <div className="mt-7 space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-[#c6f054]/30 bg-[#c6f054]/10 p-4 text-sm text-white/85">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#c6f054]" />
              <p>{message}</p>
            </div>
            <Button asChild className="h-12 w-full bg-[#c6f054] font-bold text-[#07150f] hover:bg-[#d8ff70]">
              <Link href="/login">Voltar para o login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold">
              E-mail
              <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3">
                <Mail className="size-4 text-white/45" />
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
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
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </form>
        )}

        <Link href="/login" className="mt-7 block text-center text-sm text-white/55 hover:text-white">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
