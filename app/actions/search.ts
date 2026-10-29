"use server";

import { db } from "@/lib/db";
import { organizations, workspaces, invoices } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

export async function searchGlobalEntitiesAction(query: string) {
  if (!query || query.trim().length < 2) {
    return { success: true, orgs: [], workspaces: [], invoices: [] };
  }

  const q = `%${query.trim().toLowerCase()}%`;

  try {
    const [allOrgs, allWs, allInvs] = await Promise.all([
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          legalName: organizations.legalName,
          industry: organizations.industry,
          billingModel: organizations.billingModel,
          status: organizations.status,
        })
        .from(organizations)
        .all(),

      db
        .select({
          id: workspaces.id,
          orgId: workspaces.orgId,
          name: workspaces.name,
          gstin: workspaces.gstin,
          billingState: workspaces.billingState,
          status: workspaces.status,
        })
        .from(workspaces)
        .all(),

      db
        .select({
          id: invoices.id,
          workspaceId: invoices.workspaceId,
          period: invoices.period,
          amount: invoices.amount,
          gstAmount: invoices.gstAmount,
          status: invoices.status,
        })
        .from(invoices)
        .all(),
    ]);

    const needle = query.trim().toLowerCase();

    // Match organizations
    const matchedOrgs = allOrgs.filter((o) =>
      o.name.toLowerCase().includes(needle) ||
      o.legalName.toLowerCase().includes(needle) ||
      o.id.toLowerCase().includes(needle)
    ).slice(0, 5);

    // Match workspaces & GSTINs
    const matchedWs = allWs.filter((w) =>
      w.name.toLowerCase().includes(needle) ||
      (w.gstin && w.gstin.toLowerCase().includes(needle)) ||
      w.id.toLowerCase().includes(needle)
    ).slice(0, 5);

    // Match invoices
    const matchedInvs = allInvs.filter((i) =>
      i.id.toLowerCase().includes(needle) ||
      i.period.toLowerCase().includes(needle)
    ).slice(0, 5);

    return {
      success: true,
      orgs: matchedOrgs,
      workspaces: matchedWs,
      invoices: matchedInvs,
    };
  } catch (err: any) {
    return { success: false, error: err.message, orgs: [], workspaces: [], invoices: [] };
  }
}
