/** Never authenticate privileged jobs when CRON_SECRET is missing or blank. */
export function isValidCronAuthorization(authorization: string | null, secret: string | undefined): boolean {
  return typeof secret === 'string' && secret.trim().length > 0 && authorization === `Bearer ${secret}`
}
