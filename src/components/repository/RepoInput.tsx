import React, { useState } from 'react';
import { Search, GitBranch, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseGitHubRepoUrl } from '@/lib/github/parse-repo-url';
import type { ParseRepoResult } from '@/types/repository';

export function RepoInput() {
  const [inputVal, setInputVal] = useState('');
  const [validationResult, setValidationResult] = useState<ParseRepoResult | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    const result = parseGitHubRepoUrl(inputVal);
    setValidationResult(result);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (hasSubmitted) {
      setValidationResult(parseGitHubRepoUrl(val));
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        action="javascript:void(0);"
        data-hydrated={isHydrated ? 'true' : 'false'}
        className="relative"
      >
        <div className="relative flex items-center rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xl transition-all focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20">
          <div className="flex items-center pr-2 pl-3.5 text-neutral-500">
            <GitBranch className="h-4 w-4" />
          </div>

          <input
            type="text"
            value={inputVal}
            onChange={handleChange}
            placeholder="github.com/owner/repository or owner/repository"
            className="w-full bg-transparent py-3.5 pr-28 font-mono text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
            aria-label="GitHub Repository URL"
            autoComplete="off"
            spellCheck="false"
          />

          <button
            type="submit"
            className="absolute right-1.5 flex items-center gap-1.5 rounded-md border border-neutral-700/60 bg-neutral-800 px-3.5 py-2 font-mono text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
          >
            <span>Inspect</span>
            <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
          </button>
        </div>
      </form>

      {/* Validation / Status display */}
      <div className="mt-3 min-h-[48px]">
        {hasSubmitted && validationResult && (
          <div>
            {validationResult.success ? (
              <div className="rounded-md border border-neutral-800/80 bg-neutral-900/40 p-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">Valid repository target:</span>
                    <span className="text-neutral-200">
                      {validationResult.data.owner}/{validationResult.data.repo}
                    </span>
                  </div>
                  <a
                    href={validationResult.data.gitkitRoute}
                    className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/30"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-red-950/60 bg-red-950/20 p-3 font-mono text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{validationResult.error}</span>
              </div>
            )}
          </div>
        )}

        {!hasSubmitted && (
          <div className="flex items-center justify-between px-1 font-mono text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              <span>Examples: withastro/astro, astral-sh/uv, facebook/react</span>
            </span>
            <span className="text-neutral-500">Public repos</span>
          </div>
        )}
      </div>
    </div>
  );
}
