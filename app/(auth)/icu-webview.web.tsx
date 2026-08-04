/**
 * Web stub for IcuWebViewLogin.
 * Metro bundler automatically uses this file on web instead of icu-webview.tsx.
 * WebView login is native-only — on web the onboarding uses the API key fallback.
 */

export interface IcuLoginResult {
  apiKey: string;
  athleteId: string;
  name?: string;
}

interface Props {
  onSuccess: (result: IcuLoginResult) => void;
  onCancel: () => void;
}

// No-op on web — the Modal is never shown on web anyway
export default function IcuWebViewLogin(_props: Props) {
  return null;
}
