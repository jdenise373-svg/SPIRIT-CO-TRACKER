import { convertToCSV, downloadCSV } from "../../utils/helpers";
// --- ViewLogModal ---
export const ViewLogModal = ({ transactionLog, isLoadingLog, onClose }) => {
  const handleExportLog = () => { const headers = ["Timestamp", "Type", "Container Name", "Container ID", "Product Type", "Proof", "Net Wt Change (lbs)", "PG Change", "Source Container", "Dest. Container", "Notes"]; const data = transactionLog.map(log => [ log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A', log.type||'N/A', log.containerName||'N/A', log.containerId||'N/A', log.productType||'N/A', log.proof||0, log.netWeightLbsChange?.toFixed(2)||0, log.proofGallonsChange?.toFixed(3)||0, log.sourceContainerName||(log.type==='TRANSFER_IN'?log.sourceContainerId:'N/A'), log.destinationContainerName||(log.type==='TRANSFER_OUT'?log.destinationContainerId:'N/A'), log.notes||'' ]); const csvString = convertToCSV(data, headers); downloadCSV(csvString, `transaction_log_${new Date().toISOString().split('T')[0]}.csv`); };
  return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-blue-300">Transaction Log</h2>
                  <button onClick={handleExportLog} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-md text-sm">Export Log CSV</button>
              </div>
              {isLoadingLog && <p className="text-center text-gray-400">Loading log...</p>}
              {!isLoadingLog && transactionLog.length === 0 && <p className="text-center text-gray-400">No transactions recorded yet.</p>}
              {!isLoadingLog && transactionLog.length > 0 && (
                  <div className="overflow-x-auto flex-grow rounded-md border border-gray-700">
                      <table className="min-w-full divide-y divide-gray-700 text-sm">
                          <thead className="bg-gray-750 sticky top-0 z-10">
                              <tr>
                                  {["Date", "Type", "Container", "Product", "Proof", "Net Wt Δ", "PG Δ", "Notes/Xfer"].map(header => (
                                      <th key={header} className="px-4 py-2 text-left font-medium text-gray-300 tracking-wider whitespace-nowrap bg-gray-750">{header}</th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="bg-gray-800 divide-y divide-gray-700">
                              {transactionLog.map(log => (
                                  <tr key={log.id} className="hover:bg-gray-700">
                                      <td className="px-4 py-2 whitespace-nowrap text-gray-400">{log.timestamp?.toDate?log.timestamp.toDate().toLocaleString():'N/A'}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-gray-300">{log.type||'N/A'}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-gray-300" title={log.containerId}>{log.containerName||'N/A'}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-gray-300">{log.productType||'N/A'}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-gray-300">{log.proof||0}</td>
                                      <td className={`px-4 py-2 whitespace-nowrap ${log.netWeightLbsChange > 0 ? 'text-green-400' : (log.netWeightLbsChange < 0 ? 'text-red-400' : 'text-gray-300')}`}>{log.netWeightLbsChange?.toFixed(2) || 0}</td>
                                      <td className={`px-4 py-2 whitespace-nowrap ${log.proofGallonsChange > 0 ? 'text-green-400' : (log.proofGallonsChange < 0 ? 'text-red-400' : 'text-gray-300')}`}>{log.proofGallonsChange?.toFixed(3) || 0}</td>
                                      <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate" title={ (log.type === "TRANSFER_OUT" && `To: ${log.destinationContainerName || log.destinationContainerId}`) || (log.type === "TRANSFER_IN" && `From: ${log.sourceContainerName || log.sourceContainerId}`) || (log.notes || '')}>
                                          {log.type === "TRANSFER_OUT" && `To: ${log.destinationContainerName || log.destinationContainerId}`}
                                          {log.type === "TRANSFER_IN" && `From: ${log.sourceContainerName || log.sourceContainerId}`}
                                          {log.notes && <span> {log.notes}</span>}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
              <div className="mt-6 flex justify-end">
                  <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Close</button>
              </div>
          </div>
      </div>
  );
};