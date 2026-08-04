import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { exportData, wipeData, importData } from './lib/export-import';
import { createItem, createFolder, orphanSweep } from './lib/db';
import './App.css';

function App() {
  const [items, setItems] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('Connecting to Emulator...');

  useEffect(() => {
    // Run orphan sweep on startup
    orphanSweep().catch(console.error);
    
    // Subscribe to collections
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStatus('Connected');
    }, (error) => {
      setStatus(`Error: ${error.message}`);
    });
    
    const unsubFolders = onSnapshot(collection(db, 'folders'), (snap) => {
      setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => {
      unsubItems();
      unsubFolders();
    };
  }, []);

  const handleExport = async () => {
    try {
      const text = await exportData();
      setExportText(text);
      setStatus('Export complete');
    } catch (e: any) {
      setStatus(`Export failed: ${e.message}`);
    }
  };

  const handleWipe = async () => {
    try {
      await wipeData();
      setStatus('Data wiped');
      setExportText('');
    } catch (e: any) {
      setStatus(`Wipe failed: ${e.message}`);
    }
  };

  const handleImport = async () => {
    try {
      if (!importText) {
        setStatus('Nothing to import');
        return;
      }
      await importData(importText);
      setStatus('Import complete');
    } catch (e: any) {
      setStatus(`Import failed: ${e.message}`);
    }
  };
  
  const handleAddFolder = async () => {
    try {
      await createFolder({
        ownerId: 'user-1',
        name: 'Test Folder ' + Math.floor(Math.random() * 1000),
        icon: 'folder',
        color: 'blue',
        sortKey: 'a0',
        memberIds: ['user-1'],
        roles: { 'user-1': 'owner' }
      });
      setStatus('Folder added');
    } catch (e: any) {
      setStatus(`Error adding folder: ${e.message}`);
    }
  };

  const handleAddTask = async (folderId: string | null = null, parentId: string | null = null) => {
    try {
      let memberIds = ['user-1'];
      if (folderId) {
        const folder = folders.find(f => f.id === folderId);
        if (folder) memberIds = folder.memberIds;
      }
      
      await createItem({
        folderId,
        parentId,
        ownerId: 'user-1',
        memberIds,
        title: 'Test Task ' + Math.floor(Math.random() * 1000),
        done: false,
        completedAt: null,
        reminder: null,
        updatedBy: 'user-1'
      });
      setStatus('Task added');
    } catch (e: any) {
      setStatus(`Error adding task: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>To-Do Stage 1: Emulator Debug</h1>
      <p><strong>Status:</strong> {status}</p>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={handleAddFolder}>Add Folder</button>
        <button onClick={() => handleAddTask(null, null)}>Add Default Task</button>
        {folders.length > 0 && (
          <button onClick={() => handleAddTask(folders[0].id, null)}>Add Task in Folder</button>
        )}
        {items.filter(i => !i.parentId).length > 0 && (
          <button onClick={() => handleAddTask(null, items.find(i => !i.parentId)?.id)}>Add Subtask</button>
        )}
        <button onClick={() => orphanSweep().then(() => setStatus('Sweep done'))}>Force Orphan Sweep</button>
      </div>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h3>Export / Wipe / Import</h3>
          <button onClick={handleExport}>1. Export Data</button>
          <button onClick={handleWipe}>2. Wipe Data</button>
          <br /><br />
          <textarea 
            value={exportText} 
            readOnly 
            placeholder="Exported data will appear here"
            style={{ width: '100%', height: '150px' }}
          />
          <br /><br />
          <textarea 
            value={importText} 
            onChange={e => setImportText(e.target.value)} 
            placeholder="Paste JSON here to import"
            style={{ width: '100%', height: '150px' }}
          />
          <br />
          <button onClick={handleImport}>3. Import Data</button>
        </div>
        
        <div style={{ flex: 1, height: '400px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
          <h3>Local Cache</h3>
          <h4>Folders ({folders.length})</h4>
          <pre style={{ fontSize: '12px' }}>{JSON.stringify(folders, null, 2)}</pre>
          <h4>Items ({items.length})</h4>
          <pre style={{ fontSize: '12px' }}>{JSON.stringify(items, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

export default App;
