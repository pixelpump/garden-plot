// Standalone page. Shepherd mounts the game with mountGardenPlot() instead.
import { mountGardenPlot } from './game';

// ?tz=America/Vancouver tries a company time zone.
const tz = new URLSearchParams(location.search).get('tz') ?? undefined;

mountGardenPlot(document.getElementById('app')!, {
  timeZone: tz,
  onFinish: (r) => console.info('[garden-plot] solved', r),
});
