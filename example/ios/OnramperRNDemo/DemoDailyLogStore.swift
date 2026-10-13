import Foundation

/// Demo-owned daily files, following demo-ios/SDKLogStore. No SDK or RN dependency:
/// records arrive through the public logHandler; every disk operation is serialized.
@objc(DemoDailyLogStore)
final class DemoDailyLogStore: NSObject {
  // Shared by all stores in this process, including React Native bridge reloads.
  // A new process can scavenge old exports without touching a live share here.
  private static let exportSession = UUID().uuidString
  private let queue = DispatchQueue(label: "com.onramper.rn.daily-logs")
  private let directory: URL
  private let temporaryDirectory: URL
  private let metadata: [String: String]
  private let now: () -> Date
  private let maxTotalBytes: Int
  private let maxAge: TimeInterval = 7 * 24 * 60 * 60
  private let maxExportAge: TimeInterval = 24 * 60 * 60
  private var wroteLaunchHeader = false
  private let formatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter
  }()

  @objc(initWithMetadata:)
  convenience init(metadata: [String: String]) {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    self.init(directory: base.appendingPathComponent("Logs", isDirectory: true), metadata: metadata)
  }

  // Directory/clock/limit injection also lets the Foundation-only regression tests
  // exercise rollover, retention and export without a device or SDK credentials.
  init(directory: URL, metadata: [String: String], maxTotalBytes: Int = 5 * 1024 * 1024,
       temporaryDirectory: URL = FileManager.default.temporaryDirectory,
       now: @escaping () -> Date = Date.init) {
    self.directory = directory
    self.temporaryDirectory = temporaryDirectory
    self.metadata = metadata
    self.maxTotalBytes = maxTotalBytes
    self.now = now
    super.init()
    queue.async { self.scavengeExportsLocked() }
  }

  @objc(appendRecord:)
  func appendRecord(_ json: String) {
    guard json.utf8.count <= 64 * 1024 else { return }
    queue.async {
      guard let data = json.data(using: .utf8),
            let record = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
            let timestamp = record["timestamp"] as? Double, timestamp.isFinite,
            timestamp >= 0, timestamp < 253_402_300_800_000,
            let level = record["level"] as? String, ["info", "debug", "error"].contains(level),
            let category = record["category"] as? String,
            let message = record["message"] as? String else { return }
      do {
        try self.prepareLocked()
        if !self.wroteLaunchHeader {
          let context = self.metadata.keys.sorted().map { "\($0)=\(self.metadata[$0] ?? "")" }.joined(separator: " ")
          try self.appendLocked(date: self.now(), level: "INFO", category: "DemoApp", message: "app.launch \(context)")
          self.wroteLaunchHeader = true
        }
        try self.appendLocked(date: Date(timeIntervalSince1970: timestamp / 1000),
                              level: level.uppercased(), category: category, message: message)
        try self.pruneLocked()
      } catch {
        // Logging must never interrupt checkout or recurse through the logger.
      }
    }
  }

  @objc(files)
  func files() -> [[String: Any]] {
    queue.sync {
      do {
        try prepareLocked()
        return try entriesLocked().sorted { $0.url.lastPathComponent > $1.url.lastPathComponent }.map {
          ["name": $0.url.lastPathComponent, "sizeBytes": $0.size,
           "modifiedAt": $0.modified.timeIntervalSince1970 * 1000]
        }
      } catch { return [] }
    }
  }

  @objc(readFile:error:)
  func readFile(_ name: String) throws -> String {
    try queue.sync {
      try prepareLocked()
      let url = try existingFileLocked(name)
      let (data, truncated) = try tailLocked(url, maxBytes: 200_000)
      return (truncated ? "… showing the last 200 KB …\n" : "") + String(decoding: data, as: UTF8.self)
    }
  }

  @objc(snapshotForFile:error:)
  func snapshotForFile(_ name: String) throws -> URL {
    try queue.sync {
      scavengeExportsLocked()
      try prepareLocked()
      let source = try existingFileLocked(name)
      let folder = temporaryDirectory.appendingPathComponent("onramper-export-\(Self.exportSession)-\(UUID().uuidString)", isDirectory: true)
      do {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let snapshot = folder.appendingPathComponent(name)
        try FileManager.default.copyItem(at: source, to: snapshot)
        return snapshot
      } catch {
        try? FileManager.default.removeItem(at: folder)
        throw error
      }
    }
  }

  @objc(clearLogsAndReturnError:)
  func clearLogs() throws {
    try queue.sync {
      for entry in try entriesLocked() { try FileManager.default.removeItem(at: entry.url) }
      wroteLaunchHeader = false
    }
  }

  private struct Entry {
    let url: URL
    let size: Int
    let modified: Date
  }

  /// Share completion normally removes snapshots. After a crash, remove exports
  /// from earlier processes once they are a day old. Never touch this process's
  /// exports, even if another store is created or a share stays open past a day.
  private func scavengeExportsLocked() {
    let prefix = "onramper-export-"
    let keys: Set<URLResourceKey> = [.isDirectoryKey, .isSymbolicLinkKey, .contentModificationDateKey]
    guard let folders = try? FileManager.default.contentsOfDirectory(at: temporaryDirectory,
      includingPropertiesForKeys: Array(keys)) else { return }
    let cutoff = now().addingTimeInterval(-maxExportAge)
    for folder in folders {
      let name = folder.lastPathComponent
      guard name.hasPrefix(prefix), !name.hasPrefix("\(prefix)\(Self.exportSession)-") else { continue }
      let suffix = String(name.dropFirst(prefix.count))
      // Recognize both the original UUID-only names and process-scoped names.
      let legacy = UUID(uuidString: suffix) != nil
      let scoped = suffix.count == 73 && suffix.dropFirst(36).first == "-"
        && UUID(uuidString: String(suffix.prefix(36))) != nil
        && UUID(uuidString: String(suffix.suffix(36))) != nil
      guard legacy || scoped,
            let values = try? folder.resourceValues(forKeys: keys),
            values.isDirectory == true, values.isSymbolicLink != true,
            let modified = values.contentModificationDate, modified < cutoff else { continue }
      try? FileManager.default.removeItem(at: folder)
    }
  }

  private func validName(_ name: String) -> Bool {
    name.range(of: #"\Aonramper-sdk-\d{4}-\d{2}-\d{2}\.log\z"#, options: .regularExpression) != nil
  }

  private func entriesLocked() throws -> [Entry] {
    guard FileManager.default.fileExists(atPath: directory.path) else { return [] }
    return try FileManager.default.contentsOfDirectory(at: directory,
      includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey])
      .filter { validName($0.lastPathComponent) }.compactMap { url in
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true else { return nil }
        return Entry(url: url, size: values.fileSize ?? 0, modified: values.contentModificationDate ?? .distantPast)
      }
  }

  private func existingFileLocked(_ name: String) throws -> URL {
    guard validName(name), let file = try entriesLocked().first(where: { $0.url.lastPathComponent == name }) else {
      throw NSError(domain: "DemoLogs", code: 1, userInfo: [NSLocalizedDescriptionKey: "This log file is no longer available. Refresh the list."])
    }
    return file.url
  }

  private func prepareLocked() throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var excluded = directory
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try excluded.setResourceValues(values)
    try pruneLocked()
  }

  private func singleLine(_ value: String) -> String {
    value.replacingOccurrences(of: "\r", with: "\\r").replacingOccurrences(of: "\n", with: "\\n")
  }

  private func appendLocked(date: Date, level: String, category: String, message: String) throws {
    let timestamp = formatter.string(from: date)
    let url = directory.appendingPathComponent("onramper-sdk-\(timestamp.prefix(10)).log")
    let data = Data("\(timestamp) \(level) \(singleLine(category)) \(singleLine(message))\n".utf8)
    if FileManager.default.fileExists(atPath: url.path) {
      let handle = try FileHandle(forWritingTo: url)
      defer { try? handle.close() }
      try handle.seekToEnd()
      try handle.write(contentsOf: data)
    } else {
      try data.write(to: url, options: writingOptions)
    }
  }

  private var writingOptions: Data.WritingOptions {
    #if os(iOS)
    return [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
    #else
    return [.atomic]
    #endif
  }

  /// Read a bounded tail and discard an incomplete leading line. Cutting at a
  /// newline also avoids splitting a UTF-8 character in previews/size trimming.
  private func tailLocked(_ url: URL, maxBytes: Int) throws -> (Data, Bool) {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    let size = try handle.seekToEnd()
    let start = size > UInt64(maxBytes) ? size - UInt64(maxBytes) : 0
    try handle.seek(toOffset: start)
    var data = try handle.readToEnd() ?? Data()
    if start > 0 {
      if let newline = data.firstIndex(of: 10) { data = Data(data[data.index(after: newline)...]) }
      else { data = Data() }
    }
    return (data, start > 0)
  }

  private func pruneLocked() throws {
    let cutoff = now().addingTimeInterval(-maxAge)
    var remaining: [Entry] = []
    for entry in try entriesLocked() {
      if entry.modified < cutoff { try FileManager.default.removeItem(at: entry.url) }
      else { remaining.append(entry) }
    }
    remaining.sort { $0.url.lastPathComponent < $1.url.lastPathComponent }
    var total = remaining.reduce(0) { $0 + $1.size }
    // Remove older days first. If today's file alone exceeds the cap, retain
    // its newest complete lines, with an explicit truncation notice.
    while total > maxTotalBytes, remaining.count > 1 {
      let oldest = remaining.removeFirst()
      try FileManager.default.removeItem(at: oldest.url)
      total -= oldest.size
    }
    if total > maxTotalBytes, let latest = remaining.first {
      let notice = Data("… older entries removed to keep log storage bounded …\n".utf8)
      let (tail, _) = try tailLocked(latest.url, maxBytes: max(1, maxTotalBytes - notice.count))
      try (notice + tail).write(to: latest.url, options: writingOptions)
    }
  }
}
