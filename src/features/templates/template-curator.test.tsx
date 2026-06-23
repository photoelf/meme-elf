import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateCurator, type TemplateCuratorItem } from './template-curator';

const CURATOR_ITEMS: TemplateCuratorItem[] = [
  {
    templateId: 'drake',
    title: 'Drake Hotline Bling',
    tags: ['reaction'],
    sortOrder: 100,
  },
  {
    templateId: 'two-buttons',
    title: 'Two Buttons',
    tags: ['choice'],
    sortOrder: 200,
  },
];

describe('TemplateCurator', () => {
  it('surfaces import, metadata edit, reorder, and delete controls', () => {
    const onImportFiles = vi.fn();
    const onTitleChange = vi.fn();
    const onTagsChange = vi.fn();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const onDelete = vi.fn();

    render(
      <TemplateCurator
        items={CURATOR_ITEMS}
        onImportFiles={onImportFiles}
        onTitleChange={onTitleChange}
        onTagsChange={onTagsChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByLabelText(/title for drake hotline bling/i), {
      target: { value: 'Drake meme' },
    });
    fireEvent.change(screen.getByLabelText(/tags for drake hotline bling/i), {
      target: { value: 'reaction, classic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /move two buttons up/i }));
    fireEvent.click(screen.getByRole('button', { name: /move drake hotline bling down/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete drake hotline bling/i }));

    const file = new File(
      ['{"kind":"template","version":1,"templateId":"new-template","name":"New template","category":"classic","scene":{"canvasSize":{"width":800,"height":450},"textSlots":[],"imageSlots":[],"canvas":{"backgroundFill":null,"safeInsets":{"top":0,"right":0,"bottom":0,"left":0}}}}'],
      'new-template.melf',
      { type: 'application/x.meme-elf+json' },
    );
    fireEvent.change(screen.getByLabelText(/import template source files/i), {
      target: { files: [file] },
    });

    expect(onTitleChange).toHaveBeenCalledWith('drake', 'Drake meme');
    expect(onTagsChange).toHaveBeenCalledWith('drake', 'reaction, classic');
    expect(onMoveUp).toHaveBeenCalledWith('two-buttons');
    expect(onMoveDown).toHaveBeenCalledWith('drake');
    expect(onDelete).toHaveBeenCalledWith('drake');
    expect(onImportFiles).toHaveBeenCalledTimes(1);
    expect(onImportFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
