// TTB Table 4 values (gallons per pound) converted to density (lbs per gallon)
const ttbTable4 = {
  0: 0.11983,   // Water
  10: 0.12095,
  20: 0.12208,
  30: 0.12322,
  40: 0.12437,
  50: 0.12553,
  60: 0.12670,
  70: 0.12788,
  80: 0.12907,
  90: 0.13027,
  100: 0.13148,
  110: 0.13270,
  120: 0.13393,
  130: 0.13517,
  140: 0.13642,
  150: 0.13768,
  160: 0.13895,
  170: 0.14023,
  180: 0.14152,
  190: 0.14282,
  200: 0.14413  // Pure ethanol
};

console.log('TTB Table 4 Density Values (lbs per gallon):');
for (let proof = 0; proof <= 200; proof += 10) {
  const gallonsPerPound = ttbTable4[proof];
  const density = 1 / gallonsPerPound;
  console.log(`${proof}: ${density.toFixed(4)},`);
}

console.log('\nFor 99.9 proof (interpolated):');
const proof99 = 0.12852; // From your TTB data
const density99 = 1 / proof99;
console.log(`99.9 proof: ${density99.toFixed(4)} lbs/gallon`);