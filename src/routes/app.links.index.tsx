import { useState, type ReactNode } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ApiError } from '@/api/client';
import {
  createLink,
  listJobClients,
  listLinks,
  setLinkContent,
  type TrackedLink,
} from '@/api/links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/links/CopyButton';
import {
  MEDIUMS,
  SOURCES,
  hasUtmParams,
  jobPrefix,
  parseWebAddress,
  slugify,
  withChoicesUsed,
  type Choice,
} from '@/lib/utm';

interface BuilderSearch {
  dest?: string;
  campaign?: string;
}

export const Route = createFileRoute('/app/links/')({
  validateSearch: (search: Record<string, unknown>): BuilderSearch => ({
    dest: typeof search.dest === 'string' ? search.dest : undefined,
    campaign: typeof search.campaign === 'string' ? search.campaign : undefined,
  }),
  component: BuilderPage,
});

const bigInput =
  'w-full border-0 border-b-2 border-ph-charcoal/20 bg-transparent py-2.5 font-mono text-xl text-ph-charcoal placeholder:text-ph-charcoal/40 focus:border-ph-purple focus:outline-none';

function BuilderPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(search.dest && search.campaign ? 3 : 1);
  const [dest, setDest] = useState(search.dest ?? '');
  const [campaign, setCampaign] = useState(search.campaign ?? '');
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [link, setLink] = useState<TrackedLink | null>(null);

  const { data: links = [] } = useQuery({ queryKey: ['links'], queryFn: listLinks });
  const { data: jobClients = [] } = useQuery({
    queryKey: ['job-clients'],
    queryFn: listJobClients,
    staleTime: 60 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: createLink,
    onSuccess: (created) => {
      setLink(created);
      queryClient.invalidateQueries({ queryKey: ['links'] });
    },
  });

  const destUrl = parseWebAddress(dest);
  const campaignSlug = slugify(campaign);
  const campaignOk = campaignSlug.length >= 3;
  const prefix = jobPrefix(campaignSlug);
  const client = prefix ? jobClients.find((c) => c.prefix === prefix)?.name : undefined;

  const reset = () => {
    setDest('');
    setCampaign('');
    setSource('');
    setMedium('');
    setLink(null);
    create.reset();
    setStep(1);
  };

  if (link) {
    return (
      <Done
        link={link}
        onChange={(updated) => {
          setLink(updated);
          queryClient.invalidateQueries({ queryKey: ['links'] });
        }}
        onQr={() => navigate({ to: '/app/qr', search: { url: link.url } })}
        onAgain={reset}
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn('h-1 w-7 rounded-full', n <= step ? 'bg-ph-purple' : 'bg-ph-charcoal/20')}
          />
        ))}
      </div>

      {step === 1 && (
        <Step
          question="Where should it send people?"
          why="Paste the page they should land on."
          canNext={destUrl !== null}
          onNext={() => setStep(2)}
        >
          <input
            autoFocus
            className={bigInput}
            placeholder="https://"
            autoComplete="off"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && destUrl && setStep(2)}
          />
          <Status tone={!dest.trim() ? 'idle' : destUrl ? 'ok' : 'bad'}>
            {!dest.trim()
              ? ''
              : !destUrl
                ? "That doesn't look like a web address"
                : hasUtmParams(destUrl)
                  ? 'This link already has tracking on it. It will be replaced.'
                  : 'Looks good'}
          </Status>
        </Step>
      )}

      {step === 2 && (
        <Step
          question="Enter a campaign id"
          why="Use the job number from Trello, or if you have a special campaign id use that instead."
          canNext={campaignOk}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        >
          <input
            autoFocus
            className={bigInput}
            placeholder="CAPH0118"
            maxLength={40}
            autoComplete="off"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && campaignOk && setStep(3)}
          />
          <Status tone={campaignOk ? 'ok' : 'idle'}>
            {!campaign.trim()
              ? ''
              : !campaignOk
                ? 'A bit longer'
                : client
                  ? client
                  : prefix
                    ? `No client found for ${prefix}, saved as a campaign id`
                    : `Saved as ${campaignSlug}`}
          </Status>
        </Step>
      )}

      {step === 3 && (
        <Step
          question="Who is sending the traffic?"
          why="The publisher or platform the link will sit on."
          canNext={source !== ''}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        >
          <Choices
            choices={withChoicesUsed(SOURCES, links.map((l) => l.source))}
            value={source}
            onChange={setSource}
          />
        </Step>
      )}

      {step === 4 && (
        <Step
          question="How will people get to it?"
          why="The kind of placement the link lives in."
          nextLabel="Make the link"
          canNext={medium !== '' && !create.isPending}
          onNext={() =>
            create.mutate({ destinationUrl: dest.trim(), campaignId: campaignSlug, source, medium })
          }
          onBack={() => setStep(3)}
        >
          <Choices
            choices={withChoicesUsed(MEDIUMS, links.map((l) => l.medium))}
            value={medium}
            onChange={setMedium}
          />
          {create.error && (
            <p className="mb-6 text-sm text-red-600">
              {create.error instanceof ApiError ? create.error.message : 'Could not save the link'}
            </p>
          )}
        </Step>
      )}
    </div>
  );
}

