import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { TTB_TEMPERATURE_CORRECTIONS, DENSITY_ETHANOL_LBS_PER_GALLON, DENSITY_WATER_LBS_PER_GALLON } from '../constants';

// --- Helper Functions ---

// Get TTB temperature correction factor
export const getTTBTemperatureCorrection = (temperature, observedProof) => {
  // Round temperature to nearest even number (TTB table uses even temperatures)
  const roundedTemp = Math.round(temperature / 2) * 2;
  const roundedProof = Math.round(observedProof / 5) * 5; // Round to nearest 5
  
  // Get the correction table for this temperature
  const tempTable = TTB_TEMPERATURE_CORRECTIONS[roundedTemp];
  if (!tempTable) return 0; // No correction if temperature out of range
  
  // Get the correction factor for this proof
  const correction = tempTable[roundedProof];
  return correction || 0;
};

// Calculate true proof using TTB method
export const calculateTrueProof = (observedProof, temperature) => {
  const correction = getTTBTemperatureCorrection(temperature, observedProof);
  return observedProof + correction;
};

// Calculate proof gallons using TTB method
export const calculateProofGallonsTTB = (wineGallons, observedProof, temperature) => {
  const trueProof = calculateTrueProof(observedProof, temperature);
  return wineGallons * (trueProof / 100);
};

// TTB-compliant density calculation at 60°F
// Since Snap 51 provides temperature-corrected proof readings, we use the proof directly
export const calculateSpiritDensity = (proof, temperature = 60) => {
  if (isNaN(proof) || proof < 0) proof = 0;
  if (proof === 0) return DENSITY_WATER_LBS_PER_GALLON;
  
  // TTB density values for different proof levels at 60°F
  // These values are based on TTB Table 6 (Density of Alcohol-Water Mixtures)
  const densityTable = {
    0: 8.328,    // Water
    5: 8.30,
    10: 8.27,
    15: 8.23,
    20: 8.19,
    25: 8.14,
    30: 8.08,
    35: 8.02,
    40: 7.95,
    45: 7.88,
    50: 7.80,
    55: 7.71,
    60: 7.62,
    65: 7.52,
    70: 7.41,
    75: 7.29,
    80: 7.16,
    85: 7.02,
    90: 6.87,
    95: 6.71,
    100: 6.54,
    105: 6.36,
    110: 6.17,
    115: 5.97,
    120: 5.76,
    125: 5.54,
    130: 5.31,
    135: 5.07,
    140: 4.82,
    145: 4.56,
    150: 4.29,
    155: 4.01,
    160: 3.72,
    165: 3.42,
    170: 3.11,
    175: 2.79,
    180: 2.46,
    185: 2.12,
    190: 1.77,
    195: 1.41,
    200: 1.04  // Pure ethanol
  };
  
  // Round proof to nearest 5 for table lookup
  const roundedProof = Math.round(proof / 5) * 5;
  
  // If exact match, return that value
  if (densityTable[roundedProof] !== undefined) {
    return densityTable[roundedProof];
  }
  
  // For values between table entries, interpolate
  const lowerProof = Math.floor(proof / 5) * 5;
  const upperProof = Math.ceil(proof / 5) * 5;
  
  if (densityTable[lowerProof] !== undefined && densityTable[upperProof] !== undefined) {
    const weight = (proof - lowerProof) / 5;
    return densityTable[lowerProof] + (densityTable[upperProof] - densityTable[lowerProof]) * weight;
  }
  
  // Fallback to linear calculation for extreme values
  const volEthanolFraction = proof / 200;
  const volWaterFraction = 1 - volEthanolFraction;
  return (volEthanolFraction * DENSITY_ETHANOL_LBS_PER_GALLON) + (volWaterFraction * DENSITY_WATER_LBS_PER_GALLON);
};

