import { useState } from "react";
import { writeBatch } from "firebase/firestore";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import {
  calculateSpiritDensity,
  calculateDerivedValuesFromWeight,
} from "../../utils/helpers";
import { TRANSACTION_TYPES } from "../../constants";

// --- AdjustContentsModal ---
export const AdjustContentsModal = ({
  db,
  userId,
  appId,
  container,
  onClose,
  setErrorApp,
}) => {
  const [removalValue, setRemovalValue] = useState("");
  const [removalInputMethod, setRemovalInputMethod] = useState("weight");
  const [isAddition, setIsAddition] = useState(false);
  const [formError, setFormError] = useState("");

  const { currentFill = {} } = container;
  const {
    netWeightLbs = 0,
    proof = 0,
    wineGallons = 0,
    proofGallons = 0,
    productType = "N/A",
  } = currentFill;
  const currentSpiritDensity =
    currentFill.spiritDensity || calculateSpiritDensity(proof);

  const handleAdjust = async () => {
    setFormError("");
    let netLbsToAdjust = 0;
    const val = parseFloat(removalValue);

    if (isNaN(val) || val <= 0) {
      setFormError("Valid adjustment amount (>0) required.");
      return;
    }

    if (removalInputMethod === "weight") {
      netLbsToAdjust = val;
    } else if (removalInputMethod === "wineGallons") {
      if (currentSpiritDensity === 0 && val > 0) {
        setFormError(
          "Cannot calculate weight from WG: spirit density is zero."
        );
        return;
      }
      netLbsToAdjust = val * currentSpiritDensity;
    } else if (removalInputMethod === "proofGallons") {
      if (proof === 0 && val > 0) {
        setFormError("Cannot adjust by PG if proof is 0.");
        return;
      }
      if (currentSpiritDensity === 0 && val > 0) {
        setFormError(
          "Cannot calculate weight from PG: spirit density is zero."
        );
        return;
      }
      const wgToAdjust = proof > 0 ? val / (proof / 100) : 0;
      netLbsToAdjust = wgToAdjust * currentSpiritDensity;
    }

    // For removal, check if we have enough to remove
    if (!isAddition && netLbsToAdjust > netWeightLbs + 0.001) {
      setFormError(
        `Cannot remove > ${netWeightLbs.toFixed(
          2
        )} lbs (or its volumetric equivalent).`
      );
      return;
    }

    const batch = writeBatch(db);
    const containerRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/spiritInventory`,
      container.id
    );
    
    // Apply the adjustment (add or subtract)
    const adjustmentMultiplier = isAddition ? 1 : -1;
    const newGrossNum =
      (currentFill.grossWeightLbs || container.tareWeightLbs || 0) +
      (adjustmentMultiplier * netLbsToAdjust);
      
    const finalCalcs = calculateDerivedValuesFromWeight(
      container.tareWeightLbs || 0,
      newGrossNum,
      proof
    );

    const wineGallonsAdjusted =
      currentSpiritDensity > 0 ? netLbsToAdjust / currentSpiritDensity : 0;
    const proofGallonsAdjusted = wineGallonsAdjusted * (proof / 100);

    batch.update(containerRef, {
      "currentFill.grossWeightLbs": finalCalcs.grossWeightLbs,
      "currentFill.netWeightLbs": finalCalcs.netWeightLbs,
      "currentFill.wineGallons": finalCalcs.wineGallons,
      "currentFill.proofGallons": finalCalcs.proofGallons,
    });

    const logData = {
      type: TRANSACTION_TYPES.SAMPLE_ADJUST,
      containerId: container.id,
      containerName: container.name,
      productType: productType,
      proof: proof,
      netWeightLbsChange: adjustmentMultiplier * netLbsToAdjust,
      proofGallonsChange: adjustmentMultiplier * proofGallonsAdjusted,
      notes: `${isAddition ? 'Addition' : 'Sample or tax adjustment'} via ${removalInputMethod}.`,
    };
    const logCollRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/transactionLog`
    );
    batch.set(doc(logCollRef), { ...logData, timestamp: serverTimestamp() });

    try {
      await batch.commit();
      setErrorApp("");
      onClose();
    } catch (err) {
      console.error("Adjust error:", err);
      setFormError("Adjust failed: " + err.message);
      setErrorApp("Adjust failed.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl mb-4 text-yellow-300">
          Sample/Adjust: {container.name}
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          ({productType}) Available: {netWeightLbs.toFixed(2)} lbs /{" "}
          {wineGallons.toFixed(3)} WG
        </p>
        {formError && (
          <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Adjustment Type:
            </label>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={isAddition}
                  onChange={(e) => setIsAddition(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-yellow-500 border-gray-600 focus:ring-yellow-500"
                />
                <span>Add to container (uncheck for removal)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Adjustment Method:
            </label>
            <div className="flex space-x-3">
              {["weight", "wineGallons", "proofGallons"].map((method) => (
                <label
                  key={method}
                  className="flex items-center space-x-1 text-sm text-gray-200"
                >
                  <input
                    type="radio"
                    name="removalInputMethod"
                    value={method}
                    checked={removalInputMethod === method}
                    onChange={() => setRemovalInputMethod(method)}
                    className="form-radio h-4 w-4 text-yellow-500 border-gray-600 focus:ring-yellow-500"
                  />
                  <span>
                    {method === "weight"
                      ? "Weight (lbs)"
                      : method === "wineGallons"
                      ? "Wine Gal"
                      : "Proof Gal"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <input
            type="number"
            value={removalValue}
            onChange={(e) => setRemovalValue(e.target.value)}
            step="0.001"
            min="0"
            placeholder={`Amount to ${isAddition ? 'add' : 'remove'}`}
            className="w-full bg-gray-700 p-2 rounded mt-1"
          />
          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjust}
              className="bg-yellow-600 py-2 px-4 rounded"
            >
              Confirm {isAddition ? 'Addition' : 'Removal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