function Step({
  question,
  why,
  canNext,
  nextLabel = 'Next',
  onNext,
  onBack,
  children,
}: {
  question: string;
  why: string;
  canNext: boolean;
  nextLabel?: string;
  onNext: () => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold leading-tight text-ph-charcoal">{question}</h2>
      <p className="mb-6 mt-1.5 text-[15px] text-ph-charcoal/60">{why}</p>
      {children}
      <div className="flex items-center gap-4">
        <Button type="button" size="lg" disabled={!canNext} onClick={onNext}>
          {nextLabel}
        </Button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-charcoal"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}

function Status({ tone, children }: { tone: 'idle' | 'ok' | 'bad'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mb-6 mt-2 min-h-6 text-sm',
        tone === 'ok' && 'text-green-700',
        tone === 'bad' && 'text-red-600',
        tone === 'idle' && 'text-ph-charcoal/60',
      )}
    >
      {children}
    </div>
  );
}

function Choices({
  choices,
  value,
  onChange,
}: {
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
}) {
  const isOther = value !== '' && !choices.some((c) => c.value === value);
  const [otherOpen, setOtherOpen] = useState(isOther);
  const [otherText, setOtherText] = useState(isOther ? value : '');

  const chip = 'rounded-lg border-[1.5px] px-4 py-2.5 text-base font-semibold transition-colors';
  const on = 'border-ph-purple bg-ph-purple/10 text-ph-purple';
  const off = 'border-ph-charcoal/20 bg-white text-ph-charcoal hover:border-ph-purple';

  return (
    <div className="mb-7">
      <div className="flex flex-wrap gap-2.5">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            className={cn(chip, !otherOpen && value === c.value ? on : off)}
            onClick={() => {
              setOtherOpen(false);
              onChange(c.value);
            }}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            chip,
            'border-dashed font-normal',
            otherOpen ? on : 'border-ph-charcoal/20 text-ph-charcoal/60 hover:border-ph-purple',
          )}
          onClick={() => {
            setOtherOpen(true);
            onChange(slugify(otherText));
          }}
        >
          Something else
        </button>
      </div>
      {otherOpen && (
        <div className="mt-4 max-w-xs">
          <Input
            autoFocus
            placeholder="One or two words"
            maxLength={50}
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              onChange(slugify(e.target.value));
            }}
          />
          {value && <p className="mt-1.5 text-xs text-ph-charcoal/60">Saved as {value}</p>}
        </div>
      )}
    </div>
  );
}

function Done({
  link,
  onChange,
  onQr,
  onAgain,
}: {
  link: TrackedLink;
  onChange: (link: TrackedLink) => void;
  onQr: () => void;
  onAgain: () => void;
}) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tag, setTag] = useState(link.content ?? '');

  const saveTag = useMutation({
    mutationFn: () => setLinkContent(link.id, tag),
    onSuccess: (updated) => {
      onChange(updated);
      setTagOpen(false);
    },
  });

  const utmAt = link.url.indexOf('utm_source=');
  const head = link.url.slice(0, utmAt - 1);
  const params = link.url.slice(utmAt).split('&');
  const grey = 'text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-charcoal';

  return (
    <div>
      <h2 className="text-2xl font-bold leading-tight text-ph-charcoal">Here's your link</h2>
      <p className="mb-6 mt-1.5 text-[15px] text-ph-charcoal/60">
        Saved to past links under <b>{link.campaignId}</b>
        {link.clientName ? ` (${link.clientName})` : ''}.
      </p>

      <div className="mb-5 break-all rounded-lg bg-ph-purple/[0.07] px-5 py-4 font-mono text-[15px] leading-7">
        {head}
        {params.map((p, i) => {
          const eq = p.indexOf('=');
          return (
            <span key={p}>
              <br />
              {i === 0 ? link.url[utmAt - 1] : '&'}
              {p.slice(0, eq + 1)}
              <b className="font-semibold text-ph-purple">{p.slice(eq + 1)}</b>
            </span>
          );
        })}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2.5">
        <CopyButton text={link.url} label="Copy link" size="lg" />
        <Button type="button" variant="outline" size="lg" onClick={onQr}>
          Make a QR code
        </Button>
      </div>

      {tagOpen && (
        <div className="mb-6">
          <div className="flex max-w-sm items-center gap-2">
            <Input
              autoFocus
              placeholder="e.g. hero-button or footer-link"
              maxLength={50}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTag.mutate()}
            />
            <Button type="button" disabled={saveTag.isPending} onClick={() => saveTag.mutate()}>
              Save
            </Button>
          </div>
          {saveTag.error && (
            <p className="mt-1.5 text-xs text-red-600">
              {saveTag.error instanceof ApiError ? saveTag.error.message : 'Could not save the tag'}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <button type="button" className={grey} onClick={onAgain}>
          Make another
        </button>
        {!tagOpen && (
          <button type="button" className={grey} onClick={() => setTagOpen(true)}>
            {link.content ? 'Change the tag' : 'Add a tag to tell two placements apart'}
          </button>
        )}
      </div>
    </div>
  );
}
