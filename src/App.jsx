import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { ToastProvider } from './lib/useToast.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { CreateLabel } from './pages/CreateLabel.jsx';
import { BulkBarcodes } from './pages/BulkBarcodes.jsx';
import { LabelHistory } from './pages/LabelHistory.jsx';
import { Settings } from './pages/Settings.jsx';
import { UnmaskTrackingIds } from './pages/UnmaskTrackingIds.jsx';

import { LpTrackerList } from './pages/LpTrackerList.jsx';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateLabel />} />
            <Route path="/create/:id" element={<CreateLabel />} />
            <Route path="/bulk" element={<BulkBarcodes />} />
            <Route path="/unmask" element={<UnmaskTrackingIds />} />
            <Route path="/lp" element={<LpTrackerList />} />
            <Route path="/history" element={<LabelHistory />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
