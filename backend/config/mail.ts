import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: 'smtp',
  from: {
    address: env.get('SMTP_USERNAME') || '',
    name: 'NexQuery AI',
  },

  /**
   * The mailers object can be used to configure multiple mailers
   * each using a different transport or same transport with different
   * options.
   */
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
      secure: env.get('SMTP_PORT') === 465,
      auth: env.get('SMTP_USERNAME')
        ? {
          type: 'login',
          user: env.get('SMTP_USERNAME')!,
          pass: env.get('SMTP_PASSWORD') || '',
        }
        : undefined,
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> { }
}
