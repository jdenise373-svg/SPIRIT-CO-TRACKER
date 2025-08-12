import { useState, useEffect } from "react";
import { writeBatch } from "firebase/firestore";
import { doc } from "firebase/firestore";
import {
  calculateSpiritDensity,
  calculateDerivedValuesFromWeight,
  calculateDerivedValuesFromWineGallons,
  calculateDerivedValuesFromProofGallons,
  logTransaction,
} from "../../utils/helpers";

// --- TransferModal ---
export const TransferModal = ({
  db,
  userId,
  appId,
  sourceContainer,
  allContainers,
  onClose,
  setErrorApp,
}) => {
  const [destinationId, setDestinationId] = useState("");
  const [transferUnit, setTransferUnit] = useState("weight"); // "weight", "wineGallons", "proofGallons"
  const [transferWeightNet, setTransferWeightNet] = useState("");
  const [transferWineGallons, setTransferWineGallons] = useState("");
  const [transferProofGallons, setTransferProofGallons] = useState("");
  const [transferAll, setTransferAll] = useState(false);
  const [formError, setFormError] = useState("");
  
  const availableDestinations = allContainers.filter(
    (c) => c.id !== sourceContainer.id && c.status === "empty"
  );
  const sourceMaxNet = sourceContainer.currentFill?.netWeightLbs || 0;
  const sourceMaxWineGallons = sourceContainer.currentFill?.wineGallons || 0;
  const sourceMaxProofGallons = sourceContainer.currentFill?.proofGallons || 0;
  const sourceProof = sourceContainer.currentFill?.proof || 0;
  const sourceProductType =
    sourceContainer.currentFill?.productType || "Unspecified Spirit";

  useEffect(() => {
    if (transferAll) {
      if (transferUnit === "weight") {
        setTransferWeightNet(sourceMaxNet.toString());
      } else if (transferUnit === "wineGallons") {
        setTransferWineGallons(sourceMaxWineGallons.toString());
      } else if (transferUnit === "proofGallons") {
        setTransferProofGallons(sourceMaxProofGallons.toString());
      }
    }
  }, [transferAll, transferUnit, sourceMaxNet, sourceMaxWineGallons, sourceMaxProofGallons]);

  const handleTransfer = async () => {
    setFormError("");
    
    let netToTransfer = 0;
    let transferValue = 0;
    
    // Validate transfer value based on selected unit
    if (transferUnit === "weight") {
      transferValue = parseFloat(transferWeightNet);
      if (isNaN(transferValue) || transferValue <= 0) {
        setFormError("Valid transfer weight required.");
        return;
      }
      if (transferValue > sourceMaxNet + 0.001) {
        setFormError(`Cannot transfer > ${sourceMaxNet.toFixed(2)} lbs.`);
        return;
      }
      netToTransfer = transferValue;
    } else if (transferUnit === "wineGallons") {
      transferValue = parseFloat(transferWineGallons);
      if (isNaN(transferValue) || transferValue <= 0) {
        setFormError("Valid transfer wine gallons required.");
        return;
      }
      if (transferValue > sourceMaxWineGallons + 0.001) {
        setFormError(`Cannot transfer > ${sourceMaxWineGallons.toFixed(2)} wine gallons.`);
        return;
      }
      if (sourceProof <= 0) {
        setFormError("Cannot transfer by wine gallons when proof is 0 or undefined.");
        return;
      }
      // Use helper function to convert wine gallons to net weight
      const wineGalCalcs = calculateDerivedValuesFromWineGallons(transferValue, sourceProof, 0);
      netToTransfer = wineGalCalcs.netWeightLbs;
    } else if (transferUnit === "proofGallons") {
      transferValue = parseFloat(transferProofGallons);
      if (isNaN(transferValue) || transferValue <= 0) {
        setFormError("Valid transfer proof gallons required.");
        return;
      }
      if (transferValue > sourceMaxProofGallons + 0.001) {
        setFormError(`Cannot transfer > ${sourceMaxProofGallons.toFixed(2)} proof gallons.`);
        return;
      }
      if (sourceProof <= 0) {
        setFormError("Cannot transfer by proof gallons when proof is 0 or undefined.");
        return;
      }
      // Use helper function to convert proof gallons to net weight
      const proofGalCalcs = calculateDerivedValuesFromProofGallons(transferValue, sourceProof, 0);
      netToTransfer = proofGalCalcs.netWeightLbs;
    }

    if (!destinationId) {
      setFormError("Select destination.");
      return;
    }

    const destContainerData = allContainers.find((c) => c.id === destinationId);
    if (!destContainerData || destContainerData.status !== "empty") {
      setFormError("Invalid destination.");
      return;
    }

    try {
      const batch = writeBatch(db);
      const sourceRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/spiritInventory`,
        sourceContainer.id
      );
      const destRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/spiritInventory`,
        destinationId
      );
      
      const sourceSpiritDensity = calculateSpiritDensity(sourceProof);
      const wgTransferred =
        sourceSpiritDensity > 0 ? netToTransfer / sourceSpiritDensity : 0;
      const pgTransferred = wgTransferred * (sourceProof / 100);

      const newSrcGrossNum =
        (parseFloat(sourceContainer.currentFill.grossWeightLbs) ||
          parseFloat(sourceContainer.tareWeightLbs) ||
          0) - netToTransfer;
      const srcCalcs = calculateDerivedValuesFromWeight(
        parseFloat(sourceContainer.tareWeightLbs) || 0,
        newSrcGrossNum,
        sourceProof
      );
      let srcStatus = "filled",
        srcEmptiedDate = null,
        finalSrcProof = sourceProof;
      if (srcCalcs.netWeightLbs <= 0.001) {
        srcStatus = "empty";
        srcEmptiedDate = new Date().toISOString().split("T")[0];
        finalSrcProof = 0;
        Object.assign(
          srcCalcs,
          calculateDerivedValuesFromWeight(
            parseFloat(sourceContainer.tareWeightLbs) || 0,
            parseFloat(sourceContainer.tareWeightLbs) || 0,
            0
          )
        );
      }

      batch.update(sourceRef, {
        status: srcStatus,
        "currentFill.grossWeightLbs": srcCalcs.grossWeightLbs,
        "currentFill.proof": finalSrcProof,
        "currentFill.netWeightLbs": srcCalcs.netWeightLbs,
        "currentFill.wineGallons": srcCalcs.wineGallons,
        "currentFill.proofGallons": srcCalcs.proofGallons,
        "currentFill.emptiedDate": srcEmptiedDate,
        "currentFill.spiritDensity": srcCalcs.spiritDensity,
      });
      
      logTransaction(db, userId, appId, {
        type: "TRANSFER_OUT",
        containerId: sourceContainer.id,
        containerName: sourceContainer.name,
        productType: sourceProductType,
        proof: sourceProof,
        netWeightLbsChange: -netToTransfer,
        proofGallonsChange: -pgTransferred,
        destinationContainerId: destinationId,
        destinationContainerName: destContainerData.name,
        notes: `To ${destContainerData.name}`,
      });

      const newDestGrossNum =
        (parseFloat(destContainerData.tareWeightLbs) || 0) + netToTransfer;
      const destCalcs = calculateDerivedValuesFromWeight(
        parseFloat(destContainerData.tareWeightLbs) || 0,
        newDestGrossNum,
        sourceProof
      );
      batch.update(destRef, {
        status: "filled",
        "currentFill.productType": sourceProductType,
        "currentFill.fillDate": new Date().toISOString().split("T")[0],
        "currentFill.grossWeightLbs": destCalcs.grossWeightLbs,
        "currentFill.proof": sourceProof,
        "currentFill.netWeightLbs": destCalcs.netWeightLbs,
        "currentFill.wineGallons": destCalcs.wineGallons,
        "currentFill.proofGallons": destCalcs.proofGallons,
        "currentFill.spiritDensity": destCalcs.spiritDensity,
        "currentFill.account":
          sourceContainer.currentFill?.account || "storage",
        "currentFill.emptiedDate": null,
      });
      
      logTransaction(db, userId, appId, {
        type: "TRANSFER_IN",
        containerId: destinationId,
        containerName: destContainerData.name,
        productType: sourceProductType,
        proof: sourceProof,
        netWeightLbsChange: netToTransfer,
        proofGallonsChange: pgTransferred,
        sourceContainerId: sourceContainer.id,
        sourceContainerName: sourceContainer.name,
        notes: `From ${sourceContainer.name}`,
      });

      await batch.commit();
      setErrorApp("");
      onClose();
    } catch (err) {
      console.error("Transfer error: ", err);
      setFormError("Transfer failed: " + err.message);
      setErrorApp("Transfer failed.");
    }
  };

  const handleTransferUnitChange = (unit) => {
    setTransferUnit(unit);
    // Clear other input fields when switching units
    if (unit === "weight") {
      setTransferWineGallons("");
      setTransferProofGallons("");
    } else if (unit === "wineGallons") {
      setTransferWeightNet("");
      setTransferProofGallons("");
    } else if (unit === "proofGallons") {
      setTransferWeightNet("");
      setTransferWineGallons("");
    }
    if (transferAll) setTransferAll(false);
  };

  // Calculate what the transfer will actually transfer based on current input
  const getTransferPreview = () => {
    if (!destinationId) return null;
    
    let netWeight = 0;
    let wineGallons = 0;
    let proofGallons = 0;
    
    if (transferUnit === "weight" && transferWeightNet) {
      netWeight = parseFloat(transferWeightNet);
      const spiritDensity = calculateSpiritDensity(sourceProof);
      wineGallons = spiritDensity > 0 ? netWeight / spiritDensity : 0;
      proofGallons = wineGallons * (sourceProof / 100);
    } else if (transferUnit === "wineGallons" && transferWineGallons) {
      wineGallons = parseFloat(transferWineGallons);
      const calcs = calculateDerivedValuesFromWineGallons(wineGallons, sourceProof, 0);
      netWeight = calcs.netWeightLbs;
      proofGallons = calcs.proofGallons;
    } else if (transferUnit === "proofGallons" && transferProofGallons) {
      proofGallons = parseFloat(transferProofGallons);
      const calcs = calculateDerivedValuesFromProofGallons(proofGallons, sourceProof, 0);
      netWeight = calcs.netWeightLbs;
      wineGallons = calcs.wineGallons;
    }
    
    return { netWeight, wineGallons, proofGallons };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-blue-300">
          Transfer From: {sourceContainer.name}
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          ({sourceProductType}) Available: {sourceMaxNet.toFixed(2)} lbs, {sourceMaxWineGallons.toFixed(2)} wine gal, {sourceMaxProofGallons.toFixed(2)} proof gal at {sourceProof} proof.
        </p>
        {formError && (
          <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>
        )}
        <div className="space-y-4">
          <select
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
            className="w-full bg-gray-700 p-2 rounded mt-1"
          >
            <option value="">-- Select Empty Destination --</option>
            {availableDestinations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Tare: {c.tareWeightLbs} lbs)
              </option>
            ))}
          </select>

          {/* Transfer Unit Selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Transfer by:</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="transferUnit"
                  value="weight"
                  checked={transferUnit === "weight"}
                  onChange={(e) => handleTransferUnitChange(e.target.value)}
                  className="mr-2 h-4 w-4 text-blue-500 border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">Weight (lbs)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="transferUnit"
                  value="wineGallons"
                  checked={transferUnit === "wineGallons"}
                  onChange={(e) => handleTransferUnitChange(e.target.value)}
                  className="mr-2 h-4 w-4 text-blue-500 border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">Wine Gal</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="transferUnit"
                  value="proofGallons"
                  checked={transferUnit === "proofGallons"}
                  onChange={(e) => handleTransferUnitChange(e.target.value)}
                  className="mr-2 h-4 w-4 text-blue-500 border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">Proof Gal</span>
              </label>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <p>• <strong>Weight:</strong> Direct net weight transfer in pounds</p>
              <p>• <strong>Wine Gal:</strong> Volume-based transfer (accounts for proof)</p>
              <p>• <strong>Proof Gal:</strong> Standard proof gallon measurement</p>
            </div>
          </div>

          {/* Weight Input */}
          {transferUnit === "weight" && (
            <input
              type="number"
              value={transferWeightNet}
              onChange={(e) => {
                setTransferWeightNet(e.target.value);
                if (transferAll) setTransferAll(false);
              }}
              disabled={transferAll}
              step="0.01"
              min="0.01"
              placeholder="Net Lbs to Transfer"
              className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600"
            />
          )}

          {/* Wine Gallons Input */}
          {transferUnit === "wineGallons" && (
            <input
              type="number"
              value={transferWineGallons}
              onChange={(e) => {
                setTransferWineGallons(e.target.value);
                if (transferAll) setTransferAll(false);
              }}
              disabled={transferAll}
              step="0.01"
              min="0.01"
              placeholder="Wine Gallons to Transfer"
              className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600"
            />
          )}

          {/* Proof Gallons Input */}
          {transferUnit === "proofGallons" && (
            <input
              type="number"
              value={transferProofGallons}
              onChange={(e) => {
                setTransferProofGallons(e.target.value);
                if (transferAll) setTransferAll(false);
              }}
              disabled={transferAll}
              step="0.01"
              min="0.01"
              placeholder="Proof Gallons to Transfer"
              className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600"
            />
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="transferAll"
              checked={transferAll}
              onChange={(e) => setTransferAll(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-500 border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="transferAll" className="text-sm text-gray-300">
              Transfer All
            </label>
          </div>

          {/* Transfer Preview */}
          {getTransferPreview() && (
            <div className="bg-gray-750 p-3 rounded border border-gray-600">
              <h4 className="text-sm font-semibold mb-2 text-blue-300">Transfer Preview:</h4>
              <div className="text-sm space-y-1">
                <p>Net Weight: {getTransferPreview().netWeight.toFixed(2)} lbs</p>
                <p>Wine Gallons: {getTransferPreview().wineGallons.toFixed(3)} gal</p>
                <p>Proof Gallons: {getTransferPreview().proofGallons.toFixed(3)} PG</p>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              className="bg-purple-600 py-2 px-4 rounded"
            >
              Confirm Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
