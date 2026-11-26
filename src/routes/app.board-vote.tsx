import { useState, type CSSProperties, type ReactNode } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJobBoardVote, saveJobBoardVote } from '@/api/jobBoardVote';

type DueKind = 'late' | 'soon' | 'ok' | 'done';

interface Look {
  id: string;
  name: string;
  tile: 'ring' | 'ringSquare' | 'inline' | 'solid';
  tileSize: number;
  progress: 'bar' | 'segments' | 'none';
  dateInTile: boolean;
  listBg: string;
  listBorder: boolean;
  listHead: 'plain' | 'pill' | 'underline' | 'underlinePill' | 'underlineGrey' | 'band' | 'plainDark';
  page: string;
  topLine: boolean;
  shadow: 'flat' | 'soft' | 'strong';
  cardBorder: boolean;
  listWidth: number;
  cardPad: number;
  avatarsTop: boolean;
  band?: boolean;
}

const BASE: Omit<Look, 'id' | 'name'> = {
  tile: 'ring',
  tileSize: 42,
  progress: 'bar',
  dateInTile: false,
  listBg: '#efe8f4',
  listBorder: false,
  listHead: 'plain',
  page: '#f7f6f9',
  topLine: false,
  shadow: 'flat',
  avatarsTop: false,
  cardBorder: false,
  listWidth: 290,
  cardPad: 11,
};

const G: Omit<Look, 'id' | 'name'> = { ...BASE, listBg: 'transparent', listHead: 'underline', page: '#f1ebf6', shadow: 'soft' };

const LOOKS: Look[] = [
  { ...BASE, id: 'D', name: 'Logo tile', tile: 'solid', tileSize: 40, progress: 'none', listBg: '#e2e0e8', listHead: 'plainDark', page: '#eeedf1', band: true },
  { ...BASE, id: '9', name: '9' },
  { ...G, id: '9g', name: '9g' },
  { ...G, id: 'g9', name: 'g9', listHead: 'underlineGrey' },
];

export const Route = createFileRoute('/app/board-vote')({
  validateSearch: (search: Record<string, unknown>): { v?: string } => ({
    v: SHORTLIST.some((x) => x.id === search.v) ? (search.v as string) : undefined,
  }),
  component: BoardMockups,
});

interface Client {
  name: string;
  logo: string;
  color: string;
  tint: string;
}

const CLIENTS: Record<string, Client> = {
  nwp: { name: 'Northwind Pharma', logo: 'NW', color: '#1f5fa8', tint: '#eef4fb' },
  acm: { name: 'Acme Health', logo: 'AH', color: '#c2410c', tint: '#fdf1e9' },
  brx: { name: 'Brightwell Labs', logo: 'BL', color: '#1f7a4d', tint: '#ecf6f0' },
  krv: { name: 'Kerrivale', logo: 'KV', color: '#7a3fa8', tint: '#f5effa' },
  hlo: { name: 'Halo Medical', logo: 'HM', color: '#0f6e78', tint: '#e9f4f5' },
  none: { name: 'No client', logo: 'PH', color: '#5f636a', tint: '#f1f1f3' },
};

const PEOPLE: Record<string, string> = {
  SK: '#702f8f',
  AL: '#b41e8c',
  JD: '#1f5fa8',
  MR: '#0f6e78',
  TB: '#c2410c',
};

const DUE: Record<DueKind, { bg: string; ink: string; word: string }> = {
  late: { bg: '#fbe4e1', ink: '#a32117', word: 'Late' },
  soon: { bg: '#fff1cc', ink: '#7a4b00', word: 'Soon' },
  ok: { bg: '#ffffff', ink: '#4f5050', word: '' },
  done: { bg: '#e1f2e8', ink: '#17663e', word: 'Done' },
};

interface JobCard {
  kind: 'card';
  client: Client;
  code: string;
  title: string;
  done: number;
  total: number;
  due?: string;
  dueKind?: DueKind;
  comments: number;
  people: string[];
  mirror?: string;
}

interface HiddenCard {
  kind: 'hidden';
  title: string;
  onBoard: string;
}

type AnyCard = JobCard | HiddenCard;

function card(
  c: string,
  code: string,
  title: string,
  done: number,
  total: number,
  due: [string, DueKind] | null,
  comments: number,
  people: string[],
  mirror?: string,
): JobCard {
  return {
    kind: 'card',
    client: CLIENTS[c],
    code,
    title,
    done,
    total,
    due: due?.[0],
    dueKind: due?.[1],
    comments,
    people,
    mirror,
  };
}

const hidden = (title: string, onBoard: string): HiddenCard => ({ kind: 'hidden', title, onBoard });

const LISTS: { name: string; cards: AnyCard[] }[] = [
  {
    name: 'To be briefed',
    cards: [
      card('nwp', 'NWP0151', 'Spring HCP eDM series', 0, 6, null, 0, []),
      card('acm', 'ACM0088', 'Pharmacy counter cards', 0, 9, null, 1, []),
      card('none', '', 'Update capability deck', 0, 3, ['5 Dec', 'ok'], 0, ['TB']),
    ],
  },
  {
    name: 'With Sam',
    cards: [
      card('nwp', 'NWP0147', 'Psoriasis detail aid V2', 4, 9, ['26 Nov', 'soon'], 6, ['SK', 'JD']),
      card('acm', 'ACM0085', 'Allergy season social posts', 6, 8, ['24 Nov', 'late'], 4, ['SK', 'AL'], 'Also with Alex'),
      card('brx', 'BRX0032', 'Pharmacist CPD module', 2, 7, ['28 Nov', 'ok'], 2, ['SK']),
      hidden('HLO0012 | Launch toolkit', 'Studio WIP'),
    ],
  },
  {
    name: 'With Alex',
    cards: [
      card('krv', 'KRV0019', 'Cardiology webinar slides', 1, 5, ['2 Dec', 'ok'], 3, ['AL']),
      card('acm', 'ACM0085', 'Allergy season social posts', 6, 8, ['24 Nov', 'late'], 4, ['SK', 'AL'], 'Also with Sam'),
      card('brx', 'BRX0029', 'Patient leaflet reprint', 3, 4, ['27 Nov', 'soon'], 1, ['AL', 'MR']),
    ],
  },
  {
    name: 'With Jordan',
    cards: [
      card('hlo', 'HLO0009', 'Rep training video edit', 5, 11, ['1 Dec', 'ok'], 9, ['JD']),
      card('nwp', 'NWP0149', 'Congress booth panels', 2, 6, ['3 Dec', 'ok'], 0, ['JD', 'TB']),
    ],
  },
  {
    name: 'With client',
    cards: [
      card('krv', 'KRV0017', 'Product monograph update', 7, 8, ['29 Nov', 'ok'], 5, ['MR']),
      card('acm', 'ACM0081', 'Store window decals', 4, 5, null, 2, []),
      card('brx', 'BRX0027', 'Website banner set', 6, 7, ['26 Nov', 'late'], 3, ['TB']),
      card('hlo', 'HLO0007', 'Sales aid approval round', 8, 9, ['30 Nov', 'ok'], 7, ['MR', 'SK']),
    ],
  },
  {
    name: 'Hold',
    cards: [card('nwp', 'NWP0140', 'Patient app onboarding', 1, 10, null, 4, [])],
  },
  {
    name: 'Delivered',
    cards: [
      card('krv', 'KRV0015', 'Annual report infographics', 12, 12, ['20 Nov', 'done'], 11, ['AL']),
      card('acm', 'ACM0079', 'Flu season radio script', 5, 5, ['18 Nov', 'done'], 2, ['TB']),
    ],
  },
];

const INK = '#2f3030';
const MUTED = '#616262';
const PURPLE = '#702f8f';
const HAIR = 'rgba(43,44,44,0.14)';


