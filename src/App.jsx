import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// FIREBASE IMPORTS
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

import { motion, AnimatePresence } from 'framer-motion';
// Import thêm các biểu đồ mới cho Dashboard
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Search, RefreshCw, Undo, Redo, LayoutTemplate, Table as TableIcon, PieChart as ChartIcon, 
  Settings, LogOut, Check, Filter, List, Copy, Play, X, Plus, Trash2, ChevronDown, 
  GripVertical, ChevronUp, History, Database, ArrowLeft, ArrowRight, BarChart3, LineChart as LineIcon, PieChart as PieIcon
} from 'lucide-react';

// --- CẤU HÌNH ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
googleProvider.setCustomParameters({ prompt: 'consent' }); 

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
    try { document.execCommand('copy'); document.body.removeChild(textArea); return true; } 
    catch (err) { document.body.removeChild(textArea); return false; }
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

const ColumnSelectorModal = ({ isOpen, onClose, columns, onSelect, title = "Chọn cột dữ liệu" }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef(null);
    useEffect(() => { if (isOpen && inputRef.current) setTimeout(() => inputRef.current.focus(), 100); setSearchTerm(""); }, [isOpen]);
    if (!isOpen) return null;
    const filteredCols = columns.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-blue-900">{title}</h3><button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
                <div className="p-3 bg-slate-50 border-b border-slate-100"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input ref={inputRef} type="text" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Tìm kiếm tên cột..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
                <div className="flex-1 overflow-y-auto p-2">{filteredCols.length > 0 ? (<div className="grid grid-cols-1 gap-1">{filteredCols.map(col => (<button key={col} onClick={() => { onSelect(col); onClose(); }} className="text-left px-4 py-3 hover:bg-blue-50 rounded-lg text-sm text-slate-700 hover:text-blue-900 transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>{col}</button>))}</div>) : (<div className="p-8 text-center text-slate-400 text-sm">Không tìm thấy cột nào</div>)}</div>
            </motion.div>
        </div>
    );
};

// --- LOGIN ---
const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    setLoading(true);
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        if (token) localStorage.setItem('pka_google_sheet_token', token);
    } catch (error) {
        console.error("Login Error:", error);
        alert(`Lỗi đăng nhập: ${error.message}`);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-900 rounded-lg flex items-center justify-center mb-4"><LayoutTemplate className="text-white w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wide">PKA Management</h1>
          <p className="text-slate-500 text-sm mt-2">Trường Kỹ thuật Phenikaa</p>
        </div>
        <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all group">
            {loading ? <RefreshCw className="animate-spin w-5 h-5 text-blue-900"/> : (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/></svg>)}
            <span className="font-medium text-slate-700 group-hover:text-blue-900">{loading ? 'Đang kết nối...' : 'Đăng nhập bằng Google'}</span>
        </button>
      </div>
    </motion.div>
  );
};

// --- SETUP SCREEN ---
const SetupScreen = ({ user, onConfig }) => {
  const [sheetId, setSheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A:Z');
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().history) {
                const saved = docSnap.data().history;
                setHistory(saved);
                if (saved.length > 0) { setSheetId(saved[0].id); setRange(saved[0].range); }
            }
        } catch (err) { console.error("Lỗi tải lịch sử:", err); }
        setIsLoadingHistory(false);
    };
    loadHistory();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newEntry = { id: sheetId, range: range, date: new Date().toLocaleDateString('vi-VN') };
    const newHistory = [newEntry, ...history.filter(h => h.id !== sheetId)].slice(0, 5);
    try { await setDoc(doc(db, "users", user.uid), { history: newHistory }, { merge: true }); } catch (e) { console.error(e); }
    onConfig(sheetId, range);
  };

  const deleteHistoryItem = async (e, idToDelete) => {
      e.stopPropagation();
      const updatedHistory = history.filter(h => h.id !== idToDelete);
      setHistory(updatedHistory);
      try { await setDoc(doc(db, "users", user.uid), { history: updatedHistory }, { merge: true }); } catch (e) { console.error(e); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-lg p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2"><Settings className="w-5 h-5" /> Cấu hình Nguồn Dữ liệu</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Spreadsheet ID</label><input type="text" required value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Dán ID của Google Sheet..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Data Range</label><input type="text" required value={range} onChange={(e) => setRange(e.target.value)} placeholder="Ví dụ: Sheet1!A:Z" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none" /></div>
          <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><History size={12}/> Đã dùng gần đây {isLoadingHistory && "(Đang đồng bộ...)"}</p>
              <div className="space-y-2">
                  {history.map((h, idx) => (
                      <div key={idx} onClick={() => { setSheetId(h.id); setRange(h.range); }} className="group relative text-xs p-2 bg-slate-50 hover:bg-blue-50 rounded cursor-pointer border border-slate-200 hover:border-blue-200 transition-colors">
                          <div className="font-medium text-slate-700 truncate pr-6">{h.id}</div>
                          <div className="text-slate-400 flex justify-between mt-1"><span>{h.range}</span> <span>{h.date}</span></div>
                          <button onClick={(e) => deleteHistoryItem(e, h.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                      </div>
                  ))}
                  {history.length === 0 && !isLoadingHistory && <p className="text-xs text-slate-300 italic">Chưa có lịch sử</p>}
              </div>
          </div>
          <button type="submit" className="w-full bg-blue-900 text-white py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium flex justify-center items-center gap-2 mt-4"><Check className="w-4 h-4" /> Kết nối Dữ liệu</button>
        </form>
      </div>
    </motion.div>
  );
};

// --- DASHBOARD ---
const Dashboard = ({ user, config, onLogout, onChangeSource }) => {
  const [rawData, setRawData] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const [isQueryBuilderOpen, setIsQueryBuilderOpen] = useState(true);
  const [colSearchTerm, setColSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: '', id: null });

  const [queryConfig, setQueryConfig] = useState({
    selectedCols: [],
    bulkFilter: { column: '', values: '' },
    filters: [{ id: 1, column: '', condition: 'contains', value: '', operator: 'AND' }]
  });

  const [resultState, setResultState] = useState({ data: [], visibleCols: [], isExecuted: false });
  const [selection, setSelection] = useState({ start: { row: null, col: null }, end: { row: null, col: null }, isDragging: false });
  const [history, setHistory] = useState({ past: [], future: [] });
  const [view, setView] = useState('table');
  const [columnWidths, setColumnWidths] = useState({});
  const resizingRef = useRef(null);
  const tableRef = useRef(null);

  const fetchGoogleSheetData = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
        const token = localStorage.getItem('pka_google_sheet_token');
        if (!token) throw new Error("TOKEN_MISSING");

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${config.range}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (response.status === 401 || response.status === 403) throw new Error("TOKEN_INVALID");
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();
        const rows = result.values;
        if (!rows || rows.length === 0) { setLoadError("Không tìm thấy dữ liệu."); setLoading(false); return; }
        
        const headers = rows[0]; 
        const dataRows = rows.slice(1);
        const formattedData = dataRows.map((row, index) => {
            const rowObject = { 'STT': index + 1 };
            headers.forEach((header, i) => { rowObject[header] = row[i] ? String(row[i]) : ""; });
            return rowObject;
        });
        setRawData(formattedData); setAllColumns(headers); 
        setQueryConfig(prev => ({ ...prev, selectedCols: headers.slice(0, 5) }));
        const initWidths = {}; headers.forEach(h => initWidths[h] = 150); setColumnWidths(initWidths);

    } catch (error) {
        console.error("Fetch Error:", error);
        if (error.message === "TOKEN_MISSING" || error.message === "TOKEN_INVALID") {
            alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
            onLogout();
        } else {
            setLoadError(`Lỗi kết nối: ${error.message}`);
        }
    }
    setLoading(false);
  }, [config, onLogout]);

  useEffect(() => { fetchGoogleSheetData(); }, [fetchGoogleSheetData]);

  const openColumnModal = (type, id = null) => { setModalTarget({ type, id }); setIsModalOpen(true); };
  const handleColumnSelect = (colName) => {
      if (modalTarget.type === 'bulk') setQueryConfig(p => ({ ...p, bulkFilter: { ...p.bulkFilter, column: colName } }));
      else if (modalTarget.type === 'filter') updateFilter(modalTarget.id, 'column', colName);
  };

  const addFilterCondition = () => setQueryConfig(prev => ({ ...prev, filters: [...prev.filters, { id: Date.now(), column: '', condition: 'contains', value: '', operator: 'AND' }] }));
  const removeFilterCondition = (id) => setQueryConfig(prev => ({ ...prev, filters: prev.filters.filter(f => f.id !== id) }));
  const updateFilter = (id, field, value) => setQueryConfig(prev => ({ ...prev, filters: prev.filters.map(f => f.id === id ? { ...f, [field]: value } : f) }));

  const checkCondition = (row, filter) => {
      if (!filter.column || !filter.value) return true; 
      const cellVal = String(row[filter.column] || '').toLowerCase();
      const searchVal = filter.value.toLowerCase();
      switch (filter.condition) {
          case 'contains': return cellVal.includes(searchVal);
          case 'not_contains': return !cellVal.includes(searchVal);
          case 'equals': return cellVal === searchVal;
          case 'not_equals': return cellVal !== searchVal;
          case 'starts': return cellVal.startsWith(searchVal);
          case 'greater': return parseFloat(cellVal) >= parseFloat(searchVal);
          case 'less': return parseFloat(cellVal) <= parseFloat(searchVal);
          default: return true;
      }
  };

  const runQuery = () => {
    setHistory(prev => ({ past: [...prev.past, { config: { ...queryConfig }, result: { ...resultState } }], future: [] }));
    let filtered = [...rawData];
    
    // BULK FILTER FIX
    if (queryConfig.bulkFilter.values.trim() && queryConfig.bulkFilter.column) {
      const targetCol = queryConfig.bulkFilter.column;
      const rawValues = queryConfig.bulkFilter.values.split(/[\n\r\t,]+/); 
      const lookupValues = new Set(rawValues.map(s => s.trim().toLowerCase()).filter(s => s !== ''));
      
      if (lookupValues.size > 0) {
          filtered = filtered.filter(row => {
              const cellVal = String(row[targetCol]).trim().toLowerCase();
              return lookupValues.has(cellVal);
          });
      }
    }

    filtered = filtered.filter(row => {
        let result = true; 
        queryConfig.filters.forEach((filter, index) => {
            const isMatch = checkCondition(row, filter);
            if (index === 0) result = isMatch;
            else if (filter.operator === 'AND') result = result && isMatch;
            else if (filter.operator === 'OR') result = result || isMatch;
        });
        return result;
    });

    setResultState({ data: filtered, visibleCols: queryConfig.selectedCols.length > 0 ? queryConfig.selectedCols : allColumns, isExecuted: true });
    setCurrentPage(1);
    setView('table'); if (window.innerWidth < 768) setIsQueryBuilderOpen(false);
  };

  // RESIZE & UI
  useEffect(() => {
    const handleMouseMove = (e) => { if (resizingRef.current) { const { col, startX, startWidth } = resizingRef.current; setColumnWidths(prev => ({ ...prev, [col]: Math.max(50, startWidth + (e.clientX - startX)) })); }};
    const handleMouseUp = () => { resizingRef.current = null; document.body.style.cursor = 'default'; };
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, []);
  const startResizing = (e, col) => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { col, startX: e.clientX, startWidth: columnWidths[col] || 150 }; document.body.style.cursor = 'col-resize'; };
  const handleDragStart = (e, ci) => e.dataTransfer.setData("colIndex", ci);
  const handleDrop = (e, ti) => { const si = parseInt(e.dataTransfer.getData("colIndex")); if (si === ti) return; const nc = [...resultState.visibleCols]; const [mc] = nc.splice(si, 1); nc.splice(ti, 0, mc); setResultState(p => ({ ...p, visibleCols: nc })); };
  const handleUndo = () => { if (history.past.length === 0) return; const prev = history.past[history.past.length - 1]; setHistory({ past: history.past.slice(0, -1), future: [{ config: { ...queryConfig }, result: { ...resultState } }, ...history.future] }); setQueryConfig(prev.config); setResultState(prev.result); };
  const handleRedo = () => { if (history.future.length === 0) return; const next = history.future[0]; setHistory({ past: [...history.past, { config: { ...queryConfig }, result: { ...resultState } }], future: history.future.slice(1) }); setQueryConfig(next.config); setResultState(next.result); };
  
  const handleMouseDown = (r, c) => setSelection({ start: { row: r, col: c }, end: { row: r, col: c }, isDragging: true });
  const handleMouseEnter = (r, c) => { if (selection.isDragging) setSelection(prev => ({ ...prev, end: { row: r, col: c } })); };
  useEffect(() => { const up = () => { if (selection.isDragging) setSelection(p => ({ ...p, isDragging: false })); }; window.addEventListener('mouseup', up); return () => window.removeEventListener('mouseup', up); }, [selection.isDragging]);
  const getSelectionRange = useCallback(() => { const { start, end } = selection; if (start.row === null) return null; return { minR: Math.min(start.row, end.row), maxR: Math.max(start.row, end.row), minC: Math.min(start.col, end.col), maxC: Math.max(start.col, end.col) }; }, [selection]);
  const handleCopy = useCallback(() => { 
      const rg = getSelectionRange(); if (!rg || !resultState.data.length) return; 
      const pageData = resultState.data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      const rows = pageData.slice(rg.minR, rg.maxR + 1); const cols = resultState.visibleCols; 
      const txt = rows.map(r => { const vals = []; for (let c = rg.minC; c <= rg.maxC; c++) vals.push(formatValue(r[cols[c]])); return vals.join('\t'); }).join('\n'); secureCopy(txt); 
  }, [getSelectionRange, resultState, currentPage]);
  useEffect(() => { const kd = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); handleCopy(); } }; window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd); }, [handleCopy]);
  const isCellSelected = (r, c) => { const rg = getSelectionRange(); return rg && r >= rg.minR && r <= rg.maxR && c >= rg.minC && c <= rg.maxC; };
  const filteredColumns = allColumns.filter(c => c.toLowerCase().includes(colSearchTerm.toLowerCase()));

  const currentTableData = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return resultState.data.slice(start, start + ITEMS_PER_PAGE);
  }, [resultState.data, currentPage]);
  const totalPages = Math.ceil(resultState.data.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3"><div className="bg-blue-900 text-white p-2 rounded hidden md:block"><LayoutTemplate size={20} /></div><div><h1 className="font-bold text-blue-900 leading-tight text-sm md:text-base">PKA MANAGEMENT</h1><p className="text-xs text-slate-500 hidden md:block">Hệ thống Tra cứu & Phân tích dữ liệu</p></div></div>
        <div className="flex items-center gap-2 md:gap-4">
            <button onClick={onChangeSource} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"><Database size={14} /> <span className="hidden md:inline">Đổi nguồn</span></button>
            <button onClick={() => fetchGoogleSheetData()} className="p-2 text-blue-700 bg-blue-50 rounded hover:bg-blue-100" title="Tải lại"><RefreshCw size={18} /></button>
            <div className="hidden md:flex items-center gap-2 bg-slate-50 rounded p-1"><button onClick={handleUndo} disabled={history.past.length === 0} className="p-2 text-slate-600 disabled:opacity-30"><Undo size={18} /></button><button onClick={handleRedo} disabled={history.future.length === 0} className="p-2 text-slate-600 disabled:opacity-30"><Redo size={18} /></button></div>
            <div className="flex items-center gap-2">{user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />}<button onClick={onLogout} className="text-slate-400 hover:text-red-500 ml-2" title="Đăng xuất"><LogOut size={18} /></button></div>
        </div>
      </header>

      <main className="flex-1 p-3 md:p-6 overflow-hidden flex flex-col gap-4 md:gap-6">
        {loadError && (<div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-center justify-between"><span>{loadError}</span><button onClick={() => setLoadError(null)}><X size={18}/></button></div>)}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 cursor-pointer" onClick={() => setIsQueryBuilderOpen(!isQueryBuilderOpen)}>
                 <h2 className="text-base md:text-lg font-bold text-blue-900 flex items-center gap-2"><Filter size={20} /> Query Builder {!isQueryBuilderOpen && <span className="text-xs font-normal text-slate-400 ml-2">(Mở rộng)</span>}</h2>
                 <div className="flex items-center gap-2"><span className="text-xs text-slate-500 hidden md:inline">{loading ? 'Đang tải...' : `Source: ${rawData.length} dòng`}</span>{isQueryBuilderOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}</div>
            </div>

            <AnimatePresence>
            {isQueryBuilderOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                    <div className="lg:col-span-3 border-r border-slate-100 lg:pr-4 flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><List size={16} /> 1. Chọn cột hiển thị</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2 text-slate-400"/>
                            <input type="text" placeholder="Tìm tên cột..." className="w-full pl-8 pr-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 outline-none" value={colSearchTerm} onChange={(e) => setColSearchTerm(e.target.value)} />
                            {colSearchTerm && <button onClick={() => setColSearchTerm('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-red-500"><X size={14}/></button>}
                        </div>
                        <div className="flex gap-2 text-xs mb-1"><button onClick={() => setQueryConfig(p => ({...p, selectedCols: allColumns}))} className="text-blue-700 hover:underline">All</button><button onClick={() => setQueryConfig(p => ({...p, selectedCols: []}))} className="text-slate-500 hover:underline">None</button></div>
                        <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] border border-slate-200 rounded p-2 bg-slate-50 grid grid-cols-2 gap-x-2 gap-y-1 content-start">{filteredColumns.map(col => (<label key={col} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors" title={col}><input type="checkbox" checked={queryConfig.selectedCols.includes(col)} onChange={() => setQueryConfig(p => ({...p, selectedCols: p.selectedCols.includes(col) ? p.selectedCols.filter(c => c !== col) : [...p.selectedCols, col]}))} className="rounded text-blue-900 focus:ring-blue-900 shrink-0" /><span className="truncate">{col}</span></label>))}</div>
                    </div>

                    <div className="lg:col-span-6 flex flex-col gap-4 lg:px-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Settings size={16} /> 2. Thiết lập điều kiện</label>
                        <div className="bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex justify-between mb-2"><span className="text-xs font-semibold uppercase text-slate-500">Lọc theo danh sách (Paste Excel)</span></div>
                            <div className="flex flex-col md:flex-row gap-2">
                                <div onClick={() => openColumnModal('bulk')} className="w-full md:w-1/3 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-pointer hover:border-blue-500 flex justify-between items-center"><span className={`truncate ${!queryConfig.bulkFilter.column ? 'text-slate-400' : 'text-slate-800'}`}>{queryConfig.bulkFilter.column || "Cột đối chiếu"}</span><ChevronDown size={14} className="text-slate-400"/></div>
                                <textarea className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm min-h-[40px] max-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Paste danh sách mã SV, SĐT..." value={queryConfig.bulkFilter.values} onChange={(e) => setQueryConfig(p => ({ ...p, bulkFilter: { ...p.bulkFilter, values: e.target.value } }))} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase text-slate-500">Điều kiện chi tiết</span><button onClick={addFilterCondition} className="text-xs flex items-center gap-1 text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"><Plus size={14} /> Thêm điều kiện</button></div>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                {queryConfig.filters.map((filter, idx) => (
                                    <div key={filter.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center text-sm border-b md:border-none border-slate-100 pb-2 md:pb-0">
                                        <div className="flex items-center gap-1">{idx > 0 ? (<select className="border border-slate-300 bg-slate-100 rounded px-1 py-2 text-xs font-bold w-16" value={filter.operator} onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}><option value="AND">VÀ</option><option value="OR">HOẶC</option></select>) : <span className="text-slate-400 font-mono text-xs w-16 text-center">Bắt đầu</span>}</div>
                                        <div onClick={() => openColumnModal('filter', filter.id)} className="flex-1 border border-slate-300 rounded px-3 py-2 cursor-pointer hover:border-blue-500 bg-white flex justify-between items-center"><span className={`truncate ${!filter.column ? 'text-slate-400' : 'text-slate-800'}`}>{filter.column || "(Chọn cột)"}</span><ChevronDown size={14} className="text-slate-400"/></div>
                                        <select className="border border-slate-300 rounded px-2 py-2 w-full md:w-1/4" value={filter.condition} onChange={(e) => updateFilter(filter.id, 'condition', e.target.value)}><option value="contains">Chứa</option><option value="not_contains">Không chứa</option><option value="equals">Bằng tuyệt đối</option><option value="not_equals">Khác</option><option value="starts">Bắt đầu với</option><option value="greater">Lớn hơn</option><option value="less">Nhỏ hơn</option></select>
                                        <input type="text" className="flex-1 border border-slate-300 rounded px-3 py-2 w-full" placeholder="Giá trị..." value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                        <button onClick={() => removeFilterCondition(filter.id)} className="text-red-400 hover:text-red-600 p-1 self-end md:self-center"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 border-l border-slate-100 lg:pl-4 flex flex-col justify-end pb-1">
                        <button onClick={runQuery} disabled={loading} className="w-full py-3 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg shadow-md font-bold flex items-center justify-center gap-2 transition-transform active:scale-95">
                            {loading ? <RefreshCw className="animate-spin" /> : <Play size={20} fill="currentColor" />} {loading ? 'ĐANG TẢI...' : 'CHẠY TRUY VẤN'}
                        </button>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex flex-wrap gap-2 justify-between items-center px-4 pt-2 border-b border-slate-200 bg-slate-50">
                 <div className="flex gap-2"><button onClick={() => setView('table')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${view === 'table' ? 'bg-white text-blue-900 border-t border-x border-slate-200 -mb-px z-10' : 'text-slate-500'}`}><TableIcon size={16} /> Kết Quả</button><button onClick={() => setView('analytics')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${view === 'analytics' ? 'bg-white text-blue-900 border-t border-x border-slate-200 -mb-px z-10' : 'text-slate-500'}`}><ChartIcon size={16} /> Phân tích</button></div>
                 {resultState.isExecuted && view === 'table' && (<div className="flex items-center gap-2 pb-1 overflow-x-auto"><span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">{resultState.data.length} dòng</span><div className="h-4 w-px bg-slate-300"></div><button onClick={handleCopy} className="flex items-center gap-1 text-xs md:text-sm text-slate-600 hover:text-blue-900 font-medium whitespace-nowrap"><Copy size={16} /> Copy</button><button onClick={() => exportToExcelXML(resultState.data, resultState.visibleCols, 'KetQua.xls')} className="flex items-center gap-1 text-xs md:text-sm text-green-700 hover:text-green-800 font-medium whitespace-nowrap"><FileSpreadsheet size={16} /> Excel</button></div>)}
            </div>
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {!resultState.isExecuted ? (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-4 text-center"><Search size={64} className="mb-4 opacity-20" /><p className="text-lg font-medium">Vui lòng thiết lập điều kiện và chạy truy vấn</p></div>) : (
                    view === 'table' ? (
                        <>
                            <div className="flex-1 overflow-auto select-none" ref={tableRef}><table className="min-w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}><thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm"><tr><th className="w-10 p-2 border border-slate-300 bg-slate-200 text-center sticky left-0 z-20">#</th>{resultState.visibleCols.map((col, cIdx) => (<th key={col} style={{ width: columnWidths[col] || 150 }} className="relative p-2 border border-slate-300 group hover:bg-blue-50 transition-colors" draggable onDragStart={(e) => handleDragStart(e, cIdx)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, cIdx)}><div className="flex items-center justify-between gap-1 w-full overflow-hidden cursor-grab active:cursor-grabbing"><span className="truncate" title={col}>{col}</span><GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" /></div><div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-10" onMouseDown={(e) => startResizing(e, col)} /></th>))}</tr></thead><tbody>{currentTableData.map((row, rIdx) => (<tr key={rIdx} className="hover:bg-slate-50"><td className="p-2 border border-slate-300 text-center text-xs text-slate-500 bg-slate-50 sticky left-0 z-10">{(currentPage - 1) * ITEMS_PER_PAGE + rIdx + 1}</td>{resultState.visibleCols.map((col, cIdx) => (<td key={`${rIdx}-${col}`} onMouseDown={() => handleMouseDown(rIdx, cIdx)} onMouseEnter={() => handleMouseEnter(rIdx, cIdx)} className={`p-2 border border-slate-300 whitespace-nowrap overflow-hidden cursor-cell ${isCellSelected(rIdx, cIdx) ? 'bg-blue-600 text-white' : ''}`}>{formatValue(row[col])}</td>))}</tr>))}</tbody></table></div>
                            <div className="bg-white border-t border-slate-200 p-2 flex justify-between items-center"><span className="text-xs text-slate-500">Trang {currentPage} / {totalPages}</span><div className="flex gap-2"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ArrowLeft size={16}/></button><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ArrowRight size={16}/></button></div></div>
                        </>
                    ) : ( <SuperAnalytics data={resultState.data} /> )
                )}
            </div>
        </div>
      </main>
      
      <ColumnSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} columns={allColumns} onSelect={handleColumnSelect} />
    </div>
  );
};

// --- SUPER ANALYTICS DASHBOARD (New!) ---
const SuperAnalytics = ({ data }) => {
    if (!data || data.length === 0) return <div className="p-10 text-center text-slate-400">Không có dữ liệu để phân tích</div>;

    const [chartType, setChartType] = useState('bar');
    const [xAxisKey, setXAxisKey] = useState('');
    const [yAxisKey, setYAxisKey] = useState('count'); // 'count' or specific numeric column
    const [aggType, setAggType] = useState('count'); // count, sum, avg

    const columns = Object.keys(data[0]);

    // Auto-detect good default Axis
    useEffect(() => {
        const potentialX = columns.find(c => ['Lớp', 'Ngành', 'Khoa', 'Trạng thái', 'Giới tính'].some(k => c.includes(k))) || columns[1];
        setXAxisKey(potentialX);
    }, []);

    const processedData = useMemo(() => {
        if (!xAxisKey) return [];
        
        // 1. Group Data
        const grouped = data.reduce((acc, row) => {
            const key = row[xAxisKey] || 'N/A';
            if (!acc[key]) acc[key] = { name: key, count: 0, sum: 0, values: [] };
            
            acc[key].count += 1;
            if (yAxisKey !== 'count') {
                const val = parseFloat(row[yAxisKey]);
                if (!isNaN(val)) {
                    acc[key].sum += val;
                    acc[key].values.push(val);
                }
            }
            return acc;
        }, {});

        // 2. Aggregate
        return Object.values(grouped).map(item => {
            let value = item.count;
            if (yAxisKey !== 'count') {
                if (aggType === 'sum') value = item.sum;
                if (aggType === 'avg') value = item.values.length ? (item.sum / item.values.length).toFixed(2) : 0;
            }
            return { name: item.name, value: Number(value) };
        }).sort((a, b) => b.value - a.value); // Sort descending
    }, [data, xAxisKey, yAxisKey, aggType]);

    const COLORS = ['#003366', '#0055AA', '#0077EE', '#4499FF', '#88BBFF', '#FF8042', '#FFBB28'];

    const renderChart = () => {
        const CommonAxis = <><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Legend /></>;
        
        switch (chartType) {
            case 'line': return <LineChart data={processedData}>{CommonAxis}<Line type="monotone" dataKey="value" stroke="#003366" strokeWidth={2} /></LineChart>;
            case 'area': return <AreaChart data={processedData}>{CommonAxis}<Area type="monotone" dataKey="value" fill="#003366" stroke="#003366" /></AreaChart>;
            case 'pie': return <PieChart><Pie data={processedData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{processedData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart>;
            default: return <BarChart data={processedData}>{CommonAxis}<Bar dataKey="value" fill="#003366" /></BarChart>;
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Dashboard Controls */}
            <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Loại biểu đồ</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['bar', 'line', 'area', 'pie'].map(type => (
                            <button key={type} onClick={() => setChartType(type)} className={`flex-1 p-1 rounded ${chartType === type ? 'bg-white shadow text-blue-900' : 'text-slate-400 hover:text-slate-600'}`}>
                                {type === 'bar' && <BarChart3 size={16} className="mx-auto"/>}
                                {type === 'line' && <LineIcon size={16} className="mx-auto"/>}
                                {type === 'area' && <Database size={16} className="mx-auto"/>}
                                {type === 'pie' && <PieIcon size={16} className="mx-auto"/>}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Trục X (Nhóm theo)</label>
                    <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={xAxisKey} onChange={e => setXAxisKey(e.target.value)}>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Trục Y (Giá trị)</label>
                    <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={yAxisKey} onChange={e => setYAxisKey(e.target.value)}>
                        <option value="count">Đếm số lượng bản ghi (Count)</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {yAxisKey !== 'count' && (
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Phép tính</label>
                        <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={aggType} onChange={e => setAggType(e.target.value)}>
                            <option value="sum">Tổng (Sum)</option>
                            <option value="avg">Trung bình (Average)</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Dashboard Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-slate-500 text-xs uppercase font-bold">Tổng số bản ghi</div>
                        <div className="text-3xl font-bold text-blue-900 mt-1">{data.length}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-slate-500 text-xs uppercase font-bold">Số nhóm (Trục X)</div>
                        <div className="text-3xl font-bold text-green-600 mt-1">{processedData.length}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-slate-500 text-xs uppercase font-bold">Giá trị lớn nhất</div>
                        <div className="text-3xl font-bold text-orange-500 mt-1">{processedData.length > 0 ? Math.max(...processedData.map(d => d.value)) : 0}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [sheetConfig, setSheetConfig] = useState(null);

  // Check login session khi vào App
  useEffect(() => {
      const savedUser = localStorage.getItem('pka_user_session');
      if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLoginSuccess = (u) => setUser(u);
  const handleConfig = (id, range) => setSheetConfig({ id, range });
  
  // Đăng xuất: Xóa hết session
  const handleLogout = () => { 
      setUser(null); 
      setSheetConfig(null);
      localStorage.removeItem('pka_user_session');
  };
  
  // Đổi nguồn: Chỉ xóa config, giữ user
  const handleChangeSource = () => setSheetConfig(null);

  if (!user) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  if (!sheetConfig) return <SetupScreen onConfig={handleConfig} />;
  return <Dashboard user={user} config={sheetConfig} onLogout={handleLogout} onChangeSource={handleChangeSource} />;
}