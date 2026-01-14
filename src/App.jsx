import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Search, RefreshCw, Undo, Redo, LayoutTemplate, Table as TableIcon, PieChart as ChartIcon, 
  Settings, LogOut, FileSpreadsheet, Check, Filter, List, Copy, Play, X, Plus, Trash2, ChevronDown
} from 'lucide-react';

// --- CẤU HÌNH ---
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// --- UTILS ---
const formatValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const secureCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        document.body.removeChild(textArea);
        return false;
    }
};

const exportToExcelXML = (data, columns, filename) => {
  const xmlHeader = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Borders/><Font ss:FontName="Arial" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/><Interior/><NumberFormat/><Protection/></Style><Style ss:ID="sHeader"><Font ss:FontName="Arial" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/><Interior ss:Color="#003366" ss:Pattern="Solid"/></Style><Style ss:ID="sText"><NumberFormat ss:Format="@"/></Style></Styles><Worksheet ss:Name="Sheet1"><Table>`;
  const xmlFooter = `</Table></Worksheet></Workbook>`;
  let xmlBody = '<Row>';
  columns.forEach(col => { xmlBody += `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${col}</Data></Cell>`; });
  xmlBody += '</Row>';
  data.forEach(row => {
    xmlBody += '<Row>';
    columns.forEach(col => {
      let val = row[col] !== undefined && row[col] !== null ? row[col] : '';
      val = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      xmlBody += `<Cell ss:StyleID="sText"><Data ss:Type="String">${val}</Data></Cell>`;
    });
    xmlBody += '</Row>';
  });
  const blob = new Blob([xmlHeader + xmlBody + xmlFooter], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- COMPONENTS ---

const LoginScreen = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        onLoginSuccess({
            name: userInfo.data.name,
            email: userInfo.data.email,
            imageUrl: userInfo.data.picture,
            accessToken: tokenResponse.access_token 
        });
      } catch (error) {
        console.error("Lỗi lấy thông tin user:", error);
        alert("Đăng nhập thành công nhưng không lấy được thông tin.");
      }
      setLoading(false);
    },
    onError: (error) => {
      console.error("Login Failed:", error);
      alert("Đăng nhập thất bại. Vui lòng kiểm tra console.");
    },
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-900 rounded-lg flex items-center justify-center mb-4">
            <LayoutTemplate className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wide">Hệ thống Quản lý Sinh viên</h1>
          <p className="text-slate-500 text-sm mt-2">Trường Kỹ thuật Phenikaa</p>
        </div>
        <button onClick={() => login()} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all group">
            {loading ? <RefreshCw className="animate-spin w-5 h-5 text-blue-900"/> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/>
                </svg>
            )}
            <span className="font-medium text-slate-700 group-hover:text-blue-900">
                {loading ? 'Đang kết nối...' : 'Đăng nhập bằng tài khoản Google'}
            </span>
        </button>
      </div>
    </motion.div>
  );
};

const SetupScreen = ({ onConfig }) => {
  const [sheetId, setSheetId] = useState(localStorage.getItem('sheet_id') || '');
  const [range, setRange] = useState(localStorage.getItem('sheet_range') || 'Sheet1!A:Z');
  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('sheet_id', sheetId);
    localStorage.setItem('sheet_range', range);
    onConfig(sheetId, range);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5" /> Cấu hình Nguồn Dữ liệu
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Spreadsheet ID</label>
            <input type="text" required value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Dán ID của Google Sheet vào đây..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Range</label>
            <input type="text" required value={range} onChange={(e) => setRange(e.target.value)} placeholder="Ví dụ: Sheet1!A:Z" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none" />
          </div>
          <button type="submit" className="w-full bg-blue-900 text-white py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium flex justify-center items-center gap-2">
            <Check className="w-4 h-4" /> Bắt đầu làm việc
          </button>
        </form>
      </div>
    </motion.div>
  );
};

const Dashboard = ({ user, config, onLogout }) => {
  const [rawData, setRawData] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [queryConfig, setQueryConfig] = useState({
    selectedCols: [],
    bulkFilter: { column: '', values: '' },
    filters: [{ id: 1, column: '', condition: 'contains', value: '' }]
  });

  const [resultState, setResultState] = useState({ data: [], visibleCols: [], isExecuted: false });
  const [selection, setSelection] = useState({ start: { row: null, col: null }, end: { row: null, col: null }, isDragging: false });
  const [history, setHistory] = useState({ past: [], future: [] });
  const [view, setView] = useState('table');
  const tableRef = useRef(null);

  const fetchGoogleSheetData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${config.range}?key=${API_KEY}`;
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${user.accessToken}` }
        });
        const result = response.data;
        const rows = result.values;
        if (!rows || rows.length === 0) {
            setLoadError("Không tìm thấy dữ liệu trong vùng đã chọn.");
            setLoading(false);
            return;
        }
        const headers = rows[0]; 
        const dataRows = rows.slice(1);
        const formattedData = dataRows.map((row, index) => {
            const rowObject = { 'STT': index + 1 };
            headers.forEach((header, i) => {
                rowObject[header] = row[i] ? String(row[i]) : ""; 
            });
            return rowObject;
        });
        setRawData(formattedData);
        setAllColumns(headers); 
        setQueryConfig(prev => ({ ...prev, selectedCols: headers.slice(0, 5) }));
    } catch (error) {
        console.error("Lỗi tải Sheet:", error);
        setLoadError(error.response?.status === 403 ? "Bạn không có quyền truy cập file này." : "Lỗi kết nối! Kiểm tra lại ID Sheet hoặc Mạng.");
    }
    setLoading(false);
  }, [config, user.accessToken]);

  useEffect(() => { fetchGoogleSheetData(); }, [fetchGoogleSheetData]);

  // --- UI HANDLERS ---
  useEffect(() => {
    const handleWindowMouseUp = () => { if (selection.isDragging) setSelection(prev => ({ ...prev, isDragging: false })); };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [selection.isDragging]);

  const addFilterCondition = () => setQueryConfig(prev => ({ ...prev, filters: [...prev.filters, { id: Date.now(), column: '', condition: 'contains', value: '' }] }));
  const removeFilterCondition = (id) => setQueryConfig(prev => ({ ...prev, filters: prev.filters.filter(f => f.id !== id) }));
  const updateFilter = (id, field, value) => setQueryConfig(prev => ({ ...prev, filters: prev.filters.map(f => f.id === id ? { ...f, [field]: value } : f) }));

  const runQuery = () => {
    setHistory(prev => ({ past: [...prev.past, { config: { ...queryConfig }, result: { ...resultState } }], future: [] }));
    let filtered = [...rawData];
    if (queryConfig.bulkFilter.values.trim() && queryConfig.bulkFilter.column) {
      const targetCol = queryConfig.bulkFilter.column;
      const lookupValues = new Set(queryConfig.bulkFilter.values.split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(s => s !== ''));
      if (lookupValues.size > 0) filtered = filtered.filter(row => lookupValues.has(String(row[targetCol]).toLowerCase()));
    }
    queryConfig.filters.forEach(filter => {
        if (filter.column && filter.value) {
            const lowerVal = filter.value.toLowerCase();
            filtered = filtered.filter(row => {
                const cellVal = String(row[filter.column] || '').toLowerCase();
                if (filter.condition === 'equals') return cellVal === lowerVal;
                if (filter.condition === 'contains') return cellVal.includes(lowerVal);
                if (filter.condition === 'starts') return cellVal.startsWith(lowerVal);
                return true;
            });
        }
    });
    setResultState({ data: filtered, visibleCols: queryConfig.selectedCols.length > 0 ? queryConfig.selectedCols : allColumns, isExecuted: true });
    setSelection({ start: {row: null, col: null}, end: {row: null, col: null}, isDragging: false });
    setView('table');
  };

  const handleUndo = () => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    setHistory({ past: history.past.slice(0, -1), future: [{ config: { ...queryConfig }, result: { ...resultState } }, ...history.future] });
    setQueryConfig(previous.config); setResultState(previous.result);
  };
  const handleRedo = () => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    setHistory({ past: [...history.past, { config: { ...queryConfig }, result: { ...resultState } }], future: history.future.slice(1) });
    setQueryConfig(next.config); setResultState(next.result);
  };
  const handleMouseDown = (rIdx, cIdx) => setSelection({ start: { row: rIdx, col: cIdx }, end: { row: rIdx, col: cIdx }, isDragging: true });
  const handleMouseEnter = (rIdx, cIdx) => { if (selection.isDragging) setSelection(prev => ({ ...prev, end: { row: rIdx, col: cIdx } })); };
  const getSelectionRange = useCallback(() => {
    const { start, end } = selection;
    if (start.row === null) return null;
    return { minR: Math.min(start.row, end.row), maxR: Math.max(start.row, end.row), minC: Math.min(start.col, end.col), maxC: Math.max(start.col, end.col) };
  }, [selection]);
  const handleCopy = useCallback(() => {
    const range = getSelectionRange();
    if (!range || !resultState.data.length) return;
    const { minR, maxR, minC, maxC } = range;
    const selectedRows = resultState.data.slice(minR, maxR + 1);
    const visibleCols = resultState.visibleCols;
    const textToCopy = selectedRows.map(row => {
        const rowValues = [];
        for (let c = minC; c <= maxC; c++) rowValues.push(formatValue(row[visibleCols[c]]));
        return rowValues.join('\t');
    }).join('\n');
    secureCopy(textToCopy);
  }, [getSelectionRange, resultState]);

  useEffect(() => {
    const handleKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); handleCopy(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy]);
  const isCellSelected = (r, c) => { const rg = getSelectionRange(); return rg && r >= rg.minR && r <= rg.maxR && c >= rg.minC && c <= rg.maxC; };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 text-white p-2 rounded"><LayoutTemplate size={20} /></div>
          <div><h1 className="font-bold text-blue-900 leading-tight">QUẢN LÝ SINH VIÊN</h1><p className="text-xs text-slate-500">Hệ thống Tra cứu & Phân tích dữ liệu</p></div>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => fetchGoogleSheetData()} className="p-2 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors" title="Tải lại dữ liệu"><RefreshCw size={18} /></button>
            <div className="h-6 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2 bg-slate-50 rounded p-1">
                <button onClick={handleUndo} disabled={history.past.length === 0} className="p-2 text-slate-600 disabled:opacity-30"><Undo size={18} /></button>
                <button onClick={handleRedo} disabled={history.future.length === 0} className="p-2 text-slate-600 disabled:opacity-30"><Redo size={18} /></button>
            </div>
            <div className="h-6 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
                {user.imageUrl && <img src={user.imageUrl} alt="Avatar" className="w-8 h-8 rounded-full" />}
                <span className="text-sm font-medium">{user.name}</span>
                <button onClick={onLogout} className="text-slate-400 hover:text-red-500"><LogOut size={18} /></button>
            </div>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
        {loadError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-center justify-between">
                <span>{loadError}</span>
                <button onClick={() => setLoadError(null)}><X size={18}/></button>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                 <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2"><Filter size={20} /> Query Builder</h2>
                 <span className="text-xs text-slate-500">{loading ? 'Đang tải dữ liệu...' : `Dữ liệu gốc: ${rawData.length} dòng`}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-3 border-r border-slate-100 pr-4 flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><List size={16} /> 1. Chọn cột hiển thị</label>
                    <div className="flex gap-2 text-xs mb-1">
                         <button onClick={() => setQueryConfig(p => ({...p, selectedCols: allColumns}))} className="text-blue-700 hover:underline">All</button>
                         <button onClick={() => setQueryConfig(p => ({...p, selectedCols: []}))} className="text-slate-500 hover:underline">None</button>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-48 border border-slate-200 rounded p-2 bg-slate-50 grid grid-cols-1 gap-1">
                        {allColumns.map(col => (
                            <label key={col} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded transition-colors">
                                <input type="checkbox" checked={queryConfig.selectedCols.includes(col)}
                                    onChange={() => setQueryConfig(p => ({...p, selectedCols: p.selectedCols.includes(col) ? p.selectedCols.filter(c => c !== col) : [...p.selectedCols, col]}))}
                                    className="rounded text-blue-900 focus:ring-blue-900" />
                                <span className="truncate">{col}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-6 flex flex-col gap-4 px-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Settings size={16} /> 2. Thiết lập điều kiện</label>
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                        <div className="flex justify-between mb-2"><span className="text-xs font-semibold uppercase text-slate-500">Lọc theo danh sách (Paste Excel)</span></div>
                        <div className="flex gap-2">
                             <select className="text-sm border border-slate-300 rounded px-2 py-1 w-1/3 bg-white"
                                value={queryConfig.bulkFilter.column} onChange={(e) => setQueryConfig(p => ({ ...p, bulkFilter: { ...p.bulkFilter, column: e.target.value } }))}>
                                <option value="">-- Cột đối chiếu --</option>
                                {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                             <input type="text" className="flex-1 border border-slate-300 rounded px-2 text-sm" placeholder="Paste danh sách mã SV, SĐT..."
                                value={queryConfig.bulkFilter.values} onChange={(e) => setQueryConfig(p => ({ ...p, bulkFilter: { ...p.bulkFilter, values: e.target.value } }))} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold uppercase text-slate-500">Điều kiện chi tiết (AND)</span>
                            <button onClick={addFilterCondition} className="text-xs flex items-center gap-1 text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"><Plus size={14} /> Thêm điều kiện</button>
                        </div>
                        <div className="max-h-32 overflow-y-auto pr-2 space-y-2">
                            {queryConfig.filters.map((filter, idx) => (
                                <div key={filter.id} className="flex gap-2 items-center text-sm">
                                    <span className="text-slate-400 font-mono text-xs w-4">{idx + 1}.</span>
                                    <select className="border border-slate-300 rounded px-2 py-1 w-1/3" value={filter.column} onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}>
                                        <option value="">(Chọn cột)</option>
                                        {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select className="border border-slate-300 rounded px-2 py-1 w-1/4" value={filter.condition} onChange={(e) => updateFilter(filter.id, 'condition', e.target.value)}>
                                        <option value="contains">Chứa</option>
                                        <option value="equals">Bằng tuyệt đối</option>
                                        <option value="starts">Bắt đầu với</option>
                                    </select>
                                    <input type="text" className="flex-1 border border-slate-300 rounded px-2 py-1" placeholder="Giá trị..." value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                    <button onClick={() => removeFilterCondition(filter.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 border-l border-slate-100 pl-4 flex flex-col justify-end pb-1">
                    <button onClick={runQuery} disabled={loading} className="w-full py-3 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg shadow-md font-bold flex items-center justify-center gap-2 transition-transform active:scale-95">
                        {loading ? <RefreshCw className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                        {loading ? 'ĐANG TẢI...' : 'CHẠY TRUY VẤN'}
                    </button>
                </div>
            </div>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-4 pt-2 border-b border-slate-200 bg-slate-50">
                 <div className="flex gap-2">
                    <button onClick={() => setView('table')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${view === 'table' ? 'bg-white text-blue-900 border-t border-x border-slate-200 -mb-px z-10' : 'text-slate-500'}`}><TableIcon size={16} /> Bảng Kết Quả</button>
                    <button onClick={() => setView('analytics')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${view === 'analytics' ? 'bg-white text-blue-900 border-t border-x border-slate-200 -mb-px z-10' : 'text-slate-500'}`}><ChartIcon size={16} /> Phân tích</button>
                 </div>
                 {resultState.isExecuted && view === 'table' && (
                     <div className="flex items-center gap-3 pb-1">
                        <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-1 rounded">{resultState.data.length} bản ghi</span>
                        <div className="h-4 w-px bg-slate-300"></div>
                        <button onClick={handleCopy} className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-900 font-medium"><Copy size={16} /> Copy Range</button>
                        <button onClick={() => exportToExcelXML(resultState.data, resultState.visibleCols, 'KetQuaLoc.xls')} className="flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium"><FileSpreadsheet size={16} /> Xuất Excel</button>
                     </div>
                 )}
            </div>

            <div className="flex-1 overflow-hidden relative">
                {!resultState.isExecuted ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                        <Search size={64} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">Vui lòng thiết lập điều kiện và chạy truy vấn</p>
                    </div>
                ) : (
                    view === 'table' ? (
                        <div className="h-full w-full overflow-auto select-none" ref={tableRef}> 
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                                    <tr>
                                        <th className="w-10 p-2 border border-slate-300 bg-slate-200 text-center">#</th>
                                        {resultState.visibleCols.map((col, cIdx) => (
                                            <th key={col} className="p-2 border border-slate-300 whitespace-nowrap"><div className="flex items-center gap-1">{col} <ChevronDown size={12} className="opacity-50"/></div></th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultState.data.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                            <td className="p-2 border border-slate-300 text-center text-xs text-slate-500 bg-slate-50">{rIdx + 1}</td>
                                            {resultState.visibleCols.map((col, cIdx) => (
                                                <td key={`${rIdx}-${col}`} 
                                                    onMouseDown={() => handleMouseDown(rIdx, cIdx)} onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                                                    className={`p-2 border border-slate-300 whitespace-nowrap cursor-cell ${isCellSelected(rIdx, cIdx) ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'}`}>
                                                    {formatValue(row[col])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : ( <OnDemandAnalytics data={resultState.data} /> )
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

// --- COMPONENT PHÂN TÍCH MỚI (ĐÃ CẬP NHẬT) ---
const OnDemandAnalytics = ({ data }) => {
    const [activeCharts, setActiveCharts] = useState([]);
    
    // Logic tính toán thống kê dựa trên dữ liệu thật
    const stats = useMemo(() => {
        if (data.length === 0) return {};
        const firstRow = data[0];
        const keys = Object.keys(firstRow);

        // Hàm tìm cột linh hoạt (không phân biệt hoa thường)
        const findKey = (keyword) => keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));

        // Tự động map các cột dữ liệu quan trọng
        const colClass = findKey('Lớp') || keys[1];
        const colStatus = findKey('Trạng thái') || findKey('Status');
        const colGender = findKey('Giới tính') || findKey('Phái');
        const colMethod = findKey('Hình thức xét tuyển') || findKey('Xét tuyển');
        const colArea = findKey('Khu vực') || findKey('KV');
        const colParty = findKey('Ngày kết nạp Đảng') || findKey('Ngày vào Đảng');
        const colMajor = findKey('Ngành') || findKey('Chương trình') || keys[2];
        const colCourse = findKey('Khoá') || findKey('Khóa đào tạo');

        const counts = { 
            class: {}, status: {}, gender: {}, method: {}, area: {}, party: {}, major: {}, course: {} 
        };

        data.forEach(item => {
            counts.class[item[colClass] || 'Khác'] = (counts.class[item[colClass] || 'Khác'] || 0) + 1;
            counts.major[item[colMajor] || 'Khác'] = (counts.major[item[colMajor] || 'Khác'] || 0) + 1;
            if(colStatus) counts.status[item[colStatus] || 'N/A'] = (counts.status[item[colStatus] || 'N/A'] || 0) + 1;
            if(colGender) counts.gender[item[colGender] || 'N/A'] = (counts.gender[item[colGender] || 'N/A'] || 0) + 1;
            if(colMethod) counts.method[item[colMethod] || 'N/A'] = (counts.method[item[colMethod] || 'N/A'] || 0) + 1;
            if(colArea) counts.area[item[colArea] || 'N/A'] = (counts.area[item[colArea] || 'N/A'] || 0) + 1;
            if(colCourse) counts.course[item[colCourse] || 'N/A'] = (counts.course[item[colCourse] || 'N/A'] || 0) + 1;
            
            // Logic Đảng viên: Nếu có ngày nhập -> Là Đảng viên
            if(colParty) {
                const isMember = item[colParty] && item[colParty].trim().length > 4 ? 'Đảng viên' : 'Quần chúng';
                counts.party[isMember] = (counts.party[isMember] || 0) + 1;
            }
        });

        // Hàm chuyển đổi object thành array cho Recharts
        const toArr = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

        return {
            class: toArr(counts.class).slice(0, 15), // Chỉ lấy Top 15 lớp đông nhất
            major: toArr(counts.major),
            status: toArr(counts.status),
            gender: toArr(counts.gender),
            method: toArr(counts.method),
            area: toArr(counts.area),
            party: toArr(counts.party),
            course: toArr(counts.course),
            hasCol: { status: !!colStatus, gender: !!colGender, method: !!colMethod, area: !!colArea, party: !!colParty, course: !!colCourse }
        };
    }, [data]);

    const toggleChart = (id) => setActiveCharts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    const COLORS = ['#003366', '#0055AA', '#0077EE', '#4499FF', '#88BBFF', '#CCDDEE', '#FFBB28', '#FF8042'];

    const CHART_CONFIG = [
        { id: 'status', label: 'Trạng thái Sinh viên', type: 'pie', show: stats.hasCol?.status },
        { id: 'gender', label: 'Cơ cấu Giới tính', type: 'pie', show: stats.hasCol?.gender },
        { id: 'method', label: 'Hình thức Xét tuyển', type: 'bar', show: stats.hasCol?.method },
        { id: 'area', label: 'Khu vực Ưu tiên', type: 'bar', show: stats.hasCol?.area },
        { id: 'party', label: 'Tỉ lệ Đảng viên', type: 'pie', show: stats.hasCol?.party },
        { id: 'course', label: 'Quy mô Khóa đào tạo', type: 'bar', show: stats.hasCol?.course },
        { id: 'major', label: 'Phân bố theo Ngành', type: 'pie', show: true },
        { id: 'class', label: 'Top Lớp đông nhất', type: 'bar', show: true },
    ];

    return (
        <div className="h-full overflow-y-auto p-6 bg-slate-50">
            <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">Thêm biểu đồ vào Báo cáo</h3>
                <div className="flex flex-wrap gap-2">
                    {CHART_CONFIG.filter(c => c.show).map(opt => (
                        <button key={opt.id} onClick={() => toggleChart(opt.id)}
                            className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2
                                ${activeCharts.includes(opt.id) ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-900 hover:text-blue-900'}`}>
                            {activeCharts.includes(opt.id) ? <Check size={14} /> : <Plus size={14} />} {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                <AnimatePresence>
                    {activeCharts.map(chartId => {
                        const config = CHART_CONFIG.find(c => c.id === chartId);
                        const chartData = stats[chartId];
                        if (!config || !chartData) return null;

                        return (
                            <motion.div key={chartId} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-80 flex flex-col relative group">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-blue-900">{config.label}</h4>
                                    <button onClick={() => toggleChart(chartId)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={18} /></button>
                                </div>
                                <div className="flex-1 min-h-0 text-xs">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {config.type === 'pie' ? (
                                            <PieChart>
                                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                                </Pie>
                                                <RechartsTooltip />
                                                <Legend />
                                            </PieChart>
                                        ) : (
                                            <BarChart data={chartData} layout={chartData.length > 8 ? 'vertical' : 'horizontal'}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                {chartData.length > 8 ? <XAxis type="number"/> : <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={60}/>}
                                                {chartData.length > 8 ? <YAxis dataKey="name" type="category" width={100}/> : <YAxis />}
                                                <RechartsTooltip cursor={{fill: '#f0f9ff'}} />
                                                <Bar dataKey="value" fill="#003366" radius={[4, 4, 0, 0]} name="Số lượng" />
                                            </BarChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
            
            {activeCharts.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-xl bg-slate-100">
                    <p className="text-slate-500 font-medium">Chưa có biểu đồ nào được chọn</p>
                    <p className="text-slate-400 text-sm mt-1">Vui lòng chọn các mục ở trên để hiển thị phân tích</p>
                </div>
            )}
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [sheetConfig, setSheetConfig] = useState(null);
  const handleLoginSuccess = (u) => setUser(u);
  const handleConfig = (id, range) => setSheetConfig({ id, range });
  const handleLogout = () => { setUser(null); setSheetConfig(null); };

  if (!user) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  if (!sheetConfig) return <SetupScreen onConfig={handleConfig} />;
  return <Dashboard user={user} config={sheetConfig} onLogout={handleLogout} />;
}