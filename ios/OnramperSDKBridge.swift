import Foundation
import OnramperSDK

// Maps the SDK's non-Codable Swift enums (OnramperState, CheckoutEvent) and
// OnramperError into JS-friendly dictionaries, then to JSON strings for the
// Nitro bridge. This is SDK-shape mapping, not Expo-specific — it has no
// dependency on any bridging framework.

// MARK: - Error → code / structured info

extension OnramperError {
  var jsCode: String {
    switch self {
    case .notInitialized: return "notInitialized"
    case .initializationFailed: return "initializationFailed"
    case .attestationFailed: return "attestationFailed"
    case .invalidStateTransition: return "invalidStateTransition"
    case .invalidState: return "invalidState"
    case .networkError: return "networkError"
    case .decodingError: return "decodingError"
    case .timeout: return "timeout"
    case .requirementNotSatisfied: return "requirementNotSatisfied"
    case .amountOutOfRange: return "amountOutOfRange"
    case .oidcFlowCancelled: return "oidcFlowCancelled"
    case .oidcTokenExchangeFailed: return "oidcTokenExchangeFailed"
    case .oidcFlowFailed: return "oidcFlowFailed"
    case .userTokenInvalid: return "userTokenInvalid"
    case .userTokenRefreshFailed: return "userTokenRefreshFailed"
    case .webviewLoadFailed: return "webviewLoadFailed"
    case .deepLinkFailed: return "deepLinkFailed"
    case .invalidRequest: return "invalidRequest"
    case .quoteUnavailable: return "quoteUnavailable"
    case .checkoutForbidden: return "checkoutForbidden"
    case .temporaryFailure: return "temporaryFailure"
    case .unrecoverable: return "unrecoverable"
    case .configurationError: return "configurationError"
    case .deviceBlocked: return "deviceBlocked"
    case .securityStorageFailed: return "securityStorageFailed"
    }
  }

  var jsInfo: [String: Any]? {
    switch self {
    case .amountOutOfRange(let min, let max):
      return ["min": min, "max": max]
    case .networkError(let code, _):
      return ["status": code]
    case .securityStorageFailed(let status):
      return ["status": Int(status)]
    case .invalidStateTransition(let from, let to):
      return ["from": from, "to": to]
    case .invalidState(let expected, let actual):
      return ["expected": expected, "actual": actual]
    case .invalidRequest(let field, let debugInfo):
      var info: [String: Any] = [:]
      if let field { info["field"] = field }
      if let debugInfo { info["debugInfo"] = debugInfo }
      return info.isEmpty ? nil : info
    case .temporaryFailure(let retryAfter, let debugInfo):
      var info: [String: Any] = [:]
      if let retryAfter { info["retryAfter"] = retryAfter }
      if let debugInfo { info["debugInfo"] = debugInfo }
      return info.isEmpty ? nil : info
    case .quoteUnavailable(let debugInfo),
         .checkoutForbidden(let debugInfo),
         .unrecoverable(let debugInfo):
      return debugInfo.map { ["debugInfo": $0] }
    default:
      return nil
    }
  }

  /// A JS-friendly error dict: `{ code, message, info? }`.
  func toJSDict() -> [String: Any] {
    var dict: [String: Any] = ["code": jsCode, "message": errorDescription ?? "Unknown error"]
    if let info = jsInfo { dict["info"] = info }
    return dict
  }
}

// MARK: - Enum raw values

extension RenderType {
  var jsValue: String { rawValue } // "webview" | "deeplink"
}

extension CheckoutPaymentType {
  var jsValue: String { rawValue } // "applepay" | "revolutpay"
}

// MARK: - State → dict

extension OnramperState {
  func toJSDict() -> [String: Any] {
    switch self {
    case .idle: return ["kind": "idle"]
    case .initializing: return ["kind": "initializing"]
    case .ready: return ["kind": "ready"]
    case .checkoutPreparing: return ["kind": "checkoutPreparing"]
    case .requireLogin(let requirements):
      return ["kind": "requireLogin", "requirements": codableToJSArray(requirements)]
    case .authenticating: return ["kind": "authenticating"]
    case .readyToCheckout: return ["kind": "readyToCheckout"]
    case .finalizing: return ["kind": "finalizing"]
    case .rendering(let ctx):
      return [
        "kind": "rendering",
        "url": ctx.url.absoluteString,
        "renderType": ctx.renderType.jsValue,
        "paymentType": ctx.paymentType.jsValue,
      ]
    case .completed: return ["kind": "completed"]
    case .failed(let error):
      return ["kind": "failed", "error": error.toJSDict()]
    }
  }
}

// MARK: - Event → dict

extension CheckoutEvent {
  func toJSDict() -> [String: Any] {
    switch self {
    case .stateChanged(let state):
      return ["type": "stateChanged", "state": state.toJSDict()]
    case .checkoutStarted(let intentId):
      return ["type": "checkoutStarted", "intentId": intentId]
    case .loginRequired(let requirements):
      return ["type": "loginRequired", "requirements": codableToJSArray(requirements)]
    case .readyToCheckout:
      return ["type": "readyToCheckout"]
    case .requirementSatisfied(let kind):
      return ["type": "requirementSatisfied", "requirementType": kind.rawValue]
    case .checkoutFinalized(let response):
      return ["type": "checkoutFinalized", "response": codableToJSValue(response)]
    case .renderingStarted(let url, let renderType):
      return ["type": "renderingStarted", "url": url.absoluteString, "renderType": renderType.jsValue]
    case .completed(let checkoutId):
      return ["type": "completed", "checkoutId": checkoutId]
    case .failed(let err):
      return ["type": "failed", "error": err.toJSDict()]
    case .checkoutCancelled:
      return ["type": "cancelled"]
    }
  }
}

// MARK: - Codable → JS value / JSON string

func codableToJSValue<T: Codable>(_ value: T) -> Any {
  guard let data = try? JSONEncoder().encode(value),
        let obj = try? JSONSerialization.jsonObject(with: data) else {
    return [:]
  }
  return obj
}

func codableToJSArray<T: Codable>(_ values: [T]) -> [Any] {
  (codableToJSValue(values) as? [Any]) ?? []
}

/// Serializes a JS-friendly dict to a JSON string for transport across the
/// Nitro callback boundary. Returns "{}" on failure (should not happen for the
/// fixed-shape dicts produced above).
func jsonString(_ dict: [String: Any]) -> String {
  guard let data = try? JSONSerialization.data(withJSONObject: dict),
        let str = String(data: data, encoding: .utf8) else {
    return "{}"
  }
  return str
}
