import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeRole,
  type SadaRole,
  type SadaModule,
  type UserModulePermissions,
  getEffectiveModulePermission,
} from "@/lib/permissions";
import { fetchUserModulePermissions } from "@/lib/account-service";
import {
  registerCurrentSession,
  heartbeatCurrentSession,
  recordAuthFailure,
  getCurrentSessionId,
  clearCurrentSessionId,
} from "@/lib/security-center-service";

export type { SadaRole };

export interface CurrentTeamMember {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  role: string;
  profile_id: string | null;
  user_id: string | null;
  is_active: boolean;
}

export async function resolveCurrentTeamMember(
  userId: string,
  userEmail?: string | null
): Promise<CurrentTeamMember | null> {
  try {
    // 0. Canonical Security Definer RPC: resolves and synchronizes user_id and profile_id
    const { data: rpcRows, error: rpcErr } = await (supabase as any).rpc(
      "resolve_and_link_current_team_member",
      {
        _user_id: userId,
        _email: userEmail ? userEmail.trim() : null,
      }
    );
    if (!rpcErr && rpcRows && rpcRows.length > 0) {
      const m = rpcRows[0];
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        position: m.position,
        role: m.role,
        profile_id: m.profile_id,
        user_id: m.user_id,
        is_active: m.is_active,
      };
    }

    // 1. Resolve by user_id
    const { data: memberByUserId } = await (supabase as any)
      .from("team_members")
      .select("id, name, email, position, role, profile_id, user_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (memberByUserId) return memberByUserId;

    // 2. Resolve by profile_id
    const { data: memberByProfileId } = await (supabase as any)
      .from("team_members")
      .select("id, name, email, position, role, profile_id, user_id, is_active")
      .eq("profile_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (memberByProfileId) return memberByProfileId;

    // 3. Fallback by email (case-insensitive and trimmed)
    if (userEmail) {
      const { data: memberByEmail } = await (supabase as any)
        .from("team_members")
        .select("id, name, email, position, role, profile_id, user_id, is_active")
        .ilike("email", userEmail.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (memberByEmail) return memberByEmail;
    }

    // 4. Robust fallback: call security definer RPC get_team_member_id
    const { data: rpcTmId } = await (supabase as any).rpc("get_team_member_id", {
      _user_id: userId,
    });
    if (rpcTmId) {
      const { data: memberByRpc } = await (supabase as any)
        .from("team_members")
        .select("id, name, email, position, role, profile_id, user_id, is_active")
        .eq("id", rpcTmId)
        .maybeSingle();

      if (memberByRpc) return memberByRpc;
    }
  } catch (err) {
    console.error("[resolveCurrentTeamMember] Error:", err);
  }
  return null;
}

export function normalizeAuthErrorMessage(err: unknown, isAr = false): string {
  if (!err) {
    return isAr
      ? "حدث خطأ غير متوقع أثناء تسجيل الدخول."
      : "An unexpected error occurred during authentication.";
  }

  let rawMessage = "";
  if (typeof err === "string") {
    rawMessage = err;
  } else if (typeof err === "object") {
    const anyErr = err as Record<string, any>;
    if (typeof anyErr.message === "string") {
      rawMessage = anyErr.message;
    } else if (typeof anyErr.error_description === "string") {
      rawMessage = anyErr.error_description;
    } else if (typeof anyErr.error === "string") {
      rawMessage = anyErr.error;
    } else if (typeof anyErr.msg === "string") {
      rawMessage = anyErr.msg;
    }
  }

  const trimmed = rawMessage.trim();
  // Filter out empty or raw stringified empty objects / undefined / null
  if (!trimmed || trimmed === "{}" || trimmed === "[]" || trimmed === "[object Object]" || trimmed === "undefined" || trimmed === "null") {
    return isAr
      ? "خدمة التحقق غير متاحة حالياً أو تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى."
      : "Authentication service unavailable. Please check your credentials and try again.";
  }

  const lower = trimmed.toLowerCase();

  // Invalid credentials
  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant") || lower.includes("invalid credentials")) {
    return isAr
      ? "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور."
      : "Invalid login credentials.";
  }

  // Email confirmation
  if (lower.includes("email not confirmed") || lower.includes("unconfirmed email")) {
    return isAr
      ? "لم يتم تأكيد البريد الإلكتروني لهذا الحساب."
      : "Email address has not been confirmed.";
  }

  // Account suspended / disabled
  if (lower.includes("suspended") || lower.includes("disabled") || lower.includes("deleted") || lower.includes("banned")) {
    return isAr
      ? "تم إيقاف هذا الحساب. يرجى التواصل مع المدير العام."
      : trimmed;
  }

  // Network / fetch errors
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("fetcherror") || lower.includes("econnrefused")) {
    return isAr
      ? "تعذر الاتصال بخدمة التحقق. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً."
      : "Network error. Please check your internet connection and try again.";
  }

  // Rate limit / too many requests
  if (lower.includes("too many requests") || lower.includes("rate limit") || lower.includes("over_email_send_rate_limit")) {
    return isAr
      ? "تم تجاوز عدد المحاولات المسموح به. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى."
      : "Too many login attempts. Please wait a moment before trying again.";
  }

  // Database error querying schema
  if (lower.includes("database error") || lower.includes("internal server error")) {
    return isAr
      ? "خدمة التحقق غير متاحة حالياً. يرجى مراجعة مدير النظام."
      : "Authentication service unavailable. Please try again or contact the administrator.";
  }

  return trimmed;
}

