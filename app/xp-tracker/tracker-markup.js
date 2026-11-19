export const trackerMarkup = `
<main class="app">
    <header>
      <div>
        <p class="eyebrow">Round by round</p>
        <h1>XP Tracker</h1>
        <p>Extract class stats from screenshots, verify the numbers, and keep your progress locally in your browser.</p>
      </div>
      <div class="session-pill">
        <label for="sessionName">Active session</label>
        <input id="sessionName" maxlength="50" value="Today's session" aria-label="Active session name">
      </div>
    </header>

    <section class="summary" aria-label="Summary">
      <article class="metric"><span id="currentRoundLabel">Round 1 · live</span><strong id="currentGain">0 XP</strong></article>
      <article class="metric"><span>Since last reading</span><strong id="readingGain">0 XP</strong></article>
      <article class="metric"><span>This session</span><strong id="sessionGain">0 XP</strong></article>
      <article class="metric"><span>Completed rounds</span><strong id="roundCount">0</strong></article>
    </section>

    <section class="workspace">
      <article class="panel">
        <div class="panel-head">
          <div><h2>1. Upload screenshot</h2><small>Paste, drag and drop, or choose an image</small></div>
        </div>
        <div class="panel-body">
          <input id="fileInput" type="file" accept="image/*" hidden>
          <div id="dropzone" class="dropzone" role="button" tabindex="0" aria-label="Choose screenshot">
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>
            <div><strong>Drop your screenshot here</strong><span>or click to select · Ctrl+V also works</span></div>
          </div>

          <details class="example-shot"><summary>View example screenshot</summary><img src="/example-xp.svg" alt="Example of a WARDOG class XP panel with six classes and their current XP values" loading="lazy"><p>Capture this class XP panel in-game. Upload your own screenshot to read your stats.</p></details>

          <div id="previewWrap" class="preview-wrap">
            <div class="canvas-shell"><canvas id="previewCanvas"></canvas></div>
            <p class="preview-help">Draw a box around the XP panel if your screenshot contains more than the stats. Use the full image if it is already cropped.</p>
            <div class="toolbar">
              <button id="readButton" class="btn primary" type="button">Read XP</button>
              <button id="resetCropButton" class="btn" type="button">Use full image</button>
              <button id="changeImageButton" class="btn ghost" type="button">Change image</button>
            </div>
            <div id="progress" class="progress" aria-live="polite">
              <div class="progress-line"><i id="progressBar"></i></div>
              <p id="progressText">Preparing text recognition…</p>
            </div>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div><h2>2. Review and save</h2><small id="roundStatus">Round 1 is waiting for a baseline</small></div>
        </div>
        <div class="panel-body">
          <div id="classFields" class="classes"></div>
          <div class="save-row">
            <button id="saveButton" class="btn primary" type="button">Save reading</button>
            <button id="finishRoundButton" class="btn round" type="button">Next round</button>
          </div>
          <p id="notice" class="notice" aria-live="polite">Your first reading sets the baseline. You can save multiple readings before selecting Next round.</p>
        </div>
      </article>
    </section>

    <section class="panel history-panel">
      <div class="panel-head">
        <div><h2>History</h2><small id="historySubtitle">No readings saved yet</small></div>
        <div class="history-tools">
          <button id="newSessionButton" class="btn" type="button">New session</button>
          <button id="exportButton" class="btn" type="button">Export CSV</button>
          <button id="backupButton" class="btn" type="button">Backup</button>
          <label class="btn" for="importInput">Import</label>
          <input id="importInput" type="file" accept="application/json,.json" hidden>
          <button id="clearButton" class="btn danger" type="button">Delete all</button>
        </div>
      </div>
      <div id="historyContent" class="history-scroll"></div>
    </section>
  </main>

  <dialog id="confirmDialog">
    <div class="dialog-body"><h3 id="dialogTitle">Are you sure?</h3><p id="dialogText"></p></div>
    <div class="dialog-actions"><button id="dialogCancel" class="btn" type="button">Cancel</button><button id="dialogConfirm" class="btn danger" type="button">Bekreft</button></div>
  </dialog>

  <dialog id="editDialog" class="edit-dialog">
    <div class="dialog-body">
      <h3>Edit reading</h3>
      <p id="editDescription">Correct any incorrectly recognized values. Later readings and round totals are recalculated automatically.</p>
      <div id="editFields" class="classes" style="margin-top:18px"></div>
      <p id="editNotice" class="notice" aria-live="polite"></p>
    </div>
    <div class="dialog-actions"><button id="editCancel" class="btn" type="button">Cancel</button><button id="editSave" class="btn primary" type="button">Save changes</button></div>
  </dialog>
`;
