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
      const v = value as {
        code?: string;
        message?: string;
        userInfo?: Record<string, unknown>;
        info?: Record<string, unknown>;
      };
      const code = (v.code ?? 'unrecoverable') as OnramperErrorCode;
      const message = v.message ?? 'Unknown error';
      const info = v.info ?? v.userInfo;
      return new OnramperError({ code, message, info });
    }
    return new OnramperError({ code: 'unrecoverable', message: String(value) });
  }
}
