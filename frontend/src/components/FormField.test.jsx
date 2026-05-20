import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormField from './FormField';

describe('FormField', () => {
  it('renderiza label y children', () => {
    render(
      <FormField label="Nombre">
        <input data-testid="input" />
      </FormField>
    );
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('required muestra asterisco', () => {
    render(
      <FormField label="Email" required>
        <input />
      </FormField>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('sin required NO muestra asterisco', () => {
    render(
      <FormField label="Email">
        <input />
      </FormField>
    );
    expect(screen.queryByText('*')).toBeNull();
  });

  it('error muestra mensaje en rojo', () => {
    render(
      <FormField label="Email" error="Email inválido">
        <input />
      </FormField>
    );
    const err = screen.getByText('Email inválido');
    expect(err).toBeInTheDocument();
    expect(err).toHaveClass('text-danger');
  });

  it('helpText se muestra cuando no hay error', () => {
    render(
      <FormField label="X" helpText="Ayuda">
        <input />
      </FormField>
    );
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
  });

  it('helpText se oculta si hay error', () => {
    render(
      <FormField label="X" helpText="Ayuda" error="Error">
        <input />
      </FormField>
    );
    expect(screen.queryByText('Ayuda')).toBeNull();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('sin label NO renderiza label', () => {
    const { container } = render(
      <FormField>
        <input />
      </FormField>
    );
    expect(container.querySelector('label')).toBeNull();
  });
});
