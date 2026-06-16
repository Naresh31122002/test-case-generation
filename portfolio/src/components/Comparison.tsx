"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const COLUMNS = ["Feature", "TestSurge", "TestRail", "Qase", "Testsigma"];

type Cell = boolean | string;

const ROWS: { feature: string; values: Cell[] }[] = [
  {
    feature: "Change Impact Analysis",
    values: ["only-us", false, false, false],
  },
  {
    feature: "Story Critique",
    values: [true, false, false, false],
  },
  {
    feature: "RAG Team Learning",
    values: [true, false, false, false],
  },
  {
    feature: "Transparent Pricing",
    values: [true, false, true, false],
  },
  {
    feature: "Jira Integration",
    values: [true, true, true, true],
  },
];

function renderCell(value: Cell) {
  if (value === true) {
    return <Check className="mx-auto text-accent" size={20} strokeWidth={3} />;
  }
  if (value === false) {
    return <X className="mx-auto text-gray-300" size={20} strokeWidth={3} />;
  }
  if (value === "only-us") {
    return (
      <div className="flex flex-col items-center gap-1">
        <Check className="text-accent" size={20} strokeWidth={3} />
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-white">
          Only us
        </span>
      </div>
    );
  }
  return <span className="text-text-secondary">{value}</span>;
}

export default function Comparison() {
  return (
    <section className="bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            Why teams choose TestSurge
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Honest comparison. No cherry-picking.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-16 overflow-x-auto rounded-2xl shadow-sm md:overflow-x-visible"
        >
          <table className="w-full min-w-[700px] border-separate border-spacing-0 rounded-2xl bg-white text-center">
            <thead>
              <tr>
                {COLUMNS.map((col, i) => (
                  <th
                    key={col}
                    className={`sticky top-16 z-10 p-4 font-heading text-sm font-bold ${
                      i === 0 ? "text-left text-text-primary" : ""
                    } ${
                      col === "TestSurge"
                        ? "bg-secondary text-white"
                        : i !== 0
                        ? "bg-white text-text-primary"
                        : "bg-white"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, rowIndex) => (
                <tr key={row.feature}>
                  <td
                    className={`p-4 text-left font-medium text-text-primary ${
                      rowIndex % 2 === 0 ? "bg-white" : "bg-muted"
                    }`}
                  >
                    {row.feature}
                  </td>
                  {row.values.map((value, colIndex) => (
                    <td
                      key={colIndex}
                      className={`p-4 ${
                        colIndex === 0
                          ? "bg-secondary/5"
                          : rowIndex % 2 === 0
                          ? "bg-white"
                          : "bg-muted"
                      }`}
                    >
                      {renderCell(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <p className="mt-4 text-center text-sm text-text-light">
          Based on publicly available product capabilities.
        </p>
      </div>
    </section>
  );
}
