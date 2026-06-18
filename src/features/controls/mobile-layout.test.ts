import {
  resolveMobileShellLayout,
  resolveTopbarActionLayout,
  SMALL_TABLET_MAX_WIDTH,
  PHONE_MAX_WIDTH,
} from './mobile-layout';

describe('resolveMobileShellLayout', () => {
  it('returns desktop shell rules above the small-tablet breakpoint', () => {
    expect(resolveMobileShellLayout(SMALL_TABLET_MAX_WIDTH + 1)).toEqual({
      inspectorMode: 'full',
      shellMode: 'desktop',
      topbarActionsMode: 'inline',
      workspaceMode: 'split',
    });
  });

  it('returns small-tablet shell rules between phone and desktop widths', () => {
    expect(resolveMobileShellLayout(PHONE_MAX_WIDTH + 1)).toEqual({
      inspectorMode: 'tiered',
      shellMode: 'small-tablet',
      topbarActionsMode: 'wrap',
      workspaceMode: 'stacked',
    });
  });

  it('returns phone shell rules at or below the phone breakpoint', () => {
    expect(resolveMobileShellLayout(PHONE_MAX_WIDTH)).toEqual({
      inspectorMode: 'collapsed',
      shellMode: 'phone',
      topbarActionsMode: 'wrap',
      workspaceMode: 'stacked',
    });
  });
});

describe('resolveTopbarActionLayout', () => {
  it('keeps all actions inline on desktop', () => {
    expect(resolveTopbarActionLayout('desktop')).toEqual({
      overflow: [],
      primary: ['paste', 'upload', 'copy', 'download', 'theme'],
      sticky: [],
    });
  });

  it('moves only secondary actions into overflow on small tablet', () => {
    expect(resolveTopbarActionLayout('small-tablet')).toEqual({
      overflow: [],
      primary: ['paste', 'upload', 'copy', 'download', 'theme'],
      sticky: [],
    });
  });

  it('uses a compact top bar and sticky primary actions on phone', () => {
    expect(resolveTopbarActionLayout('phone')).toEqual({
      overflow: [],
      primary: ['paste', 'upload', 'theme'],
      sticky: ['copy', 'download', 'tools'],
    });
  });
});
