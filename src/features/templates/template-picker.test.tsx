import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplatePicker, type TemplatePickerItem } from './template-picker';

const TEMPLATE_ITEMS: TemplatePickerItem[] = [
  {
    templateId: 'classic-top-bottom',
    title: 'Classic top and bottom',
    description: 'Two text slots for the standard meme layout.',
    previewImagePath: '/templates/classic-top-bottom/preview.jpg',
  },
  {
    templateId: 'square-social',
    title: 'Square social',
    description: 'Centered crop for square social posts.',
    previewImagePath: '/templates/square-social/preview.jpg',
  },
];

describe('TemplatePicker', () => {
  it('renders template tiles with stable hooks and preview images', () => {
    render(<TemplatePicker items={TEMPLATE_ITEMS} onSelectTemplate={vi.fn()} />);

    const picker = screen.getByTestId('template-picker');
    expect(picker).toBeInTheDocument();

    const classicTile = screen.getByRole('button', { name: /classic top and bottom/i });
    expect(classicTile).toHaveAttribute('data-template-id', 'classic-top-bottom');
    expect(classicTile).toHaveAttribute('data-testid', 'template-picker-tile');

    const classicPreview = within(classicTile).getByRole('img', {
      name: /classic top and bottom preview/i,
    });
    expect(classicPreview).toHaveAttribute('src', '/templates/classic-top-bottom/preview.jpg');

    expect(within(classicTile).getByText(/two text slots for the standard meme layout\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /square social/i })).toBeInTheDocument();
  });

  it('renders an empty state when there are no templates', () => {
    render(<TemplatePicker items={[]} onSelectTemplate={vi.fn()} />);

    expect(screen.getByTestId('template-picker-empty')).toBeInTheDocument();
    expect(screen.getByText(/templates will show up here when they are available\./i)).toBeInTheDocument();
    expect(screen.queryByTestId('template-picker-grid')).not.toBeInTheDocument();
  });

  it('calls onSelectTemplate with the clicked template id', () => {
    const onSelectTemplate = vi.fn();
    render(<TemplatePicker items={TEMPLATE_ITEMS} onSelectTemplate={onSelectTemplate} />);

    fireEvent.click(screen.getByRole('button', { name: /square social/i }));

    expect(onSelectTemplate).toHaveBeenCalledTimes(1);
    expect(onSelectTemplate).toHaveBeenCalledWith('square-social');
  });

  it('exposes selected and applying tile semantics', () => {
    render(
      <TemplatePicker
        items={TEMPLATE_ITEMS}
        onSelectTemplate={vi.fn()}
        selectedTemplateId="classic-top-bottom"
        applyingTemplateId="square-social"
      />,
    );

    const selectedTile = screen.getByRole('button', { name: /classic top and bottom/i });
    expect(selectedTile).toHaveAttribute('aria-pressed', 'true');
    expect(selectedTile).toHaveAttribute('data-selected', 'true');

    const applyingTile = screen.getByRole('button', { name: /square social/i });
    expect(applyingTile).toHaveAttribute('aria-busy', 'true');
    expect(applyingTile).toBeDisabled();
    expect(applyingTile).toHaveAttribute('data-applying', 'true');
  });
});
