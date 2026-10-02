import { useEffect, useState, type ReactNode } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ApiError } from '@/api/client';
import {
  checkUrl,
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
  const destHref = destUrl?.href ?? '';
  const [settledDest, setSettledDest] = useState(destHref);
  useEffect(() => {
    const timer = setTimeout(() => setSettledDest(destHref), 600);
    return () => clearTimeout(timer);
  }, [destHref]);
  const pageCheck = useQuery({
    queryKey: ['url-check', settledDest],
    queryFn: () => checkUrl(settledDest),
    enabled: settledDest !== '',
    staleTime: Infinity,
    retry: false,
  });
  const checking = destHref !== '' && (destHref !== settledDest || pageCheck.isPending);
  const pageMissing = !checking && pageCheck.data?.found === false;
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
          <Status
            tone={!dest.trim() || checking ? 'idle' : !destUrl ? 'bad' : pageMissing ? 'warn' : 'ok'}
          >
            {!dest.trim()
              ? ''
              : !destUrl
                ? "That doesn't look like a web address"
                : checking
                  ? 'Checking the page...'
                  : pageMissing
                    ? `We couldn't open that page${pageCheck.data?.statusCode ? ` (error ${pageCheck.data.statusCode})` : ''}. Check the address, or carry on if you're sure it's right.`
                    : pageCheck.isError
                      ? 'Looks like a web address. The page check is unavailable right now.'
                      : hasUtmParams(destUrl)
                        ? 'Page found. It already has tracking on it, which will be replaced.'
                        : 'Page found'}
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
          help={
            <>
              The campaign id is how Google Analytics groups every link for one job. Use the Trello
              job number so all of a job's links report together. Type it the same way every time.
              It is saved in lower case with hyphens instead of spaces.
            </>
          }
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
          help={
            <>
              The source is who is sending the traffic: the publisher or platform, not the kind of
              placement. An eDM sent by a publisher uses that publisher as the source. Something we
              send or post ourselves uses Panwar Health or the social platform. Pick from the list
              where you can so the same publisher is always spelt the same way.
            </>
          }
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
          help={
            <>
              The medium is the kind of placement, whoever the publisher is: an eDM is Email, a
              printed or on-screen code is QR code, an organic or paid post is Social post. One
              link per placement. If the same page is promoted by email and by QR code, make two
              links.
            </>
          }
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
  help,
  children,
}: {
  question: string;
  why: string;
  canNext: boolean;
  nextLabel?: string;
  onNext: () => void;
  onBack?: () => void;
  help?: ReactNode;
  children: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
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
        {help && (
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-charcoal"
          >
            How we name these
          </button>
        )}
      </div>
      {help && helpOpen && (
        <p className="mt-5 rounded-lg bg-ph-charcoal/5 px-4 py-3 text-sm leading-relaxed text-ph-charcoal/80">
          {help}
        </p>
      )}
    </div>
  );
}

function Status({
  tone,
  children,
}: {
  tone: 'idle' | 'ok' | 'warn' | 'bad';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-6 mt-2 min-h-6 text-sm',
        tone === 'ok' && 'text-green-700',
        tone === 'warn' && 'text-orange-800',
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
