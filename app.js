(() => {
  "use strict";

  const G = 4 * Math.PI * Math.PI;
  const EARTHS_PER_SUN = 332946;
  const DAY_TO_YEAR = 1 / 365.25;
  const KM_PER_AU = 149597870.7;
  const AU_YEAR_TO_KM_S = KM_PER_AU / (365.25 * 86400);
  const EARTH_RADIUS_AU = 6371 / KM_PER_AU;
  const MAX_BODIES = 80;
  const ROCHE_GAMEPLAY_SCALE = 1.0;
  const BINARY_MASS_RATIO = .25;
  const canvas = document.querySelector("#spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  // Official NASA/JPL imagery is loaded once and reused like a game texture atlas.
  const nasaTextureSettings = {
    mercury: { src: "assets/nasa/mercury.jpg", crop: .83, cx: .5, cy: .5 },
    venus: { src: "assets/nasa/venus.jpg", crop: .84, cx: .5, cy: .5 },
    earth: { src: "assets/nasa/earth.jpg", crop: .81, cx: .5, cy: .5 },
    mars: { src: "assets/nasa/mars.jpg", crop: .83, cx: .5, cy: .5 },
    jupiter: { src: "assets/nasa/jupiter.jpg", crop: .94, cx: .5, cy: .5 },
    saturn: { src: "assets/nasa/saturn.jpg", crop: .59, cx: .55, cy: .46 },
    uranus: { src: "assets/nasa/uranus.jpg", crop: .82, cx: .5, cy: .5 },
    neptune: { src: "assets/nasa/neptune.jpg", crop: .82, cx: .5, cy: .5 },
    sun: { src: "assets/nasa/sun.jpg", crop: .78, cx: .5, cy: .5 },
  };
  const nasaTextures = Object.fromEntries(Object.entries(nasaTextureSettings).map(([name, settings]) => {
    const image = new Image();
    image.decoding = "async";
    image.src = settings.src;
    return [name, image];
  }));
  const milkyWayPhoto = new Image();
  milkyWayPhoto.decoding = "async";
  milkyWayPhoto.src = "assets/nasa/milky-way-1920.jpg";

  const SoundEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let spaceDroneNode = null;
    let isMuted = false;
    let initialized = false;

    function init() {
      if (initialized) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        ctx = new AudioCtx();
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.28, ctx.currentTime);
        masterGain.connect(ctx.destination);
        startSpaceDrone();
        initialized = true;
      } catch (e) {
        // AudioContext not allowed before user gesture
      }
    }

    function unlock() {
      if (!initialized) init();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
    }

    function toggleMute(muted) {
      isMuted = muted !== undefined ? muted : !isMuted;
      if (!masterGain || !ctx) return isMuted;
      masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.28, ctx.currentTime, 0.05);
      return isMuted;
    }

    function startSpaceDrone() {
      if (!ctx || spaceDroneNode) return;
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const droneGain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(43.65, ctx.currentTime);
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(43.95, ctx.currentTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(110, ctx.currentTime);
        droneGain.gain.setValueAtTime(0.1, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(droneGain);
        droneGain.connect(masterGain);

        osc1.start();
        osc2.start();
        spaceDroneNode = { osc1, osc2, droneGain };
      } catch (e) {}
    }

    function playImpact(intensity = 1.0) {
      if (!ctx || isMuted) return;
      unlock();
      const now = ctx.currentTime;
      try {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(120 * clamp(intensity, 0.6, 2.5), now);
        subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.45);

        subGain.gain.setValueAtTime(0.65 * Math.min(1.4, intensity), now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        subOsc.connect(subGain);
        subGain.connect(masterGain);

        subOsc.start(now);
        subOsc.stop(now + 0.9);

        const bufferSize = Math.floor(ctx.sampleRate * 0.22);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(550, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(110, now + 0.22);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35 * intensity, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);

        noise.start(now);
      } catch (e) {}
    }

    function playSolarFlare() {
      if (!ctx || isMuted) return;
      unlock();
      const now = ctx.currentTime;
      try {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 1.6);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(340, now);
        filter.Q.setValueAtTime(3.5, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 2.1);
      } catch (e) {}
    }

    function playOrbitPlacement() {
      if (!ctx || isMuted) return;
      unlock();
      const now = ctx.currentTime;
      try {
        [523.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);

          gain.gain.setValueAtTime(0.16, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75 + idx * 0.1);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.04);
          osc.stop(now + 0.85 + idx * 0.1);
        });
      } catch (e) {}
    }

    return { init, unlock, toggleMute, playImpact, playSolarFlare, playOrbitPlacement };
  })();

  const ui = Object.fromEntries([...document.querySelectorAll("[id]")].map((node) => [node.id, node]));
  const state = {
    viewport: { width: window.innerWidth || 1280, height: window.innerHeight || 800, dpr: window.devicePixelRatio || 1 },
    bodies: [],
    initialSnapshot: [],
    selectedId: null,
    hoveredId: null,
    running: true,
    simYears: 0,
    speedDays: 10,
    effectiveSpeedDays: 10,
    trailLength: 180,
    showTrails: true,
    showLabels: true,
    showGrid: true,
    showVelocity: false,
    showOrbits: true,
    solarFlaresEnabled: true,
    lensFlaresEnabled: true,
    auroraEnabled: true,
    showAccretionDisk: true,
    audioEnabled: true,
    flareCooldown: 2.0,
    cmeParticles: [],
    camera: { x: 0, y: 0, zoom: 30 },
    followBodyId: null,
    pointer: { x: 0, y: 0, downX: 0, downY: 0, worldX: 0, worldY: 0, dragging: false, moved: false },
    addMode: false,
    moveMode: false,
    grabbedBodyId: null,
    grabbedGroupIds: [],
    grabScreenX: 0,
    grabScreenY: 0,
    resumeAfterMove: true,
    launchStart: null,
    idCounter: 1,
    lastFrame: performance.now(),
    trailTick: 0,
    relationshipTick: 0,
    fps: 60,
    stars: [],
    milkyWay: [],
    effects: [],
    launchTargetId: null,
    launchMode: "impact",
    orbitPlacement: false,
    orbitDistance: 0,
    orbitAngle: 0,
    resumeAfterOrbit: true,
    preset: "solar",
    evolutionStage: 0,
    evolutionAutoPlay: false,
    evolutionTimer: null,
    moonsEngaged: true,
  };

  const scienceByName = {
    Sun: { className: "G-type star", summary: "Main-sequence stellar body", composition: "Hydrogen 73%, helium 25%", atmosphere: "Photosphere and corona", temperature: "5,500 °C surface", density: "1.41 g/cm³", magnetic: 8, magneticLabel: "Variable · ~2× Earth", magneticNote: "A dynamic field drives sunspots, flares, and solar wind." },
    Mercury: { className: "Terrestrial planet", summary: "Small airless iron-rich world", composition: "Iron core, silicate crust", atmosphere: "None / Vacuum", temperature: "−180 to 430 °C", density: "5.43 g/cm³", magnetic: 0, magneticLabel: "No intrinsic field (0.00×)", magneticNote: "Mercury has no protective magnetic field and is fully exposed to solar flares." },
    Venus: { className: "Terrestrial planet", summary: "Cloud-covered greenhouse world", composition: "Silicate rock, iron core", atmosphere: "CO₂ 96.5%, nitrogen", temperature: "465 °C", density: "5.24 g/cm³", magnetic: 0, magneticLabel: "No intrinsic field", magneticNote: "The solar wind creates a weak induced magnetosphere." },
    Earth: { className: "Terrestrial planet", summary: "Temperate ocean world", composition: "Silicate rock, iron-nickel core", atmosphere: "Nitrogen 78%, oxygen 21%", temperature: "15 °C average", density: "5.51 g/cm³", magnetic: 1, magneticLabel: "1.00× Earth", magneticNote: "A strong global field shields the atmosphere and surface." },
    Mars: { className: "Terrestrial planet", summary: "Cold desert world", composition: "Basaltic rock, iron-rich soil", atmosphere: "CO₂ 95%, very thin", temperature: "−63 °C average", density: "3.93 g/cm³", magnetic: .002, magneticLabel: "Crustal remnants only", magneticNote: "Mars lost its global field; magnetism remains in its crust." },
    Jupiter: { className: "Gas giant", summary: "Largest planet in the system", composition: "Hydrogen, helium, metallic H₂", atmosphere: "Hydrogen 90%, helium 10%", temperature: "−110 °C cloud tops", density: "1.33 g/cm³", magnetic: 14, magneticLabel: "14× Earth", magneticNote: "The strongest planetary magnetic field in this system." },
    Saturn: { className: "Gas giant", summary: "Ringed hydrogen-rich world", composition: "Hydrogen, helium, rocky core", atmosphere: "Hydrogen 96%, helium", temperature: "−140 °C cloud tops", density: "0.69 g/cm³", magnetic: .58, magneticLabel: "0.58× Earth", magneticNote: "A broad, unusually symmetrical magnetic field." },
    "Ice Giant V": { className: "Ice giant (Ejected)", summary: "The lost 5th giant planet of the early Solar System", composition: "Water, methane, ammonia ices", atmosphere: "Hydrogen, helium, methane", temperature: "−210 °C", density: "1.52 g/cm³", magnetic: .45, magneticLabel: "0.45× Earth", magneticNote: "Ejected into interstellar space during early Solar System instability." },
    "5th Giant (EJECTING)": { className: "Ice giant (Ejected)", summary: "The lost 5th giant planet slingshotting into interstellar space", composition: "Water, methane, ammonia ices", atmosphere: "Hydrogen, helium, methane", temperature: "−210 °C", density: "1.52 g/cm³", magnetic: .45, magneticLabel: "0.45× Earth", magneticNote: "Ejected into interstellar space during early Solar System instability." },
    Uranus: { className: "Ice giant", summary: "Sideways rotating frozen world", composition: "Water, methane, ammonia ices", atmosphere: "Hydrogen, helium, methane", temperature: "−195 °C", density: "1.27 g/cm³", magnetic: .74, magneticLabel: "0.74× Earth", magneticNote: "A strongly tilted, off-center magnetic field." },
    Neptune: { className: "Ice giant", summary: "Distant world with supersonic winds", composition: "Water, methane, ammonia ices", atmosphere: "Hydrogen, helium, methane", temperature: "−200 °C", density: "1.64 g/cm³", magnetic: .55, magneticLabel: "0.55× Earth", magneticNote: "A tilted field generated far from the planet's center." },
    Moon: { className: "Rocky moon", summary: "Airless natural satellite", composition: "Silicate rock, small iron core", atmosphere: "Trace exosphere", temperature: "−173 to 127 °C", density: "3.34 g/cm³", magnetic: 0, magneticLabel: "No global field", magneticNote: "Small patches of ancient crust retain magnetism." },
  };

  const scienceByType = {
    asteroid: { className: "Small body", summary: "Irregular rocky asteroid", composition: "Silicate rock, nickel-iron", atmosphere: "None", temperature: "Variable", density: "2.4 g/cm³", magnetic: .001, magneticLabel: "Negligible", magneticNote: "May contain locally magnetized metallic minerals." },
    gasGiant: { className: "Gas giant", summary: "Massive hydrogen-rich world", composition: "Hydrogen, helium, dense core", atmosphere: "Hydrogen and helium", temperature: "−120 °C cloud tops", density: "1.2 g/cm³", magnetic: 9, magneticLabel: "~9× Earth", magneticNote: "Conductive metallic hydrogen powers a vast magnetosphere." },
    planet: { className: "Terrestrial planet", summary: "Rocky Earth-class world", composition: "Silicate mantle, iron core", atmosphere: "Nitrogen, CO₂, water vapor", temperature: "18 °C average", density: "5.2 g/cm³", magnetic: .8, magneticLabel: "0.80× Earth", magneticNote: "A rotating liquid core sustains a protective global field." },
    hotPlanet: { className: "Lava planet", summary: "Molten high-energy world", composition: "Molten silicates, iron core", atmosphere: "Rock vapor, sodium, oxygen", temperature: "1,400 °C", density: "5.8 g/cm³", magnetic: .25, magneticLabel: "0.25× Earth", magneticNote: "Heat and tidal forces create an unstable magnetic field." },
    blackHole: { className: "Singularity", summary: "Supermassive gravitational singularity", composition: "Pure mass-energy at infinite density", atmosphere: "Photon sphere and event horizon", temperature: "~0 K (Hawking radiation)", density: "Infinite singularity", magnetic: 50, magneticLabel: "Extreme relativistic", magneticNote: "Generates powerful relativistic accretion jets and frame-dragging." },
    star: { className: "Main-sequence star", summary: "Self-luminous fusion body", composition: "Hydrogen and helium plasma", atmosphere: "Photosphere and corona", temperature: "5,000 °C surface", density: "1.4 g/cm³", magnetic: 6, magneticLabel: "Strong and variable", magneticNote: "Plasma circulation creates a changing stellar field." },
    ice: { className: "Ice giant", summary: "Cold volatile-rich world", composition: "Water, methane, ammonia ices", atmosphere: "Hydrogen, helium, methane", temperature: "−190 °C", density: "1.5 g/cm³", magnetic: .6, magneticLabel: "0.60× Earth", magneticNote: "An offset dynamo creates a tilted magnetosphere." },
    rock: { className: "Rocky body", summary: "Airless terrestrial object", composition: "Silicate rock and iron", atmosphere: "Trace gases", temperature: "Variable", density: "4.1 g/cm³", magnetic: .08, magneticLabel: "0.08× Earth", magneticNote: "Only a weak remnant or induced field is present." },
  };

  const spawnCatalog = {
    asteroid: { label: "Asteroid", mass: 8.6e-7, radius: .026, collisionRadius: 80 / KM_PER_AU, color: "#9c8778", texture: "rock", scienceType: "asteroid" },
    gasGiant: { label: "Gas giant", mass: 180, radius: .12, collisionRadius: 60000 / KM_PER_AU, color: "#d19a68", texture: "jupiter", scienceType: "gasGiant", ring: true },
    planet: { label: "New planet", mass: 1, radius: .055, collisionRadius: EARTH_RADIUS_AU, color: "#4d9fe8", texture: "earth", scienceType: "planet" },
    hotPlanet: { label: "Hot planet", mass: 2.5, radius: .064, collisionRadius: 8500 / KM_PER_AU, color: "#f05b38", texture: "mars", scienceType: "hotPlanet" },
    star: { label: "Star", mass: 332946, radius: .19, collisionRadius: 696340 / KM_PER_AU, color: "#ffb13b", texture: "sun", scienceType: "star" },
    blackHole: { label: "Black Hole", mass: 332946 * 3.5, radius: .14, collisionRadius: 15000 / KM_PER_AU, color: "#05070f", texture: "blackHole", scienceType: "blackHole", isBlackHole: true },
  };

  const starCatalog = {
    gStar: { label: "G-type star", mass: 332946, radius: .19, collisionRadius: 696340 / KM_PER_AU, color: "#ffb13b" },
    redDwarf: { label: "Red dwarf", mass: 66589, radius: .105, collisionRadius: 210000 / KM_PER_AU, color: "#e86845" },
    blueStar: { label: "Blue main-sequence star", mass: 1997676, radius: .28, collisionRadius: 2437000 / KM_PER_AU, color: "#87bdff" },
    redGiant: { label: "Red giant", mass: 499419, radius: .38, collisionRadius: 14000000 / KM_PER_AU, color: "#f07842" },
    whiteDwarf: { label: "White dwarf", mass: 199768, radius: .075, collisionRadius: 8500 / KM_PER_AU, color: "#dcecff" },
  };

  
  const bandPalettes = {
    custom: { name: "Custom Palette", colors: ["#6b21a8", "#9333ea", "#c084fc", "#3b82f6"], storm: "#f43f5e" },
    purpleNebula: { name: "Purple Gas Giant", colors: ["#581c87", "#7e22ce", "#a855f7", "#ec4899"], storm: "#f43f5e" },
    neonCyan: { name: "Neon Cyan Ice Giant", colors: ["#0369a1", "#0284c7", "#38bdf8", "#7dd3fc"], storm: "#0c4a6e" },
    jupiterGold: { name: "Jupiter Amber Gold", colors: ["#78350f", "#b45309", "#d97706", "#fde68a"], storm: "#991b1b" },
    crimsonFury: { name: "Crimson Hot Jupiter", colors: ["#7f1d1d", "#991b1b", "#dc2626", "#f97316"], storm: "#fffbeb" },
    emeraldGas: { name: "Emerald Methane", colors: ["#064e3b", "#047857", "#10b981", "#6ee7b7"], storm: "#022c22" },
  };

  const atmosphereGasSpecs = {
    earthAir: { name: "Nitrogen-Oxygen (Earth)", color: "#60a5fa", haze: 0.6, ghFactor: 1.0, composition: "Nitrogen 78%, Oxygen 21%, Argon 1%" },
    carbonDioxide: { name: "Carbon Dioxide (Venus/Mars)", color: "#fbbf24", haze: 0.9, ghFactor: 2.8, composition: "Carbon Dioxide 96%, Nitrogen 3.5%" },
    hydrogenHelium: { name: "Hydrogen-Helium (Gas Giant)", color: "#818cf8", haze: 0.45, ghFactor: 0.6, composition: "Hydrogen 89%, Helium 10%, Methane 1%" },
    methane: { name: "Methane (Titan/Neptune)", color: "#38bdf8", haze: 0.75, ghFactor: 1.9, composition: "Methane 65%, Hydrogen 30%, Ethane 5%" },
    ammonia: { name: "Ammonia (Exotic)", color: "#a3e635", haze: 0.8, ghFactor: 2.1, composition: "Ammonia 72%, Nitrogen 20%, Water vapor 8%" },
    none: { name: "Airless Vacuum", color: "rgba(0,0,0,0)", haze: 0.0, ghFactor: 0.0, composition: "Trace exosphere (< 10⁻¹² bar)" },
  };

  const atmosphereStyles = {
    earth: ["rgba(91,190,255,.72)", .075],
    venus: ["rgba(255,201,105,.5)", .09],
    mars: ["rgba(205,106,69,.24)", .025],
    jupiter: ["rgba(241,203,157,.28)", .035],
    saturn: ["rgba(238,217,158,.24)", .03],
    uranus: ["rgba(140,239,245,.38)", .055],
    neptune: ["rgba(91,137,255,.48)", .055],
  };

  const planetData = [
    { name: "Sun", mass: 332946, radius: .19, radiusKm: 696340, color: "#ffb13b", texture: "sun", x: 0, phase: 0 },
    { name: "Mercury", mass: .055, radius: .034, radiusKm: 2439.7, color: "#8d8982", texture: "mercury", x: .39, eccentricity: .2056, phase: .45, magneticScale: 0 },
    { name: "Venus", mass: .815, radius: .05, radiusKm: 6051.8, color: "#e6a65c", texture: "venus", x: .72, eccentricity: .0068, phase: 2.2 },
    { name: "Earth", mass: 1, radius: .055, radiusKm: 6371, color: "#4f9cff", texture: "earth", x: 1, eccentricity: .0167, phase: 4.1 },
    { name: "Mars", mass: .107, radius: .043, radiusKm: 3389.5, color: "#a94f36", texture: "mars", x: 1.52, eccentricity: .0934, phase: 5.5 },
    { name: "Jupiter", mass: 317.8, radius: .13, radiusKm: 69911, color: "#d7ad7d", texture: "jupiter", x: 5.2, eccentricity: .0489, phase: 3.25 },
    { name: "Saturn", mass: 95.2, radius: .115, radiusKm: 58232, color: "#d7bd7d", texture: "saturn", x: 9.58, eccentricity: .0565, phase: .9, ring: true },
    { name: "Uranus", mass: 14.5, radius: .083, radiusKm: 25362, color: "#79cbd3", texture: "uranus", x: 19.2, eccentricity: .0472, phase: 5.8, ring: true },
    { name: "Neptune", mass: 17.1, radius: .08, radiusKm: 24622, color: "#315fc9", texture: "neptune", x: 30.05, eccentricity: .0086, phase: 2.75 },
  ];

  const moonSystems = {
    Earth: [{ name: "Moon", mass: .0123, radiusKm: 1737.4, distance: .00257, eccentricity: .0549, phase: .4 }],
    Mars: [
      { name: "Phobos", mass: 1.78e-9, radiusKm: 11.3, distance: .00048, eccentricity: .0151, phase: 1.2, isMoon: true, tidalImmune: true },
      { name: "Deimos", mass: 2.48e-10, radiusKm: 6.2, distance: .00096, phase: 4.4, isMoon: true, tidalImmune: true },
    ],
    Jupiter: [
      { name: "Io", mass: .015, radiusKm: 1821.6, distance: .00282, eccentricity: .0041, phase: .2, color: "#e6c36f" },
      { name: "Europa", mass: .008, radiusKm: 1560.8, distance: .00449, eccentricity: .009, phase: 1.7, color: "#c8b89b" },
      { name: "Ganymede", mass: .0248, radiusKm: 2634.1, distance: .00715, eccentricity: .0013, phase: 3.1, color: "#9c8a75" },
      { name: "Callisto", mass: .018, radiusKm: 2410.3, distance: .01259, eccentricity: .0074, phase: 5.2, color: "#756b63" },
    ],
    Saturn: [
      { name: "Mimas", mass: 6.3e-6, radiusKm: 198.2, distance: .00124, phase: .3 },
      { name: "Enceladus", mass: 1.8e-5, radiusKm: 252.1, distance: .00159, phase: 1.1, color: "#e5edf1" },
      { name: "Tethys", mass: 1.03e-4, radiusKm: 531.1, distance: .00197, phase: 2.0 },
      { name: "Dione", mass: 1.83e-4, radiusKm: 561.4, distance: .00252, phase: 3.0 },
      { name: "Rhea", mass: 3.9e-4, radiusKm: 763.8, distance: .00352, phase: 4.1 },
      { name: "Titan", mass: .0225, radiusKm: 2574.7, distance: .00817, phase: 5.0, color: "#d5a659" },
      { name: "Iapetus", mass: 3e-4, radiusKm: 734.5, distance: .0238, phase: 5.8, color: "#918477" },
    ],
    Uranus: [
      { name: "Miranda", mass: 1.1e-5, radiusKm: 235.8, distance: .000868, phase: .5 },
      { name: "Ariel", mass: 2.26e-4, radiusKm: 578.9, distance: .001276, phase: 1.6 },
      { name: "Umbriel", mass: 2e-4, radiusKm: 584.7, distance: .001778, phase: 2.7, color: "#777b82" },
      { name: "Titania", mass: 5.9e-4, radiusKm: 788.9, distance: .00291, phase: 4.0 },
      { name: "Oberon", mass: 5e-4, radiusKm: 761.4, distance: .00390, phase: 5.3 },
    ],
    Neptune: [
      { name: "Triton", mass: .00359, radiusKm: 1353.4, distance: .00237, phase: 1.0, retrograde: true, color: "#c6b5aa" },
      { name: "Nereid", mass: 5e-5, radiusKm: 170, distance: .0369, eccentricity: .75, phase: 3.7, color: "#8d9298" },
    ],
  };

  function estimatedCollisionRadius(massEarths, texture) {
    if (texture === "sun") return .00465 * Math.max(.2, (massEarths / EARTHS_PER_SUN) ** .75);
    if (["jupiter", "saturn"].includes(texture)) return 60000 / KM_PER_AU;
    return EARTH_RADIUS_AU * Math.max(.08, massEarths ** .28);
  }

  function gravitationalMass(body) {
    return body.mass * (body.gravityScale ?? 1);
  }

  function pairGravityMass(a, b) {
    return (a.gravityScale ?? 1) * (b.gravityScale ?? 1) * (a.mass + b.mass);
  }

  function makeBody(data) {
    const mass = Math.max(1e-12, data.mass ?? .1) / EARTHS_PER_SUN;
    const radius = data.radius || .035;
    const collisionRadius = data.collisionRadius || (data.radiusKm ? data.radiusKm / KM_PER_AU : estimatedCollisionRadius(data.mass ?? .1, data.texture));
return {
      id: state.idCounter++,
      name: data.name || `Body ${state.idCounter}`,
      x: data.x || 0,
      y: data.y || 0,
      vx: data.vx || 0,
      vy: data.vy || 0,
      mass,
      gravityScale: clamp(data.gravityScale ?? 1, 0, 100),
      magneticScale: clamp(data.magneticScale ?? 1, 0, 100),
      radius,
      collisionRadius,
      referenceMass: data.referenceMass ?? mass,
      referenceRadius: data.referenceRadius ?? radius,
      referenceCollisionRadius: data.referenceCollisionRadius ?? collisionRadius,
      color: data.color || "#9cb8d8",
      naturalColor: data.naturalColor || data.color || "#9cb8d8",
      texture: data.texture || "rock",
      ring: Boolean(data.ring),
      ringScale: Math.max(1, data.ringScale ?? 1),
      bandCount: data.bandCount !== undefined ? data.bandCount : 0,
      bandPalette: data.bandPalette || "custom",
      bandColors: data.bandColors ? [...data.bandColors] : ["#78350f", "#b45309", "#d97706", "#fde68a"],
      stormColor: data.stormColor || "#f43f5e",
      bandTurbulence: data.bandTurbulence ?? 50,
      showGreatStorm: Boolean(data.showGreatStorm),
      waterCoverage: data.waterCoverage !== undefined ? data.waterCoverage : (data.name && data.name.includes("Water") ? 100 : 0),
      oceanColor: data.oceanColor || "#1d4ed8",
      landColor: data.landColor || "#15803d",
      iceCapCoverage: data.iceCapCoverage !== undefined ? data.iceCapCoverage : 0,
      customAtmosphere: Boolean(data.customAtmosphere),
      gasType: data.gasType || "none",
      atmoPressure: data.atmoPressure !== undefined ? data.atmoPressure : 1.0,
      atmoColor: data.atmoColor || "#60a5fa",
      atmoHaze: data.atmoHaze !== undefined ? data.atmoHaze : 60,
      scienceType: data.scienceType || (data.texture === "sun" ? "star" : data.texture === "ice" ? "ice" : "rock"),
      science: data.science || scienceByName[data.name] || null,
      parentId: data.parentId || null,
      isMoon: Boolean(data.isMoon),
      isBlackHole: Boolean(data.isBlackHole || data.scienceType === "blackHole" || data.texture === "blackHole"),
      accretionDisk: Boolean(data.accretionDisk || data.isBlackHole || data.scienceType === "blackHole" || data.texture === "blackHole"),
      tidalImmune: Boolean(data.tidalImmune || data.isMoon || data.parentId),
      tidalStress: 0,
      tidalPrimaryId: null,
      binaryPartnerId: data.binaryPartnerId ?? null,
      orbit: data.orbit ? { ...data.orbit } : null,
      trail: [],
    };
  }

  function resizeBodyForMass(body, massEarths) {
    const newMass = Math.max(1e-12, massEarths) / EARTHS_PER_SUN;
    const referenceMass = Math.max(body.referenceMass ?? body.mass, 1e-18);
    const radiusScale = Math.cbrt(newMass / referenceMass);
    body.mass = newMass;
    body.radius = Math.max(.004, (body.referenceRadius ?? body.radius) * radiusScale);
    body.collisionRadius = Math.max(1 / KM_PER_AU, (body.referenceCollisionRadius ?? body.collisionRadius) * radiusScale);
    body.trail = [];
  }

  function makeOrbiter(parent, data) {
    const semiMajor = data.distance;
    const eccentricity = clamp(data.eccentricity || 0, 0, .92);
    const angle = data.phase || 0;
    const distance = semiMajor * (1 - eccentricity);
    const direction = data.retrograde ? -1 : 1;
    const orbiterMass = Math.max(1e-12, data.mass ?? .1) / EARTHS_PER_SUN;
    const orbiterGravityScale = clamp(data.gravityScale ?? 1, 0, 100);
    const effectivePairMass = (parent.gravityScale ?? 1) * orbiterGravityScale * (parent.mass + orbiterMass);
    const speed = Math.sqrt(G * effectivePairMass * (2 / distance - 1 / semiMajor));
    return makeBody({
      ...data,
      x: parent.x + Math.cos(angle) * distance,
      y: parent.y + Math.sin(angle) * distance,
      vx: parent.vx - Math.sin(angle) * speed * direction,
      vy: parent.vy + Math.cos(angle) * speed * direction,
      parentId: parent.id,
      isMoon: Boolean(data.isMoon),
      isBlackHole: Boolean(data.isBlackHole || data.scienceType === "blackHole" || data.texture === "blackHole"),
      accretionDisk: Boolean(data.accretionDisk || data.isBlackHole || data.scienceType === "blackHole" || data.texture === "blackHole"),
      orbit: { parentId: parent.id, a: semiMajor, e: eccentricity, angle, direction },
    });
  }

  function addMajorMoons() {
    const planets = new Map(state.bodies.map((body) => [body.name, body]));
    for (const [planetName, moons] of Object.entries(moonSystems)) {
      const parent = planets.get(planetName);
      if (!parent) continue;
      const anchor = { x: parent.x, y: parent.y, vx: parent.vx, vy: parent.vy };
      const subsystem = [parent];
      for (const moon of moons) {
        const body = makeOrbiter(parent, {
          ...moon,
          radius: .02,
          color: moon.color || "#b6b8bc",
          texture: "rock",
          scienceType: "rock",
          isMoon: true,
          tidalImmune: true,
        });
        subsystem.push(body);
        state.bodies.push(body);
      }
      recenterSubsystem(subsystem, anchor);
    }
  }

  function recenterSubsystem(bodies, anchor) {
    const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
    const center = bodies.reduce((result, body) => ({
      x: result.x + body.x * body.mass / totalMass,
      y: result.y + body.y * body.mass / totalMass,
      vx: result.vx + body.vx * body.mass / totalMass,
      vy: result.vy + body.vy * body.mass / totalMass,
    }), { x: 0, y: 0, vx: 0, vy: 0 });
    for (const body of bodies) {
      body.x += anchor.x - center.x;
      body.y += anchor.y - center.y;
      body.vx += anchor.vx - center.vx;
      body.vy += anchor.vy - center.vy;
    }
  }

  const evolutionDescriptions = [
    "Solar Nebula & Protoplanets (~4.57 Billion Years Ago): The T-Tauri Sun is surrounded by a spinning protoplanetary disk of gas and dust. Gas giant cores and inner planetesimals condense from nebular material.",
    "Theia Collision & Moon Formation (~4.51 Billion Years Ago): Proto-Earth collides with Mars-sized protoplanet Theia! Impact debris orbits Earth and rapidly coalesces to form the Moon.",
    "Ancient Habitable Venus & Wet Mars (~4.40 Billion Years Ago): Early Venus possesses liquid oceans under a temperate climate. Early Mars has rivers, crater lakes, a magnetic dynamo, and active volcanoes.",
    "The 5-Giant Era & Grand Tack (~4.20 Billion Years Ago): Early Solar System possessed 5 giant planets (including Ice Giant V). Jupiter migrates inward then outward, shaping the early asteroid belt.",
    "Giant Instability & 5th Giant Ejection (~3.90 Billion Years Ago): Resonance crossing between Jupiter & Saturn triggers giant planet migration. Jupiter flings Ice Giant V into interstellar space, triggering the Late Heavy Bombardment!",
    "Great Oxidation & Earth Terraforming (~2.40 Billion Years Ago): Cyanobacteria evolve oxygenic photosynthesis, terraforming Earth into a blue oxygen world. Mars loses its atmosphere while Venus overheats.",
    "Present-Day Solar System (Present): Modern 8-planet system in stable orbits with Earth in the habitable zone, 21 major moons, and Jupiter acting as a cosmic shield.",
    "Stellar Evolution & Red Giant Remnant (+5.00 Billion Years): The Sun expands into a Red Giant, swallowing Mercury and Venus, scorching Earth, and pushing outer giant orbits outward before leaving a White Dwarf remnant.",
  ];

  function loadEvolutionStage(stageIndex, saveSnapshot = true) {
    state.evolutionStage = stageIndex;
    state.simYears = 0;
    state.effects = [];
    state.selectedId = null;
    state.followBodyId = null;
    state.bodies = [];

    const descEl = ui.evolutionDesc;
    if (descEl) descEl.textContent = evolutionDescriptions[stageIndex];

    const stepBtns = ui.evolutionStepper?.querySelectorAll(".evo-step");
    if (stepBtns) {
      stepBtns.forEach((btn, idx) => {
        btn.classList.toggle("active", idx === stageIndex);
      });
    }

    if (stageIndex === 0) {
      // 4.57 Ga: Solar Nebula & Protoplanets
      const sun = makeBody({ name: "Young Sun", mass: 332946, radius: .20, radiusKm: 696340, color: "#ffc857", texture: "sun", x: 0, y: 0 });
      state.bodies = [sun];

      const pMerc = makeOrbiter(sun, { name: "Proto-Mercury", mass: .055, radius: .034, radiusKm: 2439.7, color: "#8d8982", texture: "mercury", distance: .39 });
      const pVenus = makeOrbiter(sun, { name: "Proto-Venus", mass: .815, radius: .05, radiusKm: 6051.8, color: "#e6a65c", texture: "venus", distance: .72 });
      const pEarth = makeOrbiter(sun, { name: "Proto-Earth", mass: 1.0, radius: .055, radiusKm: 6371, color: "#4f9cff", texture: "earth", distance: 1.0 });
      const pMars = makeOrbiter(sun, { name: "Proto-Mars", mass: .107, radius: .043, radiusKm: 3389.5, color: "#a94f36", texture: "mars", distance: 1.52 });

      const protoJupiter = makeOrbiter(sun, { name: "Proto-Jupiter", mass: 250, radius: .11, radiusKm: 69911, color: "#dca773", texture: "jupiter", distance: 5.2, eccentricity: .02, phase: .5 });
      const protoSaturn = makeOrbiter(sun, { name: "Proto-Saturn", mass: 80, radius: .095, radiusKm: 58232, color: "#e1ca8f", texture: "saturn", distance: 8.8, eccentricity: .03, phase: 2.1 });
      const iceGiantV = makeOrbiter(sun, { name: "Ice Giant V", mass: 16, radius: .08, radiusKm: 26000, color: "#93c5fd", texture: "ice", distance: 12.2, eccentricity: .04, phase: 3.8 });
      const protoUranus = makeOrbiter(sun, { name: "Proto-Uranus", mass: 12, radius: .075, radiusKm: 25362, color: "#74d4dc", texture: "uranus", distance: 16.5, eccentricity: .04, phase: 1.1 });
      const protoNeptune = makeOrbiter(sun, { name: "Proto-Neptune", mass: 14, radius: .075, radiusKm: 24622, color: "#4672e6", texture: "neptune", distance: 23.0, eccentricity: .01, phase: 5.2 });

      state.bodies.push(pMerc, pVenus, pEarth, pMars, protoJupiter, protoSaturn, iceGiantV, protoUranus, protoNeptune);

      for (let i = 0; i < 16; i++) {
        const dist = 0.5 + (i / 16) * 26.0;
        if (Math.abs(dist - 5.2) < 0.8 || Math.abs(dist - 8.8) < 0.8) continue;
        const angle = (i * 1.37) % (Math.PI * 2);
        state.bodies.push(makeOrbiter(sun, {
          name: `Nebula Asteroid ${i + 1}`,
          mass: 0.001,
          radius: 0.026,
          radiusKm: 150,
          color: i % 2 === 0 ? "#a89b8d" : "#7c98b3",
          texture: "rock",
          distance: dist,
          eccentricity: 0.02 + (i % 3) * 0.03,
          phase: angle
        }));
      }
      state.camera = { x: 0, y: 0, zoom: 35 };
      toast("Era 1: T-Tauri Solar Nebula & Protoplanetary Disk");

    } else if (stageIndex === 1) {
      // 4.51 Ga: Theia Collision & Moon Formation!
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];

      const pMerc = makeOrbiter(sun, { name: "Mercury", mass: .055, radius: .034, radiusKm: 2439.7, color: "#8d8982", texture: "mercury", distance: .39 });
      const pVenus = makeOrbiter(sun, { name: "Venus", mass: .815, radius: .05, radiusKm: 6051.8, color: "#e6a65c", texture: "venus", distance: .72 });
      
      const protoEarth = makeOrbiter(sun, { name: "Proto-Earth", mass: 0.89, radius: .054, radiusKm: 6371, color: "#e86a38", texture: "mars", distance: 1.0, phase: 1.0 });
      
      const theia = makeOrbiter(sun, {
        name: "Theia (Impactor)",
        mass: 0.107,
        radius: .043,
        radiusKm: 3400,
        color: "#f97316",
        texture: "mars",
        distance: 1.008,
        eccentricity: .03,
        phase: 1.03
      });

      const earlyMoon = makeOrbiter(protoEarth, {
        name: "Coalescing Moon",
        mass: 0.0123,
        radius: .035,
        radiusKm: 1737.4,
        color: "#fbbf24",
        texture: "rock",
        distance: .00257,
        eccentricity: .05,
        phase: .5,
        isMoon: true,
        tidalImmune: true
      });

      const pMars = makeOrbiter(sun, { name: "Mars", mass: .107, radius: .043, radiusKm: 3389.5, color: "#a94f36", texture: "mars", distance: 1.52 });
      const jupiter = makeOrbiter(sun, { ...planetData[5], distance: 5.2 });
      const saturn = makeOrbiter(sun, { ...planetData[6], distance: 8.8 });
      const iceGiantV = makeOrbiter(sun, { name: "Ice Giant V", mass: 17, radius: .08, radiusKm: 26000, color: "#93c5fd", texture: "ice", distance: 12.2 });

      state.bodies.push(pMerc, pVenus, protoEarth, theia, earlyMoon, pMars, jupiter, saturn, iceGiantV);
      state.camera = { x: 0, y: 0, zoom: 45 };
      toast("GIANT IMPACT: Proto-Earth & Mars-sized Theia on close encounter orbit forming the Moon!", 6000);

    } else if (stageIndex === 2) {
      // 4.40 Ga: Ancient Habitable Venus & Wet Mars
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];

      const pMerc = makeOrbiter(sun, { name: "Mercury", mass: .055, radius: .034, radiusKm: 2439.7, color: "#8d8982", texture: "mercury", distance: .39 });

      const oceanVenus = makeOrbiter(sun, {
        name: "Ocean Venus (Habitable)",
        mass: .815,
        radius: .052,
        radiusKm: 6051.8,
        color: "#38bdf8",
        texture: "earth",
        distance: .72,
        eccentricity: .0068,
        phase: 1.8
      });

      const hEarth = makeOrbiter(sun, {
        name: "Cooling Earth",
        mass: 1.0,
        radius: .055,
        radiusKm: 6371,
        color: "#2563eb",
        texture: "earth",
        distance: 1.0,
        eccentricity: .0167,
        phase: 3.5
      });
      const hMoon = makeOrbiter(hEarth, { name: "Moon", mass: .0123, radius: .035, radiusKm: 1737.4, color: "#9ca3af", texture: "rock", distance: .00257, eccentricity: .05, phase: .4, isMoon: true, tidalImmune: true });

      const wetMars = makeOrbiter(sun, {
        name: "Wet Mars (Oceanic)",
        mass: .107,
        radius: .043,
        radiusKm: 3389.5,
        color: "#0284c7",
        texture: "earth",
        distance: 1.52,
        eccentricity: .0934,
        phase: 5.1
      });

      const jupiter = makeOrbiter(sun, { ...planetData[5], distance: 5.2 });
      const saturn = makeOrbiter(sun, { ...planetData[6], distance: 8.8 });
      const iceGiantV = makeOrbiter(sun, { name: "Ice Giant V", mass: 17, radius: .08, radiusKm: 26000, color: "#93c5fd", texture: "ice", distance: 12.2 });

      state.bodies.push(pMerc, oceanVenus, hEarth, hMoon, wetMars, jupiter, saturn, iceGiantV);
      state.camera = { x: 0, y: 0, zoom: 45 };
      toast("ANCIENT HABITABILITY: Early Venus and Mars both possess liquid oceans and protective atmospheres!", 6000);

    } else if (stageIndex === 3) {
      // 4.20 Ga: 5 Giants Era & Grand Tack
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];
      
      const merc = makeOrbiter(sun, { ...planetData[1], distance: .39 });
      const venus = makeOrbiter(sun, { ...planetData[2], distance: .72 });
      const earth = makeOrbiter(sun, { ...planetData[3], distance: 1.0 });
      const mars = makeOrbiter(sun, { ...planetData[4], distance: 1.52 });

      const jupiter = makeOrbiter(sun, { ...planetData[5], distance: 5.2 });
      const saturn = makeOrbiter(sun, { ...planetData[6], distance: 8.8 });
      const iceGiantV = makeOrbiter(sun, { name: "Ice Giant V (5th Giant)", mass: 17, radius: .08, radiusKm: 26000, color: "#93c5fd", texture: "ice", distance: 12.2, eccentricity: .04, phase: 3.8, ring: true });
      const uranus = makeOrbiter(sun, { ...planetData[7], distance: 16.8 });
      const neptune = makeOrbiter(sun, { ...planetData[8], distance: 24.0 });

      state.bodies.push(merc, venus, earth, mars, jupiter, saturn, iceGiantV, uranus, neptune);
      state.camera = { x: 0, y: 0, zoom: 30 };
      toast("Era 4: The 5-Giant Era (With Ice Giant V in resonance)");

    } else if (stageIndex === 4) {
      // 3.90 Ga: 5th Giant Ejection & LHB
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];

      const merc = makeOrbiter(sun, { ...planetData[1], distance: .39 });
      const venus = makeOrbiter(sun, { ...planetData[2], distance: .72 });
      const earth = makeOrbiter(sun, { ...planetData[3], distance: 1.0 });
      const moon = makeOrbiter(earth, { name: "Moon", mass: .0123, radius: .035, radiusKm: 1737.4, color: "#b9bcc2", texture: "rock", distance: .00257, eccentricity: .0549, phase: .4, isMoon: true, tidalImmune: true });
      const mars = makeOrbiter(sun, { ...planetData[4], distance: 1.52 });

      const jupiter = makeOrbiter(sun, { ...planetData[5], distance: 5.2, phase: 0.1 });
      const saturn = makeOrbiter(sun, { ...planetData[6], distance: 8.9, phase: 0.8 });
      
      const iceGiantV = makeOrbiter(sun, {
        name: "5th Giant (EJECTING)",
        mass: 17,
        radius: .085,
        radiusKm: 26000,
        color: "#a5f3fc",
        texture: "ice",
        distance: 5.8,
        eccentricity: 0.55,
        phase: 0.2
      });

      const uranus = makeOrbiter(sun, { ...planetData[7], distance: 17.5 });
      const neptune = makeOrbiter(sun, { ...planetData[8], distance: 25.0 });

      state.bodies.push(merc, venus, earth, moon, mars, jupiter, saturn, iceGiantV, uranus, neptune);

      for (let i = 0; i < 12; i++) {
        const pAngle = (i * 0.5) % (Math.PI * 2);
        state.bodies.push(makeOrbiter(sun, {
          name: `LHB Asteroid ${i+1}`,
          mass: 0.001,
          radius: .026,
          radiusKm: 120,
          color: "#9c8778",
          texture: "rock",
          distance: 2.2 + (i % 4) * 0.8,
          eccentricity: 0.35 + (i % 3) * 0.15,
          phase: pAngle
        }));
      }

      state.camera = { x: 0, y: 0, zoom: 28 };
      toast("INSTABILITY ALERT: Resonance flings Ice Giant V near Jupiter, triggering ejection and LHB impacts!", 6000);

    } else if (stageIndex === 5) {
      // 2.40 Ga: Great Oxidation & Earth Terraforming
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];

      const merc = makeOrbiter(sun, { ...planetData[1], distance: .39 });
      const runawayVenus = makeOrbiter(sun, {
        name: "Runaway Greenhouse Venus",
        mass: .815,
        radius: .05,
        radiusKm: 6051.8,
        color: "#f59e0b",
        texture: "venus",
        distance: .72,
        eccentricity: .0068,
        phase: 4.8
      });

      const cyanEarth = makeOrbiter(sun, {
        name: "Terraformed Earth (Blue Sky)",
        mass: 1.0,
        radius: .055,
        radiusKm: 6371,
        color: "#3b82f6",
        texture: "earth",
        distance: 1.0,
        eccentricity: .0167,
        phase: 1.0
      });
      const moon = makeOrbiter(cyanEarth, { name: "Moon", mass: .0123, radius: .035, radiusKm: 1737.4, color: "#b9bcc2", texture: "rock", distance: .00257, eccentricity: .0549, phase: .4, isMoon: true, tidalImmune: true });

      const dryMars = makeOrbiter(sun, {
        name: "Dried Mars (Lost Dynamo)",
        mass: .107,
        radius: .043,
        radiusKm: 3389.5,
        color: "#c2410c",
        texture: "mars",
        distance: 1.52,
        eccentricity: .0934,
        phase: 2.4
      });

      const jupiter = makeOrbiter(sun, { ...planetData[5], distance: 5.2 });
      const saturn = makeOrbiter(sun, { ...planetData[6], distance: 9.58 });

      state.bodies.push(merc, runawayVenus, cyanEarth, moon, dryMars, jupiter, saturn);
      state.camera = { x: 0, y: 0, zoom: 40 };
      toast("GREAT OXIDATION: Cyanobacteria terraform Earth into a blue oxygen world; Mars dries out while Venus overheats!", 6000);

    } else if (stageIndex === 6) {
      // Present Day
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];
      for (const planet of planetData.slice(1)) state.bodies.push(makeOrbiter(sun, { ...planet, distance: planet.x }));
      addMajorMoons();
      state.camera = { x: 0, y: 0, zoom: 20 };
      toast("Era 7: Present-Day Solar System");

    } else if (stageIndex === 7) {
      // +5.00 Ga: Red Giant & Remnant
      const redSun = makeBody({ name: "Red Giant Sun", mass: 250000, radius: .42, radiusKm: 65000000, color: "#ff5232", texture: "sun", x: 0, y: 0 });
      state.bodies = [redSun];

      const scorchedEarth = makeOrbiter(redSun, { name: "Scorched Earth", mass: .95, radius: .055, radiusKm: 6371, color: "#ef4444", texture: "mars", distance: 1.45, eccentricity: .06 });
      const marsRemnant = makeOrbiter(redSun, { name: "Desolate Mars", mass: .107, radius: .043, radiusKm: 3389.5, color: "#7f1d1d", texture: "mars", distance: 2.10, eccentricity: .12 });
      const expandedJupiter = makeOrbiter(redSun, { name: "Expanded Jupiter", mass: 317.8, radius: .135, radiusKm: 69911, color: "#d97706", texture: "jupiter", distance: 6.8 });
      const expandedSaturn = makeOrbiter(redSun, { name: "Expanded Saturn", mass: 95.2, radius: .12, radiusKm: 58232, color: "#b45309", texture: "saturn", distance: 12.5, ring: true });
      const expandedUranus = makeOrbiter(redSun, { name: "Expanded Uranus", mass: 14.5, radius: .085, radiusKm: 25362, color: "#0284c7", texture: "uranus", distance: 24.8 });
      const expandedNeptune = makeOrbiter(redSun, { name: "Expanded Neptune", mass: 17.1, radius: .082, radiusKm: 24622, color: "#1e3a8a", texture: "neptune", distance: 38.0 });

      state.bodies.push(scorchedEarth, marsRemnant, expandedJupiter, expandedSaturn, expandedUranus, expandedNeptune);
      state.camera = { x: 0, y: 0, zoom: 15 };
      toast("Era 8: Red Giant Sun & Planetary Nebula Remnant");
    }

    state.running = true;
    if (saveSnapshot) state.initialSnapshot = serializeBodies();
    updateInteractionHint();
    updateSelectionUI();
    renderSystemRoster();
    updateHUD();
  }

  function loadPreset(name, saveSnapshot = true) {
    if (state.grabbedBodyId != null) finishBodyDrag();
    state.moveMode = false;
    state.grabbedBodyId = null;
    state.grabbedGroupIds = [];
    canvas.classList.remove("move-bodies", "grabbing-body");
    ui.moveBodyMode.classList.remove("active");
    ui.moveBodyMode.setAttribute("aria-pressed", "false");
    state.idCounter = 1;
    state.simYears = 0;
    state.selectedId = null;
    state.followBodyId = null;
    state.launchTargetId = null;
    state.orbitPlacement = false;
    state.effects = [];
    state.relationshipTick = 0;
    state.preset = name;

    if (state.evolutionTimer) {
      clearInterval(state.evolutionTimer);
      state.evolutionTimer = null;
      state.evolutionAutoPlay = false;
      if (ui.evoPlayBtn) ui.evoPlayBtn.textContent = "▶ Auto-Play Eras";
    }

    if (name === "evolution") {
      ui.evolutionHud.hidden = false;
      loadEvolutionStage(0, saveSnapshot);
      toast("Evolution of the Solar System loaded");
      return;
    }

    ui.evolutionHud.hidden = true;

    if (name === "solar") {
      const sun = makeBody(planetData[0]);
      state.bodies = [sun];
      for (const planet of planetData.slice(1)) state.bodies.push(makeOrbiter(sun, { ...planet, distance: planet.x }));
      addMajorMoons();
      recenterSubsystem(state.bodies, { x: 0, y: 0, vx: 0, vy: 0 });
      state.camera = { x: 0, y: 0, zoom: 17 };
    } else if (name === "earthMoon") {
      const earth = makeBody({ name: "Earth", mass: 1, radius: .08, radiusKm: 6371, color: "#4f9cff", texture: "earth" });
      const moon = makeOrbiter(earth, { name: "Moon", mass: .0123, radius: .035, radiusKm: 1737.4, color: "#b9bcc2", texture: "rock", distance: .00257, eccentricity: .0549, phase: .4, isMoon: true, tidalImmune: true });
      state.bodies = [earth, moon];
      recenterSubsystem(state.bodies, { x: 0, y: 0, vx: 0, vy: 0 });
      state.camera = { x: 0, y: 0, zoom: 110000 };
    
        } else if (name === "blackHole") {
      const gargantua = makeBody({
        name: "Gargantua (Black Hole)",
        mass: 1000000,
        radius: .18,
        radiusKm: 25000,
        color: "#05070f",
        texture: "blackHole",
        scienceType: "blackHole",
        isBlackHole: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0
      });
      state.bodies = [gargantua];
      const companion = makeOrbiter(gargantua, {
        name: "Companion Blue Giant",
        mass: 350000,
        radius: .24,
        radiusKm: 850000,
        color: "#60a5fa",
        naturalColor: "#60a5fa",
        texture: "blueStar",
        scienceType: "blueStar",
        distance: 4.6,
        eccentricity: 0.10
      });
      const pulsar = makeOrbiter(gargantua, {
        name: "Relativistic Pulsar",
        mass: 450000,
        radius: .06,
        radiusKm: 15,
        color: "#c084fc",
        texture: "whiteDwarf",
        scienceType: "whiteDwarf",
        distance: 2.2,
        eccentricity: 0.25
      });
      const oceanWorld = makeOrbiter(gargantua, {
        name: "Miller's Planet",
        mass: 1.4,
        radius: .055,
        radiusKm: 7500,
        color: "#38bdf8",
        texture: "earth",
        scienceType: "planet",
        distance: 0.65,
        eccentricity: 0.012
      });
      state.bodies.push(companion, pulsar, oceanWorld);
      state.camera = { x: 0, y: 0, zoom: 42 };

    } else if (name === "binary") {
      const distance = 2.4;
      const speed = Math.sqrt(G * .7 / (distance * 2));
      const aurelia = makeBody({ name: "Aurelia", mass: 230000, radius: .17, color: "#ffd072", texture: "sun", x: -distance / 2, vy: -speed });
      const cyanis = makeBody({ name: "Cyanis", mass: 230000, radius: .17, color: "#88c9ff", texture: "sun", x: distance / 2, vy: speed });
      aurelia.binaryPartnerId = cyanis.id;
      cyanis.binaryPartnerId = aurelia.id;
      state.bodies = [aurelia, cyanis, makeBody({ name: "Drifter", mass: 3, radius: .055, color: "#b37aff", texture: "ice", y: 5.2, vx: -2.35 })];
      state.camera = { x: 0, y: 0, zoom: 78 };
    } else {
      const colors = ["#ffc35c", "#62b8ff", "#f36f56", "#b992ff", "#6ce0b1"];
      state.bodies = Array.from({ length: 5 }, (_, i) => makeBody({
        name: `Wanderer ${i + 1}`,
        mass: 18000 + i * 6500,
        radius: .1 + i * .008,
        color: colors[i],
        texture: i === 0 ? "sun" : "rock",
        x: Math.cos(i * 1.257) * (1.3 + i * .18),
        y: Math.sin(i * 1.257) * (1.3 + i * .18),
        vx: -Math.sin(i * 1.257) * 1.3,
        vy: Math.cos(i * 1.257) * 1.3,
      }));
      state.camera = { x: 0, y: 0, zoom: 120 };
    }
    state.running = true;
    if (name === "solar") state.camera = { x: 0, y: 0, zoom: 28 };
    if (saveSnapshot) state.initialSnapshot = serializeBodies();
    updateInteractionHint();
    updateSelectionUI();
    renderSystemRoster();
    updateHUD();
    toast(`${ui.presetSelect.options[ui.presetSelect.selectedIndex]?.text || "System"} loaded`);
  }

  function serializeBodies() {
    return state.bodies.map(({ trail, ...body }) => {
      try {
        return typeof structuredClone === "function" ? structuredClone(body) : JSON.parse(JSON.stringify(body));
      } catch (e) {
        return { ...body, bandColors: body.bandColors ? [...body.bandColors] : undefined };
      }
    });
  }

  function restoreSnapshot() {
    if (state.grabbedBodyId != null) finishBodyDrag();
    state.moveMode = false;
    state.grabbedBodyId = null;
    state.grabbedGroupIds = [];
    canvas.classList.remove("move-bodies", "grabbing-body");
    ui.moveBodyMode.classList.remove("active");
    ui.moveBodyMode.setAttribute("aria-pressed", "false");
    const wasRunning = state.running;
    state.bodies = state.initialSnapshot.map((body) => ({ ...body, trail: [] }));
    state.idCounter = Math.max(1, ...state.bodies.map((b) => b.id + 1));
    state.simYears = 0;
    state.selectedId = null;
    state.followBodyId = null;
    state.launchTargetId = null;
    state.orbitPlacement = false;
    state.effects = [];
    state.relationshipTick = 0;
    state.running = wasRunning;
    updateInteractionHint();
    updateSelectionUI();
    renderSystemRoster();
    toast("Simulation reset");
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(100, rect.width || canvas.clientWidth || (window.innerWidth - 322) || 1200);
    const height = Math.max(100, rect.height || canvas.clientHeight || window.innerHeight || 800);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.viewport = { width, height, dpr };
    buildStars();
  }

  function buildStars() {
    const count = Math.floor((state.viewport.width * state.viewport.height) / 5200);
    let seed = 92831;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    state.stars = Array.from({ length: count }, () => ({
      x: random() * state.viewport.width,
      y: random() * state.viewport.height,
      radius: random() * 1.25 + .2,
      alpha: random() * .55 + .18,
      blue: random() > .74,
    }));
    const bandCount = Math.min(620, Math.max(220, Math.floor((state.viewport.width * state.viewport.height) / 2500)));
    state.milkyWay = Array.from({ length: bandCount }, () => ({
      x: (random() - .5) * state.viewport.width * 1.9,
      y: (random() + random() + random() - 1.5) * state.viewport.height * .18,
      radius: .25 + random() * 1.35,
      alpha: .08 + random() * .48,
      warm: random() > .82,
    }));
  }

  function screenToWorld(x, y) {
    return {
      x: (x - state.viewport.width / 2) / state.camera.zoom + state.camera.x,
      y: (y - state.viewport.height / 2) / state.camera.zoom + state.camera.y,
    };
  }

  function worldToScreen(x, y) {
    return {
      x: (x - state.camera.x) * state.camera.zoom + state.viewport.width / 2,
      y: (y - state.camera.y) * state.camera.zoom + state.viewport.height / 2,
    };
  }

  function computeAccelerations() {
    const acceleration = state.bodies.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < state.bodies.length; i++) {
      for (let j = i + 1; j < state.bodies.length; j++) {
        const a = state.bodies[i];
        const b = state.bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + 1e-6;
        const invDist = 1 / Math.sqrt(distSq);
        const pairScale = (a.gravityScale ?? 1) * (b.gravityScale ?? 1);
        const factor = G * pairScale * invDist * invDist * invDist;
        acceleration[i].x += factor * b.mass * dx;
        acceleration[i].y += factor * b.mass * dy;
        acceleration[j].x -= factor * a.mass * dx;
        acceleration[j].y -= factor * a.mass * dy;
      }
    }
    return acceleration;
  }

  function integrate(dt) {
    const acceleration = computeAccelerations();
    for (let i = 0; i < state.bodies.length; i++) {
      const body = state.bodies[i];
      body.vx += acceleration[i].x * dt * .5;
      body.vy += acceleration[i].y * dt * .5;
      body.prevX = body.x;
      body.prevY = body.y;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }
    const nextAcceleration = computeAccelerations();
    for (let i = 0; i < state.bodies.length; i++) {
      state.bodies[i].vx += nextAcceleration[i].x * dt * .5;
      state.bodies[i].vy += nextAcceleration[i].y * dt * .5;
    }
    resolveCollisions();
    resolveTidalDisruptions(dt);
  }

  function resolveCollisions() {
    for (let i = 0; i < state.bodies.length; i++) {
      for (let j = i + 1; j < state.bodies.length; j++) {
        const a = state.bodies[i];
        const b = state.bodies[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        const colA = a.collisionRadius;
        const colB = b.collisionRadius;
        const collisionDistance = colA + colB;
        const previousDx = (b.prevX ?? b.x) - (a.prevX ?? a.x);
        const previousDy = (b.prevY ?? b.y) - (a.prevY ?? a.y);
        const segmentX = dx - previousDx;
        const segmentY = dy - previousDy;
        const segmentLengthSq = segmentX * segmentX + segmentY * segmentY;
        const closestT = segmentLengthSq > 0 ? clamp(-(previousDx * segmentX + previousDy * segmentY) / segmentLengthSq, 0, 1) : 1;
        const closestDx = previousDx + segmentX * closestT;
        const closestDy = previousDy + segmentY * closestT;
        if (distance >= collisionDistance && Math.hypot(closestDx, closestDy) >= collisionDistance) continue;
        processRealisticImpact(a, b, Math.min(distance, Math.hypot(closestDx, closestDy)));
        return;
      }
    }
  }

  function processRealisticImpact(a, b, distance) {
    const relVx = b.vx - a.vx;
    const relVy = b.vy - a.vy;
    const relSpeed = Math.hypot(relVx, relVy);
    const relativeSpeedKmS = relSpeed * AU_YEAR_TO_KM_S;
    
    const dist = Math.max(distance, 1e-6);
    const crossProduct = Math.abs((b.x - a.x) * relVy - (b.y - a.y) * relVx);
    const bParam = clamp(crossProduct / (dist * Math.max(Math.hypot(relVx, relVy), 1e-6)), 0, 1);
    const isGrazing = bParam > 0.62;

    const primary = a.mass >= b.mass ? a : b;
    const impactor = primary === a ? b : a;

    if (primary.texture === "sun" || primary.scienceType === "star" || primary.isBlackHole) {
      spawnImpactEffect(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2);
      mergeBodies(a, b, `${primary.isBlackHole ? "BLACK HOLE TIDAL DISRUPTION" : "STELLAR ENGULFMENT"}: ${primary.name} completely consumed ${impactor.name}!`);
      return;
    }

    const combinedColRadius = Math.max(1e-6, a.collisionRadius + b.collisionRadius);
    const vEsc = Math.sqrt(2 * G * (a.mass + b.mass) / combinedColRadius);
    const availableSlots = MAX_BODIES - state.bodies.length;
    const isHighSpeedFragmentation = (relSpeed >= vEsc * 1.35 || relativeSpeedKmS >= 12.0) && availableSlots >= 3 && primary.mass < impactor.mass * 80;

    if (isHighSpeedFragmentation) {
      fragmentCollision(a, b, vEsc, availableSlots);
      return;
    }

    const speedStr = relativeSpeedKmS.toFixed(1);
    let message = "";
    if (isGrazing) {
      message = `GRAZING PASS: ${a.name} & ${b.name} swiped at ${speedStr} km/s (Grazing factor ${bParam.toFixed(2)}) — Merged!`;
    } else {
      message = `DIRECT IMPACT: ${a.name} & ${b.name} collided at ${speedStr} km/s — Merged into unified world!`;
    }

    spawnImpactEffect(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2);
    mergeBodies(a, b, message);
  }

  function fragmentCollision(a, b, vEsc, availableSlots) {
    const totalMass = a.mass + b.mass;
    const comX = (a.x * a.mass + b.x * b.mass) / totalMass;
    const comY = (a.y * a.mass + b.y * b.mass) / totalMass;
    const comVx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
    const comVy = (a.vy * a.mass + b.vy * b.mass) / totalMass;

    const survivor = a.mass >= b.mass ? a : b;
    const destroyed = survivor === a ? b : a;

    const numFragments = Math.min(Math.floor(4 + Math.random() * 5), availableSlots);
    const coreFraction = 0.60 + Math.random() * 0.12;
    const coreMass = totalMass * coreFraction;
    const ejectaMass = totalMass - coreMass;

    const rawWeights = Array.from({ length: numFragments }, () => 0.6 + Math.random() * 0.8);
    const weightSum = rawWeights.reduce((s, w) => s + w, 0);
    const fragmentMasses = rawWeights.map(w => (w / weightSum) * ejectaMass);

    const baseColRadius = Math.cbrt(a.collisionRadius ** 3 + b.collisionRadius ** 3);
    const baseVisRadius = Math.cbrt(a.radius ** 3 + b.radius ** 3);

    survivor.mass = coreMass;
    survivor.x = comX;
    survivor.y = comY;
    survivor.radius = Math.max(0.015, baseVisRadius * Math.cbrt(coreMass / totalMass));
    survivor.collisionRadius = Math.max(1 / KM_PER_AU, baseColRadius * Math.cbrt(coreMass / totalMass));
    survivor.referenceMass = survivor.mass;
    survivor.referenceRadius = survivor.radius;
    survivor.referenceCollisionRadius = survivor.collisionRadius;
    survivor.name = `${survivor.name.split(" ")[0]} Core`;
    survivor.trail = [];
    survivor.tidalStress = 0;

    const impactAngle = Math.atan2(b.y - a.y, b.x - a.x);
    let sumEjectaMomX = 0;
    let sumEjectaMomY = 0;
    const newFragments = [];

    for (let k = 0; k < numFragments; k++) {
      const fMass = fragmentMasses[k];
      const angle = impactAngle + (k / numFragments) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const kickSpeed = vEsc * (0.35 + Math.random() * 0.45);

      const uX = Math.cos(angle) * kickSpeed;
      const uY = Math.sin(angle) * kickSpeed;
      sumEjectaMomX += fMass * uX;
      sumEjectaMomY += fMass * uY;

      const fRadius = Math.max(0.010, baseVisRadius * Math.cbrt(fMass / totalMass));
      const fColRadius = Math.max(1 / KM_PER_AU, baseColRadius * Math.cbrt(fMass / totalMass));
      const spawnDist = (survivor.collisionRadius + fColRadius) * (1.8 + Math.random() * 0.8);

      const frag = makeBody({
        name: `${survivor.name.split(" ")[0]} Fragment ${k + 1}`,
        mass: fMass * EARTHS_PER_SUN,
        radius: fRadius,
        collisionRadius: fColRadius,
        color: Math.random() > 0.4 ? survivor.color : destroyed.color,
        texture: "rock",
        scienceType: "asteroid",
        x: comX + Math.cos(angle) * spawnDist,
        y: comY + Math.sin(angle) * spawnDist,
        vx: comVx + uX,
        vy: comVy + uY,
        parentId: survivor.parentId || survivor.id,
        tidalImmune: true
      });

      newFragments.push(frag);
    }

    survivor.vx = comVx - (sumEjectaMomX / coreMass);
    survivor.vy = comVy - (sumEjectaMomY / coreMass);

    state.bodies.splice(state.bodies.indexOf(destroyed), 1);
    for (const frag of newFragments) {
      state.bodies.push(frag);
    }

    spawnImpactEffect(a, b, comX, comY);
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.08 + Math.random() * 0.35) * (vEsc * 0.4);
      state.effects.push({
        kind: "spark",
        x: comX,
        y: comY,
        vx: comVx + Math.cos(ang) * spd,
        vy: comVy + Math.sin(ang) * spd,
        life: 1.5 + Math.random() * 1.8,
        maxLife: 3.3,
        size: 3 + Math.random() * 4,
        color: "#ff8833"
      });
    }

    refreshOrbitalRelationships();
    updateSelectionUI();
    renderSystemRoster();
    toast(`CATASTROPHIC IMPACT: ${destroyed.name} shattered into ${numFragments} orbiting debris fragments!`, 5000);
  }

  function mergeBodies(a, b, message) {
    const survivor = a.mass >= b.mass ? a : b;
    const removed = survivor === a ? b : a;
    const totalMass = a.mass + b.mass;
    const mergedGravityScale = (gravitationalMass(a) + gravitationalMass(b)) / totalMass;
    const oldIds = new Set([a.id, b.id]);
    survivor.x = (a.x * a.mass + b.x * b.mass) / totalMass;
    survivor.y = (a.y * a.mass + b.y * b.mass) / totalMass;
    survivor.vx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
    survivor.vy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
    survivor.mass = totalMass;
    survivor.gravityScale = mergedGravityScale;
    survivor.radius = Math.cbrt(a.radius ** 3 + b.radius ** 3);
    survivor.collisionRadius = Math.cbrt(a.collisionRadius ** 3 + b.collisionRadius ** 3);
    survivor.referenceMass = survivor.mass;
    survivor.referenceRadius = survivor.radius;
    survivor.referenceCollisionRadius = survivor.collisionRadius;
    survivor.name = `${survivor.name} + ${removed.name}`.slice(0, 24);
    survivor.trail = [];
    survivor.tidalStress = 0;
    survivor.tidalPrimaryId = null;
    survivor.binaryPartnerId = null;
    state.bodies.splice(state.bodies.indexOf(removed), 1);
    for (const body of state.bodies) {
      if (body.id === survivor.id) continue;
      if (body.parentId === removed.id) body.parentId = survivor.id;
      if (oldIds.has(body.binaryPartnerId)) body.binaryPartnerId = null;
      if (body.orbit?.parentId === removed.id) body.orbit = { ...body.orbit, parentId: survivor.id };
      if (body.parentId === survivor.id) body.orbit = osculatingOrbit(body, survivor);
    }
    if (oldIds.has(survivor.parentId)) survivor.parentId = null;
    const survivorParent = survivor.parentId ? state.bodies.find((body) => body.id === survivor.parentId) : null;
    survivor.orbit = survivorParent ? osculatingOrbit(survivor, survivorParent) : null;
    if (state.selectedId === removed.id) state.selectedId = survivor.id;
    if (state.followBodyId === removed.id) state.followBodyId = survivor.id;
    if (state.launchTargetId === removed.id) state.launchTargetId = survivor.id;
    refreshOrbitalRelationships();
    updateSelectionUI();
    renderSystemRoster();
    toast(message);
    return survivor;
  }

  function spawnImpactEffect(a, b, x, y) {
    const relativeSpeed = Math.hypot(a.vx - b.vx, a.vy - b.vy);
    const intensity = clamp(relativeSpeed / 8 + Math.log10((a.mass + b.mass) * EARTHS_PER_SUN + 1) / 4, .65, 2.4);
    const gasImpact = [a.texture, b.texture].some((texture) => ["jupiter", "saturn", "ice"].includes(texture));
    const count = Math.round(36 * intensity);
    state.effects.push({ kind: "shockwave", x, y, life: 2.2, maxLife: 2.2, radius: 8, growth: 115 * intensity, color: lighten(a.mass > b.mass ? a.color : b.color, .35) });
    state.effects.push({ kind: "shockwave", x, y, life: 1.45, maxLife: 1.45, radius: 3, growth: 72 * intensity, color: "#fff0bd" });
    state.effects.push({ kind: "flash", x, y, life: 1.05, maxLife: 1.05, radius: 18 + 12 * intensity, color: "#fff2c2" });
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (.08 + Math.random() * .32) * intensity;
      state.effects.push({
        kind: "particle",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.2 + Math.random() * 1.5,
        maxLife: 2.7,
        size: Math.max(1.5, 3.5 * intensity),
        color: Math.random() > .4 ? (a.mass > b.mass ? a.color : b.color) : "#ffd899",
      });
    }
    const gasCount = gasImpact ? Math.round(24 * intensity) : Math.round(7 * intensity);
    for (let i = 0; i < gasCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (.025 + Math.random() * .1) * intensity;
      state.effects.push({ kind: "gas", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.4 + Math.random() * 2.4, maxLife: 4.8, size: 14 + Math.random() * 22 * intensity, color: Math.random() > .5 ? a.color : b.color });
    }
    if (state.effects.length > 320) state.effects.splice(0, state.effects.length - 320);
    SoundEngine.playImpact(intensity);
  }

  function resolveTidalDisruptions(dt) {
    // 1. Black Hole Extreme Tidal Shredding & Siphoning System
    for (const blackHole of state.bodies) {
      if (!blackHole.isBlackHole && blackHole.texture !== "blackHole") continue;

      for (let j = state.bodies.length - 1; j >= 0; j--) {
        const victim = state.bodies[j];
        if (victim.id === blackHole.id) continue;

        const dx = victim.x - blackHole.x;
        const dy = victim.y - blackHole.y;
        const dist = Math.hypot(dx, dy);

        // Astrophysical Fluid Roche Limit for Black Hole
        const massRatio = blackHole.mass / Math.max(victim.mass, 1e-15);
        const rocheDist = 2.44 * (victim.collisionRadius || victim.radius || 0.00465) * Math.cbrt(massRatio);
        const feedingDist = Math.max(rocheDist * 2.8, blackHole.radius * 22);

        // CATASTROPHIC ROCHE LIMIT BREACH: Object crosses inside Roche Limit -> Instant Collapse & Spaghettification!
        if (dist <= Math.max(rocheDist, blackHole.collisionRadius * 1.5)) {
          // Trigger violent tidal shredding explosion
          spawnImpactEffect(blackHole, victim, (blackHole.x + victim.x) / 2, (blackHole.y + victim.y) / 2);
          SoundEngine.playSupernova();

          // Spawn high-energy relativistic plasma shreds
          for (let k = 0; k < 30; k++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 0.2 + Math.random() * 0.8;
            state.effects.push({
              kind: "spark",
              x: victim.x,
              y: victim.y,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              life: 2.0 + Math.random() * 2.0,
              maxLife: 4.0,
              size: 3.0 + Math.random() * 4.0,
              color: victim.color || "#60a5fa"
            });
          }

          // Swallow mass and expand circular gas accretion disk massively
          blackHole.mass += victim.mass;
          blackHole.accretionScale = clamp((blackHole.accretionScale || 2.4) + 1.8, 2.0, 9.0);
          blackHole.accretionGlow = clamp((blackHole.accretionGlow || 1.0) + 1.2, 1.0, 5.0);
          blackHole.accretionDisk = true;

          const victimName = victim.name;
          state.bodies.splice(state.bodies.indexOf(victim), 1);
          if (state.selectedId === victim.id) state.selectedId = blackHole.id;
          if (state.followBodyId === victim.id) state.followBodyId = blackHole.id;
          if (state.launchTargetId === victim.id) state.launchTargetId = blackHole.id;

          refreshOrbitalRelationships();
          updateSelectionUI();
          renderSystemRoster();
          toast(`💥 TIDAL COLLAPSE: ${victimName} entered ${blackHole.name}'s Roche limit and was shredded apart!`, 6000);
          break;
        }

        // ACCRETION FEEDING ZONE: Outside Roche limit, siphons gas into circular accretion disk
        if (dist <= feedingDist) {
          const isStarOrGiant = victim.texture === "sun" || victim.scienceType === "star" || victim.scienceType === "blueStar" || (victim.scienceType === "gasGiant" && victim.mass * EARTHS_PER_SUN >= 25);
          if (isStarOrGiant) {
            victim.isBeingEaten = true;
            victim.eatingBlackHoleId = blackHole.id;
            blackHole.isFeeding = true;
            blackHole.feedingTargetId = victim.id;

            const siphonedMass = victim.mass * 0.012 * (1.0 - dist / feedingDist) * (dt * 365.25);
            if (siphonedMass > 0 && victim.mass > siphonedMass) {
              victim.mass -= siphonedMass;
              const origMass = victim.referenceMass || (victim.mass + siphonedMass);
              const massRatioShrink = Math.max(0.04, victim.mass / origMass);
              victim.radius = Math.max(0.018, (victim.referenceRadius || victim.radius) * Math.cbrt(massRatioShrink));
              victim.collisionRadius = Math.max(1 / KM_PER_AU, (victim.referenceCollisionRadius || victim.collisionRadius) * Math.cbrt(massRatioShrink));

              blackHole.mass += siphonedMass * 0.85;
              blackHole.accretionScale = clamp((blackHole.accretionScale || 2.4) + (siphonedMass * EARTHS_PER_SUN) * 0.00018, 1.8, 8.0);
              blackHole.accretionGlow = clamp((blackHole.accretionGlow || 1.0) + 0.04, 1.0, 4.5);
              blackHole.accretionDisk = true;
            }
          }
        } else if (victim.eatingBlackHoleId === blackHole.id && dist > feedingDist) {
          victim.isBeingEaten = false;
          victim.eatingBlackHoleId = null;
        }
      }
    }

    const elapsedDays = dt * 365.25;
    for (const body of state.bodies) {
      if (body.tidalImmune || !body.tidalStress) continue;
      if (body.tidalStress >= 1) continue;
      body.tidalStress = Math.max(0, body.tidalStress - elapsedDays * .025);
      if (body.tidalStress === 0) body.tidalPrimaryId = null;
    }
    for (let i = 0; i < state.bodies.length; i++) {
      for (let j = i + 1; j < state.bodies.length; j++) {
        const a = state.bodies[i];
        const b = state.bodies[j];
        const primary = a.mass >= b.mass ? a : b;
        const vulnerable = primary === a ? b : a;
        if (vulnerable.tidalImmune || vulnerable.isMoon || vulnerable.parentId) continue;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const limit = rocheLimit(primary, vulnerable.mass, vulnerable.collisionRadius, vulnerable.gravityScale);
        if (dist > limit) continue;
        const severity = clamp((limit - dist) / Math.max(limit, 1e-9), 0, 1);
        vulnerable.tidalPrimaryId = primary.id;
        vulnerable.tidalStress = clamp((vulnerable.tidalStress ?? 0) + elapsedDays * (.08 + severity * .22), 0, 1);
        if (Math.random() < .45) {
          const kick = .015 + Math.random() * .035;
          const angle = Math.atan2(vulnerable.y - primary.y, vulnerable.x - primary.x) + (Math.random() - .5) * 1.2;
          state.effects.push({
            kind: "fragment",
            x: vulnerable.x,
            y: vulnerable.y,
            vx: vulnerable.vx + Math.cos(angle) * kick,
            vy: vulnerable.vy + Math.sin(angle) * kick,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - .5) * 6,
            life: 1.6 + Math.random() * 1.8,
            maxLife: 3.4,
            size: 2 + Math.random() * 3,
            color: vulnerable.color,
          });
        }
        if (vulnerable.tidalStress < 1) continue;
        const available = Math.min(7, MAX_BODIES - state.bodies.length + 1);
        primary.ring = true;
        primary.ringScale = clamp((primary.ringScale ?? 1) + .3 + vulnerable.mass / primary.mass * 1.5, 1, 4.5);
        if (available < 3) {
          spawnImpactEffect(primary, vulnerable, vulnerable.x, vulnerable.y);
          mergeBodies(primary, vulnerable, `${vulnerable.name} was absorbed into ${primary.name}'s rings`);
          return;
        }
        const fragments = [];
        const fragmentMassEarths = vulnerable.mass * EARTHS_PER_SUN / available;
        const baseAngle = Math.atan2(vulnerable.y - primary.y, vulnerable.x - primary.x);
        const fragmentCollisionRadius = vulnerable.collisionRadius / Math.cbrt(available);
        const fragmentVisualRadius = vulnerable.radius / Math.cbrt(available);
        const spread = vulnerable.collisionRadius * 2.2;
        const kick = .04;
        const offsets = Array.from({ length: available }, (_, index) => {
          const angle = baseAngle + index / available * Math.PI * 2;
          return {
            x: Math.cos(angle) * spread,
            y: Math.sin(angle) * spread,
            vx: Math.cos(angle) * kick,
            vy: Math.sin(angle) * kick,
          };
        });
        const meanOffset = offsets.reduce((mean, offset) => ({
          x: mean.x + offset.x / available,
          y: mean.y + offset.y / available,
          vx: mean.vx + offset.vx / available,
          vy: mean.vy + offset.vy / available,
        }), { x: 0, y: 0, vx: 0, vy: 0 });
        for (let k = 0; k < available; k++) {
          const offset = offsets[k];
          const fragment = makeBody({
            name: `${vulnerable.name} Ring Fragment ${k + 1}`,
            mass: fragmentMassEarths,
            radius: fragmentVisualRadius,
            collisionRadius: fragmentCollisionRadius,
            color: vulnerable.color,
            texture: "rock",
            scienceType: "rock",
            x: vulnerable.x + (offset.x - meanOffset.x),
            y: vulnerable.y + (offset.y - meanOffset.y),
            vx: vulnerable.vx + (offset.vx - meanOffset.vx),
            vy: vulnerable.vy + (offset.vy - meanOffset.vy),
          });
          fragment.parentId = primary.id;
          fragment.orbit = osculatingOrbit(fragment, primary);
          fragment.tidalImmune = true;
          fragments.push(fragment);
          state.bodies.push(fragment);
        }
        spawnImpactEffect(primary, vulnerable, vulnerable.x, vulnerable.y);
        state.bodies.splice(state.bodies.indexOf(vulnerable), 1);
        if (state.selectedId === vulnerable.id) state.selectedId = fragments[0].id;
        if (state.followBodyId === vulnerable.id) state.followBodyId = fragments[0].id;
        if (state.launchTargetId === vulnerable.id) state.launchTargetId = fragments[0].id;
        refreshOrbitalRelationships();
        updateSelectionUI();
        renderSystemRoster();
        toast(`${vulnerable.name} was tidally shredded — ${primary.name}'s rings grew`);
        return;
      }
    }
  }

  function updateEffects(realSeconds) {
    for (const effect of state.effects) {
      effect.life -= realSeconds;
      if ("vx" in effect) {
        effect.x += effect.vx * realSeconds;
        effect.y += effect.vy * realSeconds;
        effect.vx *= effect.kind === "gas" ? .992 : .997;
        effect.vy *= effect.kind === "gas" ? .992 : .997;
      }
      if (effect.rotation != null) effect.rotation += effect.spin * realSeconds;
      if (effect.kind === "shockwave") effect.radius += effect.growth * realSeconds;
      if (effect.kind === "gas") effect.size += 7 * realSeconds;
    }
    state.effects = state.effects.filter((effect) => effect.life > 0);
  }

  function updateSolarPhenomena(dt) {
    if (!state.solarFlaresEnabled) return;
    state.flareCooldown -= dt;

    const stars = state.bodies.filter((b) => b.texture === "sun" || b.scienceType === "star" || b.mass * EARTHS_PER_SUN > 10000);
    for (const star of stars) {
      if (!star.prominences) star.prominences = [];

      if (Math.random() < 0.045) {
        star.prominences.push({
          baseAngle: Math.random() * Math.PI * 2,
          span: 0.2 + Math.random() * 0.45,
          height: 1.15 + Math.random() * 0.38,
          life: 2.5 + Math.random() * 3.5,
          maxLife: 6.0,
          pulseSpeed: 1.5 + Math.random() * 2.0,
        });
      }

      for (let i = star.prominences.length - 1; i >= 0; i--) {
        star.prominences[i].life -= dt;
        if (star.prominences[i].life <= 0) star.prominences.splice(i, 1);
      }

      if (state.flareCooldown <= 0) {
        triggerSolarFlare(star);
        state.flareCooldown = 3.5 + Math.random() * 6.5;
      }
    }

    for (let i = state.cmeParticles.length - 1; i >= 0; i--) {
      const p = state.cmeParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      for (const body of state.bodies) {
        if (body.id === p.originId) continue;
        const dx = body.x - p.x;
        const dy = body.y - p.y;
        const dist = Math.hypot(dx, dy);
        const magScale = Math.max(0, body.magneticScale ?? 1);
        const magnetosphereDist = (body.collisionRadius || 0.001) * (1.8 + Math.sqrt(magScale) * 3.8);

        if (dist <= magnetosphereDist) {
          const magScale = Math.max(0, body.magneticScale ?? 1);

          if (magScale >= 0.5) {
            // TIER 1: STRONG MAGNETIC FIELD (Earth, Jupiter, Saturn, Uranus, Neptune, custom magnetic worlds >= 0.5x)
            // Complete magnetic deflection: ZERO scorching! Triggers intense shimmering auroras and bow shock deflection wave!
            body.auroraExcitement = Math.min(1.0, (body.auroraExcitement || 0) + 0.65);
            body.bowShockFlare = 1.0;

            if (!body.auroraNotified) {
              body.auroraNotified = true;
              toast(`🌌 GEOMAGNETIC AURORA: ${body.name}'s magnetic field deflected the solar flare, igniting brilliant polar auroras!`, 4500);
            }

            // Deflected auroral plasma sparks
            for (let s = 0; s < 2; s++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 0.12 + Math.random() * 0.35;
              state.effects.push({
                kind: "spark",
                x: p.x,
                y: p.y,
                vx: (p.vx * 0.25) + Math.cos(ang) * spd,
                vy: (p.vy * 0.25) + Math.sin(ang) * spd,
                life: 0.8 + Math.random() * 0.7,
                maxLife: 1.5,
                size: 2.0 + Math.random() * 2.2,
                color: Math.random() > 0.5 ? "#4ade80" : "#a855f7"
              });
            }
          } else if (magScale > 0.05 && magScale < 0.5) {
            // TIER 2: WEAK MAGNETIC FIELD (Mars 0.1x, weak crustal worlds)
            // Partial shielding: Mild warming and radiation, slight auroral flicker, NO heavy scorching!
            const weakFactor = (0.5 - magScale) / 0.45;
            body.temperatureKelvin = (body.temperatureKelvin || 210) + 14.0 * weakFactor;
            body.radiumDose = (body.radiumDose || 0.12) + 3.0 * weakFactor;
            body.auroraExcitement = Math.min(0.65, (body.auroraExcitement || 0) + 0.3);

            if (!body.weakShieldNotified) {
              body.weakShieldNotified = true;
              toast(`⚡ IONOSPHERIC DISTURBANCE: ${body.name}'s weak magnetic field partially absorbed solar flare energy.`, 4000);
            }

            for (let s = 0; s < 2; s++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 0.1 + Math.random() * 0.25;
              state.effects.push({
                kind: "spark",
                x: p.x,
                y: p.y,
                vx: (p.vx * 0.2) + Math.cos(ang) * spd,
                vy: (p.vy * 0.2) + Math.sin(ang) * spd,
                life: 0.7 + Math.random() * 0.6,
                maxLife: 1.3,
                size: 1.8 + Math.random() * 1.5,
                color: "#f59e0b"
              });
            }
          } else {
            // TIER 3: ZERO / AIRLESS UNPROTECTED MAGNETIC FIELD (Mercury, Moon, Venus, airless bodies, magScale <= 0.05)
            // Direct severe scorching! Surface burns into orangey-grayish crust with thermal fractures!
            body.temperatureKelvin = (body.temperatureKelvin || 288) + 45.0;
            body.radiumDose = (body.radiumDose || 0.12) + 9.5;
            body.scorchLevel = clamp((body.scorchLevel || 0) + 0.18, 0, 1.0);

            if (!body.name.startsWith("Scorched ")) {
              body.originalName = body.originalName || body.name;
              body.name = `Scorched ${body.originalName}`;
            }

            if (body.science) {
              body.science.summary = "Solar flare bombarded scorched world with burnt crust and extreme radiation.";
              body.science.temperature = `${Math.round(body.temperatureKelvin - 273.15)} °C (Scorched)`;
            }

            if (!body.scorchNotified) {
              body.scorchNotified = true;
              toast(`🔥 SOLAR FLARE STRIKE: CME particles slammed into ${body.name}'s unshielded surface, scorching the terrain!`, 5000);
            }

            // Molten impact sparks
            for (let s = 0; s < 3; s++) {
              const spd = 0.15 + Math.random() * 0.45;
              const ang = Math.random() * Math.PI * 2;
              state.effects.push({
                kind: "spark",
                x: p.x,
                y: p.y,
                vx: (p.vx * 0.15) + Math.cos(ang) * spd,
                vy: (p.vy * 0.15) + Math.sin(ang) * spd,
                life: 0.9 + Math.random() * 0.9,
                maxLife: 1.8,
                size: 2.2 + Math.random() * 3.0,
                color: body.temperatureKelvin > 1000 ? "#ff4500" : "#ea580c"
              });
            }
          }

          p.life = 0;
          break;
        }
      }

      if (p.life <= 0) {
        state.cmeParticles.splice(i, 1);
      }
    }
  }

  
  
  function crushIntoBlackHole(targetBody) {
    const body = targetBody || selectedBody();
    if (!body) { toast("Select an object to crush into a black hole!"); return; }
    if (body.isBlackHole) { toast("Object is already a black hole singularity!"); return; }

    SoundEngine.playSupernova();

    state.effects.push({ kind: "flash", x: body.x, y: body.y, life: 2.2, maxLife: 2.2, radius: visualRadius(body) * 6, color: "#ffffff" });
    state.effects.push({ kind: "shockwave", x: body.x, y: body.y, life: 2.5, maxLife: 2.5, radius: visualRadius(body) * 4, growth: -35, color: "#38bdf8" });
    
    for (let i = 0; i < 45; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.4 + Math.random() * 1.6;
      state.effects.push({
        kind: "spark",
        x: body.x + Math.cos(ang) * (body.radius * 1.5),
        y: body.y + Math.sin(ang) * (body.radius * 1.5),
        vx: -Math.cos(ang) * spd,
        vy: -Math.sin(ang) * spd,
        life: 1.2 + Math.random() * 1.0,
        maxLife: 2.2,
        size: 2.5 + Math.random() * 3.5,
        color: "#60a5fa"
      });
    }

    body.name = `${body.name} (Black Hole)`;
    body.color = "#05070f";
    body.naturalColor = "#05070f";
    body.texture = "blackHole";
    body.scienceType = "blackHole";
    body.isBlackHole = true;
    body.accretionDisk = true;
    body.radius = Math.max(0.045, Math.min(0.18, body.radius * 0.45));
    body.collisionRadius = Math.max(150 / KM_PER_AU, body.collisionRadius * 0.1);
    body.referenceRadius = body.radius;
    body.referenceCollisionRadius = body.collisionRadius;
    body.magneticScale = 50;

    updateSelectionUI();
    renderSystemRoster();
    toast(`GRAVITATIONAL COLLAPSE: ${body.name} was crushed into a black hole!`, 5500);
  }

  function triggerSupernova(targetStar) {
    const star = targetStar || state.bodies.find(b => b.texture === "sun" || b.scienceType === "star") || selectedBody();
    if (!star) {
      toast("Select a star to detonate!");
      return;
    }

    const x = star.x;
    const y = star.y;
    const initialMassSolar = star.mass;
    const isHypermassive = initialMassSolar * EARTHS_PER_SUN >= 600000;
    const isIntermediate = initialMassSolar * EARTHS_PER_SUN >= 180000;

    let remnantName = `${star.name} (White Dwarf)`;
    let remnantMassSolar = 0.55;
    let remnantRadius = 0.075;
    let remnantColor = "#e0f2fe";
    let remnantTexture = "sun";
    let remnantScience = "whiteDwarf";
    let isBlackHole = false;

    if (isHypermassive) {
      remnantName = `${star.name} (Black Hole)`;
      remnantMassSolar = initialMassSolar * 0.40;
      remnantRadius = 0.12;
      remnantColor = "#05070f";
      remnantTexture = "blackHole";
      remnantScience = "blackHole";
      isBlackHole = true;
    } else if (isIntermediate) {
      remnantName = `${star.name} (Pulsar)`;
      remnantMassSolar = 1.4;
      remnantRadius = 0.045;
      remnantColor = "#38bdf8";
      remnantTexture = "sun";
      remnantScience = "whiteDwarf";
    }

    const ejectaMassSolar = initialMassSolar - remnantMassSolar;

    state.effects.push({ kind: "flash", x, y, life: 3.5, maxLife: 3.5, radius: 150, color: "#ffffff" });
    state.effects.push({ kind: "shockwave", x, y, life: 4.5, maxLife: 4.5, radius: 15, growth: 260, color: "#ff3b30" });
    state.effects.push({ kind: "shockwave", x, y, life: 3.8, maxLife: 3.8, radius: 8, growth: 180, color: "#38bdf8" });
    state.effects.push({ kind: "shockwave", x, y, life: 3.2, maxLife: 3.2, radius: 4, growth: 120, color: "#ec4899" });

    for (let i = 0; i < 90; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 3.5;
      state.effects.push({
        kind: "gas",
        x,
        y,
        vx: star.vx + Math.cos(ang) * spd,
        vy: star.vy + Math.sin(ang) * spd,
        life: 4.5 + Math.random() * 4.5,
        maxLife: 9.0,
        size: 28 + Math.random() * 50,
        color: ["#ff453a", "#bf5af2", "#5e5ce6", "#64d2ff", "#ffd60a"][i % 5]
      });
    }

    star.mass = remnantMassSolar;
    star.name = remnantName;
    star.color = remnantColor;
    star.radius = remnantRadius;
    star.collisionRadius = isBlackHole ? 0.05 : 0.001;
    star.referenceMass = star.mass;
    star.referenceRadius = star.radius;
    star.referenceCollisionRadius = star.collisionRadius;
    star.texture = remnantTexture;
    star.scienceType = remnantScience;
    star.isBlackHole = isBlackHole;
    star.prominences = [];
    star.trail = [];

    for (const body of state.bodies) {
      if (body.id === star.id) continue;
      const dx = body.x - x;
      const dy = body.y - y;
      const dist = Math.max(0.15, Math.hypot(dx, dy));
      const kick = (0.28 * ejectaMassSolar) / (dist * dist * Math.max(0.001, body.mass));
      body.vx += (dx / dist) * Math.min(kick, 8.0);
      body.vy += (dy / dist) * Math.min(kick, 8.0);
      if (dist < 3.5 && body.texture !== "sun") {
        body.color = "#7f1d1d";
        body.texture = "mars";
        body.name = `Scorched ${body.name}`;
      }
    }

    SoundEngine.playSupernova();
    refreshOrbitalRelationships();
    updateSelectionUI();
    renderSystemRoster();
    toast(`SUPERNOVA DETONATION: Core collapsed into ${remnantName}!`, 6000);
  }

  function createPlanetaryRingSystem(planet, style = "saturn", particleCount = 20) {
    const targetPlanet = planet || selectedBody();
    if (!targetPlanet) {
      toast("Select a planet first to generate rings!");
      return;
    }

    targetPlanet.ring = true;
    targetPlanet.ringScale = 2.2;

    const available = Math.max(0, MAX_BODIES - state.bodies.length);
    const count = Math.min(available, particleCount);
    const innerDist = targetPlanet.collisionRadius * 2.2;
    const outerDist = targetPlanet.collisionRadius * 4.8;
    const parentGravScale = targetPlanet.gravityScale ?? 1;

    for (let i = 0; i < count; i++) {
      const dist = innerDist + (i / count) * (outerDist - innerDist) + (Math.random() - 0.5) * 0.05;
      const phase = (i / count) * Math.PI * 2 + Math.random() * 0.25;
      const speed = Math.sqrt(G * parentGravScale * targetPlanet.mass / Math.max(dist, 1e-6));

      const ringBody = makeBody({
        name: `${targetPlanet.name} Ring Particle ${i + 1}`,
        mass: 1e-7,
        radius: 0.015,
        collisionRadius: 20 / KM_PER_AU,
        color: i % 2 === 0 ? "#e2d3b4" : "#c4b595",
        texture: "rock",
        scienceType: "asteroid",
        x: targetPlanet.x + Math.cos(phase) * dist,
        y: targetPlanet.y + Math.sin(phase) * dist,
        vx: targetPlanet.vx - Math.sin(phase) * speed,
        vy: targetPlanet.vy + Math.cos(phase) * speed,
        parentId: targetPlanet.id,
        isMoon: true,
        tidalImmune: true
      });
      state.bodies.push(ringBody);
    }

    SoundEngine.playOrbitPlacement();
    updateSelectionUI();
    renderSystemRoster();
    toast(`Spawned dynamic ring system of orbiting particles around ${targetPlanet.name}!`, 4500);
  }

  function triggerSolarFlare(targetStar) {
    const star = targetStar || state.bodies.find((b) => b.texture === "sun" || b.scienceType === "star") || state.bodies[0];
    if (!star) return;

    const burstAngle = Math.random() * Math.PI * 2;
    const burstCount = 42;
    const baseSpeed = 4.8 + Math.random() * 3.2;

    for (let i = 0; i < burstCount; i++) {
      const spread = (Math.random() - 0.5) * 0.72;
      const speed = baseSpeed * (0.75 + Math.random() * 0.5);
      const angle = burstAngle + spread;
      state.cmeParticles.push({
        x: star.x + Math.cos(angle) * (star.collisionRadius * 1.6),
        y: star.y + Math.sin(angle) * (star.collisionRadius * 1.6),
        vx: star.vx + Math.cos(angle) * speed,
        vy: star.vy + Math.sin(angle) * speed,
        life: 5.5 + Math.random() * 4.0,
        maxLife: 9.5,
        size: 2.0 + Math.random() * 3.5,
        color: star.color || "#ffb13b",
        originId: star.id,
      });
    }

    if (state.cmeParticles.length > 250) state.cmeParticles.splice(0, state.cmeParticles.length - 250);
    SoundEngine.playSolarFlare();
  }

  function closestEncounterStep() {
    let safestStep = Infinity;
    for (let i = 0; i < state.bodies.length; i++) {
      for (let j = i + 1; j < state.bodies.length; j++) {
        const a = state.bodies[i];
        const b = state.bodies[j];
        const effectiveMass = pairGravityMass(a, b);
        if (effectiveMass <= 0) continue;
        const distance = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1e-9);
        const dynamicalTime = Math.sqrt(distance ** 3 / (G * effectiveMass));
        safestStep = Math.min(safestStep, dynamicalTime / 24);
      }
    }
    return safestStep;
  }

  function updateSimulation(realSeconds, wallSeconds = realSeconds) {
    if (!state.running || state.speedDays <= 0 || !state.bodies.length) return;
    const requestedDt = realSeconds * state.speedDays * DAY_TO_YEAR;


    const shortestPeriod = state.bodies.reduce((shortest, body) => {
      if (!body.orbit) return shortest;
      const parent = state.bodies.find((candidate) => candidate.id === body.orbit.parentId);
      if (!parent || !body.orbit.a) return shortest;
      const period = Math.sqrt(body.orbit.a ** 3 / Math.max(pairGravityMass(parent, body), 1e-15));
      // Clamp moon minimum step to prevent excessive slowdown while ensuring stability
      const effectivePeriod = body.isMoon ? Math.max(period, 0.005) : period;
      return Math.min(shortest, effectivePeriod);
    }, Infinity);

    const minStarDist = state.bodies.reduce((minD, b) => {
      for (const star of state.bodies) {
        if (star.id === b.id) continue;
        if (star.texture === "sun" || star.scienceType === "star" || star.isBlackHole) {
          const dist = Math.hypot(b.x - star.x, b.y - star.y);
          if (dist < minD) minD = dist;
        }
      }
      return minD;
    }, Infinity);

    const encounterStep = closestEncounterStep();
    const closeScale = minStarDist < 0.6 ? Math.max(0.12, minStarDist / 0.6) : 1.0;
    const accuracyStep = Math.min(
      .001 * DAY_TO_YEAR * closeScale,
      Number.isFinite(shortestPeriod) ? (shortestPeriod / 75) * closeScale : Infinity,
      Number.isFinite(encounterStep) ? encounterStep : Infinity,
    );

    const maxSteps = state.speedDays >= 300 ? 60 : state.speedDays >= 100 ? 45 : state.speedDays >= 30 ? 30 : 50;
    const steps = Math.min(maxSteps, Math.max(1, Math.ceil(requestedDt / accuracyStep)));
    const dt = requestedDt / steps;
    const detailedTrails = state.trailLength > 0 && state.speedDays >= 50;
    const sampleEvery = Math.max(1, Math.floor(steps / 6));

    for (let i = 0; i < steps; i++) {
      integrate(dt);
      if (detailedTrails && ((i + 1) % sampleEvery === 0 || i === steps - 1)) recordTrailSnapshot();
    }

    state.simYears += requestedDt;
    const achievedSpeed = requestedDt / DAY_TO_YEAR / Math.max(wallSeconds, .001);
    state.effectiveSpeedDays += (achievedSpeed - state.effectiveSpeedDays) * .25;
    
    state.relationshipTick += 1;
    if (state.relationshipTick >= 12) {
      state.relationshipTick = 0;
      refreshOrbitalRelationships();
    }
    state.trailTick += 1;
    if (!detailedTrails && state.trailTick >= 3 && state.trailLength > 0) {
      state.trailTick = 0;
      recordTrailSnapshot();
    }
  }

  function recordTrailSnapshot() {
    for (const body of state.bodies) {
      body.trail.push({ x: body.x, y: body.y });
      if (body.trail.length > state.trailLength) body.trail.splice(0, body.trail.length - state.trailLength);
    }
  }

  function drawBackground() {
    const { width, height } = state.viewport;
    const gradient = ctx.createRadialGradient(width * .58, height * .45, 0, width * .58, height * .45, Math.max(width, height) * .8);
    gradient.addColorStop(0, "#0a1729");
    gradient.addColorStop(.45, "#050c17");
    gradient.addColorStop(1, "#010308");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const parallaxX = Math.sin(state.camera.x * .07) * width * .04;
    const parallaxY = Math.sin(state.camera.y * .07) * height * .035;
    const hasMilkyWayPhoto = milkyWayPhoto.complete && milkyWayPhoto.naturalWidth > 0;
    if (hasMilkyWayPhoto) {
      const viewRatio = width / height;
      // Zoom into the useful star field and leave the source map's printed border offscreen.
      const sourceHeight = milkyWayPhoto.naturalHeight * .56;
      const sourceWidth = Math.min(milkyWayPhoto.naturalWidth, sourceHeight * viewRatio);
      const travelX = Math.max(0, milkyWayPhoto.naturalWidth - sourceWidth);
      const travelY = Math.max(0, milkyWayPhoto.naturalHeight - sourceHeight);
      const sourceX = travelX * (.5 + Math.sin(state.camera.x * .025) * .08);
      const sourceY = travelY * (.46 + Math.sin(state.camera.y * .025) * .06);
      ctx.save();
      ctx.globalAlpha = .42;
      ctx.drawImage(milkyWayPhoto, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
      ctx.restore();
      const photoShade = ctx.createRadialGradient(width * .55, height * .42, 0, width * .55, height * .42, Math.max(width, height) * .78);
      photoShade.addColorStop(0, "rgba(3,10,24,.1)");
      photoShade.addColorStop(.55, "rgba(1,5,14,.36)");
      photoShade.addColorStop(1, "rgba(0,2,8,.82)");
      ctx.fillStyle = photoShade;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.save();
      ctx.translate(width * .5 + parallaxX, height * .48 + parallaxY);
      ctx.rotate(-.27);
      const galaxyGlow = ctx.createLinearGradient(0, -height * .3, 0, height * .3);
      galaxyGlow.addColorStop(0, "rgba(28,54,102,0)");
      galaxyGlow.addColorStop(.25, "rgba(63,91,151,.08)");
      galaxyGlow.addColorStop(.44, "rgba(170,183,216,.15)");
      galaxyGlow.addColorStop(.5, "rgba(224,215,197,.19)");
      galaxyGlow.addColorStop(.58, "rgba(117,137,185,.13)");
      galaxyGlow.addColorStop(.78, "rgba(45,72,129,.06)");
      galaxyGlow.addColorStop(1, "rgba(18,38,78,0)");
      ctx.fillStyle = galaxyGlow;
      ctx.fillRect(-width * 1.2, -height * .32, width * 2.4, height * .64);
      for (const star of state.milkyWay) {
        ctx.fillStyle = star.warm ? `rgba(255,221,176,${star.alpha})` : `rgba(191,214,255,${star.alpha})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    for (const star of state.stars) {
      const starParallaxX = ((-state.camera.x * state.camera.zoom * .012) % width + width) % width;
      const starParallaxY = ((-state.camera.y * state.camera.zoom * .012) % height + height) % height;
      const x = (star.x + starParallaxX) % width;
      const y = (star.y + starParallaxY) % height;
      ctx.fillStyle = star.blue ? `rgba(143,190,255,${star.alpha})` : `rgba(255,255,255,${star.alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGrid() {
    if (!state.showGrid) return;
    const { width, height } = state.viewport;
    const desiredWorld = 95 / state.camera.zoom;
    const power = 10 ** Math.floor(Math.log10(desiredWorld));
    const fraction = desiredWorld / power;
    const step = (fraction < 2 ? 2 : fraction < 5 ? 5 : 10) * power;
    const left = state.camera.x - width / 2 / state.camera.zoom;
    const right = state.camera.x + width / 2 / state.camera.zoom;
    const top = state.camera.y - height / 2 / state.camera.zoom;
    const bottom = state.camera.y + height / 2 / state.camera.zoom;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(94,133,191,.07)";
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      const sx = worldToScreen(x, 0).x;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, height);
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      const sy = worldToScreen(0, y).y;
      ctx.moveTo(0, sy); ctx.lineTo(width, sy);
    }
    ctx.stroke();
  }

  function visualRadius(body) {
    const physical = body.collisionRadius * state.camera.zoom;
    const massEarths = body.mass * EARTHS_PER_SUN;
    const moonRadiusKm = body.collisionRadius * KM_PER_AU;
    const moonMinimum = clamp(3.2 + Math.log10(Math.max(2, moonRadiusKm)) * 1.25, 3.8, 7.6);
    const planetMinimum = clamp(7.5 + Math.log10(Math.max(.02, massEarths) + 1) * 2.8, 7.5, 19);
    const minimum = body.isMoon ? moonMinimum : massEarths > 10000 ? 20 : planetMinimum;
    return Math.max(minimum, Math.min(96, physical));
  }

  function bodyDisplayPoint(body) {
    const physical = worldToScreen(body.x, body.y);
    if (!body.isMoon || state.grabbedBodyId === body.id) return physical;
    const parent = body.parentId ? state.bodies.find((candidate) => candidate.id === body.parentId) : null;
    if (!parent) return physical;
    const parentPoint = worldToScreen(parent.x, parent.y);
    const dx = physical.x - parentPoint.x;
    const dy = physical.y - parentPoint.y;
    const actualDistance = Math.hypot(dx, dy);
    const siblings = state.bodies
      .filter((candidate) => candidate.isMoon && candidate.parentId === parent.id)
      .sort((a, b) => Math.hypot(a.x - parent.x, a.y - parent.y) - Math.hypot(b.x - parent.x, b.y - parent.y));
    const rank = Math.max(0, siblings.findIndex((candidate) => candidate.id === body.id));
    const readableDistance = visualRadius(parent) + visualRadius(body) + 10 + rank * 7;
    if (actualDistance >= readableDistance) return physical;
    const angle = actualDistance > 1e-9 ? Math.atan2(dy, dx) : body.id * 2.399;
    return {
      x: parentPoint.x + Math.cos(angle) * readableDistance,
      y: parentPoint.y + Math.sin(angle) * readableDistance,
    };
  }

  function drawOrbitGuides() {
    if (!state.showOrbits) return;
    for (const body of state.bodies) {
      if (!body.orbit) continue;
      const parent = state.bodies.find((candidate) => candidate.id === body.orbit.parentId);
      if (!parent) continue;
      const liveOrbit = osculatingOrbit(body, parent) || body.orbit;
      const a = Number.isFinite(liveOrbit.a) && liveOrbit.a > 0 ? liveOrbit.a : body.orbit.a;
      if (!Number.isFinite(a) || a <= 0) continue;
      const e = clamp(liveOrbit.e ?? body.orbit.e ?? 0, 0, .88);
      if (body.isMoon) {
        const parentPoint = worldToScreen(parent.x, parent.y);
        const displayPoint = bodyDisplayPoint(body);
        const physicalPoint = worldToScreen(body.x, body.y);
        const displayDistance = Math.hypot(displayPoint.x - parentPoint.x, displayPoint.y - parentPoint.y);
        const physicalDistance = Math.hypot(physicalPoint.x - parentPoint.x, physicalPoint.y - parentPoint.y);
        if (displayDistance > physicalDistance + 1) {
          ctx.strokeStyle = body === selectedBody() || parent === selectedBody() ? "rgba(129,190,255,.34)" : "rgba(151,181,220,.13)";
          ctx.lineWidth = body === selectedBody() ? 1.2 : .7;
          ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(parentPoint.x, parentPoint.y, displayDistance, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
      }
      const b = a * Math.sqrt(1 - e * e);
      if (a * state.camera.zoom < 3) continue;
      const angle = liveOrbit.angle || body.orbit.angle || 0;
      const center = worldToScreen(parent.x - Math.cos(angle) * a * e, parent.y - Math.sin(angle) * a * e);
      ctx.save();
      ctx.strokeStyle = body.isMoon ? "rgba(151,181,220,.18)" : body.name.includes("Mercury") ? "rgba(180,170,160,.45)" : "rgba(104,155,224,.24)";
      ctx.lineWidth = body === selectedBody() ? 1.4 : .8;
      ctx.setLineDash(body === selectedBody() ? [5, 4] : []);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, a * state.camera.zoom, b * state.camera.zoom, angle, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function binaryPairs() {
    const candidates = [];
    for (let i = 0; i < state.bodies.length; i++) {
      for (let j = i + 1; j < state.bodies.length; j++) {
        const a = state.bodies[i];
        const b = state.bodies[j];
        const ratio = Math.min(a.mass, b.mass) / Math.max(a.mass, b.mass);
        if (ratio < BINARY_MASS_RATIO) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= a.collisionRadius + b.collisionRadius) continue;
        const dvx = b.vx - a.vx;
        const dvy = b.vy - a.vy;
        const energy = (dvx * dvx + dvy * dvy) / 2 - G * pairGravityMass(a, b) / Math.max(distance, 1e-12);
        if (energy >= 0) continue;
        const explicit = a.binaryPartnerId === b.id && b.binaryPartnerId === a.id;
        candidates.push({ a, b, distance, score: explicit ? -1e9 : energy / Math.max(distance, 1e-12) });
      }
    }
    candidates.sort((first, second) => first.score - second.score);
    const used = new Set();
    return candidates.filter((pair) => {
      if (used.has(pair.a.id) || used.has(pair.b.id)) return false;
      used.add(pair.a.id); used.add(pair.b.id); return true;
    });
  }

  function binaryClassification(pair) {
    const bothStars = pair.a.texture === "sun" && pair.b.texture === "sun";
    const bothMoons = pair.a.isMoon && pair.b.isMoon;
    return bothStars ? "Binary star system" : bothMoons ? "Binary moon system" : "Binary planet system";
  }

  function drawBinaryBarycenters() {
    for (const pair of binaryPairs()) {
      const totalMass = pair.a.mass + pair.b.mass;
      const x = (pair.a.x * pair.a.mass + pair.b.x * pair.b.mass) / totalMass;
      const y = (pair.a.y * pair.a.mass + pair.b.y * pair.b.mass) / totalMass;
      const point = worldToScreen(x, y);
      const aPoint = bodyDisplayPoint(pair.a);
      const bPoint = bodyDisplayPoint(pair.b);
      ctx.save();
      ctx.strokeStyle = "rgba(100,221,255,.42)";
      ctx.fillStyle = "#83e7ff";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(aPoint.x, aPoint.y); ctx.lineTo(bPoint.x, bPoint.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(point.x, point.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "700 8px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BARYCENTER", point.x, point.y - 14);
      ctx.restore();
    }
  }

  function drawRocheZones() {
    for (const primary of state.bodies) {
      const active = primary.id === state.selectedId || primary.id === state.hoveredId || state.bodies.some((body) => body.tidalPrimaryId === primary.id && body.tidalStress > 0);
      if (!active) continue;
      const referenceMass = 1 / EARTHS_PER_SUN;
      const roche = rocheLimit(primary, referenceMass, EARTH_RADIUS_AU);
      const point = bodyDisplayPoint(primary);
      const radius = Math.max(roche * state.camera.zoom, visualRadius(primary) * 3.4);
      ctx.save();
      ctx.strokeStyle = "rgba(255,103,129,.52)";
      ctx.fillStyle = "rgba(255,63,94,.045)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,151,169,.85)";
      ctx.font = "700 8px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ROCHE LIMIT", point.x, point.y - radius - 7);
      ctx.restore();
    }
  }

  
  function drawStellarAccretionStreams() {
    if (!state.showAccretionDisk) return;
    for (const blackHole of state.bodies) {
      if (!blackHole.isBlackHole && blackHole.texture !== "blackHole") continue;

      for (const body of state.bodies) {
        if (body.eatingBlackHoleId !== blackHole.id) continue;

        const bhPoint = worldToScreen(blackHole.x, blackHole.y);
        const starPoint = worldToScreen(body.x, body.y);
        const starRadius = visualRadius(body);

        const dx = starPoint.x - bhPoint.x;
        const dy = starPoint.y - bhPoint.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) continue;

        const midAngle = Math.atan2(dy, dx) - 0.45;
        const ctrlX = bhPoint.x + Math.cos(midAngle) * (dist * 0.6);
        const ctrlY = bhPoint.y + Math.sin(midAngle) * (dist * 0.6);

        ctx.save();
        const streamGrad = ctx.createLinearGradient(starPoint.x, starPoint.y, bhPoint.x, bhPoint.y);
        streamGrad.addColorStop(0, rgbaColor(body.color, 0.95));
        streamGrad.addColorStop(0.4, "rgba(56, 189, 248, 0.88)");
        streamGrad.addColorStop(0.8, "rgba(99, 102, 241, 0.75)");
        streamGrad.addColorStop(1, "rgba(255, 255, 255, 0.95)");

        ctx.strokeStyle = streamGrad;
        ctx.lineWidth = Math.max(3, starRadius * 0.6);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(starPoint.x, starPoint.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, bhPoint.x, bhPoint.y);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, starRadius * 0.2);
        ctx.beginPath();
        ctx.moveTo(starPoint.x, starPoint.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, bhPoint.x, bhPoint.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawTrails() {
    if (!state.showTrails) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const body of state.bodies) {
      if (body.trail.length < 2) continue;
      const points = body.trail.map((pt) => worldToScreen(pt.x, pt.y));
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
      } else {
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      }
      ctx.globalAlpha = .48;
      ctx.strokeStyle = body.color;
      ctx.lineWidth = 1.35;
      ctx.stroke();
    }
    ctx.restore();
  }

function drawMagnetosphere(body, radius) {
    const isSelected = state.selectedId === body.id || state.hoveredId === body.id;
    if (!isSelected) return;
    const strength = Math.max(0, body.magneticScale ?? 1);
    if (strength <= 0.05) return; // Completely invisible for bodies with no magnetic field (like Mercury)

    const time = performance.now() * 0.0025;
    const reach = radius * (1.8 + Math.sqrt(strength) * 2.2);
    const opacity = clamp(0.45 + Math.log10(strength + 1) * 0.35, 0.4, 0.95);

    // Find nearest star to orient the day-side bow shock and night-side magnetotail
    const star = state.bodies.find(b => (b.texture === "sun" || b.scienceType === "star") && b.id !== body.id) || state.bodies[0];
    let starAngle = 0;
    if (star && star.id !== body.id) {
      starAngle = Math.atan2(star.y - body.y, star.x - body.x);
    }

    ctx.save();
    ctx.rotate(starAngle);

    // 1. Day-side Compressed Bow Shock Arc with shimmering cyan/white wave
    const bowGrad = ctx.createLinearGradient(0, -reach * 0.8, 0, reach * 0.8);
    bowGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
    bowGrad.addColorStop(0.3, `rgba(56, 189, 248, ${opacity * 0.85})`);
    bowGrad.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.98})`);
    bowGrad.addColorStop(0.7, `rgba(56, 189, 248, ${opacity * 0.85})`);
    bowGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

    ctx.strokeStyle = bowGrad;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, reach * 0.78, -Math.PI * 0.46, Math.PI * 0.46);
    ctx.stroke();

    // 2. Night-side Extended Streaming Magnetotail
    ctx.strokeStyle = `rgba(168, 85, 247, ${opacity * 0.7})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, reach * 0.78);
    ctx.quadraticCurveTo(-reach * 1.6, reach * 0.55, -reach * 2.8, reach * 0.25);
    ctx.moveTo(0, -reach * 0.78);
    ctx.quadraticCurveTo(-reach * 1.6, -reach * 0.55, -reach * 2.8, -reach * 0.25);
    ctx.stroke();

    // 3. Shimmering Multi-Color Dipole Aurora Field Loops
    ctx.save();
    ctx.rotate(Math.PI * 0.5); // align loops along planetary magnetic poles
    const numLoops = 4;
    for (let index = 0; index < numLoops; index++) {
      const loopScale = 0.52 + index * 0.22;
      const wavePulse = Math.sin(time * 3 + index * 1.4) * 0.5 + 0.5;
      
      // Dynamic auroral color shifting: Emerald Green -> Violet -> Electric Cyan
      const r = Math.round(74 + wavePulse * 90);
      const g = Math.round(222 - wavePulse * 60);
      const b = Math.round(128 + wavePulse * 120);
      const loopColor = `rgba(${r}, ${g}, ${b}, ${opacity * (0.85 - index * 0.14)})`;

      ctx.strokeStyle = loopColor;
      ctx.lineWidth = Math.max(1.0, 2.0 - index * 0.3);
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -time * 35 * (index % 2 === 0 ? 1 : -1);

      ctx.beginPath();
      ctx.ellipse(0, 0, reach * loopScale, reach * loopScale * 0.52, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Glowing Polar Auroral Cusps & Magnetopause Radiance
    const auraGrad = ctx.createRadialGradient(0, 0, radius, 0, 0, reach);
    auraGrad.addColorStop(0, `rgba(74, 222, 128, ${opacity * 0.35})`);
    auraGrad.addColorStop(0.45, `rgba(168, 85, 247, ${opacity * 0.22})`);
    auraGrad.addColorStop(0.8, `rgba(56, 189, 248, ${opacity * 0.12})`);
    auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, reach, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  
  function drawGargantuaBlackHole(body, radius) {
    if (!state.showAccretionDisk) {
      ctx.fillStyle = "#000000";
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2); ctx.stroke();
      return;
    }

    const feedingStar = state.bodies.find(b => b.eatingBlackHoleId === body.id) || 
                        state.bodies.find(b => (b.texture === "sun" || b.scienceType === "star" || b.scienceType === "blueStar") && Math.hypot(b.x - body.x, b.y - body.y) < 18);
    
    const isBlueFeed = feedingStar && (feedingStar.scienceType === "blueStar" || feedingStar.color === "#60a5fa" || feedingStar.color === "#87bdff" || feedingStar.name.includes("Blue"));

    const diskScale = body.accretionScale || 2.4;
    const innerRadius = radius * 1.15;
    const outerRadius = radius * (2.4 + diskScale * 0.65);

    // 1. Dual Relativistic Polar Plasma Jets (Blandford-Znajek Relativistic Beams)
    const jetLength = radius * (4.5 + diskScale * 1.2);
    const jetWidth = radius * 0.28;
    ctx.save();
    for (const sign of [-1, 1]) {
      const jetGrad = ctx.createLinearGradient(0, 0, 0, sign * jetLength);
      jetGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      jetGrad.addColorStop(0.2, isBlueFeed ? "rgba(56, 189, 248, 0.9)" : "rgba(251, 146, 60, 0.9)");
      jetGrad.addColorStop(0.6, "rgba(168, 85, 247, 0.65)");
      jetGrad.addColorStop(1, "rgba(147, 51, 234, 0)");

      ctx.fillStyle = jetGrad;
      ctx.beginPath();
      ctx.moveTo(-jetWidth * 0.5, 0);
      ctx.lineTo(jetWidth * 0.5, 0);
      ctx.lineTo(jetWidth * 1.8, sign * jetLength);
      ctx.lineTo(-jetWidth * 1.8, sign * jetLength);
      ctx.closePath();
      ctx.fill();

      // Relativistic jet shock knots
      for (let k = 1; k <= 3; k++) {
        const knotY = sign * (jetLength * (0.25 * k));
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(0, knotY, jetWidth * (0.6 + k * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 2. Einstein Gravitational Lensing Halo (Warped Spacetime Corona)
    ctx.save();
    const diffuseHalo = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius * 1.35);
    if (isBlueFeed) {
      diffuseHalo.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      diffuseHalo.addColorStop(0.18, "rgba(186, 230, 253, 0.9)");
      diffuseHalo.addColorStop(0.48, "rgba(56, 189, 248, 0.6)");
      diffuseHalo.addColorStop(0.78, "rgba(99, 102, 241, 0.25)");
      diffuseHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else {
      diffuseHalo.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      diffuseHalo.addColorStop(0.18, "rgba(251, 191, 36, 0.9)");
      diffuseHalo.addColorStop(0.48, "rgba(234, 88, 12, 0.6)");
      diffuseHalo.addColorStop(0.78, "rgba(168, 85, 247, 0.25)");
      diffuseHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
    }
    ctx.fillStyle = diffuseHalo;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Multi-Band Swirling Gas Accretion Disk (360° Circular Keplerian Ring)
    ctx.save();
    const diskGrad = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
    if (isBlueFeed) {
      diskGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      diskGrad.addColorStop(0.18, "rgba(224, 242, 254, 0.95)");
      diskGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.85)");
      diskGrad.addColorStop(0.82, "rgba(99, 102, 241, 0.48)");
      diskGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else {
      diskGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      diskGrad.addColorStop(0.18, "rgba(254, 215, 170, 0.95)");
      diskGrad.addColorStop(0.5, "rgba(249, 115, 22, 0.85)");
      diskGrad.addColorStop(0.82, "rgba(168, 85, 247, 0.48)");
      diskGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    }
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.arc(0, 0, innerRadius, Math.PI * 2, 0, true);
    ctx.closePath();
    ctx.fill();

    // Swirling Keplerian Filament Rings
    for (let rK = 1; rK <= 3; rK++) {
      const ringR = innerRadius + (outerRadius - innerRadius) * (rK / 4);
      ctx.strokeStyle = isBlueFeed ? "rgba(255, 255, 255, 0.4)" : "rgba(254, 240, 138, 0.4)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Central Event Horizon (Pure Black Singularity Void)
    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

    // 5. White-Hot Photon Sphere Halo (1.5 Rs)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
    ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2); ctx.stroke();
  }

  function drawBody(body) {
    const p = bodyDisplayPoint(body);
    const radius = visualRadius(body);
    if (p.x < -radius * 4 || p.x > state.viewport.width + radius * 4 || p.y < -radius * 4 || p.y > state.viewport.height + radius * 4) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    if ((body.tidalStress ?? 0) > 0) {
      const primary = state.bodies.find((candidate) => candidate.id === body.tidalPrimaryId);
      if (primary) ctx.rotate(Math.atan2(primary.y - body.y, primary.x - body.x));
      ctx.scale(1 + body.tidalStress * .95, Math.max(.48, 1 - body.tidalStress * .42));
    }
    drawMagnetosphere(body, radius);

    if (body.isBlackHole || body.texture === "blackHole") {
      drawGargantuaBlackHole(body, radius);
      ctx.restore();
      return;
    }

    
    if (body.scienceType === "blueStar" || (body.name.includes("Blue") && (body.texture === "sun" || body.scienceType === "star" || body.texture === "blueStar"))) {
      const coreGrad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.25, radius * 0.05, 0, 0, radius * 1.05);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.2, "#e0f2fe");
      coreGrad.addColorStop(0.5, "#60a5fa");
      coreGrad.addColorStop(0.85, "#2563eb");
      coreGrad.addColorStop(1, "#1e3a8a");
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

      const corona = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 3.5);
      corona.addColorStop(0, "rgba(96, 165, 250, 0.75)");
      corona.addColorStop(0.3, "rgba(56, 189, 248, 0.4)");
      corona.addColorStop(0.7, "rgba(37, 99, 235, 0.15)");
      corona.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = corona;
      ctx.beginPath(); ctx.arc(0, 0, radius * 3.5, 0, Math.PI * 2); ctx.fill();

      drawSolarProminences(body, radius);
      ctx.restore();
      if (state.showVelocity) drawVelocity(body, p);
      return;
    }

    if (body.texture === "sun" || body.scienceType === "star") {
      const glow = ctx.createRadialGradient(0, 0, radius * .3, 0, 0, radius * 3.2);
      glow.addColorStop(0, rgbaColor(body.color, 0.55));
      glow.addColorStop(.25, rgbaColor(body.color, 0.24));
      glow.addColorStop(1, rgbaColor(body.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, radius * 3.2, 0, Math.PI * 2); ctx.fill();
      drawSolarProminences(body, radius);
    }
    if (body.ring) drawRing(body, radius, true);
    const sphere = ctx.createRadialGradient(-radius * .33, -radius * .38, radius * .06, 0, 0, radius * 1.05);
    sphere.addColorStop(0, lighten(body.color, .42));
    sphere.addColorStop(.42, body.color);
    sphere.addColorStop(1, darken(body.color, .72));
    ctx.fillStyle = sphere;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip();
    const hasCustomBands = body.bandCount && body.bandCount > 0;
    const hasCustomWater = body.waterCoverage !== undefined && body.waterCoverage > 0 && body.texture !== "earth";
    if (hasCustomBands || hasCustomWater || !drawNasaTexture(body, radius)) {
      drawTexture(body, radius);
    }

    // Render Scorched Orangey-Grayish Crust Shader when bombarded by solar flares
    if (body.scorchLevel && body.scorchLevel > 0) {
      const scorchGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius * 1.02);
      scorchGrad.addColorStop(0, "rgba(251, 146, 60, 0.65)"); // orangey heat core
      scorchGrad.addColorStop(0.4, "rgba(194, 65, 12, 0.72)");  // burnt orange-brown
      scorchGrad.addColorStop(0.75, "rgba(75, 45, 30, 0.78)"); // dark scorched silicate crust
      scorchGrad.addColorStop(1, "rgba(35, 25, 20, 0.85)");    // dark rim

      ctx.fillStyle = scorchGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Scorched impact fractures and glowing thermal fissures
      ctx.strokeStyle = "rgba(254, 215, 170, 0.45)";
      ctx.lineWidth = Math.max(0.7, radius * 0.025);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const ang = (body.id || 1) * 1.5 + k * 1.6;
        const fx = Math.cos(ang) * radius * 0.55;
        const fy = Math.sin(ang) * radius * 0.55;
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(ang + 0.8) * radius * 0.35, fy + Math.sin(ang + 0.8) * radius * 0.35);
      }
      ctx.stroke();
    }

    // Render dynamic Thermal Heating, Molten Magma, & Radium Glow on overheated planets
    if (body.temperatureKelvin && body.temperatureKelvin > 550 && body.texture !== "sun" && body.texture !== "blackHole") {
      const heatFactor = clamp((body.temperatureKelvin - 550) / 1800, 0, 1.0);
      const heatGrad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.25, radius * 0.1, 0, 0, radius * 1.02);
      if (body.temperatureKelvin > 2000) {
        // Super-Hot Incandescent Plasma World
        heatGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        heatGrad.addColorStop(0.3, "rgba(254, 240, 138, 0.85)");
        heatGrad.addColorStop(0.7, "rgba(249, 115, 22, 0.75)");
        heatGrad.addColorStop(1, "rgba(220, 38, 38, 0.9)");
      } else if (body.temperatureKelvin > 1100) {
        // Molten Lava World
        heatGrad.addColorStop(0, "rgba(254, 215, 170, 0.85)");
        heatGrad.addColorStop(0.4, "rgba(249, 115, 22, 0.75)");
        heatGrad.addColorStop(0.8, "rgba(185, 28, 28, 0.8)");
        heatGrad.addColorStop(1, "rgba(69, 10, 10, 0.85)");
      } else {
        // Scorched Desert / Thermal Stress
        heatGrad.addColorStop(0, "rgba(251, 146, 60, 0.45)");
        heatGrad.addColorStop(0.6, "rgba(194, 65, 12, 0.35)");
        heatGrad.addColorStop(1, "rgba(124, 45, 18, 0.5)");
      }
      ctx.fillStyle = heatGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    drawAtmosphereAndAurora(body, radius);
    if (body.ring) drawRing(body, radius, false);
    // Crisp black limb silhouette outline
    ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
    ctx.lineWidth = Math.max(0.8, radius * 0.035);
    ctx.beginPath(); ctx.arc(0, 0, radius - 0.2, 0, Math.PI * 2); ctx.stroke();
    drawStarDiffractionSpikes(body, radius, p);
    if (state.selectedId === body.id) {
      ctx.strokeStyle = "rgba(115,183,255,.88)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, radius + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    if (state.showVelocity) drawVelocity(body, p);
  }

  function drawNasaTexture(body, radius) {
    const settings = nasaTextureSettings[body.texture];
    const image = nasaTextures[body.texture];
    if (!settings || !image?.complete || image.naturalWidth === 0 || radius < 5) return false;
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight) * settings.crop;
    const sourceX = clamp(image.naturalWidth * settings.cx - cropSize / 2, 0, image.naturalWidth - cropSize);
    const sourceY = clamp(image.naturalHeight * settings.cy - cropSize / 2, 0, image.naturalHeight - cropSize);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sourceX, sourceY, cropSize, cropSize, -radius, -radius, radius * 2, radius * 2);
    const editedColor = normalizeHex(body.color) !== normalizeHex(body.naturalColor || body.color);
    if (body.texture === "sun" || editedColor) {
      ctx.save();
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = body.texture === "sun" ? .32 : .42;
      ctx.fillStyle = body.color;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
    const limb = ctx.createRadialGradient(-radius * .3, -radius * .34, radius * .08, 0, 0, radius * 1.03);
    limb.addColorStop(0, "rgba(255,255,255,.09)");
    limb.addColorStop(.55, "rgba(0,0,0,0)");
    limb.addColorStop(1, "rgba(0,2,8,.48)");
    ctx.fillStyle = limb;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    return true;
  }

  function drawTexture(body, radius) {
    // 1. Procedural Atmospheric Bands (Universe Sandbox 2 style multi-band gas giants & banded worlds)
    if (body.bandCount && body.bandCount > 0) {
      const count = Math.max(1, body.bandCount);
      const palette = body.bandColors && body.bandColors.length ? body.bandColors : ["#6b21a8", "#9333ea", "#c084fc", "#3b82f6"];
      const turb = (body.bandTurbulence ?? 50) / 100;
      const bandHeight = (radius * 2) / count;
      const time = performance.now() * 0.001;

      for (let i = 0; i < count; i++) {
        const y = -radius + i * bandHeight;
        const color = palette[i % palette.length];
        const nextColor = palette[(i + 1) % palette.length];
        
        ctx.save();
        const normY = (y + bandHeight * 0.5) / radius;
        const waveOffset = Math.sin(normY * Math.PI * 3 + (body.id || 1) + time * 0.2) * (radius * 0.06 * turb);
        
        const bandGrad = ctx.createLinearGradient(0, y + waveOffset, 0, y + bandHeight + waveOffset);
        bandGrad.addColorStop(0, color);
        bandGrad.addColorStop(0.5, color);
        bandGrad.addColorStop(1, nextColor || color);
        ctx.fillStyle = bandGrad;

        ctx.beginPath();
        ctx.rect(-radius, y + waveOffset, radius * 2, bandHeight * 1.05);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = Math.max(0.6, radius * 0.018);
        ctx.beginPath();
        ctx.moveTo(-radius, y + waveOffset);
        ctx.bezierCurveTo(-radius * 0.3, y + waveOffset + radius * 0.02 * turb, radius * 0.3, y + waveOffset - radius * 0.02 * turb, radius, y + waveOffset);
        ctx.stroke();
        ctx.restore();
      }

      if (body.showGreatStorm) {
        ctx.save();
        const stormX = radius * 0.34;
        const stormY = radius * 0.28;
        const stormRx = radius * 0.25;
        const stormRy = radius * 0.125;

        const stormGrad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, stormRx);
        const stormCol = body.stormColor || "#f43f5e";
        stormGrad.addColorStop(0, stormCol);
        stormGrad.addColorStop(0.7, rgbaColor(stormCol, 0.85));
        stormGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = stormGrad;
        ctx.beginPath();
        ctx.ellipse(stormX, stormY, stormRx, stormRy, -0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = Math.max(0.8, radius * 0.024);
        ctx.beginPath();
        ctx.ellipse(stormX, stormY, stormRx * 0.55, stormRy * 0.55, -0.08, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const limb = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.08, 0, 0, radius * 1.03);
      limb.addColorStop(0, "rgba(255, 255, 255, 0.14)");
      limb.addColorStop(0.55, "rgba(0, 0, 0, 0)");
      limb.addColorStop(1, "rgba(2, 6, 16, 0.72)");
      ctx.fillStyle = limb;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      return;
    }

    // 2. Procedural Surface Water, Continents & Polar Ice Caps
    if (body.waterCoverage !== undefined && body.waterCoverage > 0) {
      ctx.fillStyle = body.landColor || "#15803d";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      const waterRatio = clamp(body.waterCoverage / 100, 0, 1);
      if (waterRatio > 0.03) {
        ctx.fillStyle = body.oceanColor || "#1d4ed8";
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const angle = (body.id || 1) * 1.8 + k * 1.4;
          const oceanRadius = radius * (0.32 + waterRatio * 0.75);
          const cx = Math.cos(angle) * (radius * (1 - waterRatio * 0.45));
          const cy = Math.sin(angle) * (radius * (1 - waterRatio * 0.45));
          ctx.arc(cx, cy, oceanRadius, 0, Math.PI * 2);
        }
        ctx.fill();

        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = Math.max(1, radius * 0.035);
        ctx.stroke();
      }

      if (body.iceCapCoverage && body.iceCapCoverage > 0) {
        const iceH = radius * (body.iceCapCoverage / 100) * 0.45;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(0, -radius + iceH * 0.5, radius * 0.65, iceH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, radius - iceH * 0.5, radius * 0.65, iceH, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const limb = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.08, 0, 0, radius * 1.03);
      limb.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      limb.addColorStop(0.55, "rgba(0, 0, 0, 0)");
      limb.addColorStop(1, "rgba(2, 6, 16, 0.68)");
      ctx.fillStyle = limb;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      return;
    }

    if (body.texture === "earth") {
      ctx.fillStyle = "rgba(25,120,60,.7)";
      ctx.beginPath();
      ctx.arc(-radius * .2, radius * .1, radius * .7, 3.7, 5.35);
      ctx.arc(radius * .2, -radius * .1, radius * .65, .25, 1.7);
      ctx.stroke();
    } else if (body.texture === "jupiter" || body.texture === "saturn") {
      const colors = body.texture === "jupiter"
        ? ["#f4dfc3aa", "#8f533fa0", "#dfaa7590", "#fff0d0a0", "#a9664a92", "#e8c79e9c"]
        : ["#f3d89788", "#a78b5680", "#e8c77d76", "#866b436a", "#f6e3ab78"];
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        const bandHeight = radius * (i % 2 ? .13 : .09);
        const y = -radius * .72 + i * radius * .29;
        ctx.fillRect(-radius, y, radius * 2, bandHeight);
      });
      if (body.texture === "jupiter") {
        ctx.fillStyle = "#a8433299"; ctx.beginPath(); ctx.ellipse(radius * .35, radius * .28, radius * .22, radius * .105, -.08, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,208,174,.35)"; ctx.lineWidth = Math.max(1, radius * .035);
        ctx.stroke();
      }
    } else if (body.texture === "venus") {
      ctx.strokeStyle = "rgba(255,234,178,.48)"; ctx.lineWidth = Math.max(1.5, radius * .11);
      ctx.beginPath(); ctx.arc(-radius * .18, radius * .08, radius * .78, 3.45, 5.75); ctx.stroke();
      ctx.strokeStyle = "rgba(164,104,54,.3)"; ctx.lineWidth = Math.max(1, radius * .07);
      ctx.beginPath(); ctx.arc(radius * .14, -radius * .2, radius * .68, .15, 2.45); ctx.stroke();
    } else if (body.texture === "mercury") {
      ctx.fillStyle = "rgba(42,39,36,.38)";
      for (let i = 0; i < 7; i++) {
        const angle = body.id * 1.31 + i * 2.19;
        const craterRadius = radius * (.055 + (i % 3) * .028);
        const x = Math.cos(angle) * radius * (.18 + (i % 4) * .14);
        const y = Math.sin(angle) * radius * (.22 + (i % 3) * .16);
        ctx.beginPath(); ctx.arc(x, y, craterRadius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(230,223,210,.2)"; ctx.lineWidth = Math.max(.6, radius * .018); ctx.stroke();
      }
    } else if (body.texture === "mars") {
      ctx.fillStyle = "rgba(73,31,23,.52)";
      ctx.beginPath();
      ctx.ellipse(-radius * .2, -radius * .08, radius * .43, radius * .19, -.35, 0, Math.PI * 2);
      ctx.ellipse(radius * .4, radius * .25, radius * .22, radius * .13, .35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(72,25,21,.68)"; ctx.lineWidth = Math.max(1, radius * .055);
      ctx.beginPath(); ctx.arc(0, radius * .04, radius * .68, .15, 1.4); ctx.stroke();
      ctx.fillStyle = "rgba(246,225,197,.65)";
      ctx.beginPath(); ctx.ellipse(0, -radius * .88, radius * .29, radius * .09, 0, 0, Math.PI * 2); ctx.fill();
    } else if (body.texture === "rock") {
      ctx.fillStyle = "rgba(45,29,24,.3)";
      for (let i = 0; i < 5; i++) {
        const angle = body.id * 2.1 + i * 1.7;
        ctx.beginPath(); ctx.arc(Math.cos(angle) * radius * .48, Math.sin(angle) * radius * .48, radius * (.07 + i * .015), 0, Math.PI * 2); ctx.fill();
      }
    } else if (body.texture === "uranus") {
      ctx.strokeStyle = "rgba(224,255,255,.24)"; ctx.lineWidth = Math.max(1, radius * .065);
      ctx.beginPath(); ctx.ellipse(0, radius * .13, radius, radius * .22, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (body.texture === "neptune") {
      ctx.fillStyle = "rgba(25,47,124,.36)";
      ctx.fillRect(-radius, -radius * .12, radius * 2, radius * .18);
      ctx.fillStyle = "rgba(10,28,82,.58)";
      ctx.beginPath(); ctx.ellipse(radius * .3, radius * .22, radius * .22, radius * .1, -.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(195,224,255,.33)"; ctx.lineWidth = Math.max(1, radius * .045);
      ctx.beginPath(); ctx.arc(-radius * .1, -radius * .12, radius * .75, .3, 2.4); ctx.stroke();
    } else if (body.texture === "ice") {
      ctx.strokeStyle = "rgba(226,249,255,.22)"; ctx.lineWidth = Math.max(1, radius * .08);
      ctx.beginPath(); ctx.ellipse(0, radius * .12, radius, radius * .25, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (body.texture === "sun") {
      ctx.globalAlpha = .25; ctx.fillStyle = "#fff3a3";
      for (let i = 0; i < 8; i++) {
        const angle = i * 2.399 + body.id;
        ctx.beginPath(); ctx.arc(Math.cos(angle) * radius * .55, Math.sin(angle) * radius * .55, radius * .1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawLabels() {
    if (!state.showLabels) return;
    const boxes = [];
    ctx.font = "500 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const body of [...state.bodies].sort((a, b) => b.mass - a.mass)) {
      const parent = body.parentId ? state.bodies.find((candidate) => candidate.id === body.parentId) : null;
      if (body.isMoon && parent !== selectedBody() && parent?.id !== state.hoveredId && body.id !== state.selectedId && body.id !== state.hoveredId && (!body.orbit || body.orbit.a * state.camera.zoom < 20)) continue;
      const p = bodyDisplayPoint(body);
      const radius = visualRadius(body);
      if (p.x < -40 || p.x > state.viewport.width + 40 || p.y < -40 || p.y > state.viewport.height + 40) continue;
      const width = Math.max(28, ctx.measureText(body.name).width + 10);
      let y = p.y + radius + 14;
      let box = { left: p.x - width / 2, right: p.x + width / 2, top: y - 7, bottom: y + 7 };
      let attempts = 0;
      while (boxes.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top) && attempts < 8) {
        y += 14;
        box = { ...box, top: y - 7, bottom: y + 7 };
        attempts += 1;
      }
      if (y > state.viewport.height - 18) y = p.y - radius - 14;
      if (attempts > 0) {
        ctx.strokeStyle = "rgba(126,164,218,.22)";
        ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(p.x, p.y + radius + 3); ctx.lineTo(p.x, y - 7); ctx.stroke();
      }
      ctx.fillStyle = state.selectedId === body.id ? "#b9d8ff" : "rgba(205,222,248,.78)";
      ctx.fillText(body.name, p.x, y);
      boxes.push({ left: p.x - width / 2, right: p.x + width / 2, top: y - 7, bottom: y + 7 });
    }
  }

  function drawSolarProminences(star, radius) {
    if (!state.solarFlaresEnabled || !star.prominences || star.prominences.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const time = performance.now() * 0.002;

    for (const prom of star.prominences) {
      const alpha = Math.sin((prom.life / prom.maxLife) * Math.PI);
      const a1 = prom.baseAngle;
      const a2 = prom.baseAngle + prom.span;
      const midAngle = (a1 + a2) / 2;

      const p1x = Math.cos(a1) * radius;
      const p1y = Math.sin(a1) * radius;
      const p2x = Math.cos(a2) * radius;
      const p2y = Math.sin(a2) * radius;

      const h = radius * prom.height + Math.sin(time * prom.pulseSpeed) * 3;
      const cpx = Math.cos(midAngle) * h * 1.3;
      const cpy = Math.sin(midAngle) * h * 1.3;

      ctx.strokeStyle = `rgba(255, 135, 35, ${alpha * 0.75})`;
      ctx.lineWidth = Math.max(1.8, radius * 0.08);
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.quadraticCurveTo(cpx, cpy, p2x, p2y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 245, 190, ${alpha * 0.95})`;
      ctx.lineWidth = Math.max(0.8, radius * 0.035);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStarDiffractionSpikes(star, radius, p) {
    if (!state.lensFlaresEnabled) return;
    const isStar = star.texture === "sun" || star.scienceType === "star" || star.mass * EARTHS_PER_SUN > 10000;
    if (!isStar) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const spikeLength = Math.max(35, radius * 3.6);
    const color = star.color || "#ffb13b";

    const hGrad = ctx.createLinearGradient(-spikeLength * 2.2, 0, spikeLength * 2.2, 0);
    hGrad.addColorStop(0, "rgba(80, 160, 255, 0)");
    hGrad.addColorStop(0.35, rgbaColor(color, 0.35));
    hGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.92)");
    hGrad.addColorStop(0.65, rgbaColor(color, 0.35));
    hGrad.addColorStop(1, "rgba(80, 160, 255, 0)");

    ctx.strokeStyle = hGrad;
    ctx.lineWidth = Math.max(1.2, radius * 0.07);
    ctx.beginPath();
    ctx.moveTo(-spikeLength * 2.2, 0);
    ctx.lineTo(spikeLength * 2.2, 0);
    ctx.stroke();

    const angles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    for (let i = 0; i < angles.length; i++) {
      const ang = angles[i];
      const len = i < 2 ? spikeLength * 1.3 : spikeLength * 0.65;
      const width = i < 2 ? 1.4 : 0.75;

      const grad = ctx.createLinearGradient(-Math.cos(ang) * len, -Math.sin(ang) * len, Math.cos(ang) * len, Math.sin(ang) * len);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(ang) * len, -Math.sin(ang) * len);
      ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAtmosphereAndAurora(body, radius) {
    if (body.customAtmosphere && body.gasType && body.gasType !== "none" && radius >= 5) {
      const atmoColor = body.atmoColor || "#60a5fa";
      const haze = (body.atmoHaze ?? 60) / 100;
      const pressure = body.atmoPressure ?? 1.0;
      const atmoThickness = Math.max(1.2, radius * (0.05 + Math.min(0.25, pressure * 0.02)));

      ctx.save();
      ctx.strokeStyle = atmoColor;
      ctx.lineWidth = atmoThickness;
      ctx.shadowColor = atmoColor;
      ctx.shadowBlur = Math.max(2, radius * 0.2 * haze);
      ctx.globalAlpha = clamp(0.3 + haze * 0.6, 0.2, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, radius + atmoThickness * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (body.auroraExcitement > 0) {
      body.auroraExcitement = Math.max(0, body.auroraExcitement - 0.008);
      const excitement = body.auroraExcitement;
      if (excitement > 0.01 && (body.magneticScale ?? 1) > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const time = performance.now() * 0.003;
        const wave = Math.sin(time * 3 + (body.id || 1)) * 0.5 + 0.5;

        // North Polar Aurora Oval
        const northGlow = ctx.createRadialGradient(0, -radius * 0.85, 0, 0, -radius * 0.85, radius * 0.65);
        northGlow.addColorStop(0, `rgba(74, 222, 128, ${excitement * (0.75 + wave * 0.2)})`);
        northGlow.addColorStop(0.45, `rgba(56, 189, 248, ${excitement * 0.6})`);
        northGlow.addColorStop(0.75, `rgba(168, 85, 247, ${excitement * 0.45})`);
        northGlow.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = northGlow;
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.88, radius * 0.55, radius * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // North Auroral Curtain Ring
        ctx.strokeStyle = `rgba(125, 255, 175, ${excitement * 0.85})`;
        ctx.lineWidth = Math.max(0.8, radius * 0.04);
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.88, radius * 0.48, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();

        // South Polar Aurora Oval
        const southGlow = ctx.createRadialGradient(0, radius * 0.85, 0, 0, radius * 0.85, radius * 0.65);
        southGlow.addColorStop(0, `rgba(74, 222, 128, ${excitement * (0.75 + wave * 0.2)})`);
        southGlow.addColorStop(0.45, `rgba(56, 189, 248, ${excitement * 0.6})`);
        southGlow.addColorStop(0.75, `rgba(168, 85, 247, ${excitement * 0.45})`);
        southGlow.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = southGlow;
        ctx.beginPath();
        ctx.ellipse(0, radius * 0.88, radius * 0.55, radius * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // South Auroral Curtain Ring
        ctx.strokeStyle = `rgba(168, 85, 247, ${excitement * 0.85})`;
        ctx.lineWidth = Math.max(0.8, radius * 0.04);
        ctx.beginPath();
        ctx.ellipse(0, radius * 0.88, radius * 0.48, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  function drawCMEParticles() {
    if (!state.solarFlaresEnabled || !state.cmeParticles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const p of state.cmeParticles) {
      const screenPos = worldToScreen(p.x, p.y);
      if (screenPos.x < -20 || screenPos.x > state.viewport.width + 20 || screenPos.y < -20 || screenPos.y > state.viewport.height + 20) continue;

      const alpha = clamp(p.life / p.maxLife, 0, 1);
      const grad = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, p.size * 3.5);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      grad.addColorStop(0.3, rgbaColor(p.color, 0.85));
      grad.addColorStop(0.7, rgbaColor(p.color, 0.35));
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha * 0.6})`;
      ctx.lineWidth = Math.max(1, p.size * 0.8);
      ctx.beginPath();
      ctx.moveTo(screenPos.x, screenPos.y);
      ctx.lineTo(screenPos.x - p.vx * 3.2, screenPos.y - p.vy * 3.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRing(body, radius, behind) {
    ctx.save();
    ctx.rotate(-.22);
    ctx.scale(1, .34);
    ctx.strokeStyle = behind ? "rgba(175,157,123,.42)" : "rgba(232,215,177,.7)";
    ctx.lineWidth = Math.max(2, radius * .18);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.7 * (body.ringScale ?? 1), behind ? Math.PI : 0, behind ? Math.PI * 2 : Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawVelocity(body, p) {
    const scale = 6;
    const ex = p.x + body.vx * scale;
    const ey = p.y + body.vy * scale;
    ctx.strokeStyle = `${body.color}aa`;
    ctx.fillStyle = body.color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
    const angle = Math.atan2(ey - p.y, ex - p.x);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(angle - .5) * 6, ey - Math.sin(angle - .5) * 6);
    ctx.lineTo(ex - Math.cos(angle + .5) * 6, ey - Math.sin(angle + .5) * 6);
    ctx.closePath(); ctx.fill();
  }

  function drawEffects() {
    for (const effect of state.effects) {
      const p = worldToScreen(effect.x, effect.y);
      const alpha = clamp(effect.life / effect.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = effect.kind === "gas" ? alpha * .38 : alpha;
      if (effect.kind === "shockwave") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = Math.max(1.5, 5 * alpha);
        ctx.beginPath(); ctx.arc(p.x, p.y, effect.radius * (1 - alpha * .25), 0, Math.PI * 2); ctx.stroke();
      
      } else if (effect.kind === "stream_particle") {
        const p = worldToScreen(effect.x, effect.y);
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, effect.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.kind === "flash") {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, effect.radius * (1.6 - alpha * .4));
        glow.addColorStop(0, "rgba(255,255,255,.98)");
        glow.addColorStop(.24, effect.color);
        glow.addColorStop(1, "rgba(255,130,55,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, effect.radius * 1.6, 0, Math.PI * 2); ctx.fill();
      } else if (effect.kind === "gas") {
        const gas = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, effect.size);
        gas.addColorStop(0, effect.color);
        gas.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gas;
        ctx.beginPath(); ctx.arc(p.x, p.y, effect.size, 0, Math.PI * 2); ctx.fill();
      } else if (effect.kind === "spark") {
        ctx.strokeStyle = lighten(effect.color, .55);
        ctx.lineWidth = Math.max(1, effect.size * .45);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - effect.vx * 28, p.y - effect.vy * 28); ctx.stroke();
      } else {
        ctx.translate(p.x, p.y); if (effect.rotation != null && !Number.isNaN(effect.rotation)) ctx.rotate(effect.rotation);
        ctx.fillStyle = effect.color;
        ctx.fillRect(-effect.size / 2, -effect.size / 3, effect.size, effect.size * .66);
      }
      ctx.restore();
    }
  }

  function drawLaunchPreview() {
    if (state.addMode && state.launchMode === "autoOrbit") {
      const mouseWorld = screenToWorld(state.pointer.x, state.pointer.y);
      const { spec } = currentSpawnSpec();
      const primary = findDominantGravityParent(mouseWorld.x, mouseWorld.y, spec.mass);
      const mouseScreen = { x: state.pointer.x, y: state.pointer.y };
      ctx.save();
      if (primary) {
        const primaryScreen = worldToScreen(primary.x, primary.y);
        const dist = Math.hypot(mouseWorld.x - primary.x, mouseWorld.y - primary.y);
        ctx.strokeStyle = "rgba(102, 198, 255, 0.75)";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(primaryScreen.x, primaryScreen.y, dist * state.camera.zoom, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(132, 191, 255, 0.4)";
        ctx.beginPath();
        ctx.moveTo(primaryScreen.x, primaryScreen.y);
        ctx.lineTo(mouseScreen.x, mouseScreen.y);
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(mouseScreen.x, mouseScreen.y, Math.max(6, spec.radius * state.camera.zoom * 0.5), 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "600 11px Inter, sans-serif";
        ctx.fillStyle = "rgba(194, 225, 255, 0.95)";
        ctx.textAlign = "left";
        ctx.fillText(`Auto-orbiting ${primary.name} (${formatDistance(dist)})`, mouseScreen.x + 14, mouseScreen.y - 8);
      } else {
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(mouseScreen.x, mouseScreen.y, Math.max(6, spec.radius * state.camera.zoom * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "600 11px Inter, sans-serif";
        ctx.fillStyle = "rgba(194, 225, 255, 0.95)";
        ctx.textAlign = "left";
        ctx.fillText("Spawn object in deep space", mouseScreen.x + 14, mouseScreen.y - 8);
      }
      ctx.restore();
      return;
    }
    if (state.orbitPlacement) {
      const target = state.bodies.find((body) => body.id === state.launchTargetId);
      if (!target) return;
      const eccentricity = Number(ui.eccentricity.value) / 100;
      const semiMajor = state.orbitDistance / Math.max(.05, 1 - eccentricity);
      const semiMinor = semiMajor * Math.sqrt(1 - eccentricity * eccentricity);
      const center = worldToScreen(
        target.x - Math.cos(state.orbitAngle) * semiMajor * eccentricity,
        target.y - Math.sin(state.orbitAngle) * semiMajor * eccentricity,
      );
      const start = worldToScreen(
        target.x + Math.cos(state.orbitAngle) * state.orbitDistance,
        target.y + Math.sin(state.orbitAngle) * state.orbitDistance,
      );
      const targetScreen = worldToScreen(target.x, target.y);
      const { spec } = currentSpawnSpec();
      const limits = orbitLimits(target, spec, eccentricity);
      ctx.save();
      ctx.strokeStyle = "rgba(92,220,183,.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.arc(targetScreen.x, targetScreen.y, limits.stableRadius * state.camera.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,102,111,.45)";
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.arc(targetScreen.x, targetScreen.y, limits.roche * state.camera.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(102,198,255,.9)";
      ctx.fillStyle = "#8fd4ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, semiMajor * state.camera.zoom, semiMinor * state.camera.zoom, state.orbitAngle, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(132,191,255,.35)";
      ctx.beginPath(); ctx.moveTo(targetScreen.x, targetScreen.y); ctx.lineTo(start.x, start.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(start.x, start.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.font = "600 10px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(194,225,255,.9)";
      ctx.fillText(`Periapsis ${formatDistance(state.orbitDistance)}`, start.x + 12, start.y - 8);
      const apoapsis = semiMajor * (1 + eccentricity);
      const far = worldToScreen(target.x - Math.cos(state.orbitAngle) * apoapsis, target.y - Math.sin(state.orbitAngle) * apoapsis);
      ctx.textAlign = "right";
      ctx.fillText(`Apoapsis ${formatDistance(apoapsis)}`, far.x - 10, far.y - 8);
      ctx.restore();
      return;
    }
    if (!state.addMode || !state.launchStart || !state.pointer.dragging) return;
    const start = worldToScreen(state.launchStart.x, state.launchStart.y);
    ctx.strokeStyle = "#8bc1ff";
    ctx.fillStyle = "#8bc1ff";
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(start.x, start.y, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(state.pointer.x, state.pointer.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(state.pointer.x, state.pointer.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawMoveGuide() {
    const body = state.bodies.find((candidate) => candidate.id === state.grabbedBodyId);
    if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

    const point = bodyDisplayPoint(body);
    const radius = visualRadius(body);
    const parent = body.parentId ? state.bodies.find((candidate) => candidate.id === body.parentId) : null;
    ctx.save();
    ctx.strokeStyle = "rgba(107,197,255,.9)";
    ctx.fillStyle = "rgba(181,225,255,.95)";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(point.x, point.y, radius + 13, 0, Math.PI * 2); ctx.stroke();
    if (parent && !state.grabbedGroupIds.includes(parent.id)) {
      const parentPoint = worldToScreen(parent.x, parent.y);
      ctx.strokeStyle = "rgba(113,169,237,.42)";
      ctx.beginPath(); ctx.moveTo(parentPoint.x, parentPoint.y); ctx.lineTo(point.x, point.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = "600 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VELOCITY PRESERVED", point.x, point.y - radius - 22);
    ctx.restore();
  }

  function drawEvolutionEffects() {
    if (state.preset !== "evolution") return;
    const sun = state.bodies.find((b) => b.texture === "sun" || b.name.includes("Sun"));
    if (!sun) return;
    const sunPos = worldToScreen(sun.x, sun.y);

    if (state.evolutionStage === 0) {
      ctx.save();
      for (let r = 1.2; r <= 28; r += 2.2) {
        const ringRadius = r * state.camera.zoom;
        const alpha = Math.max(0.01, 0.09 - r * 0.0028);
        ctx.strokeStyle = `rgba(125, 185, 255, ${alpha})`;
        ctx.lineWidth = Math.max(1, 14 * state.camera.zoom * 0.04);
        ctx.beginPath();
        ctx.arc(sunPos.x, sunPos.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (state.evolutionStage === 4) {
      ctx.save();
      const outerRadius = 38 * state.camera.zoom;
      const nebulaGlow = ctx.createRadialGradient(sunPos.x, sunPos.y, sun.radius * state.camera.zoom * 1.2, sunPos.x, sunPos.y, outerRadius);
      nebulaGlow.addColorStop(0, "rgba(255, 90, 45, 0.28)");
      nebulaGlow.addColorStop(0.25, "rgba(215, 65, 110, 0.2)");
      nebulaGlow.addColorStop(0.65, "rgba(75, 120, 235, 0.12)");
      nebulaGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebulaGlow;
      ctx.beginPath();
      ctx.arc(sunPos.x, sunPos.y, outerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function render() {
    try {
      drawBackground();
      drawGrid();
      drawEvolutionEffects();
      drawOrbitGuides();
      drawRocheZones();
      drawTrails();
      drawStellarAccretionStreams();
      [...state.bodies].sort((a, b) => a.mass - b.mass).forEach(drawBody);
      drawCMEParticles();
      drawBinaryBarycenters();
      drawMoveGuide();
      drawLabels();
      drawEffects();
      drawLaunchPreview();
    } catch (err) {
      console.error("Rendering error:", err);
    }
  }



  function frame(now) {
    const wallElapsed = Math.max(0, (now - state.lastFrame) / 1000);
    const elapsed = Math.min(.05, wallElapsed);
    state.lastFrame = now;
    state.fps += ((1 / Math.max(wallElapsed, .001)) - state.fps) * .06;
    updateSimulation(elapsed, wallElapsed);
    updateEffects(elapsed);
    updateSolarPhenomena(elapsed);
    const followedBody = state.bodies.find((body) => body.id === state.followBodyId);
    if (followedBody) {
      state.camera.x = followedBody.x;
      state.camera.y = followedBody.y;
    } else if (state.followBodyId != null) {
      state.followBodyId = null;
    }
    render();
    updateHUD();
    requestAnimationFrame(frame);
  }

  function bodyAt(screenX, screenY) {
    let found = null;
    let bestDistance = Infinity;
    for (const body of state.bodies) {
      const p = bodyDisplayPoint(body);
      const distance = Math.hypot(screenX - p.x, screenY - p.y);
      const hitRadius = Math.max(22, visualRadius(body) + 8);
      if (distance <= hitRadius && distance < bestDistance) { found = body; bestDistance = distance; }
    }
    return found;
  }

  function selectBody(body) {
    state.selectedId = body?.id ?? null;
    updateSelectionUI();
  }

  function selectedBody() {
    return state.bodies.find((body) => body.id === state.selectedId) || null;
  }

  function updateSelectionUI() {
    const body = selectedBody();
    ui.emptySelection.hidden = Boolean(body);
    ui.bodyEditor.hidden = !body;
    ui.selectionDot.style.background = body?.color || "#43516a";
    ui.selectionDot.style.color = body?.color || "#43516a";
    if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

    
    // Populate Planet Customizer Fields
    if (ui.bandCount) {
      ui.bandCount.value = body.bandCount ?? 0;
      ui.bandCountValue.value = body.bandCount ?? 0;
    }
    if (ui.bandPaletteSelect) ui.bandPaletteSelect.value = body.bandPalette || "custom";
    if (ui.bandColor1 && body.bandColors) ui.bandColor1.value = body.bandColors[0] || "#6b21a8";
    if (ui.bandColor2 && body.bandColors) ui.bandColor2.value = body.bandColors[1] || "#9333ea";
    if (ui.bandColor3 && body.bandColors) ui.bandColor3.value = body.bandColors[2] || "#c084fc";
    if (ui.stormColor) ui.stormColor.value = body.stormColor || "#f43f5e";
    if (ui.bandTurbulence) {
      ui.bandTurbulence.value = body.bandTurbulence ?? 50;
      ui.bandTurbulenceValue.value = `${body.bandTurbulence ?? 50}%`;
    }
    if (ui.showGreatStorm) ui.showGreatStorm.checked = Boolean(body.showGreatStorm);

    if (ui.waterCoverage) {
      ui.waterCoverage.value = body.waterCoverage ?? 0;
      ui.waterCoverageValue.value = `${body.waterCoverage ?? 0}%`;
    }
    if (ui.oceanColor) ui.oceanColor.value = body.oceanColor || "#1d4ed8";
    if (ui.landColor) ui.landColor.value = body.landColor || "#15803d";
    if (ui.iceCapCoverage) {
      ui.iceCapCoverage.value = body.iceCapCoverage ?? 0;
      ui.iceCapCoverageValue.value = `${body.iceCapCoverage ?? 0}%`;
    }

    if (ui.gasTypeSelect) ui.gasTypeSelect.value = body.gasType || "earthAir";
    if (ui.atmoPressure) {
      ui.atmoPressure.value = body.atmoPressure ?? 1.0;
      ui.atmoPressureValue.value = `${(body.atmoPressure ?? 1.0).toFixed(2)} atm`;
    }
    if (ui.atmoColor) ui.atmoColor.value = body.atmoColor || "#60a5fa";
    if (ui.atmoHaze) {
      ui.atmoHaze.value = body.atmoHaze ?? 60;
      ui.atmoHazeValue.value = `${body.atmoHaze ?? 60}%`;
    }

    ui.bodyName.value = body.name;
    ui.bodyMass.value = formatNumber(body.mass * EARTHS_PER_SUN, 5);
    ui.bodyColor.value = normalizeHex(body.color);
    ui.bodyVelocityX.value = formatNumber(body.vx, 8);
    ui.bodyVelocityY.value = formatNumber(body.vy, 8);
    ui.gravityScale.value = Math.round(Math.sqrt(body.gravityScale) * 100);
    ui.gravityScaleValue.value = `${formatNumber(body.gravityScale, 2)}×`;
    ui.magneticScale.value = body.magneticScale ?? 1;
    ui.magneticScaleValue.value = `${formatNumber(body.magneticScale ?? 1, 1)}×`;
    const science = scienceByName[body.name] || body.science || scienceByType[body.scienceType] || scienceByType.rock;
    const binaryPair = binaryPairs().find((pair) => pair.a.id === body.id || pair.b.id === body.id);
    const binaryPartner = binaryPair ? (binaryPair.a.id === body.id ? binaryPair.b : binaryPair.a) : null;
    ui.bodyClass.textContent = binaryPair ? binaryClassification(binaryPair) : science.className;
    ui.bodySummary.textContent = body.tidalStress > 0
      ? `Tidal stretching ${Math.round(body.tidalStress * 100)}%`
      : binaryPartner ? `Shares a barycenter with ${binaryPartner.name}` : science.summary;
    ui.bodySummary.dataset.tidal = body.tidalStress > 0 ? "true" : "false";
    ui.bodyComposition.textContent = science.composition;
    ui.bodyAtmosphere.textContent = science.atmosphere;
    ui.bodyTemperature.textContent = science.temperature;
    ui.bodyDensity.textContent = science.density;
    const massEarths = body.mass * EARTHS_PER_SUN;
    const radiusEarths = body.collisionRadius / EARTH_RADIUS_AU;
    const radiusKm = body.collisionRadius * KM_PER_AU;
    const surfaceGravity = massEarths * body.gravityScale / Math.max(radiusEarths ** 2, 1e-15);
    const escapeVelocity = 11.186 * Math.sqrt(massEarths * body.gravityScale / Math.max(radiusEarths, 1e-15));
    ui.bodySurfaceGravity.textContent = `${formatNumber(surfaceGravity, 2)} g`;
    ui.bodyEscapeVelocity.textContent = `${formatNumber(escapeVelocity, 1)} km/s`;
    ui.bodyRadius.textContent = `${Math.round(radiusKm).toLocaleString()} km`;
    const naturalMagneticField = Math.max(.01, science.magnetic || 0);
    const magneticField = naturalMagneticField * (body.magneticScale ?? 1);
    ui.bodyMagneticValue.textContent = (body.magneticScale ?? 1) <= 0 ? "Field off" : `${formatNumber(magneticField, 2)}× Earth`;
    ui.bodyMagneticNote.textContent = `${science.magneticNote} Hover over the body to reveal its magnetosphere.`;
    ui.bodyMagneticMeter.style.width = `${clamp(body.magneticScale ?? 1, 0, 100)}%`;
    ui.planetPreview.style.setProperty("--planet-color", body.color);
  }

  function updateHUD() {
    if (ui.simulationTime) ui.simulationTime.textContent = state.simYears < 1 ? `${(state.simYears * 365.25).toFixed(1)} days` : `${state.simYears.toFixed(2)} years`;
    if (ui.bodyCount) ui.bodyCount.textContent = state.bodies.length;
    if (ui.zoomValue) ui.zoomValue.textContent = `${Math.round(state.camera.zoom / 30 * 100)}%`;
    if (ui.runStatus) {
      ui.runStatus.textContent = state.running ? "RUNNING" : "PAUSED";
      ui.runStatus.parentElement?.classList?.toggle("paused", !state.running);
    }
    const throttled = state.running && state.speedDays >= 50 && state.effectiveSpeedDays < state.speedDays * .85;
    ui.timeScaleValue.value = throttled
      ? `${Math.round(state.effectiveSpeedDays)} actual / ${state.speedDays} requested`
      : `${state.speedDays} days/s`;
    ui.playPause.textContent = state.running ? "Ⅱ" : "▶";
    ui.playPause.setAttribute("aria-label", state.running ? "Pause simulation" : "Continue simulation");
    const inspected = selectedBody();
    if (inspected?.tidalStress > 0) {
      ui.bodySummary.textContent = `Tidal stretching ${Math.round(inspected.tidalStress * 100)}%`;
      ui.bodySummary.dataset.tidal = "true";
    } else if (inspected && ui.bodySummary.dataset.tidal === "true") {
      updateSelectionUI();
    }
    const scaleChoices = [.001, .002, .005, .01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 20, 50, 100];
    const target = 90 / state.camera.zoom;
    const scale = scaleChoices.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, 1);
    ui.scaleBar.style.width = `${scale * state.camera.zoom}px`;
    ui.scaleLabel.textContent = formatDistance(scale);
  }

  function fitView(silent = false) {
    state.followBodyId = null;
    if (!state.bodies.length) { state.camera = { x: 0, y: 0, zoom: 28 }; return; }
    const xs = state.bodies.map((b) => b.x);
    const ys = state.bodies.map((b) => b.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    state.camera.x = (minX + maxX) / 2;
    state.camera.y = (minY + maxY) / 2;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const vpWidth = Math.max(300, state.viewport?.width || 1000);
    const vpHeight = Math.max(300, state.viewport?.height || 700);
    state.camera.zoom = clamp(Math.min(vpWidth * .72 / width, vpHeight * .72 / height), 12, 2500);
    if (!silent) toast("Camera fitted to system");
  }

  function focusBody(body = selectedBody()) {
    if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

    state.followBodyId = body.id;
    state.camera.x = body.x;
    state.camera.y = body.y;
    const children = state.bodies.filter((candidate) => candidate.parentId === body.id);
    if (children.length) {
      const farthest = Math.max(...children.map((child) => Math.hypot(child.x - body.x, child.y - body.y)));
      state.camera.zoom = clamp(Math.min(state.viewport.width, state.viewport.height) * .38 / Math.max(farthest, body.collisionRadius * 8), 90, 250000);
    } else {
      state.camera.zoom = clamp(Math.max(state.camera.zoom, 32 / body.collisionRadius), 90, 250000);
    }
    toast(`Camera now following ${body.name}`);
  }

  function currentSpawnSpec() {
    const type = document.querySelector('input[name="spawnType"]:checked')?.value || "asteroid";
    let spec = type === "star" ? { ...spawnCatalog.star, ...starCatalog[ui.starType.value] } : spawnCatalog[type];
    const target = state.bodies.find((body) => body.id === state.launchTargetId);
    if (state.launchMode === "binary" && target) {
      const matchedMass = bodyGroupProperties(target.id).mass * EARTHS_PER_SUN;
      const radiusScale = Math.cbrt(matchedMass / Math.max(spec.mass, 1e-12));
      spec = { ...spec, mass: matchedMass, radius: spec.radius * radiusScale, collisionRadius: spec.collisionRadius * radiusScale };
    }
    return { type, spec };
  }

  function osculatingOrbit(body, parent) {
    const x = body.x - parent.x;
    const y = body.y - parent.y;
    const vx = body.vx - parent.vx;
    const vy = body.vy - parent.vy;
    const distance = Math.hypot(x, y);
    if (distance <= 0) return null;
    const mu = G * pairGravityMass(body, parent);
    const speedSq = vx * vx + vy * vy;
    const energy = speedSq / 2 - mu / distance;
    if (energy >= 0) return null;
    const a = -mu / (2 * energy);
    const dot = x * vx + y * vy;
    const eX = ((speedSq - mu / distance) * x - dot * vx) / mu;
    const eY = ((speedSq - mu / distance) * y - dot * vy) / mu;
    const e = Math.hypot(eX, eY);
    const angle = e > 1e-5 ? Math.atan2(eY, eX) : body.orbit?.angle || Math.atan2(y, x);
    const direction = x * vy - y * vx >= 0 ? 1 : -1;
    return { parentId: parent.id, a, e, angle, direction };
  }

  function stableBoundOrbit(body, parent) {
    const orbit = osculatingOrbit(body, parent);
    if (!orbit || !Number.isFinite(orbit.a) || orbit.e >= 1) return null;
    if (parent.texture === "sun" && !parent.parentId) return orbit;
    const stableRadius = hillRadius(parent) * .48;
    return orbit.a * (1 + orbit.e) < stableRadius ? orbit : null;
  }

  function refreshOrbitalRelationships() {
    for (const body of state.bodies) {
      if (body.texture === "sun" || body.mass <= 0) continue;
      const currentParent = body.parentId ? state.bodies.find((candidate) => candidate.id === body.parentId) : null;
      const currentOrbit = currentParent ? stableBoundOrbit(body, currentParent) : null;
      if (currentOrbit) {
        body.orbit = currentOrbit;
        continue;
      }
      let best = null;
      for (const candidate of state.bodies) {
        if (candidate.id === body.id || candidate.mass <= body.mass) continue;
        const orbit = stableBoundOrbit(body, candidate);
        if (!orbit) continue;
        const score = orbit.a / Math.max(hillRadius(candidate), 1e-12);
        if (!best || score < best.score) best = { candidate, orbit, score };
      }
      body.parentId = best?.candidate.id ?? null;
      body.orbit = best?.orbit ?? null;
    }
  }

  function hillRadius(body) {
    let primary = body.parentId ? state.bodies.find((candidate) => candidate.id === body.parentId) : null;
    if (!primary) {
      primary = state.bodies
        .filter((candidate) => candidate.id !== body.id && candidate.mass > body.mass)
        .sort((a, b) => (b.mass / Math.max(1e-12, (b.x - body.x) ** 2 + (b.y - body.y) ** 2)) - (a.mass / Math.max(1e-12, (a.x - body.x) ** 2 + (a.y - body.y) ** 2)))[0];
    }
    if (!primary) {
      if (body.texture === "sun") return 100;
      const farthestChild = state.bodies
        .filter((candidate) => candidate.parentId === body.id)
        .reduce((farthest, child) => Math.max(farthest, Math.hypot(child.x - body.x, child.y - body.y)), 0);
      return Math.max(.01, farthestChild * 4, body.collisionRadius * 1000);
    }
    const distance = Math.hypot(body.x - primary.x, body.y - primary.y);
    return distance * Math.cbrt(gravitationalMass(body) / Math.max(3 * gravitationalMass(primary), 1e-15));
  }

  function rocheLimit(primary, satelliteMass, satelliteRadius, satelliteGravityScale = 1) {
    const primaryGravitationalMass = gravitationalMass(primary);
    if (primaryGravitationalMass <= 0 || satelliteMass <= 0 || satelliteGravityScale <= 0) return 0;
    const primaryDensity = primaryGravitationalMass / Math.max(primary.collisionRadius ** 3, 1e-30);
    const satelliteDensity = satelliteMass * satelliteGravityScale / Math.max(satelliteRadius ** 3, 1e-30);
    const densityRatio = clamp(primaryDensity / Math.max(satelliteDensity, 1e-30), .12, 12);
    return 2.44 * ROCHE_GAMEPLAY_SCALE * primary.collisionRadius * Math.cbrt(densityRatio);
  }

  function orbitLimits(target, spec, eccentricity) {
    const roche = rocheLimit(target, spec.mass / EARTHS_PER_SUN, spec.collisionRadius);
    const minimum = Math.max((target.collisionRadius + spec.collisionRadius) * 1.35, roche * 1.05);
    const stableRadius = hillRadius(target) * .48;
    const maximumPeriapsis = stableRadius * (1 - eccentricity) / Math.max(.05, 1 + eccentricity);
    return { minimum, maximum: maximumPeriapsis, stableRadius, roche, viable: maximumPeriapsis > minimum * 1.15 };
  }

  function findDominantGravityParent(worldX, worldY, newMassEarths = 1) {
    if (!state.bodies.length) return null;
    let bestPrimary = null;
    let maxPull = -1;

    for (const candidate of state.bodies) {
      if (candidate.mass <= 0) continue;
      const dx = worldX - candidate.x;
      const dy = worldY - candidate.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      if (dist < candidate.collisionRadius * 1.05) continue;
      
      const pairScale = (candidate.gravityScale ?? 1);
      const pull = G * pairScale * candidate.mass / Math.max(distSq, 1e-10);
      
      if (pull > maxPull) {
        maxPull = pull;
        bestPrimary = candidate;
      }
    }
    return bestPrimary;
  }

  function computeAutoOrbitVelocity(worldX, worldY, primary, newMassEarths = 1, prograde = true) {
    if (!primary) return { vx: 0, vy: 0, distance: 0, speed: 0 };
    const dx = worldX - primary.x;
    const dy = worldY - primary.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0) return { vx: primary.vx, vy: primary.vy, distance: 0, speed: 0 };

    const orbiterMass = Math.max(1e-12, newMassEarths) / EARTHS_PER_SUN;
    const effectivePairMass = (primary.gravityScale ?? 1) * (primary.mass + orbiterMass);
    const speed = Math.sqrt(G * effectivePairMass / distance);

    const dir = prograde ? 1 : -1;
    const vx = primary.vx - (dy / distance) * speed * dir;
    const vy = primary.vy + (dx / distance) * speed * dir;

    return { vx, vy, distance, speed };
  }

  function spawnAutoOrbitPlanet(worldX, worldY) {
    if (state.bodies.length >= MAX_BODIES) {
      toast(`Maximum of ${MAX_BODIES} bodies reached`);
      return;
    }
    const { spec } = currentSpawnSpec();
    const primary = findDominantGravityParent(worldX, worldY, spec.mass);
    const prograde = ui.orbitDirection ? ui.orbitDirection.value !== "retrograde" : true;
    
    let spawnX = worldX;
    let spawnY = worldY;
    if (primary) {
      const minDistance = primary.collisionRadius + spec.collisionRadius * 1.25;
      const currentDist = Math.hypot(worldX - primary.x, worldY - primary.y);
      if (currentDist < minDistance) {
        const angle = Math.atan2(worldY - primary.y, worldX - primary.x);
        spawnX = primary.x + Math.cos(angle) * minDistance;
        spawnY = primary.y + Math.sin(angle) * minDistance;
      }
    }

    const { vx, vy } = computeAutoOrbitVelocity(spawnX, spawnY, primary, spec.mass, prograde);
    const isMoon = primary ? (primary.texture !== "sun" && !primary.parentId) : false;
    
    const newBody = makeBody({
      ...spec,
      name: `${spec.label || "New Planet"} ${state.idCounter}`,
      x: spawnX,
      y: spawnY,
      vx: vx,
      vy: vy,
      parentId: primary ? primary.id : null,
      isMoon: isMoon,
      tidalImmune: isMoon,
    });

    state.bodies.push(newBody);
    refreshOrbitalRelationships();
    state.effects.push({ kind: "shockwave", x: spawnX, y: spawnY, life: 1.5, maxLife: 1.5, radius: 6, growth: 55, color: newBody.color });
    SoundEngine.playOrbitPlacement();
    selectBody(newBody);
    renderSystemRoster();
    updateHUD();
    toast(`Spawned ${newBody.name} in orbit around ${primary ? primary.name : "deep space"}`);
  }

  function setLaunchMode(mode) {
    state.launchMode = mode;
    ui.autoOrbitMode?.classList.toggle("active", mode === "autoOrbit");
    ui.impactMode.classList.toggle("active", mode === "impact");
    ui.orbitMode.classList.toggle("active", mode === "orbit");
    ui.binaryMode.classList.toggle("active", mode === "binary");
    ui.autoOrbitMode?.setAttribute("aria-pressed", String(mode === "autoOrbit"));
    ui.impactMode.setAttribute("aria-pressed", String(mode === "impact"));
    ui.orbitMode.setAttribute("aria-pressed", String(mode === "orbit"));
    ui.binaryMode.setAttribute("aria-pressed", String(mode === "binary"));

    if (ui.impactOptions) ui.impactOptions.hidden = mode !== "impact";
    if (ui.orbitOptions) ui.orbitOptions.hidden = mode === "impact";

    if (ui.launchAtTarget) {
      ui.launchAtTarget.innerHTML = mode === "autoOrbit"
        ? "<span>✦</span> Click anywhere on screen to spawn"
        : mode === "binary"
        ? "<span>∞</span> Place binary with mouse"
        : mode === "orbit"
        ? "<span>◉</span> Place orbit around target"
        : "<span>➤</span> Launch at selected target";
    }

    if (ui.launchNote) {
      ui.launchNote.textContent = mode === "autoOrbit"
        ? "Wherever your mouse goes on screen, a new planet will spawn and naturally orbit the nearest star or dominant planet!"
        : mode === "binary"
        ? "The new body is mass-matched and both objects are placed around their shared barycenter."
        : mode === "orbit"
        ? "After pressing the button, move the mouse around the target to set distance, then click to create the orbit."
        : "The object spawns outside the target and automatically aims toward it.";
    }
  }

  function beginOrbitPlacement() {
    const target = state.bodies.find((body) => body.id === state.launchTargetId);
    if (!target) { toast("Select an X target first"); return; }
    const alreadyBinary = state.launchMode === "binary" && binaryPairs().some((pair) => pair.a.id === target.id || pair.b.id === target.id);
    if (alreadyBinary) {
      toast(`${target.name} already has a binary partner`);
      return;
    }
    const { spec } = currentSpawnSpec();
    const eccentricity = Number(ui.eccentricity.value) / 100;
    const limits = orbitLimits(target, spec, eccentricity);
    if (!limits.viable) {
      toast(`${target.name} cannot hold this object outside its Roche limit`);
      return;
    }
    state.orbitDistance = clamp(limits.stableRadius * .12, limits.minimum, limits.maximum);
    state.orbitAngle = 0;
    state.orbitPlacement = true;
    state.resumeAfterOrbit = state.running;
    state.running = false;
    closeLauncher();
    ui.modeHint.hidden = false;
    ui.modeHint.textContent = state.launchMode === "binary"
      ? `Choose the separation around ${target.name} · Click to create the binary · Esc to cancel`
      : `Move around ${target.name} to set orbit distance · Click to place · Esc to cancel`;
    updateOrbitReadout();
  }

  function updateOrbitPlacement(screenX, screenY) {
    const target = state.bodies.find((body) => body.id === state.launchTargetId);
    if (!target) return;
    const point = screenToWorld(screenX, screenY);
    const eccentricity = Number(ui.eccentricity.value) / 100;
    const { spec } = currentSpawnSpec();
    const limits = orbitLimits(target, spec, eccentricity);
    if (!limits.viable) return;
    state.orbitAngle = Math.atan2(point.y - target.y, point.x - target.x);
    state.orbitDistance = clamp(Math.hypot(point.x - target.x, point.y - target.y), limits.minimum, limits.maximum);
    updateOrbitReadout();
  }

  function updateOrbitReadout() {
    const eccentricity = Number(ui.eccentricity.value) / 100;
    const semiMajor = state.orbitDistance / Math.max(.05, 1 - eccentricity);
    const apoapsis = semiMajor * (1 + eccentricity);
    ui.orbitDistanceValue.textContent = `${formatDistance(state.orbitDistance)} periapsis`;
    ui.orbitRangeValue.textContent = `${formatDistance(state.orbitDistance)} near · ${formatDistance(apoapsis)} far`;
  }

  function createOrbitalBody() {
    const target = state.bodies.find((body) => body.id === state.launchTargetId);
    if (!target || state.bodies.length >= MAX_BODIES) { cancelOrbitPlacement(); return; }
    const { spec } = currentSpawnSpec();
    const eccentricity = Number(ui.eccentricity.value) / 100;
    const semiMajor = state.orbitDistance / Math.max(.05, 1 - eccentricity);
    const direction = ui.orbitDirection.value === "retrograde" ? -1 : 1;
    const bodyMass = spec.mass / EARTHS_PER_SUN;
    const spawnGravityScale = clamp(spec.gravityScale ?? 1, 0, 100);
    const effectivePairMass = (target.gravityScale ?? 1) * spawnGravityScale * (target.mass + bodyMass);
    const speed = Math.sqrt(G * effectivePairMass * (2 / state.orbitDistance - 1 / semiMajor));
    const cos = Math.cos(state.orbitAngle);
    const sin = Math.sin(state.orbitAngle);
    const binary = state.launchMode === "binary";
    if (binary && binaryPairs().some((pair) => pair.a.id === target.id || pair.b.id === target.id)) {
      cancelOrbitPlacement();
      toast(`${target.name} already has a binary partner`);
      return;
    }
    const targetGroup = binary ? bodyGroupProperties(target.id) : null;
    const targetMass = targetGroup?.mass ?? target.mass;
    const targetGravityScale = targetGroup?.gravityScale ?? (target.gravityScale ?? 1);
    const centerX = targetGroup?.x ?? target.x;
    const centerY = targetGroup?.y ?? target.y;
    const centerVx = targetGroup?.vx ?? target.vx;
    const centerVy = targetGroup?.vy ?? target.vy;
    const totalMass = targetMass + bodyMass;
    const targetFraction = bodyMass / totalMass;
    const bodyFraction = targetMass / totalMass;
    const binaryEffectivePairMass = targetGravityScale * spawnGravityScale * totalMass;
    const orbitalSpeed = binary
      ? Math.sqrt(G * binaryEffectivePairMass * (2 / state.orbitDistance - 1 / semiMajor))
      : speed;
    if (binary) {
      const targetShiftX = -cos * state.orbitDistance * targetFraction;
      const targetShiftY = -sin * state.orbitDistance * targetFraction;
      const targetVelocityX = sin * orbitalSpeed * direction * targetFraction;
      const targetVelocityY = -cos * orbitalSpeed * direction * targetFraction;
      const targetGroupIds = new Set(targetGroup.ids);
      for (const member of state.bodies) {
        if (!targetGroupIds.has(member.id)) continue;
        member.x += targetShiftX;
        member.y += targetShiftY;
        member.vx += targetVelocityX;
        member.vy += targetVelocityY;
        member.trail = [];
      }
    }
    const body = makeBody({
      ...spec,
      name: `${spec.label} ${state.idCounter}`,
      x: binary ? centerX + cos * state.orbitDistance * bodyFraction : target.x + cos * state.orbitDistance,
      y: binary ? centerY + sin * state.orbitDistance * bodyFraction : target.y + sin * state.orbitDistance,
      vx: binary ? centerVx - sin * orbitalSpeed * direction * bodyFraction : target.vx - sin * speed * direction,
      vy: binary ? centerVy + cos * orbitalSpeed * direction * bodyFraction : target.vy + cos * speed * direction,
      parentId: target.id,
      binaryPartnerId: binary ? target.id : null,
      orbit: { parentId: target.id, a: semiMajor, e: eccentricity, angle: state.orbitAngle, direction },
    });
    if (binary) {
      target.binaryPartnerId = body.id;
    }
    state.bodies.push(body);
    state.orbitPlacement = false;
    state.running = state.resumeAfterOrbit;
    updateInteractionHint();
    selectBody(body);
    renderSystemRoster();
    toast(binary ? `${target.name} and ${body.name} now orbit their barycenter` : `${body.name} placed in orbit around ${target.name}`);
  }

  function cancelOrbitPlacement() {
    state.orbitPlacement = false;
    state.running = state.resumeAfterOrbit;
    updateInteractionHint();
  }

  function openLauncher() {
    if (state.orbitPlacement) cancelOrbitPlacement();
    toggleMoveMode(false);
    ui.controlPanel.classList.remove("open");
    ui.mobilePanelButton.setAttribute("aria-label", "Open settings");
    state.launchTargetId = selectedBody()?.id || null;
    setLaunchMode(state.launchMode || "autoOrbit");
    renderSystemRoster();
    ui.launchPanel.classList.add("open");
    ui.launchPanel.setAttribute("aria-hidden", "false");
    ui.launchPanel.inert = false;
  }

  function closeLauncher() {
    ui.launchPanel.classList.remove("open");
    ui.launchPanel.setAttribute("aria-hidden", "true");
    ui.launchPanel.inert = true;
  }

  function renderSystemRoster() {
    if (!ui.systemRoster) return;
    if (!state.bodies.some((body) => body.id === state.launchTargetId)) state.launchTargetId = null;
    ui.systemRoster.innerHTML = "";
    ui.rosterCount.textContent = `${state.bodies.length} ${state.bodies.length === 1 ? "body" : "bodies"}`;
    const binaries = binaryPairs();
    for (const body of [...state.bodies].sort((a, b) => b.mass - a.mass)) {
      const science = scienceByName[body.name] || body.science || scienceByType[body.scienceType] || scienceByType.rock;
      const binary = binaries.find((pair) => pair.a.id === body.id || pair.b.id === body.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `roster-body${body.id === state.launchTargetId ? " selected" : ""}`;
      button.dataset.bodyId = body.id;
      button.setAttribute("aria-pressed", body.id === state.launchTargetId ? "true" : "false");
      button.setAttribute("aria-label", `Target ${body.name}`);
      button.style.setProperty("--body-color", body.color);
      const orb = document.createElement("i");
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      const type = document.createElement("small");
      const mass = document.createElement("span");
      name.textContent = body.name;
      type.textContent = binary ? binaryClassification(binary) : science.className;
      mass.textContent = `${formatNumber(body.mass * EARTHS_PER_SUN, 2)} M⊕`;
      copy.append(name, type);
      button.append(orb, copy, mass);
      ui.systemRoster.append(button);
    }
    ui.launchAtTarget.disabled = state.launchMode !== "autoOrbit" && (!state.launchTargetId || !state.bodies.length);
  }

  function launchAtSelectedTarget() {
    if (state.launchMode === "autoOrbit") {
      closeLauncher();
      toggleAddMode(true);
      toast("Click anywhere on screen to spawn a planet in orbit!");
      return;
    }
    const target = state.bodies.find((body) => body.id === state.launchTargetId);
    if (!target || state.bodies.length >= MAX_BODIES) {
      toast(target ? `Maximum of ${MAX_BODIES} bodies reached` : "Select a target first");
      return;
    }
    if (state.launchMode !== "impact") { beginOrbitPlacement(); return; }
    const { spec } = currentSpawnSpec();
    const angle = (state.idCounter * 2.399963) % (Math.PI * 2);
    const minimumDistance = (target.collisionRadius + spec.collisionRadius) * 8;
    const targetHillRadius = hillRadius(target);
    const distance = target.parentId
      ? clamp(targetHillRadius * .18, minimumDistance, Math.max(minimumDistance, targetHillRadius * .35))
      : clamp(targetHillRadius * .01, minimumDistance, 1);
    const x = target.x + Math.cos(angle) * distance;
    const y = target.y + Math.sin(angle) * distance;
    const spawnMass = spec.mass / EARTHS_PER_SUN;
    const spawnGravityScale = clamp(spec.gravityScale ?? 1, 0, 100);
    const escapeSpeed = Math.sqrt(2 * G * (target.gravityScale ?? 1) * spawnGravityScale * (target.mass + spawnMass) / distance);
    const speed = escapeSpeed * [.55, .9, 1.4][Number(ui.impactSpeed.value) - 1];
    const body = makeBody({
      ...spec,
      name: `${spec.label} ${state.idCounter}`,
      x, y,
      vx: target.vx - Math.cos(angle) * speed,
      vy: target.vy - Math.sin(angle) * speed,
    });
    state.bodies.push(body);
    selectBody(body);
    renderSystemRoster();
    closeLauncher();
    toast(`${body.name} launched toward ${target.name}`);
  }

  function toggleAddMode(force) {
    state.addMode = force ?? !state.addMode;
    if (state.addMode) toggleMoveMode(false);
    state.launchStart = null;
    canvas.classList.toggle("adding", state.addMode);
    ui.addBody.classList.toggle("active", state.addMode);
    updateInteractionHint();
  }

  function updateInteractionHint() {
    if (state.orbitPlacement) return;
    if (state.moveMode) {
      const body = state.bodies.find((candidate) => candidate.id === state.grabbedBodyId);
      ui.modeHint.textContent = body
        ? `Moving ${body.name} and its moons · Release to keep the new position`
        : "Move Bodies · Drag a planet, moon, or star · Press T or Esc to exit";
      ui.modeHint.hidden = false;
    } else if (state.addMode) {
      ui.modeHint.textContent = "Drag in space to launch a new body · Esc to cancel";
      ui.modeHint.hidden = false;
    } else {
      ui.modeHint.hidden = true;
    }
  }

  function toggleMoveMode(force) {
    const enabled = force ?? !state.moveMode;
    if (!enabled && state.grabbedBodyId != null) finishBodyDrag();
    state.moveMode = enabled;
    if (enabled) {
      state.addMode = false;
      state.launchStart = null;
      canvas.classList.remove("adding");
      ui.addBody.classList.remove("active");
      if (state.orbitPlacement) cancelOrbitPlacement();
    }
    canvas.classList.toggle("move-bodies", enabled);
    ui.moveBodyMode.classList.toggle("active", enabled);
    ui.moveBodyMode.setAttribute("aria-pressed", String(enabled));
    updateInteractionHint();
    if (enabled) toast("Move Bodies enabled — drag any body");
  }

  function toggleMoons(engage = !state.moonsEngaged) {
    state.moonsEngaged = engage;
    if (ui.toggleMoonsBtn) {
      ui.toggleMoonsBtn.classList.toggle("active", engage);
      ui.toggleMoonsBtn.innerHTML = engage ? "<span>🌙</span> Moons: ON" : "<span>🌑</span> Moons: OFF";
      ui.toggleMoonsBtn.setAttribute("aria-pressed", String(engage));
    }
    if (!engage) {
      state.bodies = state.bodies.filter((body) => !body.isMoon);
      if (selectedBody()?.isMoon) state.selectedId = null;
      refreshOrbitalRelationships();
      updateSelectionUI();
      renderSystemRoster();
      toast("Moons disengaged — Maximum fast-forward speed active!", 4000);
    } else {
      addMajorMoons();
      refreshOrbitalRelationships();
      updateSelectionUI();
      renderSystemRoster();
      toast("Moons engaged — 21 major moons spawned across solar system!", 4000);
    }
  }

  function bodyGroupIds(rootId) {
    const ids = new Set([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const body of state.bodies) {
        if (body.parentId && ids.has(body.parentId) && !ids.has(body.id)) {
          ids.add(body.id);
          added = true;
        }
      }
    }
    return [...ids];
  }

  function bodyGroupProperties(rootId) {
    const ids = bodyGroupIds(rootId);
    const members = state.bodies.filter((body) => ids.includes(body.id));
    const mass = members.reduce((sum, body) => sum + body.mass, 0);
    const safeMass = Math.max(mass, 1e-15);
    const gravitationalCharge = members.reduce((sum, body) => sum + gravitationalMass(body), 0);
    return {
      ids,
      mass: safeMass,
      gravityScale: gravitationalCharge / safeMass,
      x: members.reduce((sum, body) => sum + body.x * body.mass, 0) / safeMass,
      y: members.reduce((sum, body) => sum + body.y * body.mass, 0) / safeMass,
      vx: members.reduce((sum, body) => sum + body.vx * body.mass, 0) / safeMass,
      vy: members.reduce((sum, body) => sum + body.vy * body.mass, 0) / safeMass,
    };
  }

  function beginBodyDrag(body, screenX, screenY) {
    state.grabbedBodyId = body.id;
    state.grabbedGroupIds = bodyGroupIds(body.id);
    state.grabScreenX = screenX;
    state.grabScreenY = screenY;
    state.resumeAfterMove = state.running;
    state.running = false;
    state.pointer.dragging = true;
    state.pointer.moved = false;
    selectBody(body);
    canvas.classList.add("grabbing-body");
    updateInteractionHint();
  }

  function moveGrabbedBody(screenX, screenY) {
    const body = state.bodies.find((candidate) => candidate.id === state.grabbedBodyId);
    if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

    const dx = (screenX - state.grabScreenX) / state.camera.zoom;
    const dy = (screenY - state.grabScreenY) / state.camera.zoom;
    state.grabScreenX = screenX;
    state.grabScreenY = screenY;
    for (const member of state.bodies) {
      if (!state.grabbedGroupIds.includes(member.id)) continue;
      member.x += dx;
      member.y += dy;
      member.prevX = member.x;
      member.prevY = member.y;
      member.trail = [];
    }
  }

  function finishBodyDrag() {
    const body = state.bodies.find((candidate) => candidate.id === state.grabbedBodyId);
    state.grabbedBodyId = null;
    state.grabbedGroupIds = [];
    state.pointer.dragging = false;
    state.running = state.resumeAfterMove;
    canvas.classList.remove("grabbing-body");
    if (body) {
      const parent = body.parentId ? state.bodies.find((candidate) => candidate.id === body.parentId) : null;
      body.orbit = parent ? osculatingOrbit(body, parent) : null;
      refreshOrbitalRelationships();
      toast(`${body.name} moved — velocity preserved`);
    }
    updateInteractionHint();
  }

  function createLaunchedBody(start, end) {
    if (state.bodies.length >= MAX_BODIES) { toast(`Maximum of ${MAX_BODIES} bodies reached`); return; }
    const velocityScale = .8;
    const body = makeBody({
      name: `New world ${state.idCounter}`,
      mass: .25,
      radius: .045,
      color: randomColor(),
      texture: "rock",
      x: start.x,
      y: start.y,
      vx: (end.x - start.x) * velocityScale,
      vy: (end.y - start.y) * velocityScale,
    });
    state.bodies.push(body);
    selectBody(body);
    toggleAddMode(false);
    toast(`${body.name} launched`);
  }

  function bindEvents() {
    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("pointerleave", () => { state.hoveredId = null; });
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      if (state.orbitPlacement) {
        state.pointer.x = event.offsetX;
        state.pointer.y = event.offsetY;
        return;
      }
      if (state.moveMode) {
        const body = bodyAt(event.offsetX, event.offsetY);
        if (body) {
          state.pointer.downX = state.pointer.x = event.offsetX;
          state.pointer.downY = state.pointer.y = event.offsetY;
          beginBodyDrag(body, event.offsetX, event.offsetY);
          return;
        }
      }
      state.pointer.downX = state.pointer.x = event.offsetX;
      state.pointer.downY = state.pointer.y = event.offsetY;
      state.pointer.dragging = true;
      state.pointer.moved = false;
      const world = screenToWorld(event.offsetX, event.offsetY);
      state.pointer.worldX = world.x;
      state.pointer.worldY = world.y;
      if (state.addMode) state.launchStart = world;
      else {
        state.followBodyId = null;
        canvas.classList.add("dragging");
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      state.hoveredId = bodyAt(event.offsetX, event.offsetY)?.id ?? null;
      if (state.orbitPlacement) {
        state.pointer.x = event.offsetX;
        state.pointer.y = event.offsetY;
        updateOrbitPlacement(event.offsetX, event.offsetY);
        return;
      }
      if (state.grabbedBodyId != null) {
        state.pointer.x = event.offsetX;
        state.pointer.y = event.offsetY;
        state.pointer.moved = true;
        moveGrabbedBody(event.offsetX, event.offsetY);
        return;
      }
      const dx = event.offsetX - state.pointer.x;
      const dy = event.offsetY - state.pointer.y;
      state.pointer.x = event.offsetX;
      state.pointer.y = event.offsetY;
      if (!state.pointer.dragging) return;
      if (Math.hypot(event.offsetX - state.pointer.downX, event.offsetY - state.pointer.downY) > 3) state.pointer.moved = true;
      if (!state.addMode) {
        state.followBodyId = null;
        state.camera.x -= dx / state.camera.zoom;
        state.camera.y -= dy / state.camera.zoom;
      }
    });
    canvas.addEventListener("pointerup", (event) => {
      if (state.orbitPlacement) {
        updateOrbitPlacement(event.offsetX, event.offsetY);
        createOrbitalBody();
        return;
      }
      if (state.grabbedBodyId != null) {
        moveGrabbedBody(event.offsetX, event.offsetY);
        finishBodyDrag();
        return;
      }
      if (state.addMode && state.launchStart) {
        if (state.launchMode === "autoOrbit") {
          const world = screenToWorld(event.offsetX, event.offsetY);
          spawnAutoOrbitPlanet(world.x, world.y);
        } else {
          createLaunchedBody(state.launchStart, screenToWorld(event.offsetX, event.offsetY));
        }
      } else if (event.shiftKey && !state.pointer.moved) {
        const world = screenToWorld(event.offsetX, event.offsetY);
        spawnAutoOrbitPlanet(world.x, world.y);
      } else if (!state.pointer.moved) {
        selectBody(bodyAt(event.offsetX, event.offsetY));
      }
      state.pointer.dragging = false;
      state.launchStart = null;
      canvas.classList.remove("dragging");
    });
    canvas.addEventListener("pointercancel", () => {
      if (state.grabbedBodyId != null) finishBodyDrag();
      state.pointer.dragging = false;
      state.launchStart = null;
      canvas.classList.remove("dragging");
    });
    canvas.addEventListener("dblclick", (event) => focusBody(bodyAt(event.offsetX, event.offsetY)));
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      state.followBodyId = null;
      const before = screenToWorld(event.offsetX, event.offsetY);
      const wheelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * state.viewport.height : event.deltaY;
      state.camera.zoom = clamp(state.camera.zoom * Math.exp(-wheelDelta * .0042), 1.5, 250000);
      const after = screenToWorld(event.offsetX, event.offsetY);
      state.camera.x += before.x - after.x;
      state.camera.y += before.y - after.y;
    }, { passive: false });

    ui.playPause.addEventListener("click", () => { state.running = !state.running; });
    ui.loadPreset.addEventListener("click", () => loadPreset(ui.presetSelect.value));
    ui.resetSimulation.addEventListener("click", restoreSnapshot);
    ui.clearSimulation.addEventListener("click", () => {
      cancelOrbitPlacement(); toggleMoveMode(false); state.bodies = []; state.effects = []; state.selectedId = null; state.simYears = 0; updateSelectionUI(); renderSystemRoster(); toast("Universe cleared");
    });
    ui.fitView.addEventListener("click", () => fitView());
    ui.fitViewTopBtn?.addEventListener("click", () => fitView());
    ui.zoomInBtn?.addEventListener("click", () => {
      state.followBodyId = null;
      state.camera.zoom = clamp(state.camera.zoom * 1.35, 1.5, 250000);
    });
    ui.zoomOutBtn?.addEventListener("click", () => {
      state.followBodyId = null;
      state.camera.zoom = clamp(state.camera.zoom / 1.35, 1.5, 250000);
    });
    ui.moveBodyMode.addEventListener("click", () => toggleMoveMode());
    ui.toggleMoonsBtn?.addEventListener("click", () => toggleMoons());
    ui.addBody.addEventListener("click", openLauncher);
    ui.newPlanetTop.addEventListener("click", openLauncher);
    ui.closeLauncher.addEventListener("click", closeLauncher);
    ui.launchAtTarget.addEventListener("click", launchAtSelectedTarget);
    ui.autoOrbitMode?.addEventListener("click", () => setLaunchMode("autoOrbit"));
    ui.impactMode.addEventListener("click", () => setLaunchMode("impact"));
    ui.orbitMode.addEventListener("click", () => setLaunchMode("orbit"));
    ui.binaryMode.addEventListener("click", () => setLaunchMode("binary"));
    ui.spawnTypes.addEventListener("change", () => {
      const type = document.querySelector('input[name="spawnType"]:checked')?.value;
      ui.starTypeField.hidden = type !== "star";
    });
    ui.eccentricity.addEventListener("input", () => {
      const value = Number(ui.eccentricity.value) / 100;
      ui.eccentricityValue.value = value.toFixed(2);
      updateOrbitReadout();
    });
    ui.systemRoster.addEventListener("click", (event) => {
      const item = event.target.closest(".roster-body");
      if (!item) return;
      state.launchTargetId = Number(item.dataset.bodyId);
      renderSystemRoster();
    });
    ui.impactSpeed.addEventListener("input", () => {
      ui.impactSpeedValue.value = ["Low", "Medium", "High"][Number(ui.impactSpeed.value) - 1];
    });
    ui.timeScale.addEventListener("input", () => {
      const normalized = Number(ui.timeScale.value) / 100;
      state.speedDays = normalized === 0 ? 0 : Math.round(10 ** (normalized * 3) / 3);
      ui.timeScaleValue.value = `${state.speedDays} days/s`;
    });
    ui.gravityScale.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

      body.gravityScale = (Number(ui.gravityScale.value) / 100) ** 2;
      updateSelectionUI();
    });
    ui.magneticScale.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

      body.magneticScale = clamp(Number(ui.magneticScale.value), 0, 100);
      updateSelectionUI();
    });
    ui.trailLength.addEventListener("input", () => {
      state.trailLength = Number(ui.trailLength.value);
      ui.trailLengthValue.value = state.trailLength;
      for (const body of state.bodies) if (body.trail.length > state.trailLength) body.trail.splice(0, body.trail.length - state.trailLength);
    });
    [["showTrails", "showTrails"], ["showLabels", "showLabels"], ["showGrid", "showGrid"], ["showVelocity", "showVelocity"], ["showOrbits", "showOrbits"], ["solarFlaresEnabled", "solarFlaresEnabled"], ["lensFlaresEnabled", "lensFlaresEnabled"], ["auroraEnabled", "auroraEnabled"], ["showAccretionDisk", "showAccretionDisk"]].forEach(([id, property]) => {
      if (ui[id]) ui[id].addEventListener("change", () => { state[property] = ui[id].checked; });
    });

    ui.audioEnabled?.addEventListener("change", () => {
      state.audioEnabled = ui.audioEnabled.checked;
      SoundEngine.toggleMute(!state.audioEnabled);
    });

    
    ui.triggerSupernovaGlobalBtn?.addEventListener("click", () => {
      triggerSupernova();
    });

    
    // Planetary Customizer Tabs
    const tabBtns = [ui.tabBandsBtn, ui.tabWaterBtn, ui.tabAtmoBtn];
    const panels = [ui.panelBands, ui.panelWater, ui.panelAtmo];

    tabBtns.forEach((btn, idx) => {
      btn?.addEventListener("click", () => {
        tabBtns.forEach(b => b?.classList.remove("active"));
        panels.forEach(p => { if (p) p.style.display = "none"; });
        btn.classList.add("active");
        if (panels[idx]) panels[idx].style.display = "block";
      });
    });

    // Customizer Input Event Listeners
    ui.bandCount?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.bandCount = parseInt(ui.bandCount.value, 10);
      ui.bandCountValue.value = body.bandCount;
      updateSelectionUI();
    });

    ui.bandPaletteSelect?.addEventListener("change", () => {
      const body = selectedBody();
      if (!body) return;
      const palKey = ui.bandPaletteSelect.value;
      body.bandPalette = palKey;
      if (bandPalettes[palKey] && palKey !== "custom") {
        body.bandColors = [...bandPalettes[palKey].colors];
        body.stormColor = bandPalettes[palKey].storm;
        if (ui.bandColor1) ui.bandColor1.value = body.bandColors[0];
        if (ui.bandColor2) ui.bandColor2.value = body.bandColors[1];
        if (ui.bandColor3) ui.bandColor3.value = body.bandColors[2];
        if (ui.stormColor) ui.stormColor.value = body.stormColor;
      }
      updateSelectionUI();
    });

    [ui.bandColor1, ui.bandColor2, ui.bandColor3].forEach((input, i) => {
      input?.addEventListener("input", () => {
        const body = selectedBody();
        if (!body) return;
        if (!body.bandColors) body.bandColors = ["#6b21a8", "#9333ea", "#c084fc", "#3b82f6"];
        body.bandColors[i] = input.value;
        body.bandPalette = "custom";
        if (ui.bandPaletteSelect) ui.bandPaletteSelect.value = "custom";
        updateSelectionUI();
      });
    });

    ui.stormColor?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.stormColor = ui.stormColor.value;
      updateSelectionUI();
    });

    ui.bandTurbulence?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.bandTurbulence = parseInt(ui.bandTurbulence.value, 10);
      ui.bandTurbulenceValue.value = `${body.bandTurbulence}%`;
      updateSelectionUI();
    });

    ui.showGreatStorm?.addEventListener("change", () => {
      const body = selectedBody();
      if (!body) return;
      body.showGreatStorm = ui.showGreatStorm.checked;
      updateSelectionUI();
    });

    ui.waterCoverage?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.waterCoverage = parseInt(ui.waterCoverage.value, 10);
      ui.waterCoverageValue.value = `${body.waterCoverage}%`;
      updateSelectionUI();
    });

    ui.oceanColor?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.oceanColor = ui.oceanColor.value;
      updateSelectionUI();
    });

    ui.landColor?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.landColor = ui.landColor.value;
      updateSelectionUI();
    });

    ui.iceCapCoverage?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.iceCapCoverage = parseInt(ui.iceCapCoverage.value, 10);
      ui.iceCapCoverageValue.value = `${body.iceCapCoverage}%`;
      updateSelectionUI();
    });

    ui.gasTypeSelect?.addEventListener("change", () => {
      const body = selectedBody();
      if (!body) return;
      const gasKey = ui.gasTypeSelect.value;
      body.gasType = gasKey;
      const spec = atmosphereGasSpecs[gasKey];
      if (spec) {
        body.atmoColor = spec.color;
        body.atmoHaze = Math.round(spec.haze * 100);
        if (ui.atmoColor) ui.atmoColor.value = spec.color;
        if (ui.atmoHaze) ui.atmoHaze.value = body.atmoHaze;
        if (ui.atmoHazeValue) ui.atmoHazeValue.value = `${body.atmoHaze}%`;
      }
      updateSelectionUI();
    });

    ui.atmoPressure?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.atmoPressure = parseFloat(ui.atmoPressure.value);
      ui.atmoPressureValue.value = `${body.atmoPressure.toFixed(2)} atm`;
      updateSelectionUI();
    });

    ui.atmoColor?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.atmoColor = ui.atmoColor.value;
      updateSelectionUI();
    });

    ui.atmoHaze?.addEventListener("input", () => {
      const body = selectedBody();
      if (!body) return;
      body.atmoHaze = parseInt(ui.atmoHaze.value, 10);
      ui.atmoHazeValue.value = `${body.atmoHaze}%`;
      updateSelectionUI();
    });

    ui.crushBlackHoleBtn?.addEventListener("click", () => {
      const body = selectedBody();
      if (body) crushIntoBlackHole(body);
    });

    ui.triggerSupernovaBtn?.addEventListener("click", () => {
      const body = selectedBody();
      if (body) triggerSupernova(body);
    });

    ui.generateRingsBtn?.addEventListener("click", () => {
      const body = selectedBody();
      if (body) createPlanetaryRingSystem(body);
    });

    ui.triggerFlareBtn?.addEventListener("click", () => {
      triggerSolarFlare();
    });

    window.addEventListener("pointerdown", () => SoundEngine.unlock(), { once: true });
    window.addEventListener("keydown", () => SoundEngine.unlock(), { once: true });

    ui.bodyName.addEventListener("change", () => { const body = selectedBody(); if (body) { body.name = ui.bodyName.value.trim() || "Unnamed body"; updateSelectionUI(); renderSystemRoster(); } });
    ui.bodyMass.addEventListener("change", () => {
      const body = selectedBody();
      const massEarths = Number(ui.bodyMass.value);
      if (!body || !Number.isFinite(massEarths) || massEarths <= 0) { updateSelectionUI(); return; }
      resizeBodyForMass(body, massEarths);
      refreshOrbitalRelationships();
      updateSelectionUI();
      renderSystemRoster();
    });
    ui.bodyColor.addEventListener("input", () => { const body = selectedBody(); if (body) { body.color = ui.bodyColor.value; ui.selectionDot.style.background = body.color; ui.planetPreview.style.setProperty("--planet-color", body.color); } });
    ui.bodyVelocityX.addEventListener("input", () => {
      const body = selectedBody();
      const velocity = Number(ui.bodyVelocityX.value);
      if (body && Number.isFinite(velocity)) body.vx = velocity;
    });
    ui.bodyVelocityY.addEventListener("input", () => {
      const body = selectedBody();
      const velocity = Number(ui.bodyVelocityY.value);
      if (body && Number.isFinite(velocity)) body.vy = velocity;
    });
    ui.focusBody.addEventListener("click", () => focusBody());
    ui.deleteBody.addEventListener("click", () => {
      const body = selectedBody();
      if (!body) {
      if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = "none";
      if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = "none";
      return;
    }

    const isStarOrGiant = body && (body.texture === "sun" || body.scienceType === "star" || body.mass * EARTHS_PER_SUN > 15000);
    const isPlanetOrGiant = body && !isStarOrGiant && !body.isBlackHole;
    if (ui.triggerSupernovaBtn) ui.triggerSupernovaBtn.style.display = isStarOrGiant ? "flex" : "none";
    if (ui.generateRingsBtn) ui.generateRingsBtn.style.display = isPlanetOrGiant ? "flex" : "none";

      state.bodies = state.bodies.filter((item) => item.id !== body.id);
      if (state.followBodyId === body.id) state.followBodyId = null;
      state.selectedId = null;
      updateSelectionUI();
      renderSystemRoster();
      toast(`${body.name} removed`);
    });

    ui.closeEvolutionHud?.addEventListener("click", () => {
      ui.evolutionHud.hidden = true;
    });

    ui.evolutionStepper?.querySelectorAll(".evo-step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = parseInt(btn.dataset.step, 10);
        if (!isNaN(step)) {
          if (state.evolutionTimer) {
            clearInterval(state.evolutionTimer);
            state.evolutionTimer = null;
            state.evolutionAutoPlay = false;
            ui.evoPlayBtn.textContent = "▶ Auto-Play Eras";
          }
          loadEvolutionStage(step);
        }
      });
    });

    ui.evoPrevBtn?.addEventListener("click", () => {
      const prev = (state.evolutionStage - 1 + 8) % 8;
      loadEvolutionStage(prev);
    });

    ui.evoNextBtn?.addEventListener("click", () => {
      const next = (state.evolutionStage + 1) % 8;
      loadEvolutionStage(next);
    });

    ui.evoPlayBtn?.addEventListener("click", () => {
      if (state.evolutionAutoPlay) {
        clearInterval(state.evolutionTimer);
        state.evolutionTimer = null;
        state.evolutionAutoPlay = false;
        ui.evoPlayBtn.textContent = "▶ Auto-Play Eras";
      } else {
        state.evolutionAutoPlay = true;
        ui.evoPlayBtn.textContent = "⏸ Pause Auto-Play";
        state.evolutionTimer = setInterval(() => {
          const next = (state.evolutionStage + 1) % 8;
          loadEvolutionStage(next);
        }, 7000);
      }
    });

    ui.helpButton.addEventListener("click", () => ui.helpDialog.showModal());
    ui.closeHelp.addEventListener("click", () => ui.helpDialog.close());
    ui.mobilePanelButton.addEventListener("click", () => {
      ui.controlPanel.classList.toggle("open");
      ui.mobilePanelButton.setAttribute("aria-label", "Open settings");
    });
    ui.closeSettings.addEventListener("click", () => {
      ui.controlPanel.classList.remove("open");
      ui.mobilePanelButton.setAttribute("aria-label", "Open settings");
    });
    document.addEventListener("pointerdown", (event) => {
      if (!ui.controlPanel.classList.contains("open")) return;
      if (ui.controlPanel.contains(event.target) || ui.mobilePanelButton.contains(event.target)) return;
      ui.controlPanel.classList.remove("open");
      ui.mobilePanelButton.setAttribute("aria-label", "Open settings");
    });
    window.addEventListener("keydown", (event) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); state.running = !state.running; }
      if (event.key.toLowerCase() === "a") openLauncher();
      if (event.key.toLowerCase() === "t") toggleMoveMode();
      if (event.key.toLowerCase() === "f") fitView();
      if (event.key === "Escape") {
        toggleAddMode(false);
        toggleMoveMode(false);
        closeLauncher();
        cancelOrbitPlacement();
        ui.controlPanel.classList.remove("open");
        ui.mobilePanelButton.setAttribute("aria-label", "Open settings");
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedBody()) ui.deleteBody.click();
    });
  }

  let toastTimer;
  function toast(message, duration = 2200) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.add("visible");
    toastTimer = setTimeout(() => ui.toast.classList.remove("visible"), duration);
  }

  function formatNumber(value, precision) {
    if (Math.abs(value) >= 10000) return Math.round(value).toString();
    if (value !== 0 && Math.abs(value) < 10 ** -precision) return value.toExponential(3);
    return Number(value.toFixed(precision)).toString();
  }

  function formatDistance(au) {
    if (au >= .1) return `${au.toFixed(2)} AU`;
    const kilometers = au * KM_PER_AU;
    if (kilometers >= 1000000) return `${(kilometers / 1000000).toFixed(2)}M km`;
    if (kilometers >= 1000) return `${Math.round(kilometers).toLocaleString()} km`;
    return `${Math.round(kilometers)} km`;
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function randomColor() { return ["#7eb7ff", "#e68d60", "#9b83e8", "#72d6c5", "#d8b76f"][Math.floor(Math.random() * 5)]; }
  function normalizeHex(color) {
    if (!color || typeof color !== "string") return "#9cb8d8";
    if (color.startsWith("#")) {
      const clean = color.trim().toLowerCase();
      if (clean.length === 7) return clean;
      if (clean.length === 4) return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
    }
    if (color.startsWith("rgb")) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const hex = (x) => parseInt(x, 10).toString(16).padStart(2, "0");
        return `#${hex(match[0])}${hex(match[1])}${hex(match[2])}`;
      }
    }
    return "#9cb8d8";
  }

  function rgbaColor(hexOrRgb, alpha = 1) {
    const hex = normalizeHex(hexOrRgb);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const validR = Number.isNaN(r) ? 255 : r;
    const validG = Number.isNaN(g) ? 255 : g;
    const validB = Number.isNaN(b) ? 255 : b;
    return `rgba(${validR}, ${validG}, ${validB}, ${clamp(alpha, 0, 1)})`;
  }

  function lighten(hex, amount) { return mixColor(hex, "#ffffff", amount); }
  function darken(hex, amount) { return mixColor(hex, "#000000", amount); }
  function mixColor(a, b, amount) {
    const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [ar, ag, ab] = parse(normalizeHex(a));
    const [br, bg, bb] = parse(normalizeHex(b));
    return `rgb(${Math.round(ar + (br - ar) * amount)},${Math.round(ag + (bg - ag) * amount)},${Math.round(ab + (bb - ab) * amount)})`;
  }

  resizeCanvas();
  bindEvents();
  loadPreset("solar");
  setLaunchMode("impact");
  ui.timeScale.dispatchEvent(new Event("input"));

  window.addEventListener("DOMContentLoaded", () => {
    resizeCanvas();
  });
  window.addEventListener("load", () => {
    resizeCanvas();
    if (state.preset === "solar") state.camera = { x: 0, y: 0, zoom: 28 };
  });

  requestAnimationFrame(frame);
})();