function BoardMockups() {
  const { v = 'D' } = Route.useSearch();
  const research = RESEARCH.find((x) => x.id === v);
  const modern = MODERN.find((x) => x.id === v);
  const look = LOOKS.find((x) => x.id === v) ?? LOOKS[0];

  if (research) {
    return (
      <div className="-m-4 min-h-[calc(100%+2rem)] md:-m-6 md:min-h-[calc(100%+3rem)]" style={{ background: research.page }}>
        <LookBar current={v} />
        <VotePanel current={v} />
        <ResearchBoard r={research} />
      </div>
    );
  }

  if (modern) {
    return (
      <div className="-m-4 min-h-[calc(100%+2rem)] md:-m-6 md:min-h-[calc(100%+3rem)]" style={{ background: modern.page }}>
        <LookBar current={v} />
        <VotePanel current={v} />
        <ModernBoard m={modern} />
      </div>
    );
  }

  return (
    <div
      className="-m-4 min-h-[calc(100%+2rem)] md:-m-6 md:min-h-[calc(100%+3rem)]"
      style={{ background: look.page, color: '#454646', fontSize: 14, lineHeight: 1.45 }}
    >
      <LookBar current={v} />
        <VotePanel current={v} />
      <Header band={!!look.band} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', padding: '0 28px 40px' }}>
        {LISTS.map((l) => (
          <List key={l.name} look={look} name={l.name} count={l.cards.length}>
            {l.cards.map((c, i) =>
              c.kind === 'hidden' ? <Hidden key={i} c={c} /> : <Card key={i} look={look} c={c} />,
            )}
          </List>
        ))}
      </div>
    </div>
  );
}

function LookBar({ current }: { current: string }) {
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 28px', background: '#1f1f20', color: '#ffffff', fontSize: 13 }}
    >
      <span style={{ fontWeight: 800, marginRight: 6 }}>Job board look - pick your favourite:</span>
      {SHORTLIST.map((x, i) => (
        <Link
          key={x.id}
          to="/app/board-vote"
          search={{ v: x.id }}
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            fontWeight: 700,
            textDecoration: 'none',
            background: x.id === current ? '#ffffff' : 'transparent',
            color: x.id === current ? INK : '#ffffff',
            border: '1px solid rgba(255,255,255,0.4)',
          }}
        >
          {i + 1}. {x.name}
        </Link>
      ))}
    </div>
  );
}

function Header({ band }: { band: boolean }) {
  const pill: CSSProperties = {
    height: 38,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    borderRadius: 999,
    fontWeight: 700,
    textDecoration: 'none',
    boxSizing: 'border-box',
    border: band ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${HAIR}`,
    background: 'transparent',
    color: band ? '#ffffff' : INK,
    cursor: 'pointer',
    font: 'inherit',
  };

  return (
    <div
      style={{ background: band ? PURPLE : '#ffffff', color: band ? '#ffffff' : INK, padding: '16px 28px', marginBottom: 22, borderBottom: band ? 'none' : `1px solid ${HAIR}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {!band && <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: PURPLE }}>Job board</span>}
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>Panwar Health WIP</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <input
          type="search"
          aria-label="Search cards"
          placeholder="Search cards, incl. archived"
          style={{ height: 38, width: 260, boxSizing: 'border-box', borderRadius: 999, padding: '0 16px', font: 'inherit', background: band ? 'rgba(255,255,255,0.16)' : '#f4f3f7', color: band ? '#ffffff' : INK, border: band ? 0 : `1px solid ${HAIR}` }}
        />
        <a href="#" style={{ ...pill, background: band ? '#ffffff' : PURPLE, color: band ? PURPLE : '#ffffff', border: 0 }}>
          Calendar
        </a>
        <a href="#" style={pill}>
          Activity
        </a>
        <button aria-label="Notifications, 3 unread" style={{ ...pill, position: 'relative', width: 38, padding: 0, justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
            <path d="M10 20.5a2 2 0 004 0" />
          </svg>
          <span
            style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 999, background: '#ff8c50', color: INK, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            3
          </span>
        </button>
      </div>
    </div>
  );
}

function ListHead({ look, name, count }: { look: Look; name: string; count: number }) {
  if (look.listHead === 'underlinePill' || look.listHead === 'underlineGrey') {
    const pill = look.listHead === 'underlinePill';
    return (
      <h2
        style={{ margin: 0, padding: '0 2px 8px', borderBottom: pill ? `2px solid ${PURPLE}` : `1px solid ${HAIR}`, fontSize: pill ? 12 : 14, fontWeight: 800, letterSpacing: pill ? '0.06em' : 0, textTransform: pill ? 'uppercase' : 'none', color: pill ? PURPLE : INK, display: 'flex', alignItems: 'center', justifyContent: pill ? 'flex-start' : 'space-between', gap: 8 }}
      >
        {name}
        {pill ? (
          <span style={{ minWidth: 22, height: 20, padding: '0 7px', boxSizing: 'border-box', borderRadius: 999, background: PURPLE, color: '#ffffff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {count}
          </span>
        ) : (
          <span style={{ color: MUTED, fontWeight: 600 }}>{count}</span>
        )}
      </h2>
    );
  }
  if (look.listHead === 'pill') {
    return (
      <h2 style={{ margin: 0, padding: '4px 4px 2px', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: PURPLE, display: 'flex', alignItems: 'center', gap: 8 }}>
        {name}
        <span style={{ minWidth: 22, height: 20, padding: '0 7px', boxSizing: 'border-box', borderRadius: 999, background: PURPLE, color: '#ffffff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {count}
        </span>
      </h2>
    );
  }
  if (look.listHead === 'band') {
    return (
      <h2 style={{ margin: '-10px -10px 2px', padding: '9px 14px', borderRadius: '10px 10px 0 0', fontSize: 14, fontWeight: 800, background: PURPLE, color: '#ffffff', display: 'flex', justifyContent: 'space-between' }}>
        {name}
        <span style={{ fontWeight: 600, opacity: 0.85 }}>{count}</span>
      </h2>
    );
  }
  return (
    <h2
      style={{
        margin: 0,
        padding: look.listHead === 'underline' ? '0 2px 8px' : '4px 4px 2px',
        borderBottom: look.listHead === 'underline' ? `2px solid ${PURPLE}` : 'none',
        fontSize: 14,
        fontWeight: 800,
        color: look.listHead === 'plainDark' ? INK : PURPLE,
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      {name}
      <span style={{ color: MUTED, fontWeight: 600 }}>{count}</span>
    </h2>
  );
}

function List({ look, name, count, children }: { look: Look; name: string; count: number; children: ReactNode }) {
  const open = look.listBg === 'transparent';
  return (
    <section
      style={{
        flex: 'none',
        width: look.listWidth,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: open ? 10 : 8,
        background: look.listBg,
        border: look.listBorder ? `1px solid ${HAIR}` : 'none',
        borderRadius: 10,
        padding: open ? 0 : 10,
        overflow: 'hidden',
      }}
    >
      <ListHead look={look} name={name} count={count} />
      {children}
      <button style={{ background: 'none', border: 0, padding: '6px 4px', font: 'inherit', fontWeight: 700, color: PURPLE, cursor: 'pointer', textAlign: 'left' }}>
        + Add card
      </button>
    </section>
  );
}

function Hidden({ c }: { c: HiddenCard }) {
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'center', border: '1px dashed rgba(43,44,44,0.3)', borderRadius: 6, padding: 11, color: MUTED, fontSize: 13 }}>
      <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, background: 'rgba(43,44,44,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
      </span>
      <span>
        <b style={{ color: '#454646' }}>{c.title}</b>
        <br />
        on {c.onBoard} (no access)
      </span>
    </div>
  );
}

function Tile({ look, c }: { look: Look; c: JobCard }) {
  const s = look.tileSize;
  return (
    <span
      style={{
        flex: 'none',
        width: s,
        height: s,
        borderRadius: look.tile === 'ringSquare' || look.tile === 'solid' ? (look.tile === 'solid' ? 6 : 8) : 999,
        boxSizing: 'border-box',
        background: look.tile === 'solid' ? c.client.color : '#ffffff',
        border: look.tile === 'solid' ? 'none' : `${s < 30 ? 2 : 3}px solid ${c.client.color}`,
        color: look.tile === 'solid' ? '#ffffff' : c.client.color,
        fontSize: s < 30 ? 9 : 13,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {c.client.logo}
    </span>
  );
}

function DueTile({ c }: { c: JobCard }) {
  if (!c.due || !c.dueKind) return <span style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>No date</span>;
  const d = DUE[c.dueKind];
  const [day, mon] = c.due.split(' ');
  return (
    <span
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, padding: '4px 0', borderRadius: 4, background: d.bg === '#ffffff' ? '#f4f3f7' : d.bg, color: d.ink }}
    >
      <span style={{ fontSize: 16, fontWeight: 800 }}>{day}</span>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{d.word || mon}</span>
    </span>
  );
}

function DueChip({ c }: { c: JobCard }) {
  if (!c.due || !c.dueKind) return null;
  const d = DUE[c.dueKind];
  return (
    <span style={{ padding: '1px 7px', borderRadius: 4, background: d.bg, color: d.ink, fontWeight: 700, border: '1px solid rgba(43,44,44,0.1)' }}>
      {d.word && d.word !== 'Done' ? `${d.word} ${c.due}` : c.due}
    </span>
  );
}

function Avatars({ people, size }: { people: string[]; size: number }) {
  return (
    <span style={{ display: 'flex', flex: 'none' }}>
      {people.map((p) => (
        <span
          key={p}
          style={{ width: size, height: size, borderRadius: 999, background: PEOPLE[p], color: '#ffffff', fontSize: size > 24 ? 10 : 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -4, border: '2px solid #ffffff' }}
        >
          {p}
        </span>
      ))}
    </span>
  );
}

function Progress({ look, c }: { look: Look; c: JobCard }) {
  if (look.progress === 'segments') {
    return (
      <span style={{ display: 'flex', gap: 2, marginTop: 2 }}>
        {Array.from({ length: c.total }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < c.done ? c.client.color : 'rgba(43,44,44,0.12)' }} />
        ))}
      </span>
    );
  }
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return (
    <span style={{ display: 'block', height: 4, borderRadius: 999, background: 'rgba(43,44,44,0.1)', overflow: 'hidden', marginTop: 2 }}>
      <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: c.client.color }} />
    </span>
  );
}

