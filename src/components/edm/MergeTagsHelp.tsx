import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

const TAGS = [
  { tag: '{{first_name}}', mailchimp: '*|FNAME|*', becomes: 'Their first name, e.g. Sarah' },
  { tag: '{{last_name}}', mailchimp: '*|LNAME|*', becomes: 'Their last name, e.g. Nguyen' },
  { tag: '{{email}}', mailchimp: '*|EMAIL|*', becomes: 'Their email address' },
  {
    tag: '{{unsubscribe_url}}',
    mailchimp: '*|UNSUB|*',
    becomes: 'Their one-click unsubscribe link (eDM body only)',
  },
];

/** "Personalisation tags" link that opens a cheat sheet of the merge tags the send supports. */
export function MergeTagsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-ph-purple"
      >
        <CircleHelp className="h-3.5 w-3.5" />
        Personalisation tags
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Personalisation tags"
        className="max-w-xl"
      >
        <div className="flex flex-col gap-5 p-6 text-sm text-ph-charcoal">
          <p>
            Put a tag in the subject line or the eDM and each person gets their own details swapped
            in when it sends.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-ph-charcoal/60">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Tag</th>
                  <th className="pb-2 font-medium">Becomes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ph-charcoal/10">
                {TAGS.map((t) => (
                  <tr key={t.tag}>
                    <td className="py-2 pr-4 align-top">
                      <code className="whitespace-nowrap text-xs">{t.tag}</code>
                    </td>
                    <td className="py-2">{t.becomes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold">Fallbacks</h3>
            <p className="mt-1">
              Some people don't have a name on file. Add <code className="text-xs">|</code> and a
              word to use instead, otherwise the tag comes out blank.
            </p>
            <ul className="mt-2 flex flex-col gap-1 rounded-md bg-ph-charcoal/5 px-4 py-3">
              <li>
                <code className="text-xs">Hi {'{{first_name|there}}'},</code> → "Hi Sarah," or "Hi
                there,"
              </li>
              <li>
                <code className="text-xs">Dear {'{{first_name|Doctor}}'}</code> → "Dear Sarah" or
                "Dear Doctor"
              </li>
              <li>
                <code className="text-xs">Hi {'{{first_name}}'},</code> → "Hi Sarah," or "Hi ,"
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Good to know</h3>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
              <li>Tags don't work in the preview text.</li>
              <li>
                If the eDM has no <code className="text-xs">{'{{unsubscribe_url}}'}</code>, an
                unsubscribe footer is added for you.
              </li>
              <li>
                Older Mailchimp builds work as is:{' '}
                {TAGS.map((t, i) => (
                  <span key={t.mailchimp}>
                    {i > 0 && ', '}
                    <code className="text-xs">{t.mailchimp}</code>
                  </span>
                ))}
                . They can't have a fallback.
              </li>
              <li>
                Test sends use your details if you're on the list, otherwise your first name from
                the portal.
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
