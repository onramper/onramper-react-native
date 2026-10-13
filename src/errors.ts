export type OnramperErrorCode =
  // Mirrors Sources/OnramperSDK/Errors/OnramperError.swift cases
  | 'notInitialized'
  | 'initializationFailed'
  | 'attestationFailed'
  | 'invalidStateTransition'
  | 'invalidState'
  | 'networkError'
  | 'decodingError'
  | 'timeout'
  | 'paymentFailed'
  | 'providerFailed'
  | 'applePayNotConfigured'
  | 'requirementNotSatisfied'
  | 'amountOutOfRange'
  | 'oidcFlowCancelled'
  | 'oidcTokenExchangeFailed'
  | 'oidcFlowFailed'
  | 'userTokenInvalid'
  | 'userTokenRefreshFailed'
  | 'webviewLoadFailed'
  | 'deepLinkFailed'
  | 'invalidRequest'
  | 'quoteUnavailable'
  | 'checkoutForbidden'
  | 'temporaryFailure'
  | 'unrecoverable'
  | 'configurationError'
  | 'deviceBlocked'
  | 'securityStorageFailed'
  | 'securityTrustFailed'
  // Wrapper lifecycle and platform codes
  | 'platformUnsupported'
  | 'intentInvalidated'
  | 'intentAlreadyConsumed'
  | 'clientAlreadyConfigured'
  | 'clientDestroyed'
  | 'sessionExpirationHandlerFailed';

export interface OnramperErrorPayload {
  code: OnramperErrorCode;
  message: string;
  /** Customer-facing SDK copy; optional for backwards-compatible payload construction. */
  userMessage?: string;
  supportCode?: string;
  info?: Record<string, unknown>;
}

export class OnramperError extends Error implements OnramperErrorPayload {
  readonly code: OnramperErrorCode;
  readonly userMessage: string;
  readonly supportCode: string;
  readonly info?: Record<string, unknown>;

  constructor(payload: OnramperErrorPayload) {
    super(payload.message);
    this.name = 'OnramperError';
    this.code = payload.code;
    this.userMessage = payload.userMessage ?? 'Something went wrong. Please try again.';
    this.supportCode = payload.supportCode ?? payload.code;
    this.info = payload.info;
  }

  static from(value: unknown): OnramperError {
    if (value instanceof OnramperError) return value;
    // Nitro transports Swift exceptions as message-only JS Errors. Our native
    // bridge encodes SDK errors explicitly so Promise rejections retain the
    // same fields as failed events, without consulting unrelated client state.
    const message = value instanceof Error ? value.message : typeof value === 'string' ? value : undefined;
    if (message?.startsWith('ONRAMPER_ERROR:')) {
      try {
        const payload = JSON.parse(message.slice('ONRAMPER_ERROR:'.length));
        if (payload && typeof payload.code === 'string' && typeof payload.message === 'string') {
          return OnramperError.from(payload);
        }
      } catch {
        // A malformed/non-SDK error falls back to the ordinary error path.
      }
    }
    if (value && typeof value === 'object') {
      const v = value as Partial<OnramperErrorPayload>;
      return new OnramperError({
        code: (v.code ?? 'unrecoverable') as OnramperErrorCode,
        message: v.message ?? 'Unknown error',
        info: v.info,
        userMessage: typeof v.userMessage === 'string' ? v.userMessage : undefined,
        supportCode: typeof v.supportCode === 'string' ? v.supportCode : undefined,
      });
    }
    return new OnramperError({ code: 'unrecoverable', message: String(value) });
  }
}
