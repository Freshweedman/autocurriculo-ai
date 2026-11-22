export function POST() {
  return Response.json({ error: "A busca agora roda pelo painel web. Abra a Central de Automação." }, { status: 410 });
}
