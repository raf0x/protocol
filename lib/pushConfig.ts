import 'server-only'

type PushClient = { setVapidDetails(subject: string, publicKey: string, privateKey: string): void }

export type PushConfiguration =
  | { ok: true; subject: string; publicKey: string; privateKey: string }
  | { ok: false; message: string }

export function readPushConfiguration(env: NodeJS.ProcessEnv = process.env): PushConfiguration {
  const subject = env.VAPID_EMAIL?.trim() || ''
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || ''
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() || ''
  if (!subject || !publicKey || !privateKey) return { ok: false, message: 'Push notifications are not configured.' }
  if (!/^(mailto:|https?:\/\/)/i.test(subject)) return { ok: false, message: 'Push notification contact is invalid.' }
  return { ok: true, subject, publicKey, privateKey }
}

export function configureWebPush(client: PushClient, env: NodeJS.ProcessEnv = process.env): PushConfiguration {
  const config = readPushConfiguration(env)
  if (!config.ok) return config
  client.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  return config
}
