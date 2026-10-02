import type { ReactNode } from 'react';

export interface AppDefinition {
  to: string;
  name: string;
  group: string;
  colour: string;
  glyph: ReactNode;
  roles: readonly string[] | null;
}

const EDITOR_ROLES = ['panwar-admin', 'dashboard-editor', 'medical-writer'] as const;

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const APPS: readonly AppDefinition[] = [
  {
    to: '/app/clients',
    name: 'Client Dashboards',
    group: 'Clients',
    colour: '#702f8f',
    roles: EDITOR_ROLES,
    glyph: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 34l10-10 8 6 14-17" {...stroke} strokeWidth="4" />
        <g fill="currentColor">
          <circle cx="8" cy="34" r="3.5" />
          <circle cx="18" cy="24" r="3.5" />
          <circle cx="26" cy="30" r="3.5" />
          <circle cx="40" cy="13" r="3.5" />
        </g>
      </svg>
    ),
  },
  {
    to: '/app/links',
    name: 'UTM Links',
    group: 'Marketing',
    colour: '#b41e8c',
    roles: null,
    glyph: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth="2.6">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    to: '/app/qr',
    name: 'QR Codes',
    group: 'Marketing',
    colour: '#454646',
    roles: null,
    glyph: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <g {...stroke} strokeWidth="4">
          <path d="M8 17v-6a3 3 0 0 1 3-3h6" />
          <path d="M31 8h6a3 3 0 0 1 3 3v6" />
          <path d="M40 31v6a3 3 0 0 1-3 3h-6" />
          <path d="M17 40h-6a3 3 0 0 1-3-3v-6" />
        </g>
        <g fill="currentColor">
          <rect x="16.5" y="16.5" width="6.5" height="6.5" rx="1.2" />
          <rect x="25" y="25" width="6.5" height="6.5" rx="1.2" />
          <rect x="25" y="16.5" width="6.5" height="6.5" rx="1.2" opacity="0.5" />
          <rect x="16.5" y="25" width="6.5" height="6.5" rx="1.2" opacity="0.5" />
        </g>
      </svg>
    ),
  },
  {
    to: '/app/admin',
    name: 'Users & Roles',
    group: 'Admin',
    colour: '#3d1a52',
    roles: ['panwar-admin'],
    glyph: (
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
        <circle cx="18" cy="17" r="6.5" />
        <path d="M5 39c0-7.5 5.5-12 13-12s13 4.5 13 12z" />
        <g opacity="0.55">
          <circle cx="33" cy="15" r="5" />
          <path d="M35 39h8v-2c0-6.5-4-10.5-10-10.5-1.2 0-2.3.2-3.3.5 3.3 2.7 5.3 6.8 5.3 12z" />
        </g>
      </svg>
    ),
  },
];

export const appsForRoles = (roles: readonly string[]): AppDefinition[] =>
  APPS.filter((a) => a.roles === null || a.roles.some((r) => roles.includes(r)));
