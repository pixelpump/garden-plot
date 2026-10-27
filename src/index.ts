// Public API for embedding (Shepherd) and for the server (puzzle + checking).
export { mountGardenPlot, type GardenPlotOptions, type GardenPlotResult } from './game';
export { checkBoard, daily, generate, type Daily, type Puzzle } from './puzzle';
