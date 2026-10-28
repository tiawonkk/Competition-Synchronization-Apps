/**
 * Persistent ringing alarm built on the Web Audio API (no external audio assets).
 * Browsers only allow audio after a user gesture, so `unlock()` must be called from a click handler.
 */
class RingingAlarm {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private muteTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private master: GainNode | null = null;

  get ringing() {
    return this.timer !== null;
  }

  /** Create/resume the AudioContext. Returns false if audio is unavailable. */
  unlock(): boolean {
    if (typeof window === "undefined") return false;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  private bell(freq: number, start: number, duration: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const harmonic = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    harmonic.type = "sine";
    osc.frequency.value = freq;
    harmonic.frequency.value = freq * 2;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.9, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    harmonic.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    harmonic.start(start);
    osc.stop(start + duration + 0.05);
    harmonic.stop(start + duration + 0.05);
  }

  /** One "ring": a rapid 4-pulse digital-clock pattern, repeated every 1.6s until stopped. */
  private burst() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [0, 0.18, 0.36, 0.54].forEach((o, i) => this.bell(i % 2 ? 1175 : 988, t + o, 0.14));
  }

  start() {
    if (this.timer || !this.unlock()) return;
    this.burst();
    this.timer = setInterval(() => this.burst(), 1600);
    this.vibrate([300, 150, 300, 150, 300]);
  }

  private vibrate(pattern: number | number[]) {
    try {
      if (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(pattern);
    } catch {
      /* vibration is optional */
    }
  }

  /** Temporarily silence the sound while the alarm stays armed. */
  muteFor(ms: number) {
    this.muted = true;
    if (this.muteTimer) clearTimeout(this.muteTimer);
    this.muteTimer = setTimeout(() => (this.muted = false), ms);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.muteTimer) clearTimeout(this.muteTimer);
    this.timer = null;
    this.muteTimer = null;
    this.muted = false;
    this.vibrate(0);
  }
}

export const alarm = new RingingAlarm();

/** Best-effort browser push notification (requires permission, granted from a user gesture). */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function pushNotify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "competesync-alarm", requireInteraction: true, icon: "/icon.svg" });
  } catch {
    /* some mobile browsers only allow notifications via a service worker */
  }
}
