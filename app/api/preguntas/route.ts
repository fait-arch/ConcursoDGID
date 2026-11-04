import { readFile } from "node:fs/promises";
import path from "node:path";

// Se lee del disco en cada petición: basta con editar preguntas.json y volver a cargarlo.
export const dynamic = "force-dynamic";

export async function GET() {
  const file = path.join(process.cwd(), "preguntas.json");
  try {
    const text = await readFile(file, "utf8");
    return new Response(text, {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: `No se encontró preguntas.json en ${process.cwd()}. Crea el archivo ahí o ábrelo con «Abrir otro archivo».` },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
}
