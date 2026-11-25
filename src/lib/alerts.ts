"use client";

export type AlertLevel = "info" | "success" | "warning" | "error";

let audioContext: AudioContext | null = null;

/** Short synthesised tone — no third-party assets, works offline. */
export function playAlertTone(level: AlertLevel = "info") {
  if (typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext = audioContext ?? new Ctor();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = level === "error" ? 220 : level === "warning" ? 330 : level === "success" ? 880 : 520;
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.3);
  } catch {
    /* audio is best-effort */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function raiseAlert(
  title: string,
  body: string,
  level: AlertLevel = "info",
  options: { sound?: boolean; notify?: boolean } = {},
) {
  const { sound = true, notify = true } = options;
  if (sound) playAlertTone(level);
  if (!notify) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/logo.svg", tag: `vortex-${level}`, silent: true });
  } catch {
    /* notifications may be blocked */
  }
}
