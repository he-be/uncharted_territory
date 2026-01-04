export const FontConfig = {
  family: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
  familyUI: '"Avenir Next", "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
};

export const TextStyles = {
  // Terminal/HUD Monospace
  term: {
    fontFamily: FontConfig.family,
    fontSize: '16px',
    color: '#00ff00',
  },
  termSmall: {
    fontFamily: FontConfig.family,
    fontSize: '14px',
    color: '#00ff00',
  },
  termHeader: {
    fontFamily: FontConfig.family,
    fontSize: '24px',
    color: '#00ff00',
    fontStyle: 'bold',
  },

  // UI/Menu Sans-Serif
  ui: {
    fontFamily: FontConfig.familyUI,
    fontSize: '16px',
    color: '#ffffff',
  },
  uiHeader: {
    fontFamily: FontConfig.familyUI,
    fontSize: '32px',
    color: '#ffffff',
    fontStyle: 'bold',
  },
  uiButton: {
    fontFamily: FontConfig.familyUI,
    fontSize: '20px',
    color: '#00ffff',
  },
};
