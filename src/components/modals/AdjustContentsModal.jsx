import { useState } from "react";
import { writeBatch } from "firebase/firestore";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import { calculateSpiritDensity, calculateDerivedValuesFromWeight } from "../../utils/helpers";

// --- AdjustContentsModal ---
export const AdjustContentsModal = ({ db, userId, appId, container, onClose, setErrorApp }) => {
  const [removalValue, setRemovalValue] = useState('');
  const [removalInputMethod, setRemovalInputMethod] = useState('weight');
  const [formError, setFormError] = useState('');

  const { currentFill = {} } = container;
  const { netWeightLbs = 0, proof = 0, wineGallons = 0, proofGallons = 0, productType = 'N/A' } = currentFill;
  const currentSpiritDensity = currentFill.spiritDensity || calculateSpiritDensity(proof);

  const handleAdjust = async () => {
      setFormError('');
      let netLbsToRemove = 0;
      const val = parseFloat(removalValue);

      if (isNaN(val) || val <= 0) { setFormError("Valid removal amount (>0) required."); return; }

      if (removalInputMethod === 'weight') {
          netLbsToRemove = val;
      } else if (removalInputMethod === 'wineGallons') {
          if (currentSpiritDensity === 0 && val > 0) { setFormError("Cannot calculate weight from WG: spirit density is zero."); return;}
          netLbsToRemove = val * currentSpiritDensity;
      } else if (removalInputMethod === 'proofGallons') {
          if (proof === 0 && val > 0) { setFormError("Cannot remove by PG if proof is 0."); return; }
          if (currentSpiritDensity === 0 && val > 0) { setFormError("Cannot calculate weight from PG: spirit density is zero."); return;}
          const wgToRemove = proof > 0 ? val / (proof / 100) : 0;
          netLbsToRemove = wgToRemove * currentSpiritDensity;
      }

      if (netLbsToRemove > netWeightLbs + 0.001) {
           setFormError(`Cannot remove > ${netWeightLbs.toFixed(2)} lbs (or its volumetric equivalent).`);
           return;
      }

      const batch = writeBatch(db);
      const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, container.id);
      const newGrossNum = (currentFill.grossWeightLbs || container.tareWeightLbs || 0) - netLbsToRemove;
      const finalCalcs = calculateDerivedValuesFromWeight(container.tareWeightLbs || 0, newGrossNum, proof);
      
      const wineGallonsRemoved = currentSpiritDensity > 0 ? netLbsToRemove / currentSpiritDensity : 0;
      const proofGallonsRemoved = wineGallonsRemoved * (proof / 100);

      batch.update(containerRef, {
          "currentFill.grossWeightLbs": finalCalcs.grossWeightLbs,
          "currentFill.netWeightLbs": finalCalcs.netWeightLbs,
          "currentFill.wineGallons": finalCalcs.wineGallons,
          "currentFill.proofGallons": finalCalcs.proofGallons,
      });

      const logData = { type: "SAMPLE_ADJUST", containerId: container.id, containerName: container.name, productType: productType, proof: proof, netWeightLbsChange: -netLbsToRemove, proofGallonsChange: -proofGallonsRemoved, notes: `Sample or tax adjustment via ${removalInputMethod}.`};
      const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
      batch.set(doc(logCollRef), {...logData, timestamp: serverTimestamp()});
      
      try { await batch.commit(); setErrorApp(''); onClose(); } catch (err) { console.error("Adjust error:", err); setFormError("Adjust failed: " + err.message); setErrorApp("Adjust failed.");}};

  return ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-xl mb-4 text-yellow-300">Sample/Adjust: {container.name}</h2><p className="text-sm text-gray-400 mb-1">({productType}) Available: {netWeightLbs.toFixed(2)} lbs / {wineGallons.toFixed(3)} WG</p>{formError && <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>}
  <div className="space-y-3">
      <div><label className="block text-sm font-medium text-gray-300 mb-1">Removal Method:</label><div className="flex space-x-3">
          {['weight', 'wineGallons', 'proofGallons'].map(method => (
              <label key={method} className="flex items-center space-x-1 text-sm text-gray-200">
                  <input type="radio" name="removalInputMethod" value={method} checked={removalInputMethod === method} onChange={() => setRemovalInputMethod(method)} className="form-radio h-4 w-4 text-yellow-500 border-gray-600 focus:ring-yellow-500"/>
                  <span>{method === 'weight' ? 'Weight (lbs)' : (method === 'wineGallons' ? 'Wine Gal' : 'Proof Gal')}</span>
              </label>))}
      </div></div>
      <input type="number" value={removalValue} onChange={(e) => setRemovalValue(e.target.value)} step="0.001" min="0" placeholder={`Amount to remove`} className="w-full bg-gray-700 p-2 rounded mt-1"/>
      <div className="flex justify-end space-x-3 pt-3"><button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button><button onClick={handleAdjust} className="bg-yellow-600 py-2 px-4 rounded">Confirm Removal</button></div>
  </div></div></div>);
};