function Card({ look, c }: { look: Look; c: JobCard }) {
  const inline = look.tile === 'inline';

  const clientLine = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: c.client.color }}>
      {inline && <Tile look={look} c={c} />}
      <span style={{ flex: 1 }}>
        {c.client.name}
        {c.mirror && <span style={{ color: MUTED, textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}> · {c.mirror}</span>}
      </span>
      {look.avatarsTop && <Avatars people={c.people} size={26} />}
    </span>
  );

  const body = (
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {clientLine}
      <span style={{ fontWeight: 700, lineHeight: 1.35 }}>
        {c.code && <span style={{ color: MUTED }}>{c.code} | </span>}
        {c.title}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MUTED, flexWrap: 'wrap' }}>
          <span>
            ✓ {c.done}/{c.total}
          </span>
          {!look.dateInTile && <DueChip c={c} />}
          {c.comments > 0 && <span>{c.comments} comments</span>}
        </span>
        {!look.avatarsTop && <Avatars people={c.people} size={22} />}
      </span>
      {look.progress !== 'none' && <Progress look={look} c={c} />}
    </span>
  );

  return (
    <a
      href="#"
      style={{
        display: 'flex',
        gap: 11,
        textDecoration: 'none',
        color: INK,
        background: '#ffffff',
        borderRadius: 6,
        padding: look.cardPad,
        borderTop: look.topLine ? `3px solid ${c.client.color}` : look.cardBorder || look.listBorder ? `1px solid ${HAIR}` : 'none',
        borderRight: look.cardBorder || look.listBorder ? `1px solid ${HAIR}` : 'none',
        borderBottom: look.cardBorder || look.listBorder ? `1px solid ${HAIR}` : 'none',
        borderLeft: look.cardBorder || look.listBorder ? `1px solid ${HAIR}` : 'none',
        boxShadow:
          look.shadow === 'strong'
            ? '0 10px 26px rgba(60,30,90,0.16)'
            : look.shadow === 'soft'
              ? '0 6px 18px rgba(60,30,90,0.10)'
              : look.listBorder
                ? 'none'
                : '0 1px 0 rgba(43,44,44,0.12)',
      }}
    >
      {!inline && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, width: look.tileSize, flex: 'none' }}>
          <Tile look={look} c={c} />
          {look.dateInTile && <DueTile c={c} />}
        </span>
      )}
      {body}
    </a>
  );
}

type MCardKind = 'line' | 'frost' | 'footer' | 'bold' | 'mono' | 'premium' | 'dense' | 'flex';
type MHead = 'text' | 'person' | 'bold' | 'accent' | 'big' | 'small';
type MHeader = 'clean' | 'toolbar' | 'bold' | 'glass' | 'dark';

interface MLook {
  id: string;
  name: string;
  page: string;
  col: CSSProperties;
  head: MHead;
  card: MCardKind;
  header: MHeader;
  width: number;
  gap: number;
  opt?: FlexOpt;
}

interface FlexOpt {
  logo: 'dot' | 'ring' | 'square';
  progress: boolean;
  faces: 'top' | 'bottom';
  skin: 'shadow' | 'flat' | 'outline';
  due: 'pill' | 'status' | 'corner';
  title: number;
  pad: number;
  caps: boolean;
}

const SPACIOUS: FlexOpt = { logo: 'ring', progress: true, faces: 'top', skin: 'shadow', due: 'pill', title: 16, pad: 16, caps: true };
const MONO: FlexOpt = { logo: 'dot', progress: false, faces: 'bottom', skin: 'flat', due: 'status', title: 14, pad: 12, caps: false };

const NOCOL: CSSProperties = {};

const MODERN: MLook[] = [
  { id: 'm6', name: 'Mono + status', page: '#f7f7f8', col: { background: '#efeff1', borderRadius: 8, padding: 8 }, head: 'text', card: 'mono', header: 'clean', width: 280, gap: 12 },
  { id: 'm9', name: 'Spacious', page: '#f7f6f9', col: NOCOL, head: 'big', card: 'premium', header: 'clean', width: 320, gap: 24 },
  { id: 's1', name: 'Spacious in grey', page: '#f7f7f8', col: NOCOL, head: 'big', card: 'flex', header: 'clean', width: 320, gap: 24, opt: { ...SPACIOUS, logo: 'dot', due: 'status', caps: false } },
  { id: 's2', name: 'Spacious, faces below', page: '#f7f6f9', col: NOCOL, head: 'big', card: 'flex', header: 'clean', width: 320, gap: 24, opt: { ...SPACIOUS, faces: 'bottom', progress: false } },
  { id: 's3', name: 'Spacious + person headers', page: '#f7f6f9', col: NOCOL, head: 'person', card: 'flex', header: 'clean', width: 320, gap: 24, opt: SPACIOUS },
  { id: 's4', name: 'Mono with logo ring', page: '#f7f7f8', col: { background: '#efeff1', borderRadius: 8, padding: 8 }, head: 'text', card: 'flex', header: 'clean', width: 285, gap: 12, opt: { ...MONO, logo: 'ring' } },
  { id: 's5', name: 'Mono, no list boxes', page: '#f4f4f6', col: NOCOL, head: 'big', card: 'flex', header: 'clean', width: 295, gap: 22, opt: { ...MONO, skin: 'shadow', pad: 14 } },
  { id: 's6', name: 'Spacious, outlined', page: '#ffffff', col: NOCOL, head: 'big', card: 'flex', header: 'clean', width: 320, gap: 24, opt: { ...SPACIOUS, skin: 'outline' } },
  { id: 's7', name: 'Mono, date top right', page: '#f7f7f8', col: { background: '#efeff1', borderRadius: 8, padding: 8 }, head: 'text', card: 'flex', header: 'clean', width: 285, gap: 12, opt: { ...MONO, due: 'corner', title: 15 } },
  { id: 's8', name: 'Spacious on lilac lists', page: '#f9f8fb', col: { background: '#f1ecf6', borderRadius: 10, padding: 12 }, head: 'big', card: 'flex', header: 'clean', width: 330, gap: 16, opt: { ...SPACIOUS, pad: 14 } },
  { id: 's9', name: 'Mono + progress', page: '#f7f7f8', col: { background: '#efeff1', borderRadius: 8, padding: 8 }, head: 'text', card: 'flex', header: 'clean', width: 285, gap: 12, opt: { ...MONO, progress: true, logo: 'square' } },
  { id: 's10', name: 'Spacious grey, dark top', page: '#f4f4f6', col: NOCOL, head: 'big', card: 'flex', header: 'dark', width: 320, gap: 24, opt: { ...SPACIOUS, logo: 'dot', due: 'status', caps: false, progress: false, faces: 'bottom' } },
];

const LINE = '#e7e6eb';

const LIST_COLOUR: Record<string, string> = {
  'To be briefed': '#e8742f',
  'With Sam': '#702f8f',
  'With Alex': '#b41e8c',
  'With Jordan': '#1f5fa8',
  'With client': '#0f7fa8',
  Hold: '#6b6f76',
  Delivered: '#1f7a4d',
};

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const I = {
  check: 'M4 4h16v16H4zM8 12l3 3 5-6',
  chat: 'M4 5h16v11H9l-5 4z',
  clock: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5V12l3 2',
  copy: 'M8 8h12v12H8zM16 4H4v12',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5',
  bell: 'M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0',
  cal: 'M3.5 5h17v15h-17zM3.5 10h17M8 3v4M16 3v4',
  plus: 'M12 5v14M5 12h14',
  down: 'M6 9l6 6 6-6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  lock: 'M5 11h14v9H5zM8 11V8a4 4 0 018 0v3',
  filter: 'M4 6h16M7 12h10M10 18h4',
};

