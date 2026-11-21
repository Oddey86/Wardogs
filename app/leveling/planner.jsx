'use client';

import { useEffect, useMemo, useState } from 'react';
import { actions, anchors, roles, sources, threshold, unlocks } from './data';

const fmt = (value) => Math.round(value).toLocaleString('en-US');
const initialLevels = Object.fromEntries(roles.map((role) => [role, { level: 0, xp: 0 }]));
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value) || 0));

export default function Planner() {
  const [levels, setLevels] = useState(initialLevels);
  const [role, setRole] = useState('Assault');
  const [goal, setGoal] = useState(20);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(240);
  const [mix, setMix] = useState(() => Object.fromEntries(actions.map((item) => [item.id, { xp: item.xp, count: item.role === 'Assault' ? 10 : 0 }])));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wb-leveling-s3') || 'null');
      if (saved?.levels) {
        const clean = Object.fromEntries(roles.map((key) => [key, {
          level: clamp(saved.levels[key]?.level, 0, 100),
          xp: clamp(saved.levels[key]?.xp, 0, 6600000),
        }]));
        setLevels(clean);
      }
      if (saved?.mix) setMix((old) => Object.fromEntries(actions.map((action) => [action.id, {
        xp: clamp(saved.mix[action.id]?.xp ?? old[action.id].xp, 0, 1000000),
        count: clamp(saved.mix[action.id]?.count ?? old[action.id].count, 0, 10000),
      }])));
    } catch { /* corrupted local data: start fresh */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem('wb-leveling-s3', JSON.stringify({ levels, mix }));
  }, [levels, mix, loaded]);

  const wardog = roles.reduce((sum, key) => sum + levels[key].level, 0);
  const current = levels[role];
  const target = threshold(goal);
  const remaining = Math.max(0, target.xp - current.xp);
  const perSession = actions.filter((action) => action.role === role).reduce((sum, action) => sum + mix[action.id].xp * mix[action.id].count, 0);
  const rate = hours > 0 ? perSession / hours : 0;
  const time = rate > 0 ? remaining / rate : null;
  const sessions = perSession > 0 ? Math.ceil(remaining / perSession) : null;
  const displayed = useMemo(() => unlocks.filter((item) =>
    (filter === 'All' || item.role === filter) && `${item.name} ${item.role} ${item.type}`.toLowerCase().includes(query.toLowerCase()),
  ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)), [filter, query]);

  function updateLevel(key, field, value) {
    setLevels((old) => ({ ...old, [key]: { ...old[key], [field]: clamp(value, 0, field === 'level' ? 100 : 6600000) } }));
  }
  function setUnlock(item) {
    setSelected(item);
    if (item.role !== 'Wardog') { setRole(item.role); setGoal(item.level); }
  }
  const selectedWardogNeed = selected?.role === 'Wardog' ? Math.max(0, selected.level - wardog) : null;

  return <main className="page leveling"><div className="leveling-shell">
    <div className="level-hero">
      <div><p className="eyebrow">WARDOGSBUDDY / OPERATIONS INTEL</p><h1 className="page-title">Season 03 <span>Leveling Planner</span></h1>
        <p className="page-lead">Your next unlock, mapped out. Track six roles, calculate the XP gap, and model your own route to the target.</p>
        <div className="level-flags"><span>SEASON 3</span><span>6 ROLE TRACKS</span><span>LOCAL SAVE</span></div>
      </div>
      <div className="level-hero-stat"><small>CURRENT WARDOG LEVEL</small><strong>{fmt(wardog)}</strong><span>Sum of your six role levels</span></div>
    </div>

    <div className="level-notice"><strong>Data confidence</strong> Exact XP is available only for the highlighted official/reviewed milestone levels ({anchors.map(([n]) => n).join(', ')}). Values between them are <em>linear estimates</em>, not real game thresholds. Unlocks below are a curated, partial set of reported Season 3 routes. Activity XP is entirely user-editable planning input, not verified payouts.</div>

    <section className="level-section" aria-labelledby="roles-heading"><div className="level-section-heading"><div><p className="eyebrow">01 / YOUR LOADOUT</p><h2 id="roles-heading">Class progression</h2></div><span className="level-muted">Enter the cumulative XP shown in-game</span></div>
      <div className="level-role-grid">{roles.map((key) => {
        const item = levels[key]; const next = threshold(Math.min(100, item.level + 1));
        const base = threshold(item.level); const fraction = next.xp > base.xp ? clamp((item.xp - base.xp) / (next.xp - base.xp), 0, 1) : 1;
        return <div className={`level-role ${role === key ? 'active' : ''}`} key={key}>
          <button className="level-role-head" onClick={() => { setRole(key); setGoal(Math.min(100, Math.max(item.level + 1, goal))); }} aria-pressed={role === key}><span>{key}</span><strong>LV {item.level}</strong></button>
          <div className="level-bar"><span style={{ width: `${fraction * 100}%` }} /></div>
          <div className="level-fields"><label>Level<input aria-label={`${key} level`} type="number" min="0" max="100" value={item.level} onChange={(e) => updateLevel(key, 'level', e.target.value)} /></label><label>Total XP<input aria-label={`${key} total XP`} type="number" min="0" max="6600000" value={item.xp} onChange={(e) => updateLevel(key, 'xp', e.target.value)} /></label></div>
          <small>{next.exact && base.exact ? 'Verified milestone' : 'Between estimated thresholds'}</small>
        </div>;
      })}</div>
    </section>

    <div className="level-two-col">
      <section className="level-panel" aria-labelledby="goal-heading"><p className="eyebrow">02 / OBJECTIVE</p><h2 id="goal-heading">XP to target</h2>
        <div className="level-form-row"><label>Role<select value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((key) => <option key={key}>{key}</option>)}</select></label><label>Target level<input type="number" min="0" max="100" value={goal} onChange={(e) => setGoal(clamp(e.target.value, 0, 100))} /></label></div>
        <div className="level-metrics"><div><small>XP remaining</small><strong>{fmt(remaining)}</strong></div><div><small>Target total XP</small><strong>{fmt(target.xp)}</strong></div></div>
        <p className={`level-status ${target.exact ? 'verified' : ''}`}>{target.exact ? '✓ Verified Season 3 threshold' : '◇ Estimated target XP · interpolated between verified milestones'}</p>
        <p className="level-muted">If your actual XP already exceeds the target, the remaining amount is zero. Use the in-game level as the authority for current progress.</p>
      </section>
      <section className="level-panel" aria-labelledby="mix-heading"><p className="eyebrow">03 / OPERATIONS MODEL</p><h2 id="mix-heading">Action mix & time</h2>
        <p className="level-muted">Set your own XP per action and actions per session. Only the selected role counts toward its target.</p>
        <div className="level-actions">{actions.map((action) => <div className={`level-action ${action.role === role ? 'chosen' : ''}`} key={action.id}><span>{action.name}<small>{action.role}</small></span><label>XP / action<input type="number" min="0" value={mix[action.id].xp} onChange={(e) => setMix((old) => ({ ...old, [action.id]: { ...old[action.id], xp: clamp(e.target.value, 0, 1000000) } }))} /></label><label>Count<input type="number" min="0" value={mix[action.id].count} onChange={(e) => setMix((old) => ({ ...old, [action.id]: { ...old[action.id], count: clamp(e.target.value, 0, 10000) } }))} /></label></div>)}</div>
        <div className="level-form-row"><label>Hours / session<input type="number" min="0.1" step="0.5" value={hours} onChange={(e) => setHours(clamp(e.target.value, 0, 100))} /></label><label>Minutes played / week<input type="number" min="0" step="10" value={minutes} onChange={(e) => setMinutes(clamp(e.target.value, 0, 100000))} /></label></div>
        <div className="level-metrics three"><div><small>XP / session</small><strong>{fmt(perSession)}</strong></div><div><small>Sessions needed</small><strong>{sessions ?? '—'}</strong></div><div><small>Playtime</small><strong>{time === null ? '—' : `${time.toFixed(1)}h`}</strong></div></div>
        <p className="level-muted">{time !== null && minutes > 0 ? `At ${fmt(minutes)} minutes per week: approximately ${(time * 60 / minutes).toFixed(1)} weeks.` : 'Add activity counts and playtime to estimate your schedule.'} These are scenarios, not guaranteed rewards.</p>
      </section>
    </div>

    <section className="level-section" aria-labelledby="unlock-heading"><div className="level-section-heading"><div><p className="eyebrow">04 / ARMORY INTEL</p><h2 id="unlock-heading">Search unlock routes</h2></div><span className="level-muted">{displayed.length} curated unlock requirements · not a complete catalog</span></div>
      <div className="level-search"><label>Search equipment, vehicles and weapons<input type="search" placeholder="e.g. AMR, armor, parachute…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><label>Track<select value={filter} onChange={(e) => setFilter(e.target.value)}>{['All', ...roles, 'Wardog'].map((key) => <option key={key}>{key}</option>)}</select></label></div>
      <div className="level-unlocks">{displayed.map((item) => { const obtained = item.level <= (item.role === 'Wardog' ? wardog : levels[item.role].level); return <button key={item.id} className={`level-unlock ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => setUnlock(item)}><span><strong>{item.name}</strong><small>{item.type} · {item.role}</small></span><span className="level-unlock-right"><b>LV {item.level}</b><small>{obtained ? 'Level reached' : 'Locked'}</small></span></button>; })}</div>
      {displayed.length === 0 && <p className="level-muted">No matching entries in the verified subset. Try a broader search.</p>}
      {selected && <div className="level-selected"><div><small>SELECTED OBJECTIVE</small><strong>{selected.name}</strong><span>{selected.role} level {selected.level} · One reported Season 3 route; alternative routes may exist.</span></div><div>{selected.role === 'Wardog' ? <strong>{selectedWardogNeed} Wardog levels to go</strong> : <strong>{fmt(Math.max(0, threshold(selected.level).xp - levels[selected.role].xp))} XP to go {threshold(selected.level).exact ? '· verified threshold' : '· estimated threshold'}</strong>}</div></div>}
    </section>
    <section className="level-sources"><h2>Sources & limitations</h2><p>Season 03 changed progression, introduced shared unlock routes and adjusted several unlock requirements. This tool does not import proprietary game assets, third-party lists or an unpublished API. Validate purchases and unlock paths in-game.</p><a href={sources.official} target="_blank" rel="noopener noreferrer">Official Season 03 patch notes ↗</a><a href={sources.review} target="_blank" rel="noopener noreferrer">Independent Season 3 data review ↗</a><p className="level-muted">Reviewed November 21, 2026 · Local progress stays on your device. No live player API connection.</p></section>
  </div></main>;
}
