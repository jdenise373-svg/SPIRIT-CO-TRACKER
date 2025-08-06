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

// Legacy density-based calculation (keeping for backward compatibility)
export const calculateSpiritDensity = (proof, temperature = 20) => {
  if (isNaN(proof) || proof < 0) proof = 0;
  if (proof === 0) return DENSITY_WATER_LBS_PER_GALLON;
  
  const volEthanolFraction = proof / 200;
  const volWaterFraction = 1 - volEthanolFraction;
  const baseDensity = (volEthanolFraction * DENSITY_ETHANOL_LBS_PER_GALLON) + (volWaterFraction * DENSITY_WATER_LBS_PER_GALLON);
  
  return baseDensity;
};

export const calculateDerivedValuesFromWeight = (tareWeight, grossWeight, observedProof, temperature = 68) => {
  const tare = parseFloat(tareWeight) || 0;
  const gross = parseFloat(grossWeight) || 0;
  const prf = parseFloat(observedProof) || 0;
  let netWeightLbs = 0;
  if (gross > tare) { netWeightLbs = gross - tare; } else { netWeightLbs = 0; }
  
  // Use TTB method for proof gallons calculation
  const spiritDensity = calculateSpiritDensity(prf, temperature);
  let wineGallons = 0;
  if (netWeightLbs > 0 && spiritDensity > 0) { wineGallons = netWeightLbs / spiritDensity; }
  
  // Calculate proof gallons using TTB method
  const proofGallons = calculateProofGallonsTTB(wineGallons, prf, temperature);
  
  return {
      netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
      wineGallons: parseFloat(wineGallons.toFixed(3)),
      proofGallons: parseFloat(proofGallons.toFixed(3)),
      spiritDensity: parseFloat(spiritDensity.toFixed(3)),
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
      wineGallons: parseFloat(wg.toFixed(3)),
      proofGallons: parseFloat(proofGallons.toFixed(3)),
      spiritDensity: parseFloat(spiritDensity.toFixed(3)),
      grossWeightLbs: parseFloat(grossWeightLbs.toFixed(2))
  };
};

export const calculateDerivedValuesFromProofGallons = (proofGallons, observedProof, tareWeight, temperature = 68) => {
  const pg = parseFloat(proofGallons) || 0;
  const prf = parseFloat(observedProof) || 0;
  const tare = parseFloat(tareWeight) || 0;
  
  // For proof gallons input, we need to work backwards to find wine gallons
  // This is more complex with TTB method, so we'll use an approximation
  let wineGallons = 0;
  if (prf > 0 && pg > 0) {
      // Use the true proof to calculate wine gallons
      const trueProof = calculateTrueProof(prf, temperature);
      wineGallons = pg / (trueProof / 100);
  } else if (pg === 0) {
      wineGallons = 0;
  } else {
      wineGallons = 0;
  }
  
  const spiritDensity = calculateSpiritDensity(prf, temperature);
  const netWeightLbs = wineGallons * spiritDensity;
  const grossWeightLbs = netWeightLbs + tare;
  return {
      netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
      wineGallons: parseFloat(wineGallons.toFixed(3)),
      proofGallons: parseFloat(pg.toFixed(3)),
      spiritDensity: parseFloat(spiritDensity.toFixed(3)),
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