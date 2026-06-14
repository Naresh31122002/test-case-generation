import { TestCase } from "@/lib/api"

export type ScriptFormat = "playwright" | "cypress" | "gherkin" | "pytest" | "robot"

export interface FormatMeta {
  id: ScriptFormat
  label: string
  ext: string
  language: string
  description: string
}

export const FORMATS: FormatMeta[] = [
  { id: "playwright", label: "Playwright",      ext: "spec.ts",    language: "typescript", description: "TypeScript test suite using @playwright/test" },
  { id: "cypress",    label: "Cypress",         ext: "cy.js",      language: "javascript", description: "JavaScript test suite using Cypress" },
  { id: "gherkin",    label: "Gherkin / BDD",   ext: "feature",    language: "gherkin",    description: "Behaviour-Driven Development .feature file" },
  { id: "pytest",     label: "pytest",           ext: "test_x.py",  language: "python",     description: "Python test suite using pytest" },
  { id: "robot",      label: "Robot Framework", ext: "robot",      language: "robot",      description: "Keyword-driven .robot test suite" },
]

// ─── helpers ────────────────────────────────────────────────────────────────
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

const indent = (lines: string[], n = 2) =>
  lines.map(l => " ".repeat(n) + l).join("\n")

const priorityTag = (p?: string) => (p || "low").toLowerCase()

// ─── Playwright ─────────────────────────────────────────────────────────────
function toPlaywright(storyId: string, testCases: TestCase[]): string {
  const lines: string[] = [
    `import { test, expect } from '@playwright/test';`,
    ``,
    `// Story: ${storyId}`,
    `// Auto-generated test scaffold — fill in selectors and assertions`,
    ``,
    `test.describe('${storyId}', () => {`,
  ]

  testCases.forEach(tc => {
    const steps = tc.steps || []
    const expected = tc.expected_result || (tc.expected_results?.[0]) || "TODO: define expected result"
    lines.push(``)
    lines.push(`  // Priority: ${priorityTag(tc.priority)}`)
    lines.push(`  test('${tc.title.replace(/'/g, "\\'")}', async ({ page }) => {`)
    steps.forEach((step, i) => {
      lines.push(`    // Step ${i + 1}: ${step}`)
      lines.push(`    // await page.TODO();`)
    })
    lines.push(``)
    lines.push(`    // Expected: ${expected}`)
    lines.push(`    // expect(TODO).toBe(TODO);`)
    lines.push(`  });`)
  })

  lines.push(`});`)
  lines.push(``)
  return lines.join("\n")
}

// ─── Cypress ─────────────────────────────────────────────────────────────────
function toCypress(storyId: string, testCases: TestCase[]): string {
  const lines: string[] = [
    `// Story: ${storyId}`,
    `// Auto-generated test scaffold — fill in selectors and assertions`,
    ``,
    `describe('${storyId}', () => {`,
  ]

  testCases.forEach(tc => {
    const steps = tc.steps || []
    const expected = tc.expected_result || (tc.expected_results?.[0]) || "TODO: define expected result"
    lines.push(``)
    lines.push(`  // Priority: ${priorityTag(tc.priority)}`)
    lines.push(`  it('${tc.title.replace(/'/g, "\\'")}', () => {`)
    steps.forEach((step, i) => {
      lines.push(`    // Step ${i + 1}: ${step}`)
      lines.push(`    // cy.get('TODO').TODO();`)
    })
    lines.push(``)
    lines.push(`    // Expected: ${expected}`)
    lines.push(`    // cy.get('TODO').should('TODO');`)
    lines.push(`  });`)
  })

  lines.push(`});`)
  lines.push(``)
  return lines.join("\n")
}

// ─── Gherkin ─────────────────────────────────────────────────────────────────
function toGherkin(storyId: string, testCases: TestCase[]): string {
  const lines: string[] = [
    `Feature: ${storyId}`,
    `  # Auto-generated BDD scaffold — refine Given/When/Then wording`,
    ``,
  ]

  testCases.forEach(tc => {
    const steps = tc.steps || []
    const expected = tc.expected_result || (tc.expected_results?.[0]) || "the expected outcome should occur"
    lines.push(`  @${priorityTag(tc.priority)}`)
    lines.push(`  Scenario: ${tc.title}`)
    steps.forEach((step, i) => {
      const keyword = i === 0 ? "Given" : i === steps.length - 1 ? "When" : "And  "
      lines.push(`    ${keyword} ${step}`)
    })
    lines.push(`    Then  ${expected}`)
    lines.push(``)
  })

  return lines.join("\n")
}

// ─── pytest ──────────────────────────────────────────────────────────────────
function toPytest(storyId: string, testCases: TestCase[]): string {
  const lines: string[] = [
    `# Story: ${storyId}`,
    `# Auto-generated test scaffold — fill in implementation`,
    ``,
    `import pytest`,
    ``,
    ``,
  ]

  testCases.forEach(tc => {
    const steps = tc.steps || []
    const expected = tc.expected_result || (tc.expected_results?.[0]) || "TODO: define expected result"
    const fn = `test_${slug(tc.title)}`
    lines.push(`# Priority: ${priorityTag(tc.priority)}`)
    lines.push(`def ${fn}():`)
    lines.push(`    """`)
    lines.push(`    ${tc.title}`)
    lines.push(`    Expected: ${expected}`)
    lines.push(`    """`)
    steps.forEach((step, i) => {
      lines.push(`    # Step ${i + 1}: ${step}`)
      lines.push(`    # TODO`)
    })
    lines.push(``)
    lines.push(`    # Expected: ${expected}`)
    lines.push(`    # assert TODO == TODO`)
    lines.push(``)
    lines.push(``)
  })

  return lines.join("\n")
}

// ─── Robot Framework ─────────────────────────────────────────────────────────
function toRobot(storyId: string, testCases: TestCase[]): string {
  const lines: string[] = [
    `*** Settings ***`,
    `Documentation    ${storyId} — Auto-generated test scaffold`,
    `Library          SeleniumLibrary`,
    ``,
    ``,
    `*** Test Cases ***`,
  ]

  testCases.forEach(tc => {
    const steps = tc.steps || []
    const expected = tc.expected_result || (tc.expected_results?.[0]) || "TODO: define expected result"
    lines.push(``)
    lines.push(`${tc.title}`)
    lines.push(`    [Tags]    ${priorityTag(tc.priority)}`)
    lines.push(`    [Documentation]    Expected: ${expected}`)
    steps.forEach((step, i) => {
      lines.push(`    # Step ${i + 1}: ${step}`)
      lines.push(`    TODO Keyword`)
    })
  })

  lines.push(``)
  lines.push(``)
  lines.push(`*** Keywords ***`)
  lines.push(`# Define reusable keywords here`)
  lines.push(``)

  return lines.join("\n")
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function generateScript(
  format: ScriptFormat,
  storyId: string,
  testCases: TestCase[]
): string {
  switch (format) {
    case "playwright": return toPlaywright(storyId, testCases)
    case "cypress":    return toCypress(storyId, testCases)
    case "gherkin":    return toGherkin(storyId, testCases)
    case "pytest":     return toPytest(storyId, testCases)
    case "robot":      return toRobot(storyId, testCases)
  }
}

export function downloadScript(
  format: ScriptFormat,
  storyId: string,
  testCases: TestCase[]
) {
  const content = generateScript(format, storyId, testCases)
  const meta = FORMATS.find(f => f.id === format)!
  const filename = `${slug(storyId)}_${meta.id}.${meta.ext}`

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
