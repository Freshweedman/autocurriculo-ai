import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MARKETPLACE_CHANNELS } from "@/lib/marketplace-channels";
import { buildMarketplaceCopy } from "@/lib/marketplace-copy";
import { getAuthenticatedAdmin } from "@/lib/admin";

interface ChannelRow {
  id: string;
  name: string;
  type: string;
  platform: string | null;
  url: string | null;
  publication_mode: string | null;
  status: string | null;
}

async function ensureChannels(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: existing, error } = await supabase
    .from("channels")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ativo");

  if (error) throw new Error(error.message);

  const existingTypes = new Set((existing || []).map((channel) => channel.type));
  const missing = DEFAULT_MARKETPLACE_CHANNELS
    .filter((channel) => !existingTypes.has(channel.type))
    .map((channel) => ({ ...channel, user_id: userId }));

  if (missing.length) {
    const { error: insertError } = await supabase.from("channels").insert(missing);
    if (insertError) throw new Error(insertError.message);
  }

  for (const preset of DEFAULT_MARKETPLACE_CHANNELS) {
    if (!existingTypes.has(preset.type)) continue;
    const current = (existing || []).find((channel) => channel.type === preset.type);
    if (!current) continue;
    const needsUpdate =
      current.name !== preset.name ||
      current.publication_mode !== preset.publication_mode ||
      current.platform !== preset.platform ||
      current.url !== preset.url ||
      current.notes !== preset.notes;
    if (!needsUpdate) continue;
    const { error: updateError } = await supabase
      .from("channels")
      .update({
        name: preset.name,
        publication_mode: preset.publication_mode,
        platform: preset.platform,
        url: preset.url,
        notes: preset.notes,
      })
      .eq("user_id", userId)
      .eq("type", preset.type);
    if (updateError) throw new Error(updateError.message);
  }

  const { data: channels, error: reloadError } = await supabase
    .from("channels")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ativo")
    .order("name");

  if (reloadError) throw new Error(reloadError.message);
  return (channels || []) as ChannelRow[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });

  const { service_id, campaign_id = null, tone = "profissional", channel_ids = [], automation_mode = "semi" } = await req.json();
  if (!service_id) return NextResponse.json({ error: "service_id required" }, { status: 400 });

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .eq("id", service_id)
    .eq("user_id", user.id)
    .single();

  if (serviceError || !service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

  try {
    const activeChannels = await ensureChannels(supabase, user.id);
    const selectedIds = Array.isArray(channel_ids) ? new Set(channel_ids as string[]) : new Set<string>();
    const channels = selectedIds.size
      ? activeChannels.filter((channel) => selectedIds.has(channel.id))
      : activeChannels;

    if (!channels.length) {
      return NextResponse.json({ error: "Nenhum canal ativo selecionado" }, { status: 400 });
    }

    const created: Array<{ queue_id: string; pamphlet_id: string; channel_id: string; platform: string; mode: string }> = [];
    const automationTasks = [];

    for (const channel of channels) {
      const platform = channel.platform || channel.type;
      const copy = buildMarketplaceCopy(platform, service, tone);

      const { data: pamphlet, error: pamphletError } = await supabase
        .from("generated_pamphlets")
        .insert({
          user_id: user.id,
          service_id,
          campaign_id,
          channel_id: channel.id,
          platform,
          title: copy.title.slice(0, 120),
          long_description: copy.long_description,
          tags: copy.tags,
          price_text: copy.price_text,
          tone,
          status: "pronto",
        })
        .select()
        .single();

      if (pamphletError) throw new Error(pamphletError.message);

      const mode = channel.publication_mode || "manual";
      const queueStatus = mode === "runner" ? "pendente" : "pronto";
      const requiresConfirmation = automation_mode !== "full" || mode !== "api";
      const { data: queueItem, error: queueError } = await supabase
        .from("publishing_queue")
        .insert({
          user_id: user.id,
          service_id,
          campaign_id,
          channel_id: channel.id,
          pamphlet_id: pamphlet.id,
          task_type: "publicar",
          status: queueStatus,
          priority: mode === "runner" ? 8 : mode === "assisted" ? 7 : 5,
          target_url: channel.url,
          observations: mode === "runner"
            ? `Modo ${automation_mode}. O runner local preenche quando possível${requiresConfirmation ? " e aguarda confirmação antes do envio final." : " e pode publicar apenas em integrações oficiais conectadas."}`
            : `Modo ${automation_mode}. Revise, copie e publique manualmente.`,
        })
        .select()
        .single();

      if (queueError) throw new Error(queueError.message);

      created.push({
        queue_id: queueItem.id,
        pamphlet_id: pamphlet.id,
        channel_id: channel.id,
        platform,
        mode,
      });

      if (mode === "runner") {
        automationTasks.push({
          user_id: user.id,
          queue_id: queueItem.id,
          platform,
          task_type: "preencher_anuncio",
          status: "pendente",
          payload_json: {
            target_url: channel.url,
            channel_name: channel.name,
            pamphlet_id: pamphlet.id,
            automation_mode,
          },
          requires_human_confirmation: requiresConfirmation,
        });
      }
    }

    if (automationTasks.length) {
      const { error: taskError } = await supabase.from("automation_tasks").insert(automationTasks);
      if (taskError) throw new Error(taskError.message);
    }

    return NextResponse.json({
      ok: true,
      queued: created.length,
      runner_tasks: automationTasks.length,
      manual_tasks: created.length - automationTasks.length,
      automation_mode,
      items: created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
