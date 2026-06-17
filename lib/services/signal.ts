import * as presenceDb from "@/lib/db/presence";
import * as signalDb from "@/lib/db/signal";
import {
  LIFECYCLE_TYPES,
  RECIPIENT_TYPES,
  sendDecline,
  TARGET_REQUIRED_TYPES,
  type ParsedSignalBody,
} from "@/lib/utils/signal";

type DeliverResult =
  | { ok: true; autoDeclined?: true }
  | { ok: false; status: number; error: string };

export async function deliverSignal(
  data: ParsedSignalBody,
): Promise<DeliverResult> {
  const { fromId, toId, signalType, payload } = data;

  const [sender, target] = await Promise.all([
    presenceDb.findBusyState(fromId),
    presenceDb.findBusyState(toId),
  ]);

  if (!sender) {
    return { ok: false, status: 403, error: "not joined" };
  }

  if (signalType === "request") {
    const senderBusy = sender.busy;
    const targetUnavailable = !target || target.busy;

    if (senderBusy || targetUnavailable) {
      await sendDecline(toId, fromId);
      return { ok: true, autoDeclined: true };
    }
  }

  if (TARGET_REQUIRED_TYPES.includes(signalType) && !target) {
    return { ok: false, status: 404, error: "target offline" };
  }

  if (RECIPIENT_TYPES.includes(signalType)) {
    const pending = await signalDb.findPendingRequest(toId, fromId);
    if (!pending) {
      if (signalType === "decline") return { ok: true };
      return { ok: false, status: 409, error: "no pending request" };
    }
  }

  if (LIFECYCLE_TYPES.includes(signalType)) {
    if (signalType === "accept") {
      await presenceDb.setBusyForPeers([fromId, toId], true);
    } else {
      await presenceDb.setBusyForPeers(
        target ? [fromId, toId] : [fromId],
        false,
      );
    }

    // Push first so the recipient always gets accept/decline/end, then drop
    // the pending request row used for server-side authorization.
    if (target || signalType !== "end") {
      await signalDb.createMessage({
        fromId,
        toId,
        type: signalType,
        payload,
      });
    }

    await signalDb.deletePendingBetween(fromId, toId);
    return { ok: true };
  }

  await signalDb.createMessage({
    fromId,
    toId,
    type: signalType,
    payload,
  });

  return { ok: true };
}
