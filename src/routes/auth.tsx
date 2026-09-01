import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Studio Lary Andrade" },
      {
        name: "description",
        content:
          "Gestão de clientes, agenda, serviços e financeiro do Studio Lary Andrade.",
      },
      {
        property: "og:title",
        content: "Studio Lary Andrade",
      },
      {
        property: "og:description",
        content:
          "Organize sua agenda, clientes, serviços e financeiro em um só lugar.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: name,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          toast.success(
            "Cadastro criado. Confira seu email para confirmar a conta."
          );
          setMode("login");
          return;
        }

        await supabase.from("profiles").upsert({
          id: data.session.user.id,
          display_name: name,
        });

        navigate({ to: "/inicio" });
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) throw error;

        navigate({ to: "/inicio" });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível continuar."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f8] px-5 py-10">
      <div className="w-full max-w-sm">
        {/* MARCA */}
        <div className="text-center">
          <p className="text-[22px] font-light tracking-[0.18em] text-[#211f20]">
            STUDIO{" "}
            <span className="text-[#b7838e]">DA LARY</span>
          </p>

          <div className="mx-auto mt-4 h-px w-10 bg-[#b7838e]" />

          <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-[#aaa5a6]">
            Gestão do seu Studio
          </p>
        </div>

        {/* TÍTULO */}
        <div className="mt-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#211f20]">
            {mode === "login"
              ? "Bem-vinda de volta"
              : "Crie sua conta"}
          </h1>

          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#817b7d]">
            {mode === "login"
              ? "Acesse sua agenda, clientes e financeiro."
              : "Tenha tudo do seu Studio organizado em um só lugar."}
          </p>
        </div>

        {/* FORMULÁRIO */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-black/[0.05] bg-white p-5 shadow-sm"
        >
          {mode === "signup" && (
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs font-medium text-[#625d5f]"
              >
                Seu nome
              </Label>

              <Input
                id="name"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Lary"
                required
                className="h-11 rounded-xl border-black/[0.08] bg-[#faf9f8] text-sm focus-visible:ring-[#b7838e]"
              />
            </div>
          )}

          <div
            className={
              mode === "signup"
                ? "mt-4 space-y-2"
                : "space-y-2"
            }
          >
            <Label
              htmlFor="email"
              className="text-xs font-medium text-[#625d5f]"
            >
              Email
            </Label>

            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="voce@email.com"
              required
              className="h-11 rounded-xl border-black/[0.08] bg-[#faf9f8] text-sm focus-visible:ring-[#b7838e]"
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label
              htmlFor="password"
              className="text-xs font-medium text-[#625d5f]"
            >
              Senha
            </Label>

            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              minLength={6}
              required
              placeholder="••••••••"
              className="h-11 rounded-xl border-black/[0.08] bg-[#faf9f8] text-sm focus-visible:ring-[#b7838e]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-5 h-11 w-full rounded-xl bg-[#b7838e] text-sm font-semibold text-white hover:bg-[#a97480]"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar no Studio"
                : "Criar minha conta"}
          </Button>
        </form>

        {/* ALTERNAR LOGIN/CADASTRO */}
        <button
          type="button"
          onClick={() =>
            setMode(
              mode === "login" ? "signup" : "login"
            )
          }
          className="mt-5 w-full text-center text-sm text-[#817b7d]"
        >
          {mode === "login" ? (
            <>
              Ainda não possui conta?{" "}
              <span className="font-medium text-[#9d6875]">
                Criar conta
              </span>
            </>
          ) : (
            <>
              Já possui uma conta?{" "}
              <span className="font-medium text-[#9d6875]">
                Entrar
              </span>
            </>
          )}
        </button>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.16em] text-[#aaa5a6]">
          Studio Lary Andrade
        </p>
      </div>
    </main>
  );
}
