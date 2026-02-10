import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { TenantAssignmentComponent } from './tenant-assignment.component';
import { createMockTenantSummary } from '../../../__mocks__/course.mock';

describe('TenantAssignmentComponent', () => {
  const tenants = [
    createMockTenantSummary({ id: 't1', name: 'Calypso', domain: 'calypso-commodities.com', is_master: true }),
    createMockTenantSummary({ id: 't2', name: 'Santos', domain: 'santos.com' }),
    createMockTenantSummary({ id: 't3', name: 'Equinor', domain: 'equinor.com' }),
  ];

  it('should render all tenants', async () => {
    await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants,
        assignedTenantIds: [],
      },
    });

    expect(screen.getByText('Calypso')).toBeTruthy();
    expect(screen.getByText('Santos')).toBeTruthy();
    expect(screen.getByText('Equinor')).toBeTruthy();
  });

  it('should show master badge for master tenant', async () => {
    await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants,
        assignedTenantIds: [],
      },
    });

    expect(screen.getByText('Master')).toBeTruthy();
  });

  it('should show checkboxes checked for assigned tenants', async () => {
    const { container } = await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants,
        assignedTenantIds: ['t1', 't3'],
      },
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    expect(checkboxes[0].checked).toBe(true);  // Calypso
    expect(checkboxes[1].checked).toBe(false); // Santos
    expect(checkboxes[2].checked).toBe(true);  // Equinor
  });

  it('should emit assign when unchecked tenant is checked', async () => {
    const { fixture, container } = await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants,
        assignedTenantIds: [],
      },
    });

    let emittedId: string | null = null;
    fixture.componentInstance.assign.subscribe((id: string) => {
      emittedId = id;
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[1]); // Santos

    expect(emittedId).toBe('t2');
  });

  it('should emit unassign when checked tenant is unchecked', async () => {
    const { fixture, container } = await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants,
        assignedTenantIds: ['t1'],
      },
    });

    let emittedId: string | null = null;
    fixture.componentInstance.unassign.subscribe((id: string) => {
      emittedId = id;
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]); // Calypso — uncheck

    expect(emittedId).toBe('t1');
  });

  it('should show empty message when no tenants', async () => {
    await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants: [],
        assignedTenantIds: [],
      },
    });

    expect(screen.getByText('No tenants available.')).toBeTruthy();
  });

  it('should show section header', async () => {
    await render(TenantAssignmentComponent, {
      componentInputs: {
        tenants,
        assignedTenantIds: [],
      },
    });

    expect(screen.getByText('Tenant Assignment')).toBeTruthy();
  });
});
