import { Check, X, Minus } from "lucide-react";
import PageShell from "@/components/PageShell";

type Cell = boolean | "partial" | string;

export type CompareRow = {
  feature: string;
  testsurge: Cell;
  competitor: Cell;
};

function renderCell(value: Cell) {
  if (value === true) {
    return <Check className="mx-auto text-accent" size={20} strokeWidth={3} />;
  }
  if (value === false) {
    return <X className="mx-auto text-gray-300" size={20} strokeWidth={3} />;
  }
  if (value === "partial") {
    return <Minus className="mx-auto text-text-light" size={20} strokeWidth={3} />;
  }
  return <span className="text-text-secondary">{value}</span>;
}

export default function ComparePage({
  competitorName,
  intro,
  rows,
  forCompetitor,
  forTestSurge,
  verdict,
}: {
  competitorName: string;
  intro: string;
  rows: CompareRow[];
  forCompetitor: string;
  forTestSurge: string;
  verdict: string;
}) {
  return (
    <PageShell>
      <article className="mx-auto max-w-4xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          TestSurge vs {competitorName}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">{intro}</p>

        <div className="mt-10 overflow-x-auto rounded-2xl shadow-sm">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 rounded-2xl bg-white text-center">
            <thead>
              <tr>
                <th className="bg-white p-4 text-left font-heading text-sm font-bold text-text-primary">
                  Feature
                </th>
                <th className="bg-secondary p-4 font-heading text-sm font-bold text-white">
                  TestSurge
                </th>
                <th className="bg-white p-4 font-heading text-sm font-bold text-text-primary">
                  {competitorName}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.feature}>
                  <td
                    className={`p-4 text-left font-medium text-text-primary ${
                      i % 2 === 0 ? "bg-white" : "bg-muted"
                    }`}
                  >
                    {row.feature}
                  </td>
                  <td className={`p-4 ${i % 2 === 0 ? "bg-secondary/5" : "bg-secondary/10"}`}>
                    {renderCell(row.testsurge)}
                  </td>
                  <td className={`p-4 ${i % 2 === 0 ? "bg-white" : "bg-muted"}`}>
                    {renderCell(row.competitor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-muted p-6">
            <h2 className="font-heading text-xl font-bold text-text-primary">
              Who should use {competitorName}?
            </h2>
            <p className="mt-3 leading-relaxed text-text-secondary">{forCompetitor}</p>
          </div>
          <div className="rounded-2xl border-t-[3px] border-secondary bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-bold text-text-primary">
              Who should use TestSurge?
            </h2>
            <p className="mt-3 leading-relaxed text-text-secondary">{forTestSurge}</p>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold text-text-primary">Verdict</h2>
          <p className="mt-3 leading-relaxed text-text-secondary">{verdict}</p>
        </section>

        <section className="mt-12 rounded-2xl bg-text-primary p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-white">
            See TestSurge in action
          </h2>
          <p className="mt-2 text-gray-300">
            Generate your first set of test cases free — no credit card needed.
          </p>
          <a
            href="/signup"
            className="mt-6 inline-block rounded-full bg-secondary px-8 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105"
          >
            Try TestSurge Free
          </a>
        </section>
      </article>
    </PageShell>
  );
}
