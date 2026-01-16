import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Search, RefreshCw, Undo, Redo, LayoutTemplate, Table as TableIcon, PieChart as ChartIcon, 
  Settings, LogOut, FileSpreadsheet, Check, Filter, List, Copy, Play, X, Plus, Trash2, ChevronDown, 
  GripVertical, ChevronUp, History, Database, ArrowLeft, ArrowRight, BarChart3, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, CheckSquare, Square, Split, ListFilter, RotateCcw, UploadCloud, Cloud, Pencil, Save, AlertCircle, ClipboardCheck, CloudCog
} from 'lucide-react';

// --- CẤU HÌNH ---
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CONFIG_SHEET_NAME = '_PKA_CONFIG'; 
const GLOBAL_HISTORY_FILE_NAME = '_PKA_GLOBAL_HISTORY_V1'; 
const AUTO_SAVE_DELAY = 5000;

// --- UTILS ---
const formatValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Component thông báo Copy thành công
const ToastNotification = ({ message, isVisible, onClose }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 whitespace-nowrap"
                >
                    <ClipboardCheck className="text-green-400" size={20} />
                    <span className="text-sm font-medium">{message}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const secureCopy = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); return true; } catch (err) { console.error(err); }
    }
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

// --- COMPONENT: POPUP CHỌN CỘT ---
const ColumnSelectorModal = ({ isOpen, onClose, columns, onSelect, title = "Chọn cột dữ liệu" }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef(null);
    useEffect(() => { 
        if (isOpen) {
            if (inputRef.current) setTimeout(() => inputRef.current.focus(), 100); 
            setSearchTerm("");
            const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

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

// --- COMPONENT: POPUP ĐA CHỌN GIÁ TRỊ ---
const MultiValueSelectModal = ({ isOpen, onClose, options, initialValue, onSave, title = "Chọn giá trị" }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selected, setSelected] = useState(new Set());
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            const initSet = new Set(initialValue ? String(initialValue).split(/[,;]+/).map(s => s.trim()).filter(s => s) : []);
            setSelected(initSet);
            setSearchTerm("");
            if (inputRef.current) setTimeout(() => inputRef.current.focus(), 100);
        }
    }, [isOpen, initialValue]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') handleConfirm();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selected]);

    const filteredOptions = options.filter(opt => String(opt).toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 100);

    const toggleSelection = (val) => {
        const newSet = new Set(selected);
        if (newSet.has(val)) newSet.delete(val); else newSet.add(val);
        setSelected(newSet);
    };

    const handleConfirm = () => {
        const valueString = Array.from(selected).join(', ');
        onSave(valueString);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-900">{title}</h3>
                    <div className="flex gap-2">
                        <button onClick={handleConfirm} className="px-3 py-1 bg-blue-900 text-white text-xs rounded hover:bg-blue-800">Xác nhận (Enter)</button>
                        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full" title="Esc"><X size={20}/></button>
                    </div>
                </div>
                
                <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                        <input ref={inputRef} type="text" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>Đã chọn: {selected.size}</span>
                        <button onClick={() => setSelected(new Set())} className="text-red-500 hover:underline">Bỏ chọn hết</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredOptions.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1">
                            {filteredOptions.map((opt, idx) => (
                                <div key={idx} onClick={() => toggleSelection(opt)} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm cursor-pointer transition-colors ${selected.has(opt) ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}>
                                    {selected.has(opt) ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} className="text-slate-300"/>}
                                    <span className="truncate">{opt}</span>
                                </div>
                            ))}
                        </div>
                    ) : (<div className="p-8 text-center text-slate-400 text-sm">Không tìm thấy dữ liệu</div>)}
                </div>
            </motion.div>
        </div>
    );
};

