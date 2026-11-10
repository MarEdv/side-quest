// Office layout. Pure data (axis-aligned rects, circular station zones).
export const WORLD = { w: 960, h: 540 };

export const OBSTACLES = [
  // outer walls
  { x: 0, y: 0, w: 960, h: 16, kind: 'wall' },
  { x: 0, y: 524, w: 960, h: 16, kind: 'wall' },
  { x: 0, y: 0, w: 16, h: 540, kind: 'wall' },
  { x: 944, y: 0, w: 16, h: 540, kind: 'wall' },
  // meeting room (top-left), door gap at x 176..236
  { x: 260, y: 16, w: 12, h: 166, kind: 'wall' },
  { x: 16, y: 170, w: 160, h: 12, kind: 'wall' },
  { x: 236, y: 170, w: 36, h: 12, kind: 'wall' },
  { x: 70, y: 50, w: 150, h: 56, kind: 'table' },
  // executive suite (also hosts the task panel in landscape)
  { x: 740, y: 0, w: 220, h: 200, kind: 'ceo' },
  // station furniture
  { x: 360, y: 16, w: 64, h: 44, kind: 'coffee' },
  { x: 520, y: 16, w: 70, h: 44, kind: 'printer' },
  { x: 16, y: 250, w: 44, h: 100, kind: 'filing' },
  { x: 900, y: 260, w: 44, h: 100, kind: 'server' },
  // player desk
  { x: 110, y: 430, w: 150, h: 50, kind: 'desk', own: true },
  // colleagues' desks
  { x: 340, y: 290, w: 110, h: 44, kind: 'desk' },
  { x: 500, y: 290, w: 110, h: 44, kind: 'desk' },
  { x: 680, y: 290, w: 110, h: 44, kind: 'desk' },
  { x: 340, y: 410, w: 110, h: 44, kind: 'desk' },
  { x: 500, y: 410, w: 110, h: 44, kind: 'desk' },
  { x: 680, y: 410, w: 110, h: 44, kind: 'desk' },
];

export const STATIONS = {
  desk: { id: 'desk', x: 185, y: 402, r: 34, icon: '💻', label: 'Your desk' },
  coffee: { id: 'coffee', x: 392, y: 90, r: 34, icon: '☕', label: 'Coffee' },
  printer: { id: 'printer', x: 555, y: 90, r: 34, icon: '🖨️', label: 'Printer' },
  meeting: { id: 'meeting', x: 150, y: 138, r: 34, icon: '📅', label: 'Meeting room' },
  filing: { id: 'filing', x: 92, y: 300, r: 34, icon: '🗄️', label: 'Filing' },
  it: { id: 'it', x: 866, y: 310, r: 34, icon: '🖥️', label: 'IT closet' },
};

// Regular tasks: station + seconds to hold.
export const TASKS = [
  { station: 'coffee', icon: '☕', label: 'Get coffee', hold: 1.5 },
  { station: 'printer', icon: '🖨️', label: 'Fetch printouts', hold: 2 },
  { station: 'meeting', icon: '📅', label: "Attend 'quick sync'", hold: 4 },
  { station: 'desk', icon: '📁', label: 'File expense report', hold: 3 },
  { station: 'filing', icon: '🗄️', label: 'Find the 2014 contract', hold: 2.5 },
  { station: 'it', icon: '🖥️', label: 'Reboot the server (again)', hold: 2.5 },
  { station: 'desk', icon: '📧', label: 'Reply-all to apologise', hold: 2.5 },
  { station: 'coffee', icon: '🍪', label: 'Steal a biscuit', hold: 1.5 },
];

export const POO_TASKS = [
  { station: 'desk', icon: '💩', label: 'Redo the slide deck by EOD', hold: 5 },
  { station: 'meeting', icon: '💩', label: 'Explain the budget to Finance', hold: 5 },
  { station: 'printer', icon: '💩', label: "Fix the CEO's printer", hold: 4 },
  { station: 'it', icon: '💩', label: "Restore the intern's files", hold: 4.5 },
  { station: 'filing', icon: '💩', label: 'Audit ten years of invoices', hold: 5 },
  { station: 'desk', icon: '💩', label: 'Rewrite the TPS report', hold: 4.5 },
];

export const BOSS_WAYPOINTS = [
  [300, 372], [475, 372], [640, 372], [820, 372], [475, 230], [640, 230], [820, 240],
  [200, 240], [420, 150], [660, 150], [250, 300], [150, 360], [850, 480], [320, 490], [600, 490],
];
export const PLAYER_START = { x: 185, y: 370 };
export const BOSS_START = { x: 640, y: 230 };
