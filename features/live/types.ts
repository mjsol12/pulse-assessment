export type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

export type VideoState = "none" | "requesting" | "incoming" | "active";

export type Location = { lat: number; lng: number };
