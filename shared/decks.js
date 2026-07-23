// Famous-place decks: named pools over shared/locations.js keys. A place may
// appear in several decks. Deck membership can change freely — only the
// locations array itself is append-only.
const LOCATIONS = require('./locations.js');

const DECK_KEYS = {
  world: [
    'shibuya', 'timessquare', 'oia', 'machupicchu', 'sydneyopera', 'tablemountain',
    'redsquare', 'eiffel', 'rio', 'goldengate', 'petra', 'tajmahal', 'colosseum',
    'halong', 'reykjavik', 'dubai', 'marrakesh', 'greatwall', 'stonehenge',
    'neuschwanstein', 'sagrada', 'angkor', 'fuji', 'liberty', 'goldentemple',
    'bigben', 'brandenburg', 'acropolis', 'uluru', 'victoriafalls', 'giza',
    'bluemosque', 'kinkakuji', 'gardensbay', 'cappadocia', 'matterhorn',
    'cliffsofmoher', 'plitvice', 'borabora', 'watarun',
  ],
  na: [
    'timessquare', 'goldengate', 'moraine', 'niagara', 'liberty', 'grandcanyon',
    'chichenitza', 'mountrushmore', 'elcapitan', 'oldfaithful', 'spaceneedle',
    'gatewayarch', 'whitehouse', 'hollywoodsign', 'lasvegasstrip', 'frenchquarter',
    'antelopecanyon', 'monumentvalley', 'denali', 'brooklynbridge', 'cloudgate',
    'lakelouise', 'cntower', 'chateaufrontenac', 'peggyscove', 'parliamenthill',
    'capilano', 'percerock', 'tulum', 'teotihuacan', 'cabosanlucas', 'zocalo',
    'guanajuato', 'tikal', 'arenal', 'panamacanal', 'oldhavana',
  ],
  sa: [
    'machupicchu', 'rio', 'torresdelpaine', 'uyuni', 'iguazufalls', 'peritomoreno',
    'obelisco', 'caminito', 'fitzroy', 'bariloche', 'sugarloaf', 'copacabana',
    'amazontheatre', 'pelourinho', 'lencois', 'brasilia', 'cartagena', 'cocora',
    'guatape', 'cusco', 'rainbowmountain', 'nazca', 'arequipa', 'titicaca',
    'galapagos', 'quito', 'cotopaxi', 'angelfalls', 'roraima', 'atacama',
    'easterisland', 'valparaiso', 'montevideo', 'lamano', 'chiloe',
  ],
};

const keyToIndex = new Map(LOCATIONS.map((l, i) => [l.k, i]));
const DECKS = {};
for (const [id, keys] of Object.entries(DECK_KEYS)) {
  DECKS[id] = keys.map((k) => {
    if (!keyToIndex.has(k)) throw new Error(`deck "${id}" references unknown location "${k}"`);
    return keyToIndex.get(k);
  });
}

module.exports = { DECKS, DECK_KEYS };
