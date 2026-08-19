// `qrcode` ships no types and no `@types/qrcode` package exists in this
// workspace's registry policy — a minimal ambient shim for the two functions
// QrCode.vue actually calls, rather than adding a dependency for it.
declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    margin?: number
    width?: number
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>
}
