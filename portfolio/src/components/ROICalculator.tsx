"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// TestSurge reclaims the bulk of manual test-writing time.
const TIME_SAVED_RATIO = 0.85;
const HOURLY_RATE = 60; // assumed blended QA engineer cost / hour (USD)

type Field = {
  key: "storiesPerWeek" | "hoursPerStory" | "engineers";
  label: string;
  min: number;
  max: number;
  step: number;
};

const FIELDS: Field[] = [
  { key: "storiesPerWeek", label: "Stories per week", min: 1, max: 100, step: 1 },
  { key: "hoursPerStory", label: "Hours per story", min: 0.5, max: 8, step: 0.5 },
  { key: "engineers", label: "QA engineers", min: 1, max: 50, step: 1 },
];

export default function ROICalculator() {
  const [values, setValues] = useState({
    storiesPerWeek: 20,
    hoursPerStory: 3,
    engineers: 4,
  });

  // Weekly writing hours across the team → monthly hours saved.
  const weeklyHours = values.storiesPerWeek * values.hoursPerStory;
  const monthlyHoursSaved = Math.round(weeklyHours * 4.33 * TIME_SAVED_RATIO);
  const dollarsSaved = monthlyHoursSaved * HOURLY_RATE;

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <section className="bg-muted px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            Calculate your ROI
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            See how many hours TestSurge gives back to your team every month.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-12 grid grid-cols-1 gap-8 rounded-3xl bg-white p-8 shadow-xl md:grid-cols-2 md:p-10"
        >
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={field.key}
                    className="text-sm font-medium text-text-primary"
                  >
                    {field.label}
                  </label>
                  <span className="font-heading text-sm font-bold text-secondary">
                    {values[field.key]}
                  </span>
                </div>
                <input
                  id={field.key}
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [field.key]: Number(e.target.value),
                    }))
                  }
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-secondary"
                />
              </div>
            ))}
          </div>

          {/* Output */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary/[0.06] p-8 text-center">
            <p className="text-sm font-medium text-text-secondary">
              You save approximately
            </p>
            <motion.p
              key={monthlyHoursSaved}
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="mt-2 font-heading text-5xl font-bold text-secondary"
            >
              {fmt(monthlyHoursSaved)} hrs
            </motion.p>
            <p className="text-sm text-text-secondary">per month</p>

            <div className="mt-6 rounded-xl bg-white px-6 py-4 shadow-sm">
              <p className="text-sm text-text-secondary">
                ={" "}
                <span className="font-heading text-2xl font-bold text-text-primary">
                  ${fmt(dollarsSaved)}
                </span>{" "}
                saved / month
              </p>
            </div>

            <p className="mt-4 text-xs text-text-light">
              Estimate assumes {Math.round(TIME_SAVED_RATIO * 100)}% less
              test-writing time at ${HOURLY_RATE}/hr.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
