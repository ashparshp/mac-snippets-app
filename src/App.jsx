import { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Target, 
  Search, 
  Copy, 
  Check, 
  Hash, 
  MessageSquare
} from 'lucide-react';

export default function App() {
  const [folders, setFolders] = useState([]);
  const [snippets, setSnippets] = useState([]);

  const [activeFolderId, setActiveFolderId] = useState(null);
  const [captureTargetId, setCaptureTargetId] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  
  const [copiedId, setCopiedId] = useState(null);

  // New states for keyboard navigation
  const [activePane, setActivePane] = useState('folders'); // 'folders' | 'snippets'
  const [selectedSnippetId, setSelectedSnippetId] = useState(null);

  const searchInputRef = useRef(null);
  const editInputRef = useRef(null);
  const lastClipboardText = useRef('');

  // Auto-focus search when window focuses
  useEffect(() => {
    const handleFocus = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Keyboard Navigation
  const filteredSnippets = snippets
    .filter(s => s.folderId === activeFolderId)
    .filter(s => s.content.toLowerCase().includes(searchQuery.toLowerCase()));

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't intercept if editing a folder name
      if (editingFolderId) return;

      // Hide window on Escape
      if (e.key === 'Escape') {
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.send('hide-window');
        }
        return;
      }

      // Don't intercept if typing in the new snippet textarea
      if (document.activeElement.tagName === 'TEXTAREA') return;

      const isSearchFocused = document.activeElement === searchInputRef.current;

      // Copy snippet shortcut
      if (e.key.toLowerCase() === 'c' && !isSearchFocused && activePane === 'snippets') {
        const snippet = filteredSnippets.find(s => s.id === selectedSnippetId);
        if (snippet) copyToClipboard(snippet.id, snippet.content);
        return;
      }

      if (isSearchFocused) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          searchInputRef.current.blur();
          setActivePane('snippets');
          if (!selectedSnippetId && filteredSnippets.length > 0) {
            setSelectedSnippetId(filteredSnippets[0].id);
          }
        }
        return;
      }

      // Global Navigation (when not in an input)
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActivePane('snippets');
        if (!selectedSnippetId && filteredSnippets.length > 0) {
          setSelectedSnippetId(filteredSnippets[0].id);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActivePane('folders');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activePane === 'folders') {
          const idx = folders.findIndex(f => f.id === activeFolderId);
          if (idx < folders.length - 1) setActiveFolderId(folders[idx + 1].id);
        } else if (activePane === 'snippets') {
          const idx = filteredSnippets.findIndex(s => s.id === selectedSnippetId);
          if (idx < filteredSnippets.length - 1) setSelectedSnippetId(filteredSnippets[idx + 1].id);
          else if (idx === -1 && filteredSnippets.length > 0) setSelectedSnippetId(filteredSnippets[0].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activePane === 'folders') {
          const idx = folders.findIndex(f => f.id === activeFolderId);
          if (idx > 0) setActiveFolderId(folders[idx - 1].id);
        } else if (activePane === 'snippets') {
          const idx = filteredSnippets.findIndex(s => s.id === selectedSnippetId);
          if (idx > 0) setSelectedSnippetId(filteredSnippets[idx - 1].id);
          else if (idx === 0 || idx === -1) {
            searchInputRef.current.focus();
            setActivePane('snippets'); // keep snippets pane context when searching
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingFolderId, activePane, activeFolderId, selectedSnippetId, folders, filteredSnippets]);

  // Auto-track clipboard
  useEffect(() => {
    if (!captureTargetId) return;

    let electronClipboard = null;
    if (typeof window !== 'undefined' && window.require) {
      electronClipboard = window.require('electron').clipboard;
      lastClipboardText.current = electronClipboard.readText();
    }

    const interval = setInterval(() => {
      if (!electronClipboard) return;
      
      const currentText = electronClipboard.readText();
      if (currentText && currentText !== lastClipboardText.current) {
        lastClipboardText.current = currentText;
        
        const newSnippet = {
          id: Date.now().toString(),
          folderId: captureTargetId,
          content: currentText.trim()
        };
        setSnippets(prev => [newSnippet, ...prev]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [captureTargetId]);

  // Auto-focus edit input when editing starts
  useEffect(() => {
    if (editingFolderId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFolderId]);

  const handleAddFolder = () => {
    const newId = Date.now().toString();
    setFolders([...folders, { id: newId, name: 'New Folder' }]);
    setActiveFolderId(newId);
    setActivePane('folders');
    setEditingFolderId(newId);
    setEditingFolderName('New Folder');
  };

  const saveFolderRename = () => {
    if (!editingFolderId) return;
    if (editingFolderName.trim() === '') {
      setEditingFolderId(null);
      return;
    }
    setFolders(prev => prev.map(f => f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f));
    setEditingFolderId(null);
  };

  const handleRenameKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFolderRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingFolderId(null);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!inputText.trim()) return;

      const targetFolderId = captureTargetId || activeFolderId;
      if (!targetFolderId) return;

      const newSnippet = {
        id: Date.now().toString(),
        folderId: targetFolderId,
        content: inputText.trim()
      };

      setSnippets([newSnippet, ...snippets]);
      setInputText('');
    }
  };

  const copyToClipboard = (id, content) => {
    if (typeof window !== 'undefined' && window.require) {
      window.require('electron').clipboard.writeText(content);
    } else {
      navigator.clipboard.writeText(content);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const targetFolder = folders.find(f => f.id === (captureTargetId || activeFolderId));

  return (
    <div className="w-screen h-screen flex p-4 select-none">
      <div className="flex w-full h-full bg-slate-900/80 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden text-slate-200 shadow-2xl">
        
        {/* Left Sidebar */}
        <div className="w-64 bg-black/20 border-r border-white/5 flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <h2 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">Folders</h2>
            <button 
              onClick={handleAddFolder}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              title="Add Folder"
            >
              <FolderPlus size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {folders.map(folder => (
              <div 
                key={folder.id}
                onClick={() => {
                  if (editingFolderId !== folder.id) {
                    setActiveFolderId(folder.id);
                    setActivePane('folders');
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingFolderId(folder.id);
                  setEditingFolderName(folder.name);
                }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeFolderId === folder.id 
                    ? activePane === 'folders'
                      ? 'bg-blue-500/30 text-blue-100 ring-1 ring-blue-500/50 shadow-sm'
                      : 'bg-blue-500/10 text-blue-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Folder size={16} className={activeFolderId === folder.id ? 'text-blue-400' : 'text-slate-500'} />
                  {editingFolderId === folder.id ? (
                    <input
                      ref={editInputRef}
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={saveFolderRename}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="bg-black/40 text-white px-2 py-0.5 rounded text-sm w-full outline-none focus:ring-1 focus:ring-blue-500 select-text"
                    />
                  ) : (
                    <span className="text-sm truncate">{folder.name}</span>
                  )}
                </div>
                
                {/* Capture Session Toggle */}
                {!editingFolderId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCaptureTargetId(captureTargetId === folder.id ? null : folder.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md ${
                      captureTargetId === folder.id ? 'opacity-100 text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Set as Capture Session target"
                  >
                    <Target size={14} className={captureTargetId === folder.id ? 'fill-red-400/20' : ''} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Main View */}
        <div 
          className="flex-1 flex flex-col min-w-0"
          onClick={() => setActivePane('snippets')}
        >
          
          {/* Top Bar: Search */}
          <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
            <Search size={18} className="text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setActivePane('snippets')}
              className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 outline-none text-sm select-text"
            />
          </div>

          {/* Snippet List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
            {filteredSnippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageSquare size={48} className="mb-4 opacity-20" />
                <p className="text-sm">No snippets found in this folder.</p>
              </div>
            ) : (
              filteredSnippets.map(snippet => (
                <div 
                  key={snippet.id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePane('snippets');
                    setSelectedSnippetId(snippet.id);
                  }}
                  className={`group relative border rounded-xl p-4 transition-all cursor-pointer ${
                    selectedSnippetId === snippet.id && activePane === 'snippets'
                      ? 'bg-blue-500/20 border-blue-500/50 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 border-white/5'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap font-mono text-slate-300 select-text leading-relaxed">
                    {snippet.content}
                  </p>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(snippet.id, snippet.content);
                    }}
                    className="absolute top-3 right-3 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm border border-white/10 shadow-lg"
                    title="Copy to clipboard (C)"
                  >
                    {copiedId === snippet.id ? (
                      <span className="flex items-center gap-2 text-xs text-green-400 font-medium">
                        <Check size={14} /> Copied!
                      </span>
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                  
                  {/* Shortcut Hint */}
                  {selectedSnippetId === snippet.id && activePane === 'snippets' && copiedId !== snippet.id && (
                    <div className="absolute bottom-3 right-3 opacity-50 text-xs text-slate-400">
                      Press 'C' to copy
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Bottom Input */}
          <div className="p-4 border-t border-white/5 bg-black/20" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={targetFolder ? `Save to "${targetFolder.name}"... (Press Enter to save, Shift+Enter for new line)` : "Create a folder first to save snippets..."}
                disabled={!targetFolder}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all resize-none scrollbar-thin select-text"
                rows={3}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
