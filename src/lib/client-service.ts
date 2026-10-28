// ============================================================
// SADA WORK OS — CLIENT CRM SERVICE
// Centralized, authoritative server boundary mutations & reads
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { assertAuthorizedMutation } from "@/lib/security-isolation-service";
import type { PermissionContext } from "@/lib/permissions";

export interface ClientRecordInput {
  name: string;
  client_type?: "monthly" | "one_off";
  industry?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_channel?: string;
  status?: string;
  package_name?: string;
  package_config?: any;
  relationship_owner_id?: string | null;
  account_manager_id?: string | null;
  sales_owner_id?: string | null;
  commission_recipient_id?: string | null;
  monthly_package_price?: number;
  default_service_fee?: number;
  default_sponsoring_budget?: number;
}

export interface ClientMutationOptions {
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  role?: string;
  id?: string;
  client?: any;
  clientOverride?: any;
}

/**
 * Creates a new client record with authoritative server/API authorization.
 * Verifies authenticated identity, active account, and clients.create permission.
 */
export async function createClientRecord(
  input: ClientRecordInput,
  options?: ClientMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const authCtx = await assertAuthorizedMutation(activeClient, "clients", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
  });

  const { data, error } = await (activeClient as any)
    .from("clients")
    .insert({
      ...input,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing client record with authoritative server/API authorization.
 * Verifies clients.edit permission and active status.
 */
export async function updateClientRecord(
  clientId: string,
  updates: Partial<ClientRecordInput>,
  options?: ClientMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const authCtx = await assertAuthorizedMutation(activeClient, "clients", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "client_record",
    resource: { id: clientId },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("clients")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Permanently deletes a client record.
 * Strictly Super Admin exclusive invariant.
 */
export async function deleteClientRecord(
  clientId: string,
  options?: ClientMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "clients", "delete", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "client_record",
    resource: { id: clientId },
    resourceAction: "delete",
  });

  const { error } = await (activeClient as any)
    .from("clients")
    .delete()
    .eq("id", clientId);

  if (error) {
    throw error;
  }
}

/**
 * Fetches a client record with server/API authorization.
 */
export async function fetchClientRecord(
  clientId: string,
  options?: ClientMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "clients", "view", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "client_record",
    resource: { id: clientId },
    resourceAction: "read",
  });

  const { data, error } = await (supabase as any)
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) throw error;
  return data;
}
