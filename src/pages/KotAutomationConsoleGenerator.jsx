import React, { useState, useMemo } from 'react';

export default function KotAutomationConsoleGenerator() {
  const [activeTab, setActiveTab] = useState('watcher'); // 'watcher' | 'runsheet' | 'scanner' | 'prc'
  const [copied, setCopied] = useState(false);

  // Common Configuration
  const [rawTids, setRawTids] = useState('');
  const [stepDelay, setStepDelay] = useState(1);

  // Live Watcher State (Manual Scan - Zero TIDs needed)
  const [enableWatcherCpd, setEnableWatcherCpd] = useState(true);
  const [enableWatcherRto, setEnableWatcherRto] = useState(true);
  const [debounceMs, setDebounceMs] = useState(500);

  // Scanner & Alarms State (Bulk Queue)
  const [enableCpdAlarm, setEnableCpdAlarm] = useState(true);
  const [enableRtoAlarm, setEnableRtoAlarm] = useState(true);
  const [enablePrcAutomation, setEnablePrcAutomation] = useState(false);
  const [isolateTracking, setIsolateTracking] = useState(true);
  const [enableExclusions, setEnableExclusions] = useState(true);
  const [filterDuplicates, setFilterDuplicates] = useState(true); // Toggle to filter duplicates
  const [excludeWords, setExcludeWords] = useState('FORWARD, UNDELIVERED, FLIPKART, ESCALATION, VERIFICATION, SHIPMENTS, PACKAGING, MANDATORY');

  // Runsheet Specific State
  const [agentName, setAgentName] = useState('Abdul Basith');
  const [vehicleType, setVehicleType] = useState('Bike');
  const [actionType, setActionType] = useState('DRAFT'); // 'DRAFT' | 'CONFIRM'
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('09:00 AM');

  // PRC Specific State
  const [prcReason, setPrcReason] = useState('Customer Not Available');
  const [prcSubReason, setPrcSubReason] = useState('Call Not Answered');
  const [otpBypass, setOtpBypass] = useState(true);

  // Filter Tracking IDs using KOT regex, keyword exclusions, and deduplication rules
  const parsedTids = useMemo(() => {
    const rawLines = rawTids.split(/\s+/).map(s => s.trim()).filter(Boolean);
    const blocked = excludeWords
      .split(/[\n,;\t]+/)
      .map(w => w.trim().toUpperCase())
      .filter(Boolean);

    const regex = /^[A-Z]{3,4}[A-Z0-9\-_]{5,15}$/i;
    const seen = new Set();
    const result = [];

    for (const segment of rawLines) {
      let target = segment.trim();
      const upper = target.toUpperCase();

      if (enableExclusions && blocked.some(k => upper === k || upper.includes(k))) {
        continue;
      }

      if (isolateTracking) {
        if (regex.test(target)) {
          target = target.toUpperCase();
        } else {
          continue;
        }
      }

      if (filterDuplicates) {
        if (!seen.has(target)) {
          seen.add(target);
          result.push(target);
        }
      } else {
        result.push(target);
      }
    }
    return result;
  }, [rawTids, isolateTracking, enableExclusions, filterDuplicates, excludeWords]);

  // SCRIPT 1: Live Manual Scan Alarm Watcher (Zero TIDs)
  const watcherScript = useMemo(() => {
    return `(() => {
  // =========================================================================
  // KOT-ScanDeck: Manual Scan Live Alarm Watcher (Zero TIDs Required)
  // Generated on: ${new Date().toLocaleString()}
  // =========================================================================
  const CONFIG = {
    enableRtoAlarm: ${enableWatcherRto},
    enableCpdAlarm: ${enableWatcherCpd},
    debounceMs: ${debounceMs}
  };

  let isWatching = true;
  window.stopAlarmWatcher = () => {
    isWatching = false;
    if (window._kotObserver) window._kotObserver.disconnect();
    console.warn("⏹ Live Alarm Watcher stopped.");
  };

  function playRtoAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  function playCpdAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.12));
        gain.gain.setValueAtTime(0.25, ctx.currentTime + (idx * 0.12));
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (idx * 0.12) + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + (idx * 0.12));
        osc.stop(ctx.currentTime + (idx * 0.12) + 0.35);
      });
    } catch (e) {}
  }

  function getTodayDateString() {
    const d = new Date();
    return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
  }

  let lastAlarmTime = 0;
  function inspectPageForAlerts() {
    if (!isWatching) return;
    const elements = Array.from(document.querySelectorAll('.sc-AykKC, .fmcvyS, div, td, tr, span'));

    let isRtoYesDetected = false;
    const rtoLabelNode = elements.find(el => {
      const text = el.textContent ? el.textContent.trim().toUpperCase() : '';
      return text === "IS RTO" || text === "IS RTO:";
    });

    if (rtoLabelNode) {
      const parentCell = rtoLabelNode.closest('.fmcvyS, div, td') || rtoLabelNode.parentElement;
      const containerText = parentCell ? parentCell.textContent.toUpperCase() : '';
      if (containerText.includes('YES') && !containerText.includes('IS RTO CV')) {
        isRtoYesDetected = true;
      }
    } else {
      const bodyText = (document.body.textContent || document.body.innerText || '').replace(/\\s+/g, ' ').toUpperCase();
      if (bodyText.includes('IS RTO YES')) isRtoYesDetected = true;
    }

    let isTodayCpdDetected = false;
    const todayStr = getTodayDateString();
    const cpdLabelNode = elements.find(el => {
      const text = el.textContent ? el.textContent.trim().toUpperCase() : '';
      return text === "CPD" || text === "CPD:";
    });

    if (cpdLabelNode) {
      const parentCell = cpdLabelNode.closest('.fmcvyS, div, td') || cpdLabelNode.parentElement;
      const containerText = parentCell ? parentCell.textContent : '';
      if (containerText.includes(todayStr)) isTodayCpdDetected = true;
    }

    const now = Date.now();
    if (now - lastAlarmTime > CONFIG.debounceMs) {
      if (isRtoYesDetected && CONFIG.enableRtoAlarm) {
        console.warn("🚨 [ALARM] RTO DETECTED ON SCANNED SHIPMENT!");
        playRtoAlarm();
        lastAlarmTime = now;
      } else if (isTodayCpdDetected && CONFIG.enableCpdAlarm) {
        console.warn("📅 [ALARM] TODAY CPD DETECTED ON SCANNED SHIPMENT!");
        playCpdAlarm();
        lastAlarmTime = now;
      }
    }
  }

  if (window._kotObserver) window._kotObserver.disconnect();
  window._kotObserver = new MutationObserver(() => inspectPageForAlerts());
  window._kotObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  console.log("%c⚡ KOT Live Alarm Watcher Active!", "color:#10b981;font-weight:bold;font-size:14px;");
  console.log("Ready for manual scanner input. Type stopAlarmWatcher() to disconnect.");
})();`;
  }, [enableWatcherRto, enableWatcherCpd, debounceMs]);

  // SCRIPT 2: Turbo Runsheet Engine
  const runsheetScript = useMemo(() => {
    return `(() => {
  // =========================================================================
  // KOT-ScanDeck: Turbo-Speed Auto-Runsheet Runner (Console Executable)
  // Generated on: ${new Date().toLocaleString()}
  // Target Queue: ${parsedTids.length} Shipments
  // =========================================================================
  const CONFIG = {
    agentName: ${JSON.stringify(agentName)},
    vehicleType: ${JSON.stringify(vehicleType)},
    actionType: ${JSON.stringify(actionType)},
    stepDelay: ${stepDelay},
    isScheduled: ${scheduleEnabled},
    scheduleTime: ${JSON.stringify(scheduleTime)},
    trackingIds: ${JSON.stringify(parsedTids, null, 2)}
  };

  let isAborted = false;
  window.stopRunsheet = () => {
    isAborted = true;
    console.warn("⏹ Runsheet execution halted by user.");
  };

  function playAlertChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  function getScheduledDate(timeStr) {
    const parts = timeStr.trim().split(/[:\\s]+/);
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const ampm = (parts[2] || 'AM').toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() - Date.now() < -1000) d.setDate(d.getDate() + 1);
    return d;
  }

  function instantInject(el, val) {
    if (!el) return;
    el.removeAttribute('disabled');
    el.disabled = false;
    el.focus();
    
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, val); else el.value = val;
    
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    const k = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
    el.dispatchEvent(new KeyboardEvent('keydown', k));
    el.dispatchEvent(new KeyboardEvent('keyup', k));
  }

  function getSaveBtn(mode) {
    return document.querySelector(
      mode === 'CONFIRM' 
        ? 'button[data-cy="saveAndConfirm"], button[data-testid="confirmRunsheet"]' 
        : 'button[data-cy="save"], button[data-testid="saveRunsheet"]'
    );
  }

  function detectConflict(tid) {
    const alerts = document.querySelectorAll('div[data-cy="non-acionable-toast"], div[data-cy="toastMessage"], div[role="alert"]');
    for (const el of alerts) {
      const txt = (el.innerText || '').toUpperCase();
      if (txt.includes('SAVING RUNSHEET')) continue;
      if (txt.includes('ALREADY') || txt.includes('ACTIVE RUNSHEET') || txt.includes('NOT PRESENT') || txt.includes('INVALID SHIPMENT')) {
        if (tid && !txt.includes(tid.toUpperCase()) && (txt.includes('FMPR') || txt.includes('MDGR') || txt.includes('MYSR'))) continue;
        return txt;
      }
    }
    return null;
  }

  async function executeTurbo() {
    console.log("%c⚡ Starting Turbo Runsheet Execution...", "color:#4f46e5;font-weight:bold;font-size:14px;");
    playAlertChime();
    let saved = 0, skipped = 0;

    for (let i = 0; i < CONFIG.trackingIds.length; i++) {
      if (isAborted) break;
      const tid = CONFIG.trackingIds[i].trim();
      if (!tid) continue;

      document.title = \`[\${i + 1}/\${CONFIG.trackingIds.length}] \${tid}\`;

      try {
        const createBtn = document.querySelector('button[data-cy="createRunsheetButton"], button[data-track-name="create_runsheet_click"]');
        if (createBtn && createBtn.offsetParent !== null) {
          createBtn.click();
        }

        let agentInput = document.querySelector('div[data-cy="selectComponent-agentId"] input, input[id^="react-select-44"]');
        const waitStart = Date.now();
        while (!agentInput && Date.now() - waitStart < 1500) {
          await new Promise(r => setTimeout(r, 10));
          agentInput = document.querySelector('div[data-cy="selectComponent-agentId"] input, input[id^="react-select-44"]');
        }

        if (agentInput) {
          instantInject(agentInput, CONFIG.agentName);
          await new Promise(r => setTimeout(r, 20));
          const opt = document.querySelector('div[class*="-option"], #agent-options div');
          if (opt) opt.click();
        }

        const vInput = document.querySelector('div[data-cy="selectComponent-vehicleType"] input, input[id^="react-select-45"]');
        if (vInput) {
          instantInject(vInput, CONFIG.vehicleType);
          await new Promise(r => setTimeout(r, 20));
          const vOpt = document.querySelector('#vehicle-options-menu div, div[class*="-option"]');
          if (vOpt) vOpt.click();
        }

        const startScan = document.querySelector('button[data-cy="buttonStartScanning"]');
        if (startScan && startScan.offsetParent !== null) {
          startScan.click();
        }

        const scanInput = document.querySelector('input#enteredShipmentId, input[data-testid="enterShipment"]');
        if (scanInput) {
          instantInject(scanInput, tid);
        }

        let saveBtn = null, conflict = null;
        const checkStart = Date.now();
        while (Date.now() - checkStart < 1500) {
          const btn = getSaveBtn(CONFIG.actionType);
          if (btn && !btn.disabled && (btn.classList.contains('primary') || btn.classList.contains('success'))) {
            saveBtn = btn;
            break;
          }
          conflict = detectConflict(tid);
          if (conflict) break;
          await new Promise(r => setTimeout(r, 10));
        }

        if (conflict || !saveBtn) {
          console.warn(\`⚠️ Skipped \${tid}: \${conflict || 'Save not ready'}\`);
          skipped++;
          const disc = document.querySelector('button[data-cy="discardRunsheet"]');
          if (disc) disc.click();
          await new Promise(r => setTimeout(r, CONFIG.stepDelay));
          continue;
        }

        saveBtn.click();
        saved++;

        const redStart = Date.now();
        while (Date.now() - redStart < 2500) {
          const listBtn = document.querySelector('button[data-cy="createRunsheetButton"]');
          if (!document.querySelector('button[data-cy="save"]') || (listBtn && listBtn.offsetParent !== null)) {
            break;
          }
          await new Promise(r => setTimeout(r, 15));
        }

        if (CONFIG.stepDelay > 0) {
          await new Promise(r => setTimeout(r, CONFIG.stepDelay));
        }

      } catch (err) {
        console.error(\`Error processing \${tid}:\`, err);
        skipped++;
        const disc = document.querySelector('button[data-cy="discardRunsheet"]');
        if (disc) disc.click();
      }
    }

    document.title = "Runsheet Finished ✅";
    console.log(\`%c🏁 Complete! (\${saved} Saved, \${skipped} Skipped)\`, "color:#059669;font-weight:bold;font-size:14px;");
  }

  if (!CONFIG.isScheduled) {
    executeTurbo();
  } else {
    const target = getScheduledDate(CONFIG.scheduleTime);
    console.log(\`%c⏰ Runsheet scheduled for \${CONFIG.scheduleTime} (\${target.toLocaleTimeString()})\`, "color:#6366f1;font-weight:bold;");
    console.log("Type stopRunsheet() in console to cancel.");
    const timer = setInterval(() => {
      const diff = target.getTime() - Date.now();
      if (diff <= 1000) {
        clearInterval(timer);
        executeTurbo();
      } else {
        const m = Math.floor((diff / 1000) / 60);
        const s = Math.floor((diff / 1000) % 60);
        document.title = \`⏳ Starts in \${m}m \${s}s\`;
      }
    }, 1000);
  }
})();`;
  }, [parsedTids, agentName, vehicleType, actionType, stepDelay, scheduleEnabled, scheduleTime]);

  // SCRIPT 3: Scanner with Dual Engine & Alarms
  const scannerScript = useMemo(() => {
    return `(() => {
  // =========================================================================
  // KOT-ScanDeck: Scanner Injector with Dual Injection Modes & Synth Alarms
  // Generated on: ${new Date().toLocaleString()}
  // Target Queue: ${parsedTids.length} Shipments
  // Mode: ${enablePrcAutomation ? 'PRC AUTOMATION (Hardware Keystroke Simulation)' : 'NORMAL (Extreme Speed Native Setter)'}
  // =========================================================================
  const SCANNER_CONFIG = {
    enableCpdAlarm: ${enableCpdAlarm},
    enableRtoAlarm: ${enableRtoAlarm},
    enablePrcAutomation: ${enablePrcAutomation},
    scanDelay: ${stepDelay},
    trackingIds: ${JSON.stringify(parsedTids, null, 2)}
  };

  let stopInjection = false;
  window.stopScanner = () => {
    stopInjection = true;
    console.warn("⏹ Scanner halted by user.");
  };

  function playSynthRtoAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  function playSynthCpdAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.12));
        gain.gain.setValueAtTime(0.25, ctx.currentTime + (idx * 0.12));
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (idx * 0.12) + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + (idx * 0.12));
        osc.stop(ctx.currentTime + (idx * 0.12) + 0.35);
      });
    } catch (e) {}
  }

  function getTodayDateString() {
    const d = new Date();
    return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
  }

  let lastAlarmTime = 0;
  function inspectPageForAlerts() {
    const elements = Array.from(document.querySelectorAll('.sc-AykKC, .fmcvyS, div, td, tr, span'));
    let isRto = false;
    let isCpd = false;
    const today = getTodayDateString();

    const rtoLabel = elements.find(el => {
      const t = (el.textContent || '').trim().toUpperCase();
      return t === "IS RTO" || t === "IS RTO:";
    });
    if (rtoLabel) {
      const cell = rtoLabel.closest('.fmcvyS, div, td') || rtoLabel.parentElement;
      const cTxt = cell ? cell.textContent.toUpperCase() : '';
      if (cTxt.includes('YES') && !cTxt.includes('IS RTO CV')) isRto = true;
    }

    const cpdLabel = elements.find(el => {
      const t = (el.textContent || '').trim().toUpperCase();
      return t === "CPD" || t === "CPD:";
    });
    if (cpdLabel) {
      const cell = cpdLabel.closest('.fmcvyS, div, td') || cpdLabel.parentElement;
      const cTxt = cell ? cell.textContent : '';
      if (cTxt.includes(today)) isCpd = true;
    }

    const now = Date.now();
    if (now - lastAlarmTime > 500) {
      if (isRto && SCANNER_CONFIG.enableRtoAlarm) {
        console.warn("🚨 RTO DETECTED ON SCREEN!");
        playSynthRtoAlarm();
        lastAlarmTime = now;
      } else if (isCpd && SCANNER_CONFIG.enableCpdAlarm) {
        console.warn("📅 TODAY CPD DETECTED ON SCREEN!");
        playSynthCpdAlarm();
        lastAlarmTime = now;
      }
    }
  }

  const alertObserver = new MutationObserver(() => inspectPageForAlerts());
  alertObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.stopAlertObserver = () => alertObserver.disconnect();

  async function simulateHardwareScan(element, text) {
    const inputProto = window.HTMLInputElement.prototype;
    const textareaProto = window.HTMLTextAreaElement.prototype;
    const nativeSetter = 
      Object.getOwnPropertyDescriptor(inputProto, 'value')?.set ||
      Object.getOwnPropertyDescriptor(textareaProto, 'value')?.set;

    if (!SCANNER_CONFIG.enablePrcAutomation) {
      if (nativeSetter) {
        nativeSetter.call(element, text);
      } else {
        element.value = text;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      ['keydown', 'keypress', 'keyup'].forEach(eventType => {
        element.dispatchEvent(new KeyboardEvent(eventType, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      });
      return;
    }

    if (nativeSetter) {
      nativeSetter.call(element, '');
    } else {
      element.value = '';
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(r => setTimeout(r, 40));

    let currentVal = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charCode = char.charCodeAt(0);
      const codeStr = /[0-9]/.test(char) ? \`Digit\${char}\` : \`Key\${char.toUpperCase()}\`;

      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: codeStr, keyCode: charCode, which: charCode, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: char, code: codeStr, keyCode: charCode, which: charCode, bubbles: true }));

      currentVal += char;
      if (nativeSetter) {
        nativeSetter.call(element, currentVal);
      } else {
        element.value = currentVal;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: codeStr, keyCode: charCode, which: charCode, bubbles: true }));

      await new Promise(r => setTimeout(r, 8));
    }

    await new Promise(r => setTimeout(r, 10));

    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      element.dispatchEvent(new KeyboardEvent(eventType, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    });

    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function startScanning() {
    if (SCANNER_CONFIG.trackingIds.length === 0) {
      console.warn("⚠️ No Tracking IDs configured!");
      return;
    }

    let activeEl = document.activeElement;
    if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')) {
      activeEl = document.querySelector('input#enteredShipmentId, input[type="text"], input:not([type]), textarea');
    }

    if (!activeEl) {
      alert("⚠️ Click into the scan barcode input field first!");
      return;
    }

    console.log("%c⚡ Barcode Injection Started (\${SCANNER_CONFIG.enablePrcAutomation ? 'PRC Hardware Mode' : 'Normal Speed Mode'})...", "color:#2563eb;font-weight:bold;font-size:14px;");

    for (let i = 0; i < SCANNER_CONFIG.trackingIds.length; i++) {
      if (stopInjection) break;
      const tid = SCANNER_CONFIG.trackingIds[i];
      document.title = \`[Scanning \${i + 1}/\${SCANNER_CONFIG.trackingIds.length}] \${tid}\`;
      console.log(\`[\${i + 1}/\${SCANNER_CONFIG.trackingIds.length}] \${tid}\`);

      activeEl.focus();

      if (SCANNER_CONFIG.enablePrcAutomation) {
        activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
        await new Promise(res => setTimeout(res, 30));
      }

      await simulateHardwareScan(activeEl, tid);

      if (SCANNER_CONFIG.scanDelay > 0) {
        await new Promise(r => setTimeout(r, SCANNER_CONFIG.scanDelay));
      }
    }

    document.title = "Scanning Completed ✅";
    console.log("%c🏁 Barcode Injection Completed!", "color:#059669;font-weight:bold;font-size:14px;");
  }

  startScanning();
})();`;
  }, [parsedTids, enableCpdAlarm, enableRtoAlarm, enablePrcAutomation, stepDelay]);

  // SCRIPT 4: Automated PRC (Return / Undelivered / Cancellation)
  const prcScript = useMemo(() => {
    return `(() => {
  // =========================================================================
  // KOT-ScanDeck: PRC (Return / Cancellation) Automation
  // Generated on: ${new Date().toLocaleString()}
  // Total Shipments: ${parsedTids.length}
  // =========================================================================
  const PRC_CONFIG = {
    stepDelay: ${stepDelay},
    primaryReason: ${JSON.stringify(prcReason)},
    subReason: ${JSON.stringify(prcSubReason)},
    bypassOtp: ${otpBypass},
    trackingIds: ${JSON.stringify(parsedTids, null, 2)}
  };

  let stopPrc = false;
  window.abortPrc = () => {
    stopPrc = true;
    console.warn("⏹ PRC Automation halted by user.");
  };

  async function injectValue(el, val) {
    if (!el) return;
    el.removeAttribute('disabled');
    el.disabled = false;
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 40));
    if (setter) setter.call(el, val); else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 40));
    const k = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
    el.dispatchEvent(new KeyboardEvent('keydown', k));
    el.dispatchEvent(new KeyboardEvent('keyup', k));
  }

  async function startPrcEngine() {
    console.log("%c⚡ Starting PRC Return Automation...", "color:#dc2626;font-weight:bold;font-size:14px;");
    let success = 0, failed = 0;

    for (let i = 0; i < PRC_CONFIG.trackingIds.length; i++) {
      if (stopPrc) break;
      const tid = PRC_CONFIG.trackingIds[i];
      document.title = \`[PRC \${i + 1}/\${PRC_CONFIG.trackingIds.length}] \${tid}\`;
      console.log(\`[PRC \${i + 1}/\${PRC_CONFIG.trackingIds.length}] Processing: \${tid}\`);

      try {
        const searchInput = document.querySelector('input[data-cy="searchShipment"], input#shipment-search');
        if (searchInput) {
          await injectValue(searchInput, tid);
          await new Promise(r => setTimeout(r, PRC_CONFIG.stepDelay));
        }

        const actionBtn = document.querySelector(\`tr[data-shipment-id="\${tid}"] button[data-cy="actionBtn"], button[data-testid="markUndelivered"]\`);
        if (actionBtn) {
          actionBtn.click();
          await new Promise(r => setTimeout(r, 300));
        }

        const reasonSelect = document.querySelector('div[data-cy="select-primary-reason"] input, select#undelivered-reason');
        if (reasonSelect) {
          if (reasonSelect.tagName === 'SELECT') {
            reasonSelect.value = PRC_CONFIG.primaryReason;
            reasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            await injectValue(reasonSelect, PRC_CONFIG.primaryReason);
            const opt = document.querySelector('div[class*="-option"]');
            if (opt) opt.click();
          }
          await new Promise(r => setTimeout(r, 200));
        }

        const subReasonSelect = document.querySelector('div[data-cy="select-sub-reason"] input, select#undelivered-subreason');
        if (subReasonSelect) {
          if (subReasonSelect.tagName === 'SELECT') {
            subReasonSelect.value = PRC_CONFIG.subReason;
            subReasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            await injectValue(subReasonSelect, PRC_CONFIG.subReason);
            const subOpt = document.querySelector('div[class*="-option"]');
            if (subOpt) subOpt.click();
          }
          await new Promise(r => setTimeout(r, 200));
        }

        if (PRC_CONFIG.bypassOtp) {
          const otpCheck = document.querySelector('input[type="checkbox"]#bypass-otp, input[name="customerOtpNotReceived"]');
          if (otpCheck && !otpCheck.checked) {
            otpCheck.click();
            await new Promise(r => setTimeout(r, 100));
          }
        }

        const submitBtn = document.querySelector('button[data-cy="confirmPrc"], button[type="submit"].btn-danger');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          success++;
          await new Promise(r => setTimeout(r, PRC_CONFIG.stepDelay + 300));
        } else {
          console.warn(\`⚠️ Submit button not clickable for \${tid}\`);
          failed++;
        }

      } catch (err) {
        console.error(\`Failed to PRC \${tid}:\`, err);
        failed++;
      }
    }

    document.title = "PRC Completed ✅";
    console.log(\`%c🏁 PRC Finished! (\${success} Completed, \${failed} Failed)\`, "color:#059669;font-weight:bold;font-size:14px;");
  }

  startPrcEngine();
})();`;
  }, [parsedTids, stepDelay, prcReason, prcSubReason, otpBypass]);

  const activeScript = useMemo(() => {
    if (activeTab === 'watcher') return watcherScript;
    if (activeTab === 'runsheet') return runsheetScript;
    if (activeTab === 'scanner') return scannerScript;
    return prcScript;
  }, [activeTab, watcherScript, runsheetScript, scannerScript, prcScript]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-black text-indigo-400 tracking-tight flex items-center gap-2">
              <span>⚡ KOT-ScanDeck Engine Architect</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">
                Chromebook Bypass
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Zero-install scripts. Run live alarms during manual barcode scanning, or execute turbo runsheets and return automations directly via F12.
            </p>
          </div>

          {/* Module Selector */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 shadow-inner overflow-x-auto">
            <button
              onClick={() => setActiveTab('watcher')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'watcher' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🎧 Live Scan Alarms (No TIDs)
            </button>
            <button
              onClick={() => setActiveTab('runsheet')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'runsheet' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Turbo Runsheet
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'scanner' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Scanner + Alarms
            </button>
            <button
              onClick={() => setActiveTab('prc')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'prc' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔄 PRC Return
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Config Panel */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Show TIDs textarea ONLY for tabs that consume queues */}
            {activeTab !== 'watcher' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Target Tracking IDs (TIDs)
                  </label>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                    {parsedTids.length} Ready
                  </span>
                </div>
                <textarea
                  value={rawTids}
                  onChange={(e) => setRawTids(e.target.value)}
                  placeholder="Paste shipment manifests or tracking numbers here...&#10;FMPR123456789&#10;FMPR987654321"
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-y"
                />

                {/* 3-Column Quick Filters: Regex, Exclusion, Deduplication */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[10.5px]">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isolateTracking}
                      onChange={(e) => setIsolateTracking(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Isolate Regex</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={enableExclusions}
                      onChange={(e) => setEnableExclusions(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Keywords Block</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={filterDuplicates}
                      onChange={(e) => setFilterDuplicates(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Filter Dupes</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 1: LIVE MANUAL SCAN WATCHER CONFIG (NO TIDs) */}
            {activeTab === 'watcher' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Reconciliation Live Alarms (Manual Scan)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    No tracking IDs needed. Paste this script into the console on the Shipment Reconciliation page and scan items manually.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-emerald-300 block">📅 Today CPD Alarm</span>
                      <span className="text-[10px] text-slate-500">Dual harmonic chime when scanned shipment CPD equals today's date</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableWatcherCpd}
                      onChange={(e) => setEnableWatcherCpd(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-amber-300 block">🔊 RTO Siren Alarm</span>
                      <span className="text-[10px] text-slate-500">Sawtooth siren beeps when scanned shipment IS RTO is YES</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableWatcherRto}
                      onChange={(e) => setEnableWatcherRto(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold">Alarm Cooldown Debounce:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="100"
                      step="50"
                      value={debounceMs}
                      onChange={(e) => setDebounceMs(Number(e.target.value))}
                      className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center font-bold text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-500">ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: RUNSHEET CONFIG */}
            {activeTab === 'runsheet' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                  Turbo-Runsheet Parameters
                </h3>
                
                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">Wishmaster Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Vehicle Type</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Bike">Bike</option>
                      <option value="Van">Van</option>
                      <option value="Auto">Auto</option>
                      <option value="Electric Scooter (EV)">EV</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Save Mode</label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="DRAFT">Save (Draft)</option>
                      <option value="CONFIRM">Save & Confirm</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={scheduleEnabled}
                        onChange={(e) => setScheduleEnabled(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                      />
                      <span>⏰ Scheduled Start</span>
                    </label>
                  </div>
                  {scheduleEnabled && (
                    <input
                      type="text"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      placeholder="e.g. 09:30 AM"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SCANNER BULK INJECTOR WITH PRC AUTOMATION TOGGLE */}
            {activeTab === 'scanner' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2">
                  Bulk Scanner Settings & Mode
                </h3>

                {/* PRC AUTOMATION MODE TOGGLE CARD */}
                <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-300 block">⚙️ PRC AUTOMATION Mode</span>
                      <span className="text-[10px] text-purple-400/80">
                        {enablePrcAutomation 
                          ? 'Active: Emulates hardware wedge keystrokes (Escape + 8ms intervals) for ERP dashboards.' 
                          : 'Inactive: Uses normal extreme-speed injection via native prototype setter.'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-2">
                      <input
                        type="checkbox"
                        checked={enablePrcAutomation}
                        onChange={(e) => setEnablePrcAutomation(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-xs font-semibold text-emerald-300">📅 Today CPD Alarm</span>
                    <input
                      type="checkbox"
                      checked={enableCpdAlarm}
                      onChange={(e) => setEnableCpdAlarm(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-xs font-semibold text-amber-300">🔊 RTO Alarm</span>
                    <input
                      type="checkbox"
                      checked={enableRtoAlarm}
                      onChange={(e) => setEnableRtoAlarm(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: PRC CANCELLATION CONFIG */}
            {activeTab === 'prc' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 border-b border-slate-800 pb-2">
                  PRC / Cancellation Configuration
                </h3>

                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">Primary Reason</label>
                  <select
                    value={prcReason}
                    onChange={(e) => setPrcReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Customer Not Available">Customer Not Available</option>
                    <option value="Customer Refused">Customer Refused</option>
                    <option value="Address Incomplete / Incorrect">Address Incomplete / Incorrect</option>
                    <option value="Delivery Rescheduled">Delivery Rescheduled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">Sub Reason</label>
                  <select
                    value={prcSubReason}
                    onChange={(e) => setPrcSubReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Call Not Answered">Call Not Answered</option>
                    <option value="Phone Switched Off">Phone Switched Off</option>
                    <option value="Customer Requested Future Delivery">Customer Requested Future Delivery</option>
                    <option value="Out of Station">Out of Station</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={otpBypass}
                      onChange={(e) => setOtpBypass(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-red-600 focus:ring-0"
                    />
                    <span>Auto-check "OTP Not Received" bypass</span>
                  </label>
                </div>
              </div>
            )}

            {/* Delay Settings (For runner queues) */}
            {activeTab !== 'watcher' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">Throttle Step Delay:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stepDelay}
                    onChange={(e) => setStepDelay(Number(e.target.value))}
                    className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center font-bold text-white focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">ms</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Code Generator Output */}
          <div className="lg:col-span-7 flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ready_to_run_{activeTab}.js
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1 text-white rounded text-xs font-bold transition-all shadow ${
                  activeTab === 'watcher' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {copied ? '✅ Copied to Clipboard!' : '📋 Copy Script'}
              </button>
            </div>

            <div className="relative flex-1 p-3 overflow-hidden bg-slate-950/70">
              <textarea
                readOnly
                value={activeScript}
                className="w-full h-full min-h-[460px] bg-transparent border-none font-mono text-[11px] leading-relaxed text-indigo-200 select-all p-2 focus:outline-none resize-none rounded"
              />
            </div>

            <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500 font-mono">
              <span>Open ERP → Press <kbd className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">F12</kbd> → Paste into Console</span>
              <span>
                Type <code className="text-red-400">{activeTab === 'watcher' ? 'stopAlarmWatcher()' : activeTab === 'runsheet' ? 'stopRunsheet()' : activeTab === 'scanner' ? 'stopScanner()' : 'abortPrc()'}</code> to halt
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}