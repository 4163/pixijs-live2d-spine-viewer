// VIEWER_CONFIG — controls L2D element behavior.
//   relativeDraw (bool): on resize, re-center + re-scale the L2D element to match the canvas.
//   screenFitRatio (float): maximum canvas coverage (default 0.9) before the element shrinks to fit.
//   live2dBaseY (float): base vertical position multiplier for Live2D models (default 0.5 = center)
//   chibiBaseY (float): base vertical position multiplier for Spine chibis (default 0.8 = near bottom)
window.VIEWER_CONFIG = {
  relativeDraw: true,
  screenFitRatio: 0.9, // Maximum canvas coverage (e.g. 0.9 = 90% of canvas) when auto-scaling
  live2dBaseY: 0.5,
  chibiBaseY: 0.7,
  
  // Custom Live2D/Spine entries (optional, supplements the manifest files)
  live2d: [],
  spine: [],
  
  // Layout offsets/scaling via model "id"
  //   offsetY: vertical shift multiplier against screen height (e.g., -0.25 moves it UP by 25%)
  //   scale:   scale multiplier (e.g., 1.2 makes it 20% larger)
  layout: {
    'classic_witch_c3': { offsetY: -0.25 },
    // 'stirring_mermaid_c3': { offsetY: 0.1, scale: 1.15 }
  },
  
  // Spine animation playback configuration
  spineAnim: {
    'global': {
      'die':     { loop: false },
      'victory': { loop: false, followUp: 'victoryloop' },
      'victoryloop': { hidden: true } // prevents from showing in the tap cycle
    },
    // model-specific animation override:
    // 'my_custom_chibi': {
    //   'special_attack': { loop: false, followUp: 'wait' }
    // }
  },
};