export interface SignInResult {
  success: boolean;
  user: User | null;
  session: Session | null;
  role: SadaRole | null;
  error: Error | null;
  errorMessage: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: SadaRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  loading: boolean;
  teamMember: CurrentTeamMember | null;
  teamMemberId: string | null;
  customModulePermissions: UserModulePermissions | null;
  canAccessModule: (module: SadaModule) => boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshTeamMember: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<SadaRole | null>(null);
  const [customModulePermissions, setCustomPermissions] = useState<UserModulePermissions | null>(null);
  const [teamMember, setTeamMember] = useState<CurrentTeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep tracking refs to avoid unnecessary re-render cascades and duplicate network requests
  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const roleRef = useRef<SadaRole | null>(null);
  const customPermissionsRef = useRef<UserModulePermissions | null>(null);
  const teamMemberRef = useRef<CurrentTeamMember | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  const resolveRole = async (userId: string): Promise<SadaRole> => {
    try {
      // 0. Verify account suspension status
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .maybeSingle();

      if (profile && ["suspended", "disabled", "deleted"].includes((profile as any).status)) {
        await supabase.auth.signOut();
        userRef.current = null;
        sessionRef.current = null;
        roleRef.current = null;
        teamMemberRef.current = null;
        setUser(null);
        setSession(null);
        setRole(null);
        setTeamMember(null);
        throw new Error(`This account is ${(profile as any).status}. Contact the Super Admin.`);
      }

      // 1. Check user_roles table
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (userRoles && userRoles.length > 0) {
        // Priority: super_admin > admin > worker
        if (userRoles.some((r) => (r.role as string) === "super_admin")) return "super_admin";
        if (userRoles.some((r) => (r.role as string) === "admin")) return "admin";
        if (userRoles.some((r) => (r.role as string) === "worker")) return "worker";
      }

      // 2. Fallback to team_members.role by profile_id
      const { data: member } = await (supabase as any)
        .from("team_members")
        .select("role")
        .eq("profile_id", userId)
        .maybeSingle();

      if (member?.role) {
        return normalizeRole(member.role);
      }
    } catch (err) {
      console.error("[AuthProvider] Error resolving role:", err);
      throw err;
    }
    // Default to worker per SADA Works rules
    return "worker";
  };

  const canAccessModule = useCallback(
    (module: SadaModule): boolean => {
      const currentRole = role ?? "worker";
      return getEffectiveModulePermission(module, currentRole, customModulePermissions);
    },
    [role, customModulePermissions]
  );

