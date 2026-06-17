"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { type Story } from "@/lib/seed";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { motion } from "framer-motion";

const FORMATS = [
  { id: "playwright", label: "Playwright", description: "TypeScript E2E tests" },
  { id: "cypress", label: "Cypress", description: "JavaScript E2E tests" },
  { id: "pytest", label: "PyTest", description: "Python unit/E2E tests" },
  { id: "bdd", label: "BDD / Gherkin", description: "Feature files (Given/When/Then)" },
  { id: "selenium", label: "Selenium", description: "Java/Python WebDriver" },
  { id: "postman", label: "Postman", description: "API test collection JSON" },
];

const CODE_PREVIEWS: Record<string, string> = {
  playwright: `import { test, expect } from '@playwright/test';

test.describe('LOGIN-001: Email and Password Login', () => {
  test('TC-001: Successful login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'CorrectPass1!');
    await page.click('[data-testid="login-btn"]');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="session-cookie"]')).toBeDefined();
  });

  test('TC-002: Login fails with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'WrongPass!');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="error-msg"]'))
      .toHaveText('Invalid email or password');
  });

  test('TC-004: Account locks after 3 failed attempts', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'user@example.com');
      await page.fill('[data-testid="password"]', \`wrong\${i}\`);
      await page.click('[data-testid="login-btn"]');
    }
    await expect(page.locator('[data-testid="lockout-msg"]'))
      .toContainText('locked for 15 minutes');
  });
});`,
  bdd: `Feature: Email and Password Login
  As a registered user
  I want to log in with my email and password
  So that I can access my account

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "user@example.com"
    And I enter password "CorrectPass1!"
    And I click the "Log In" button
    Then I should be redirected to the dashboard
    And a session cookie should be set

  Scenario: Login fails with wrong password
    Given I am on the login page
    When I enter email "user@example.com"
    And I enter an incorrect password
    And I click the "Log In" button
    Then I should see "Invalid email or password"
    And I should remain on the login page

  Scenario: Account locks after 3 failed attempts
    Given I submit wrong credentials 3 times
    When I attempt to log in again with correct credentials
    Then I should see "Account locked for 15 minutes"`,
  cypress: `describe('LOGIN-001: Email and Password Login', () => {
  it('TC-001: Successful login', () => {
    cy.visit('/login')
    cy.get('[data-testid="email"]').type('user@example.com')
    cy.get('[data-testid="password"]').type('CorrectPass1!')
    cy.get('[data-testid="login-btn"]').click()
    cy.url().should('include', '/dashboard')
  })

  it('TC-002: Invalid credentials show error', () => {
    cy.visit('/login')
    cy.get('[data-testid="email"]').type('user@example.com')
    cy.get('[data-testid="password"]').type('wrong')
    cy.get('[data-testid="login-btn"]').click()
    cy.get('[data-testid="error-msg"]')
      .should('contain', 'Invalid email or password')
  })
})`,
  pytest: `import pytest
from playwright.sync_api import Page

class TestLogin001:
    def test_successful_login(self, page: Page):
        page.goto("/login")
        page.fill('[data-testid="email"]', "user@example.com")
        page.fill('[data-testid="password"]', "CorrectPass1!")
        page.click('[data-testid="login-btn"]')
        assert page.url == "/dashboard"

    def test_invalid_credentials(self, page: Page):
        page.goto("/login")
        page.fill('[data-testid="email"]', "user@example.com")
        page.fill('[data-testid="password"]', "wrong")
        page.click('[data-testid="login-btn"]')
        error = page.locator('[data-testid="error-msg"]').inner_text()
        assert "Invalid email or password" in error`,
  selenium: `public class LoginTest {
  @Test
  public void testSuccessfulLogin() {
    driver.get(BASE_URL + "/login");
    driver.findElement(By.testId("email")).sendKeys("user@example.com");
    driver.findElement(By.testId("password")).sendKeys("CorrectPass1!");
    driver.findElement(By.testId("login-btn")).click();
    assertEquals(driver.getCurrentUrl(), BASE_URL + "/dashboard");
  }
}`,
  postman: `{
  "info": { "name": "LOGIN-001 Tests", "schema": "..." },
  "item": [
    {
      "name": "POST /api/login - valid credentials",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/login",
        "body": {
          "email": "user@example.com",
          "password": "CorrectPass1!"
        }
      },
      "event": [
        {
          "script": "pm.test('Status 200', () => pm.response.to.have.status(200));"
        }
      ]
    }
  ]
}`,
};

export function ExportTab({ story, testCount }: { story: Story; testCount: number }) {
  const [selected, setSelected] = useState("playwright");
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [groupByType, setGroupByType] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = CODE_PREVIEWS[selected] ?? "";

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="px-8 py-8 max-w-content mx-auto space-y-6"
    >
      <motion.div variants={fadeInUp}>
        <h2 className="text-[24px] font-bold text-navy mb-1">Export Tests</h2>
        <p className="text-sm text-muted">Download your test cases as automation-ready scripts.</p>
      </motion.div>

      {/* Format grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        {FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            onClick={() => setSelected(fmt.id)}
            className={`flex items-start gap-3 p-4 rounded-card border text-left transition-colors ${
              selected === fmt.id
                ? "border-pink bg-surface-pink"
                : "border-border bg-white hover:bg-gray-50"
            }`}
          >
            <div
              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                selected === fmt.id ? "bg-pink text-white" : "bg-border text-muted"
              }`}
            >
              {fmt.label.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className={`text-sm font-semibold ${selected === fmt.id ? "text-navy" : "text-navy"}`}>
                {fmt.label}
              </p>
              <p className="text-xs text-muted mt-0.5">{fmt.description}</p>
            </div>
          </button>
        ))}
      </motion.div>

      {/* Options */}
      <motion.div variants={fadeInUp} className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
            className="w-4 h-4 accent-pink"
          />
          <span className="text-sm text-navy">Include only approved tests</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={groupByType}
            onChange={(e) => setGroupByType(e.target.checked)}
            className="w-4 h-4 accent-pink"
          />
          <span className="text-sm text-navy">Group by test type</span>
        </label>
        <p className="text-sm text-muted">
          All {testCount} tests ·{" "}
          <button className="text-cyan hover:underline">Change selection</button>
        </p>
      </motion.div>

      {/* Code preview */}
      <motion.div variants={fadeInUp} className="relative rounded-lg overflow-hidden">
        <div className="bg-navy px-4 py-2 flex items-center justify-between">
          <span className="text-[12px] text-muted font-mono">
            {FORMATS.find((f) => f.id === selected)?.label}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            <Copy size={13} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="bg-[#0F172A] text-[#E2E8F0] font-mono text-[13px] p-5 overflow-x-auto leading-relaxed whitespace-pre max-h-[360px] overflow-y-auto">
          {code}
        </pre>
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeInUp} className="flex gap-3">
        <button className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2">
          <Download size={14} />
          Download .zip
        </button>
        <button
          onClick={handleCopy}
          className="h-9 px-5 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Copy size={14} />
          Copy to clipboard
        </button>
      </motion.div>
    </motion.div>
  );
}
