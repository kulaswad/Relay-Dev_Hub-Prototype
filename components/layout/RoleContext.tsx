"use client";

import React, { createContext, useContext, useState, useTransition } from "react";
import { InternalRole, INTERNAL_ROLES, RoleDefinition, getRoleDefinition } from "@/lib/permissions/roles";
import { switchUser } from "@/app/actions/auth";
import { toast } from "@/components/ui/Toaster";
import { useRouter } from "next/navigation";

export interface ActiveUser {
  id: string;
  name: string;
  email: string;
  role: InternalRole;
  avatarColor: string;
}

interface RoleContextValue {
  currentUser: ActiveUser;
  currentRole: InternalRole;
  roleDefinition: RoleDefinition;
  allUsers: ActiveUser[];
  approvalsCount: number;
  isSwitching: boolean;
  switchActiveUser: (userId: string) => Promise<void>;
  setApprovalsCount: React.Dispatch<React.SetStateAction<number>>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({
  children,
  initialUser,
  allUsers = [],
  initialApprovalsCount = 0,
}: {
  children: React.ReactNode;
  initialUser: ActiveUser;
  allUsers?: ActiveUser[];
  initialApprovalsCount?: number;
}) {
  const [currentUser, setCurrentUser] = useState<ActiveUser>(initialUser);
  const [approvalsCount, setApprovalsCount] = useState<number>(initialApprovalsCount);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const roleDefinition = getRoleDefinition(currentUser.role);

  const switchActiveUser = async (userId: string) => {
    const target = allUsers.find((u) => u.id === userId);
    if (!target) return;

    setCurrentUser(target);

    startTransition(async () => {
      try {
        await switchUser(userId);
        toast.success(`Switched role to ${getRoleDefinition(target.role).label}`, {
          description: `Acting as ${target.name} (${target.email})`,
        });
        router.refresh();
      } catch (err: any) {
        toast.error("Failed to switch user", {
          description: err?.message || "Unknown error occurred.",
        });
      }
    });
  };

  return (
    <RoleContext.Provider
      value={{
        currentUser,
        currentRole: currentUser.role,
        roleDefinition,
        allUsers,
        approvalsCount,
        isSwitching: isPending,
        switchActiveUser,
        setApprovalsCount,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
