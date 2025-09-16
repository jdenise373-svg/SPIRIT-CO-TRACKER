import { useState, useMemo, useEffect } from "react";
import { writeBatch } from "firebase/firestore";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import {
  calculateSpiritDensity,
  calculateDerivedValuesFromWeight,
} from "../../utils/helpers";
import {
  BOTTLE_SIZES_ML,
  ML_PER_GALLON,
  TRANSACTION_TYPES,
} from "../../constants";

// --- BottlingModal ---
export const BottlingModal = ({
  db,
  userId,
  appId,
  container,
  onClose,
  setErrorApp,
}) => {
  const [numBottles, setNumBottles] = useState("");
  const [bottleSizeMl, setBottleSizeMl] = useState(BOTTLE_SIZES_ML[0].value);
  const [formError, setFormError] = useState("");
  const [remainderAction, setRemainderAction] = useState("keep");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("loss");

  const { currentFill = {}, tareWeightLbs = 0 } = container;
  const {
    proof = 0,
    wineGallons: initialWineGallons = 0,
    proofGallons: initialProofGallons = 0,
    netWeightLbs: initialNetWeightLbs = 0,
    spiritDensity = 0,
    productType = "N/A",
  } = currentFill;

  const bottlingCalcs = useMemo(() => {
    const bottles = parseInt(numBottles, 10);
    const size = parseInt(bottleSizeMl, 10);

    if (isNaN(bottles) || isNaN(size) || bottles < 0 || size <= 0) {
      return {
        wgBottled: 0,
        pgBottled: 0,
        lbsBottled: 0,
        finalWg: initialWineGallons,
        isGain: false,
        isValid: false,
      };
    }

    const wgBottled = (bottles * size) / ML_PER_GALLON;
    const pgBottled = wgBottled * (proof / 100);
    const lbsBottled = wgBottled * spiritDensity;
    const isGain = wgBottled > initialWineGallons + 0.001;
    const finalWg = initialWineGallons - wgBottled;

    return {
      wgBottled,
      pgBottled,
      lbsBottled,
      finalWg,
      isGain,
      isValid: bottles > 0,
    };
  }, [numBottles, bottleSizeMl, initialWineGallons, proof, spiritDensity]);

  const manualAdjustmentCalcs = useMemo(() => {
    const wg = parseFloat(adjustmentAmount);
    if (isNaN(wg) || wg <= 0) {
      return { pg: 0 };
    }
    const pg = wg * (proof / 100);
    return { pg };
  }, [adjustmentAmount, proof]);

  useEffect(() => {
    if (bottlingCalcs.isGain) {
      setRemainderAction("gain");
    } else {
      if (remainderAction === "gain") {
        setRemainderAction("keep");
      }
    }
  }, [bottlingCalcs.isGain, remainderAction]);

  const handleBottle = async () => {
    setFormError("");
    if (!bottlingCalcs.isValid) {
      setFormError("Please enter a valid number of bottles.");
      return;
    }

    const batch = writeBatch(db);
    const containerRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/spiritInventory`,
      container.id
    );
    const logCollRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/transactionLog`
    );

    if (bottlingCalcs.isGain) {
      const emptyLog = {
        type: TRANSACTION_TYPES.BOTTLE_EMPTY,
        containerId: container.id,
        containerName: container.name,
        productType,
        proof,
        netWeightLbsChange: -initialNetWeightLbs,
        proofGallonsChange: -initialProofGallons,
        notes: `Bottled ${numBottles} x ${bottleSizeMl}mL. Container emptied with gain.`,
      };
      batch.set(doc(logCollRef), { ...emptyLog, timestamp: serverTimestamp() });

      const wgGain = -bottlingCalcs.finalWg;
      const pgGain = wgGain * (proof / 100);
      const lbsGain = wgGain * spiritDensity;

      const gainLog = {
        type: TRANSACTION_TYPES.BOTTLING_GAIN,
        containerId: container.id,
        containerName: container.name,
        productType,
        proof,
        netWeightLbsChange: lbsGain,
        proofGallonsChange: pgGain,
        notes: `Gain of ${wgGain.toFixed(2)} WG recorded during bottling.`,
      };
      batch.set(doc(logCollRef), { ...gainLog, timestamp: serverTimestamp() });

      const emptyFill = calculateDerivedValuesFromWeight(
        tareWeightLbs,
        tareWeightLbs,
        0
      );
      const finalUpdate = {
        status: "empty",
        currentFill: {
          ...currentFill,
          ...emptyFill,
          fillDate: null,
          proof: 0,
          productType: productType,
          emptiedDate: new Date().toISOString().split("T")[0],
        },
      };
      batch.update(containerRef, finalUpdate);
    } else {
      const bottlingLog = {
        type: TRANSACTION_TYPES.BOTTLE_PARTIAL,
        containerId: container.id,
        containerName: container.name,
        productType,
        proof,
        netWeightLbsChange: -bottlingCalcs.lbsBottled,
        proofGallonsChange: -bottlingCalcs.pgBottled,
        notes: `Bottled ${numBottles} x ${bottleSizeMl}mL units.`,
      };
      batch.set(doc(logCollRef), {
        ...bottlingLog,
        timestamp: serverTimestamp(),
      });

      if (remainderAction === "keep") {
        const newGross =
          (currentFill.grossWeightLbs || tareWeightLbs) -
          bottlingCalcs.lbsBottled;
        const finalCalcs = calculateDerivedValuesFromWeight(
          tareWeightLbs,
          newGross,
          proof
        );
        batch.update(containerRef, {
          currentFill: { ...currentFill, ...finalCalcs },
        });
      } else {
        if (remainderAction === "loss") {
          const lossLog = {
            type: TRANSACTION_TYPES.BOTTLING_LOSS,
            containerId: container.id,
            containerName: container.name,
            productType,
            proof,
            netWeightLbsChange: -(
              initialNetWeightLbs - bottlingCalcs.lbsBottled
            ),
            proofGallonsChange: -(
              initialProofGallons - bottlingCalcs.pgBottled
            ),
            notes: `Remainder of ${bottlingCalcs.finalWg.toFixed(
              2
            )} WG written off as loss.`,
          };
          batch.set(doc(logCollRef), {
            ...lossLog,
            timestamp: serverTimestamp(),
          });
        } else if (remainderAction === "adjust") {
          const adjAmt = parseFloat(adjustmentAmount);
          if (isNaN(adjAmt) || adjAmt < 0) {
            setFormError(
              "Please enter a valid, positive number for the adjustment."
            );
            return;
          }
          const adjSign = adjustmentType === "loss" ? -1 : 1;
          const adjWg = adjAmt * adjSign;
          const adjPg = adjWg * (proof / 100);
          const adjLbs = adjWg * spiritDensity;

          const adjLog = {
            type:
              adjustmentType === "loss"
                ? TRANSACTION_TYPES.BOTTLING_LOSS
                : TRANSACTION_TYPES.BOTTLING_GAIN,
            containerId: container.id,
            containerName: container.name,
            productType,
            proof,
            netWeightLbsChange: adjLbs,
            proofGallonsChange: adjPg,
            notes: `Manual bottling ${adjustmentType}: ${adjAmt.toFixed(
              2
            )} WG.`,
          };
          batch.set(doc(logCollRef), {
            ...adjLog,
            timestamp: serverTimestamp(),
          });
        }

        const emptyFill = calculateDerivedValuesFromWeight(
          tareWeightLbs,
          tareWeightLbs,
          0
        );
        const finalUpdate = {
          status: "empty",
          currentFill: {
            ...currentFill,
            ...emptyFill,
            fillDate: null,
            proof: 0,
            productType: productType,
            emptiedDate: new Date().toISOString().split("T")[0],
          },
        };
        batch.update(containerRef, finalUpdate);
      }
    }

    try {
      await batch.commit();
      setErrorApp("");
      onClose();
    } catch (err) {
      console.error("Bottling error:", err);
      setFormError("Failed to save changes: " + err.message);
      setErrorApp("Bottling failed.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl mb-4 font-semibold text-sky-300">
          Bottle From: {container.name}
        </h2>
        {formError && (
          <div className="bg-red-600 p-3 rounded mb-4 text-sm">{formError}</div>
        )}
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            <strong>Available:</strong> {initialWineGallons.toFixed(2)} WG @{" "}
            {proof} Proof
          </p>
          <div className="grid grid-cols-2 gap-4 p-4 border border-gray-700 rounded-lg">
            <div>
              <label
                htmlFor="bottleSize"
                className="block text-sm font-medium text-gray-300"
              >
                Bottle Size
              </label>
              <select
                id="bottleSize"
                value={bottleSizeMl}
                onChange={(e) => setBottleSizeMl(e.target.value)}
                className="w-full bg-gray-700 p-2 rounded mt-1"
              >
                {BOTTLE_SIZES_ML.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="numBottles"
                className="block text-sm font-medium text-gray-300"
              >
                Number of Bottles
              </label>
              <input
                type="number"
                id="numBottles"
                value={numBottles}
                onChange={(e) => setNumBottles(e.target.value)}
                placeholder="e.g., 120"
                className="w-full bg-gray-700 p-2 rounded mt-1"
                step="1"
                min="0"
              />
            </div>
          </div>

          {bottlingCalcs.isValid && (
            <div className="bg-gray-700 p-3 rounded text-sm">
              <p>
                <strong>Bottled Volume:</strong>{" "}
                {bottlingCalcs.wgBottled.toFixed(2)} WG /{" "}
                {bottlingCalcs.pgBottled.toFixed(2)} PG
              </p>
              {bottlingCalcs.isGain ? (
                <p className="font-semibold text-green-400">
                  Calculated Gain: {(-bottlingCalcs.finalWg).toFixed(2)} WG /{" "}
                  {(-bottlingCalcs.finalWg * (proof / 100)).toFixed(2)} PG
                </p>
              ) : (
                <p>
                  <strong>Expected Remainder:</strong>{" "}
                  <span className="font-semibold text-sky-300">
                    {bottlingCalcs.finalWg.toFixed(2)} WG /{" "}
                    {(bottlingCalcs.finalWg * (proof / 100)).toFixed(2)} PG
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="p-4 border border-gray-700 rounded-lg">
            <h4 className="text-md font-semibold text-gray-300 mb-2">
              Finalize Container
            </h4>
            {bottlingCalcs.isGain ? (
              <p className="text-sm text-green-400 bg-green-900/50 p-2 rounded">
                Container will be emptied and a gain of{" "}
                {(-bottlingCalcs.finalWg).toFixed(2)} WG will be recorded.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="remainderAction"
                    value="keep"
                    checked={remainderAction === "keep"}
                    onChange={(e) => setRemainderAction(e.target.value)}
                    className="form-radio text-sky-500"
                  />
                  <span>Keep remainder in container</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="remainderAction"
                    value="loss"
                    checked={remainderAction === "loss"}
                    onChange={(e) => setRemainderAction(e.target.value)}
                    className="form-radio text-sky-500"
                  />
                  <span>Empty and record remainder as loss</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="remainderAction"
                    value="adjust"
                    checked={remainderAction === "adjust"}
                    onChange={(e) => setRemainderAction(e.target.value)}
                    className="form-radio text-sky-500"
                  />
                  <span>Empty and manually record Loss/Gain</span>
                </label>
              </div>
            )}

            {remainderAction === "adjust" && !bottlingCalcs.isGain && (
              <div className="mt-3 pt-3 border-t border-gray-600 grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="adjustmentType"
                    className="block text-xs font-medium text-gray-400"
                  >
                    Adjustment Type
                  </label>
                  <select
                    id="adjustmentType"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full bg-gray-600 p-2 rounded mt-1 text-sm"
                  >
                    <option value="loss">Bottling Loss</option>
                    <option value="gain">Bottling Gain</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="adjustmentAmount"
                    className="block text-xs font-medium text-gray-400"
                  >
                    Amount (Wine Gallons)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      id="adjustmentAmount"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      className="w-full bg-gray-600 p-2 rounded mt-1 text-sm"
                      step="0.001"
                      min="0"
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      ({manualAdjustmentCalcs.pg.toFixed(2)} PG)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleBottle}
              disabled={!bottlingCalcs.isValid}
              className="bg-sky-600 py-2 px-4 rounded disabled:bg-sky-800 disabled:cursor-not-allowed"
            >
              Confirm Bottling
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