function Square({ c, size = 18, ring }: { c: JobCard; size?: number; ring?: boolean }) {
  return (
    <span
      style={{ flex: 'none', width: size, height: size, borderRadius: ring ? 999 : Math.round(size / 4), boxSizing: 'border-box', background: ring ? '#ffffff' : c.client.color, border: ring ? `2px solid ${c.client.color}` : 'none', color: ring ? c.client.color : '#ffffff', fontSize: size < 22 ? 8 : 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {c.client.logo}
    </span>
  );
}

function DueText({ c }: { c: JobCard }) {
  if (!c.due || !c.dueKind) return null;
  const d = DUE[c.dueKind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: d.ink, fontWeight: c.dueKind === 'ok' ? 500 : 700 }}>
      <Icon d={I.clock} size={13} />
      {c.dueKind === 'late' ? `Late - ${c.due}` : c.due}
    </span>
  );
}

function DuePill({ c, outline }: { c: JobCard; outline?: boolean }) {
  if (!c.due || !c.dueKind) return null;
  const d = DUE[c.dueKind];
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: outline ? (c.dueKind === 'late' ? '#ffd9c7' : '#ffffff') : d.bg === '#ffffff' ? '#f1f0f4' : d.bg, color: d.ink, border: outline ? '2px solid #2f3030' : 'none', whiteSpace: 'nowrap' }}
    >
      {c.dueKind === 'late' ? `Late ${c.due}` : c.due}
    </span>
  );
}

function Faces({ people, size = 20 }: { people: string[]; size?: number }) {
  return <Avatars people={people} size={size} />;
}

function CodeTitle({ c, size = 14, weight = 600 }: { c: JobCard; size?: number; weight?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: weight, lineHeight: 1.35, color: '#1f2020' }}>
      {c.code && <span style={{ color: '#7a7b7d', fontWeight: 600 }}>{c.code} </span>}
      {c.title}
    </span>
  );
}

function Mirror({ c }: { c: JobCard }) {
  if (!c.mirror) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#7a7b7d', fontSize: 11, fontWeight: 600 }}>
      <Icon d={I.copy} size={12} />
      {c.mirror}
    </span>
  );
}

function FlexCard({ o, c }: { o: FlexOpt; c: JobCard }) {
  const metaS: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#6a6b6d', flexWrap: 'wrap' };
  const logo =
    o.logo === 'dot' ? (
      <span style={{ width: 8, height: 8, borderRadius: 999, background: c.client.color, flex: 'none' }} />
    ) : (
      <Square c={c} ring={o.logo === 'ring'} size={o.title > 15 ? 30 : 22} />
    );
  const statusPill = c.dueKind && c.dueKind !== 'ok' ? <DuePill c={c} /> : null;
  const top = o.due === 'corner' ? <DuePill c={c} /> : o.due === 'status' ? statusPill : null;
  const skin: CSSProperties =
    o.skin === 'shadow'
      ? { boxShadow: '0 1px 2px rgba(30,20,40,0.05), 0 10px 28px rgba(30,20,40,0.05)' }
      : o.skin === 'outline'
        ? { border: `1px solid ${LINE}` }
        : { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' };

  return (
    <a href="#" style={{ display: 'flex', flexDirection: 'column', gap: o.pad > 13 ? 10 : 6, padding: o.pad, borderRadius: 8, background: '#ffffff', textDecoration: 'none', color: '#1f2020', ...skin }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {logo}
        <span
          style={{ flex: 1, fontSize: o.caps ? 11 : 12, fontWeight: o.caps ? 800 : 600, letterSpacing: o.caps ? '0.06em' : 0, textTransform: o.caps ? 'uppercase' : 'none', color: o.caps ? c.client.color : '#6a6b6d' }}
        >
          {c.client.name}
        </span>
        {top}
        {o.faces === 'top' && <Faces people={c.people} size={26} />}
      </span>
      <CodeTitle c={c} size={o.title} weight={o.title > 14 ? 700 : 600} />
      {o.progress && <Progress look={LOOKS[0]} c={c} />}
      <span style={{ ...metaS, justifyContent: 'space-between' }}>
        <span style={metaS}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon d={I.check} size={13} />
            {c.done}/{c.total}
          </span>
          {c.comments > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon d={I.chat} size={13} />
              {c.comments}
            </span>
          )}
          {o.due === 'status' && c.dueKind === 'ok' && <span>{c.due}</span>}
          <Mirror c={c} />
        </span>
        <span style={metaS}>
          {o.due === 'pill' && <DuePill c={c} />}
          {o.faces === 'bottom' && <Faces people={c.people} size={o.title > 15 ? 26 : 20} />}
        </span>
      </span>
    </a>
  );
}

function MCard({ m, c }: { m: MLook; c: JobCard }) {
  if (m.card === 'flex' && m.opt) return <FlexCard o={m.opt} c={c} />;
  const base: CSSProperties = { display: 'flex', flexDirection: 'column', textDecoration: 'none', color: '#1f2020' };
  const metaS: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#6a6b6d', flexWrap: 'wrap' };
  const counts = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon d={I.check} size={13} />
        {c.done}/{c.total}
      </span>
      {c.comments > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon d={I.chat} size={13} />
          {c.comments}
        </span>
      )}
    </>
  );

  if (m.card === 'line' || m.card === 'frost') {
    const frost = m.card === 'frost';
    return (
      <a
        href="#"
        style={{ ...base, gap: 7, padding: '10px 12px', borderRadius: frost ? 10 : 6, background: frost ? 'rgba(255,255,255,0.78)' : '#ffffff', border: frost ? '1px solid rgba(255,255,255,0.9)' : `1px solid ${LINE}`, boxShadow: frost ? '0 4px 18px rgba(90,40,130,0.08)' : 'none', backdropFilter: frost ? 'blur(10px)' : undefined }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#6a6b6d', fontWeight: 600 }}>
          <Square c={c} ring={frost} size={frost ? 22 : 18} />
          <span style={{ flex: 1 }}>{c.client.name}</span>
          <Mirror c={c} />
        </span>
        <CodeTitle c={c} />
        <span style={{ ...metaS, justifyContent: 'space-between' }}>
          <span style={metaS}>
            {counts}
            <DueText c={c} />
          </span>
          <Faces people={c.people} />
        </span>
      </a>
    );
  }

  if (m.card === 'footer') {
    return (
      <a href="#" style={{ ...base, gap: 8, padding: '12px 12px 10px', borderRadius: 8, background: '#ffffff', boxShadow: '0 1px 2px rgba(30,20,40,0.08)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Square c={c} ring size={28} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: c.client.color }}>{c.client.name}</span>
          <DuePill c={c} />
        </span>
        <CodeTitle c={c} size={15} weight={700} />
        <span style={{ ...metaS, justifyContent: 'space-between', borderTop: `1px solid ${LINE}`, paddingTop: 8, marginTop: 2 }}>
          <span style={metaS}>
            {counts}
            <Mirror c={c} />
          </span>
          <Faces people={c.people} />
        </span>
      </a>
    );
  }

  if (m.card === 'bold') {
    return (
      <a href="#" style={{ ...base, gap: 8, padding: 12, borderRadius: 4, background: '#ffffff', border: '2px solid #2f3030', boxShadow: '3px 3px 0 #2f3030' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Square c={c} size={26} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: '#2f3030' }}>{c.client.name}</span>
          <DuePill c={c} outline />
        </span>
        <CodeTitle c={c} size={15} weight={800} />
        <span style={{ ...metaS, color: '#2f3030', fontWeight: 700, justifyContent: 'space-between' }}>
          <span style={metaS}>
            {counts}
            <Mirror c={c} />
          </span>
          <Faces people={c.people} />
        </span>
      </a>
    );
  }

  if (m.card === 'mono') {
    return (
      <a href="#" style={{ ...base, gap: 6, padding: '10px 12px', borderRadius: 6, background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6a6b6d', fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: c.client.color }} />
          <span style={{ flex: 1 }}>{c.client.name}</span>
          {c.dueKind && c.dueKind !== 'ok' && <DuePill c={c} />}
        </span>
        <CodeTitle c={c} />
        <span style={{ ...metaS, justifyContent: 'space-between' }}>
          <span style={metaS}>
            {counts}
            {c.dueKind === 'ok' && <span>{c.due}</span>}
            <Mirror c={c} />
          </span>
          <Faces people={c.people} />
        </span>
      </a>
    );
  }

  if (m.card === 'premium') {
    return (
      <a href="#" style={{ ...base, gap: 10, padding: 16, borderRadius: 8, background: '#ffffff', boxShadow: '0 1px 2px rgba(30,20,40,0.05), 0 10px 28px rgba(30,20,40,0.05)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Square c={c} ring size={30} />
          <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.client.color }}>{c.client.name}</span>
          <Faces people={c.people} size={26} />
        </span>
        <CodeTitle c={c} size={16} weight={700} />
        <Progress look={LOOKS[0]} c={c} />
        <span style={{ ...metaS, justifyContent: 'space-between' }}>
          <span style={metaS}>{counts}</span>
          <span style={metaS}>
            <Mirror c={c} />
            <DuePill c={c} />
          </span>
        </span>
      </a>
    );
  }

  return (
    <a href="#" style={{ ...base, gap: 3, padding: '7px 10px', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
        <Square c={c} size={16} />
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <CodeTitle c={c} size={13} />
        </span>
        <Faces people={c.people} size={18} />
      </span>
      <span style={{ ...metaS, fontSize: 11, gap: 8, paddingLeft: 23 }}>
        {counts}
        <DueText c={c} />
        <Mirror c={c} />
      </span>
    </a>
  );
}

function MHidden({ m, c }: { m: MLook; c: HiddenCard }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: m.card === 'dense' ? '7px 10px' : '10px 12px', borderRadius: m.card === 'dense' ? 0 : 6, border: m.card === 'dense' ? 'none' : '1px dashed #cfcdd6', borderBottom: m.card === 'dense' ? `1px solid ${LINE}` : undefined, color: '#6a6b6d', fontSize: 12 }}
    >
      <Icon d={I.lock} />
      <span>
        <b style={{ color: '#3a3b3d' }}>{c.title}</b> - on {c.onBoard}
      </span>
    </div>
  );
}

function MColHead({ m, name, cards }: { m: MLook; name: string; cards: AnyCard[] }) {
  const n = cards.length;
  const colour = LIST_COLOUR[name] ?? PURPLE;
  const late = cards.filter((c) => c.kind === 'card' && c.dueKind === 'late').length;
  const btn = (
    <span style={{ display: 'flex', gap: 2, color: '#7a7b7d' }}>
      <button aria-label="Add card" style={{ background: 'none', border: 0, padding: 3, cursor: 'pointer', color: 'inherit', display: 'flex' }}>
        <Icon d={I.plus} size={15} />
      </button>
      <button aria-label="List options" style={{ background: 'none', border: 0, padding: 3, cursor: 'pointer', color: 'inherit', display: 'flex' }}>
        <Icon d={I.dots} size={15} />
      </button>
    </span>
  );

  if (m.head === 'person') {
    const person = name.startsWith('With ') && name !== 'With client' ? name.slice(5) : null;
    const load = Math.min(n / 6, 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: person ? colour : '#e9e7ee', color: person ? '#ffffff' : '#4a4b4d', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {person ? person.slice(0, 2).toUpperCase() : n}
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, color: '#1f2020' }}>{person ?? name}</span>
            <span style={{ fontSize: 12, color: '#6a6b6d' }}>
              {n} jobs{late > 0 && <b style={{ color: '#a32117' }}> · {late} late</b>}
            </span>
          </span>
          {btn}
        </div>
        {person && (
          <span style={{ display: 'block', height: 4, borderRadius: 999, background: '#e6e3ec' }}>
            <span style={{ display: 'block', height: '100%', width: `${load * 100}%`, borderRadius: 999, background: colour }} />
          </span>
        )}
      </div>
    );
  }

  if (m.head === 'bold') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ padding: '5px 12px', borderRadius: 4, background: '#2f3030', color: '#ffffff', fontWeight: 800, fontSize: 13 }}>{name}</span>
        <span style={{ fontWeight: 800, color: '#2f3030' }}>{n}</span>
        <span style={{ flex: 1 }} />
        {btn}
      </div>
    );
  }

  if (m.head === 'accent') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-10px -10px 2px', padding: '10px 12px 8px', borderTop: `3px solid ${colour}`, borderRadius: '8px 8px 0 0' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: colour }} />
        <span style={{ fontWeight: 700, color: '#1f2020' }}>{name}</span>
        <span style={{ padding: '0 7px', borderRadius: 999, background: `${colour}1a`, color: colour, fontSize: 12, fontWeight: 800 }}>{n}</span>
        <span style={{ flex: 1 }} />
        {btn}
      </div>
    );
  }

  const size = m.head === 'big' ? 16 : m.head === 'small' ? 12 : 13;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: m.head === 'small' ? '9px 10px' : '2px 2px 4px', borderBottom: m.head === 'small' ? `1px solid ${LINE}` : 'none' }}
    >
      <span style={{ fontWeight: 700, fontSize: size, color: '#1f2020', textTransform: m.head === 'small' ? 'uppercase' : 'none', letterSpacing: m.head === 'small' ? '0.05em' : 0 }}>{name}</span>
      <span style={{ fontSize: size - 1, color: '#7a7b7d', fontWeight: 600 }}>{n}</span>
      <span style={{ flex: 1 }} />
      {btn}
    </div>
  );
}

