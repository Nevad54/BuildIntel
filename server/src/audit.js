import { store } from "./store.js";

export const recordAudit = async ({ companyId = null, actorUserId = null, action, entityType, entityId = null, details = {} }) => {
  try {
    await store.insert("auditLogs", {
      companyId,
      actorUserId,
      action,
      entityType,
      entityId,
      details,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to persist audit log", error);
  }
};
