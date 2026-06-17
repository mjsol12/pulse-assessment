import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";

export async function deleteStale(before: Date) {
  await prisma.signal.deleteMany({
    where: { createdAt: { lt: before } },
  });
}

export async function findInbox(toId: string) {
  return prisma.signal.findMany({
    where: { toId },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteByIds(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.signal.deleteMany({
    where: { id: { in: ids } },
  });
}

/** Read mailbox and delete delivered signals (keeps pending requests). */
export async function drainInbox(toId: string) {
  const inbox = await findInbox(toId);
  const deliveredIds = inbox
    .filter((signal) => signal.type !== "request")
    .map((signal) => signal.id);
  await deleteByIds(deliveredIds);
  return inbox;
}

export async function deleteForSession(sessionId: string) {
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: sessionId }, { fromId: sessionId }] },
  });
}

export async function findPendingRequest(fromId: string, toId: string) {
  return prisma.signal.findFirst({
    where: { fromId, toId, type: "request" },
    orderBy: { createdAt: "desc" },
  });
}

export async function deletePendingBetween(peerA: string, peerB: string) {
  await prisma.signal.deleteMany({
    where: {
      type: "request",
      OR: [
        { fromId: peerA, toId: peerB },
        { fromId: peerB, toId: peerA },
      ],
    },
  });
}

export async function createMessage(input: {
  fromId: string;
  toId: string;
  type: SignalType;
  payload: string | null;
}) {
  await prisma.signal.create({
    data: {
      fromId: input.fromId,
      toId: input.toId,
      type: input.type,
      payload: input.payload,
    },
  });
}

export async function createDecline(fromId: string, toId: string) {
  await createMessage({
    fromId,
    toId,
    type: "decline",
    payload: null,
  });
}
