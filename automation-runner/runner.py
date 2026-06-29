"""
AutoCurriculo AI — Automation Runner
Servidor local Python que preenche plataformas externas com Playwright.
O agente NÃO publica sem confirmação humana.

Uso:
  pip install -r requirements.txt
  playwright install chromium
  python runner.py

API local em http://localhost:8765
"""

import asyncio
import base64
import json
import os
import time
from datetime import datetime
from pathlib import Path

import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
RUNNER_PORT = int(os.getenv("RUNNER_PORT", "8765"))

app = FastAPI(title="AutoCurriculo AI Runner", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_headers():
    return {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

def get_pending_tasks():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/automation_tasks?status=eq.pendente&select=*,publishing_queue(*,channels(*),services(*),generated_pamphlets(*))",
        headers=sb_headers()
    )
    return r.json() if r.ok else []

def update_task(task_id: str, payload: dict):
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/automation_tasks?id=eq.{task_id}",
        headers={**sb_headers(), "Prefer": "return=minimal"},
        json=payload
    )

def update_queue(queue_id: str, payload: dict):
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/publishing_queue?id=eq.{queue_id}",
        headers={**sb_headers(), "Prefer": "return=minimal"},
        json=payload
    )

# ── Screenshot helper ─────────────────────────────────────────────────────────

async def take_screenshot(page) -> str:
    """Take screenshot, return base64 data URI."""
    try:
        data = await page.screenshot(type="jpeg", quality=60)
        b64 = base64.b64encode(data).decode()
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return ""

# ── Platform runners ──────────────────────────────────────────────────────────

async def run_olx(page, task: dict):
    """Fill OLX ad form. Does NOT submit without human confirmation."""
    pq = task.get("publishing_queue", {})
    pamphlet = pq.get("generated_pamphlets", {}) or {}
    channel = pq.get("channels", {}) or {}
    service = pq.get("services", {}) or {}

    url = channel.get("url") or "https://www.olx.com.br/anunciar"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(3)

    # Title
    for sel in ['input[placeholder*="título"]', 'input[name="subject"]', 'input[id*="title"]', '#subject']:
        el = await page.query_selector(sel)
        if el:
            title = pamphlet.get("title", service.get("name", ""))[:60]
            await el.fill(title)
            break

    # Description
    for sel in ['textarea[placeholder*="descrição"]', 'textarea[name="body"]', '#body']:
        el = await page.query_selector(sel)
        if el:
            desc = pamphlet.get("long_description", "")[:1000]
            await el.fill(desc)
            break

    screenshot = await take_screenshot(page)
    return {"screenshot": screenshot, "message": "Formulário OLX preenchido. Revise e confirme manualmente antes de publicar."}


async def run_workana(page, task: dict):
    """Fill Workana proposal."""
    pq = task.get("publishing_queue", {})
    pamphlet = pq.get("generated_pamphlets", {}) or {}
    channel = pq.get("channels", {}) or {}

    url = channel.get("url") or "https://www.workana.com/pt/jobs"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(3)

    screenshot = await take_screenshot(page)
    return {"screenshot": screenshot, "message": "Página Workana aberta. Copie a proposta e preencha manualmente."}


async def run_facebook_marketplace(page, task: dict):
    """Open Facebook Marketplace create item."""
    pq = task.get("publishing_queue", {})
    channel = pq.get("channels", {}) or {}
    url = channel.get("url") or "https://www.facebook.com/marketplace/create/item"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(3)

    pamphlet = (pq.get("generated_pamphlets") or {})
    for sel in ['input[placeholder*="Título"]', 'input[aria-label*="Título"]']:
        el = await page.query_selector(sel)
        if el:
            await el.fill(pamphlet.get("title", "")[:100])
            break

    screenshot = await take_screenshot(page)
    return {"screenshot": screenshot, "message": "Marketplace Facebook aberto. Complete e confirme antes de publicar."}


PLATFORM_RUNNERS = {
    "olx": run_olx,
    "facebook_marketplace": run_facebook_marketplace,
    "workana": run_workana,
    "99freelas": run_workana,  # mesma lógica de navegação
}

# ── Task processor ────────────────────────────────────────────────────────────

async def process_task(task: dict):
    from playwright.async_api import async_playwright

    task_id = task["id"]
    queue_id = task.get("queue_id")
    platform = task.get("platform", "")

    update_task(task_id, {"status": "rodando", "started_at": datetime.utcnow().isoformat()})
    if queue_id:
        update_queue(queue_id, {"status": "em_preenchimento"})

    runner_fn = PLATFORM_RUNNERS.get(platform)
    if not runner_fn:
        update_task(task_id, {"status": "erro", "result_json": json.dumps({"message": f"Plataforma '{platform}' sem runner implementado."}), "finished_at": datetime.utcnow().isoformat()})
        return

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=False, args=["--no-sandbox"])
            context = await browser.new_context(viewport={"width": 1366, "height": 768}, locale="pt-BR")
            page = await context.new_page()

            result = await runner_fn(page, task)

            update_task(task_id, {
                "status": "aguardando_confirmacao",
                "requires_human_confirmation": True,
                "result_json": json.dumps(result),
            })
            if queue_id:
                update_queue(queue_id, {"status": "aguardando_confirmacao"})

            # Keep browser open for 5 minutes for human review
            await asyncio.sleep(300)
            await browser.close()

    except Exception as e:
        update_task(task_id, {"status": "erro", "result_json": json.dumps({"message": str(e)}), "finished_at": datetime.utcnow().isoformat()})
        if queue_id:
            update_queue(queue_id, {"status": "erro", "error_message": str(e)})

# ── FastAPI routes ────────────────────────────────────────────────────────────

@app.get("/status")
def status():
    return {"ok": True, "runner": "AutoCurriculo AI Runner", "version": "1.0.0", "time": datetime.utcnow().isoformat()}

@app.post("/run/{task_id}")
async def run_task(task_id: str):
    """Trigger a specific automation task by ID."""
    r = requests.get(f"{SUPABASE_URL}/rest/v1/automation_tasks?id=eq.{task_id}&select=*,publishing_queue(*,channels(*),services(*),generated_pamphlets(*))", headers=sb_headers())
    tasks = r.json()
    if not tasks:
        return {"error": "Task not found"}
    asyncio.create_task(process_task(tasks[0]))
    return {"ok": True, "message": f"Task {task_id} started"}

@app.post("/poll")
async def poll_and_run():
    """Fetch all pending tasks and process them."""
    tasks = get_pending_tasks()
    if not tasks:
        return {"ok": True, "message": "No pending tasks"}
    for task in tasks[:3]:  # max 3 concurrent
        asyncio.create_task(process_task(task))
    return {"ok": True, "started": len(tasks[:3])}

if __name__ == "__main__":
    print("=" * 50)
    print("  AutoCurriculo AI — Automation Runner")
    print(f"  Servidor: http://localhost:{RUNNER_PORT}")
    print("  O navegador abrirá no modo visível (não headless)")
    print("  O agente NUNCA publica sem sua confirmação")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=RUNNER_PORT, log_level="info")
