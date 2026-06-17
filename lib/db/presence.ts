import { prisma } from "@/lib/prisma";

export async function findAuthTokenHash(sessionId: string) {
  return prisma.presence.findUnique({
    where: { id: sessionId },
    select: { authTokenHash: true },
  });
}

export async function findBusyState(sessionId: string) {
  return prisma.presence.findUnique({
    where: { id: sessionId },
    select: { busy: true },
  });
}

export async function createOnJoin(input: {
  id: string;
  authTokenHash: string;
  lat: number;
  lng: number;
}): Promise<boolean> {
  const now = new Date();
  try {
    await prisma.presence.create({
      data: {
        id: input.id,
        authTokenHash: input.authTokenHash,
        lat: input.lat,
        lng: input.lng,
        busy: false,
        lastSeen: now,
      },
    });
    return true;
  } catch (error) {
    const existing = await findAuthTokenHash(input.id);
    if (existing) return false;
    throw error;
  }
}

export async function heartbeat(sessionId: string, at: Date) {
  await prisma.presence.updateMany({
    where: { id: sessionId },
    data: { lastSeen: at },
  });
}

export async function deleteStale(before: Date) {
  await prisma.presence.deleteMany({
    where: { lastSeen: { lt: before } },
  });
}

export async function listOnlinePeers(excludeId: string, staleCutoff: Date) {
  return prisma.presence.findMany({
    where: {
      id: { not: excludeId },
      lastSeen: { gte: staleCutoff },
    },
    select: { id: true, lat: true, lng: true, busy: true },
  });
}

export async function setBusyForPeers(ids: string[], busy: boolean) {
  await prisma.presence.updateMany({
    where: { id: { in: ids } },
    data: { busy },
  });
}

export async function deleteById(sessionId: string) {
  await prisma.presence.deleteMany({ where: { id: sessionId } });
}
