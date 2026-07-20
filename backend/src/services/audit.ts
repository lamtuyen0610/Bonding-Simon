import { prisma } from "../db";

export async function logAdminAction(params: {
  adminId?: string;
  adminName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: params.adminId,
      adminName: params.adminName,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });
}
