import Foundation
import OnramperSDK

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
            var info: [String: Any] = ["code": err.jsCode, "message": err.errorDescription ?? ""]
            if let extra = err.jsInfo { info["info"] = extra }
            return ["type": "failed", "error": info]
        case .checkoutCancelled:
            return ["type": "cancelled"]
        }
    }
}
