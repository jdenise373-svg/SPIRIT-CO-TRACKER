import { ContainerTypeIcon } from "../icons/ContainerTypeIcon";
import { CONTAINER_CAPACITIES_GALLONS } from "../constants";

export const InventoryItem = ({ container, onEditInfo, onRefill, onTransfer, onSample, onProofDown, onBottle, onDelete, onChangeAccount }) => {
    const { name, type, status, currentFill, tareWeightLbs } = container;
    const { fillDate = 'N/A', grossWeightLbs = 0, proof = 0, netWeightLbs = 0, wineGallons = 0, proofGallons = 0, emptiedDate = null, productType = "Unspecified" } = currentFill || {};
    const capacity = CONTAINER_CAPACITIES_GALLONS[type] || 0;

    let percentageFull = 0;
    if (type === 'still') {
        percentageFull = (status === 'filled' && netWeightLbs > 0) ? 100 : 0;
    } else {
        percentageFull = capacity > 0 && status === 'filled' && wineGallons > 0 ? (wineGallons / capacity) * 100 : 0;
    }
    const displayPercentage = Math.min(100, Math.max(0, percentageFull)).toFixed(0);

    return (
        <div className="bg-gray-800 shadow-xl rounded-lg p-6 flex flex-col justify-between border-2 border-gray-700 hover:border-blue-500">
            <div className="flex flex-col items-center">
                <div className="mb-4">
                    <ContainerTypeIcon type={type} fillPercentage={percentageFull} />
                </div>
                <div className="text-center mb-3 w-full">
                    <h3 className="text-2xl font-semibold text-blue-300 truncate" title={name}>{name}</h3>
                    {status === 'filled' && currentFill.account && (
                        <p className="text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block bg-blue-800 text-blue-200">
                            Account: {currentFill.account.charAt(0).toUpperCase() + currentFill.account.slice(1)}
                        </p>
                    )}
                    <p className={`text-sm font-semibold mt-1 px-2 py-0.5 rounded-full inline-block ${status === 'filled' ? 'bg-green-700 text-green-100' : 'bg-yellow-700 text-yellow-100'}`}>
                        {status === 'filled' ? (type === 'still' ? 'In Use' : 'Filled') : 'Empty'}
                    </p>
                    {status === 'filled' && type !== 'still' && ( <span className="ml-2 text-sm text-blue-300 font-semibold">{displayPercentage}% Full</span>)}
                    {status === 'filled' && productType !== "Unspecified Spirit" && productType && <p className="text-xs text-gray-400 mt-1">({productType})</p>}
                </div>
            </div>

            <div className="space-y-1 text-sm text-gray-300 mt-auto">
                <p><strong>Type:</strong> <span className="capitalize">{type?.replace(/_/g, ' ')}</span> {type !== 'still' ? `(Approx. ${capacity} gal)`: ''}</p>
                <p><strong>Tare Wt:</strong> {tareWeightLbs || 0} lbs</p>
                {status === 'filled' && (<>
                    <p><strong>{type === 'still' ? 'Batch Date' : 'Fill Date'}:</strong> {fillDate}</p>
                    <p><strong>Gross Wt:</strong> {grossWeightLbs} lbs</p>
                    <p><strong>Proof:</strong> {proof}</p>
                    <hr className="my-1 border-gray-700"/>
                    <p><strong>Net Product:</strong> {netWeightLbs} lbs</p>
                    <p><strong>Wine Gallons:</strong> {wineGallons.toFixed(2)} gal</p>
                    <p className="text-lg font-bold text-blue-400"><strong>Proof Gallons:</strong> {proofGallons.toFixed(2)} PG</p>
                </>)}
                {status === 'empty' && emptiedDate && <p><strong>Last Emptied:</strong> {emptiedDate}</p>}
                {status === 'empty' && !emptiedDate && <p>This container is currently empty.</p> }
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-end pt-3 border-t border-gray-700">
                <button onClick={() => onEditInfo(container)} className="bg-gray-600 hover:bg-gray-500 text-xs py-2 px-3 rounded-md">Edit Info</button>
                {status === 'filled' ? (<>
                    <button onClick={() => onChangeAccount(container)} className="bg-gray-500 hover:bg-gray-400 text-xs py-2 px-3 rounded-md">Change Account</button>
                    <button onClick={() => onBottle(container)} className="bg-sky-600 hover:bg-sky-500 text-xs py-2 px-3 rounded-md">Bottle</button>
                    <button onClick={() => onTransfer(container)} className="bg-purple-600 hover:bg-purple-500 text-xs py-2 px-3 rounded-md">Transfer</button>
                    <button onClick={() => onProofDown(container)} className="bg-cyan-600 hover:bg-cyan-500 text-xs py-2 px-3 rounded-md">Proof Down</button>
                    <button onClick={() => onSample(container)} className="bg-yellow-600 hover:bg-yellow-500 text-xs py-2 px-3 rounded-md">Sample/Adjust</button>
                </>) : (<button onClick={() => onRefill(container)} className="bg-green-600 hover:bg-green-500 text-xs py-2 px-3 rounded-md">{type === 'still' ? 'New Batch' : 'Refill'}</button>)}
                <button onClick={() => onDelete(container.id)} className="bg-red-700 hover:bg-red-600 text-xs py-2 px-3 rounded-md">Delete</button>
            </div>
        </div>
    );
};