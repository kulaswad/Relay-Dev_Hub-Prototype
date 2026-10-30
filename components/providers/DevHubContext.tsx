"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Environment = "test" | "live";
export type CodeLanguage = "curl" | "node" | "python" | "php" | "java" | "go";
export type SupportedLanguage = CodeLanguage;

export interface WorkspaceContextInfo {
  id: string;
  name: string;
  orgName: string;
  kycStatus: "kyc_pending" | "kyc_in_review" | "active" | "suspended";
  isLiveApproved: boolean;
  walletBalance: number;
  creditLimit: number;
  creditUsed: number;
}

interface DevHubContextType {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  activeLanguage: CodeLanguage;
  setActiveLanguage: (lang: CodeLanguage) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  isHelpDrawerOpen: boolean;
  setHelpDrawerOpen: (open: boolean) => void;
  toggleHelpDrawer: () => void;
  helpTab: "self_serve" | "ask_docs" | "status" | "contact" | "threads";
  setHelpTab: (tab: "self_serve" | "ask_docs" | "status" | "contact" | "threads") => void;
  apiVersion: string;
  setApiVersion: (v: string) => void;
  workspace: WorkspaceContextInfo;
  setWorkspace: React.Dispatch<React.SetStateAction<WorkspaceContextInfo>>;
}

const defaultWorkspace: WorkspaceContextInfo = {
  id: "ws_meridian_retail",
  name: "Meridian Retail (Primary)",
  orgName: "Meridian FinServ Ltd",
  kycStatus: "active",
  isLiveApproved: true,
  walletBalance: 48500,
  creditLimit: 250000,
  creditUsed: 142300,
};

const DevHubContext = createContext<DevHubContextType | undefined>(undefined);

export function DevHubProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvState] = useState<Environment>("test");
  const [activeLanguage, setActiveLangState] = useState<CodeLanguage>("curl");
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isHelpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<"self_serve" | "ask_docs" | "status" | "contact" | "threads">("self_serve");
  const [apiVersion, setApiVersion] = useState("v2025-10-01");
  const [workspace, setWorkspace] = useState<WorkspaceContextInfo>(defaultWorkspace);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedEnv = localStorage.getItem("relay_dev_env") as Environment;
      if (storedEnv === "test" || storedEnv === "live") {
        setEnvState(storedEnv);
      }
      const storedLang = localStorage.getItem("relay_code_lang") as CodeLanguage;
      if (storedLang && ["curl", "node", "python", "php", "java", "go"].includes(storedLang)) {
        setActiveLangState(storedLang);
      }
      const storedVersion = localStorage.getItem("relay_api_version");
      if (storedVersion) {
        setApiVersion(storedVersion);
      }
    } catch {
      // LocalStorage unavailable in iframe/SSR
    }
  }, []);

  const setEnvironment = (env: Environment) => {
    setEnvState(env);
    try {
      localStorage.setItem("relay_dev_env", env);
    } catch {}
  };

  const setActiveLanguage = (lang: CodeLanguage) => {
    setActiveLangState(lang);
    try {
      localStorage.setItem("relay_code_lang", lang);
    } catch {}
  };

  const toggleCommandPalette = () => {
    setCommandPaletteOpen((prev) => !prev);
  };

  const toggleHelpDrawer = () => {
    setHelpDrawerOpen((prev) => !prev);
  };

  // Keyboard shortcut for Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <DevHubContext.Provider
      value={{
        environment,
        setEnvironment,
        activeLanguage,
        setActiveLanguage,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        toggleCommandPalette,
        isHelpDrawerOpen,
        setHelpDrawerOpen,
        toggleHelpDrawer,
        helpTab,
        setHelpTab,
        apiVersion,
        setApiVersion,
        workspace,
        setWorkspace,
      }}
    >
      {children}
    </DevHubContext.Provider>
  );
}

export function useDevHub() {
  const context = useContext(DevHubContext);
  if (!context) {
    throw new Error("useDevHub must be used within a DevHubProvider");
  }
  return context;
}
