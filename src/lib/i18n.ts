import type { Lang, Stage } from '../types'

const STRINGS = {
  title: { en: "Copa Circular '26", es: "Copa Circular '26" },
  tagline: {
    en: '48 teams, one circle. Unofficial World Cup 2026 fan bracket.',
    es: '48 equipos, un círculo. Bracket no oficial del Mundial 2026.',
  },
  circle: { en: 'Circle', es: 'Círculo' },
  bracket: { en: 'Bracket', es: 'Bracket' },
  groups: { en: 'Groups', es: 'Grupos' },
  myPicks: { en: 'My picks', es: 'Mis picks' },
  retroMode: { en: 'Retro bracket', es: 'Bracket retro' },
  retroHint: {
    en: 'Filled after results were known — bragging rights only',
    es: 'Rellenado con resultados conocidos — solo para presumir',
  },
  liveMode: { en: 'Live picks', es: 'Picks en vivo' },
  timeTravel: { en: 'Time travel', es: 'Viaje en el tiempo' },
  asOf: { en: 'Viewing tournament as of', es: 'Viendo el torneo al' },
  backToToday: { en: 'Back to today', es: 'Volver a hoy' },
  pickWinner: { en: 'Pick the winner', es: 'Elige al ganador' },
  yourPick: { en: 'Your pick', es: 'Tu pick' },
  locked: { en: 'Locked at kickoff', es: 'Cerrado al inicio' },
  confidence: { en: 'Confidence', es: 'Confianza' },
  exactScore: { en: 'Exact score (bonus +2)', es: 'Marcador exacto (bono +2)' },
  correct: { en: 'Hit', es: 'Acierto' },
  wrong: { en: 'Miss', es: 'Fallo' },
  pending: { en: 'Pending', es: 'Pendiente' },
  points: { en: 'pts', es: 'pts' },
  share: { en: 'Share', es: 'Compartir' },
  shareX: { en: 'Post on X', es: 'Publicar en X' },
  shareWhatsApp: { en: 'WhatsApp', es: 'WhatsApp' },
  shareReddit: { en: 'Reddit', es: 'Reddit' },
  copyLink: { en: 'Copy bracket link', es: 'Copiar enlace del bracket' },
  copied: { en: 'Copied!', es: '¡Copiado!' },
  compare: { en: 'Comparing with', es: 'Comparando con' },
  extendedHighlights: { en: 'Extended highlights', es: 'Resumen extendido' },
  highlights: { en: 'Highlights', es: 'Resumen' },
  socialClips: { en: 'Clips & reactions', es: 'Clips y reacciones' },
  quotes: { en: 'They said it', es: 'Lo dijeron' },
  marketOdds: { en: 'Pre-match win chances', es: 'Probabilidades previas' },
  currentOdds: { en: 'Market win chances', es: 'Probabilidades del mercado' },
  upset: { en: 'UPSET', es: 'SORPRESA' },
  bigUpset: { en: 'BIG UPSET', es: 'SORPRESÓN' },
  shockUpset: { en: 'SHOCK', es: 'BATACAZO' },
  expectedWin: { en: 'As expected', es: 'Según lo previsto' },
  favDrew: { en: 'Favorite held', es: 'El favorito no pudo ganar' },
  draw: { en: 'Draw', es: 'Empate' },
  pens: { en: 'pens', es: 'pen.' },
  venue: { en: 'Venue', es: 'Estadio' },
  showPath: { en: 'Show path', es: 'Ver camino' },
  clearPath: { en: 'Clear', es: 'Quitar' },
  pathOf: { en: 'The road of', es: 'El camino de' },
  champion: { en: 'Champion', es: 'Campeón' },
  yourChampion: { en: 'Your champion', es: 'Tu campeón' },
  marketFavorite: { en: 'Market favorite', es: 'Favorito del mercado' },
  final: { en: 'Final', es: 'Final' },
  thirdPlace: { en: 'Third place', es: 'Tercer puesto' },
  record: { en: 'Record', es: 'Récord' },
  noMediaYet: {
    en: 'Media for this match lands with the nightly update.',
    es: 'Los videos de este partido llegan con la actualización nocturna.',
  },
  pickEarlier: { en: 'Pick the earlier rounds first', es: 'Primero elige las rondas anteriores' },
  disclaimer: {
    en: 'Unofficial, non-commercial fan site. Not affiliated with FIFA or any broadcaster. All video plays via official embeds.',
    es: 'Sitio de aficionados, no oficial y sin fines de lucro. Sin afiliación con la FIFA ni con emisoras. Los videos se reproducen mediante embeds oficiales.',
  },
  loading: { en: 'Inflating the ball…', es: 'Inflando el balón…' },
  watchOnYouTube: { en: 'Watch on YouTube', es: 'Ver en YouTube' },
  attendance: { en: 'Attendance', es: 'Asistencia' },
  source: { en: 'Source', es: 'Fuente' },
  tbd: { en: 'TBD', es: 'Por definir' },
  theirPick: { en: 'Their pick', es: 'Su pick' },
  agree: { en: 'You agree', es: 'De acuerdo' },
  disagree: { en: 'You differ', es: 'Difieren' },
  fillBracket: { en: 'Fill out your bracket', es: 'Completa tu bracket' },
  allPicked: { en: 'All picked in!', es: '¡Bracket completo!' },
  coach: {
    en: 'How it works: tap any upcoming match (dashed gold outline) to pick your winner — or use “Fill out your bracket” to step through them all. Confidence stars and exact scores earn bonus points; green/red dots track your hits as real results land each night.',
    es: 'Cómo funciona: toca cualquier partido próximo (borde dorado punteado) y elige a tu ganador — o usa “Completa tu bracket” para recorrerlos todos. Las estrellas de confianza y el marcador exacto dan puntos extra; los puntos verdes/rojos marcan tus aciertos cada noche.',
  },
  gotIt: { en: 'Got it', es: 'Entendido' },
  watching: { en: 'Watching', es: 'Siguiendo' },
  addTeam: { en: 'Add a team', es: 'Agregar equipo' },
  noFavsYet: {
    en: 'Star the teams you care about — they glow on the circle and their roads stay lit.',
    es: 'Marca con estrella a tus equipos — brillan en el círculo y sus caminos quedan iluminados.',
  },
  untangle: { en: 'Untangle', es: 'Desenredar' },
  untangleHint: {
    en: 'Reorder group sectors so qualification ribbons take the shortest route to the Round of 32',
    es: 'Reordena los grupos para que las cintas tomen la ruta más corta a dieciseisavos',
  },
  favorite: { en: 'Favorite', es: 'Favorito' },
  outInGroups: { en: 'Out in the groups', es: 'Eliminado en grupos' },
  outAt: { en: 'Out', es: 'Fuera en' },
  nextMatch: { en: 'Next', es: 'Próximo' },
  awaitingOpponent: { en: 'Awaiting opponent', es: 'Espera rival' },
  yourCall: { en: 'Your call', es: 'Tu pronóstico' },
  noPicksYet: { en: 'no picks yet', es: 'aún sin picks' },
  predictedOut: { en: 'You predicted them out here', es: 'Aquí los tenías eliminados' },
  actualOut: { en: 'Knocked out here', es: 'Eliminados aquí' },
} as const

export type StringKey = keyof typeof STRINGS

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang]
}

export const STAGE_NAMES: Record<Stage, Record<Lang, string>> = {
  group: { en: 'Group stage', es: 'Fase de grupos' },
  r32: { en: 'Round of 32', es: 'Dieciseisavos' },
  r16: { en: 'Round of 16', es: 'Octavos' },
  qf: { en: 'Quarterfinal', es: 'Cuartos' },
  sf: { en: 'Semifinal', es: 'Semifinal' },
  third: { en: 'Third place', es: 'Tercer puesto' },
  final: { en: 'Final', es: 'Final' },
}

export function stageName(stage: Stage, lang: Lang): string {
  return STAGE_NAMES[stage][lang]
}

export function fmtDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
