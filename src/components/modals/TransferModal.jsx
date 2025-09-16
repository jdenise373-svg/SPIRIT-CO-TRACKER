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
import { TRANSACTION_TYPES } from "../../constants";
import Button from "../ui/Button";

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
  const [isTransferring, setIsTransferring] = useState(false);

  const sourceMaxNet = sourceContainer.currentFill?.netWeightLbs || 0;
  const sourceMaxWineGallons = sourceContainer.currentFill?.wineGallons || 0;
  const sourceMaxProofGallons = sourceContainer.currentFill?.proofGallons || 0;
  const sourceProof = sourceContainer.currentFill?.proof || 0;
  const sourceProductType =
    sourceContainer.currentFill?.productType || "Unspecified Spirit";

  // Modified to allow both empty containers and filled containers with same spirit type
  const availableDestinations = allContainers.filter((c) => {
    if (c.id === sourceContainer.id) return false;

    // Allow empty containers
    if (c.status === "empty") return true;

    // Allow filled containers with the same spirit type for combining
    if (
      c.status === "filled" &&
      c.currentFill?.productType === sourceProductType &&
      c.currentFill?.productType !== "Unspecified Spirit"
    ) {
      return true;
    }

    return false;
  });

  // Helper function to calculate combined proof when combining spirits
  const calculateCombinedProof = (proof1, weight1, proof2, weight2) => {
    if (weight1 <= 0 || weight2 <= 0) return proof1 || proof2 || 0;
    return (proof1 * weight1 + proof2 * weight2) / (weight1 + weight2);
  };

  // Helper function to check if destination is for combining spirits
  const isCombiningSpirits = (destContainer) => {
    return (
      destContainer.status === "filled" &&
      destContainer.currentFill?.productType === sourceProductType
    );
  };

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
  }, [
    transferAll,
    transferUnit,
    sourceMaxNet,
    sourceMaxWineGallons,
    sourceMaxProofGallons,
  ]);

  const handleTransfer = async () => {
    if (isTransferring) return; // Prevent multiple transfers

    setFormError("");
    setIsTransferring(true);

    let netToTransfer = 0;
    let transferValue = 0;

    // Validate transfer value based on selected unit
    if (transferUnit === "weight") {
      transferValue = parseFloat(transferWeightNet);
      if (isNaN(transferValue) || transferValue <= 0) {
        setFormError("Valid transfer weight required.");
        setIsTransferring(false);
        return;
      }
      if (transferValue > sourceMaxNet + 0.001) {
        setFormError(`Cannot transfer > ${sourceMaxNet.toFixed(2)} lbs.`);
        setIsTransferring(false);
        return;
      }
      netToTransfer = transferValue;
    } else if (transferUnit === "wineGallons") {
      transferValue = parseFloat(transferWineGallons);
      if (isNaN(transferValue) || transferValue <= 0) {
        setFormError("Valid transfer wine gallons required.");
        setIsTransferring(false);
        return;
      }
      if (transferValue > sourceMaxWineGallons + 0.001) {
        setFormError(
          `Cannot transfer > ${sourceMaxWineGallons.toFixed(2)} wine gallons.`
        );
        setIsTransferring(false);
        return;
      }
      if (sourceProof <= 0) {
        setFormError(
          "Cannot transfer by wine gallons when proof is 0 or undefined."
        );
        setIsTransferring(false);
        return;
      }
      // Use helper function to convert wine gallons to net weight
      const wineGalCalcs = calculateDerivedValuesFromWineGallons(
        transferValue,
        sourceProof,
        0
      );
      netToTransfer = wineGalCalcs.netWeightLbs;
    } else if (transferUnit === "proofGallons") {
      transferValue = parseFloat(transferProofGallons);
      if (isNaN(transferValue) || transferValue <= 0) {
        setFormError("Valid transfer proof gallons required.");
        setIsTransferring(false);
        return;
      }
      if (transferValue > sourceMaxProofGallons + 0.001) {
        setFormError(
          `Cannot transfer > ${sourceMaxProofGallons.toFixed(2)} proof gallons.`
        );
        setIsTransferring(false);
        return;
      }
      if (sourceProof <= 0) {
        setFormError(
          "Cannot transfer by proof gallons when proof is 0 or undefined."
        );
        setIsTransferring(false);
        return;
      }
      // Use helper function to convert proof gallons to net weight
      const proofGalCalcs = calculateDerivedValuesFromProofGallons(
        transferValue,
        sourceProof,
        0
      );
      netToTransfer = proofGalCalcs.netWeightLbs;
    }

    if (!destinationId) {
      setFormError("Select destination.");
      setIsTransferring(false);
      return;
    }

    const destContainerData = allContainers.find((c) => c.id === destinationId);
    if (!destContainerData) {
      setFormError("Invalid destination.");
      setIsTransferring(false);
      return;
    }

    // Check if this is a valid destination (empty or same spirit type for combining)
    const isValidDestination =
      destContainerData.status === "empty" ||
      (destContainerData.status === "filled" &&
        destContainerData.currentFill?.productType === sourceProductType &&
        destContainerData.currentFill?.productType !== "Unspecified Spirit");

    if (!isValidDestination) {
      setFormError(
        "Invalid destination. Can only transfer to empty containers or combine with same spirit type."
      );
      setIsTransferring(false);
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
        type: TRANSACTION_TYPES.TRANSFER_OUT,
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

      // Handle destination container update - either fill empty or combine spirits
      let destCalcs, finalDestProof, finalDestProductType, finalDestFillDate;

      if (destContainerData.status === "empty") {
        // Fill empty container
        const newDestGrossNum =
          (parseFloat(destContainerData.tareWeightLbs) || 0) + netToTransfer;
        destCalcs = calculateDerivedValuesFromWeight(
          parseFloat(destContainerData.tareWeightLbs) || 0,
          newDestGrossNum,
          sourceProof
        );
        finalDestProof = sourceProof;
        finalDestProductType = sourceProductType;
        finalDestFillDate = new Date().toISOString().split("T")[0];
      } else {
        // Combine spirits - calculate new combined proof and values
        const existingNetWeight =
          destContainerData.currentFill?.netWeightLbs || 0;
        const existingProof = destContainerData.currentFill?.proof || 0;
        const existingGrossWeight =
          destContainerData.currentFill?.grossWeightLbs ||
          parseFloat(destContainerData.tareWeightLbs) ||
          0;

        // Calculate combined proof using weighted average
        finalDestProof = calculateCombinedProof(
          existingProof,
          existingNetWeight,
          sourceProof,
          netToTransfer
        );

        // Calculate new combined values
        const totalNetWeight = existingNetWeight + netToTransfer;
        const newDestGrossNum = existingGrossWeight + netToTransfer;

        destCalcs = calculateDerivedValuesFromWeight(
          parseFloat(destContainerData.tareWeightLbs) || 0,
          newDestGrossNum,
          finalDestProof
        );

        finalDestProductType = sourceProductType;
        finalDestFillDate =
          destContainerData.currentFill?.fillDate ||
          new Date().toISOString().split("T")[0];
      }

      batch.update(destRef, {
        status: "filled",
        "currentFill.productType": finalDestProductType,
        "currentFill.fillDate": finalDestFillDate,
        "currentFill.grossWeightLbs": destCalcs.grossWeightLbs,
        "currentFill.proof": finalDestProof,
        "currentFill.netWeightLbs": destCalcs.netWeightLbs,
        "currentFill.wineGallons": destCalcs.wineGallons,
        "currentFill.proofGallons": destCalcs.proofGallons,
        "currentFill.spiritDensity": destCalcs.spiritDensity,
        "currentFill.account":
          sourceContainer.currentFill?.account || "storage",
        "currentFill.emptiedDate": null,
      });

      logTransaction(db, userId, appId, {
        type: TRANSACTION_TYPES.TRANSFER_IN,
        containerId: destinationId,
        containerName: destContainerData.name,
        productType: sourceProductType,
        proof: finalDestProof,
        netWeightLbsChange: netToTransfer,
        proofGallonsChange: pgTransferred,
        sourceContainerId: sourceContainer.id,
        sourceContainerName: sourceContainer.name,
        notes: isCombiningSpirits(destContainerData)
          ? `Combined from ${
              sourceContainer.name
            } (${sourceProof} proof) with existing ${
              destContainerData.currentFill?.proof || 0
            } proof = ${finalDestProof.toFixed(1)} proof`
          : `From ${sourceContainer.name}`,
      });

      await batch.commit();
      setErrorApp("");
      onClose();
    } catch (err) {
      console.error("Transfer error: ", err);
      setFormError("Transfer failed: " + err.message);
      setErrorApp("Transfer failed.");
    } finally {
      setIsTransferring(false);
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
      const calcs = calculateDerivedValuesFromWineGallons(
        wineGallons,
        sourceProof,
        0
      );
      netWeight = calcs.netWeightLbs;
      proofGallons = calcs.proofGallons;
    } else if (transferUnit === "proofGallons" && transferProofGallons) {
      proofGallons = parseFloat(transferProofGallons);
      const calcs = calculateDerivedValuesFromProofGallons(
        proofGallons,
        sourceProof,
        0
      );
      netWeight = calcs.netWeightLbs;
      wineGallons = calcs.wineGallons;
    }

    return { netWeight, wineGallons, proofGallons };
  };

  // Calculate the combined result when transferring to a filled container
  const getCombinedResultPreview = () => {
    if (!destinationId) return null;

    const destContainer = allContainers.find((c) => c.id === destinationId);
    if (!destContainer || !isCombiningSpirits(destContainer)) return null;

    const transferPreview = getTransferPreview();
    if (!transferPreview) return null;

    const existingNetWeight = destContainer.currentFill?.netWeightLbs || 0;
    const existingProof = destContainer.currentFill?.proof || 0;

    const combinedNetWeight = existingNetWeight + transferPreview.netWeight;
    const combinedProof = calculateCombinedProof(
      existingProof,
      existingNetWeight,
      sourceProof,
      transferPreview.netWeight
    );

    const spiritDensity = calculateSpiritDensity(combinedProof);
    const combinedWineGallons =
      spiritDensity > 0 ? combinedNetWeight / spiritDensity : 0;
    const combinedProofGallons = combinedWineGallons * (combinedProof / 100);

    return {
      existingNetWeight,
      existingProof,
      transferNetWeight: transferPreview.netWeight,
      transferProof: sourceProof,
      combinedNetWeight,
      combinedProof,
      combinedWineGallons,
      combinedProofGallons,
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-blue-300">
          Transfer From: {sourceContainer.name}
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          ({sourceProductType}) Available: {sourceMaxNet.toFixed(2)} lbs,{" "}
          {sourceMaxWineGallons.toFixed(2)} wine gal,{" "}
          {sourceMaxProofGallons.toFixed(2)} proof gal at {sourceProof} proof.
        </p>
        <p className="text-xs text-blue-400 mb-3">
          💡 You can transfer to empty containers or combine with other{" "}
          {sourceProductType} containers
        </p>
        {formError && (
          <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>
        )}
        <div className="space-y-4">
          <select
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
            disabled={isTransferring}
            className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <option value="">-- Select Destination --</option>
            {availableDestinations.map((c) => {
              if (c.status === "empty") {
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} - Empty (Tare: {c.tareWeightLbs} lbs)
                  </option>
                );
              } else {
                // Filled container with same spirit type
                const existingProof = c.currentFill?.proof || 0;
                const existingNetWeight = c.currentFill?.netWeightLbs || 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} - Combine with {existingNetWeight.toFixed(2)} lbs
                    at {existingProof} proof
                  </option>
                );
              }
            })}
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
                  disabled={isTransferring}
                  className="mr-2 h-4 w-4 text-blue-500 border-gray-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isTransferring}
                  className="mr-2 h-4 w-4 text-blue-500 border-gray-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isTransferring}
                  className="mr-2 h-4 w-4 text-blue-500 border-gray-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-300">Proof Gal</span>
              </label>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <p>
                • <strong>Weight:</strong> Direct net weight transfer in pounds
              </p>
              <p>
                • <strong>Wine Gal:</strong> Volume-based transfer (accounts for
                proof)
              </p>
              <p>
                • <strong>Proof Gal:</strong> Standard proof gallon measurement
              </p>
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
              disabled={transferAll || isTransferring}
              step="0.01"
              min="0.01"
              placeholder="Net Lbs to Transfer"
              className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600 disabled:cursor-not-allowed"
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
              disabled={transferAll || isTransferring}
              step="0.01"
              min="0.01"
              placeholder="Wine Gallons to Transfer"
              className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600 disabled:cursor-not-allowed"
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
              disabled={transferAll || isTransferring}
              step="0.01"
              min="0.01"
              placeholder="Proof Gallons to Transfer"
              className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600 disabled:cursor-not-allowed"
            />
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="transferAll"
              checked={transferAll}
              onChange={(e) => setTransferAll(e.target.checked)}
              disabled={isTransferring}
              className="mr-2 h-4 w-4 text-blue-500 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="transferAll" className="text-sm text-gray-300">
              Transfer All
            </label>
          </div>

          {/* Transfer Preview */}
          {getTransferPreview() && (
            <div className="bg-gray-750 p-3 rounded border border-gray-600">
              <h4 className="text-sm font-semibold mb-2 text-blue-300">
                Transfer Preview:
              </h4>
              <div className="text-sm space-y-1">
                <p>
                  Net Weight: {getTransferPreview().netWeight.toFixed(2)} lbs
                </p>
                <p>
                  Wine Gallons: {getTransferPreview().wineGallons.toFixed(2)}{" "}
                  gal
                </p>
                <p>
                  Proof Gallons: {getTransferPreview().proofGallons.toFixed(2)}{" "}
                  PG
                </p>
              </div>
            </div>
          )}

          {/* Combined Result Preview - when combining spirits */}
          {getCombinedResultPreview() && (
            <div className="bg-blue-900 p-3 rounded border border-blue-600">
              <h4 className="text-sm font-semibold mb-2 text-blue-200">
                Combined Result Preview:
              </h4>
              <div className="text-sm space-y-1">
                <p className="text-blue-100">
                  <span className="font-medium">Existing:</span>{" "}
                  {getCombinedResultPreview().existingNetWeight.toFixed(2)} lbs
                  at {getCombinedResultPreview().existingProof} proof
                </p>
                <p className="text-blue-100">
                  <span className="font-medium">Adding:</span>{" "}
                  {getCombinedResultPreview().transferNetWeight.toFixed(2)} lbs
                  at {getCombinedResultPreview().transferProof} proof
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-3">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              size="md"
              disabled={isTransferring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              variant="primary"
              size="md"
              loading={isTransferring}
              disabled={isTransferring}
            >
              Confirm Transfer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
