export type TemplateCuratorItem = {
  templateId: string;
  title: string;
  tags: string[];
  sortOrder: number;
};

type TemplateCuratorProps = {
  items: readonly TemplateCuratorItem[];
  onImportFiles: (files: File[]) => void;
  onTitleChange: (templateId: string, title: string) => void;
  onTagsChange: (templateId: string, tags: string) => void;
  onMoveUp: (templateId: string) => void;
  onMoveDown: (templateId: string) => void;
  onDelete: (templateId: string) => void;
};

export function TemplateCurator({
  items,
  onImportFiles,
  onTitleChange,
  onTagsChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: TemplateCuratorProps) {
  return (
    <div className="template-curator">
      <div className="template-curator-toolbar">
        <label className="mini-action-button template-curator-import">
          Import .melf templates
          <input
            className="file-input-hidden"
            aria-label="Import template source files"
            type="file"
            accept=".melf,application/x.meme-elf+json,application/json"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';

              if (files.length > 0) {
                onImportFiles(files);
              }
            }}
          />
        </label>
      </div>

      <div className="template-curator-stack">
        {items.map((item, index) => (
          <article key={item.templateId} className="template-curator-card">
            <div className="field-stack">
              <label className="field-label" htmlFor={`template-curator-title-${item.templateId}`}>
                Title
              </label>
              <input
                id={`template-curator-title-${item.templateId}`}
                className="text-input template-curator-input"
                aria-label={`Title for ${item.title}`}
                value={item.title}
                onChange={(event) => onTitleChange(item.templateId, event.target.value)}
              />
            </div>
            <div className="field-stack">
              <label className="field-label" htmlFor={`template-curator-tags-${item.templateId}`}>
                Tags
              </label>
              <input
                id={`template-curator-tags-${item.templateId}`}
                className="text-input template-curator-input"
                aria-label={`Tags for ${item.title}`}
                value={item.tags.join(', ')}
                onChange={(event) => onTagsChange(item.templateId, event.target.value)}
              />
            </div>
            <div className="template-curator-meta">Sort order: {item.sortOrder}</div>
            <div className="saved-scene-actions">
              <button
                type="button"
                className="mini-action-button"
                aria-label={`Move ${item.title} up`}
                disabled={index === 0}
                onClick={() => onMoveUp(item.templateId)}
              >
                Move up
              </button>
              <button
                type="button"
                className="mini-action-button"
                aria-label={`Move ${item.title} down`}
                disabled={index === items.length - 1}
                onClick={() => onMoveDown(item.templateId)}
              >
                Move down
              </button>
              <button
                type="button"
                className="mini-action-button remove-layer-button"
                aria-label={`Delete ${item.title}`}
                onClick={() => onDelete(item.templateId)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
