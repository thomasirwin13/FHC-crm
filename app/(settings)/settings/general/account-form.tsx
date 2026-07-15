'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { updateAccount } from '@/app/(login)/actions';
import { User } from '@/lib/db/schema';
import useSWR from 'swr';
import { Suspense } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormFieldsProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
};

function AccountFormFields({
  state,
  nameValue = '',
  emailValue = ''
}: AccountFormFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor="name" className="block mb-2 text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          name="name"
          placeholder="Enter your name"
          defaultValue={state.name || nameValue}
          required
          className="w-full px-3 py-2 border border-border bg-background rounded text-sm transition-colors duration-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor="email" className="block mb-2 text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          defaultValue={emailValue}
          required
          className="w-full px-3 py-2 border border-border bg-background rounded text-sm transition-colors duration-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
    </>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  return (
    <AccountFormFields
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
    />
  );
}

export default function AccountForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-5 text-foreground">Account information</h2>
      <form className="space-y-6" action={formAction}>
        <Suspense fallback={<AccountFormFields state={state} />}>
          <AccountFormWithData state={state} />
        </Suspense>
        {state.error && (
          <p className="text-destructive text-sm">{state.error}</p>
        )}
        {state.success && (
          <p className="text-green-600 text-sm">{state.success}</p>
        )}
        <button
          type="submit"
          className="bg-primary text-primary-foreground border-none px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save changes'
          )}
        </button>
      </form>
    </div>
  );
}
