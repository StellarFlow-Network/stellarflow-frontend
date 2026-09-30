import { expect, test } from '@playwright/test';

test('keyboard focus rings cover native and ARIA controls, but not mouse focus', async ({ page }) => {
  await page.goto('/offline');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <main>
        <a href="#target">Link</a>
        <button type="button">Button</button>
        <input aria-label="Text input" />
        <select aria-label="Select"><option>One</option></select>
        <textarea aria-label="Text area"></textarea>
        <details><summary>Disclosure</summary></details>
        <div role="button" tabindex="0">ARIA button</div>
        <div role="option" tabindex="0">Dropdown option</div>
        <div role="menuitem" tabindex="0">Menu item</div>
        <div role="tab" tabindex="0">Tab</div>
        <div role="dialog" aria-label="Dialog" tabindex="0">Dialog</div>
        <div contenteditable="true" role="textbox" aria-label="Editable text">Editable</div>
      </main>
    `;
  });

  const button = page.getByRole('button', { name: 'Button', exact: true });
  await button.click();
  await expect(button).toBeFocused();
  expect(await button.evaluate((element) => element.matches(':focus-visible'))).toBe(false);

  const keyboardTargets = [
    page.getByRole('textbox', { name: 'Text input' }),
    page.getByRole('combobox', { name: 'Select' }),
    page.getByRole('textbox', { name: 'Text area' }),
    page.getByText('Disclosure'),
    page.getByRole('button', { name: 'ARIA button' }),
    page.getByRole('option', { name: 'Dropdown option' }),
    page.getByRole('menuitem', { name: 'Menu item' }),
    page.getByRole('tab', { name: 'Tab' }),
    page.getByRole('dialog', { name: 'Dialog' }),
    page.getByRole('textbox', { name: 'Editable text' }),
  ];

  for (const target of keyboardTargets) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await expect(target).toHaveCSS('outline-style', 'solid');
    await expect(target).toHaveCSS('outline-width', '2px');
    await expect(target).toHaveCSS('outline-color', 'rgb(59, 130, 246)');
  }

  const link = page.getByRole('link', { name: 'Link' });
  await link.focus();
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await page.evaluate(() => document.documentElement.classList.add('high-contrast'));
  await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  await expect(page.getByRole('link', { name: 'Link' })).toHaveCSS('outline-color', 'rgb(255, 255, 0)');
});
