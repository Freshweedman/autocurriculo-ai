"use client";
import { useEffect, useState } from "react";
export default function WebPushPrompt() {
  const [status, setStatus] = useState<"idle"|"enabled"|"unavailable">("idle");
  useEffect(() => { if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) setStatus("unavailable"); }, []);
  async function enable() {
    try { const key = (await (await fetch("/api/push")).json()).publicKey; if (!key) return setStatus("unavailable"); const permission = await Notification.requestPermission(); if (permission !== "granted") return; const reg = await navigator.serviceWorker.register("/push-sw.js"); const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(key.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0)) }); const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) }); if (r.ok) setStatus("enabled"); } catch { setStatus("unavailable"); }
  }
  if (status === "unavailable" || status === "enabled") return null;
  return <button className="btn-outline" onClick={() => void enable()}>Ativar avisos de novas vagas</button>;
}
