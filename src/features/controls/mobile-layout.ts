export const PHONE_MAX_WIDTH = 720;
export const SMALL_TABLET_MAX_WIDTH = 1180;

export type MobileShellLayout = {
  shellMode: 'desktop' | 'small-tablet' | 'phone';
  workspaceMode: 'split' | 'stacked';
  inspectorMode: 'full' | 'tiered' | 'collapsed';
  topbarActionsMode: 'inline' | 'wrap';
};

export type ToolbarActionId =
  | 'paste'
  | 'upload'
  | 'url'
  | 'copy'
  | 'download'
  | 'theme'
  | 'tools'
  | 'overflow';

export type TopbarActionLayout = {
  primary: ToolbarActionId[];
  overflow: ToolbarActionId[];
  sticky: ToolbarActionId[];
};

export function resolveMobileShellLayout(viewportWidth: number): MobileShellLayout {
  if (viewportWidth <= PHONE_MAX_WIDTH) {
    return {
      shellMode: 'phone',
      workspaceMode: 'stacked',
      inspectorMode: 'collapsed',
      topbarActionsMode: 'wrap',
    };
  }

  if (viewportWidth <= SMALL_TABLET_MAX_WIDTH) {
    return {
      shellMode: 'small-tablet',
      workspaceMode: 'stacked',
      inspectorMode: 'tiered',
      topbarActionsMode: 'wrap',
    };
  }

  return {
    shellMode: 'desktop',
    workspaceMode: 'split',
    inspectorMode: 'full',
    topbarActionsMode: 'inline',
  };
}

export function resolveTopbarActionLayout(
  shellMode: MobileShellLayout['shellMode'],
): TopbarActionLayout {
  if (shellMode === 'phone') {
    return {
      overflow: [],
      primary: ['paste', 'upload', 'url', 'theme'],
      sticky: ['copy', 'download', 'tools'],
    };
  }

  if (shellMode === 'small-tablet') {
    return {
      overflow: [],
      primary: ['paste', 'upload', 'url', 'copy', 'download', 'theme'],
      sticky: [],
    };
  }

  return {
    overflow: [],
    primary: ['paste', 'upload', 'url', 'copy', 'download', 'theme'],
    sticky: [],
  };
}
