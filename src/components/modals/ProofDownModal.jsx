import { useState, useMemo } from "react";
import { writeBatch } from "firebase/firestore";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import { calculateSpiritDensity, calculateDerivedValuesFromWeight, calculateDerivedValuesFromWineGallons, calculateDerivedValuesFromProofGallons } from "../../utils/helpers";
import { CONTAINER_CAPACITIES_GALLONS, DENSITY_WATER_LBS_PER_GALLON } from "../../constants";

// --- ProofDownModal ---
export const ProofDownModal = ({ db, userId, appId, container, onClose, setErrorApp }) => {
  const [targetProof, setTargetProof] = useState('');
  const [formError, setFormError] = useState('');

  const { currentFill = {}, tareWeightLbs = 0 } = container;
  const { proof: initialProof = 0, proofGallons: initialProofGallons = 0, wineGallons: initialWineGallons = 0, productType = 'N/A' } = currentFill;

  const calculations = useMemo(() => {
      const newProof = parseFloat(targetProof);
      if (isNaN(newProof) || newProof <= 0 || newProof >= initialProof) {
          return { waterToAddGallons: 0, waterToAddLbs: 0, finalWineGallons: initialWineGallons, finalGrossWeight: 0, finalSpiritDensity: 0, isValid: false };
      }

      const finalWineGallons = initialProofGallons / (newProof / 100);
      const waterToAddGallons = finalWineGallons - initialWineGallons;
      const waterToAddLbs = waterToAddGallons * DENSITY_WATER_LBS_PER_GALLON;
      const finalNetWeight = (currentFill.netWeightLbs || 0) + waterToAddLbs;
      const finalGrossWeight = (tareWeightLbs || 0) + finalNetWeight;
      const finalSpiritDensity = calculateSpiritDensity(newProof);

      return { waterToAddGallons, waterToAddLbs, finalWineGallons, finalGrossWeight, finalSpiritDensity, isValid: true };
  }, [targetProof, initialProof, initialProofGallons, initialWineGallons, currentFill.netWeightLbs, tareWeightLbs]);

  const handleProofDown = async () => {
      setFormError('');
      const newProof = parseFloat(targetProof);

      if (!calculations.isValid) {
          setFormError(`Invalid target proof. Must be > 0 and less than the current proof of ${initialProof}.`);
          return;
      }
      const capacity = CONTAINER_CAPACITIES_GALLONS[container.type] || 0;
      if (capacity > 0 && calculations.finalWineGallons > capacity) {
          setFormError(`Resulting volume (${calculations.finalWineGallons.toFixed(2)} gal) exceeds container capacity (${capacity} gal).`);
          return;
      }

      const batch = writeBatch(db);
      const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, container.id);
      const updatedData = {
          "currentFill.proof": newProof,
          "currentFill.wineGallons": calculations.finalWineGallons,
          "currentFill.grossWeightLbs": calculations.finalGrossWeight,
          "currentFill.netWeightLbs": (currentFill.netWeightLbs || 0) + calculations.waterToAddLbs,
          "currentFill.spiritDensity": calculations.finalSpiritDensity,
      };
      batch.update(containerRef, updatedData);

      const logData = {
          type: "PROOF_DOWN",
          containerId: container.id,
          containerName: container.name,
          productType: productType,
          proof: newProof,
          netWeightLbsChange: calculations.waterToAddLbs,
          proofGallonsChange: 0,
          notes: `Proofed down from ${initialProof} to ${newProof}. Added ${calculations.waterToAddGallons.toFixed(3)} gal of water.`
      };
      const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
      batch.set(doc(logCollRef), { ...logData, timestamp: serverTimestamp() });

      try {
          await batch.commit();
          setErrorApp('');
          onClose();
      } catch (err) {
          console.error("Proof down error:", err);
          setFormError("Failed to save changes: " + err.message);
          setErrorApp("Proof down failed.");
      }
  };

  return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl mb-4 font-semibold text-cyan-300">Proof Down: {container.name}</h2>
              {formError && <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>}
              <div className="space-y-4">
                  <div className="text-sm text-gray-400">
                      <p><strong>Product:</strong> {productType}</p>
                      <p><strong>Current State:</strong> {initialWineGallons.toFixed(3)} WG @ {initialProof} Proof ({initialProofGallons.toFixed(3)} PG)</p>
                  </div>
                  <div>
                      <label htmlFor="targetProof" className="block text-sm font-medium text-gray-300">New Target Proof</label>
                      <input
                          type="number"
                          id="targetProof"
                          value={targetProof}
                          onChange={(e) => setTargetProof(e.target.value)}
                          placeholder={`Enter proof < ${initialProof}`}
                          className="w-full bg-gray-700 p-2 rounded mt-1"
                          step="0.1" min="0" max={initialProof > 0 ? initialProof - 0.1 : 0}
                      />
                  </div>
                  {calculations.isValid && (
                      <div className="bg-gray-700 p-3 rounded border border-gray-600 text-sm">
                          <h4 className="font-semibold text-gray-300 mb-2">Resulting Change:</h4>
                          <p><strong>Add Water:</strong> <span className="text-cyan-300">{calculations.waterToAddGallons.toFixed(3)} gal</span> ({calculations.waterToAddLbs.toFixed(2)} lbs)</p>
                          <hr className="my-2 border-gray-600" />
                          <p><strong>Final WG:</strong> {calculations.finalWineGallons.toFixed(3)} gal</p>
                          <p><strong>Final Gross Wt:</strong> {calculations.finalGrossWeight.toFixed(2)} lbs</p>
                          <p className="font-bold"><strong>Final Proof Gallons:</strong> {initialProofGallons.toFixed(3)} PG (Unchanged)</p>
                      </div>
                  )}
                  <div className="flex justify-end space-x-3 pt-3">
                      <button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button>
                      <button onClick={handleProofDown} disabled={!calculations.isValid} className="bg-cyan-600 py-2 px-4 rounded disabled:bg-cyan-800 disabled:cursor-not-allowed">Confirm Proof Down</button>
                  </div>
              </div>
          </div>
      </div>
  );
};