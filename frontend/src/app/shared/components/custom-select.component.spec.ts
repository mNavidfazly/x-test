import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CustomSelectComponent, SelectOption } from './custom-select.component';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';

const testOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

async function renderSelect(overrides: {
  options?: SelectOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
} = {}) {
  const valueChangeSpy = vi.fn();
  const result = await render(
    `<app-custom-select
      [options]="options"
      [value]="value"
      [placeholder]="placeholder"
      [disabled]="disabled"
      [ariaLabel]="ariaLabel"
      (valueChange)="onValueChange($event)"
    />`,
    {
      imports: [CustomSelectComponent, MockLucideIconComponent],
      componentProperties: {
        options: overrides.options ?? testOptions,
        value: overrides.value ?? '',
        placeholder: overrides.placeholder ?? 'Pick a fruit...',
        disabled: overrides.disabled ?? false,
        ariaLabel: overrides.ariaLabel ?? '',
        onValueChange: valueChangeSpy,
      },
    },
  );
  return { ...result, valueChangeSpy };
}

describe('CustomSelectComponent', () => {
  // --- Rendering ---

  it('should show placeholder when no value selected', async () => {
    await renderSelect();
    expect(screen.getByRole('combobox').textContent).toContain('Pick a fruit...');
  });

  it('should show selected option label when value matches', async () => {
    await renderSelect({ value: 'banana' });
    expect(screen.getByRole('combobox').textContent).toContain('Banana');
  });

  it('should show placeholder when value does not match any option', async () => {
    await renderSelect({ value: 'mango' });
    expect(screen.getByRole('combobox').textContent).toContain('Pick a fruit...');
  });

  it('should be closed by default', async () => {
    await renderSelect();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  // --- Open/Close ---

  it('should open dropdown on click', async () => {
    const { fixture } = await renderSelect();
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('should close dropdown on second click', async () => {
    const { fixture } = await renderSelect();
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.click(trigger);
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  it('should close on click outside', async () => {
    const { fixture } = await renderSelect();
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.click(document.body);
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  it('should close on Escape key', async () => {
    const { fixture } = await renderSelect();
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  it('should close on Tab key', async () => {
    const { fixture } = await renderSelect();
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fixture.detectChanges();

    fireEvent.keyDown(trigger, { key: 'Tab' });
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  // --- Selection ---

  it('should emit valueChange when option clicked', async () => {
    const { fixture, valueChangeSpy } = await renderSelect();
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Banana'));
    fixture.detectChanges();
    expect(valueChangeSpy).toHaveBeenCalledWith('banana');
  });

  it('should close after selection', async () => {
    const { fixture } = await renderSelect();
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Cherry'));
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  it('should not emit for disabled options', async () => {
    const { fixture, valueChangeSpy } = await renderSelect({
      options: [
        { value: 'a', label: 'Active' },
        { value: 'b', label: 'Disabled', disabled: true },
      ],
    });
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Disabled'));
    fixture.detectChanges();
    expect(valueChangeSpy).not.toHaveBeenCalled();
  });

  // --- Keyboard Navigation ---

  it('should open on Enter key', async () => {
    const { fixture } = await renderSelect();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('should open on ArrowDown key', async () => {
    const { fixture } = await renderSelect();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('should select highlighted option on Enter', async () => {
    const { fixture, valueChangeSpy } = await renderSelect();
    const trigger = screen.getByRole('combobox');

    // Open
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    // Move to second option (banana)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    // Select
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fixture.detectChanges();

    expect(valueChangeSpy).toHaveBeenCalledWith('banana');
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  it('should navigate up with ArrowUp', async () => {
    const { fixture, valueChangeSpy } = await renderSelect({ value: 'cherry' });
    const trigger = screen.getByRole('combobox');

    // Open — highlights cherry (index 2)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    // Move up to banana (index 1)
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fixture.detectChanges();

    // Select
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fixture.detectChanges();

    expect(valueChangeSpy).toHaveBeenCalledWith('banana');
  });

  it('should skip disabled options during navigation', async () => {
    const options: SelectOption[] = [
      { value: 'a', label: 'First' },
      { value: 'b', label: 'Second', disabled: true },
      { value: 'c', label: 'Third' },
    ];
    const { fixture, valueChangeSpy } = await renderSelect({ options });
    const trigger = screen.getByRole('combobox');

    // Open — highlights first (index 0)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    // ArrowDown should skip disabled (index 1) and land on Third (index 2)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    // Select
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fixture.detectChanges();

    expect(valueChangeSpy).toHaveBeenCalledWith('c');
  });

  it('should not navigate past last option', async () => {
    const { fixture, valueChangeSpy } = await renderSelect({ value: 'cherry' });
    const trigger = screen.getByRole('combobox');

    // Open — highlights cherry (index 2, last)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    // Try to go further down — should stay on cherry
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fixture.detectChanges();

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fixture.detectChanges();

    expect(valueChangeSpy).toHaveBeenCalledWith('cherry');
  });

  // --- ARIA ---

  it('should have role=combobox on trigger', async () => {
    await renderSelect();
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('should set aria-expanded correctly', async () => {
    const { fixture } = await renderSelect();
    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('should have role=option with aria-selected on each option', async () => {
    const { fixture } = await renderSelect({ value: 'banana' });
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[2].getAttribute('aria-selected')).toBe('false');
  });

  // --- Disabled ---

  it('should not open when disabled', async () => {
    const { fixture } = await renderSelect({ disabled: true });
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();
    expect(screen.queryByRole('listbox')).toBeFalsy();
  });

  it('should have disabled attribute on trigger', async () => {
    await renderSelect({ disabled: true });
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true);
  });

  // --- Edge cases ---

  it('should handle empty options array', async () => {
    const { fixture } = await renderSelect({ options: [] });
    fireEvent.click(screen.getByRole('combobox'));
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('should highlight selected option when opening', async () => {
    const { fixture } = await renderSelect({ value: 'cherry' });
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fixture.detectChanges();

    // aria-activedescendant should reference index 2 (cherry)
    const descendantId = trigger.getAttribute('aria-activedescendant');
    expect(descendantId).toBeTruthy();
    const highlightedOption = document.getElementById(descendantId!);
    expect(highlightedOption!.textContent).toContain('Cherry');
  });

  it('should open on Space key', async () => {
    const { fixture } = await renderSelect();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: ' ' });
    fixture.detectChanges();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});
