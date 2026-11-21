"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeNextPath(raw: string | null) {
  return raw?.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/onboarding";
}

export default function SignupPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const values = new FormData(event.currentTarget);
    const fullName = String(values.get("fullName") || "").trim();
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    const confirmPassword = String(values.get("confirmPassword") || "");

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next"));

    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, next: nextPath }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível criar a conta.");
        setLoading(false);
        return;
      }

      if (payload.needsEmailConfirmation) {
        setConfirmationEmail(email);
        setLoading(false);
        return;
      }

      window.location.replace(payload.nextPath || nextPath);
    } catch {
      setError("Não foi possível concluir o cadastro agora. Tente novamente.");
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

        {confirmationEmail ? (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c6f054]/30 bg-[#c6f054]/10 px-3 py-1 text-xs font-bold text-[#c6f054]">
              <CheckCircle2 className="size-4" /> Quase lá
            </div>
            <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
            <p className="text-sm leading-relaxed text-white/70">
              Enviamos um link de confirmação para <strong className="text-white">{confirmationEmail}</strong>. Clique no
              link recebido (confira também a caixa de spam) para ativar sua conta e iniciar seus{" "}
              <strong className="text-white">7 dias grátis</strong>.
            </p>
            <Button asChild className="h-12 w-full bg-[#c6f054] font-bold text-[#07150f] hover:bg-[#d8ff70]">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c6f054]">7 DIAS GRÁTIS · SEM CARTÃO</p>
            <h1 className="text-3xl font-bold">Criar sua conta</h1>
            <p className="mt-2 text-sm text-white/60">
              Crie seu acesso e cadastre sua empresa em menos de dois minutos.
            </p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm font-semibold">
                Seu nome
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3">
                  <User className="size-4 text-white/45" />
                  <Input
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Nome completo"
                    className="border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold">
                E-mail
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3">
                  <Mail className="size-4 text-white/45" />
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="voce@empresa.com.br"
                    className="border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold">
                Senha (mín. 8 caracteres)
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
                Confirmar senha
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
                {loading ? "Criando conta..." : "Começar 7 dias grátis"}
              </Button>
              <p className="text-center text-xs leading-relaxed text-white/50">
                Ao continuar, você concorda com os{" "}
                <Link href="/termos" className="text-white/75 underline hover:text-white">Termos de Uso</Link>{" "}
                e a{" "}
                <Link href="/privacidade" className="text-white/75 underline hover:text-white">Política de Privacidade</Link>.
              </p>
            </form>
            <p className="mt-6 text-center text-sm text-white/60">
              Já possui conta?{" "}
              <Link href="/login" className="font-semibold text-[#c6f054] hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}

        <Link href="/" className="mt-6 block text-center text-sm text-white/50 hover:text-white">
          Voltar ao site
        </Link>
      </section>
    </main>
  );
}
