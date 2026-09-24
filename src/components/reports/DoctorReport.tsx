"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import type { PublicUser } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { dayMonth, longDate, MEAL_LABELS, rangeLabel, weekdayShort, type DailyReport, type WeeklyReport } from "./format";

/**
 * While this is mounted, printing the page prints ONLY the doctor report:
 * everything else in <body> is hidden, the report (portalled to <body>) is shown.
 */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  html, body { background: #fff !important; }
  body > *:not(#orza-print-root) { display: none !important; }
  #orza-print-root { display: block !important; }
}
`;

const SEX: Record<string, string> = { male: "Male", female: "Female", other: "Other" };
const DIET: Record<string, string> = { vegetarian: "Vegetarian", vegan: "Vegan", eggetarian: "Eggetarian", non_vegetarian: "Non-vegetarian", jain: "Jain" };
const GOAL: Record<string, string> = { lose: "Lose weight", maintain: "Maintain weight", gain: "Gain weight" };

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`border-b border-[#999] px-1.5 py-1 text-left text-[9.5pt] font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-[#ddd] px-1.5 py-1 text-[9.5pt] tabular-nums ${className}`}>{children}</td>;
}

/** Print-only, doctor-friendly summary (plain black on white, tables, no decoration). */
export function DoctorReport({ user, weekly, daily, generatedOn }: { user: PublicUser; weekly: WeeklyReport | null; daily: DailyReport | null; generatedOn: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const p = user.profile || {};
  const facts = [
    ["Name", user.name || "—"],
    ["Age", p.age ? `${p.age} years` : "—"],
    ["Sex", p.sex ? SEX[p.sex] : "—"],
    ["Height", p.height_cm ? `${p.height_cm} cm` : "—"],
    ["Weight", p.weight_kg ? `${p.weight_kg} kg` : "—"],
    ["Goal", p.goal ? GOAL[p.goal] : "—"],
    ["Diet", p.diet ? DIET[p.diet] : "—"],
    ["Allergies", (p.allergies || []).filter((a) => a && a.toLowerCase() !== "none").join(", ") || "None recorded"],
  ];
  const t = weekly?.targets || daily?.targets;

  return createPortal(
    <div id="orza-print-root" className="hidden bg-white font-sans text-[10.5pt] leading-snug text-black print:block">
      <style>{PRINT_CSS}</style>

      <header className="flex items-end justify-between border-b-2 border-black pb-2">
        <div>
          <div className="font-editorial text-[18pt] font-semibold">ÖRZA</div>
          <div className="text-[12pt]">Nutrition &amp; activity summary</div>
        </div>
        <div className="text-right text-[9pt] text-[#333]">
          Generated {longDate(generatedOn)}
          {weekly && <div>Period: {rangeLabel(weekly.start, weekly.end)}</div>}
        </div>
      </header>

      <section className="mt-3">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              {facts.slice(0, 4).map(([k, v]) => (
                <td key={k} className="py-0.5 pr-3 align-top text-[9.5pt]">
                  <span className="text-[#555]">{k}: </span>
                  {v}
                </td>
              ))}
            </tr>
            <tr>
              {facts.slice(4).map(([k, v]) => (
                <td key={k} className="py-0.5 pr-3 align-top text-[9.5pt]">
                  <span className="text-[#555]">{k}: </span>
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {t && (
          <p className="mt-1.5 text-[9.5pt]">
            <span className="text-[#555]">Daily targets: </span>
            {formatNumber(t.calories)} kcal · protein {t.protein_g} g · carbs {t.carbs_g} g · fat {t.fat_g} g · fibre {t.fiber_g} g · water {t.water_glasses}{" "}
            glasses · {formatNumber(t.steps)} steps
          </p>
        )}
      </section>

      {weekly && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-[12pt] font-semibold">Seven-day log · {rangeLabel(weekly.start, weekly.end)}</h2>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <Th>Day</Th>
                <Th className="text-right">kcal</Th>
                <Th className="text-right">Protein g</Th>
                <Th className="text-right">Carbs g</Th>
                <Th className="text-right">Fat g</Th>
                <Th className="text-right">Fibre g</Th>
                <Th className="text-right">Water</Th>
                <Th className="text-right">Steps</Th>
                <Th className="text-right">Weight kg</Th>
                <Th className="text-right">Meals</Th>
              </tr>
            </thead>
            <tbody>
              {weekly.days.map((d) => (
                <tr key={d.date}>
                  <Td>
                    {weekdayShort(d.date)} {dayMonth(d.date)}
                  </Td>
                  <Td className="text-right">{d.meals_count ? formatNumber(d.calories) : "—"}</Td>
                  <Td className="text-right">{d.meals_count ? d.protein_g : "—"}</Td>
                  <Td className="text-right">{d.meals_count ? d.carbs_g : "—"}</Td>
                  <Td className="text-right">{d.meals_count ? d.fat_g : "—"}</Td>
                  <Td className="text-right">{d.meals_count ? d.fiber_g : "—"}</Td>
                  <Td className="text-right">{d.water_glasses || "—"}</Td>
                  <Td className="text-right">{d.steps ? formatNumber(d.steps) : "—"}</Td>
                  <Td className="text-right">{d.weight_kg ?? "—"}</Td>
                  <Td className="text-right">{d.meals_count}</Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>Average*</Td>
                <Td className="text-right">{weekly.logged_days ? formatNumber(weekly.averages.calories) : "—"}</Td>
                <Td className="text-right">{weekly.logged_days ? weekly.averages.protein_g : "—"}</Td>
                <Td className="text-right">{weekly.logged_days ? weekly.averages.carbs_g : "—"}</Td>
                <Td className="text-right">{weekly.logged_days ? weekly.averages.fat_g : "—"}</Td>
                <Td className="text-right">{weekly.logged_days ? weekly.averages.fiber_g : "—"}</Td>
                <Td className="text-right">{weekly.averages.water_glasses || "—"}</Td>
                <Td className="text-right">{weekly.averages.steps ? formatNumber(weekly.averages.steps) : "—"}</Td>
                <Td className="text-right">{weekly.weight ? weekly.weight.last : "—"}</Td>
                <Td className="text-right">{weekly.logged_days}/7</Td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[8.5pt] text-[#555]">
            *Nutrition averages cover days with at least one logged meal; water and steps cover days they were tracked. Water in glasses (~250 ml).
          </p>
          <p className="mt-2 text-[10pt]">
            Days within ±10% of the calorie target: <strong>{weekly.adherence}</strong> of {weekly.logged_days} logged day{weekly.logged_days === 1 ? "" : "s"}.
          </p>
          <p className="mt-1.5 text-[10pt]">{weekly.summary}</p>
        </section>
      )}

      {daily && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-[12pt] font-semibold">Day detail · {longDate(daily.date)}</h2>
          <p className="mt-1 text-[10pt]">
            {formatNumber(daily.totals.calories)} kcal · protein {daily.totals.protein_g} g · carbs {daily.totals.carbs_g} g · fat {daily.totals.fat_g} g · fibre{" "}
            {daily.totals.fiber_g} g · water {daily.tracking.water_glasses} glasses · {formatNumber(daily.tracking.steps)} steps
            {daily.tracking.weight_kg ? ` · weight ${daily.tracking.weight_kg} kg` : ""}
          </p>
          {daily.meals.length ? (
            <table className="mt-1.5 w-full border-collapse">
              <thead>
                <tr>
                  <Th>Meal</Th>
                  <Th>Foods</Th>
                  <Th className="text-right">kcal</Th>
                  <Th className="text-right">Protein g</Th>
                  <Th className="text-right">Carbs g</Th>
                  <Th className="text-right">Fat g</Th>
                </tr>
              </thead>
              <tbody>
                {daily.meals.map((m) => (
                  <tr key={m.id}>
                    <Td>{MEAL_LABELS[m.meal_type] || m.meal_type}</Td>
                    <Td>{m.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ") || m.description}</Td>
                    <Td className="text-right">{formatNumber(m.totals.calories)}</Td>
                    <Td className="text-right">{m.totals.protein_g}</Td>
                    <Td className="text-right">{m.totals.carbs_g}</Td>
                    <Td className="text-right">{m.totals.fat_g}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-1 text-[10pt] text-[#555]">No meals logged on this day.</p>
          )}
        </section>
      )}

      <footer className="mt-6 border-t border-[#999] pt-2 text-[8.5pt] leading-relaxed text-[#444]">
        Self-logged data from the ÖRZA wellness app. Nutrition values are estimates from photos, text and food databases. This is general
        wellness information — not a medical record, diagnosis or treatment advice.
      </footer>
    </div>,
    document.body
  );
}
