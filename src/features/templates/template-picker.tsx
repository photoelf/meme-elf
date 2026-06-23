import type { MelfTemplateCatalogEntry } from './template-catalog';

export type TemplatePickerItem = Pick<
  MelfTemplateCatalogEntry,
  'templateId' | 'title' | 'description' | 'previewImagePath'
>;

type TemplatePickerProps = {
  items: readonly TemplatePickerItem[];
  onSelectTemplate: (templateId: string) => void;
  selectedTemplateId?: string | null;
  applyingTemplateId?: string | null;
};

export function TemplatePicker({
  items,
  onSelectTemplate,
  selectedTemplateId = null,
  applyingTemplateId = null,
}: TemplatePickerProps) {
  if (items.length === 0) {
    return (
      <div className="template-picker template-picker-empty-state" data-testid="template-picker">
        <p className="template-picker-empty-copy" data-testid="template-picker-empty">
          Templates will show up here when they are available.
        </p>
      </div>
    );
  }

  return (
    <div className="template-picker" data-testid="template-picker">
      <div className="template-picker-grid" data-testid="template-picker-grid">
        {items.map((item) => {
          const isSelected = selectedTemplateId === item.templateId;
          const isApplying = applyingTemplateId === item.templateId;

          return (
            <button
              key={item.templateId}
              type="button"
              className="template-picker-tile"
              data-template-id={item.templateId}
              data-testid="template-picker-tile"
              data-selected={isSelected ? 'true' : undefined}
              data-applying={isApplying ? 'true' : undefined}
              aria-pressed={isSelected}
              aria-busy={isApplying ? 'true' : undefined}
              disabled={isApplying}
              onClick={() => onSelectTemplate(item.templateId)}
            >
              <div className="template-picker-preview-shell">
                <img
                  className="template-picker-preview-image"
                  src={item.previewImagePath ?? undefined}
                  alt={`${item.title} preview`}
                />
              </div>
              <span className="template-picker-title">{item.title}</span>
              <span className="template-picker-description">{item.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
