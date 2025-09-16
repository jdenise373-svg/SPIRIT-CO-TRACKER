// --- ProductionList ---
export const ProductionList = ({ title, batches, onEdit, onDelete }) => (
  <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
    <h2 className="text-2xl font-bold text-blue-300 mb-4">{title}</h2>
    {batches.length === 0 ? (
      <p className="text-gray-500">No {title.toLowerCase()} recorded.</p>
    ) : (
      <div className="space-y-4">
        {batches.map((batch) => (
          <div
            key={batch.id}
            className="bg-gray-750 p-4 rounded-lg border border-gray-600"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-gray-200">
                  {batch.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {batch.batchType === "fermentation"
                    ? `Started: ${batch.startDate}`
                    : `Date: ${batch.date}`}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => onEdit(batch)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  EDIT
                </button>
                <button
                  onClick={() => onDelete(batch)}
                  className="text-xs text-red-500 hover:underline"
                >
                  DELETE
                </button>
              </div>
            </div>
            <div className="text-sm mt-3 space-y-1 text-gray-300">
              {batch.batchType === "fermentation" ? (
                <>
                  <p>
                    <strong>Volume:</strong> {batch.startVolume} gal
                  </p>
                  <p>
                    <strong>Gravity:</strong> {batch.og} OG → {batch.fg} FG
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Source:</strong>{" "}
                    {batch.sourceBatchName ||
                      (batch.sourceBatchId === "storage_tank"
                        ? "Storage Tank"
                        : "N/A")}
                  </p>
                  {batch.selectedStorageTankId && (
                    <p>
                      <strong>Pulled From:</strong>{" "}
                      {batch.selectedStorageTankName || "Storage Tank"}
                    </p>
                  )}
                  {batch.chargeCalculated &&
                    batch.chargeCalculated.proofGallons > 0 && (
                      <p>
                        <strong>Charge:</strong>{" "}
                        {batch.chargeCalculated.proofGallons.toFixed(2)} PG @{" "}
                        {batch.chargeProof} proof
                      </p>
                    )}
                  {batch.yieldCalculated &&
                    batch.yieldCalculated.proofGallons > 0 && (
                      <p>
                        <strong>Yield:</strong>{" "}
                        {batch.yieldCalculated.proofGallons.toFixed(2)} PG @{" "}
                        {batch.yieldProof} proof
                      </p>
                    )}
                  <p>
                    <strong>Product:</strong> {batch.productType}
                  </p>
                  {batch.selectedContainerId && (
                    <p>
                      <strong>Stored In:</strong>{" "}
                      {batch.selectedContainerName || "Container"}
                    </p>
                  )}
                </>
              )}
              {batch.notes && (
                <p className="text-xs text-gray-400 pt-1 border-t border-gray-700 mt-2">
                  <em>Notes: {batch.notes}</em>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
