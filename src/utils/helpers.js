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
  // These values are based on TTB Table 4 (Gallons per pound) converted to density
  const densityTable = {
    0: 8.345,    // Water
    10: 8.268,   // TTB Table 4: 0.12095 gal/lb
    20: 8.194,   // TTB Table 4: 0.12204 gal/lb
    30: 8.115,   // TTB Table 4: 0.12322 gal/lb
    40: 8.040,   // TTB Table 4: 0.12437 gal/lb
    50: 7.968,   // TTB Table 4: 0.12550 gal/lb
    60: 7.892,   // TTB Table 4: 0.12671 gal/lb
    70: 7.820,   // TTB Table 4: 0.12788 gal/lb
    80: 7.748,   // TTB Table 4: 0.12907 gal/lb
    90: 7.676,   // TTB Table 4: 0.13027 gal/lb
    100: 7.607,  // TTB Table 4: 0.13148 gal/lb
    110: 7.536,  // TTB Table 4: 0.13270 gal/lb
    120: 7.464,  // TTB Table 4: 0.13393 gal/lb
    130: 7.392,  // TTB Table 4: 0.13517 gal/lb
    140: 7.320,  // TTB Table 4: 0.13642 gal/lb
    150: 7.248,  // TTB Table 4: 0.13768 gal/lb
    160: 7.176,  // TTB Table 4: 0.13895 gal/lb
    170: 7.104,  // TTB Table 4: 0.14023 gal/lb
    180: 7.032,  // TTB Table 4: 0.14152 gal/lb
    190: 6.960,  // TTB Table 4: 0.14282 gal/lb
    200: 6.888   // Pure ethanol (TTB Table 4: 0.14413 gal/lb)
  };
  
  // For 99.9 proof, use the exact TTB value you provided
  if (proof >= 99.5 && proof <= 100.5) {
    // Interpolate between 99 and 100 proof values
    const proof99 = 7.63066; 
    const proof100 = 7.610053;
    const weight = (proof - 99) / 1;
    return proof99 + (proof100 - proof99) * weight;
  }
  
  // Round proof to nearest 10 for table lookup
  const roundedProof = Math.round(proof / 10) * 10;
  
  // If exact match, return that value
  if (densityTable[roundedProof] !== undefined) {
    return densityTable[roundedProof];
  }
  
  // For values between table entries, interpolate
  const lowerProof = Math.floor(proof / 10) * 10;
  const upperProof = Math.ceil(proof / 10) * 10;
  
  if (densityTable[lowerProof] !== undefined && densityTable[upperProof] !== undefined) {
    const weight = (proof - lowerProof) / 10;
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

export const calculateDerivedValuesFromWineGallons = (wineGallons, observedProof, tareWeight, temperature = 60) => {
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

export const calculateDerivedValuesFromProofGallons = (proofGallons, observedProof, tareWeight, temperature = 60) => {
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