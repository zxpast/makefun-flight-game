// Sky Courier: Coral Isles — tuning constants, world layout, missions.
// All distances in metres, speeds in m/s, angles in degrees. Display code
// converts to knots / feet for the HUD. One place for every magic number so
// the flight model, the world and the missions can never drift apart.

export const CONFIG = {
  title: 'Sky Courier: Coral Isles',
  worldSeed: 20261126,
  worldHalf: 2000, // playable square is [-2000, 2000] on x and z
  seaLevel: 0,

  // --- flight model -------------------------------------------------------
  maxThrottle: 1,
  throttleStep: 0.45, // per second while a throttle key is held
  cruiseSpeed: 55, // m/s at full level throttle
  minFlyingSpeed: 12, // m/s at idle (plane still rolls on the ground)
  stallSpeed: 26, // below this the wing stops flying and the nose drops
  maxSpeed: 88, // m/s, level-flight ceiling at full throttle
  pitchRate: 38, // deg/s of elevator authority
  maxPitch: 28, // deg up / down the pilot may command
  rollRate: 95, // deg/s of aileron authority
  maxBank: 55, // deg of bank the pilot may command
  turnFactor: 9.81, // g, used for the coordinated-turn rate
  drag: 0.16, // 1/s, pulls speed toward the throttle target
  climbSink: 0.55, // extra sink per m/s under the stall speed
  gearDrag: 0.10, // extra drag while the gear is down
  takeoffSpeed: 30, // m/s, rotate speed
  landingMaxSpeed: 42, // m/s, faster than this on touchdown = hard landing
  landingMaxSink: 4.2, // m/s of descent on touchdown; more = damage
  crashSink: 7.5, // m/s of descent on ground contact = crash outright

  // --- fuel and damage ----------------------------------------------------
  fuelMax: 100,
  fuelBurnIdle: 0.25, // units/s at idle
  fuelBurnFull: 1.15, // units/s at full throttle (linear between)
  fuelEmptySpeed: 0, // out of fuel: throttle is forced to idle
  hullMax: 100,
  damageHardLanding: 22,
  damageScrape: 35,
  damageRingMiss: 0,

  // --- scoring ------------------------------------------------------------
  ringPoints: 150,
  landingPoints: 500,
  softLandingBonus: 250,
  hopPoints: 400,
  timeBonusPerSecond: 2,

  // --- camera -------------------------------------------------------------
  chaseDistance: 17,
  chaseHeight: 6.2,
  chaseSmooth: 4.5,
  // The cockpit camera sits just ahead of the propeller disc, looking
  // forward over the nose: the prop stays behind the lens, the way a
  // pilot sees it — a blur at the edge of vision, not a wall of blades.
  cockpitOffset: { forward: 5.2, up: 1.5 },

  // --- world: islands -----------------------------------------------------
  // Each island: centre, radius, peak height, and the terrain it flattens
  // around its airstrip (a flattened pad makes runways sit level).
  islands: [
    { name: 'Coral Main', x: 0, z: 0, radius: 980, peak: 255, strip: 'main' },
    { name: 'Palm North', x: -1350, z: 1080, radius: 430, peak: 150, strip: 'north' },
    { name: 'Turtle East', x: 1280, z: -980, radius: 390, peak: 130, strip: 'east' },
    { name: 'Gull Rock', x: -700, z: -1250, radius: 190, peak: 70, strip: null },
    { name: 'Sand Cay', x: 1050, z: 1250, radius: 170, peak: 26, strip: null },
    { name: 'Kite Reef', x: -1650, z: -350, radius: 150, peak: 40, strip: null },
  ],

  // Airstrips: centre, heading (deg, 0 = north / -z), length, width, pad
  // height above sea level. The terrain is flattened to the pad height.
  strips: {
    main: { x: 0, z: -40, heading: 90, length: 560, width: 36, padHeight: 10, name: 'Coral Field' },
    north: { x: -1350, z: 1080, heading: 0, length: 380, width: 30, padHeight: 12, name: 'Palm North' },
    east: { x: 1280, z: -980, heading: 90, length: 360, width: 30, padHeight: 11, name: 'Turtle East' },
  },

  // --- missions -----------------------------------------------------------
  missions: [
    {
      id: 'ring-run',
      name: 'Ring Run',
      blurb: 'Thread all six sky rings, then put her down on Coral Field.',
      kind: 'rings',
      rings: [
        { x: 700, z: -350, y: 110 },
        { x: 980, z: -700, y: 120 },
        { x: 1280, z: -980, y: 90 },
        { x: 300, z: -1350, y: 140 },
        { x: -700, z: -1250, y: 110 },
        { x: -1350, z: 1080, y: 100 },
      ],
      finishStrip: 'main',
    },
    {
      id: 'island-hop',
      name: 'Island Hop',
      blurb: 'Land on every strip in the chain: Coral, Palm North, Turtle East.',
      kind: 'landings',
      stops: ['main', 'north', 'east'],
    },
    {
      id: 'free-flight',
      name: 'Free Flight',
      blurb: 'Rings keep coming. Fuel is the only clock. How many can you take?',
      kind: 'endless',
      rings: [
        { x: 700, z: -350, y: 110 },
        { x: 980, z: -700, y: 120 },
        { x: 1280, z: -980, y: 90 },
        { x: 300, z: -1350, y: 140 },
        { x: -700, z: -1250, y: 110 },
        { x: -1350, z: 1080, y: 100 },
      ],
    },
  ],

  // Deterministic screenshot poses. Each pose sets the aircraft state and
  // the mission, then the autopilot flies a fixed number of frames so the
  // picture is a real moment of the game, not a staged backdrop.
  shots: {
    cover: { mission: 'ring-run', pos: [520, 105, -310], heading: 75, pitch: -1, speed: 56, throttle: 0.68, gear: false, camera: 'chase', frames: 110 },
    rings: { mission: 'ring-run', pos: [820, 100, -580], heading: 53, pitch: 0, speed: 62, throttle: 0.75, gear: false, camera: 'chase', frames: 80 },
    landing: { mission: 'island-hop', pos: [560, 70, -40], heading: 270, pitch: -4, speed: 42, throttle: 0.34, gear: true, camera: 'chase', frames: 50 },
    cockpit: { mission: 'ring-run', pos: [430, 115, -290], heading: 78, pitch: -1, speed: 58, throttle: 0.7, gear: false, camera: 'cockpit', frames: 100 },
  },
};
