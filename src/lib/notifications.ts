export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

let scheduledTimeout: number | null = null;

export function scheduleBreakFastReminder(targetTs: number, protocolLabel: string) {
  cancelBreakFastReminder();
  const delay = targetTs - Date.now();
  if (delay <= 0 || delay > 2_147_483_000) return;
  scheduledTimeout = window.setTimeout(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Fast target reached", {
        body: `You hit your ${protocolLabel} target. Break the fast or keep going.`,
        icon: "/favicon.svg",
      });
    }
  }, delay);
}

export function cancelBreakFastReminder() {
  if (scheduledTimeout !== null) {
    window.clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }
}
