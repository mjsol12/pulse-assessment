import * as presenceDb from "@/lib/db/presence";
import * as signalDb from "@/lib/db/signal";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import type { PollResponse, SignalMsg, SignalType } from "@/lib/types";

type InboxRow = Awaited<ReturnType<typeof signalDb.drainInbox>>[number];

function toSignalMsg(signal: InboxRow): SignalMsg {
  return {
    id: signal.id,
    fromId: signal.fromId,
    toId: signal.toId,
    type: signal.type as SignalType,
    payload: signal.payload,
    createdAt: signal.createdAt.toISOString(),
  };
}

export async function getPollResponse(sessionId: string): Promise<PollResponse> {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  await presenceDb.heartbeat(sessionId, new Date(now));
  await presenceDb.deleteStale(staleCutoff);
  await signalDb.deleteStale(signalCutoff);

  const [peers, inbox] = await Promise.all([
    presenceDb.listOnlinePeers(sessionId, staleCutoff),
    signalDb.drainInbox(sessionId),
  ]);

  return {
    peers,
    signals: inbox.map(toSignalMsg),
  };
}
