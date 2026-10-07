// The only source of track copy, artwork, coordinates, and crew destinations.
export const mapSize = { width: 1880, height: 1940 };
// The compass rose sits at the centre of the star and is where the map opens.
export const compass = { x: 940, y: 1000 };
export const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const leaguesPerUnit = 0.01;
const islandAnchorOffset = 130;

// Screen bearings read from the rose: 0° is north (up the map), 90° is east.
export function bearingTo(track, from) {
  const degrees = (Math.atan2(track.x - from.x, -(track.y + islandAnchorOffset - from.y)) * 180 / Math.PI + 360) % 360;
  return { degrees, word: compassPoints[Math.round(degrees / 45) % 8] };
}

export function distanceTo(track, from) {
  return Math.hypot(track.x - from.x, track.y + islandAnchorOffset - from.y);
}

export function toLeagues(units) {
  return Math.round(units * leaguesPerUnit * 10) / 10;
}
export const tracks = [
  {
    id: 'web', name: 'Web',
    description: 'Build for the web. Connect your ideas to the world.',
    artwork: 'web', x: 940, y: 275, accent: '#4285F4',
    whatsapp: 'https://chat.whatsapp.com/H7y5P34gusB1zGMDPeSVPP',
  },
  {
    id: 'ai', name: 'AI',
    description: 'Teach machines to think. Discover what comes next.',
    artwork: 'ai', x: 1600, y: 670, accent: '#755F8F',
    whatsapp: 'https://chat.whatsapp.com/EAUuRlMLIhBLGjKG3VscKV',
  },
  {
    id: 'data-science', name: 'Data Science',
    description: 'Follow the patterns. Turn data into discoveries.',
    artwork: 'datascience', x: 280, y: 670, accent: '#687356',
    whatsapp: 'https://chat.whatsapp.com/HffmHZChgt1A58skqxucLY',
  },
  {
    id: 'software-engineering', name: 'Software Engineering',
    description: 'Build strong foundations. Craft software that lasts.',
    artwork: 'swe', x: 530, y: 1280, accent: '#B27A3A',
    whatsapp: 'https://chat.whatsapp.com/ByOeIpWa93l6bOvDytMjWJ',
  },
  {
    id: 'cybersecurity', name: 'Cybersecurity',
    description: 'Spot the threats. Learn to defend the digital seas.',
    artwork: 'cybersecurity', x: 1350, y: 1280, accent: '#A44732',
    whatsapp: 'https://chat.whatsapp.com/GC6pD2uxHo1Ikoa4Mryspa?s=sw&p=a&mlu=4&ilr=4',
  },
];