function MHeaderBar({ m }: { m: MLook }) {
  const bold = m.header === 'bold';
  const glass = m.header === 'glass';
  const dark = m.header === 'dark';
  const ghost: CSSProperties = { height: 34, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: bold ? 4 : 999, background: bold ? '#ffffff' : 'transparent', border: bold ? '2px solid #2f3030' : `1px solid ${dark ? 'rgba(255,255,255,0.25)' : LINE}`, color: dark ? '#ffffff' : '#2f3030', fontWeight: 700, fontSize: 13, textDecoration: 'none', cursor: 'pointer', font: 'inherit', boxSizing: 'border-box' };
  const chip = (label: string, on?: boolean) => (
    <button
      key={label}
      style={{ height: 30, padding: '0 12px', borderRadius: 999, border: on ? `1px solid ${PURPLE}` : `1px solid ${LINE}`, background: on ? '#f3ecf8' : '#ffffff', color: on ? PURPLE : '#3a3b3d', fontWeight: 700, fontSize: 12, cursor: 'pointer', font: 'inherit' }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 28px', background: dark ? '#2b2b2e' : glass ? 'rgba(255,255,255,0.55)' : '#ffffff', backdropFilter: glass ? 'blur(12px)' : undefined, borderBottom: bold ? '2px solid #2f3030' : `1px solid ${glass ? 'rgba(255,255,255,0.8)' : LINE}` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, font: 'inherit', color: dark ? '#ffffff' : '#1f2020', cursor: 'pointer' }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: PURPLE, color: '#ffffff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JB</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Panwar Health WIP</span>
            <Icon d={I.down} size={16} />
          </button>
          <span style={{ display: 'flex' }}>
            {['SK', 'AL', 'JD', 'MR', 'TB'].map((p) => (
              <span key={p} style={{ width: 26, height: 26, borderRadius: 999, background: PEOPLE[p], color: '#ffffff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6, border: '2px solid #ffffff' }}>
                {p}
              </span>
            ))}
            <span style={{ fontSize: 12, color: '#6a6b6d', alignSelf: 'center', marginLeft: 6 }}>+6</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <label style={{ ...ghost, width: 250, gap: 8, color: '#7a7b7d', fontWeight: 500, background: bold ? '#ffffff' : '#f5f4f7' }}>
            <Icon d={I.search} />
            <input aria-label="Search cards" placeholder="Search cards" style={{ border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 13, flex: 1, minWidth: 0 }} />
            <span style={{ fontSize: 11, border: `1px solid ${LINE}`, borderRadius: 4, padding: '0 5px' }}>Ctrl K</span>
          </label>
          <a href="#" style={ghost}>
            <Icon d={I.cal} />
            Calendar
          </a>
          <a href="#" style={ghost}>
            Activity
          </a>
          <button aria-label="Notifications, 3 unread" style={{ ...ghost, position: 'relative', width: 34, padding: 0, justifyContent: 'center' }}>
            <Icon d={I.bell} size={16} />
            <span style={{ position: 'absolute', top: 5, right: 6, width: 8, height: 8, borderRadius: 999, background: '#e8742f', border: '2px solid #ffffff' }} />
          </button>
          <button style={{ ...ghost, background: PURPLE, color: '#ffffff', border: bold ? '2px solid #2f3030' : 0 }}>
            <Icon d={I.plus} />
            New card
          </button>
        </div>
      </div>
      {m.header === 'toolbar' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 28px', borderBottom: `1px solid ${LINE}`, background: '#ffffff' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#6a6b6d', marginRight: 4 }}>
            <Icon d={I.filter} />
            Show
          </span>
          {chip('Everything', true)}
          {chip('My jobs')}
          {chip('Due this week')}
          {chip('Late (3)')}
          {chip('Client: any')}
          <span style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', padding: 2, borderRadius: 999, background: '#f1f0f4' }}>
            <span style={{ padding: '4px 12px', borderRadius: 999, background: '#ffffff', fontSize: 12, fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>Board</span>
            <span style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#6a6b6d' }}>Calendar</span>
          </span>
        </div>
      )}
    </div>
  );
}

function ModernBoard({ m }: { m: MLook }) {
  return (
    <div style={{ background: m.page, minHeight: '100%', fontSize: 14, lineHeight: 1.45 }}>
      <MHeaderBar m={m} />
      <div style={{ display: 'flex', gap: m.gap, alignItems: 'flex-start', overflowX: 'auto', padding: '0 28px 40px' }}>
        {LISTS.map((l) => (
          <section key={l.name} style={{ flex: 'none', width: m.width, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: m.card === 'dense' ? 0 : m.card === 'premium' || (m.opt && m.opt.pad > 13) ? 14 : 8, overflow: m.card === 'dense' ? 'hidden' : undefined, ...m.col }}>
            <MColHead m={m} name={l.name} cards={l.cards} />
            {l.cards.map((c, i) => (c.kind === 'hidden' ? <MHidden key={i} m={m} c={c} /> : <MCard key={i} m={m} c={c} />))}
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: m.card === 'dense' ? '8px 10px' : '6px 2px', font: 'inherit', fontSize: 13, fontWeight: 600, color: '#7a7b7d', cursor: 'pointer', textAlign: 'left' }}
            >
              <Icon d={I.plus} />
              Add card
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

type RHead = 'icon' | 'tag' | 'sum' | 'plain' | 'load' | 'grey';
type RCardKind = 'chips' | 'props' | 'labels' | 'tick' | 'status' | 'lozenge' | 'next' | 'keyval' | 'steps';

interface RLook {
  id: string;
  name: string;
  from: string;
  head: RHead;
  card: RCardKind;
  page: string;
  col: CSSProperties;
  width: number;
}

const RESEARCH: RLook[] = [
  { id: 'r1', name: 'Property chips', from: 'Linear', head: 'icon', card: 'chips', page: '#fbfbfc', col: NOCOL, width: 290 },
  { id: 'r2', name: 'Tag headers', from: 'Notion', head: 'tag', card: 'props', page: '#ffffff', col: NOCOL, width: 280 },
  { id: 'r3', name: 'Column totals', from: 'GitHub Projects', head: 'sum', card: 'labels', page: '#f6f8fa', col: { background: '#ffffff', border: '1px solid #d8dee4', borderRadius: 8, padding: 10 }, width: 290 },
  { id: 'r4', name: 'Tick circle', from: 'Asana', head: 'plain', card: 'tick', page: '#f9f8f8', col: NOCOL, width: 285 },
  { id: 'r5', name: 'Status footer', from: 'Monday', head: 'tag', card: 'status', page: '#f6f7fb', col: NOCOL, width: 285 },
  { id: 'r6', name: 'Client lozenge', from: 'Jira', head: 'grey', card: 'lozenge', page: '#ffffff', col: { background: '#f1f2f4', borderRadius: 8, padding: 8 }, width: 280 },
  { id: 'r7', name: 'Next step', from: 'Streamtime', head: 'plain', card: 'next', page: '#f7f6f9', col: NOCOL, width: 310 },
  { id: 'r8', name: 'Workload headers', from: 'Height', head: 'load', card: 'chips', page: '#fbfbfc', col: NOCOL, width: 290 },
  { id: 'r9', name: 'Key / value', from: 'Attio', head: 'icon', card: 'keyval', page: '#fafafa', col: NOCOL, width: 290 },
  { id: 'r10', name: 'Inline steps', from: 'Things', head: 'plain', card: 'steps', page: '#f7f7f8', col: NOCOL, width: 300 },
];

const STEPS = ['Brief in', 'V1 layout from studio', 'Internal review', 'Copy check', 'Send to client', 'Client feedback', 'V2 amends', 'Med/legal review', 'Final amends', 'Final files', 'Upload to client', 'Invoice'];

const nextSteps = (c: JobCard, n: number) =>
  c.done >= c.total ? [] : Array.from({ length: Math.min(n, c.total - c.done) }, (_, i) => STEPS[(c.done + i) % STEPS.length]);

const STATUS: Record<DueKind | 'none', { label: string; bg: string; ink: string }> = {
  late: { label: 'Late', bg: '#d83a2c', ink: '#ffffff' },
  soon: { label: 'Due soon', bg: '#f2b632', ink: '#2f2400' },
  ok: { label: 'On track', bg: '#1f8a55', ink: '#ffffff' },
  done: { label: 'Done', bg: '#5b5f66', ink: '#ffffff' },
  none: { label: 'No date', bg: '#c9c8cf', ink: '#2f3030' },
};

function Circle({ done, size = 16, colour = '#9a9a9f' }: { done?: boolean; size?: number; colour?: string }) {
  return (
    <span
      style={{ flex: 'none', width: size, height: size, borderRadius: 999, boxSizing: 'border-box', border: `1.5px solid ${done ? '#1f8a55' : colour}`, background: done ? '#1f8a55' : 'transparent', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {done && <Icon d="M6 12l4 4 8-9" size={size - 6} />}
    </span>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: { bg: string; ink: string } }) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 7px', borderRadius: 5, border: tone ? 'none' : `1px solid ${LINE}`, background: tone?.bg ?? '#ffffff', color: tone?.ink ?? '#4a4b4d', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {children}
    </span>
  );
}

function dueTone(c: JobCard) {
  if (!c.dueKind) return undefined;
  return { bg: DUE[c.dueKind].bg === '#ffffff' ? '#f1f0f4' : DUE[c.dueKind].bg, ink: DUE[c.dueKind].ink };
}

function dueWords(c: JobCard) {
  if (!c.due) return 'No date';
  return c.dueKind === 'late' ? `Late - ${c.due}` : c.dueKind === 'soon' ? `${c.due} - soon` : c.due;
}

function RColHead({ r, name, cards }: { r: RLook; name: string; cards: AnyCard[] }) {
  const n = cards.length;
  const colour = LIST_COLOUR[name] ?? PURPLE;
  const jobs = cards.filter((c): c is JobCard => c.kind === 'card');
  const late = jobs.filter((c) => c.dueKind === 'late').length;
  const left = jobs.reduce((a, c) => a + (c.total - c.done), 0);
  const plus = (
    <button aria-label="Add card" style={{ background: 'none', border: 0, padding: 3, cursor: 'pointer', color: '#7a7b7d', display: 'flex' }}>
      <Icon d={I.plus} size={15} />
    </button>
  );
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 6px' };

  if (r.head === 'icon') {
    return (
      <div style={row}>
        <span style={{ width: 14, height: 14, borderRadius: 999, border: `2px solid ${colour}`, boxSizing: 'border-box', background: `conic-gradient(${colour} 0 ${name === 'Delivered' ? 100 : 40}%, transparent 0)` }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2020' }}>{name}</span>
        <span style={{ fontSize: 13, color: '#8a8b8d' }}>{n}</span>
        <span style={{ flex: 1 }} />
        {plus}
      </div>
    );
  }
  if (r.head === 'tag') {
    return (
      <div style={row}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 5, background: `${colour}1f`, color: colour, fontWeight: 700, fontSize: 13 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: colour }} />
          {name}
        </span>
        <span style={{ fontSize: 13, color: '#8a8b8d' }}>{n}</span>
        <span style={{ flex: 1 }} />
        {plus}
      </div>
    );
  }
  if (r.head === 'sum') {
    return (
      <div style={{ padding: '0 2px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: colour }} />
          <span style={{ fontWeight: 700, color: '#1f2328' }}>{name}</span>
          <span style={{ padding: '0 7px', borderRadius: 999, background: '#eff2f5', fontSize: 12, fontWeight: 600 }}>{n}</span>
          <span style={{ flex: 1 }} />
          {plus}
        </div>
        <div style={{ fontSize: 12, color: '#59636e', marginTop: 2 }}>
          {left} steps left{late > 0 && <b style={{ color: '#b3261e' }}> · {late} late</b>}
        </div>
      </div>
    );
  }
  if (r.head === 'load') {
    const person = PERSON_HEADS.includes(name) ? name.slice(5) : null;
    const heavy = n >= 4;
    return (
      <div style={{ ...row, padding: '2px 2px 10px', borderBottom: `2px solid ${heavy ? '#f2b632' : LINE}`, marginBottom: 4 }}>
        <span style={{ width: 28, height: 28, borderRadius: 999, background: person ? colour : '#ecebf0', color: person ? '#ffffff' : '#4a4b4d', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {person ? person.slice(0, 2).toUpperCase() : n}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#1f2020' }}>{person ?? name}</span>
          <span style={{ fontSize: 11, color: heavy ? '#7a4b00' : '#6a6b6d', fontWeight: heavy ? 700 : 500 }}>
            {n} jobs{heavy ? ' - busy' : ''}{late > 0 ? ` · ${late} late` : ''}
          </span>
        </span>
        {plus}
      </div>
    );
  }
  if (r.head === 'grey') {
    return (
      <div style={{ ...row, padding: '4px 4px 6px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#44546f' }}>{name}</span>
        <span style={{ fontSize: 12, color: '#44546f' }}>{n}</span>
        <span style={{ flex: 1 }} />
        {plus}
      </div>
    );
  }
  return (
    <div style={row}>
      <span style={{ fontWeight: 800, fontSize: 15, color: '#1f2020' }}>{name}</span>
      <span style={{ fontSize: 13, color: '#8a8b8d', fontWeight: 600 }}>{n}</span>
      <span style={{ flex: 1 }} />
      {plus}
    </div>
  );
}

const PERSON_HEADS = ['With Sam', 'With Alex', 'With Jordan'];

function RCard({ r, c }: { r: RLook; c: JobCard }) {
  const a: CSSProperties = { display: 'flex', flexDirection: 'column', textDecoration: 'none', color: '#1f2020', background: '#ffffff' };
  const small: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6a6b6d', flexWrap: 'wrap' };
  const title = <CodeTitle c={c} size={14} weight={600} />;

  if (r.card === 'chips') {
    return (
      <a href="#" style={{ ...a, gap: 8, padding: '10px 12px', borderRadius: 6, border: `1px solid ${LINE}` }}>
        <span style={{ ...small, justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>{c.code || 'No job code'}</span>
          <Faces people={c.people} size={20} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>{c.title}</span>
        <span style={small}>
          <Chip>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.client.color }} />
            {c.client.name}
          </Chip>
          {c.due && (
            <Chip tone={c.dueKind === 'late' || c.dueKind === 'soon' ? dueTone(c) : undefined}>
              <Icon d={I.clock} size={12} />
              {dueWords(c)}
            </Chip>
          )}
          <Chip>
            <Icon d={I.check} size={12} />
            {c.done}/{c.total}
          </Chip>
          {c.mirror && (
            <Chip>
              <Icon d={I.copy} size={12} />
              {c.mirror}
            </Chip>
          )}
        </span>
      </a>
    );
  }

  if (r.card === 'props') {
    const prop = (k: string, v: ReactNode) => (
      <span style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ color: '#8a8b8d' }}>{k}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#37352f' }}>{v}</span>
      </span>
    );
    return (
      <a href="#" style={{ ...a, gap: 6, padding: '10px 12px', borderRadius: 6, boxShadow: '0 0 0 1px rgba(15,15,15,0.06), 0 2px 4px rgba(15,15,15,0.06)' }}>
        {title}
        {prop('Client', <><Square c={c} size={16} />{c.client.name}</>)}
        {prop('Due', <span style={{ color: c.dueKind ? DUE[c.dueKind].ink : '#8a8b8d', fontWeight: c.dueKind === 'late' ? 700 : 400 }}>{dueWords(c)}</span>)}
        {prop('Steps', `${c.done} of ${c.total}`)}
        {c.people.length > 0 && prop('People', <Faces people={c.people} size={18} />)}
        {c.mirror && prop('Also', c.mirror.replace('Also ', ''))}
      </a>
    );
  }

  if (r.card === 'labels') {
    return (
      <a href="#" style={{ ...a, gap: 7, padding: '10px 12px', borderRadius: 6, border: '1px solid #d8dee4' }}>
        <span style={small}>
          <Square c={c} size={16} />
          {c.client.name}
          {c.code && <span style={{ color: '#8a8b8d' }}>#{c.code}</span>}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</span>
        <span style={{ ...small, justifyContent: 'space-between' }}>
          <span style={{ ...small, gap: 5 }}>
            {c.due && (
              <span style={{ padding: '0 8px', borderRadius: 999, border: `1px solid ${c.dueKind === 'late' ? '#d83a2c' : '#d8dee4'}`, color: c.dueKind === 'late' ? '#b3261e' : '#59636e', fontWeight: 600 }}>{dueWords(c)}</span>
            )}
            <span style={{ padding: '0 8px', borderRadius: 999, border: '1px solid #d8dee4', color: '#59636e', fontWeight: 600 }}>
              {c.done}/{c.total} steps
            </span>
            {c.mirror && <span style={{ padding: '0 8px', borderRadius: 999, background: '#f1ebf6', color: PURPLE, fontWeight: 600 }}>{c.mirror}</span>}
          </span>
          <Faces people={c.people} size={20} />
        </span>
      </a>
    );
  }

  if (r.card === 'tick') {
    return (
      <a href="#" style={{ ...a, gap: 9, padding: 12, borderRadius: 8, border: '1px solid #e4e2e1', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Circle done={c.done === c.total} size={18} />
          {title}
        </span>
        <span style={small}>
          <span style={{ padding: '1px 8px', borderRadius: 999, background: c.client.tint, color: c.client.color, fontWeight: 700 }}>{c.client.name}</span>
          {c.mirror && <span>{c.mirror}</span>}
        </span>
        <span style={{ ...small, justifyContent: 'space-between' }}>
          <span style={small}>
            {c.people.length ? <Faces people={c.people} size={24} /> : <span style={{ width: 24, height: 24, borderRadius: 999, border: '1.5px dashed #b9b8bd', boxSizing: 'border-box' }} />}
            <span style={{ color: c.dueKind === 'late' ? '#c92a1e' : c.dueKind === 'soon' ? '#7a4b00' : c.dueKind === 'done' ? '#1f8a55' : '#6a6b6d', fontWeight: 600 }}>{dueWords(c)}</span>
          </span>
          <span style={small}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Icon d={I.check} size={13} />
              {c.done}/{c.total}
            </span>
            {c.comments > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Icon d={I.chat} size={13} />
                {c.comments}
              </span>
            )}
          </span>
        </span>
      </a>
    );
  }

  if (r.card === 'status') {
    const s = STATUS[c.dueKind ?? 'none'];
    return (
      <a href="#" style={{ ...a, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(20,20,60,0.12)' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '11px 12px' }}>
          <span style={{ ...small, fontWeight: 700, color: c.client.color }}>
            <Square c={c} size={20} />
            {c.client.name}
            <span style={{ flex: 1 }} />
            <Faces people={c.people} size={22} />
          </span>
          {title}
          <span style={small}>
            <span>
              {c.done}/{c.total} steps
            </span>
            {c.comments > 0 && <span>{c.comments} comments</span>}
            {c.mirror && <span>{c.mirror}</span>}
          </span>
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: s.bg, color: s.ink, fontSize: 12, fontWeight: 800 }}>
          <span>{s.label}</span>
          <span>{c.due ?? ''}</span>
        </span>
      </a>
    );
  }

  if (r.card === 'lozenge') {
    return (
      <a href="#" style={{ ...a, gap: 8, padding: '10px 12px', borderRadius: 4, boxShadow: '0 1px 1px rgba(9,30,66,0.25), 0 0 1px rgba(9,30,66,0.31)' }}>
        <span style={{ fontSize: 14, color: '#172b4d', lineHeight: 1.35 }}>{c.title}</span>
        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ padding: '0 5px', borderRadius: 3, background: c.client.tint, color: c.client.color, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{c.client.name}</span>
          {c.dueKind && c.dueKind !== 'ok' && (
            <span style={{ padding: '0 5px', borderRadius: 3, background: DUE[c.dueKind].bg, color: DUE[c.dueKind].ink, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{STATUS[c.dueKind].label}</span>
          )}
        </span>
        <span style={{ ...small, justifyContent: 'space-between', color: '#44546f' }}>
          <span style={small}>
            <Square c={c} size={16} />
            <b>{c.code || 'NO CODE'}</b>
            {c.due && <span>{c.due}</span>}
            <span>
              {c.done}/{c.total}
            </span>
          </span>
          <Faces people={c.people} size={22} />
        </span>
      </a>
    );
  }

  if (r.card === 'next') {
    const [next] = nextSteps(c, 1);
    return (
      <a href="#" style={{ ...a, gap: 9, padding: 14, borderRadius: 8, boxShadow: '0 1px 2px rgba(30,20,40,0.05), 0 8px 22px rgba(30,20,40,0.05)' }}>
        <span style={{ ...small, fontWeight: 700, color: c.client.color }}>
          <Square c={c} ring size={26} />
          <span style={{ flex: 1 }}>{c.client.name}</span>
          <Faces people={c.people} size={24} />
        </span>
        <CodeTitle c={c} size={15} weight={700} />
        {next ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 6, background: '#f6f4f9', fontSize: 13 }}>
            <Circle size={15} />
            <span style={{ flex: 1 }}>
              <span style={{ color: '#6a6b6d' }}>Next: </span>
              <b>{next}</b>
            </span>
            {c.due && <span style={{ fontSize: 12, fontWeight: 700, color: c.dueKind ? DUE[c.dueKind].ink : '#6a6b6d' }}>{c.dueKind === 'late' ? `Late ${c.due}` : c.due}</span>}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: '#1f8a55', fontWeight: 700 }}>All steps done</span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6a6b6d' }}>
          <span style={{ flex: 1 }}>
            <Progress look={LOOKS[0]} c={c} />
          </span>
          {c.done} of {c.total} steps
        </span>
        {c.mirror && <Mirror c={c} />}
      </a>
    );
  }

  if (r.card === 'keyval') {
    const kv = (k: string, v: ReactNode) => (
      <>
        <span style={{ color: '#8a8b8d' }}>{k}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#2a2b2d', fontWeight: 600 }}>{v}</span>
      </>
    );
    return (
      <a href="#" style={{ ...a, gap: 9, padding: 12, borderRadius: 8, border: `1px solid ${LINE}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Square c={c} size={28} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{c.title}</span>
            <span style={{ fontSize: 12, color: '#8a8b8d' }}>
              {c.client.name}
              {c.code && ` · ${c.code}`}
            </span>
          </span>
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: '58px 1fr 58px 1fr', rowGap: 5, columnGap: 6, fontSize: 12, borderTop: `1px solid ${LINE}`, paddingTop: 8 }}>
          {kv('Due', <span style={{ color: c.dueKind ? DUE[c.dueKind].ink : '#8a8b8d' }}>{c.dueKind === 'late' ? `Late ${c.due}` : c.due ?? 'None'}</span>)}
          {kv('Steps', `${c.done}/${c.total}`)}
          {kv('People', c.people.length ? <Faces people={c.people} size={18} /> : 'None')}
          {kv('Notes', c.comments)}
        </span>
        {c.mirror && <Mirror c={c} />}
      </a>
    );
  }

  const steps = nextSteps(c, 2);
  return (
    <a href="#" style={{ ...a, gap: 8, padding: 13, borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)' }}>
      <span style={{ ...small, fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: c.client.color }} />
        <span style={{ flex: 1 }}>{c.client.name}</span>
        {c.dueKind && c.dueKind !== 'ok' && <DuePill c={c} />}
      </span>
      {title}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {steps.map((s, i) => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3b3d' }}>
            <Circle size={15} />
            <span style={{ flex: 1 }}>{s}</span>
            {i === 0 && c.due && <span style={{ fontSize: 12, color: '#8a8b8d' }}>{c.due}</span>}
          </span>
        ))}
        {steps.length === 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1f8a55', fontWeight: 600 }}>
            <Circle done size={15} />
            All {c.total} steps done
          </span>
        )}
      </span>
      <span style={{ ...small, justifyContent: 'space-between' }}>
        <span style={small}>
          {c.total - c.done - steps.length > 0 && <span>+{c.total - c.done - steps.length} more steps</span>}
          {c.mirror && <Mirror c={c} />}
        </span>
        <Faces people={c.people} size={20} />
      </span>
    </a>
  );
}

function ResearchBoard({ r }: { r: RLook }) {
  return (
    <div style={{ background: r.page, minHeight: '100%', fontSize: 14, lineHeight: 1.45 }}>
      <MHeaderBar m={MODERN[0]} />
      <div style={{ display: 'flex', gap: r.col === NOCOL ? 20 : 12, alignItems: 'flex-start', overflowX: 'auto', padding: '0 28px 40px' }}>
        {LISTS.map((l) => (
          <section key={l.name} style={{ flex: 'none', width: r.width, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, ...r.col }}>
            <RColHead r={r} name={l.name} cards={l.cards} />
            {l.cards.map((c, i) => (c.kind === 'hidden' ? <MHidden key={i} m={MODERN[0]} c={c} /> : <RCard key={i} r={r} c={c} />))}
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: '6px 2px', font: 'inherit', fontSize: 13, fontWeight: 600, color: '#7a7b7d', cursor: 'pointer', textAlign: 'left' }}>
              <Icon d={I.plus} />
              Add card
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

const SHORTLIST = [
  { id: 'D', name: 'Logo tile' },
  { id: '9', name: 'Lilac lists' },
  { id: '9g', name: 'Floating cards' },
  { id: 'g9', name: 'Quiet headings' },
  { id: 'm6', name: 'Mono + status' },
  { id: 'm9', name: 'Spacious' },
  { id: 'r3', name: 'Column totals' },
  { id: 'r10', name: 'Next steps' },
];

const styleLabel = (id: string) => {
  const i = SHORTLIST.findIndex((s) => s.id === id);
  return i < 0 ? id : `Style ${i + 1} - ${SHORTLIST[i].name}`;
};

function VotePanel({ current }: { current: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['job-board-vote'], queryFn: getJobBoardVote });
  const [comment, setComment] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const save = useMutation({
    mutationFn: saveJobBoardVote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-board-vote'] }),
  });

  const mine = data?.mine ?? null;
  const note = comment ?? mine?.comment ?? '';
  const votedHere = mine?.choice === current;
  const all = data?.all ?? null;

  return (
    <div style={{ background: '#ffffff', borderBottom: `1px solid ${LINE}`, padding: '14px 28px', fontSize: 14, color: '#2f3030' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 800 }}>{styleLabel(current)}</span>
        <input
          aria-label="Comment (optional)"
          placeholder="Why this one? (optional)"
          value={note}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
          style={{ flex: '1 1 260px', maxWidth: 420, height: 36, boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${LINE}`, padding: '0 12px', font: 'inherit', fontSize: 13 }}
        />
        <button
          onClick={() => save.mutate({ choice: current, comment: note.trim() || null })}
          disabled={save.isPending}
          style={{ height: 36, padding: '0 18px', borderRadius: 999, border: 0, background: votedHere ? '#1f8a55' : PURPLE, color: '#ffffff', font: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
        >
          {save.isPending ? 'Saving...' : votedHere ? 'Your vote (update comment)' : 'Vote for this style'}
        </button>
        <span style={{ fontSize: 13, color: '#616262' }}>
          {mine ? `You voted for ${styleLabel(mine.choice)}. You can change your vote any time.` : 'Click through the styles above, then vote for your favourite.'}
        </span>
        {save.isError && <span style={{ fontSize: 13, color: '#a32117', fontWeight: 700 }}>{save.error.message}</span>}
        {all && (
          <button
            onClick={() => setShowResults((x) => !x)}
            style={{ marginLeft: 'auto', height: 32, padding: '0 14px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#ffffff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {showResults ? 'Hide results' : `Results (${all.length})`}
          </button>
        )}
      </div>
      {all && showResults && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
          {SHORTLIST.map((s) => {
            const votes = all.filter((v) => v.choice === s.id);
            return (
              <div key={s.id} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span>{styleLabel(s.id)}</span>
                  <span style={{ color: PURPLE }}>{votes.length}</span>
                </div>
                {votes.map((v) => (
                  <div key={v.voterName} style={{ fontSize: 13, marginTop: 6 }}>
                    <b>{v.voterName}</b>
                    {v.comment && <span style={{ color: '#4f5050' }}>: {v.comment}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
