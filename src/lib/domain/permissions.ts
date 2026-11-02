import type { Role } from "./types";

export type Permission =
  | "viewFinancials"
  | "viewReports"
  | "useAssistant"
  | "manageSettings"
  | "managePolicies"
  | "manageCollections";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [
    "viewFinancials",
    "viewReports",
    "useAssistant",
    "manageSettings",
    "managePolicies",
    "manageCollections",
  ],
  corredor: [
    "viewFinancials",
    "viewReports",
    "useAssistant",
    "manageSettings",
    "managePolicies",
    "manageCollections",
  ],
  asistente: ["managePolicies", "manageCollections"],
};

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  corredor: "Corredor",
  asistente: "Asistente",
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
