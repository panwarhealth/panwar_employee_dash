import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type Field =
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'letter-spacing'
  | 'padding-top'
  | 'padding-right'
  | 'padding-bottom'
  | 'padding-left';

interface Change {
  label: string;
  prop: string;
  from: string;
  to: string;
  undo: () => void;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

function tsRules(): CSSStyleRule[] {
  const out: CSSStyleRule[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && r.selectorText.includes('.ts')) out.push(r);
      else if (r instanceof CSSMediaRule) {
        if (matchMedia(r.conditionText).matches) walk(r.cssRules);
      } else if (r instanceof CSSGroupingRule) walk(r.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      continue;
    }
  }
  return out;
}

function matches(el: Element, selector: string) {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function ruleFor(el: Element, field: Field) {
  let found: { rule: CSSStyleRule; prop: string } | null = null;
  for (const rule of tsRules()) {
    if (!matches(el, rule.selectorText)) continue;
    if (field.startsWith('padding') && rule.style.getPropertyValue('padding'))
      found = { rule, prop: 'padding' };
    else if (rule.style.getPropertyValue(field)) found = { rule, prop: field };
  }
  return found;
}

function describe(el: Element) {
  const cls =
    typeof el.className === 'string' && el.className ? `.${el.className.split(' ').join('.')}` : '';
  return `${el.tagName.toLowerCase()}${cls}`;
}

function expand(v: string) {
  const p = v
    .trim()
    .split(/\s+/)
    .map((x) => (x === '0' ? '0px' : x));
  return [p[0], p[1] ?? p[0], p[2] ?? p[0], p[3] ?? p[1] ?? p[0]].join(' ');
}

const isNoop = (c: Change) =>
  c.prop === 'padding' ? expand(c.from) === expand(c.to) : c.from === c.to;

const num = (v: string) => (v === 'normal' ? 0 : parseFloat(v));

function directText(el: Element) {
  return Array.from(el.childNodes).find(
    (n): n is Text => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim(),
  );
}

const panel: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 99999,
  width: 360,
  maxHeight: '80vh',
  overflow: 'auto',
  background: '#fff',
  color: '#222',
  border: '1px solid #ccc',
  borderRadius: 12,
  boxShadow: '0 8px 30px rgba(0,0,0,.18)',
  font: '12px/1.4 system-ui, sans-serif',
  padding: 12,
};
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const btn: CSSProperties = {
  font: 'inherit',
  padding: '4px 10px',
  border: '1px solid #bbb',
  borderRadius: 6,
  background: '#f6f6f6',
  cursor: 'pointer',
};
const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px 10px',
  margin: '8px 0',
};
const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  color: '#666',
};
const inputStyle: CSSProperties = {
  font: 'inherit',
  color: '#222',
  padding: '3px 5px',
  border: '1px solid #bbb',
  borderRadius: 4,
  width: '100%',
};

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: string;
  step: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <label style={fieldStyle}>
      {label}
      <input
        type="number"
        step={step}
        style={inputStyle}
        value={focused ? draft : value}
        onFocus={() => {
          setDraft(value);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

function Overlay({ el }: { el: Element }) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return (
    <div
      style={{
        position: 'fixed',
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        boxSizing: 'border-box',
        borderStyle: 'solid',
        borderColor: 'rgba(147,196,125,.55)',
        borderWidth: SIDES.map((s) => cs.getPropertyValue(`padding-${s}`)).join(' '),
        background: 'rgba(111,168,220,.35)',
        backgroundClip: 'padding-box',
        outline: '1px solid rgba(111,168,220,.9)',
        pointerEvents: 'none',
        zIndex: 99998,
      }}
    />
  );
}

export function FontDebugPanel() {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<Element | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [changes, setChanges] = useState<Map<string, Change>>(new Map());
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const texts = useRef(new Map<Text, string>());
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!picking) return;
    const inPanel = (t: EventTarget | null) => !!panelRef.current?.contains(t as Node);
    const onMove = (e: MouseEvent) => setHover(inPanel(e.target) ? null : (e.target as Element));
    const onClick = (e: MouseEvent) => {
      if (inPanel(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setPicked(e.target as Element);
      setPicking(false);
      setHover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
        setHover(null);
      }
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [picking]);

  useEffect(() => {
    if (!picked) return;
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, [picked]);

  const record = (key: string, change: Change) =>
    setChanges((m) => {
      const next = new Map(m);
      const prev = m.get(key);
      next.set(key, prev ? { ...prev, to: change.to } : change);
      return next;
    });

  const apply = (el: Element, field: Field, n: number) => {
    const value = field === 'font-weight' ? String(n) : `${n}px`;
    const before = getComputedStyle(el);
    const was = before.getPropertyValue(field);
    const target = ruleFor(el, field);
    if (target) {
      const { rule, prop } = target;
      const from = rule.style.getPropertyValue(prop);
      const to =
        prop === 'padding'
          ? SIDES.map((s) =>
              `padding-${s}` === field ? value : before.getPropertyValue(`padding-${s}`),
            ).join(' ')
          : value;
      rule.style.setProperty(prop, to);
      if (Math.abs(num(getComputedStyle(el).getPropertyValue(field)) - n) < 0.01) {
        record(`${rule.selectorText}|${prop}`, {
          label: rule.selectorText,
          prop,
          from,
          to,
          undo: () => rule.style.setProperty(prop, from),
        });
        refresh();
        return;
      }
      rule.style.setProperty(prop, from);
    }
    const html = el as HTMLElement;
    const from = html.style.getPropertyValue(field);
    html.style.setProperty(field, value);
    record(`${describe(el)}|${field}|inline`, {
      label: `${describe(el)} (this element only)`,
      prop: field,
      from: from || was,
      to: value,
      undo: () => html.style.setProperty(field, from),
    });
    refresh();
  };

  const setText = (node: Text, value: string) => {
    if (!texts.current.has(node)) texts.current.set(node, node.data);
    node.data = value;
    refresh();
  };

  const reset = () => {
    [...changes.values()].reverse().forEach((c) => c.undo());
    texts.current.forEach((from, node) => (node.data = from));
    texts.current.clear();
    setChanges(new Map());
    refresh();
  };

  const styleChanges = [...changes.values()].filter((c) => !isNoop(c));
  const editCount = changes.size + texts.current.size;

  const copy = async () => {
    await navigator.clipboard.writeText(
      styleChanges.map((c) => `${c.label} { ${c.prop}: ${c.from} -> ${c.to}; }`).join('\n'),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cs = picked ? getComputedStyle(picked) : null;
  const text = picked ? directText(picked) : undefined;
  const fmt = (v: string) => String(Math.round(num(v) * 100) / 100);

  const ui = !open ? (
    <button
      style={{ ...btn, ...panel, width: 'auto', padding: '6px 12px' }}
      onClick={() => setOpen(true)}
    >
      Inspect{editCount ? ` (${editCount})` : ''}
    </button>
  ) : (
    <div ref={panelRef} style={panel}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <strong>Inspect</strong>
        <button style={btn} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div style={{ ...row, margin: '8px 0' }}>
        <button
          style={{ ...btn, ...(picking ? { background: '#702f8f', color: '#fff' } : {}) }}
          onClick={() => setPicking((p) => !p)}
        >
          {picking ? 'Click something... (Esc)' : 'Pick'}
        </button>
        {picked?.parentElement && (
          <button style={btn} onClick={() => setPicked(picked.parentElement)}>
            Parent
          </button>
        )}
      </div>

      {picked && cs && (
        <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
          <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{describe(picked)}</div>
          <div style={grid} key={describe(picked)}>
            <NumberField
              label="Font size (px)"
              step={0.5}
              value={fmt(cs.fontSize)}
              onChange={(n) => apply(picked, 'font-size', n)}
            />
            <NumberField
              label="Font weight"
              step={100}
              value={cs.fontWeight}
              onChange={(n) => apply(picked, 'font-weight', n)}
            />
            <NumberField
              label="Line spacing (px)"
              step={1}
              value={cs.lineHeight === 'normal' ? '' : fmt(cs.lineHeight)}
              onChange={(n) => apply(picked, 'line-height', n)}
            />
            <NumberField
              label="Char spacing (px)"
              step={0.1}
              value={fmt(cs.letterSpacing)}
              onChange={(n) => apply(picked, 'letter-spacing', n)}
            />
          </div>
          <div style={{ color: '#666' }}>Padding (px)</div>
          <div style={{ ...grid, gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 2 }}>
            {SIDES.map((s) => (
              <NumberField
                key={s}
                label={s[0].toUpperCase() + s.slice(1)}
                step={1}
                value={fmt(cs.getPropertyValue(`padding-${s}`))}
                onChange={(n) => apply(picked, `padding-${s}`, n)}
              />
            ))}
          </div>
          {text && (
            <label style={fieldStyle}>
              Text
              <textarea
                style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }}
                value={text.data}
                onChange={(e) => setText(text, e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      {editCount > 0 && (
        <div style={{ borderTop: '1px solid #eee', marginTop: 10, paddingTop: 8 }}>
          <div style={{ ...row, justifyContent: 'space-between' }}>
            <strong>Changes</strong>
            <div style={row}>
              <button style={btn} onClick={copy} disabled={!styleChanges.length}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button style={btn} onClick={reset}>
                Reset
              </button>
            </div>
          </div>
          {styleChanges.map((c) => (
            <div key={`${c.label}|${c.prop}|${c.from}`} style={{ color: '#555', marginTop: 4 }}>
              {`${c.label} - ${c.prop}: ${c.from} -> ${c.to}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const box = picking ? hover : picked;
  return createPortal(
    <>
      {box && <Overlay el={box} />}
      {ui}
    </>,
    document.body,
  );
}
