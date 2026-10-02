import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ApiError } from '@/api/client';
import { listQrCodes, saveQrCode, type QrCodeOptions, type SavedQrCode } from '@/api/links';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  buildQrSvg,
  downloadPng,
  downloadSvg,
  loadLogo,
  qrFilename,
  svgDataUrl,
} from '@/lib/qr';
import { formatDay, parseWebAddress } from '@/lib/utm';

export const Route = createFileRoute('/app/qr')({
  validateSearch: (search: Record<string, unknown>): { url?: string } => ({
    url: typeof search.url === 'string' ? search.url : undefined,
  }),
  component: QrPage,
});

const SIZES = [
  { label: 'Small', px: 512 },
  { label: 'Medium', px: 1024 },
  { label: 'Print', px: 2048 },
] as const;

const FOREGROUNDS = [
  { value: '#454646', label: 'Charcoal' },
  { value: '#702f8f', label: 'Purple' },
  { value: '#000000', label: 'Black' },
] as const;

const DEFAULTS: QrCodeOptions = {
  size: 1024,
  foreground: '#454646',
  background: '#ffffff',
  hasLogo: false,
};

const grey = 'text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-charcoal';

function tryBuild(text: string, options: QrCodeOptions, logo: string | null): string | null {
  try {
    return buildQrSvg(text, options, logo);
  } catch {
    return null;
  }
}

function QrPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(search.url ?? '');
  const [options, setOptions] = useState<QrCodeOptions>(DEFAULTS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  const { data: logo = null } = useQuery({
    queryKey: ['qr-logo'],
    queryFn: loadLogo,
    staleTime: Infinity,
  });

  const text = url.trim();
  const parsed = parseWebAddress(text);
  const campaign =
    parsed && parsed.searchParams.has('utm_source')
      ? (parsed.searchParams.get('utm_campaign') ?? '').toUpperCase()
      : '';

  const svg = useMemo(
    () => (parsed ? tryBuild(text, options, logo) : null),
    [parsed, text, options, logo],
  );

  const download = useMutation({
    mutationFn: async (format: 'png' | 'svg') => {
      if (!svg) return;
      await saveQrCode({ url: text, ...options });
      if (format === 'svg') downloadSvg(svg, '${qrFilename(text)}.svg');
      else await downloadPng(svg, options.size, `${qrFilename(text)}.png`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qr-codes'] }),
  });

  const logoPending = options.hasLogo && logo === null;

  const { mutate: autosave, isError: autosaveFailed } = useMutation({
    mutationFn: saveQrCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qr-codes'] }),
  });
  useEffect(() => {
    if (!svg || logoPending) return;
    const timer = setTimeout(() => autosave({ url: text, ...options }), 2000);
    return () => clearTimeout(timer);
  }, [svg, logoPending, text, options, autosave]);
  const set = (patch: Partial<QrCodeOptions>) => setOptions((o) => ({ ...o, ...patch }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ph-charcoal">QR Codes</h1>
      <Card className="p-8 sm:p-10">
      <h2 className="text-2xl font-bold leading-tight text-ph-charcoal">Make a QR code</h2>
      <p className="mb-6 mt-1.5 text-[15px] text-ph-charcoal/60">
        Paste any link, or{' '}
        <Link to="/app/links/register" className="underline underline-offset-4 hover:text-ph-charcoal">
          pick one from past links
        </Link>
        . Links made here already have tracking on them.
      </p>

      <input
        autoFocus
        className="w-full border-0 border-b-2 border-ph-charcoal/20 bg-transparent py-2.5 font-mono text-xl text-ph-charcoal placeholder:text-ph-charcoal/40 focus:border-ph-purple focus:outline-none"
        placeholder="https://"
        autoComplete="off"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="mb-6 mt-2 min-h-6 text-sm text-red-600">
        {text && !parsed && "That doesn't look like a web address"}
        {parsed && !svg && 'That link is too long for a QR code'}
      </div>

      {parsed && svg && (
        <>
          {!campaign && (
            <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-lg bg-orange-50 px-3.5 py-3 text-sm text-orange-900">
              No tracking on this link, so scans won't show under a job.
              <Link
                to="/app/links"
                search={{ dest: parsed.origin + parsed.pathname }}
                className="ml-auto rounded-lg border-[1.5px] border-current bg-white px-3 py-1.5 font-semibold"
              >
                Build a tracked link
              </Link>
            </div>
          )}

          <div className="mb-5 flex flex-col items-center gap-3.5 rounded-lg border border-ph-charcoal/20 px-5 py-8">
            <img src={svgDataUrl(svg)} alt="QR code" className="h-56 w-56" />
            {campaign && <div className="font-mono text-[13px] text-ph-charcoal/60">{campaign}</div>}
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              size="lg"
              disabled={download.isPending || logoPending}
              onClick={() => download.mutate('png')}
            >
              Download PNG
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={download.isPending || logoPending}
              onClick={() => download.mutate('svg')}
            >
              Download SVG for print
            </Button>
            <button type="button" className={grey} onClick={() => setOptionsOpen((o) => !o)}>
              Options
            </button>
          </div>
          {autosaveFailed && (
            <p className="text-sm text-red-600">This code could not be saved to past codes.</p>
          )}
          {download.error && (
            <p className="text-sm text-red-600">
              {download.error instanceof ApiError ? download.error.message : 'Download failed'}
            </p>
          )}

          {optionsOpen && (
            <div className="mt-4 flex flex-col gap-4 border-t border-ph-charcoal/20 pt-5 text-sm">
              <Option label="Size">
                <div className="flex gap-1.5">
                  {SIZES.map((s) => (
                    <button
                      key={s.px}
                      type="button"
                      onClick={() => set({ size: s.px })}
                      className={cn(
                        'rounded-lg border-[1.5px] px-3 py-1.5',
                        options.size === s.px
                          ? 'border-ph-purple bg-ph-purple/10 text-ph-purple'
                          : 'border-ph-charcoal/20 bg-white',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Option>
              <Option label="Colour">
                <div className="flex items-center gap-2">
                  {FOREGROUNDS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      aria-label={c.label}
                      onClick={() => set({ foreground: c.value })}
                      style={{ backgroundColor: c.value }}
                      className={cn(
                        'h-[30px] w-[30px] rounded-lg border-[1.5px] border-ph-charcoal/20',
                        options.foreground === c.value && 'outline outline-2 outline-offset-2 outline-ph-purple',
                      )}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom colour"
                    value={options.foreground}
                    onChange={(e) => set({ foreground: e.target.value })}
                    className="h-[30px] w-10 cursor-pointer rounded border border-ph-charcoal/20 bg-white"
                  />
                </div>
              </Option>
              <Option label="Background">
                <input
                  type="color"
                  aria-label="Background colour"
                  value={options.background}
                  onChange={(e) => set({ background: e.target.value })}
                  className="h-[30px] w-10 cursor-pointer rounded border border-ph-charcoal/20 bg-white"
                />
              </Option>
              <Option label="Logo in centre">
                <button
                  type="button"
                  role="switch"
                  aria-checked={options.hasLogo}
                  aria-label="Logo in centre"
                  onClick={() => set({ hasLogo: !options.hasLogo })}
                  className={cn(
                    'relative h-[22px] w-10 rounded-full transition-colors',
                    options.hasLogo ? 'bg-ph-purple' : 'bg-ph-charcoal/20',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-[left]',
                      options.hasLogo ? 'left-5' : 'left-0.5',
                    )}
                  />
                </button>
              </Option>
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <button type="button" className={grey} onClick={() => setPastOpen((o) => !o)}>
          {pastOpen ? 'Hide past codes' : 'Past codes'}
        </button>
        {pastOpen && <PastCodes logo={logo} />}
      </div>
      </Card>
    </div>
  );
}

function Option({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="w-28 text-ph-charcoal/60">{label}</span>
      {children}
    </div>
  );
}

function PastCodes({ logo }: { logo: string | null }) {
  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['qr-codes'],
    queryFn: listQrCodes,
  });

  const redownload = async (code: SavedQrCode, format: 'png' | 'svg') => {
    const svg = buildQrSvg(code.url, code, logo);
    if (format === 'svg') downloadSvg(svg, '${qrFilename(code.url)}.svg');
    else await downloadPng(svg, code.size, `${qrFilename(code.url)}.png`);
  };

  if (isLoading) return <p className="mt-4 text-sm text-ph-charcoal/60">Loading...</p>;
  if (codes.length === 0)
    return <p className="mt-4 text-sm text-ph-charcoal/60">No codes yet.</p>;

  return (
    <div className="mt-2 flex flex-col">
      {codes.map((code) => (
        <div
          key={code.id}
          className="flex items-center gap-3.5 border-t border-ph-charcoal/10 py-3.5 first:border-t-0"
        >
          <div className="min-w-0 flex-1">
            <div className="break-all font-mono text-[13px] text-ph-charcoal">{code.url}</div>
            <div className="mt-0.5 text-xs text-ph-charcoal/60">
              {code.size}px{code.hasLogo ? ', logo' : ''} · {code.createdByName},{' '}
              {formatDay(code.createdAt)}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={code.hasLogo && logo === null}
            onClick={() => redownload(code, 'png')}
          >
            PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={code.hasLogo && logo === null}
            onClick={() => redownload(code, 'svg')}
          >
            SVG
          </Button>
        </div>
      ))}
    </div>
  );
}
