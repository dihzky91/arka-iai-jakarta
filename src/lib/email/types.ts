export type EmailPayload = {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: {
    contentType: string;
    filename: string;
    base64Content: string;
  }[];
};

export type EmailProviderType = "mailjet" | "brevo";
