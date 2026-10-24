import { Dashboard } from '../pages/Dashboard.jsx';
import { CreateLabel } from '../pages/CreateLabel.jsx';
import { CreatePrnLabel } from '../pages/CreatePrnLabel.jsx';
import { BulkBarcodes } from '../pages/BulkBarcodes.jsx';
import { UnmaskTrackingIds } from '../pages/UnmaskTrackingIds.jsx';
import { LpTrackerList } from '../pages/LpTrackerList.jsx';
import { EodReportGenerator } from '../pages/EodReportGenerator.jsx';
import { WishmasterVendorManager } from '../pages/WishmasterVendorManager.jsx';
import { LabelHistory } from '../pages/LabelHistory.jsx';
import { WmLossEmailGenerator } from '../pages/WmLossEmailGenerator.jsx';
import { Settings } from '../pages/Settings.jsx';
import { ManualDeliveryTracker } from '../pages/ManualDeliveryTracker.jsx';
import { WishmasterReturnVerification } from '../pages/ReturnVerification.jsx';
import { TrackingSorter } from '../pages/TrackingSorter.jsx';
import { DriveLinksManager } from '../pages/DriveLinksManager.jsx';
import BagSessionManager from '../pages/BagSessionManager.jsx';
import BulkTrackingSearch from '../pages/BulkTrackingSearch.jsx';
import KotAutomationConsoleGenerator from '../pages/KotAutomationConsoleGenerator.jsx';

export const APP_ROUTES = [
  { id: 'dashboard', label: 'Dashboard', path: '/', component: Dashboard, inNav: true },
  { id: 'create', label: 'Create Label', path: '/create', component: CreateLabel, inNav: true },
  { id: 'create_edit', label: 'Edit Label', path: '/create/:id', component: CreateLabel, inNav: false, inherits: 'create' },
  { id: 'create_prn', label: 'Create PRN Label', path: '/create-prn', component: CreatePrnLabel, inNav: true },
  { id: 'bulk', label: 'Bulk Barcodes', path: '/bulk', component: BulkBarcodes, inNav: true },
  { id: 'unmask', label: 'Unmask Tracking IDs', path: '/unmask', component: UnmaskTrackingIds, inNav: true },
  { id: 'lp', label: 'LP Tracker', path: '/lp', component: LpTrackerList, inNav: true },
  { id: 'eod', label: 'EOD Report', path: '/eod', component: EodReportGenerator, inNav: true },
  { id: 'vendors', label: 'Wishmaster Vendors', path: '/vendors', component: WishmasterVendorManager, inNav: true },
  { id: 'history', label: 'Label History', path: '/history', component: LabelHistory, inNav: true },
  { id: 'lossgen', label: 'WM Loss Email', path: '/lossgen', component: WmLossEmailGenerator, inNav: true },
  { id: 'manualdelivery', label: 'Manual Delivery Tracker', path: '/manualdelivery', component: ManualDeliveryTracker, inNav: true },
  { id: 'verifytid', label: 'Return Verification', path: '/verifytid', component: WishmasterReturnVerification, inNav: true },
  { id: 'sort', label: 'Tracking Sorter', path: '/sort', component: TrackingSorter, inNav: true },
  { id: 'gdrive', label: 'Drive Links', path: '/gdrive', component: DriveLinksManager, inNav: true },
  { id: 'bags', label: 'Bag Sessions', path: '/bags', component: BagSessionManager, inNav: true },
  { id: 'search', label: 'Bulk Tracking Search', path: '/search', component: BulkTrackingSearch, inNav: true },
  { id: 'chromebook', label: 'Automation Console', path: '/chromebook', component: KotAutomationConsoleGenerator, inNav: true },
  { id: 'settings', label: 'Settings', path: '/settings', component: Settings, inNav: true },
];

// List used by Admin UI for toggling permissions (excludes sub-paths like /create/:id)
export const PERMISSION_ITEMS = APP_ROUTES
  .filter((r) => !r.inherits)
  .map(({ id, label }) => ({ id, label }));