import type { SecurityFindingSeverity, SecurityFindingConfidence } from '@/types/security';

export interface SecretRule {
  readonly id: string;
  readonly name: string;
  readonly severity: SecurityFindingSeverity;
  readonly confidence: SecurityFindingConfidence;
  readonly regex: RegExp;
  readonly message: string;
  readonly remediation: string;
}

/**
 * Common false-positive patterns (placeholders, docs, examples).
 */
const FALSE_POSITIVE_PATTERNS = [
  /example/i,
  /placeholder/i,
  /your[_-]?(?:api[_-]?)?(?:key|token|secret)/i,
  /change[_-]?me/i,
  /replace[_-]?me/i,
  /insert[_-]?(?:here|key|token)/i,
  /dummy/i,
  /sample/i,
  /test[_-]?token/i,
  /^x+$/i,
  /0123456789/,
  /abcdef/i,
  /\.{3,}/,
  /<.*>/,
];

export function isLikelyFalsePositive(value: string): boolean {
  if (!value || value.length < 6) return true;
  return FALSE_POSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

export const SECRET_RULES: readonly SecretRule[] = [
  {
    id: 'gitleaks-github-pat',
    name: 'GitHub Personal Access Token',
    severity: 'critical',
    confidence: 'high',
    regex: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})/g,
    message: 'Potential GitHub Personal Access Token detected',
    remediation:
      'Immediately revoke this token in GitHub Settings > Developer settings > Personal access tokens, then invalidate and rotate affected resources.',
  },
  {
    id: 'gitleaks-github-oauth',
    name: 'GitHub OAuth Access Token',
    severity: 'critical',
    confidence: 'high',
    regex: /gho_[a-zA-Z0-9]{36}/g,
    message: 'Potential GitHub OAuth token detected',
    remediation:
      'Revoke the exposed OAuth credential from the associated GitHub Application immediately.',
  },
  {
    id: 'gitleaks-aws-access-key-id',
    name: 'AWS Access Key ID',
    severity: 'critical',
    confidence: 'high',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    message: 'Potential AWS Access Key ID detected',
    remediation:
      'Immediately deactivate and delete this access key in AWS IAM Console, verify CloudTrail logs for unauthorized usage, and provision new credentials using AWS Secrets Manager.',
  },
  {
    id: 'gitleaks-google-api-key',
    name: 'Google / Firebase API Key',
    severity: 'high',
    confidence: 'high',
    regex: /AIza[0-9A-Za-z\\-_]{35}/g,
    message: 'Potential Google Cloud / Firebase API Key detected',
    remediation:
      'Restrict or regenerate the API key in Google Cloud Console > APIs & Services > Credentials, ensuring domain or IP restrictions are enforced.',
  },
  {
    id: 'gitleaks-slack-token',
    name: 'Slack Token',
    severity: 'high',
    confidence: 'high',
    regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
    message: 'Potential Slack API / Bot Token detected',
    remediation:
      'Revoke this token from your Slack App management portal and reinstall the bot with rotated credentials.',
  },
  {
    id: 'gitleaks-stripe-key',
    name: 'Stripe Secret Key',
    severity: 'critical',
    confidence: 'high',
    regex: /[sr]k_live_[0-9a-zA-Z]{24,34}/g,
    message: 'Potential live Stripe API Secret Key detected',
    remediation:
      'Roll this live API key immediately in your Stripe Dashboard > Developers > API keys to prevent unauthorized payment processing.',
  },
  {
    id: 'gitleaks-private-key',
    name: 'Private Key Material',
    severity: 'critical',
    confidence: 'high',
    regex: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----/g,
    message: 'Cryptographic Private Key block detected',
    remediation:
      'Remove the private key file immediately from git history. The corresponding public keys and certificates must be revoked and regenerated.',
  },
  {
    id: 'gitleaks-jwt-token',
    name: 'JSON Web Token (JWT)',
    severity: 'medium',
    confidence: 'medium',
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    message: 'Potential hardcoded JSON Web Token detected',
    remediation:
      'Avoid hardcoding JWT tokens in source code. Issue tokens dynamically from an authentication service with short-lived expiration.',
  },
  {
    id: 'generic-api-key',
    name: 'Hardcoded API Key Pattern',
    severity: 'medium',
    confidence: 'medium',
    regex: /(?:api_key|apikey|secret_key|client_secret)\s*[:=]\s*["']([a-zA-Z0-9_-]{20,80})["']/gi,
    message: 'Potential hardcoded API key or client secret detected',
    remediation:
      'Externalize this secret into an environment variable or secure secrets manager rather than committing it to source control.',
  },
  {
    id: 'generic-password',
    name: 'Hardcoded Password Pattern',
    severity: 'medium',
    confidence: 'low',
    regex: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,64})["']/gi,
    message: 'Suspicious hardcoded password assignment detected',
    remediation:
      'Replace hardcoded passwords with environment configuration or runtime credential injection.',
  },
];