  const refreshPermissions = async () => {
    const curUser = userRef.current;
    if (curUser) {
      const perms = await fetchUserModulePermissions(curUser.id);
      customPermissionsRef.current = perms;
      setCustomPermissions(perms);
    } else {
      customPermissionsRef.current = null;
      setCustomPermissions(null);
    }
  };

  const refreshTeamMember = async () => {
    const curUser = userRef.current;
    if (curUser) {
      const tm = await resolveCurrentTeamMember(curUser.id, curUser.email);
      teamMemberRef.current = tm;
      setTeamMember(tm);
    } else {
      teamMemberRef.current = null;
      setTeamMember(null);
    }
  };

  const refreshRole = async () => {
    const curUser = userRef.current;
    if (curUser) {
      const [r, perms] = await Promise.all([
        resolveRole(curUser.id),
        fetchUserModulePermissions(curUser.id),
      ]);
      roleRef.current = r;
      customPermissionsRef.current = perms;
      setRole(r);
      setCustomPermissions(perms);
      await refreshTeamMember();
    }
  };

  useEffect(() => {
    const handleAuth = async (event: string, s: Session | null) => {
      // Case 1: Sign out or no active session
      if (!s?.user) {
        // Guard against spurious/transient null states when switching browser tabs or recovering network
        if (event !== "SIGNED_OUT" && userRef.current && isInitializedRef.current) {
          return;
        }
        clearCurrentSessionId(userRef.current?.id);
        userRef.current = null;
        sessionRef.current = null;
        roleRef.current = null;
        customPermissionsRef.current = null;
        teamMemberRef.current = null;
        setUser(null);
        setSession(null);
        setRole(null);
        setCustomPermissions(null);
        setTeamMember(null);
        setLoading(false);
        isInitializedRef.current = true;
        return;
      }

      // Case 2: Same user identity (e.g. routine TOKEN_REFRESHED, or tab-focus recovery via visibilitychange)
      // When a user returns to the tab, GoTrue emits SIGNED_IN or TOKEN_REFRESHED even if the session is valid.
      // We MUST NOT re-fetch role or team_member, and MUST NOT replace the user object reference
      // unless user identity or essential metadata actually changed.
      const isSameUser = userRef.current?.id === s.user.id;
      if (isSameUser && isInitializedRef.current && event !== "USER_UPDATED") {
        // Only update session if access_token changed, keeping user/role/teamMember references rock-stable
        if (sessionRef.current?.access_token !== s.access_token) {
          sessionRef.current = s;
          setSession(s);
        }
        setLoading(false);
        return;
      }

      // Case 3: Initial session load, user switch, or explicit USER_UPDATED event
      sessionRef.current = s;
      userRef.current = s.user;
      setSession(s);
      setUser(s.user);

      try {
        const [r, tm, perms] = await Promise.all([
          resolveRole(s.user.id),
          resolveCurrentTeamMember(s.user.id, s.user.email),
          fetchUserModulePermissions(s.user.id),
        ]);
        roleRef.current = r;
        teamMemberRef.current = tm;
        customPermissionsRef.current = perms;
        setRole(r);
        setTeamMember(tm);
        setCustomPermissions(perms);
      } catch (err) {
        console.error("[AuthProvider] Failed resolving auth details:", err);
      } finally {
        setLoading(false);
        isInitializedRef.current = true;
      }
      // Register session in authoritative sessions inventory
      registerCurrentSession().catch(() => {});
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      handleAuth(event, s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!isInitializedRef.current) {
        handleAuth("INITIAL_SESSION", s);
      }
    });

    // 1. Realtime session revocation listener (<200ms instantaneous browser logout)
    const realtimeRevocationChannel = supabase
      .channel("sada-user-session-revocation")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_sessions",
        },
        (payload) => {
          const updated = payload.new as any;
          const curUser = userRef.current;
          if (curUser && updated && updated.user_id === curUser.id) {
            const currentSid = getCurrentSessionId(curUser.id);
            if (
              (updated.session_id === currentSid && updated.status === "revoked") ||
              (updated.status === "revoked" && (updated.revocation_reason || "").toLowerCase().includes("suspend"))
            ) {
              console.warn("[Auth] Realtime session revocation received:", updated.revocation_reason);
              signOut();
            }
          }
        }
      )
      .subscribe();

    // 2. Periodic session liveness & revocation fallback check (every 120s)
    const heartbeatTimer = setInterval(async () => {
      if (userRef.current) {
        const hb = await heartbeatCurrentSession();
        if (!hb.valid) {
          console.warn("[Auth] Session invalid or revoked:", hb.status);
          signOut();
        }
      }
    }, 120_000);

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(realtimeRevocationChannel);
      clearInterval(heartbeatTimer);
    };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    try {
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        recordAuthFailure(cleanEmail, error.message).catch(() => {});
        const normMsg = normalizeAuthErrorMessage(error);
        return {
          success: false,
          user: null,
          session: null,
          role: null,
          error: new Error(normMsg),
          errorMessage: normMsg,
        };
      }

      if (!data.user || !data.session) {
        recordAuthFailure(cleanEmail, "No active session created").catch(() => {});
        const normMsg = "Authentication failed: No active session created.";
        return {
          success: false,
          user: null,
          session: null,
          role: null,
          error: new Error(normMsg),
          errorMessage: normMsg,
        };
      }

      // 1. Resolve role and verify account status
      let userRole: SadaRole = "worker";
      try {
        userRole = await resolveRole(data.user.id);
      } catch (roleErr: any) {
        const normMsg = normalizeAuthErrorMessage(roleErr);
        await supabase.auth.signOut();
        return {
          success: false,
          user: null,
          session: null,
          role: null,
          error: new Error(normMsg),
          errorMessage: normMsg,
        };
      }

      // 2. Synchronously set refs and state so route guards have immediate access
      userRef.current = data.user;
      sessionRef.current = data.session;
      roleRef.current = userRole;
      setUser(data.user);
      setSession(data.session);
      setRole(userRole);
      setLoading(false);
      isInitializedRef.current = true;

      // Register session in authoritative inventory
      registerCurrentSession().catch(() => {});

      // 3. Resolve team member and module permissions in parallel
      const [tm, perms] = await Promise.all([
        resolveCurrentTeamMember(data.user.id, data.user.email),
        fetchUserModulePermissions(data.user.id),
      ]);
      teamMemberRef.current = tm;
      customPermissionsRef.current = perms;
      setTeamMember(tm);
      setCustomPermissions(perms);

      return {
        success: true,
        user: data.user,
        session: data.session,
        role: userRole,
        error: null,
        errorMessage: null,
      };
    } catch (err: any) {
      const normMsg = normalizeAuthErrorMessage(err);
      return {
        success: false,
        user: null,
        session: null,
        role: null,
        error: new Error(normMsg),
        errorMessage: normMsg,
      };
    }
  };

  const signUp: AuthCtx["signUp"] = async () => {
    return {
      error: new Error(
        "Public account creation is disabled. All SADA accounts must be created by the Super Admin in Account Management."
      ),
    };
  };

  const signOut = async () => {
    const curUser = userRef.current;
    try {
      const sid = getCurrentSessionId(curUser?.id);
      if (sid) {
        await (supabase as any)
          .from("user_sessions")
          .update({ status: "expired" })
          .eq("session_id", sid);
      }
    } catch {
      // Non-blocking cleanup
    } finally {
      clearCurrentSessionId(curUser?.id);
    }
    userRef.current = null;
    sessionRef.current = null;
    roleRef.current = null;
    customPermissionsRef.current = null;
    teamMemberRef.current = null;
    setUser(null);
    setSession(null);
    setRole(null);
    setCustomPermissions(null);
    setTeamMember(null);
    await supabase.auth.signOut();
  };

  const isSuperAdmin = user !== null && role === "super_admin";
  const isAdmin = user !== null && (role === "super_admin" || role === "admin");
  const isWorker = user !== null && role === "worker";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isSuperAdmin,
        isAdmin,
        isWorker,
        loading,
        teamMember,
        teamMemberId: teamMember?.id || null,
        customModulePermissions,
        canAccessModule,
        signIn,
        signUp,
        signOut,
        refreshRole,
        refreshTeamMember,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

