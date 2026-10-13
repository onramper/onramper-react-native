import Foundation
import NitroModules
import OnramperSDK

/// The SDK can emit records from any thread. Keep callback registration and
/// teardown synchronized; invoke outside the lock (Nitro schedules delivery).
final class SDKLogRelay: @unchecked Sendable {
  private let lock = NSLock()
  private var listener: ((String) -> Void)?

  func setListener(_ listener: ((String) -> Void)?) {
    lock.lock()
    self.listener = listener
    lock.unlock()
  }

  func emit(_ record: OnramperLogRecord) {
    lock.lock()
    let callback = listener
    lock.unlock()
    guard let callback else { return }
    callback(jsonString([
      "timestamp": record.timestamp.timeIntervalSince1970 * 1000,
      "level": String(describing: record.level),
      "category": record.category,
      "event": record.event,
      "context": record.context,
      "message": record.message,
    ]))
  }
}

/// Nitro otherwise converts a Swift error to a message-only JavaScript Error.
/// Both failed events and rejected operations must carry the SDK's safe copy.
func bridgeSDKError(_ error: Error) -> Error {
  guard let sdkError = error as? OnramperError else { return error }
  return RuntimeError.error(withMessage: "ONRAMPER_ERROR:" + jsonString(sdkError.toJSDict()))
}
