// Standalone page. Shepherd mounts the game with mountGardenPlot() instead.
import { mountGardenPlot } from './game';

// ?tz=America/Vancouver tries a company time zone; ?leaderboard shows the host's Leaderboard button.
const params = new URLSearchParams(location.search);

const game = mountGardenPlot(document.getElementById('app')!, {
  timeZone: params.get('tz') ?? undefined,
  onFinish: (r) => {
    console.info('[garden-plot] solved', r);
    if (params.has('leaderboard') && r.dailyKey && !r.archive) setTimeout(() => game.setResultNote('🏆 2nd of 5 today on the Staff Board'), 300);
  },
  onLeaderboard: params.has('leaderboard') ? () => alert('Leaderboard') : undefined,
});
