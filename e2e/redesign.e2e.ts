import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Mook redesign layout, motion, fonts and accessibility", () => {
  for (const vp of [
    { name: "desktop-1920", width: 1920, height: 1080 },
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "tablet-1024", width: 1024, height: 768 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/demo.html");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    });
  }

  test("ethereal figure reacts to pointermove and respects reducedMotion", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo.html");

    const positions: string[] = [];
    for (const [x, y] of [[150, 200], [720, 450], [1100, 750]] as const) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(180);
      positions.push(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--mook-fig-x").trim()));
    }
    expect(new Set(positions).size).toBeGreaterThan(1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.mouse.move(200, 200);
    await page.waitForTimeout(150);
    const reducedVal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--mook-fig-x").trim());
    await page.mouse.move(1000, 700);
    await page.waitForTimeout(150);
    const reducedVal2 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--mook-fig-x").trim());
    expect(reducedVal).toBe(reducedVal2);
  });

  test("uses Cormorant Garamond and Inter fonts and passes axe-core contrast/a11y", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo.html");
    await page.evaluate(() => document.fonts.ready);

    const fonts = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
      body: getComputedStyle(document.body).fontFamily,
    }));
    expect(fonts.h1).toContain("Cormorant Garamond");
    expect(fonts.body).toContain("Inter");

    const results = await new AxeBuilder({ page }).exclude("#__vue-devtools-container__").analyze();
    expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("floating mode launcher stays fixed bottom-right when closed and open", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const launcher = page.locator("agichat-widget").locator(".chat-launcher");
    await expect(launcher).toBeVisible();
    const openBox = await launcher.boundingBox();
    expect(openBox).not.toBeNull();
    expect(openBox!.y).toBeGreaterThan(750);

    await launcher.click();
    const closedBox = await launcher.boundingBox();
    expect(closedBox).not.toBeNull();
    expect(Math.abs(closedBox!.x - openBox!.x)).toBeLessThan(2);
    expect(Math.abs(closedBox!.y - openBox!.y)).toBeLessThan(2);
  });
});