// Calculate derived values from weight - using temperature-corrected proof from Snap 51
export const calculateDerivedValuesFromWeight = (tareWeight, grossWeight, observedProof, temperature = 60) => {
  const tare = parseFloat(tareWeight) || 0;
  const gross = parseFloat(grossWeight) || 0;
  const prf = parseFloat(observedProof) || 0;
  let netWeightLbs = 0;
  if (gross > tare) { netWeightLbs = gross - tare; } else { netWeightLbs = 0; }
  
  // Since Snap 51 provides temperature-corrected proof, use it directly for density calculation
  const spiritDensity = calculateSpiritDensity(prf, 60); // Always use 60°F for TTB standard
  let wineGallons = 0;
  if (netWeightLbs > 0 && spiritDensity > 0) { wineGallons = netWeightLbs / spiritDensity; }
  
  // For proof gallons, use the temperature-corrected proof directly (no additional correction needed)
  const proofGallons = wineGallons * (prf / 100);
  
  return {
      netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
      wineGallons: parseFloat(wineGallons.toFixed(2)),
      proofGallons: parseFloat(proofGallons.toFixed(2)),
      spiritDensity: parseFloat(spiritDensity.toFixed(2)),
      grossWeightLbs: parseFloat(gross.toFixed(2))
  };
};

export const calculateDerivedValuesFromWineGallons = (wineGallons, observedProof, tareWeight, temperature = 68) => {
  const wg = parseFloat(wineGallons) || 0;
  const prf = parseFloat(observedProof) || 0;
  const tare = parseFloat(tareWeight) || 0;
  const spiritDensity = calculateSpiritDensity(prf, temperature);
  const netWeightLbs = wg * spiritDensity;
  const grossWeightLbs = netWeightLbs + tare;
  
  // Calculate proof gallons using TTB method
  const proofGallons = calculateProofGallonsTTB(wg, prf, temperature);
  
  return {
      netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
      wineGallons: parseFloat(wg.toFixed(2)),
      proofGallons: parseFloat(proofGallons.toFixed(2)),
      spiritDensity: parseFloat(spiritDensity.toFixed(2)),
      grossWeightLbs: parseFloat(grossWeightLbs.toFixed(2))
  };
};

export const calculateDerivedValuesFromProofGallons = (proofGallons, observedProof, tareWeight, temperature = 68) => {
  const pg = parseFloat(proofGallons) || 0;
  const prf = parseFloat(observedProof) || 0;
  const tare = parseFloat(tareWeight) || 0;
  
  // For proof gallons input, we need to work backwards to find wine gallons
  let wineGallons = 0;
  if (prf > 0 && pg > 0) {
      // Use the true proof to calculate wine gallons
      const trueProof = calculateTrueProof(prf, temperature);
      wineGallons = pg / (trueProof / 100);
  } else if (pg === 0) {
      wineGallons = 0;
  } else if (prf === 0) {
      // If proof is 0, we can't calculate wine gallons from proof gallons
      wineGallons = 0;
  }
  
  const spiritDensity = calculateSpiritDensity(prf, temperature);
  const netWeightLbs = wineGallons * spiritDensity;
  const grossWeightLbs = netWeightLbs + tare;
  
  return {
      netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
      wineGallons: parseFloat(wineGallons.toFixed(2)),
      proofGallons: parseFloat(pg.toFixed(2)),
      spiritDensity: parseFloat(spiritDensity.toFixed(2)),
      grossWeightLbs: parseFloat(grossWeightLbs.toFixed(2))
  };
};

export const logTransaction = async (db, userId, appId, logData) => {
  if (!db || !userId || !appId) { console.error("DB, UserID, or AppID missing for logging."); return; }
  const logPath = `artifacts/${appId}/users/${userId}/transactionLog`;
  try { await addDoc(collection(db, logPath), { ...logData, timestamp: serverTimestamp() }); console.log("Transaction logged:", logData.type); }
  catch (error) { console.error("Error logging transaction:", error, logData); }
};

export const convertToCSV = (dataArray, headers) => {
  const array = [headers, ...dataArray];
  return array.map(row => row.map(field => { const data = field === null || field === undefined ? '' : String(field); const result = data.replace(/"/g, '""'); if (result.search(/("|,|\n)/g) >= 0) return `"${result}"`; return result; }).join(',')).join('\n');
};

export const downloadCSV = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};