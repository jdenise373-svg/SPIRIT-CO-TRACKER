import { useState } from "react";
import { convertToCSV, downloadCSV } from "../../utils/helpers";
import { TRANSACTION_TYPES } from "../../constants";

// --- TtbReportModal (ENHANCED) ---
export const TtbReportModal = ({ transactionLog, onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);

  const generateReport = () => {
      if (!startDate || !endDate) { setReport(null); return; }
      const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      const filteredLogs = transactionLog.filter(log => { const logDate = log.timestamp?.toDate(); return logDate && logDate >= start && logDate <= end; });

      const summary = {
          production: { spiritsProduced: 0 },
          processing: { transferredFromStorage: 0, bottlingDump: 0, bottlingGain: 0, bottlingLoss: 0, operationalLoss: 0, transferredToStorage: 0 },
          storage: { transferredIn: 0, transferredOut: 0, storageLosses: 0 }
      };

      filteredLogs.forEach(log => {
          const pg = log.proofGallonsChange || 0;
          switch(log.type) {
              case TRANSACTION_TYPES.PRODUCTION: 
              case TRANSACTION_TYPES.DISTILLATION_FINISH: 
                  summary.production.spiritsProduced += pg; 
                  break;
              case TRANSACTION_TYPES.TRANSFER_OUT: 
                  summary.processing.transferredToStorage += Math.abs(pg); 
                  summary.storage.transferredOut += Math.abs(pg); 
                  break;
              case TRANSACTION_TYPES.TRANSFER_IN: 
                  summary.processing.transferredFromStorage += pg; 
                  summary.storage.transferredIn += pg; 
                  break;
              case TRANSACTION_TYPES.BOTTLE_PARTIAL: 
              case TRANSACTION_TYPES.BOTTLE_EMPTY: 
                  summary.processing.bottlingDump += Math.abs(pg); 
                  break;
              case TRANSACTION_TYPES.BOTTLING_GAIN: 
                  summary.processing.bottlingGain += pg; 
                  break;
              case TRANSACTION_TYPES.BOTTLING_LOSS: 
                  summary.processing.bottlingLoss += Math.abs(pg); 
                  break;
              case TRANSACTION_TYPES.SAMPLE_ADJUST: 
                  summary.processing.operationalLoss += Math.abs(pg); 
                  summary.storage.storageLosses += Math.abs(pg); 
                  break;
              default: 
                  break;
          }
      });
      setReport(summary);
  };
  
  const handleExport = () => {
      if(!report) return;
      const headers = ["TTB Form", "Part", "Line", "Description", "Proof Gallons (PG)"];
      const data = [
          ["Production Report (TTB F 5110.40)", "Part I", "2", "Spirits produced by distillation", report.production.spiritsProduced.toFixed(2)],
          ["Processing Report (TTB F 5110.28)", "Part I", "3", "Spirits received from storage", report.processing.transferredFromStorage.toFixed(2)],
          ["Processing Report (TTB F 5110.28)", "Part II", "20", "Spirits dumped for bottling", report.processing.bottlingDump.toFixed(2)],
          ["Processing Report (TTB F 5110.28)", "Part II", "26", "Bottling gains", report.processing.bottlingGain.toFixed(2)],
          ["Processing Report (TTB F 5110.28)", "Part II", "27", "Bottling losses", report.processing.bottlingLoss.toFixed(2)],
          ["Processing Report (TTB F 5110.28)", "Part II", "28", "Losses from dumping, mingling, etc.", report.processing.operationalLoss.toFixed(2)],
          ["Storage Report (TTB F 5110.11)", "Part I", "2", "Spirits transferred in", report.storage.transferredIn.toFixed(2)],
          ["Storage Report (TTB F 5110.11)", "Part II", "17", "Spirits transferred out", report.storage.transferredOut.toFixed(2)],
          ["Storage Report (TTB F 5110.11)", "Part II", "18", "Losses (e.g., from samples, aging)", report.storage.storageLosses.toFixed(2)],
      ];
      const csvString = convertToCSV(data, headers);
      downloadCSV(csvString, `ttb_correlated_summary_${startDate}_to_${endDate}.csv`);
  };
  
  const ReportSection = ({ title, children }) => ( <div className="bg-gray-800 p-4 rounded-lg border border-gray-700"><h3 className="text-xl font-semibold text-blue-300 mb-3">{title}</h3><div className="space-y-2">{children}</div></div> );
  const ReportRow = ({ form, part, line, description, value }) => ( <div className="grid grid-cols-12 gap-2 items-center text-sm hover:bg-gray-700/50 p-1 rounded"><div className="col-span-7 text-gray-300">{description}</div><div className="col-span-3 text-gray-400 text-xs text-right" title={`${form} - Part ${part}, Line ${line}`}>{form}, L {line}</div><div className="col-span-2 text-right font-mono text-blue-300">{value.toFixed(2)}</div></div> );

  return(
       <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              <h2 className="text-2xl mb-4 font-semibold text-blue-300">TTB Monthly Report Correlator</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
                  <div><label htmlFor="startDate" className="block text-sm font-medium text-gray-300">Start Date</label><input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>
                  <div><label htmlFor="endDate" className="block text-sm font-medium text-gray-300">End Date</label><input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>
                  <button onClick={generateReport} disabled={!startDate || !endDate} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md h-10 disabled:bg-gray-500 disabled:cursor-not-allowed">Generate Report</button>
              </div>
              <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                  {!report ? ( <div className="text-center text-gray-500 pt-10">Please select a date range to generate the report.</div> ) : (
                      <>
                          <ReportSection title="Production Operations (TTB F 5110.40)"><ReportRow form="F5110.40" part="I" line="2" description="Spirits produced by distillation" value={report.production.spiritsProduced} /></ReportSection>
                          <ReportSection title="Processing Operations (TTB F 5110.28)">
                               <ReportRow form="F5110.28" part="I" line="3" description="Spirits received from storage" value={report.processing.transferredFromStorage} />
                               <hr className="border-gray-600 my-2" />
                               <ReportRow form="F5110.28" part="II" line="20" description="Spirits dumped for bottling" value={report.processing.bottlingDump} />
                               <ReportRow form="F5110.28" part="II" line="26" description="Bottling gains" value={report.processing.bottlingGain} />
                               <ReportRow form="F5110.28" part="II" line="27" description="Bottling losses" value={report.processing.bottlingLoss} />
                               <ReportRow form="F5110.28" part="II" line="28" description="Operational losses (samples, etc.)" value={report.processing.operationalLoss} />
                          </ReportSection>
                          <ReportSection title="Storage Operations (TTB F 5110.11)">
                               <ReportRow form="F5110.11" part="I" line="2" description="Spirits transferred in" value={report.storage.transferredIn} />
                               <hr className="border-gray-600 my-2" />
                               <ReportRow form="F5110.11" part="II" line="17" description="Spirits transferred out (to Processing)" value={report.storage.transferredOut} />
                               <ReportRow form="F5110.11" part="II" line="18" description="Storage losses (aging, samples)" value={report.storage.storageLosses} />
                          </ReportSection>
                      </>
                  )}
              </div>
              <div className="flex justify-between items-center pt-4 mt-auto border-t border-gray-700">
                  <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Close</button>
                  {report && <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Export Correlated CSV</button>}
              </div>
          </div>
      </div>
  );
};