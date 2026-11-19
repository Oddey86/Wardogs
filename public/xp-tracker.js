    (() => {
      'use strict';

      const ROLES = [
        { id: 'assault', name: 'Assault', x: .419, row: 0 },
        { id: 'medic', name: 'Medic', x: .662, row: 0 },
        { id: 'support', name: 'Support', x: .904, row: 0 },
        { id: 'recon', name: 'Recon', x: .419, row: 1 },
        { id: 'driver', name: 'Driver', x: .662, row: 1 },
        { id: 'pilot', name: 'Pilot', x: .904, row: 1 }
      ];
      const STORAGE_KEY = 'battlefield-xp-tracker-v1';
      const nf = new Intl.NumberFormat('en-US');
      const df = new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' });

      const $ = (selector) => document.querySelector(selector);
      const els = {
        file: $('#fileInput'), dropzone: $('#dropzone'), previewWrap: $('#previewWrap'), canvas: $('#previewCanvas'),
        read: $('#readButton'), resetCrop: $('#resetCropButton'), changeImage: $('#changeImageButton'),
        progress: $('#progress'), progressBar: $('#progressBar'), progressText: $('#progressText'), fields: $('#classFields'),
        save: $('#saveButton'), finishRound: $('#finishRoundButton'), newSession: $('#newSessionButton'), notice: $('#notice'), sessionName: $('#sessionName'),
        currentGain: $('#currentGain'), currentRoundLabel: $('#currentRoundLabel'), roundStatus: $('#roundStatus'),
        readingGain: $('#readingGain'), sessionGain: $('#sessionGain'), roundCount: $('#roundCount'),
        history: $('#historyContent'), historySubtitle: $('#historySubtitle'), export: $('#exportButton'), backup: $('#backupButton'),
        import: $('#importInput'), clear: $('#clearButton'), dialog: $('#confirmDialog'), dialogTitle: $('#dialogTitle'),
        dialogText: $('#dialogText'), dialogCancel: $('#dialogCancel'), dialogConfirm: $('#dialogConfirm'),
        editDialog: $('#editDialog'), editFields: $('#editFields'), editDescription: $('#editDescription'), editNotice: $('#editNotice'),
        editCancel: $('#editCancel'), editSave: $('#editSave')
      };

      let state = loadState();
      let image = null;
      let crop = null;
      let drawing = false;
      let drawStart = null;
      let confirmAction = null;
      let editingSnapshotId = null;

      function emptyValues() {
        return Object.fromEntries(ROLES.map(role => [role.id, { level: '', current: '' }]));
      }

      function defaultState() {
        const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
        return { version: 2, activeSessionId: id, sessions: [{ id, name: "Today's session", createdAt: new Date().toISOString(), completedRounds: 0, roundBaselineId: null }], snapshots: [] };
      }

      function loadState() {
        try {
          const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (parsed && Array.isArray(parsed.sessions) && Array.isArray(parsed.snapshots)) return normalizeState(parsed);
        } catch (_) {}
        return defaultState();
      }

      function normalizeState(parsed) {
        parsed.version = 2;
        parsed.sessions.forEach(session => {
          if (session.name === 'Kveldens økt') session.name = "Today's session";
          const snapshots = parsed.snapshots.filter(snapshot => snapshot.sessionId === session.id);
          if (snapshots.length && snapshots.some(snapshot => !snapshot.kind)) {
            snapshots.forEach((snapshot, index) => {
              snapshot.kind = index === 0 ? 'baseline' : 'round';
              snapshot.finalized = true;
              snapshot.roundNumber = index;
            });
            session.completedRounds = Math.max(0, snapshots.length - 1);
            session.roundBaselineId = snapshots.at(-1).id;
          } else {
            session.completedRounds = Number.isInteger(session.completedRounds) ? session.completedRounds : snapshots.filter(snapshot => snapshot.kind === 'round').length;
            if (!session.roundBaselineId) session.roundBaselineId = [...snapshots].reverse().find(snapshot => snapshot.kind === 'round' || snapshot.kind === 'baseline')?.id || null;
          }
          snapshots.forEach(snapshot => {
            if (snapshot.stepTotal == null) snapshot.stepTotal = snapshot.kind === 'baseline' ? 0 : Number(snapshot.totalGain) || 0;
            if (!snapshot.stepGains) snapshot.stepGains = snapshot.gains || Object.fromEntries(ROLES.map(role => [role.id, null]));
          });
        });
        if (!parsed.sessions.some(session => session.id === parsed.activeSessionId)) parsed.activeSessionId = parsed.sessions.at(-1)?.id;
        return parsed;
      }

      function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }

      function renderFields(values = emptyValues()) {
        els.fields.innerHTML = ROLES.map(role => {
          const v = values[role.id] || {};
          return `<section class="class-card">
            <div class="class-title"><strong>${role.name}</strong><span id="gain-${role.id}">—</span></div>
            <div class="fields">
              <div class="field"><label for="level-${role.id}">Level</label><input id="level-${role.id}" inputmode="numeric" value="${safeValue(v.level)}" placeholder="0"></div>
              <div class="field"><label for="current-${role.id}">Current XP</label><input id="current-${role.id}" inputmode="numeric" value="${safeValue(v.current)}" placeholder="0"></div>
            </div>
          </section>`;
        }).join('');
        els.fields.querySelectorAll('input').forEach(input => input.addEventListener('input', updatePreviewGains));
        updatePreviewGains();
      }

      function safeValue(value) {
        return String(value ?? '').replace(/[^0-9]/g, '');
      }

      function getFormValues() {
        return Object.fromEntries(ROLES.map(role => [role.id, {
          level: numberOrNull($(`#level-${role.id}`).value),
          current: numberOrNull($(`#current-${role.id}`).value)
        }]));
      }

      function numberOrNull(value) {
        const clean = String(value ?? '').replace(/\D/g, '');
        return clean === '' ? null : Number(clean);
      }

      function currentSession() { return state.sessions.find(s => s.id === state.activeSessionId) || state.sessions.at(-1); }
      function sessionSnapshots() { return state.snapshots.filter(s => s.sessionId === state.activeSessionId); }
      function roundBaseline() {
        const session = currentSession();
        return state.snapshots.find(snapshot => snapshot.id === session?.roundBaselineId) || sessionSnapshots().find(snapshot => snapshot.kind === 'baseline') || null;
      }
      function currentRoundReading() {
        const session = currentSession();
        return [...sessionSnapshots()].reverse().find(snapshot => snapshot.kind === 'reading' && snapshot.roundNumber === (session?.completedRounds || 0) + 1) || null;
      }

      function calculateDelta(previous, next) {
        if (!previous || previous.current == null || next.current == null) return { value: null, warning: '' };
        if (next.current >= previous.current) return { value: next.current - previous.current, warning: '' };
        return { value: null, warning: 'Current XP cannot decrease; check the reading.' };
      }

      function snapshotDeltas(snapshot, previous) {
        return Object.fromEntries(ROLES.map(role => [role.id, calculateDelta(previous?.values?.[role.id], snapshot.values[role.id])]));
      }

      function updatePreviewGains() {
        const previous = roundBaseline();
        const values = getFormValues();
        ROLES.forEach(role => {
          const delta = calculateDelta(previous?.values?.[role.id], values[role.id]);
          const el = $(`#gain-${role.id}`);
          if (!previous) el.textContent = 'Baseline';
          else if (delta.value == null) el.textContent = 'Review';
          else el.textContent = `+${nf.format(delta.value)} XP`;
        });
      }

      function saveSnapshot() {
        const values = getFormValues();
        const filled = ROLES.filter(role => values[role.id].current != null);
        if (!filled.length) return setNotice('Enter at least one Current XP value before saving.', 'error');

        const session = currentSession();
        const previous = roundBaseline();
        const previousReading = currentRoundReading() || previous;
        const candidate = {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          sessionId: state.activeSessionId,
          createdAt: new Date().toISOString(),
          values,
          kind: previous ? 'reading' : 'baseline',
          finalized: !previous,
          roundNumber: previous ? session.completedRounds + 1 : 0
        };
        const deltas = snapshotDeltas(candidate, previous);
        const stepDeltas = snapshotDeltas(candidate, previousReading);
        const warnings = [...Object.values(deltas), ...Object.values(stepDeltas)].filter(d => d.warning).map(d => d.warning);
        if (warnings.length) return setNotice('Current XP cannot be lower than the previous reading. Verify the values before saving.', 'error');
        candidate.gains = Object.fromEntries(ROLES.map(role => [role.id, deltas[role.id].value]));
        candidate.stepGains = Object.fromEntries(ROLES.map(role => [role.id, stepDeltas[role.id].value]));
        candidate.totalGain = previous ? Object.values(candidate.gains).reduce((sum, value) => sum + (value || 0), 0) : 0;
        candidate.stepTotal = previous ? Object.values(candidate.stepGains).reduce((sum, value) => sum + (value || 0), 0) : 0;
        state.snapshots.push(candidate);
        if (!previous) session.roundBaselineId = candidate.id;
        persist();
        renderAll();
        setNotice(previous ? `Since last reading: +${nf.format(candidate.stepTotal)} XP. Round ${candidate.roundNumber} total: +${nf.format(candidate.totalGain)} XP. Select Next round when finished.` : 'Baseline saved. Round 1 is now in progress.', 'good');
      }

      function finishRound() {
        const session = currentSession();
        const baseline = roundBaseline();
        if (!baseline) return setNotice('Save a baseline reading before starting your first round.', 'error');
        const reading = currentRoundReading();
        if (!reading) return setNotice(`Save at least one reading in round ${session.completedRounds + 1} before continuing.`, 'error');
        reading.kind = 'round';
        reading.finalized = true;
        session.completedRounds = reading.roundNumber;
        session.roundBaselineId = reading.id;
        persist();
        renderFields(reading.values);
        renderAll();
        setNotice(`Round ${reading.roundNumber} finished with +${nf.format(reading.totalGain)} XP. Round ${reading.roundNumber + 1} starts at 0 XP.`, 'good');
      }

      function renderAll() {
        const session = currentSession();
        if (session) els.sessionName.value = session.name;
        renderSummary();
        renderHistory();
        updatePreviewGains();
      }

      function renderSummary() {
        const session = currentSession();
        const finished = sessionSnapshots().filter(snapshot => snapshot.kind === 'round');
        const current = currentRoundReading();
        const completedTotal = finished.reduce((sum, snapshot) => sum + (Number(snapshot.totalGain) || 0), 0);
        const currentTotal = Number(current?.totalGain) || 0;
        const roundNumber = (session?.completedRounds || 0) + 1;
        els.currentRoundLabel.textContent = `Round ${roundNumber} · live`;
        els.currentGain.textContent = `${nf.format(currentTotal)} XP`;
        els.readingGain.textContent = `${nf.format(Number(current?.stepTotal) || 0)} XP`;
        els.sessionGain.textContent = `${nf.format(completedTotal + currentTotal)} XP`;
        els.roundCount.textContent = nf.format(finished.length);
        if (!roundBaseline()) els.roundStatus.textContent = `Round ${roundNumber} is waiting for a baseline`;
        else if (current) els.roundStatus.textContent = `Round ${roundNumber} in progress · ${nf.format(currentTotal)} XP since baseline`;
        else els.roundStatus.textContent = `Round ${roundNumber} in progress · ready for the next reading`;
      }

      function renderHistory() {
        const snapshots = [...state.snapshots].reverse();
        els.historySubtitle.textContent = snapshots.length ? `${snapshots.length} reading${snapshots.length === 1 ? '' : 's'} total · active: ${currentSession()?.name || 'unnamed'}` : 'No readings saved yet';
        if (!snapshots.length) {
          els.history.innerHTML = '<div class="empty">Your first saved reading creates the baseline.</div>';
          return;
        }
        els.history.innerHTML = `<table><thead><tr><th>Timestamp</th><th>Session</th><th>Round</th>${ROLES.map(r => `<th>${r.name}</th>`).join('')}<th>Total</th><th></th></tr></thead><tbody>${snapshots.map(snapshot => {
          const session = state.sessions.find(item => item.id === snapshot.sessionId);
          const baseline = snapshot.kind === 'baseline';
          const roundLabel = baseline ? '<span class="baseline">Start</span>' : snapshot.kind === 'round' ? `<span class="round-done">Round ${snapshot.roundNumber} · completed</span>` : `<span class="round-live">Round ${snapshot.roundNumber} · reading</span>`;
          return `<tr><td>${df.format(new Date(snapshot.createdAt))}</td><td>${session?.name || 'Unknown session'}</td><td>${roundLabel}</td>${ROLES.map(role => {
            const savedXp = snapshot.values?.[role.id]?.current;
            const gain = snapshot.gains?.[role.id];
            const detail = baseline ? 'saved baseline' : gain == null ? 'no gain calculated' : `+${nf.format(gain)} this round`;
            return `<td class="${savedXp != null ? 'saved-xp' : 'baseline'}">${savedXp == null ? '—' : nf.format(savedXp) + ' XP<small>' + detail + '</small>'}</td>`;
          }).join('')}<td class="${baseline ? 'baseline' : 'gain'}">${baseline ? '—' : '+' + nf.format(snapshot.totalGain || 0) + ' XP<small>+' + nf.format(snapshot.stepTotal || 0) + ' since last reading</small>'}</td><td><button class="btn small" type="button" data-edit-id="${snapshot.id}">Edit</button></td></tr>`;
        }).join('')}</tbody></table>`;
      }

      function openEditSnapshot(snapshotId) {
        const snapshot = state.snapshots.find(item => item.id === snapshotId);
        if (!snapshot) return;
        const session = state.sessions.find(item => item.id === snapshot.sessionId);
        editingSnapshotId = snapshot.id;
        els.editDescription.textContent = `${session?.name || 'Unknown session'} · ${df.format(new Date(snapshot.createdAt))}. The fields below show the saved values. Later readings and round totals are recalculated automatically.`;
        els.editFields.innerHTML = ROLES.map(role => {
          const value = snapshot.values?.[role.id] || {};
          return `<section class="class-card">
            <div class="class-title"><strong>${role.name}</strong></div>
            <div class="fields">
              <div class="field"><label for="edit-level-${role.id}">Level</label><input id="edit-level-${role.id}" inputmode="numeric" value="${safeValue(value.level)}" placeholder="0"></div>
              <div class="field"><label for="edit-current-${role.id}">Current XP</label><input id="edit-current-${role.id}" inputmode="numeric" value="${safeValue(value.current)}" placeholder="0"></div>
            </div>
          </section>`;
        }).join('');
        els.editNotice.textContent = '';
        els.editNotice.className = 'notice';
        els.editDialog.showModal();
      }

      function recalculateSnapshotSeries(snapshots) {
        let baseline = null;
        let previousReading = null;
        for (const snapshot of snapshots) {
          if (snapshot.kind === 'baseline') {
            snapshot.gains = Object.fromEntries(ROLES.map(role => [role.id, null]));
            snapshot.stepGains = Object.fromEntries(ROLES.map(role => [role.id, null]));
            snapshot.totalGain = 0;
            snapshot.stepTotal = 0;
            baseline = snapshot;
            previousReading = snapshot;
            continue;
          }
          if (!baseline) return { ok: false, message: 'The baseline reading is missing for this session.' };
          const deltas = snapshotDeltas(snapshot, baseline);
          const stepDeltas = snapshotDeltas(snapshot, previousReading || baseline);
          const invalidRoles = ROLES.filter(role => deltas[role.id].warning || stepDeltas[role.id].warning);
          if (invalidRoles.length) {
            return { ok: false, message: `This change causes Current XP to decrease for ${invalidRoles.map(role => role.name).join(', ')}. Check this and subsequent readings.` };
          }
          snapshot.gains = Object.fromEntries(ROLES.map(role => [role.id, deltas[role.id].value]));
          snapshot.stepGains = Object.fromEntries(ROLES.map(role => [role.id, stepDeltas[role.id].value]));
          snapshot.totalGain = Object.values(snapshot.gains).reduce((sum, value) => sum + (value || 0), 0);
          snapshot.stepTotal = Object.values(snapshot.stepGains).reduce((sum, value) => sum + (value || 0), 0);
          previousReading = snapshot;
          if (snapshot.kind === 'round') {
            baseline = snapshot;
            previousReading = snapshot;
          }
        }
        return { ok: true };
      }

      function saveEditedSnapshot() {
        const snapshot = state.snapshots.find(item => item.id === editingSnapshotId);
        if (!snapshot) return els.editDialog.close();
        const values = Object.fromEntries(ROLES.map(role => [role.id, {
          level: numberOrNull($(`#edit-level-${role.id}`).value),
          current: numberOrNull($(`#edit-current-${role.id}`).value)
        }]));
        if (!ROLES.some(role => values[role.id].current != null)) {
          els.editNotice.textContent = 'Enter at least one Current XP value.';
          els.editNotice.className = 'notice error';
          return;
        }

        const copies = state.snapshots.filter(item => item.sessionId === snapshot.sessionId).map(item => JSON.parse(JSON.stringify(item)));
        const editedCopy = copies.find(item => item.id === snapshot.id);
        editedCopy.values = values;
        const result = recalculateSnapshotSeries(copies);
        if (!result.ok) {
          els.editNotice.textContent = result.message;
          els.editNotice.className = 'notice error';
          return;
        }

        copies.forEach(copy => {
          const original = state.snapshots.find(item => item.id === copy.id);
          original.values = copy.values;
          original.gains = copy.gains;
          original.stepGains = copy.stepGains;
          original.totalGain = copy.totalGain;
          original.stepTotal = copy.stepTotal;
        });
        const session = state.sessions.find(item => item.id === snapshot.sessionId);
        session.completedRounds = copies.filter(item => item.kind === 'round').length;
        session.roundBaselineId = [...copies].reverse().find(item => item.kind === 'round' || item.kind === 'baseline')?.id || null;
        persist();
        editingSnapshotId = null;
        els.editDialog.close();
        if (snapshot.sessionId === state.activeSessionId) renderFields(sessionSnapshots().at(-1)?.values || emptyValues());
        renderAll();
        setNotice('Reading corrected; later XP gains have been recalculated.', 'good');
      }

      function newSession() {
        const hasData = sessionSnapshots().length > 0;
        const go = () => {
          const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
          state.activeSessionId = id;
          state.sessions.push({ id, name: `Session ${state.sessions.length + 1}`, createdAt: new Date().toISOString(), completedRounds: 0, roundBaselineId: null });
          persist();
          renderFields();
          renderAll();
          setNotice('New session started. Your first save sets the baseline.', 'good');
        };
        if (hasData) askConfirm('Start a new session?', 'History is preserved, but the counters and summary reset.', go, false);
        else go();
      }

      function clearAll() {
        askConfirm('Delete all history?', 'All sessions and readings in this browser will be deleted. Download a backup first if you might want to restore them.', () => {
          localStorage.removeItem(STORAGE_KEY);
          state = defaultState();
          renderFields();
          renderAll();
          setNotice('All history has been deleted.', 'good');
        }, true);
      }

      function askConfirm(title, text, action, dangerous) {
        els.dialogTitle.textContent = title;
        els.dialogText.textContent = text;
        els.dialogConfirm.textContent = dangerous ? 'Delete all' : 'Start new session';
        els.dialogConfirm.className = dangerous ? 'btn danger' : 'btn primary';
        confirmAction = action;
        els.dialog.showModal();
      }

      function setNotice(text, type = '') {
        els.notice.textContent = text;
        els.notice.className = `notice ${type}`;
      }

      function loadImageFile(file) {
        if (!file || !file.type.startsWith('image/')) return setNotice('Please select an image file.', 'error');
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          image = img;
          crop = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
          els.dropzone.style.display = 'none';
          els.previewWrap.classList.add('visible');
          drawPreview();
          setNotice('Image ready. Adjust the crop if needed, then select Read XP.', '');
        };
        img.onerror = () => { URL.revokeObjectURL(url); setNotice('Could not open the image.', 'error'); };
        img.src = url;
      }

      function drawPreview(tempCrop = crop) {
        if (!image) return;
        const maxWidth = Math.min(900, image.naturalWidth);
        const scale = maxWidth / image.naturalWidth;
        const canvas = els.canvas;
        canvas.width = maxWidth;
        canvas.height = Math.round(image.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (!tempCrop) return;
        const r = { x: tempCrop.x * scale, y: tempCrop.y * scale, w: tempCrop.w * scale, h: tempCrop.h * scale };
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(r.x, r.y, r.w, r.h);
        ctx.drawImage(image, tempCrop.x, tempCrop.y, tempCrop.w, tempCrop.h, r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#f4cc62';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(r.x + 1, r.y + 1, Math.max(0, r.w - 2), Math.max(0, r.h - 2));
        ctx.restore();
      }

      function pointerPosition(event) {
        const rect = els.canvas.getBoundingClientRect();
        return { x: Math.max(0, Math.min(els.canvas.width, (event.clientX - rect.left) * els.canvas.width / rect.width)), y: Math.max(0, Math.min(els.canvas.height, (event.clientY - rect.top) * els.canvas.height / rect.height)) };
      }

      const LABEL_PREFIX = { assault: 'ASSA', medic: 'MEDI', support: 'SUPP', recon: 'RECO', driver: 'DRIV', pilot: 'PILO' };

      function sourceRect() {
        return crop || { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
      }

      // Render black text on a white background. Only bright, low-saturation pixels count as text,
      // so yellow rings and icon backgrounds do not interfere with OCR.
      function textMaskCanvas(rect, scale) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.w * scale));
        canvas.height = Math.max(1, Math.round(rect.h * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = pixels.data;
        for (let i = 0; i < d.length; i += 4) {
          const min = Math.min(d[i], d[i + 1], d[i + 2]);
          const max = Math.max(d[i], d[i + 1], d[i + 2]);
          const value = (min > 115 && max - min < 70) ? 0 : 255;
          d[i] = d[i + 1] = d[i + 2] = value;
          d[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas;
      }

      function editDistance(a, b) {
        const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
        for (let j = 1; j <= b.length; j++) dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        return dp[a.length][b.length];
      }

      // Find class labels even when OCR misreads a letter or two.
      function findLabels(words, scale, rect) {
        const labels = {};
        for (const word of words) {
          const text = String(word.text || '').toUpperCase().replace(/[^A-Z]/g, '');
          if (text.length < 4) continue;
          const box = word.bbox || {};
          let best = null;
          for (const role of ROLES) {
            if (labels[role.id]) continue;
            const name = role.name.toUpperCase();
            const distance = text.startsWith(LABEL_PREFIX[role.id]) ? 0 : editDistance(text, name);
            const allowed = name.length >= 6 ? 2 : 1;
            if (distance <= allowed && (!best || distance < best.distance)) best = { id: role.id, distance };
          }
          if (best) labels[best.id] = { x: rect.x + (box.x0 + box.x1) / 2 / scale, y: rect.y + (box.y0 + box.y1) / 2 / scale };
        }
        return labels;
      }

      // Fallback: locate Current XP values (e.g. "55,241 /") and infer label positions.
      function anchorsFromCurrentXp(words, scale, rect) {
        const list = words.map((word, i) => {
          const raw = String(word.text || '');
          const next = String(words[i + 1]?.text || '');
          const box = word.bbox || {};
          return { raw, digits: raw.replace(/\D/g, ''), slash: raw.includes('/') || next.startsWith('/'), x: rect.x + (box.x0 + box.x1) / 2 / scale, y: rect.y + (box.y0 + box.y1) / 2 / scale, h: (box.y1 - box.y0) / scale };
        }).filter(w => w.digits.length >= 4 && w.digits.length <= 9 && w.slash && !/XP/i.test(w.raw));
        if (list.length < 2) return {};
        list.sort((a, b) => a.y - b.y);
        const rows = [];
        for (const w of list) {
          const row = rows.find(r => Math.abs(r[0].y - w.y) < Math.max(8, w.h * 2));
          row ? row.push(w) : rows.push([w]);
        }
        if (rows.length > 2) return {};
        rows.forEach(r => r.sort((a, b) => a.x - b.x));
        const full = rows.find(r => r.length === 3);
        if (!full) return {};
        const colX = full.map(w => w.x);
        const dx = (colX[2] - colX[0]) / 2;
        if (!(dx > 20)) return {};
        const anchors = {};
        rows.forEach((row, r) => {
          const rowIndex = rows.length === 2 ? r : (row[0].y - rect.y > rect.h * .6 ? 1 : 0);
          row.forEach(w => {
            const c = colX.reduce((bestIndex, x, i) => Math.abs(x - w.x) < Math.abs(colX[bestIndex] - w.x) ? i : bestIndex, 0);
            anchors[ROLES[rowIndex * 3 + c].id] = { x: w.x, y: w.y - .77 * dx };
          });
        });
        return anchors;
      }

      function average(list) {
        const valid = list.filter(value => value != null);
        return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
      }

      function buildLayout(labels) {
        const ids = ROLES.map(role => role.id);
        const colX = [0, 1, 2].map(c => average([labels[ids[c]]?.x, labels[ids[c + 3]]?.x]));
        const rowY = [0, 1].map(r => average([0, 1, 2].map(c => labels[ids[r * 3 + c]]?.y)));
        const knownCols = colX.map((x, i) => x == null ? null : i).filter(i => i != null);
        if (knownCols.length < 2 || (rowY[0] == null && rowY[1] == null)) return null;
        const first = knownCols[0], last = knownCols.at(-1);
        const dx = (colX[last] - colX[first]) / (last - first);
        if (!(dx > 20)) return null;
        for (let c = 0; c < 3; c++) if (colX[c] == null) colX[c] = colX[first] + (c - first) * dx;
        if (rowY[0] == null) rowY[0] = rowY[1] - 1.17 * dx;
        if (rowY[1] == null) rowY[1] = rowY[0] + 1.17 * dx;
        const dy = rowY[1] - rowY[0];
        if (!(dy > 20)) return null;
        return { colX, rowY, dx, dy };
      }

      // Area below the class label containing level and Current XP (above the XP cap).
      function roleRect(layout, index, bounds) {
        const cx = layout.colX[index % 3];
        const ly = layout.rowY[Math.floor(index / 3)];
        const x0 = Math.max(bounds.x, cx - .32 * layout.dx);
        const x1 = Math.min(bounds.x + bounds.w, cx + .32 * layout.dx);
        const y0 = Math.max(bounds.y, ly + .38 * layout.dy);
        const y1 = Math.min(bounds.y + bounds.h, ly + .78 * layout.dy);
        if (x1 - x0 < 5 || y1 - y0 < 5) return null;
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }

      function parseRoleText(text) {
        const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(line => /\d/.test(line));
        let currentIndex = lines.findIndex(line => line.includes('/') && line.split('/')[0].replace(/\D/g, '').length >= 2);
        if (currentIndex < 0) currentIndex = lines.findIndex(line => line.replace(/\D/g, '').length >= 4);
        const result = { level: '', current: '' };
        if (currentIndex >= 0) result.current = Number(lines[currentIndex].split('/')[0].replace(/\D/g, ''));
        const above = lines.slice(0, currentIndex < 0 ? lines.length : currentIndex);
        for (let i = above.length - 1; i >= 0; i--) {
          const digits = above[i].replace(/\D/g, '');
          if (digits.length >= 1 && digits.length <= 3) { result.level = Number(digits); break; }
        }
        return result;
      }

      function setProgress(percent, text) {
        els.progressBar.style.width = `${Math.max(2, Math.min(100, Math.round(percent)))}%`;
        if (text) els.progressText.textContent = text;
      }

      async function readXp() {
        if (!image) return;
        if (!window.Tesseract) return setNotice('The OCR library could not load. Check your internet connection or enter the values manually.', 'error');
        els.read.disabled = true;
        els.progress.classList.add('visible');
        setProgress(2, 'Preparing text recognition…');
        let worker = null;
        try {
          let stage = 'init';
          const statusText = { 'loading tesseract core': 'Loading OCR engine…', 'initializing tesseract': 'Starting OCR…', 'loading language traineddata': 'Loading language model…', 'initializing api': 'Preparing reading…' };
          worker = await Tesseract.createWorker('eng', 1, {
            logger: message => {
              if (stage !== 'init') return;
              if (typeof message.progress === 'number') setProgress(message.progress * 25, statusText[message.status] || 'Arbeider…');
            }
          });

          // Step 1: locate class labels to map the layout.
          stage = 'labels';
          setProgress(30, 'Locating classes in the image…');
          const rect = sourceRect();
          const scale = Math.min(3, Math.max(1.5, 1500 / rect.w));
          const overview = textMaskCanvas(rect, scale);
          await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
          const overviewResult = await worker.recognize(overview);
          const overviewWords = overviewResult.data.words || [];
          const labels = findLabels(overviewWords, scale, rect);
          let layout = buildLayout(labels);
          let method = `class names (${Object.keys(labels).length}/6)`;
          if (!layout || Object.keys(labels).length < 4) {
            const anchors = { ...anchorsFromCurrentXp(overviewWords, scale, rect), ...labels };
            const alt = buildLayout(anchors);
            if (alt) { layout = alt; method = `XP values and class names (${Object.keys(anchors).length}/6)`; }
          }
          if (!layout) method = 'fixed positions (layout not detected)';
          console.info('[XP Tracker] oppsett funnet via', method, layout);

          let values;
          if (!layout) {
            values = parseOcrResult(overviewResult.data, overview.width, overview.height);
          } else {
            // Step 2: recognize level and Current XP in each class region, allowing digits only.
            values = emptyValues();
            await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, tessedit_char_whitelist: '0123456789,./' });
            for (let i = 0; i < ROLES.length; i++) {
              const role = ROLES[i];
              setProgress(45 + i * 9, `Reading ${role.name}…`);
              const area = roleRect(layout, i, rect);
              if (!area) continue;
              const result = await worker.recognize(textMaskCanvas(area, 3));
              const parsed = parseRoleText(result.data.text);
              if (parsed.current === '' || parsed.level === '') {
                // Fallback: use numbers from the overview recognition within the same region.
                const inside = overviewWords.map(word => ({ text: String(word.text || ''), box: word.bbox || {} }))
                  .map(w => ({ ...w, x: rect.x + (w.box.x0 + w.box.x1) / 2 / scale, y: rect.y + (w.box.y0 + w.box.y1) / 2 / scale }))
                  .filter(w => /\d/.test(w.text) && w.x >= area.x && w.x <= area.x + area.w && w.y >= area.y && w.y <= area.y + area.h)
                  .sort((a, b) => a.y - b.y);
                const backup = parseRoleText(inside.map(w => w.text).join('\n'));
                if (parsed.current === '') parsed.current = backup.current;
                if (parsed.level === '') parsed.level = backup.level;
              }
              values[role.id] = parsed;
            }
          }
          renderFields(values);
          const found = ROLES.filter(role => values[role.id].current !== '').length;
          els.progressBar.style.width = '100%';
          els.progressText.textContent = `Done – found Current XP for ${found} of 6 classes · layout via ${method}.`;
          setNotice(found ? `Found ${found} of 6 XP values. Verify every value against the image before saving.` : 'No reliable values found. Adjust the crop or enter the numbers manually.', found === 6 ? 'good' : 'warn');
        } catch (error) {
          console.error(error);
          setNotice('Reading failed. Try a tighter crop or enter the values manually.', 'error');
          els.progressText.textContent = 'Reading failed.';
        } finally {
          if (worker) worker.terminate().catch(() => {});
          els.read.disabled = false;
        }
      }

      function parseOcrResult(data, width, height) {
        const values = emptyValues();
        const words = (data.words || []).map(word => {
          const box = word.bbox || {};
          const digits = String(word.text || '').replace(/\D/g, '');
          return { digits, x: ((box.x0 || 0) + (box.x1 || 0)) / 2 / width, y: ((box.y0 || 0) + (box.y1 || 0)) / 2 / height };
        }).filter(word => word.digits);

        const yPositions = {
          0: { level: .35, current: .402 },
          1: { level: .795, current: .855 }
        };
        ROLES.forEach(role => {
          for (const field of ['level', 'current']) {
            const desiredY = yPositions[role.row][field];
            const candidates = words.filter(word => Math.abs(word.x - role.x) < .12 && Math.abs(word.y - desiredY) < .045
              && (field === 'level' ? word.digits.length <= 3 : word.digits.length >= 3));
            candidates.sort((a, b) => (Math.abs(a.x - role.x) * .5 + Math.abs(a.y - desiredY)) - (Math.abs(b.x - role.x) * .5 + Math.abs(b.y - desiredY)));
            const candidate = candidates[0];
            if (!candidate) continue;
            const number = Number(candidate.digits);
            if (field === 'level' && number <= 999) values[role.id][field] = number;
            if (field !== 'level' && number <= 999999999) values[role.id][field] = number;
          }
        });
        return values;
      }

      function csvEscape(value) { const s = String(value ?? ''); return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

      function exportCsv() {
        const rows = [['Session', 'Timestamp', 'Round', 'Status', ...ROLES.flatMap(r => [`${r.name} level`, `${r.name} XP`, `${r.name} gain`]), 'Round gain', 'Since last reading']];
        state.sessions.forEach(session => {
          state.snapshots.filter(s => s.sessionId === session.id).forEach(snapshot => {
            const status = snapshot.kind === 'baseline' ? 'Baseline' : snapshot.kind === 'round' ? 'Completed' : 'Reading';
            rows.push([session.name, snapshot.createdAt, snapshot.roundNumber || 'Start', status, ...ROLES.flatMap(role => {
              const value = snapshot.values[role.id] || {};
              return [value.level, value.current, snapshot.gains?.[role.id]];
            }), snapshot.totalGain || 0, snapshot.stepTotal || 0]);
          });
        });
        download(`battlefield-xp-${dateStamp()}.csv`, '\ufeff' + rows.map(row => row.map(csvEscape).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
      }

      function backup() { download(`battlefield-xp-backup-${dateStamp()}.json`, JSON.stringify(state, null, 2), 'application/json'); }
      function dateStamp() { return new Date().toISOString().slice(0, 10); }
      function download(filename, content, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      async function importBackup(file) {
        try {
          const parsed = JSON.parse(await file.text());
          if (!parsed || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.snapshots)) throw new Error('Invalid format');
          state = normalizeState(parsed);
          persist();
          renderFields(sessionSnapshots().at(-1)?.values || emptyValues());
          renderAll();
          setNotice('Backup imported successfully.', 'good');
        } catch (_) { setNotice('This file is not a valid XP Tracker backup.', 'error'); }
        els.import.value = '';
      }

      els.dropzone.addEventListener('click', () => els.file.click());
      els.dropzone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') els.file.click(); });
      els.file.addEventListener('change', () => loadImageFile(els.file.files[0]));
      ['dragenter', 'dragover'].forEach(type => els.dropzone.addEventListener(type, event => { event.preventDefault(); els.dropzone.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(type => els.dropzone.addEventListener(type, event => { event.preventDefault(); els.dropzone.classList.remove('drag'); }));
      els.dropzone.addEventListener('drop', event => loadImageFile(event.dataTransfer.files[0]));
      document.addEventListener('paste', event => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
        const file = imageItem?.getAsFile() || Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith('image/'));
        if (file) {
          event.preventDefault();
          loadImageFile(file);
        } else if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
          setNotice('No image found in the clipboard. Capture a screenshot with Win + Shift + S, then press Ctrl + V.', 'warn');
        }
      });

      els.canvas.addEventListener('pointerdown', event => { drawing = true; drawStart = pointerPosition(event); els.canvas.setPointerCapture(event.pointerId); });
      els.canvas.addEventListener('pointermove', event => {
        if (!drawing) return;
        const p = pointerPosition(event);
        const displayCrop = { x: Math.min(drawStart.x, p.x), y: Math.min(drawStart.y, p.y), w: Math.abs(p.x - drawStart.x), h: Math.abs(p.y - drawStart.y) };
        const sx = image.naturalWidth / els.canvas.width, sy = image.naturalHeight / els.canvas.height;
        drawPreview({ x: displayCrop.x * sx, y: displayCrop.y * sy, w: displayCrop.w * sx, h: displayCrop.h * sy });
      });
      els.canvas.addEventListener('pointerup', event => {
        if (!drawing) return;
        drawing = false;
        const p = pointerPosition(event);
        const sx = image.naturalWidth / els.canvas.width, sy = image.naturalHeight / els.canvas.height;
        const next = { x: Math.min(drawStart.x, p.x) * sx, y: Math.min(drawStart.y, p.y) * sy, w: Math.abs(p.x - drawStart.x) * sx, h: Math.abs(p.y - drawStart.y) * sy };
        if (next.w > 80 && next.h > 60) crop = next;
        drawPreview();
      });

      els.read.addEventListener('click', readXp);
      els.resetCrop.addEventListener('click', () => { crop = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }; drawPreview(); });
      els.changeImage.addEventListener('click', () => els.file.click());
      els.save.addEventListener('click', saveSnapshot);
      els.finishRound.addEventListener('click', finishRound);
      els.newSession.addEventListener('click', newSession);
      els.export.addEventListener('click', exportCsv);
      els.backup.addEventListener('click', backup);
      els.import.addEventListener('change', () => { if (els.import.files[0]) importBackup(els.import.files[0]); });
      els.clear.addEventListener('click', clearAll);
      els.history.addEventListener('click', event => {
        const button = event.target.closest('[data-edit-id]');
        if (button) openEditSnapshot(button.dataset.editId);
      });
      els.sessionName.addEventListener('change', () => { const session = currentSession(); if (session) { session.name = els.sessionName.value.trim() || 'Unnamed'; persist(); renderHistory(); } });
      els.dialogCancel.addEventListener('click', () => { confirmAction = null; els.dialog.close(); });
      els.dialogConfirm.addEventListener('click', () => { const action = confirmAction; confirmAction = null; els.dialog.close(); if (action) action(); });
      els.editCancel.addEventListener('click', () => { editingSnapshotId = null; els.editDialog.close(); });
      els.editSave.addEventListener('click', saveEditedSnapshot);

      renderFields(sessionSnapshots().at(-1)?.values || emptyValues());
      renderAll();
    })();
