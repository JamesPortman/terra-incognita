// Single source of truth for game locations. Order matters: clients receive this
// same array embedded in index.html, and multiplayer rounds reference entries by
// index — regenerate index.html (build/assemble.js) after any change here.
module.exports = [
  { k: 'shibuya', name: 'Shibuya Crossing', place: 'Tokyo, Japan', lat: 35.6595, lon: 139.7005 },
  { k: 'timessquare', name: 'Times Square', place: 'New York City, USA', lat: 40.758, lon: -73.9855 },
  { k: 'oia', name: 'Oia', place: 'Santorini, Greece', lat: 36.4618, lon: 25.3753 },
  { k: 'machupicchu', name: 'Machu Picchu', place: 'Cusco Region, Peru', lat: -13.1631, lon: -72.545 },
  { k: 'sydneyopera', name: 'Sydney Opera House', place: 'Sydney, Australia', lat: -33.8568, lon: 151.2153 },
  { k: 'tablemountain', name: 'Table Mountain', place: 'Cape Town, South Africa', lat: -33.9628, lon: 18.4098 },
  { k: 'redsquare', name: 'Red Square', place: 'Moscow, Russia', lat: 55.7539, lon: 37.6208 },
  { k: 'eiffel', name: 'Eiffel Tower', place: 'Paris, France', lat: 48.8584, lon: 2.2945 },
  { k: 'rio', name: 'Christ the Redeemer', place: 'Rio de Janeiro, Brazil', lat: -22.9519, lon: -43.2105 },
  { k: 'goldengate', name: 'Golden Gate Bridge', place: 'San Francisco, USA', lat: 37.8199, lon: -122.4783 },
  { k: 'petra', name: 'Petra', place: "Ma'an, Jordan", lat: 30.3285, lon: 35.4444 },
  { k: 'tajmahal', name: 'Taj Mahal', place: 'Agra, India', lat: 27.1751, lon: 78.0421 },
  { k: 'colosseum', name: 'Colosseum', place: 'Rome, Italy', lat: 41.8902, lon: 12.4922 },
  { k: 'chichenitza', name: 'Chichén Itzá', place: 'Yucatán, Mexico', lat: 20.6843, lon: -88.5678 },
  { k: 'moraine', name: 'Moraine Lake', place: 'Banff, Canada', lat: 51.3217, lon: -116.186 },
  { k: 'halong', name: 'Ha Long Bay', place: 'Quảng Ninh, Vietnam', lat: 20.9101, lon: 107.1839 },
  { k: 'reykjavik', name: 'Hallgrímskirkja', place: 'Reykjavík, Iceland', lat: 64.1417, lon: -21.9266 },
  { k: 'dubai', name: 'Burj Khalifa', place: 'Dubai, UAE', lat: 25.1972, lon: 55.2744 },
  { k: 'marrakesh', name: 'Jemaa el-Fnaa', place: 'Marrakesh, Morocco', lat: 31.6258, lon: -7.9891 },
  { k: 'greatwall', name: 'Great Wall at Mutianyu', place: 'Beijing, China', lat: 40.4319, lon: 116.5704 },
];
