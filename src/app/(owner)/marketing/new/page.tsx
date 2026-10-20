import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayYmd } from "@/lib/format";
import { MARKETING_TEMPLATES, nextDate } from "@/lib/marketing-templates";
import { Page, PageHeader } from "@/components/ui";
import { createCampaignAction } from "../actions";

export const metadata: Metadata = { title: "New email" };

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export default async function NewCampaignPage() {
  const staff = await requireStaff();
  const today = todayYmd(staff.timezone);
  // Any-time templates first, then the holidays in the order they come up.
  const list = MARKETING_TEMPLATES.map((t) => ({ t, next: nextDate(t, today) }))
    .sort((a, b) => (a.next ?? "") < (b.next ?? "") ? -1 : (a.next ?? "") > (b.next ?? "") ? 1 : 0);
  const days = (d: string) => Math.round((new Date(`${d}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  return (
    <>
      <PageHeader title="Pick a template" back="/marketing" />
      <Page>
        <p className="text-sm text-muted">Everything can be changed in the next step. Holidays are in the order they come up; send about a week before.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map(({ t, next }) => (
            <li key={t.key}>
              <form action={createCampaignAction.bind(null, t.key)}>
                <button type="submit" className="card block w-full overflow-hidden p-0 text-left hover:shadow-md">
                  {t.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small static picture
                    <img src={t.banner} alt="" className="aspect-[5/2] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[5/2] w-full items-center justify-center bg-bg text-muted">Blank</span>
                  )}
                  <span className="block px-4 py-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{t.name}</span>
                      {next && (
                        <span className={`shrink-0 text-xs font-semibold ${days(next) <= 21 ? "text-brand" : "text-muted"}`}>
                          {days(next) === 0 ? "Today" : `${fmt(next)} · in ${days(next)} days`}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-sm text-muted">{t.subject || "Write your own"}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}
