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
      const rawMessage = v.message ?? 'Unknown error';

      // The native bridge folds structured detail into the message as
      // `... [info: {<json>}]` (Expo SDK 56 JavaScriptThrowable only bridges
      // `message` + `code`, not NSError.userInfo). Recover it here so
      // consumers can read `err.info.debugInfo` etc. without parsing.
      let info = v.info ?? v.userInfo;
      let message = rawMessage;
      const infoMatch = rawMessage.match(/^(.*) \[info: (\{.*\})\]$/s);
      if (infoMatch) {
        message = infoMatch[1] ?? rawMessage;
        try {
          info = JSON.parse(infoMatch[2] ?? '{}');
        } catch {
          // Fall through with the original message if the suffix isn't valid JSON.
        }
      }

      return new OnramperError({ code, message, info });
    }
    return new OnramperError({ code: 'unrecoverable', message: String(value) });
  }
}
