import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  it('no renderiza nada cuando isOpen=false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}}>contenido</Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza contenido cuando isOpen=true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Texto del modal</p>
      </Modal>
    );
    expect(screen.getByText('Texto del modal')).toBeInTheDocument();
  });

  it('muestra el título', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Mi Título">
        contenido
      </Modal>
    );
    expect(screen.getByText('Mi Título')).toBeInTheDocument();
  });

  it('ESC dispara onClose', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}>x</Modal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('click en overlay dispara onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose}>x</Modal>
    );
    fireEvent.click(container.querySelector('.modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closeOnOverlayClick=false ignora click en overlay', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} closeOnOverlayClick={false}>x</Modal>
    );
    fireEvent.click(container.querySelector('.modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('click dentro del modal NO dispara onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p data-testid="inner">contenido</p>
      </Modal>
    );
    fireEvent.click(screen.getByTestId('inner'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('body overflow se setea a hidden cuando está abierto', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={() => {}}>x</Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('unset');
  });
});
