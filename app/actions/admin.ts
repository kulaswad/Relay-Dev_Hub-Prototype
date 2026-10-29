"use server";

import { getActiveUser } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import { revalidatePath } from "next/cache";

const execPromise = promisify(exec);

export async function resetDemoDataAction() {
  const user = await getActiveUser();
  if (user.role !== "admin") {
    return {
      success: false,
      error: "Unauthorized: Only Admin role can reset demo database.",
    };
  }

  try {
    const cmd = process.platform === "win32" ? "npx.cmd tsx lib/db/seed.ts" : "npx tsx lib/db/seed.ts";
    await execPromise(cmd, { cwd: process.cwd() });

    revalidatePath("/");
    revalidatePath("/accounts");
    revalidatePath("/finance");
    revalidatePath("/compliance");
    revalidatePath("/approvals");
    revalidatePath("/tasks");
    revalidatePath("/audit");
    revalidatePath("/admin/ai");

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to reset demo database.",
    };
  }
}
