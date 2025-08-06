import { useMemo } from "react";
import { ProductionList } from "./ProductionList";

// --- NEW Production Components ---
export const ProductionView = ({ batches, isLoading, onAddBatch, onEditBatch, onDeleteBatch }) => {
  const fermentations = useMemo(() => batches.filter(b => b.batchType === 'fermentation').sort((a,b) => new Date(b.startDate) - new Date(a.startDate)), [batches]);
  const distillations = useMemo(() => batches.filter(b => b.batchType === 'distillation').sort((a,b) => new Date(b.date) - new Date(a.date)), [batches]);

  return (
      <div className="space-y-8">
          <div className="flex justify-center gap-4 mb-6">
              <button onClick={() => onAddBatch('fermentation')} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md">New Fermentation</button>
              <button onClick={() => onAddBatch('distillation')} className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md">New Distillation</button>
          </div>

          {isLoading && <div className="text-center p-8">Loading Production Batches...</div>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ProductionList title="Fermentations" batches={fermentations} onEdit={onEditBatch} onDelete={onDeleteBatch} />
              <ProductionList title="Distillations" batches={distillations} onEdit={onEditBatch} onDelete={onDeleteBatch} />
          </div>
      </div>
  );
};