// --- COMPONENT: ADVANCED SORT MODAL ---
const AdvancedSortModal = ({ isOpen, onClose, columns, sortRules, onApply }) => {
    const [localRules, setLocalRules] = useState(sortRules || []);

    useEffect(() => {
        if (isOpen) setLocalRules(sortRules || []);
    }, [isOpen, sortRules]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') { onApply(localRules); onClose(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, localRules]);

    const addRule = () => setLocalRules([...localRules, { column: columns[0], direction: 'asc' }]);
    const removeRule = (idx) => setLocalRules(localRules.filter((_, i) => i !== idx));
    const updateRule = (idx, field, val) => {
        const newRules = [...localRules];
        newRules[idx][field] = val;
        setLocalRules(newRules);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2"><ListFilter size={18}/> Sắp xếp nâng cao</h3>
                    <div className="flex gap-2">
                        <button onClick={() => { onApply(localRules); onClose(); }} className="px-3 py-1 bg-blue-900 text-white text-xs rounded hover:bg-blue-800">Áp dụng (Enter)</button>
                        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full" title="Esc"><X size={20}/></button>
                    </div>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {localRules.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">Chưa có điều kiện sắp xếp nào.</div>
                    ) : (
                        <div className="space-y-3">
                            {localRules.map((rule, idx) => (
                                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                    <span className="text-xs font-bold text-slate-500 w-16">{idx === 0 ? 'Sắp xếp' : 'Rồi theo'}</span>
                                    <select className="flex-1 text-sm border border-slate-300 rounded p-1.5" value={rule.column} onChange={(e) => updateRule(idx, 'column', e.target.value)}>
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select className="w-28 text-sm border border-slate-300 rounded p-1.5" value={rule.direction} onChange={(e) => updateRule(idx, 'direction', e.target.value)}>
                                        <option value="asc">Tăng dần (A-Z)</option>
                                        <option value="desc">Giảm dần (Z-A)</option>
                                    </select>
                                    <button onClick={() => removeRule(idx)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={addRule} className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-700 hover:bg-blue-50 px-3 py-2 rounded transition-colors"><Plus size={14}/> Thêm mức sắp xếp</button>
                </div>
            </motion.div>
        </div>
    );
};

// --- MAIN COMPONENTS ---

const LoginScreen = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userData = {
            name: userInfo.data.name,
            email: userInfo.data.email,
            imageUrl: userInfo.data.picture,
            accessToken: tokenResponse.access_token 
        };
        localStorage.setItem('pka_user_session', JSON.stringify(userData));
        onLoginSuccess(userData);
      } catch (error) {
        console.error("Lỗi lấy thông tin user:", error);
        alert("Đăng nhập thành công nhưng không lấy được thông tin.");
      }
      setLoading(false);
    },
    onError: (error) => { console.error("Login Failed:", error); alert("Đăng nhập thất bại."); },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-900 rounded-lg flex items-center justify-center mb-4"><LayoutTemplate className="text-white w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wide">PKA Management</h1>
          <p className="text-slate-500 text-sm mt-2">Trường Kỹ thuật Phenikaa</p>
        </div>
        
        <button onClick={() => login()} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all group">
            {loading ? <RefreshCw className="animate-spin w-5 h-5 text-blue-900"/> : (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/></svg>)}
            <span className="font-medium text-slate-700 group-hover:text-blue-900">{loading ? 'Đang kết nối...' : 'Đăng nhập bằng Google'}</span>
        </button>
      </div>
    </motion.div>
  );
};

const SetupScreen = ({ user, onConfig, onLogout }) => {
  const [sheetId, setSheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A:Z');
  const [name, setName] = useState(''); 
  const [history, setHistory] = useState([]);
  const [editingId, setEditingId] = useState(null); 
  const [checking, setChecking] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [drivePermissionError, setDrivePermissionError] = useState(false); 
  
  const syncHistoryWithDrive = useCallback(async () => {
    setSyncingHistory(true);
    setDrivePermissionError(false);
    try {
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${GLOBAL_HISTORY_FILE_NAME}' and trashed=false&fields=files(id, name)`;
        const searchRes = await axios.get(searchUrl, { headers: { Authorization: `Bearer ${user.accessToken}` } });
        
        let fileId = null;
        let cloudHistory = [];

        if (searchRes.data.files && searchRes.data.files.length > 0) {
            fileId = searchRes.data.files[0].id;
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/Sheet1!A1:A1?key=${API_KEY}`;
            const readRes = await axios.get(readUrl, { headers: { Authorization: `Bearer ${user.accessToken}` } });
            if (readRes.data.values && readRes.data.values[0]) {
                try {
                    cloudHistory = JSON.parse(readRes.data.values[0][0]);
                } catch (e) { console.error("Lỗi parse history từ cloud", e); }
            }
        } else {
            const createRes = await axios.post('https://sheets.googleapis.com/v4/spreadsheets', {
                properties: { title: GLOBAL_HISTORY_FILE_NAME }
            }, { headers: { Authorization: `Bearer ${user.accessToken}` } });
            fileId = createRes.data.spreadsheetId;
        }

        const localHistory = JSON.parse(localStorage.getItem('sheet_history_v2') || '[]');
        const combined = [...localHistory, ...cloudHistory];
        
        const uniqueHistory = [];
        const map = new Map();
        for (const item of combined) {
            if (!map.has(item.key)) {
                map.set(item.key, true);
                uniqueHistory.push(item);
            }
        }
        
        const finalHistory = uniqueHistory.slice(0, 20); 

        setHistory(finalHistory);
        localStorage.setItem('sheet_history_v2', JSON.stringify(finalHistory));

        if (fileId) {
             const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/Sheet1!A1:A1?valueInputOption=RAW`;
             await axios.put(updateUrl, { values: [[JSON.stringify(finalHistory)]] }, { headers: { Authorization: `Bearer ${user.accessToken}` } });
             localStorage.setItem('pka_global_history_id', fileId); 
        }

    } catch (error) {
        console.error("Lỗi đồng bộ lịch sử Drive:", error);
        if (error.response && error.response.status === 403) {
            setDrivePermissionError(true);
        }
    }
    setSyncingHistory(false);
  }, [user.accessToken]);

  useEffect(() => {
      syncHistoryWithDrive();
  }, [syncHistoryWithDrive]);


  const updateCloudHistory = async (newHistory) => {
      const fileId = localStorage.getItem('pka_global_history_id');
      if (fileId) {
          try {
             const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/Sheet1!A1:A1?valueInputOption=RAW`;
             await axios.put(updateUrl, { values: [[JSON.stringify(newHistory)]] }, { headers: { Authorization: `Bearer ${user.accessToken}` } });
          } catch(e) { console.error("Lỗi cập nhật cloud history", e); }
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setChecking(true);
    const cleanId = sheetId.trim();
    const cleanRange = range.trim();
    const cleanName = name.trim();

    try {
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?key=${API_KEY}`;
        await axios.get(metadataUrl, { headers: { Authorization: `Bearer ${user.accessToken}` } });
    } catch (error) {
        setChecking(false);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            alert("Phiên đăng nhập đã hết hạn hoặc bạn không có quyền truy cập Sheet này. Vui lòng đăng nhập lại.");
            onLogout();
            return;
        } else {
             alert("Không thể tìm thấy ID Sheet này. Vui lòng kiểm tra lại.");
             return;
        }
    }

    const uniqueKey = `${cleanId}-${cleanRange}`;
    const newItem = {
        key: uniqueKey,
        id: cleanId,
        range: cleanRange,
        name: cleanName || `${cleanRange} (${cleanId.slice(0, 6)}...)`, 
        date: new Date().toLocaleDateString('vi-VN')
    };

    // Tạo lịch sử mới (đưa item mới lên đầu)
    const newHistory = [newItem, ...history.filter(h => h.key !== uniqueKey)].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem('sheet_history_v2', JSON.stringify(newHistory));
    updateCloudHistory(newHistory);
    
    setChecking(false);
    // QUAN TRỌNG: Truyền tên mới sang Dashboard để nó ghi đè lên Sheet
    onConfig(cleanId, cleanRange, newItem.name);
  };

  const useHistoryItem = (item) => {
      setSheetId(item.id);
      setRange(item.range);
      setName(item.name);
  };

  const deleteHistoryItem = (e, keyToDelete) => {
      e.stopPropagation();
      const newHistory = history.filter(h => h.key !== keyToDelete);
      setHistory(newHistory);
      localStorage.setItem('sheet_history_v2', JSON.stringify(newHistory));
      updateCloudHistory(newHistory);
  };

  const startEditing = (e, item) => {
      e.stopPropagation();
      setEditingId(item.key);
      setSheetId(item.id);
      setRange(item.range);
      setName(item.name);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen flex flex-col bg-slate-50">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
             <div className="font-bold text-blue-900 flex items-center gap-2"><Settings size={18}/> THIẾT LẬP DỮ LIỆU</div>
             <div className="flex items-center gap-2">
                 <span className="text-sm font-medium text-slate-700 hidden md:block">{user.name}</span>
                 {user.imageUrl && <img src={user.imageUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-200" />}
                 <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Đăng xuất"><LogOut size={18}/></button>
             </div>
        </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên dữ liệu (Gợi nhớ)</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: K19 - CNTT (Tuỳ chọn)" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Spreadsheet ID</label>
            <input type="text" required value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Dán ID của Google Sheet..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Range (Tab)</label>
            <input type="text" required value={range} onChange={(e) => setRange(e.target.value)} placeholder="Ví dụ: Sheet1!A:Z" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none font-mono text-sm" />
          </div>

          <button type="submit" disabled={checking} className="w-full bg-blue-900 text-white py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium flex justify-center items-center gap-2 mt-4 disabled:opacity-70">
            {checking ? <RefreshCw className="animate-spin w-4 h-4"/> : <Check className="w-4 h-4" />} {checking ? 'Đang kiểm tra...' : (editingId ? 'Cập nhật Dữ liệu' : 'Kết nối Dữ liệu')}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><History size={12}/> Lịch sử truy cập</p>
                {syncingHistory && <span className="text-xs text-blue-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Đang đồng bộ từ Drive...</span>}
            </div>

            {drivePermissionError && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                    <div>
                        <span className="font-bold">Chưa đồng bộ được lịch sử:</span> Bạn cần cấp thêm quyền Google Drive. <br/>
                        <button onClick={onLogout} className="underline text-blue-700 font-bold mt-1">Bấm vào đây để Đăng xuất & Đăng nhập lại</button>
                    </div>
                </div>
            )}
            
            {history.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {history.map((h) => (
                        <div key={h.key} onClick={() => useHistoryItem(h)} className={`group relative p-3 bg-slate-50 hover:bg-blue-50 rounded-lg cursor-pointer border transition-all ${sheetId === h.id && range === h.range ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-blue-900 text-sm truncate pr-6 flex items-center gap-1">
                                    {h.name}
                                    <CloudCog size={12} className="text-blue-400" title="Đã đồng bộ Cloud"/>
                                </div>
                                <div className="text-[10px] text-slate-400 whitespace-nowrap">{h.date}</div>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 font-mono truncate" title={h.id}>ID: {h.id.slice(0,8)}...</div>
                            <div className="text-xs text-slate-500 font-mono truncate">Tab: {h.range}</div>
                            
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded backdrop-blur-sm">
                                <button onClick={(e) => startEditing(e, h)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-blue-100" title="Sửa tên"><Pencil size={14} /></button>
                                <button onClick={(e) => deleteHistoryItem(e, h.key)} className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-red-100" title="Xóa"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-slate-400 text-xs py-4">Chưa có dữ liệu nào.</div>
            )}
        </div>
      </div>
      </div>
    </motion.div>
  );
};

const Dashboard = ({ user, config, onLogout, onChangeSource }) => {
  const [rawData, setRawData] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [saveStatus, setSaveStatus] = useState('saved'); 
  const [isConfigLoaded, setIsConfigLoaded] = useState(false); 

  const [bulkFilterMode, setBulkFilterMode] = useState('exact'); 
  const [activeSuggestionFilter, setActiveSuggestionFilter] = useState(null);

  const [sortRules, setSortRules] = useState([]); 
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [isQueryBuilderOpen, setIsQueryBuilderOpen] = useState(true);
  const [colSearchTerm, setColSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: '', id: null });

  const [charts, setCharts] = useState(() => {
      const saved = localStorage.getItem('pka_dashboard_charts');
      return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => localStorage.setItem('pka_dashboard_charts', JSON.stringify(charts)), [charts]);

  const [queryConfig, setQueryConfig] = useState(() => {
      const saved = localStorage.getItem('pka_query_config');
      return saved ? JSON.parse(saved) : {
        selectedCols: [],
        bulkFilter: { column: '', values: '' },
        filters: [{ id: 1, column: '', condition: 'contains', value: '', operator: 'AND' }]
      };
  });

  useEffect(() => { localStorage.setItem('pka_query_config', JSON.stringify(queryConfig)); }, [queryConfig]);

  const [resultState, setResultState] = useState({ data: [], visibleCols: [], isExecuted: false });
  const [selection, setSelection] = useState({ start: { row: null, col: null }, end: { row: null, col: null }, isDragging: false });
  const [history, setHistory] = useState({ past: [], future: [] });
  const [view, setView] = useState('table');
  const [columnWidths, setColumnWidths] = useState({});
  const tableRef = useRef(null);
  const resizingRef = useRef(null);

  const triggerToast = (msg) => {
      setToastMsg(msg);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
  };

  const resetFilters = () => {
      const findCol = (keywords) => allColumns.find(c => keywords.some(k => c.toLowerCase().includes(k)));
      const defaultCols = [
          findCol(['mã', 'mssv', 'code']), 
          findCol(['họ tên', 'tên', 'name']), 
          findCol(['khoá', 'khóa', 'course']), 
          findCol(['khoa', 'department'])
      ].filter(Boolean);
      const defaultFilterCol = findCol(['mã', 'mssv', 'code']) || '';
      setQueryConfig({
          selectedCols: defaultCols.length > 0 ? defaultCols : allColumns.slice(0, 5),
          bulkFilter: { column: defaultFilterCol, values: '' },
          filters: [{ id: Date.now(), column: defaultFilterCol, condition: 'contains', value: '', operator: 'AND' }]
      });
  };

  const updateChart = (id, newConfig) => {
      setCharts(prev => prev.map(c => c.id === id ? { ...c, ...newConfig } : c));
  };

  const addFilterCondition = () => setQueryConfig(prev => ({ ...prev, filters: [...prev.filters, { id: Date.now(), column: '', condition: 'contains', value: '', operator: 'AND' }] }));
  const removeFilterCondition = (id) => setQueryConfig(prev => ({ ...prev, filters: prev.filters.filter(f => f.id !== id) }));
  const updateFilter = (id, field, value) => setQueryConfig(prev => ({ ...prev, filters: prev.filters.map(f => f.id === id ? { ...f, [field]: value } : f) }));

  const checkCondition = (row, filter) => {
      if (!filter.column || !filter.value) return true; 
      const cellVal = String(row[filter.column] || '').toLowerCase();
      const searchVals = String(filter.value).toLowerCase();
      
      // LOGIC MỚI: Tách từ khóa (Token Search)
      // Nếu condition là 'contains' (mặc định), dùng logic Token
      if (filter.condition === 'contains') {
          const tokens = searchVals.split(/\s+/).filter(t => t.trim() !== '');
          // Kiểm tra xem cellVal có chứa TẤT CẢ các từ khóa không
          return tokens.every(token => cellVal.includes(token));
      }

      // Các logic cũ giữ nguyên
      const legacySearchVals = searchVals.split(/[,;]+/).map(s => s.trim()).filter(s => s);
      return legacySearchVals.some(searchVal => {
          switch (filter.condition) {
              case 'not_contains': return !cellVal.includes(searchVal);
              case 'equals': return cellVal === searchVal;
              case 'not_equals': return cellVal !== searchVal;
              case 'starts': return cellVal.startsWith(searchVal);
              case 'greater': return parseFloat(cellVal) >= parseFloat(searchVal);
              case 'less': return parseFloat(cellVal) <= parseFloat(searchVal);
              default: return true;
          }
      });
  };

  const performSave = useCallback(async (currentCharts, currentQuery) => {
      setSaveStatus('saving');
      try {
          const configData = {
              charts: currentCharts,
              queryConfig: currentQuery,
              meta: { 
                  name: config.name, 
                  lastUpdated: new Date().toISOString()
              }
          };
          const configString = JSON.stringify(configData);

          const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}?key=${API_KEY}`;
          const metadataRes = await axios.get(metadataUrl, { headers: { Authorization: `Bearer ${user.accessToken}` } });
          const sheets = metadataRes.data.sheets || [];
          const configSheetExists = sheets.some(s => s.properties.title === CONFIG_SHEET_NAME);

          if (!configSheetExists) {
              const addSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}:batchUpdate`;
              await axios.post(addSheetUrl, {
                  requests: [{
                      addSheet: {
                          properties: { title: CONFIG_SHEET_NAME, hidden: true }
                      }
                  }]
              }, { headers: { Authorization: `Bearer ${user.accessToken}` } });
          }

          const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${CONFIG_SHEET_NAME}!A1:A1?valueInputOption=RAW`;
          await axios.put(updateUrl, {
              values: [[configString]]
          }, { headers: { Authorization: `Bearer ${user.accessToken}` } });

          setSaveStatus('saved');
      } catch (error) {
          console.error("Lỗi lưu cấu hình:", error);
          setSaveStatus('unsaved'); 
      }
  }, [config.id, config.name, user.accessToken]);

  useEffect(() => {
      if (!isConfigLoaded) return;
      setSaveStatus('unsaved'); 
      const timer = setTimeout(() => {
          performSave(charts, queryConfig);
      }, AUTO_SAVE_DELAY); 

      return () => clearTimeout(timer); 
  }, [charts, queryConfig, isConfigLoaded, performSave]);

  const loadConfigFromSheet = async () => {
      try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${CONFIG_SHEET_NAME}!A1:A1?key=${API_KEY}`;
          const response = await axios.get(url, { headers: { Authorization: `Bearer ${user.accessToken}` } });
          const rows = response.data.values;
          
          if (rows && rows.length > 0 && rows[0][0]) {
              const savedConfig = JSON.parse(rows[0][0]);
              if (savedConfig.charts) setCharts(savedConfig.charts);
              if (savedConfig.queryConfig) setQueryConfig(savedConfig.queryConfig);
              
              // ĐÃ XÓA LOGIC ĐỒNG BỘ NGƯỢC "NGUY HIỂM" TẠI ĐÂY
              
              console.log("Đã tải cấu hình từ Sheet thành công.");
          }
      } catch (error) {
          console.log("Chưa có cấu hình trên Sheet hoặc không thể đọc.");
      } finally {
          setIsConfigLoaded(true); 
      }
  };

  const fetchGoogleSheetData = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${config.range}?key=${API_KEY}`;
        const response = await axios.get(url, { headers: { Authorization: `Bearer ${user.accessToken}` } });
        const result = response.data;
        const rows = result.values;
        if (!rows || rows.length === 0) { setLoadError("Không tìm thấy dữ liệu trong vùng đã chọn."); setLoading(false); return; }
        
        const headers = rows[0]; 
        const dataRows = rows.slice(1);
        const formattedData = dataRows.map((row, index) => {
            const rowObject = { 'STT': index + 1 };
            headers.forEach((header, i) => { rowObject[header] = row[i] ? String(row[i]) : ""; });
            return rowObject;
        });
        setRawData(formattedData); setAllColumns(headers); 
        await loadConfigFromSheet();
        setQueryConfig(prev => { 
            if (prev.selectedCols.length === 0) {
                const findCol = (keywords) => headers.find(c => keywords.some(k => c.toLowerCase().includes(k)));
                const defaultCols = [findCol(['mã', 'mssv']), findCol(['họ tên', 'tên']), findCol(['khoá', 'khóa']), findCol(['khoa'])].filter(Boolean);
                return { ...prev, selectedCols: defaultCols.length > 0 ? defaultCols : headers.slice(0, 5) }; 
            }
            return prev; 
        });
        const initWidths = {}; headers.forEach(h => initWidths[h] = 150); setColumnWidths(initWidths);

    } catch (error) {
        console.error("Lỗi tải Sheet:", error);
        setLoadError(error.response?.status === 403 ? "Bạn không có quyền truy cập file này (Lỗi 403)." : "Lỗi kết nối! Kiểm tra lại ID Sheet hoặc Mạng.");
    }
    setLoading(false);
  }, [config, user.accessToken]);

  useEffect(() => { fetchGoogleSheetData(); }, [fetchGoogleSheetData]);

  useEffect(() => {
      const handleShortcut = (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runQuery();
      };
      window.addEventListener('keydown', handleShortcut);
      return () => window.removeEventListener('keydown', handleShortcut);
  });

  const openColumnModal = (type, id = null) => { setModalTarget({ type, id }); setIsModalOpen(true); };
  const handleColumnSelect = (colName) => {
      if (modalTarget.type === 'bulk') setQueryConfig(p => ({ ...p, bulkFilter: { ...p.bulkFilter, column: colName } }));
      else if (modalTarget.type === 'filter') updateFilter(modalTarget.id, 'column', colName);
  };

  useEffect(() => {
    const handleMouseMove = (e) => { if (resizingRef.current) { const { col, startX, startWidth } = resizingRef.current; setColumnWidths(prev => ({ ...prev, [col]: Math.max(50, startWidth + (e.clientX - startX)) })); }};
    const handleMouseUp = () => { resizingRef.current = null; document.body.style.cursor = 'default'; };
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, []);
  const startResizing = (e, col) => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { col, startX: e.clientX, startWidth: columnWidths[col] || 150 }; document.body.style.cursor = 'col-resize'; };
  const handleDragStart = (e, ci) => e.dataTransfer.setData("colIndex", ci);
  const handleDrop = (e, ti) => { const si = parseInt(e.dataTransfer.getData("colIndex")); if (si === ti) return; const nc = [...resultState.visibleCols]; const [mc] = nc.splice(si, 1); nc.splice(ti, 0, mc); setResultState(p => ({ ...p, visibleCols: nc })); };

  const runQuery = () => {
    setHistory(prev => ({ past: [...prev.past, { config: { ...queryConfig }, result: { ...resultState } }], future: [] }));
    let filtered = [...rawData];
    let orderedData = [];

    if (queryConfig.bulkFilter.values.trim() && queryConfig.bulkFilter.column) {
      const targetCol = queryConfig.bulkFilter.column;
      const rawValues = queryConfig.bulkFilter.values.split(/[\n\r\t,;]+/); 
      const uniquePasteOrder = [...new Set(rawValues.map(s => s.trim().toLowerCase()).filter(s => s !== ''))];
      
      if (uniquePasteOrder.length > 0) {
          const rowMap = new Map();
          filtered.forEach(row => {
              const cellVal = String(row[targetCol]).trim().toLowerCase();
              if (bulkFilterMode === 'exact') {
                  if (uniquePasteOrder.includes(cellVal)) { if (!rowMap.has(cellVal)) rowMap.set(cellVal, []); rowMap.get(cellVal).push(row); }
              } else {
                  const matchedKey = uniquePasteOrder.find(k => cellVal.includes(k));
                  if (matchedKey) { if (!rowMap.has(matchedKey)) rowMap.set(matchedKey, []); rowMap.get(matchedKey).push(row); }
              }
          });
          uniquePasteOrder.forEach(val => { if (rowMap.has(val)) orderedData.push(...rowMap.get(val)); });
          filtered = orderedData;
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
    setCurrentPage(1); setSortRules([]); 
    setView('table'); if (window.innerWidth < 768) setIsQueryBuilderOpen(false);
  };

  const getColumnOptions = useCallback((colName) => {
      if (!colName || !rawData.length) return [];
      return [...new Set(rawData.map(r => r[colName]))].sort().filter(v => v);
  }, [rawData]);

  const handleUndo = () => { if (history.past.length === 0) return; const prev = history.past[history.past.length - 1]; setHistory({ past: history.past.slice(0, -1), future: [{ config: { ...queryConfig }, result: { ...resultState } }, ...history.future] }); setQueryConfig(prev.config); setResultState(prev.result); };
  const handleRedo = () => { if (history.future.length === 0) return; const next = history.future[0]; setHistory({ past: [...history.past, { config: { ...queryConfig }, result: { ...resultState } }], future: history.future.slice(1) }); setQueryConfig(next.config); setResultState(next.result); };
  const handleMouseDown = (r, c) => setSelection({ start: { row: r, col: c }, end: { row: r, col: c }, isDragging: true });
  const handleMouseEnter = (r, c) => { if (selection.isDragging) setSelection(prev => ({ ...prev, end: { row: r, col: c } })); };
  useEffect(() => { const up = () => { if (selection.isDragging) setSelection(p => ({ ...p, isDragging: false })); }; window.addEventListener('mouseup', up); return () => window.removeEventListener('mouseup', up); }, [selection.isDragging]);
  const getSelectionRange = useCallback(() => { const { start, end } = selection; if (start.row === null) return null; return { minR: Math.min(start.row, end.row), maxR: Math.max(start.row, end.row), minC: Math.min(start.col, end.col), maxC: Math.max(start.col, end.col) }; }, [selection]);
  const handleCopyAll = () => { if (!resultState.data.length) return; const headers = resultState.visibleCols.join('\t'); const body = resultState.data.map(row => resultState.visibleCols.map(col => formatValue(row[col])).join('\t')).join('\n'); secureCopy(`${headers}\n${body}`).then(() => triggerToast(`Đã copy toàn bộ ${resultState.data.length} dòng!`)); };
  
  const handleCopy = useCallback(async () => { 
      const rg = getSelectionRange(); 
      if (!rg || !resultState.data.length) return; 
      const pageData = itemsPerPage === 'all' ? sortedData : sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage); 
      const rows = pageData.slice(rg.minR, rg.maxR + 1); 
      const cols = resultState.visibleCols; 
      const txt = rows.map(r => { const vals = []; for (let c = rg.minC; c <= rg.maxC; c++) vals.push(formatValue(r[cols[c]])); return vals.join('\t'); }).join('\n'); 
      await secureCopy(txt);
      triggerToast('Đã copy dữ liệu chọn!');
  }, [getSelectionRange, resultState, currentPage, itemsPerPage]);

  useEffect(() => { const kd = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); handleCopy(); } }; window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd); }, [handleCopy]);
  const isCellSelected = (r, c) => { const rg = getSelectionRange(); return rg && r >= rg.minR && r <= rg.maxR && c >= rg.minC && c <= rg.maxC; };
  const filteredColumns = allColumns.filter(c => c.toLowerCase().includes(colSearchTerm.toLowerCase()));

  const handleQuickSort = (key) => {
      if (sortRules.length > 0 && sortRules[0].column === key) {
          const newDir = sortRules[0].direction === 'asc' ? 'desc' : 'asc';
          setSortRules([{ column: key, direction: newDir }]); 
      } else {
          setSortRules([{ column: key, direction: 'asc' }]);
      }
  };

  const sortedData = useMemo(() => {
      if (!sortRules || sortRules.length === 0) return resultState.data;
      let data = [...resultState.data];
      data.sort((a, b) => {
          for (const rule of sortRules) {
              const aVal = String(a[rule.column] || '');
              const bVal = String(b[rule.column] || '');
              let comparison = 0;
              const aNum = parseFloat(aVal);
              const bNum = parseFloat(bVal);
              if (!isNaN(aNum) && !isNaN(bNum)) { comparison = aNum - bNum; } else { comparison = aVal.localeCompare(bVal, 'vi'); }
              if (comparison !== 0) { return rule.direction === 'asc' ? comparison : -comparison; }
          }
          return 0;
      });
      return data;
  }, [resultState.data, sortRules]);

  const currentTableData = useMemo(() => { if (itemsPerPage === 'all') return sortedData; const start = (currentPage - 1) * itemsPerPage; return sortedData.slice(start, start + itemsPerPage); }, [sortedData, currentPage, itemsPerPage]);
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(sortedData.length / itemsPerPage);
  const handleItemsPerPageChange = (val) => { setItemsPerPage(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); };

  const activeFilterObj = queryConfig.filters.find(f => f.id === activeSuggestionFilter);
  const suggestionOptions = activeFilterObj ? getColumnOptions(activeFilterObj.column) : [];
  const suggestionInitialValue = activeFilterObj ? activeFilterObj.value : "";

  // Render trạng thái lưu
  const renderSaveStatus = () => {
      if (!isConfigLoaded) return null;
      if (saveStatus === 'saving') return <span className="text-xs text-blue-600 font-medium flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Đang lưu...</span>;
      if (saveStatus === 'unsaved') return <span className="text-xs text-slate-400 font-medium flex items-center gap-1">...</span>;
      return <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12}/> Đã lưu</span>;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3"><div className="bg-blue-900 text-white p-2 rounded hidden md:block"><LayoutTemplate size={20} /></div><div><h1 className="font-bold text-blue-900 leading-tight text-sm md:text-base">{config.name || 'PKA MANAGEMENT'}</h1><p className="text-xs text-slate-500 hidden md:block">Hệ thống Tra cứu & Phân tích dữ liệu</p></div></div>
        <div className="flex items-center gap-2 md:gap-4">
            
            {/* TRẠNG THÁI AUTO SAVE */}
            <div className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1 flex items-center gap-2">
                <Cloud size={14} className="text-slate-400"/>
                {renderSaveStatus()}
            </div>

            <button onClick={onChangeSource} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"><Database size={14} /> <span className="hidden md:inline">Đổi nguồn</span></button>
            <button onClick={() => fetchGoogleSheetData()} className="p-2 text-blue-700 bg-blue-50 rounded hover:bg-blue-100" title="Tải lại"><RefreshCw size={18} /></button>
            <div className="hidden md:flex items-center gap-2 bg-slate-50 rounded p-1"><button onClick={handleUndo} disabled={history.past.length === 0} className="p-2 text-slate-600 disabled:opacity-30"><Undo size={18} /></button><button onClick={handleRedo} disabled={history.future.length === 0} className="p-2 text-slate-600 disabled:opacity-30"><Redo size={18} /></button></div>
            <div className="flex items-center gap-2">{user.imageUrl && <img src={user.imageUrl} alt="Avatar" className="w-8 h-8 rounded-full" />}<button onClick={onLogout} className="text-slate-400 hover:text-red-500 ml-2" title="Đăng xuất"><LogOut size={18} /></button></div>
        </div>
      </header>

      <main className="flex-1 p-3 md:p-6 overflow-hidden flex flex-col gap-4 md:gap-6">
        {loadError && (<div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-center justify-between"><span>{loadError}</span><button onClick={() => setLoadError(null)}><X size={18}/></button></div>)}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 cursor-pointer" onClick={() => setIsQueryBuilderOpen(!isQueryBuilderOpen)}>
                 <h2 className="text-base md:text-lg font-bold text-blue-900 flex items-center gap-2">
                    <Filter size={20} /> Advanced Query Builder 
                    <button onClick={(e) => { e.stopPropagation(); resetFilters(); }} title="Làm mới bộ lọc (Mặc định)" className="p-1 hover:bg-blue-100 rounded-full text-slate-400 hover:text-blue-900 ml-2 transition-colors"><RotateCcw size={16}/></button>
                    {!isQueryBuilderOpen && <span className="text-xs font-normal text-slate-400 ml-2">(Mở rộng)</span>}
                 </h2>
                 <div className="flex items-center gap-2"><span className="text-xs text-slate-500 hidden md:inline">{loading ? 'Đang tải...' : `Source: ${rawData.length} dòng`}</span>{isQueryBuilderOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}</div>
            </div>

            <AnimatePresence>
            {isQueryBuilderOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                    <div className="lg:col-span-3 border-r border-slate-100 lg:pr-4 flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><List size={16} /> 1. Chọn cột hiển thị</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2 text-slate-400"/>
                            <input type="text" placeholder="Tìm tên cột..." className="w-full pl-8 pr-8 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 outline-none" value={colSearchTerm} onChange={(e) => setColSearchTerm(e.target.value)} />
                            {colSearchTerm && <button onClick={() => setColSearchTerm('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-red-500"><X size={14}/></button>}
                        </div>
                        <div className="flex gap-2 text-xs mb-1"><button onClick={() => setQueryConfig(p => ({...p, selectedCols: allColumns}))} className="text-blue-700 hover:underline">All</button><button onClick={() => setQueryConfig(p => ({...p, selectedCols: []}))} className="text-slate-500 hover:underline">None</button></div>
                        <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] border border-slate-200 rounded p-2 bg-slate-50 grid grid-cols-2 gap-x-2 gap-y-1 content-start">{filteredColumns.map(col => (<label key={col} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors" title={col}><input type="checkbox" checked={queryConfig.selectedCols.includes(col)} onChange={() => setQueryConfig(p => ({...p, selectedCols: p.selectedCols.includes(col) ? p.selectedCols.filter(c => c !== col) : [...p.selectedCols, col]}))} className="rounded text-blue-900 focus:ring-blue-900 shrink-0" /><span className="truncate">{col}</span></label>))}</div>
                    </div>

                    <div className="lg:col-span-6 flex flex-col gap-4 lg:px-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Settings size={16} /> 2. Thiết lập điều kiện</label>
                        <div className="bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-slate-500">Lọc theo danh sách (Paste Excel)</span>
                                <div className="flex gap-2 text-xs">
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="bulkMode" checked={bulkFilterMode === 'exact'} onChange={() => setBulkFilterMode('exact')} /> Chính xác</label>
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="bulkMode" checked={bulkFilterMode === 'partial'} onChange={() => setBulkFilterMode('partial')} /> Gần đúng</label>
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-2 relative">
                                <div onClick={() => openColumnModal('bulk')} className="w-full md:w-1/3 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-pointer hover:border-blue-500 flex justify-between items-center"><span className={`truncate ${!queryConfig.bulkFilter.column ? 'text-slate-400' : 'text-slate-800'}`}>{queryConfig.bulkFilter.column || "Cột đối chiếu"}</span><ChevronDown size={14} className="text-slate-400"/></div>
                                <div className="flex-1 relative"><textarea className="w-full h-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm min-h-[40px] max-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Paste danh sách mã SV, SĐT..." value={queryConfig.bulkFilter.values} onChange={(e) => setQueryConfig(p => ({ ...p, bulkFilter: { ...p.bulkFilter, values: e.target.value } }))} />{queryConfig.bulkFilter.values && <button onClick={() => setQueryConfig(p => ({...p, bulkFilter: {...p.bulkFilter, values: ''}}))} className="absolute right-2 top-2 text-slate-400 hover:text-red-500 bg-white rounded-full"><X size={14}/></button>}</div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold uppercase text-slate-500">Điều kiện chi tiết</span>
                                <button type="button" onClick={addFilterCondition} className="text-xs flex items-center gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded transition-colors shadow-sm border border-blue-100">
                                    <Plus size={14} /> Thêm điều kiện
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                {queryConfig.filters.map((filter, idx) => (
                                    <div key={filter.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center text-sm border-b md:border-none border-slate-100 pb-2 md:pb-0">
                                        <div className="flex items-center gap-1">{idx > 0 ? (<select className="border border-slate-300 bg-slate-100 rounded px-1 py-2 text-xs font-bold w-16" value={filter.operator} onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}><option value="AND">VÀ</option><option value="OR">HOẶC</option></select>) : <span className="text-slate-400 font-mono text-xs w-16 text-center">Bắt đầu</span>}</div>
                                        <div onClick={() => openColumnModal('filter', filter.id)} className="flex-1 border border-slate-300 rounded px-3 py-2 cursor-pointer hover:border-blue-500 bg-white flex justify-between items-center"><span className={`truncate ${!filter.column ? 'text-slate-400' : 'text-slate-800'}`}>{filter.column || "(Chọn cột)"}</span><ChevronDown size={14} className="text-slate-400"/></div>
                                        <select className="border border-slate-300 rounded px-2 py-2 w-full md:w-1/4" value={filter.condition} onChange={(e) => updateFilter(filter.id, 'condition', e.target.value)}><option value="contains">Chứa</option><option value="not_contains">Không chứa</option><option value="equals">Bằng tuyệt đối</option><option value="not_equals">Khác</option><option value="starts">Bắt đầu với</option><option value="greater">Lớn hơn</option><option value="less">Nhỏ hơn</option></select>
                                        <div className="flex-1 w-full relative flex gap-1">
                                            <input type="text" className="w-full border border-slate-300 rounded px-3 py-2 pr-8" placeholder="Giá trị..." value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                            {filter.value && <button onClick={() => updateFilter(filter.id, 'value', '')} className="absolute right-12 top-2.5 text-slate-400 hover:text-red-500"><X size={14}/></button>}
                                            {filter.column && <button onClick={() => openSuggestionModal(filter.id)} className="p-2 border border-slate-300 rounded hover:bg-slate-50 text-blue-600"><List size={16}/></button>}
                                        </div>
                                        <button onClick={() => removeFilterCondition(filter.id)} className="text-red-400 hover:text-red-600 p-1 self-end md:self-center"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 border-l border-slate-100 lg:pl-4 flex flex-col justify-end pb-1">
                        <button onClick={runQuery} disabled={loading} className="w-full py-3 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg shadow-md font-bold flex items-center justify-center gap-2 transition-transform active:scale-95">
                            {loading ? <RefreshCw className="animate-spin" /> : <Play size={20} fill="currentColor" />} {loading ? 'ĐANG TẢI...' : 'CHẠY TRUY VẤN'} <span className="text-[10px] opacity-60 ml-1 font-normal hidden md:inline">(Cmd/Ctrl + Enter)</span>
                        </button>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex flex-wrap gap-2 justify-between items-center px-4 pt-2 border-b border-slate-200 bg-slate-50">
                 <div className="flex gap-2"><button onClick={() => setView('table')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${view === 'table' ? 'bg-white text-blue-900 border-t border-x border-slate-200 -mb-px z-10' : 'text-slate-500'}`}><TableIcon size={16} /> Kết Quả</button><button onClick={() => setView('analytics')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${view === 'analytics' ? 'bg-white text-blue-900 border-t border-x border-slate-200 -mb-px z-10' : 'text-slate-500'}`}><ChartIcon size={16} /> Phân tích</button></div>
                 {resultState.isExecuted && view === 'table' && (
                     <div className="flex items-center gap-2 pb-1 overflow-x-auto">
                        <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">{resultState.data.length} dòng</span>
                        <div className="h-4 w-px bg-slate-300"></div>
                        <button onClick={() => setIsSortModalOpen(true)} className="flex items-center gap-1 text-xs md:text-sm text-slate-600 hover:text-blue-900 font-medium whitespace-nowrap"><ListFilter size={16} /> Advanced Sort</button>
                        <button onClick={handleCopyAll} className="flex items-center gap-1 text-xs md:text-sm text-slate-600 hover:text-blue-900 font-medium whitespace-nowrap"><Copy size={16} /> Copy Toàn bộ</button>
                        <button onClick={() => exportToExcelXML(resultState.data, resultState.visibleCols, 'KetQua.xls')} className="flex items-center gap-1 text-xs md:text-sm text-green-700 hover:text-green-800 font-medium whitespace-nowrap"><FileSpreadsheet size={16} /> Excel</button>
                     </div>
                 )}
            </div>
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {!resultState.isExecuted ? (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-4 text-center"><Search size={64} className="mb-4 opacity-20" /><p className="text-lg font-medium">Vui lòng thiết lập điều kiện và chạy truy vấn</p></div>) : (
                    view === 'table' ? (
                        <>
                            <div className="flex-1 overflow-auto select-none" ref={tableRef}><table className="min-w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}><thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm"><tr><th className="w-10 p-2 border border-slate-300 bg-slate-200 text-center sticky left-0 z-20">#</th>{resultState.visibleCols.map((col, cIdx) => (<th key={col} onClick={() => handleQuickSort(col)} style={{ width: columnWidths[col] || 150 }} className="relative p-2 border border-slate-300 group hover:bg-blue-50 transition-colors cursor-pointer" draggable onDragStart={(e) => handleDragStart(e, cIdx)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, cIdx)}><div className="flex items-center justify-between gap-1 w-full overflow-hidden"><span className="truncate" title={col}>{col}</span>{sortRules.length > 0 && sortRules[0].column === col ? (sortRules[0].direction === 'asc' ? <ArrowUp size={12} className="text-blue-600"/> : <ArrowDown size={12} className="text-blue-600"/>) : <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />}</div><div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-10" onMouseDown={(e) => startResizing(e, col)} onClick={(e) => e.stopPropagation()}/></th>))}</tr></thead><tbody>{currentTableData.map((row, rIdx) => (<tr key={rIdx} className="hover:bg-slate-50"><td className="p-2 border border-slate-300 text-center text-xs text-slate-500 bg-slate-50 sticky left-0 z-10">{(itemsPerPage === 'all' ? rIdx : (currentPage - 1) * itemsPerPage + rIdx) + 1}</td>{resultState.visibleCols.map((col, cIdx) => (<td key={`${rIdx}-${col}`} onMouseDown={() => handleMouseDown(rIdx, cIdx)} onMouseEnter={() => handleMouseEnter(rIdx, cIdx)} className={`p-2 border border-slate-300 whitespace-nowrap overflow-hidden cursor-cell ${isCellSelected(rIdx, cIdx) ? 'bg-blue-600 text-white' : ''}`}>{formatValue(row[col])}</td>))}</tr>))}</tbody></table></div>
                            <div className="bg-white border-t border-slate-200 p-2 flex justify-between items-center"><div className="flex items-center gap-2"><span className="text-xs text-slate-500">Hiển thị:</span><select className="text-xs border border-slate-300 rounded p-1" value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(e.target.value)}><option value="50">50 dòng</option><option value="100">100 dòng</option><option value="500">500 dòng</option><option value="1000">1000 dòng</option><option value="all">Tất cả</option></select><span className="text-xs text-slate-500 ml-2">{itemsPerPage !== 'all' ? `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, sortedData.length)} / ${sortedData.length}` : `Toàn bộ ${sortedData.length} dòng`}</span></div>{itemsPerPage !== 'all' && (<div className="flex gap-2"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ArrowLeft size={16}/></button><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"><ArrowRight size={16}/></button></div>)}</div>
                        </>
                    ) : ( <SuperAnalytics data={resultState.data} charts={charts} setCharts={setCharts} onUpdate={updateChart} /> )
                )}
            </div>
        </div>
      </main>
      
      <ColumnSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} columns={allColumns} onSelect={handleColumnSelect} />
      <MultiValueSelectModal isOpen={!!activeSuggestionFilter} onClose={() => setActiveSuggestionFilter(null)} options={suggestionOptions} initialValue={suggestionInitialValue} onSave={handleSuggestionSave} title="Chọn giá trị từ cột" />
      <AdvancedSortModal isOpen={isSortModalOpen} onClose={() => setIsSortModalOpen(false)} columns={allColumns} sortRules={sortRules} onApply={setSortRules} />
      <ToastNotification message={toastMsg} isVisible={showToast} onClose={() => setShowToast(false)} />
    </div>
  );
};

// --- CHART COMPONENTS (Nâng cấp Stack/Segment + Controlled) ---
const ChartCard = ({ config, data, onDelete, onUpdate }) => {
    // Không dùng state nội bộ nữa, dùng props từ config
    const type = config.type || 'bar';
    const xAxis = config.x || '';
    const segmentBy = config.segmentBy || '';
    
    const columns = Object.keys(data[0] || {});

    // Helper update function
    const updateConfig = (key, value) => {
        onUpdate({ [key]: value });
    };

    // Logic xử lý dữ liệu phức tạp (Segment / Stack)
    const processed = useMemo(() => {
        const segments = segmentBy ? [...new Set(data.map(r => r[segmentBy] || 'N/A'))].sort() : ['count'];
        const grouped = data.reduce((acc, row) => {
            const xVal = row[xAxis] || 'N/A';
            if (!acc[xVal]) {
                acc[xVal] = { name: xVal };
                segments.forEach(seg => acc[xVal][seg] = 0);
            }
            const segKey = segmentBy ? (row[segmentBy] || 'N/A') : 'count';
            acc[xVal][segKey] += 1;
            return acc;
        }, {});

        return {
            data: Object.values(grouped).sort((a,b) => b.count - a.count).slice(0, 20),
            keys: segments
        };
    }, [data, xAxis, segmentBy]);

    const COLORS = ['#003366', '#FF8042', '#00C49F', '#FFBB28', '#FF4444', '#8884d8', '#82ca9d'];
    
    const renderContent = () => {
        const Cmp = { bar: BarChart, line: LineChart, area: AreaChart, pie: PieChart }[type] || BarChart;
        
        if (type === 'pie') {
             return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={processed.data} dataKey={processed.keys[0]} nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{processed.data.map((e,i)=> <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie>
                        <RechartsTooltip /><Legend />
                    </PieChart>
                </ResponsiveContainer>
             );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <Cmp data={processed.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" height={60} tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end"/>
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    {processed.keys.map((key, idx) => {
                        const color = COLORS[idx % COLORS.length];
                        const props = { key, dataKey: key, fill: color, stroke: color, stackId: segmentBy ? 'a' : undefined, name: key === 'count' ? 'Số lượng' : key };
                        if (type === 'bar') return <Bar {...props} />;
                        if (type === 'line') return <Line type="monotone" {...props} strokeWidth={2} />;
                        if (type === 'area') return <Area type="monotone" {...props} />;
                        return <Bar {...props} />;
                    })}
                </Cmp>
            </ResponsiveContainer>
        );
    };

    return (
        <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
            <div className="flex flex-wrap justify-between items-center mb-4 border-b border-slate-100 pb-2 gap-2">
                <div className="flex gap-2 items-center flex-1 overflow-x-auto">
                    <select className="text-xs border rounded p-1 font-bold text-blue-900" value={type} onChange={e=>updateConfig('type', e.target.value)}><option value="bar">Cột</option><option value="line">Đường</option><option value="pie">Tròn</option><option value="area">Vùng</option></select>
                    <span className="text-xs text-slate-400 whitespace-nowrap">Trục X:</span>
                    <select className="text-xs border rounded p-1 max-w-[100px]" value={xAxis} onChange={e=>updateConfig('x', e.target.value)}>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    
                    {type !== 'pie' && (
                        <>
                            <span className="text-xs text-slate-400 whitespace-nowrap flex items-center gap-1"><Split size={12}/> Chia theo:</span>
                            <select className="text-xs border rounded p-1 max-w-[100px]" value={segmentBy} onChange={e=>updateConfig('segmentBy', e.target.value)}>
                                <option value="">(Không)</option>
                                {columns.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                        </>
                    )}
                </div>
                <button onClick={onDelete} className="text-slate-300 hover:text-red-500"><X size={16}/></button>
            </div>
            <div className="flex-1 min-h-0 text-xs font-medium">{renderContent()}</div>
        </motion.div>
    );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [sheetConfig, setSheetConfig] = useState(null);

  useEffect(() => {
      const savedUser = localStorage.getItem('pka_user_session');
      if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLoginSuccess = (u) => setUser(u);
  const handleConfig = (id, range, name) => setSheetConfig({ id, range, name });
  const handleLogout = () => { setUser(null); setSheetConfig(null); localStorage.removeItem('pka_user_session'); };
  const handleChangeSource = () => setSheetConfig(null);

  if (!user) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  if (!sheetConfig) return <SetupScreen user={user} onConfig={handleConfig} onLogout={handleLogout} />;
  return <Dashboard user={user} config={sheetConfig} onLogout={handleLogout} onChangeSource={handleChangeSource} />;
}
