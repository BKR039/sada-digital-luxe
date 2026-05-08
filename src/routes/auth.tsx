import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/auth")({
  component: Auth,
});

function Auth() {
  const { signIn, signUp, user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav({ to: "/admin" }); }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password, name);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(mode === "in" ? "Welcome back" : "Account created — sign in"); if (mode === "up") setMode("in"); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 grid-bg">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 cyan-glow">
        <Link to="/"><Logo /></Link>
        <h1 className="mt-6 font-display text-3xl font-bold">{mode === "in" ? "Sign in" : "Create account"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Admin & team access</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "up" && <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} className="w-full glass rounded-xl px-4 py-3" />}
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full glass rounded-xl px-4 py-3" />
          <input required type="password" placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full glass rounded-xl px-4 py-3" />
          <button disabled={loading} className="w-full bg-gradient-primary py-3 rounded-xl font-semibold neon-glow disabled:opacity-50">
            {loading ? "..." : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-muted-foreground hover:text-accent w-full text-center">
          {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <p className="mt-6 text-xs text-muted-foreground text-center">First user must be granted admin role from the Cloud dashboard.</p>
      </div>
    </div>
  );
}
