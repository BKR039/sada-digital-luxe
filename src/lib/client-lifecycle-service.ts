import { supabase } from "@/integrations/supabase/client";
import { reconcileClientPackageWork } from "@/lib/package-reconciliation-service";

export interface ClientLifecycleAnalysis {
  client_id: string;
  client_name: string;
  client_status: string;
  client_type: string;
  package_name?: string | null;
  can_delete_permanently: boolean;
  blocking_reasons: string[];
  counts: {
    tasks: number;
    projects: number;
    commitments: number;
    deliverables: number;
    bookings: number;
    campaigns: number;
    communications: number;
    invoices: number;
    financial_commissions: number;
    income_transactions: number;
    expense_transactions: number;
  };
}

export interface ClientOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Perform pre-flight lifecycle analysis for a client.
 * Identifies all dependent operational and financial records.
 */
export async function analyzeClientLifecycle(clientId: string): Promise<ClientLifecycleAnalysis> {
  const { data, error } = await (supabase as any).rpc("admin_analyze_client_lifecycle", {
    _client_id: clientId,
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze client lifecycle");
  }

  return data as ClientLifecycleAnalysis;
}

/**
 * Permanently delete a client and all operational records.
 * STRICT FINANCIAL SAFEGUARD: Blocked if client has issued invoices or approved commissions.
 */
export async function deleteClientPermanently(clientId: string): Promise<ClientOperationResult> {
  const { data, error } = await (supabase as any).rpc("admin_delete_client_permanently", {
    _client_id: clientId,
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to permanently delete client",
    };
  }

  return {
    success: true,
    data,
  };
}

/**
 * Freeze/archive a client reversibly.
 * Sets status to 'archived', pauses active commitments, and pauses uncompleted tasks
 * while preserving original status and full history.
 */
export async function archiveClient(clientId: string): Promise<ClientOperationResult> {
  const { data, error } = await (supabase as any).rpc("admin_archive_client", {
    _client_id: clientId,
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to archive client",
    };
  }

  return {
    success: true,
    data,
  };
}

/**
 * Restore an archived client back to active operations.
 * Reactivates service commitments, restores paused tasks to their exact previous status,
 * and triggers idempotent package reconciliation if monthly client.
 */
export async function restoreClient(clientId: string, clientType?: string): Promise<ClientOperationResult> {
  const { data, error } = await (supabase as any).rpc("admin_restore_client", {
    _client_id: clientId,
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to restore client",
    };
  }

  // Idempotently align package commitments and future tasks if monthly retainer
  if (clientType === "monthly") {
    try {
      const { data: clientRecord } = await (supabase as any)
        .from("clients")
        .select("id, package_id, package_name, package_config")
        .eq("id", clientId)
        .maybeSingle();

      if (clientRecord?.package_config) {
        await reconcileClientPackageWork({
          clientId,
          packageId: clientRecord.package_id,
          packageName: clientRecord.package_name,
          packageConfig: clientRecord.package_config,
          commitToDatabase: true,
        });
      }
    } catch (reconcileErr) {
      console.warn("[ClientLifecycle] Post-restore reconciliation warning:", reconcileErr);
    }
  }

  return {
    success: true,
    data,
  };
}
