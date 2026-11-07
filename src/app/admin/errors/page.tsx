import { sql } from "@/lib/db";

type Row = { id: string; message: string; path: string | null; digest: string | null; count: number; first_at: Date; last_at: Date; emailed_at: Date | null };

const when = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Server errors, grouped: the same error on the same page is one line with how many times.
export default async function AdminErrors() {
  const rows = await sql<Row[]>`select * from app_errors order by last_at desc limit 100`;
  return (
    <>
      <h1 className="text-2xl font-extrabold">Erros no servidor</h1>
      <p className="text-sm text-muted">
        Quando um erro aparece pela primeira vez, vai um e-mail para ADMIN_EMAILS (no máximo um por dia para o mesmo erro).
        O &quot;digest&quot; ajuda a achar o erro nos logs do Netlify (Logs → Functions).
      </p>
      {rows.length === 0 ? <p className="card p-4 text-success font-semibold">Nenhum erro registrado. 🎉</p> : (
        <div className="card divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="space-y-1 p-3">
              <p className="font-mono text-sm font-semibold break-words">{r.message}</p>
              <p className="text-xs text-muted">
                {r.path} · {r.count}× · primeira vez {when(r.first_at)} · última {when(r.last_at)}
                {r.digest ? ` · digest ${r.digest}` : ""}{r.emailed_at ? " · e-mail enviado" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
