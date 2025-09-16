const DENSITY_ETHANOL_LBS_PER_GALLON = 6.58;
const DENSITY_WATER_LBS_PER_GALLON = 8.328;

function calculateSpiritDensity(proof) {
  if (isNaN(proof) || proof < 0) proof = 0;
  if (proof === 0) return DENSITY_WATER_LBS_PER_GALLON;
  
  const volEthanolFraction = proof / 200;
  const volWaterFraction = 1 - volEthanolFraction;
  const baseDensity = (volEthanolFraction * DENSITY_ETHANOL_LBS_PER_GALLON) + (volWaterFraction * DENSITY_WATER_LBS_PER_GALLON);
  
  return baseDensity;
}

console.log('Current calculation for 99.9 proof:');
console.log('Density:', calculateSpiritDensity(99.9), 'lbs/gallon');
console.log('Wine gallons (311 lbs):', 311 / calculateSpiritDensity(99.9));
console.log('Proof gallons:', (311 / calculateSpiritDensity(99.9)) * (99.9/100));