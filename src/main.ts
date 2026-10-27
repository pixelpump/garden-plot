// Standalone page. Shepherd mounts the game with mountGardenPlot() instead.
import { mountGardenPlot } from './game';

mountGardenPlot(document.getElementById('app')!, {
  onFinish: (r) => console.info('[garden-plot] solved', r),
});
