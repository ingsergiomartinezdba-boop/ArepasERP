import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('renderiza children', () => {
    render(<Button>Hola</Button>);
    expect(screen.getByRole('button', { name: 'Hola' })).toBeInTheDocument();
  });

  it('default variant es primary', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('variant secondary aplica btn-secondary', () => {
    render(<Button variant="secondary">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-secondary');
  });

  it('variant danger aplica btn-danger', () => {
    render(<Button variant="danger">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-danger');
  });

  it('variant inválida cae a primary', () => {
    render(<Button variant="inexistente">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('disabled previene click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>X</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('click dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>X</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fluid no se filtra al DOM', () => {
    render(<Button fluid>X</Button>);
    // No debe aparecer atributo "fluid" en el DOM
    expect(screen.getByRole('button')).not.toHaveAttribute('fluid');
  });

  it('type submit', () => {
    render(<Button type="submit">Guardar</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('size lg aplica padding mayor (estilo inline)', () => {
    render(<Button size="lg">X</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.padding).toBe('0.75rem 1.5rem');
  });

  it('className personalizada se agrega', () => {
    render(<Button className="mi-clase">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('mi-clase');
  });
});
