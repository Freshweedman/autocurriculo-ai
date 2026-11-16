export type OpportunitySource = {
  id: string;
  provider: "greenhouse" | "lever" | "ashby" | "career_page";
  identifier: string;
  company_name: string | null;
};

export type OpportunityRecord = {
  source: string;
  source_job_id: string;
  canonical_url: string;
  title: string;
  company: string | null;
  description: string | null;
  location_text: string | null;
  work_mode: string | null;
  contract_type: string | null;
  published_at: string | null;
  last_checked_at: string;
  raw_data: Record<string, unknown>;
};

const REQUEST_TIMEOUT_MS = 12_000;

async function getJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Fonte respondeu HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }

export async function collectPublicOpportunities(source: OpportunitySource): Promise<OpportunityRecord[]> {
  const checkedAt = new Date().toISOString();
  if (source.provider === "greenhouse") {
    const board = encodeURIComponent(source.identifier);
    const payload = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`) as { jobs?: Array<Record<string, unknown>> };
    return (payload.jobs || []).flatMap((job) => {
      const id = String(job.id || ""); const url = text(job.absolute_url); const title = text(job.title);
      if (!id || !url || !title) return [];
      const location = job.location as Record<string, unknown> | null;
      return [{ source: "greenhouse", source_job_id: id, canonical_url: url, title, company: source.company_name, description: text(job.content), location_text: text(location?.name), work_mode: null, contract_type: null, published_at: text(job.updated_at) || text(job.first_published), last_checked_at: checkedAt, raw_data: job }];
    });
  }
  if (source.provider === "lever") {
    const site = encodeURIComponent(source.identifier);
    const payload = await getJson(`https://api.lever.co/v0/postings/${site}?mode=json`) as Array<Record<string, unknown>>;
    return payload.flatMap((job) => {
      const id = text(job.id); const url = text(job.hostedUrl); const title = text(job.text);
      if (!id || !url || !title) return [];
      const categories = (job.categories || {}) as Record<string, unknown>;
      return [{ source: "lever", source_job_id: id, canonical_url: url, title, company: source.company_name, description: text(job.descriptionPlain) || text(job.description), location_text: text(categories.location), work_mode: text(categories.commitment), contract_type: text(categories.team), published_at: null, last_checked_at: checkedAt, raw_data: job }];
    });
  }
  if (source.provider === "ashby") {
    const board = encodeURIComponent(source.identifier);
    const payload = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board}`) as { jobs?: Array<Record<string, unknown>> };
    return (payload.jobs || []).flatMap((job) => {
      const id = text(job.id) || text(job.jobUrl); const url = text(job.jobUrl) || text(job.applyUrl); const title = text(job.title);
      if (!id || !url || !title) return [];
      const location = job.location as Record<string, unknown> | null;
      return [{ source: "ashby", source_job_id: id, canonical_url: url, title, company: source.company_name, description: text(job.descriptionHtml), location_text: text(location?.name), work_mode: text(job.workplaceType), contract_type: text(job.employmentType), published_at: text(job.publishedAt), last_checked_at: checkedAt, raw_data: job }];
    });
  }
  throw new Error("Páginas genéricas de carreira exigem um adaptador específico e não são coletadas automaticamente.");
}
