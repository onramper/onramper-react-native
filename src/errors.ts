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
  // JS-only codes
  | 'platformUnsupported'
  | 'intentInvalidated'
  | 'intentAlreadyConsumed'
  | 'clientAlreadyConfigured'
  | 'sessionExpirationHandlerFailed';

export interface OnramperErrorPayload {
  code: OnramperErrorCode;
  message: string;
  info?: Record<string, unknown>;
}

export class OnramperError extends Error implements OnramperErrorPayload {
  readonly code: OnramperErrorCode;
  readonly info?: Record<string, unknown>;

  constructor(payload: OnramperErrorPayload) {
    super(payload.message);
    this.name = 'OnramperError';
    this.code = payload.code;
    this.info = payload.info;
  }

  static from(value: unknown): OnramperError {
    if (value instanceof OnramperError) return value;
    if (value && typeof value === 'object') {
      // Structured errors (from the `.failed` state) arrive as a plain
      // `{ code, message, info? }` object. Thrown promise rejections surface
      // as a JS Error with just a message; we default the code in that case
      // (the structured error is also available on `client.state` / lastError).
      const v = value as { code?: string; message?: string; info?: Record<string, unknown> };
      return new OnramperError({
        code: (v.code ?? 'unrecoverable') as OnramperErrorCode,
        message: v.message ?? 'Unknown error',
        info: v.info,
      });
    }
    return new OnramperError({ code: 'unrecoverable', message: String(value) });
  }
}
